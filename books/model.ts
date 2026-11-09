/* ── Alpha Books, the shelf as data ──
   Pure and tested (`npm run test:books`). The student brings their own PDFs
   (NCERT, modules, DPPs); the file never leaves the device (books/files.ts),
   and what is here is everything about it that is not the file: its title,
   kind, cover, which pages are which syllabus chapter, and every mark made
   in it. Learn's store seals these records with the account's key, beside
   the lectures (learn/store.ts), so a book is a Learn row like any other.

   Learn's conventions, kept exactly: random ids, an `updatedAt` on every
   record, deletes as dated tombstones pruned after 60 days, every record from
   outside validated field by field and dropped (never repaired) when wrong.
   Nothing here touches IndexedDB, the network or the clock.

   This file must not import learn/model.ts: learn/model.ts imports it. */

export type BookSubject = 'Physics' | 'Chemistry' | 'Maths' | 'Biology';
export type BookKind = 'book' | 'module' | 'dpp' | 'notes' | 'other';
export type CoverFinish = 'ink' | 'paper';
export type BookMarkKind = 'highlight' | 'snip' | 'bookmark';
export type MarkColor = 'yellow' | 'green' | 'blue' | 'pink';

export const BOOK_SUBJECTS: BookSubject[] = ['Physics', 'Chemistry', 'Maths', 'Biology'];
export const BOOK_KINDS: BookKind[] = ['book', 'module', 'dpp', 'notes', 'other'];
export const MARK_COLORS: MarkColor[] = ['yellow', 'green', 'blue', 'pink'];

export const KIND_LABEL: Record<BookKind, string> = {
  book: 'Textbook',
  module: 'Module',
  dpp: 'DPP',
  notes: 'Notes',
  other: 'Other',
};

/** A stretch of pages that is one syllabus chapter. Pages are 1-based and `to` is included. */
export interface Section {
  from: number;
  to: number;
  /** The Mocks key format: `11|Physics|Units & Measurements`. */
  chapterKey: string;
}

export interface BookCover {
  /** An id from books/covers.ts. Unknown ids draw the default for the book. */
  design: string;
  finish: CoverFinish;
  /** Use page 1, rendered on this device, instead of a design. */
  firstPage?: boolean;
}

export interface Book {
  id: string;
  title: string;
  kind: BookKind;
  subject?: BookSubject;
  classId?: 11 | 12;
  sections: Section[];
  cover: BookCover;
  /** SHA-256 of the whole file, hex. The same PDF on another device is the same book. */
  fingerprint: string;
  pages: number;
  bytes: number;
  addedAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
  deletedAt?: number;
}

/** A rectangle as fractions of the page: [x, y, w, h], top-left origin. Survives any zoom. */
export type PageRect = [number, number, number, number];

