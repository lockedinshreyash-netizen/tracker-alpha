/* ── Alpha Learn, the library as data ──
   Pure and tested (`npm run test:learn`). Every change to the library is a
   function here from one `Library` to the next; learn/store.ts only encrypts
   the result and puts it on disk. Nothing here touches IndexedDB, the network
   or the clock (callers pass `now` and fresh ids).

   Shaped for a sync that does not exist yet: every record has a random id and
   an `updatedAt`, and a delete is a dated tombstone (`deletedAt`) rather than
   a missing row, so a future merge by id can never bring back something
   another device removed. Tombstones are pruned after 60 days, like the
   reader's. */

export type LearnSubject = 'Physics' | 'Chemistry' | 'Maths' | 'Biology';
export type SubjectCode = 'PHY' | 'CHE' | 'MAT' | 'BIO';
export type TitleSource = 'youtube' | 'student';
export type CoverArt = 'rings' | 'waves' | 'hex' | 'orbit' | 'curve';
export type MarkKind = 'bookmark' | 'note';

export const SUBJECTS: LearnSubject[] = ['Physics', 'Chemistry', 'Maths', 'Biology'];
export const CODE_OF: Record<LearnSubject, SubjectCode> = { Physics: 'PHY', Chemistry: 'CHE', Maths: 'MAT', Biology: 'BIO' };