export interface BookMark {
  id: string;
  bookId: string;
  kind: BookMarkKind;
  page: number;
  /** Highlights: offsets into the page's text (books/anchors.ts) and the words themselves. */
  start?: number;
  end?: number;
  quote?: string;
  /** Highlights: where the words were drawn. Snips: the one rectangle. */
  rects?: PageRect[];
  color?: MarkColor;
  note?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

/** Pages seen, as [from, to] runs (1-based, inclusive). */
export type PageRun = [number, number];

export interface BookProgress {
  bookId: string;
  page: number;
  /** How far down `page` the reading line is, 0–1. */
  offset: number;
  seen: PageRun[];
  updatedAt: number;
  deletedAt?: number;
}

export interface Shelf {
  books: Record<string, Book>;
  bookMarks: Record<string, BookMark>;
  bookProgress: Record<string, BookProgress>;
}

export const BOOK_LIMITS = {
  books: 400,
  marks: 30000,
  title: 160,
  quote: 2000,
  note: 4000,
  sections: 80,
  pages: 20000,
  bytes: 300 * 1024 * 1024,
  rects: 60,
  runs: 400,
};

export const BOOK_TOMBSTONE_MS = 60 * 86_400_000;

export const emptyShelf = (): Shelf => ({ books: {}, bookMarks: {}, bookProgress: {} });

const isLive = (r: { deletedAt?: number }): boolean => !r.deletedAt;
const live = <T extends { deletedAt?: number }>(rows: Record<string, T>): T[] => Object.values(rows).filter(isLive);

export const liveBooks = (s: Shelf): Book[] => live(s.books);

/* ── Chapters ── */

const CHAPTER_KEY = /^(11|12)\|(Physics|Chemistry|Maths|Biology)\|[^|]{1,120}$/;
export const isChapterKey = (k: unknown): k is string => typeof k === 'string' && CHAPTER_KEY.test(k);
export const chapterOfKey = (k: string): string => k.split('|')[2] ?? '';

/** Sorted, clipped to the book, overlaps cut away (the earlier section keeps its pages). */
export const cleanSections = (raw: Section[], pages: number): Section[] => {
  const sorted = raw
    .filter(s => isChapterKey(s.chapterKey) && Number.isInteger(s.from) && Number.isInteger(s.to))
    .map(s => ({ chapterKey: s.chapterKey, from: Math.max(1, s.from), to: Math.min(pages, s.to) }))
    .filter(s => s.from <= s.to)
    .sort((a, b) => a.from - b.from || a.to - b.to);
  const out: Section[] = [];
  for (const s of sorted) {
    const prev = out[out.length - 1];
    if (prev && s.from <= prev.to) {
      if (s.to <= prev.to) continue;
      s.from = prev.to + 1;
    }
    if (prev && prev.chapterKey === s.chapterKey && prev.to + 1 === s.from) { prev.to = s.to; continue; }
    out.push(s);
  }
  return out.slice(0, BOOK_LIMITS.sections);
};

/* A chapter added by hand: it starts on `start` and runs to the page before
   the next chapter (or the end). A chapter it lands inside is cut short just
   before it; one that started on the same page is replaced. Pages no chapter
   claimed before stay unclaimed, so an unmatched stretch (an appendix, a
   chapter outside the syllabus) is not swallowed by its neighbour. */
export const addChapterAt = (sections: Section[], start: number, chapterKey: string, pages: number): Section[] => {
  if (!isChapterKey(chapterKey) || start < 1 || start > pages) return sections;
  const sorted = [...sections].sort((a, b) => a.from - b.from);
  const inside = sorted.find(s => start >= s.from && start <= s.to);
  const next = sorted.find(s => s.from > start);
  const to = inside ? inside.to : next ? next.from - 1 : pages;
  const kept = sorted
    .filter(s => s.from !== start)
    .map(s => (s === inside && s.from < start ? { ...s, to: start - 1 } : s));
  return cleanSections([...kept, { from: start, to, chapterKey }], pages);
};

/** Takes away the chapter starting on `from`. Its pages become unclaimed. */
export const removeChapterAt = (sections: Section[], from: number): Section[] => sections.filter(s => s.from !== from);

export const sectionAt = (book: Pick<Book, 'sections'>, page: number): Section | undefined =>
  book.sections.find(s => page >= s.from && page <= s.to);

/** Every live book stretch filed under a chapter, for the chapter shelf. */
export const sectionsFor = (s: Shelf, chapterKey: string): { book: Book; section: Section }[] =>
  liveBooks(s).flatMap(book => book.sections.filter(x => x.chapterKey === chapterKey).map(section => ({ book, section })));

/* Outline entries matched to chapters become page ranges: each match runs to
   the page before the next outline entry. `guess` is learn/discover/match.ts's
   guessChapter, passed in so this file stays free of Learn imports. */
export interface OutlineEntry { title: string; page: number }

export const proposeSections = (
  outline: OutlineEntry[],
  pages: number,
  guess: (title: string) => string | null,
): Section[] => {
  const entries = outline.filter(e => Number.isInteger(e.page) && e.page >= 1 && e.page <= pages).sort((a, b) => a.page - b.page);
  const out: Section[] = [];
  entries.forEach((e, i) => {
    const key = guess(e.title);
    if (!key) return;
    const next = entries.slice(i + 1).find(x => x.page > e.page);
    out.push({ chapterKey: key, from: e.page, to: next ? next.page - 1 : pages });
  });
  return cleanSections(out, pages);
};

/* ── Covers ── */

/* FNV-1a over the id, as learn/model.ts's coverArt: a book keeps its default forever. */
export const hashOf = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
};

/* ── Books ── */

export interface NewBook {
  title: string;
  kind: BookKind;
  subject?: BookSubject;
  classId?: 11 | 12;
  sections?: Section[];
  cover: BookCover;
  fingerprint: string;
  pages: number;
  bytes: number;
}

export type AddBookResult =
  | { status: 'added'; shelf: Shelf; book: Book }
  | { status: 'restored'; shelf: Shelf; book: Book }
  | { status: 'exists'; shelf: Shelf; book: Book }
  | { status: 'full'; shelf: Shelf };

export const findByFingerprint = (s: Shelf, fingerprint: string): Book | undefined =>
  Object.values(s.books).filter(b => b.fingerprint === fingerprint).sort((a, b) => Number(!!a.deletedAt) - Number(!!b.deletedAt) || b.updatedAt - a.updatedAt)[0];

/* The same file twice is one book. A file removed within the last 60 days
   comes back as the book it was, marks and all: removing a PDF to free space
   must not cost the student their highlights. */
export const addBook = (s: Shelf, input: NewBook, id: string, now: number): AddBookResult => {
  const same = findByFingerprint(s, input.fingerprint);
  if (same && isLive(same)) return { status: 'exists', shelf: s, book: same };
  if (same) {
    const { deletedAt: _gone, ...rest } = same;
    const book: Book = { ...rest, updatedAt: now };
    return { status: 'restored', shelf: { ...s, books: { ...s.books, [book.id]: book } }, book };
  }
  if (liveBooks(s).length >= BOOK_LIMITS.books) return { status: 'full', shelf: s };
  const pages = clampInt(input.pages, 1, BOOK_LIMITS.pages);
  const book: Book = {
    id,
    title: cleanText(input.title, BOOK_LIMITS.title) || 'Untitled',
    kind: input.kind,
    subject: input.subject,
    classId: input.classId,
    sections: cleanSections(input.sections ?? [], pages),
    cover: input.cover,
    fingerprint: input.fingerprint,
    pages,
    bytes: Math.max(0, Math.floor(input.bytes)),
    addedAt: now,
    updatedAt: now,
  };
  return { status: 'added', shelf: { ...s, books: { ...s.books, [id]: book } }, book };
};

export interface BookPatch {
  title?: string;
  kind?: BookKind;
  subject?: BookSubject | null;
  classId?: 11 | 12 | null;
  sections?: Section[];
  cover?: BookCover;
}

export const updateBook = (s: Shelf, id: string, patch: BookPatch, now: number): Shelf => {
  const b = s.books[id];
  if (!b || !isLive(b)) return s;
  const next: Book = { ...b, updatedAt: now };
  if (patch.title !== undefined) next.title = cleanText(patch.title, BOOK_LIMITS.title) || b.title;
  if (patch.kind) next.kind = patch.kind;
  if (patch.subject !== undefined) next.subject = patch.subject ?? undefined;
  if (patch.classId !== undefined) next.classId = patch.classId ?? undefined;
  if (patch.sections) next.sections = cleanSections(patch.sections, b.pages);
  if (patch.cover) next.cover = patch.cover;
  return { ...s, books: { ...s.books, [id]: next } };
};

export const touchBook = (s: Shelf, id: string, now: number): Shelf => {
  const b = s.books[id];
  if (!b || !isLive(b)) return s;
  return { ...s, books: { ...s.books, [id]: { ...b, lastOpenedAt: now, updatedAt: now } } };
};

/** Tombstones the book. Its marks and progress stay, so the same file brings them back. */
export const deleteBook = (s: Shelf, id: string, now: number): Shelf => {
  const b = s.books[id];
  if (!b || !isLive(b)) return s;
  return { ...s, books: { ...s.books, [id]: { ...b, deletedAt: now, updatedAt: now } } };
};