export interface Lecture {
  id: string;
  videoId: string;
  title: string;
  /* A YouTube title is API data: YouTube allows it to be kept 30 days unless
     refreshed. Once the student edits it, it is theirs and never refreshed. */
  titleSource: TitleSource;
  titleFetchedAt?: number;
  subject: LearnSubject;
  /** The Mocks key format: `11|Physics|Rotational Motion`. */
  chapterKey?: string;
  topic?: string;
  /** Counts up per subject and is never reused: PHY-014 is `Physics` + 14. */
  catalogueNo: number;
  addedAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Collection {
  id: string;
  name: string;
  /** The shelf's order, as the student set it. */
  lectureIds: string[];
  /** Shelves are listed oldest first, so editing one never moves it. */
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Mark {
  id: string;
  lectureId: string;
  /** Seconds into the video. */
  t: number;
  kind: MarkKind;
  text?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

/** A watched stretch in seconds, [from, to). */
export type Range = [number, number];

export interface Progress {
  lectureId: string;
  position: number;
  duration?: number;
  watched: Range[];
  rate: number;
  completedAt?: number;
  lastPlayedAt?: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface Library {
  lectures: Record<string, Lecture>;
  collections: Record<string, Collection>;
  marks: Record<string, Mark>;
  progress: Record<string, Progress>;
  /** Highest catalogue number ever given, per subject. */
  counters: Record<SubjectCode, number>;
}

export const LIMITS = {
  lectures: 2000,
  collections: 200,
  marks: 20000,
  title: 200,
  topic: 120,
  collectionName: 80,
  noteText: 4000,
  ranges: 400,
};

export const COMPLETE_FRACTION = 0.9;
export const TITLE_REFRESH_MS = 25 * 86_400_000;
export const TITLE_LIMIT_MS = 30 * 86_400_000;
export const TOMBSTONE_KEEP_MS = 60 * 86_400_000;

export const emptyLibrary = (): Library => ({
  lectures: {},
  collections: {},
  marks: {},
  progress: {},
  counters: { PHY: 0, CHE: 0, MAT: 0, BIO: 0 },
});

export const isLive = (r: { deletedAt?: number }): boolean => !r.deletedAt;
export const live = <T extends { deletedAt?: number }>(rows: Record<string, T>): T[] => Object.values(rows).filter(isLive);

/* ── Catalogue numbers ── */

export const catalogueCode = (subject: LearnSubject, n: number): string =>
  `${CODE_OF[subject]}-${String(n).padStart(3, '0')}`;

export const codeOf = (l: Pick<Lecture, 'subject' | 'catalogueNo'>): string => catalogueCode(l.subject, l.catalogueNo);

/* The counter, or the highest number on any lecture of that subject, dead ones
   included: a number once printed on a case is never printed on another, even
   if the counter was lost in an import. */
const nextNumber = (lib: Library, subject: LearnSubject): number => {
  const code = CODE_OF[subject];
  const used = Object.values(lib.lectures).filter(l => l.subject === subject).map(l => l.catalogueNo);
  return Math.max(lib.counters[code] ?? 0, ...used, 0) + 1;
};

/** The code the next lecture filed under `subject` will get. */
export const nextCode = (lib: Library, subject: LearnSubject): string => catalogueCode(subject, nextNumber(lib, subject));

const withNumber = (lib: Library, subject: LearnSubject): { lib: Library; n: number } => {
  const n = nextNumber(lib, subject);
  return { lib: { ...lib, counters: { ...lib.counters, [CODE_OF[subject]]: n } }, n };
};

/* ── Chapters ── */

const CHAPTER_KEY = /^(11|12)\|(Physics|Chemistry|Maths|Biology)\|[^|]{1,120}$/;

export const chapterKeyOf = (classId: 11 | 12, subject: LearnSubject, chapter: string): string =>
  `${classId}|${subject}|${chapter}`;

export const chapterName = (key?: string): string | null => (key && CHAPTER_KEY.test(key) ? key.split('|')[2] : null);

/* ── Cover art ──
   Picked from the lecture's id, so a lecture keeps its art forever and two
   lectures rarely share it. FNV-1a, because it is four lines and stable. */

export const COVER_ARTS: CoverArt[] = ['rings', 'waves', 'hex', 'orbit', 'curve'];

export const coverArt = (id: string): CoverArt => {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return COVER_ARTS[h % COVER_ARTS.length];
};

/* ── Lectures ── */

export interface NewLecture {
  videoId: string;
  title: string;
  titleSource: TitleSource;
  subject: LearnSubject;
  chapterKey?: string;
  topic?: string;
}

export type AddResult =
  | { lib: Library; lecture: Lecture; duplicate: false }
  | { lib: Library; lecture: Lecture; duplicate: true };

/** A video already on the shelf is not added twice: the existing case comes back. */
export const addLecture = (lib: Library, input: NewLecture, id: string, now: number): AddResult => {
  const existing = live(lib.lectures).find(l => l.videoId === input.videoId);
  if (existing) return { lib, lecture: existing, duplicate: true };
  if (live(lib.lectures).length >= LIMITS.lectures) throw new Error('library full');

  const { lib: numbered, n } = withNumber(lib, input.subject);
  const lecture = normalizeLecture({
    id,
    videoId: input.videoId,
    title: input.title,
    titleSource: input.titleSource,
    titleFetchedAt: input.titleSource === 'youtube' ? now : undefined,
    subject: input.subject,
    chapterKey: input.chapterKey,
    topic: input.topic,
    catalogueNo: n,
    addedAt: now,
    updatedAt: now,
  });
  if (!lecture) throw new Error('invalid lecture');
  return { lib: { ...numbered, lectures: { ...numbered.lectures, [id]: lecture } }, lecture, duplicate: false };
};

export interface LecturePatch {
  title?: string;
  subject?: LearnSubject;
  chapterKey?: string | null;
  topic?: string | null;
}

/* An edit to the title makes it the student's. Moving a lecture to another
   subject gives it a number in that subject: a Chemistry case reading PHY-014
   would be a lie on the shelf. The old number stays retired. */
export const updateLecture = (lib: Library, id: string, patch: LecturePatch, now: number): Library => {
  const cur = lib.lectures[id];
  if (!cur || !isLive(cur)) return lib;
  let next: Lecture = { ...cur, updatedAt: now };
  let base = lib;

  if (patch.title !== undefined) {
    const title = cleanText(patch.title, LIMITS.title);
    if (title && title !== cur.title) next = { ...next, title, titleSource: 'student', titleFetchedAt: undefined };
  }
  if (patch.subject && patch.subject !== cur.subject) {
    const { lib: numbered, n } = withNumber(base, patch.subject);
    base = numbered;
    next = { ...next, subject: patch.subject, catalogueNo: n, chapterKey: undefined };
  }
  if (patch.chapterKey !== undefined) {
    const key = patch.chapterKey && CHAPTER_KEY.test(patch.chapterKey) && patch.chapterKey.split('|')[1] === next.subject ? patch.chapterKey : undefined;
    next = { ...next, chapterKey: key };
  }
  if (patch.topic !== undefined) next = { ...next, topic: cleanText(patch.topic ?? '', LIMITS.topic) || undefined };

  return { ...base, lectures: { ...base.lectures, [id]: next } };
};

/** A fresh title from YouTube. A title the student wrote is never overwritten. */
export const refreshTitle = (lib: Library, id: string, title: string | null, now: number): Library => {
  const cur = lib.lectures[id];
  if (!cur || !isLive(cur) || cur.titleSource !== 'youtube') return lib;
  const clean = title ? cleanText(title, LIMITS.title) : '';
  // Gone or private: the YouTube title is dropped and the case shows its number.
  const next: Lecture = clean
    ? { ...cur, title: clean, titleFetchedAt: now, updatedAt: now }
    : { ...cur, title: '', titleFetchedAt: undefined, updatedAt: now };
  return { ...lib, lectures: { ...lib.lectures, [id]: next } };
};

/** Deleting a lecture takes its marks and progress with it and lifts it out of every collection. */
export const deleteLecture = (lib: Library, id: string, now: number): Library => {
  const cur = lib.lectures[id];
  if (!cur || !isLive(cur)) return lib;
  const marks = { ...lib.marks };
  for (const m of Object.values(marks)) {
    if (m.lectureId === id && isLive(m)) marks[m.id] = { ...m, deletedAt: now, updatedAt: now, text: undefined };
  }
  const collections = { ...lib.collections };
  for (const c of Object.values(collections)) {
    if (isLive(c) && c.lectureIds.includes(id)) collections[c.id] = { ...c, lectureIds: c.lectureIds.filter(x => x !== id), updatedAt: now };
  }
  const progress = { ...lib.progress };
  if (progress[id]) progress[id] = { ...progress[id], deletedAt: now, updatedAt: now, watched: [] };
  return {
    ...lib,
    lectures: { ...lib.lectures, [id]: { ...cur, deletedAt: now, updatedAt: now, title: '', topic: undefined } },
    marks,
    collections,
    progress,
  };
};

/* ── Titles ──
   own      the student wrote it
   fresh    from YouTube, under 25 days old
   stale    from YouTube, due a refresh (ask when the lecture is opened)
   expired  from YouTube, 30 days or more without a refresh: not shown */

export type TitleState = 'own' | 'fresh' | 'stale' | 'expired';

export const titleState = (l: Lecture, now: number): TitleState => {
  if (l.titleSource === 'student') return 'own';
  if (!l.title || !l.titleFetchedAt) return 'expired';
  const age = now - l.titleFetchedAt;
  if (age >= TITLE_LIMIT_MS) return 'expired';
  return age >= TITLE_REFRESH_MS ? 'stale' : 'fresh';
};

/** What the case prints: the title, or its catalogue number when the title may not be shown. */
export const displayTitle = (l: Lecture, now: number): string =>
  titleState(l, now) === 'expired' ? codeOf(l) : l.title;

/* ── Marks ── */

export interface NewMark {
  lectureId: string;
  t: number;
  kind: MarkKind;
  text?: string;
}

export const addMark = (lib: Library, input: NewMark, id: string, now: number): Library => {
  const lecture = lib.lectures[input.lectureId];
  if (!lecture || !isLive(lecture)) return lib;
  if (live(lib.marks).length >= LIMITS.marks) throw new Error('too many marks');
  const mark = normalizeMark({ ...input, id, createdAt: now, updatedAt: now });
  if (!mark) return lib;
  return { ...lib, marks: { ...lib.marks, [id]: mark } };
};

export const updateMark = (lib: Library, id: string, patch: { t?: number; text?: string }, now: number): Library => {
  const cur = lib.marks[id];
  if (!cur || !isLive(cur)) return lib;
  const next = normalizeMark({ ...cur, ...patch, updatedAt: now });
  return next ? { ...lib, marks: { ...lib.marks, [id]: next } } : lib;
};

export const deleteMark = (lib: Library, id: string, now: number): Library => {
  const cur = lib.marks[id];
  if (!cur || !isLive(cur)) return lib;
  return { ...lib, marks: { ...lib.marks, [id]: { ...cur, deletedAt: now, updatedAt: now, text: undefined } } };
};

/** A lecture's live marks, in the order they come in the video. */
export const marksFor = (lib: Library, lectureId: string): Mark[] =>
  live(lib.marks).filter(m => m.lectureId === lectureId).sort((a, b) => a.t - b.t || a.createdAt - b.createdAt);

/* ── Collections ── */

export const createCollection = (lib: Library, name: string, id: string, now: number): Library => {
  if (live(lib.collections).length >= LIMITS.collections) throw new Error('too many collections');
  const clean = cleanText(name, LIMITS.collectionName);
  if (!clean) return lib;
  return { ...lib, collections: { ...lib.collections, [id]: { id, name: clean, lectureIds: [], createdAt: now, updatedAt: now } } };
};

/** Live collections, oldest first. */
export const collectionsInOrder = (lib: Library): Collection[] =>
  live(lib.collections).sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));

/** The live collections a lecture is on. */
export const collectionsFor = (lib: Library, lectureId: string): Collection[] =>
  collectionsInOrder(lib).filter(c => c.lectureIds.includes(lectureId));

/** Puts a lecture at the end of a shelf, or takes it off. */
export const setInCollection = (lib: Library, collectionId: string, lectureId: string, on: boolean, now: number): Library => {
  const cur = lib.collections[collectionId];
  if (!cur || !isLive(cur)) return lib;
  const has = cur.lectureIds.includes(lectureId);
  if (on === has) return lib;
  const ids = on ? [...cur.lectureIds, lectureId] : cur.lectureIds.filter(x => x !== lectureId);
  return setCollectionLectures(lib, collectionId, ids, now);
};

/** One place left (-1) or right (+1) along the shelf, stopping at the ends. */
export const moveInCollection = (lib: Library, collectionId: string, lectureId: string, dir: 1 | -1, now: number): Library => {
  const cur = lib.collections[collectionId];
  if (!cur || !isLive(cur)) return lib;
  const i = cur.lectureIds.indexOf(lectureId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= cur.lectureIds.length) return lib;
  const ids = [...cur.lectureIds];
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return setCollectionLectures(lib, collectionId, ids, now);
};

export const renameCollection = (lib: Library, id: string, name: string, now: number): Library => {
  const cur = lib.collections[id];
  const clean = cleanText(name, LIMITS.collectionName);
  if (!cur || !isLive(cur) || !clean) return lib;
  return { ...lib, collections: { ...lib.collections, [id]: { ...cur, name: clean, updatedAt: now } } };
};

/** The shelf's order, as given. Unknown, deleted and repeated lectures are dropped. */
export const setCollectionLectures = (lib: Library, id: string, lectureIds: string[], now: number): Library => {
  const cur = lib.collections[id];
  if (!cur || !isLive(cur)) return lib;
  const seen = new Set<string>();
  const ids = lectureIds.filter(x => lib.lectures[x] && isLive(lib.lectures[x]) && !seen.has(x) && (seen.add(x), true));
  return { ...lib, collections: { ...lib.collections, [id]: { ...cur, lectureIds: ids, updatedAt: now } } };
};

export const deleteCollection = (lib: Library, id: string, now: number): Library => {
  const cur = lib.collections[id];
  if (!cur || !isLive(cur)) return lib;
  return { ...lib, collections: { ...lib.collections, [id]: { ...cur, deletedAt: now, updatedAt: now, name: '', lectureIds: [] } } };
};

/* ── Progress ──
   `watched` is the stretches actually played, merged, so skipping to the end
   is not finishing. A lecture is complete at 90% watched, and stays complete. */

export const mergeRanges = (ranges: Range[], add?: Range): Range[] => {
  const all = (add ? [...ranges, add] : ranges)
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b) && b > a)
    .map(([a, b]) => [Math.max(0, a), b] as Range)
    .sort((x, y) => x[0] - y[0]);
  const out: Range[] = [];
  for (const [a, b] of all) {
    const last = out[out.length - 1];
    // Within a second counts as touching: the poll is coarse.
    if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  // Too many fragments: close the smallest gaps first until it fits.
  while (out.length > LIMITS.ranges) {
    let gapAt = 1;
    for (let i = 2; i < out.length; i++) if (out[i][0] - out[i - 1][1] < out[gapAt][0] - out[gapAt - 1][1]) gapAt = i;
    out[gapAt - 1][1] = out[gapAt][1];
    out.splice(gapAt, 1);
  }
  return out;
};

export const watchedSeconds = (ranges: Range[]): number => ranges.reduce((s, [a, b]) => s + (b - a), 0);

export const watchedFraction = (p: Pick<Progress, 'watched' | 'duration'>): number =>
  p.duration && p.duration > 0 ? Math.min(1, watchedSeconds(p.watched) / p.duration) : 0;

export interface WatchUpdate {
  /** The stretch played since the last update, in seconds. */
  from?: number;
  to?: number;
  position: number;
  duration?: number | null;
  rate?: number;
}

export const recordWatch = (lib: Library, lectureId: string, w: WatchUpdate, now: number): Library => {
  const lecture = lib.lectures[lectureId];
  if (!lecture || !isLive(lecture)) return lib;
  const cur: Progress = lib.progress[lectureId] && isLive(lib.progress[lectureId])
    ? lib.progress[lectureId]
    : { lectureId, position: 0, watched: [], rate: 1, updatedAt: now };
  const duration = w.duration && w.duration > 0 ? w.duration : cur.duration;
  const range: Range | undefined = w.from !== undefined && w.to !== undefined ? [w.from, Math.min(w.to, duration ?? w.to)] : undefined;
  const watched = mergeRanges(cur.watched, range);
  const next: Progress = {
    ...cur,
    position: Math.max(0, Number.isFinite(w.position) ? w.position : cur.position),
    duration,
    watched,
    rate: w.rate && w.rate > 0 ? w.rate : cur.rate,
    lastPlayedAt: now,
    updatedAt: now,
  };
  if (!next.completedAt && watchedFraction(next) >= COMPLETE_FRACTION) next.completedAt = now;
  return { ...lib, progress: { ...lib.progress, [lectureId]: next } };
};

export const isComplete = (lib: Library, lectureId: string): boolean => !!lib.progress[lectureId]?.completedAt && isLive(lib.progress[lectureId]);

/* ── Housekeeping ── */

/** Drops tombstones older than 60 days. Live rows are never touched. */
export const prune = (lib: Library, now: number): Library => {
  const keep = <T extends { deletedAt?: number }>(rows: Record<string, T>) =>
    Object.fromEntries(Object.entries(rows).filter(([, r]) => !r.deletedAt || now - r.deletedAt < TOMBSTONE_KEEP_MS));
  // A pruned lecture's number stays retired through the counter.
  return {
    ...lib,
    lectures: keep(lib.lectures),
    collections: keep(lib.collections),
    marks: keep(lib.marks),
    progress: keep(lib.progress),
  };
};

/* ── Validation ──
   Every record that enters the library from outside this module (decrypted
   from disk, read from an import file) passes through one of these, field by
   field. Anything malformed is dropped, never repaired into something the
   student did not write. The video id is checked by shape because it ends up
   in an iframe `src`. */

const ID_RE = /^[A-Za-z0-9_-]{6,40}$/;
const VIDEO_RE = /^[A-Za-z0-9_-]{11}$/;

const cleanText = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';

const time = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined);
const seconds = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e6 ? v : undefined);