/* ── Marks ── */

export interface NewBookMark {
  bookId: string;
  kind: BookMarkKind;
  page: number;
  start?: number;
  end?: number;
  quote?: string;
  rects?: PageRect[];
  color?: MarkColor;
  note?: string;
}

export const addBookMark = (s: Shelf, input: NewBookMark, id: string, now: number): Shelf => {
  const book = s.books[input.bookId];
  if (!book || !isLive(book)) return s;
  if (live(s.bookMarks).length >= BOOK_LIMITS.marks) return s;
  const mark = normalizeBookMark({ ...input, id, createdAt: now, updatedAt: now });
  if (!mark || mark.page > book.pages) return s;
  return { ...s, bookMarks: { ...s.bookMarks, [id]: mark } };
};

export const updateBookMark = (s: Shelf, id: string, patch: { color?: MarkColor; note?: string | null }, now: number): Shelf => {
  const m = s.bookMarks[id];
  if (!m || !isLive(m)) return s;
  const next: BookMark = { ...m, updatedAt: now };
  if (patch.color && MARK_COLORS.includes(patch.color)) next.color = patch.color;
  if (patch.note !== undefined) next.note = cleanText(patch.note ?? '', BOOK_LIMITS.note) || undefined;
  return { ...s, bookMarks: { ...s.bookMarks, [id]: next } };
};

export const deleteBookMark = (s: Shelf, id: string, now: number): Shelf => {
  const m = s.bookMarks[id];
  if (!m || !isLive(m)) return s;
  return { ...s, bookMarks: { ...s.bookMarks, [id]: { ...m, deletedAt: now, updatedAt: now } } };
};

/** Brings back a mark removed a moment ago (the Undo toast). */
export const restoreBookMark = (s: Shelf, id: string, now: number): Shelf => {
  const m = s.bookMarks[id];
  if (!m || isLive(m)) return s;
  const { deletedAt: _gone, ...rest } = m;
  return { ...s, bookMarks: { ...s.bookMarks, [id]: { ...rest, updatedAt: now } } };
};

/** A book's live marks in reading order. */
export const marksOf = (s: Shelf, bookId: string): BookMark[] =>
  live(s.bookMarks)
    .filter(m => m.bookId === bookId)
    .sort((a, b) => a.page - b.page || (a.start ?? topOf(a)) - (b.start ?? topOf(b)) || a.createdAt - b.createdAt);

const topOf = (m: BookMark): number => Math.round((m.rects?.[0]?.[1] ?? 0) * 1e6);

/* ── Reading progress ── */

export const mergeRuns = (runs: PageRun[], add?: PageRun): PageRun[] => {
  const all = (add ? [...runs, add] : runs).map(([a, b]) => [Math.min(a, b), Math.max(a, b)] as PageRun).sort((x, y) => x[0] - y[0]);
  const out: PageRun[] = [];
  for (const [a, b] of all) {
    const prev = out[out.length - 1];
    if (prev && a <= prev[1] + 1) prev[1] = Math.max(prev[1], b);
    else out.push([a, b]);
  }
  return out.slice(-BOOK_LIMITS.runs);
};

export const pagesSeen = (runs: PageRun[], from = 1, to = Infinity): number =>
  runs.reduce((n, [a, b]) => n + Math.max(0, Math.min(b, to) - Math.max(a, from) + 1), 0);

export interface ReadingUpdate { page: number; offset: number; seen?: PageRun | PageRun[] }

export const recordReading = (s: Shelf, bookId: string, u: ReadingUpdate, now: number): Shelf => {
  const book = s.books[bookId];
  if (!book || !isLive(book)) return s;
  const page = clampInt(u.page, 1, book.pages);
  const offset = Math.min(1, Math.max(0, Number.isFinite(u.offset) ? u.offset : 0));
  const prev = s.bookProgress[bookId];
  const adds = !u.seen ? [] : (Array.isArray(u.seen[0]) ? (u.seen as PageRun[]) : [u.seen as PageRun]);
  const seen = mergeRuns([
    ...(prev && isLive(prev) ? prev.seen : []),
    ...adds.map(r => [clampInt(r[0], 1, book.pages), clampInt(r[1], 1, book.pages)] as PageRun),
  ]);
  const next: BookProgress = { bookId, page, offset: Math.round(offset * 1000) / 1000, seen, updatedAt: now };
  return { ...s, bookProgress: { ...s.bookProgress, [bookId]: next } };
};