export const normalizeLecture = (raw: unknown): Lecture | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const subject = SUBJECTS.includes(r.subject as LearnSubject) ? (r.subject as LearnSubject) : null;
  const addedAt = time(r.addedAt);
  const updatedAt = time(r.updatedAt) ?? addedAt;
  const n = typeof r.catalogueNo === 'number' && Number.isInteger(r.catalogueNo) && r.catalogueNo > 0 && r.catalogueNo < 1e6 ? r.catalogueNo : null;
  if (typeof r.id !== 'string' || !ID_RE.test(r.id) || !subject || !n || !addedAt || !updatedAt) return null;
  const deletedAt = time(r.deletedAt);
  if (typeof r.videoId !== 'string' || !VIDEO_RE.test(r.videoId)) return null;
  const titleSource: TitleSource = r.titleSource === 'student' ? 'student' : 'youtube';
  const title = cleanText(r.title, LIMITS.title);
  if (!deletedAt && !title && titleSource === 'student') return null;
  const chapterKey = typeof r.chapterKey === 'string' && CHAPTER_KEY.test(r.chapterKey) && r.chapterKey.split('|')[1] === subject ? r.chapterKey : undefined;
  const topic = cleanText(r.topic, LIMITS.topic) || undefined;
  return {
    id: r.id,
    videoId: r.videoId,
    title,
    titleSource,
    titleFetchedAt: titleSource === 'youtube' && title ? time(r.titleFetchedAt) : undefined,
    subject,
    chapterKey,
    topic,
    catalogueNo: n,
    addedAt,
    updatedAt,
    ...(deletedAt ? { deletedAt } : {}),
  };
};