/** 0–1: pages seen over pages, of the whole book or of one section. */
export const fractionRead = (p: BookProgress | undefined, from: number, to: number): number => {
  if (!p || !isLive(p) || to < from) return 0;
  return pagesSeen(p.seen, from, to) / (to - from + 1);
};

/* ── Housekeeping ── */

/* Tombstones older than 60 days go. A mark goes with its book once the book's
   tombstone is pruned, because nothing can open it any more. */
export const pruneShelf = (s: Shelf, now: number): Shelf => {
  const fresh = (r: { deletedAt?: number }) => !r.deletedAt || now - r.deletedAt < BOOK_TOMBSTONE_MS;
  const books = Object.fromEntries(Object.entries(s.books).filter(([, b]) => fresh(b)));
  const bookMarks = Object.fromEntries(Object.entries(s.bookMarks).filter(([, m]) => fresh(m) && m.bookId in books));
  const bookProgress = Object.fromEntries(Object.entries(s.bookProgress).filter(([, p]) => fresh(p) && p.bookId in books));
  return { books, bookMarks, bookProgress };
};

/* ── Validation ── */

const ID_RE = /^[A-Za-z0-9_-]{6,40}$/;
const HASH_RE = /^[0-9a-f]{64}$/;

const cleanText = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max) : '';

const time = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : undefined);
const clampInt = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(Number.isFinite(v) ? v : lo)));
const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const frac = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

const normalizeRect = (v: unknown): PageRect | null => {
  if (!Array.isArray(v) || v.length !== 4 || !v.every(frac)) return null;
  const [x, y, w, h] = v as number[];
  if (w <= 0 || h <= 0 || x + w > 1.0001 || y + h > 1.0001) return null;
  return [x, y, w, h].map(n => Math.round(n * 1e5) / 1e5) as PageRect;
};

export const normalizeBook = (raw: unknown): Book | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const addedAt = time(r.addedAt);
  const updatedAt = time(r.updatedAt) ?? addedAt;
  if (typeof r.id !== 'string' || !ID_RE.test(r.id) || !addedAt || !updatedAt) return null;
  if (typeof r.fingerprint !== 'string' || !HASH_RE.test(r.fingerprint)) return null;
  if (!isInt(r.pages, 1, BOOK_LIMITS.pages) || !isInt(r.bytes, 0, BOOK_LIMITS.bytes)) return null;
  const kind = BOOK_KINDS.includes(r.kind as BookKind) ? (r.kind as BookKind) : 'other';
  const subject = BOOK_SUBJECTS.includes(r.subject as BookSubject) ? (r.subject as BookSubject) : undefined;
  const classId = r.classId === 11 || r.classId === 12 ? r.classId : undefined;
  const deletedAt = time(r.deletedAt);
  const title = cleanText(r.title, BOOK_LIMITS.title);
  if (!title && !deletedAt) return null;
  const c = (r.cover && typeof r.cover === 'object' ? r.cover : {}) as Record<string, unknown>;
  const cover: BookCover = {
    design: typeof c.design === 'string' && /^[a-z0-9-]{1,24}$/.test(c.design) ? c.design : '',
    finish: c.finish === 'paper' ? 'paper' : 'ink',
    ...(c.firstPage === true ? { firstPage: true } : {}),
  };
  const sections = cleanSections(
    (Array.isArray(r.sections) ? r.sections : []).filter((x): x is Section => !!x && typeof x === 'object') as Section[],
    r.pages,
  );
  return {
    id: r.id,
    title: title || 'Untitled',
    kind,
    ...(subject ? { subject } : {}),
    ...(classId ? { classId } : {}),
    sections,
    cover,
    fingerprint: r.fingerprint,
    pages: r.pages,
    bytes: r.bytes,
    addedAt,
    updatedAt,
    ...(time(r.lastOpenedAt) ? { lastOpenedAt: time(r.lastOpenedAt) } : {}),
    ...(deletedAt ? { deletedAt } : {}),
  };
};