export const normalizeCollection = (raw: unknown): Collection | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const updatedAt = time(r.updatedAt);
  const deletedAt = time(r.deletedAt);
  if (typeof r.id !== 'string' || !ID_RE.test(r.id) || !updatedAt) return null;
  const name = cleanText(r.name, LIMITS.collectionName);
  if (!deletedAt && !name) return null;
  const ids = Array.isArray(r.lectureIds) ? r.lectureIds.filter((x): x is string => typeof x === 'string' && ID_RE.test(x)) : [];
  const createdAt = time(r.createdAt) ?? updatedAt;
  return { id: r.id, name, lectureIds: [...new Set(ids)].slice(0, LIMITS.lectures), createdAt, updatedAt, ...(deletedAt ? { deletedAt } : {}) };
};

export const normalizeMark = (raw: unknown): Mark | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const createdAt = time(r.createdAt);
  const updatedAt = time(r.updatedAt) ?? createdAt;
  const t = seconds(r.t);
  const kind: MarkKind | null = r.kind === 'bookmark' || r.kind === 'note' ? r.kind : null;
  if (typeof r.id !== 'string' || !ID_RE.test(r.id) || typeof r.lectureId !== 'string' || !ID_RE.test(r.lectureId)) return null;
  if (!createdAt || !updatedAt || t === undefined || !kind) return null;
  const deletedAt = time(r.deletedAt);
  const text = cleanText(r.text, LIMITS.noteText) || undefined;
  if (!deletedAt && kind === 'note' && !text) return null;
  return { id: r.id, lectureId: r.lectureId, t: Math.round(t * 10) / 10, kind, text, createdAt, updatedAt, ...(deletedAt ? { deletedAt } : {}) };
};

export const normalizeProgress = (raw: unknown): Progress | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const updatedAt = time(r.updatedAt);
  if (typeof r.lectureId !== 'string' || !ID_RE.test(r.lectureId) || !updatedAt) return null;
  const watched = Array.isArray(r.watched)
    ? mergeRanges(r.watched.filter((x): x is Range => Array.isArray(x) && x.length === 2 && seconds(x[0]) !== undefined && seconds(x[1]) !== undefined))
    : [];
  const rate = typeof r.rate === 'number' && r.rate > 0 && r.rate <= 4 ? r.rate : 1;
  const deletedAt = time(r.deletedAt);
  return {
    lectureId: r.lectureId,
    position: seconds(r.position) ?? 0,
    duration: seconds(r.duration) || undefined,
    watched,
    rate,
    completedAt: time(r.completedAt),
    lastPlayedAt: time(r.lastPlayedAt),
    updatedAt,
    ...(deletedAt ? { deletedAt } : {}),
  };
};

const normalizeCounters = (raw: unknown): Library['counters'] => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const n = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 1e6 ? v : 0);
  return { PHY: n(r.PHY), CHE: n(r.CHE), MAT: n(r.MAT), BIO: n(r.BIO) };
};

/* ── Export and import ──
   The export is plain JSON on purpose: it is the student's own backup, and it
   must open without Alpha (or Alpha's key). The button that makes it says so.
   Import merges into what is already here and never deletes:
   - a record already here keeps whichever side changed it last;
   - a lecture for a video already on the shelf is not added twice; its marks
     and progress move onto the case that is here;
   - a number already printed on another case is given the next free one. */