export const normalizeBookMark = (raw: unknown): BookMark | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const createdAt = time(r.createdAt);
  const updatedAt = time(r.updatedAt) ?? createdAt;
  if (typeof r.id !== 'string' || !ID_RE.test(r.id) || typeof r.bookId !== 'string' || !ID_RE.test(r.bookId)) return null;
  if (!createdAt || !updatedAt || !isInt(r.page, 1, BOOK_LIMITS.pages)) return null;
  const kind = (['highlight', 'snip', 'bookmark'] as const).find(k => k === r.kind);
  if (!kind) return null;
  const deletedAt = time(r.deletedAt);
  const rects = Array.isArray(r.rects) ? r.rects.map(normalizeRect).filter((x): x is PageRect => !!x).slice(0, BOOK_LIMITS.rects) : [];
  const color = MARK_COLORS.includes(r.color as MarkColor) ? (r.color as MarkColor) : undefined;
  const note = cleanText(r.note, BOOK_LIMITS.note) || undefined;
  const base = { id: r.id, bookId: r.bookId, kind, page: r.page, createdAt, updatedAt, ...(deletedAt ? { deletedAt } : {}) };
  if (kind === 'bookmark') return { ...base, ...(note ? { note } : {}) };
  if (kind === 'snip') {
    if (rects.length !== 1 && !deletedAt) return null;
    return { ...base, rects: rects.slice(0, 1), ...(color ? { color } : {}), ...(note ? { note } : {}) };
  }
  // A highlight: the words are the truth; offsets and rects are how to find them again.
  const quote = typeof r.quote === 'string' ? r.quote.replace(/\s+/g, ' ').trim().slice(0, BOOK_LIMITS.quote) : '';
  if (!quote && !deletedAt) return null;
  const start = isInt(r.start, 0, 1e7) ? r.start : undefined;
  const end = isInt(r.end, 0, 1e7) ? r.end : undefined;
  const offsets = start !== undefined && end !== undefined && end > start ? { start, end } : {};
  return { ...base, quote, ...offsets, rects, color: color ?? 'yellow', ...(note ? { note } : {}) };
};

export const normalizeBookProgress = (raw: unknown): BookProgress | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const updatedAt = time(r.updatedAt);
  if (typeof r.bookId !== 'string' || !ID_RE.test(r.bookId) || !updatedAt || !isInt(r.page, 1, BOOK_LIMITS.pages)) return null;
  const seen = Array.isArray(r.seen)
    ? mergeRuns(r.seen.filter((x): x is PageRun => Array.isArray(x) && x.length === 2 && isInt(x[0], 1, BOOK_LIMITS.pages) && isInt(x[1], 1, BOOK_LIMITS.pages)))
    : [];
  const deletedAt = time(r.deletedAt);
  return { bookId: r.bookId, page: r.page, offset: frac(r.offset) ? r.offset : 0, seen, updatedAt, ...(deletedAt ? { deletedAt } : {}) };
};

/** Rebuilds the shelf from validated records (what the store decrypts from disk). */
export const shelfFrom = (parts: { books?: unknown[]; bookMarks?: unknown[]; bookProgress?: unknown[] }): Shelf => {
  const byId = <T,>(rows: unknown[] | undefined, fn: (x: unknown) => T | null, key: (t: T) => string) =>
    Object.fromEntries((rows ?? []).map(fn).filter((x): x is T => !!x).map(x => [key(x), x]));
  return {
    books: byId(parts.books, normalizeBook, b => b.id),
    bookMarks: byId(parts.bookMarks, normalizeBookMark, m => m.id),
    bookProgress: byId(parts.bookProgress, normalizeBookProgress, p => p.bookId),
  };
};