export const EXPORT_FORMAT = 'alpha-learn/1';

export interface LibraryExport {
  format: typeof EXPORT_FORMAT;
  exportedAt: number;
  lectures: Lecture[];
  collections: Collection[];
  marks: Mark[];
  progress: Progress[];
  counters: Library['counters'];
}

export const exportLibrary = (lib: Library, now: number): LibraryExport => ({
  format: EXPORT_FORMAT,
  exportedAt: now,
  lectures: live(lib.lectures),
  collections: live(lib.collections),
  marks: live(lib.marks),
  progress: live(lib.progress),
  counters: lib.counters,
});

export interface ImportReport {
  added: number;
  updated: number;
  merged: number;
  renumbered: number;
  rejected: number;
}

export type ImportResult = { ok: true; lib: Library; report: ImportReport } | { ok: false; reason: 'format' };

export const importLibrary = (lib: Library, raw: unknown, now: number): ImportResult => {
  if (!raw || typeof raw !== 'object' || (raw as { format?: unknown }).format !== EXPORT_FORMAT) return { ok: false, reason: 'format' };
  const src = raw as Record<string, unknown>;
  const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
  const report: ImportReport = { added: 0, updated: 0, merged: 0, renumbered: 0, rejected: 0 };
  const take = <T,>(v: unknown, fn: (x: unknown) => T | null): T[] =>
    list(v).map(x => { const r = fn(x); if (!r) report.rejected++; return r; }).filter((x): x is T => !!x);

  const lectures = take(src.lectures, normalizeLecture);
  const collections = take(src.collections, normalizeCollection);
  const marks = take(src.marks, normalizeMark);
  const progress = take(src.progress, normalizeProgress);
  const theirCounters = normalizeCounters(src.counters);

  let out: Library = {
    ...lib,
    counters: {
      PHY: Math.max(lib.counters.PHY, theirCounters.PHY),
      CHE: Math.max(lib.counters.CHE, theirCounters.CHE),
      MAT: Math.max(lib.counters.MAT, theirCounters.MAT),
      BIO: Math.max(lib.counters.BIO, theirCounters.BIO),
    },
  };
  /** Imported lecture id → the id it lives under here. */
  const remap = new Map<string, string>();

  for (const l of lectures) {
    if (l.deletedAt) continue;
    const mine = out.lectures[l.id];
    if (mine) {
      remap.set(l.id, l.id);
      if (l.updatedAt > mine.updatedAt && isLive(mine)) {
        // The number on the case here does not change under the student's feet.
        const chapterKey = l.subject === mine.subject ? l.chapterKey : mine.chapterKey;
        out = { ...out, lectures: { ...out.lectures, [l.id]: { ...l, subject: mine.subject, catalogueNo: mine.catalogueNo, chapterKey } } };
        report.updated++;
      }
      continue;
    }
    const sameVideo = live(out.lectures).find(x => x.videoId === l.videoId);
    if (sameVideo) {
      remap.set(l.id, sameVideo.id);
      report.merged++;
      continue;
    }
    if (live(out.lectures).length >= LIMITS.lectures) { report.rejected++; continue; }
    let lecture = l;
    const clash = Object.values(out.lectures).some(x => x.subject === l.subject && x.catalogueNo === l.catalogueNo);
    if (clash) {
      const { lib: numbered, n } = withNumber(out, l.subject);
      out = numbered;
      lecture = { ...l, catalogueNo: n };
      report.renumbered++;
    }
    out = { ...out, lectures: { ...out.lectures, [lecture.id]: lecture } };
    remap.set(l.id, lecture.id);
    report.added++;
  }

  for (const m of marks) {
    const target = remap.get(m.lectureId);
    if (!target || m.deletedAt) continue;
    const mine = out.marks[m.id];
    // A deletion here is final, however recent the file's copy.
    if (mine && (!isLive(mine) || mine.updatedAt >= m.updatedAt)) continue;
    out = { ...out, marks: { ...out.marks, [m.id]: { ...m, lectureId: target } } };
  }

  for (const p of progress) {
    const target = remap.get(p.lectureId);
    if (!target || p.deletedAt) continue;
    const mine = out.progress[target];
    const next: Progress = mine && isLive(mine)
      ? {
        ...mine,
        watched: mergeRanges([...mine.watched, ...p.watched]),
        duration: mine.duration ?? p.duration,
        position: (p.lastPlayedAt ?? 0) > (mine.lastPlayedAt ?? 0) ? p.position : mine.position,
        lastPlayedAt: Math.max(mine.lastPlayedAt ?? 0, p.lastPlayedAt ?? 0) || undefined,
        completedAt: mine.completedAt ?? p.completedAt,
        updatedAt: now,
      }
      : { ...p, lectureId: target };
    out = { ...out, progress: { ...out.progress, [target]: next } };
  }

  for (const c of collections) {
    if (c.deletedAt) continue;
    const ids = c.lectureIds.map(x => remap.get(x)).filter((x): x is string => !!x);
    const mine = out.collections[c.id];
    if (mine && (!isLive(mine) || mine.updatedAt >= c.updatedAt)) continue;
    if (!mine && live(out.collections).length >= LIMITS.collections) continue;
    out = { ...out, collections: { ...out.collections, [c.id]: { ...c, lectureIds: [...new Set(ids)] } } };
  }

  return { ok: true, lib: out, report };
};

/** Rebuilds a library from validated records (what the store decrypts from disk). */
export const libraryFrom = (parts: {
  lectures: unknown[];
  collections: unknown[];
  marks: unknown[];
  progress: unknown[];
  counters: unknown;
}): Library => {
  const byId = <T,>(rows: unknown[], fn: (x: unknown) => T | null, key: (t: T) => string) =>
    Object.fromEntries(rows.map(fn).filter((x): x is T => !!x).map(x => [key(x), x]));
  return {
    lectures: byId(parts.lectures, normalizeLecture, l => l.id),
    collections: byId(parts.collections, normalizeCollection, c => c.id),
    marks: byId(parts.marks, normalizeMark, m => m.id),
    progress: byId(parts.progress, normalizeProgress, p => p.lectureId),
    counters: normalizeCounters(parts.counters),
  };
};
