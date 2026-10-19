/* ── The reader's model: pure, React-free, tested (reader/tests) ──

   Everything the reader knows about the book and about what the student has
   done to it, as plain functions: the text broken into highlightable units,
   inline marks, highlight segments, search, reading progress, and the
   AppState slice (`reading`) with its normaliser and its sync merge.

   ─── Anchors ─────────────────────────────────────────────────────────────
   A point in the book is `{ u, o }`: a unit id (a paragraph, a list item, a
   heading — see `unitsOf`) and a character offset into that unit's PLAIN
   text, i.e. with `*italic*`/`**bold**` markers removed. Unit ids are the
   permanent block ids written into content/bookText.ts, so a typo fixed
   inside a paragraph leaves every highlight on it in place. A highlight also
   keeps the words it covered (`quote`); if its offsets ever stop matching,
   `resolveHighlight` finds the words again in the chapter. */

import type { BookChapter } from '../content/book';

/* ═══ Units ═══ */

export type UnitKind = 'part' | 'p' | 'h' | 'h3' | 'quote' | 'line' | 'action' | 'li' | 'li2';

export interface Unit {
  id: string;
  kind: UnitKind;
  /** Source text with inline marks. */
  raw: string;
  /** What the reader sees: marks removed. Offsets index into this. */
  plain: string;
  /** Words in the unit, for progress and time left. */
  words: number;
}

const countWords = (s: string) => (s.match(/[\p{L}\p{N}’']+/gu) ?? []).length;

const unit = (id: string, kind: UnitKind, raw: string): Unit => {
  const plain = plainOf(raw);
  return { id, kind, raw, plain, words: countWords(plain) };
};

/** Every highlightable piece of a chapter, in reading order. */
export const unitsOf = (ch: BookChapter): Unit[] => {
  const out: Unit[] = [];
  ch.part?.intro.forEach((t, i) => out.push(unit(`${ch.id}.part${i}`, 'part', t)));
  for (const b of ch.blocks) {
    switch (b.kind) {
      case 'list':
        b.items.forEach(it => {
          out.push(unit(it.id, 'li', it.text));
          it.sub?.forEach(s => out.push(unit(s.id, 'li2', s.text)));
        });
        break;
      case 'fragment':
        break;
      default:
        out.push(unit(b.id, b.kind, b.text));
    }
  }
  return out;
};

/* Chapters never change at runtime, so their units are worked out once. */
const unitCache = new WeakMap<BookChapter, Unit[]>();
export const chapterUnits = (ch: BookChapter): Unit[] => {
  let u = unitCache.get(ch);
  if (!u) { u = unitsOf(ch); unitCache.set(ch, u); }
  return u;
};

export const chapterWords = (ch: BookChapter): number =>
  chapterUnits(ch).reduce((n, u) => n + u.words, 0);

/* ═══ Inline marks ═══ */

export interface Run { text: string; i?: boolean; b?: boolean }

/** `*italic*` and `**bold**` → runs. Anything unmatched is left as text. */
export const parseInline = (raw: string): Run[] => {
  const runs: Run[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    if (m.index > last) runs.push({ text: raw.slice(last, m.index) });
    if (m[1] !== undefined) runs.push({ text: m[1], b: true });
    else runs.push({ text: m[2], i: true });
    last = re.lastIndex;
  }
  if (last < raw.length) runs.push({ text: raw.slice(last) });
  return runs;
};

export const plainOf = (raw: string): string => parseInline(raw).map(r => r.text).join('');

/* ═══ Highlights ═══ */

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';
export const HIGHLIGHT_COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];

export interface Anchor { u: string; o: number }

export interface Highlight {
  id: string;
  chapterId: string;
  start: Anchor;
  end: Anchor;
  /** The words it covered, for re-anchoring and for the notebook. */
  quote: string;
  color: HighlightColor;
  note?: string;
  createdAt: number;
  updatedAt: number;
  /**
   * Set when deleted. The row stays (as a tombstone, pruned after
   * `TOMBSTONE_DAYS`) so a merge with another device's older copy cannot
   * bring it back. Everything that draws highlights skips these.
   */
  deletedAt?: number;
}

export interface Bookmark {
  id: string;
  chapterId: string;
  u: string;
  /** The opening words of the marked spot, shown in the list. */
  snippet: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number;
}

export interface ReadingPosition {
  chapterId: string;
  u: string;
  /** How far into that unit the reading line was, 0..1. */
  f: number;
  at: number;
}

export interface ReadingState {
  highlights: Highlight[];
  bookmarks: Bookmark[];
  position: ReadingPosition | null;
  /** chapter id → furthest fraction ever reached, 0..1. Only ever rises. */
  furthest: Record<string, number>;
  /**
   * Action-step block id → when it was last changed: positive when ticked,
   * negative (minus the time) when unticked. Keeping the untick as a dated
   * value is what lets a merge tell "unticked later" from "never ticked".
   */
  actions: Record<string, number>;
}

export const TOMBSTONE_DAYS = 60;
export const live = <T extends { deletedAt?: number }>(xs: T[]): T[] => xs.filter(x => !x.deletedAt);
export const isActionDone = (r: ReadingState, id: string) => (r.actions[id] ?? 0) > 0;

export const EMPTY_READING: ReadingState = { highlights: [], bookmarks: [], position: null, furthest: {}, actions: {} };

/* A unit's index in its chapter, for ordering anchors. */
const indexMap = new WeakMap<BookChapter, Map<string, number>>();
export const unitIndex = (ch: BookChapter, id: string): number => {
  let m = indexMap.get(ch);
  if (!m) { m = new Map(chapterUnits(ch).map((u, i) => [u.id, i])); indexMap.set(ch, m); }
  return m.get(id) ?? -1;
};

export const compareAnchors = (ch: BookChapter, a: Anchor, b: Anchor): number => {
  const d = unitIndex(ch, a.u) - unitIndex(ch, b.u);
  return d !== 0 ? d : a.o - b.o;
};

/** The plain text between two anchors, units joined by a space. */
export const textBetween = (ch: BookChapter, start: Anchor, end: Anchor): string => {
  const units = chapterUnits(ch);
  const i0 = unitIndex(ch, start.u);
  const i1 = unitIndex(ch, end.u);
  if (i0 < 0 || i1 < 0 || i1 < i0) return '';
  const parts: string[] = [];
  for (let i = i0; i <= i1; i++) {
    const p = units[i].plain;
    parts.push(p.slice(i === i0 ? start.o : 0, i === i1 ? end.o : p.length));
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
};

/**
 * Pull a selection's ends in to the nearest non-space character, so a
 * double-click that grabbed a trailing space does not highlight it.
 */
export const trimRange = (ch: BookChapter, start: Anchor, end: Anchor): { start: Anchor; end: Anchor } | null => {
  const units = chapterUnits(ch);
  let i0 = unitIndex(ch, start.u);
  let i1 = unitIndex(ch, end.u);
  if (i0 < 0 || i1 < 0) return null;
  let s = { ...start };
  let e = { ...end };
  // Forward over whitespace and unit ends.
  for (;;) {
    const p = units[i0].plain;
    while (s.o < p.length && /\s/.test(p[s.o])) s.o++;
    if (s.o < p.length || i0 >= i1) break;
    i0++; s = { u: units[i0].id, o: 0 };
  }
  for (;;) {
    const p = units[i1].plain;
    while (e.o > 0 && /\s/.test(p[e.o - 1])) e.o--;
    if (e.o > 0 || i1 <= i0) break;
    i1--; e = { u: units[i1].id, o: units[i1].plain.length };
  }
  if (compareAnchors(ch, s, e) >= 0) return null;
  return { start: s, end: e };
};

/**
 * Grow a range out to whole words. Fingers are imprecise and a highlight that
 * starts at "ey were" reads as a mistake, so both ends move outward to the
 * nearest word boundary (letters, digits and in-word apostrophes count as
 * word). Punctuation at the edges is left as the student chose it.
 */
const WORD = /[\p{L}\p{N}’'\-]/u;
export const snapToWords = (ch: BookChapter, start: Anchor, end: Anchor): { start: Anchor; end: Anchor } => {
  const units = chapterUnits(ch);
  const a = units[unitIndex(ch, start.u)]?.plain ?? '';
  const b = units[unitIndex(ch, end.u)]?.plain ?? '';
  let s = start.o;
  let e = end.o;
  if (s > 0 && s < a.length && WORD.test(a[s]) && WORD.test(a[s - 1])) {
    while (s > 0 && WORD.test(a[s - 1])) s--;
  }
  if (e > 0 && e < b.length && WORD.test(b[e - 1]) && WORD.test(b[e])) {
    while (e < b.length && WORD.test(b[e])) e++;
  }
  return { start: { u: start.u, o: s }, end: { u: end.u, o: e } };
};

/** The [from, to) a range covers inside one unit, or null if it misses it. */
export const rangeInUnit = (ch: BookChapter, unitId: string, start: Anchor, end: Anchor): [number, number] | null => {
  const i = unitIndex(ch, unitId);
  const i0 = unitIndex(ch, start.u);
  const i1 = unitIndex(ch, end.u);
  if (i < 0 || i0 < 0 || i1 < 0 || i < i0 || i > i1) return null;
  const len = chapterUnits(ch)[i].plain.length;
  const from = i === i0 ? start.o : 0;
  const to = i === i1 ? end.o : len;
  return to > from ? [Math.max(0, from), Math.min(len, to)] : null;
};

/**
 * Make sure a stored highlight still points at the words it was made on. If
 * the text under it moved (an edit to the manuscript), find the quote in the
 * chapter again; if it cannot be found, return null and the highlight lives
 * on in the notebook only.
 */
export const resolveHighlight = (ch: BookChapter, h: Highlight): { start: Anchor; end: Anchor } | null => {
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  if (unitIndex(ch, h.start.u) >= 0 && unitIndex(ch, h.end.u) >= 0 && norm(textBetween(ch, h.start, h.end)) === norm(h.quote)) {
    return { start: h.start, end: h.end };
  }
  const q = norm(h.quote);
  if (!q) return null;
  // Single-unit quotes are by far the common case; search those first.
  for (const u of chapterUnits(ch)) {
    const at = u.plain.indexOf(q);
    if (at >= 0) return { start: { u: u.id, o: at }, end: { u: u.id, o: at + q.length } };
  }
  return null;
};

/* ═══ Segments: one unit's text cut up for rendering ═══ */

export interface Mark {
  from: number;
  to: number;
  /** A highlight's id, or a search hit's. */
  id: string;
  kind: 'hl' | 'search';
  color?: HighlightColor;
  /** Draws the note glyph after the mark's last piece. */
  note?: boolean;
}

export interface Piece {
  text: string;
  i?: boolean;
  b?: boolean;
  /** The highlight that colours this piece (the newest, where they overlap). */
  hl?: { id: string; color: HighlightColor };
  search?: boolean;
  /** This piece ends a highlight that carries a note. */
  noteAfter?: string;
}

/**
 * Cut a unit's runs at every mark boundary. Overlapping highlights resolve
 * to the one listed last (callers pass oldest first), so a fresh highlight
 * over an old one shows its own colour.
 */
export const segments = (raw: string, marks: Mark[]): Piece[] => {
  const runs = parseInline(raw);
  const cuts = new Set<number>();
  marks.forEach(m => { cuts.add(m.from); cuts.add(m.to); });
  const out: Piece[] = [];
  let pos = 0;
  for (const r of runs) {
    const end = pos + r.text.length;
    const inner = [...cuts].filter(c => c > pos && c < end).sort((a, b) => a - b);
    const bounds = [pos, ...inner, end];
    for (let k = 0; k < bounds.length - 1; k++) {
      const a = bounds[k];
      const b = bounds[k + 1];
      if (b <= a) continue;
      const piece: Piece = { text: r.text.slice(a - pos, b - pos) };
      if (r.i) piece.i = true;
      if (r.b) piece.b = true;
      for (const m of marks) {
        if (m.from <= a && m.to >= b) {
          if (m.kind === 'hl') piece.hl = { id: m.id, color: m.color ?? 'yellow' };
          else piece.search = true;
        }
      }
      const ending = marks.filter(m => m.kind === 'hl' && m.note && m.to === b);
      if (ending.length) piece.noteAfter = ending[ending.length - 1].id;
      out.push(piece);
    }
    pos = end;
  }
  return out;
};

/* ═══ Search ═══ */

/* Typing "dont" or "don't" should find "don’t"; "..." should find "…". */
export const foldForSearch = (s: string): string =>
  s.toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-')
    .replace(/…/g, '...');

export interface SearchHit {
  chapterId: string;
  u: string;
  from: number;
  to: number;
  /** A window of text around the hit, with the hit's place in it. */
  before: string;
  match: string;
  after: string;
}

/**
 * Every place `query` appears, in book order. Folding keeps lengths equal
 * except "…" → "...", so hits are found on a folded copy where each folded
 * character remembers its original index.
 */
export const searchBook = (chapters: BookChapter[], query: string, limit = 300): SearchHit[] => {
  const q = foldForSearch(query.trim());
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const ch of chapters) {
    for (const u of chapterUnits(ch)) {
      const map: number[] = [];
      let folded = '';
      for (let i = 0; i < u.plain.length; i++) {
        const f = foldForSearch(u.plain[i]);
        for (let k = 0; k < f.length; k++) map.push(i);
        folded += f;
      }
      map.push(u.plain.length);
      let at = folded.indexOf(q);
      while (at >= 0) {
        const from = map[at];
        const to = map[at + q.length - 1] + 1;
        const b0 = Math.max(0, from - 48);
        const a1 = Math.min(u.plain.length, to + 72);
        hits.push({
          chapterId: ch.id, u: u.id, from, to,
          before: (b0 > 0 ? '…' : '') + u.plain.slice(b0, from).replace(/^\S*\s/, b0 > 0 ? '' : '$&'),
          match: u.plain.slice(from, to),
          after: u.plain.slice(to, a1) + (a1 < u.plain.length ? '…' : ''),
        });
        if (hits.length >= limit) return hits;
        at = folded.indexOf(q, at + q.length);
      }
    }
  }
  return hits;
};

/* ═══ Progress ═══ */

export const WORDS_PER_MINUTE = 230;

/** Words read up to a position inside a chapter. */
export const wordsBefore = (ch: BookChapter, u: string, f: number): number => {
  const units = chapterUnits(ch);
  const at = unitIndex(ch, u);
  if (at < 0) return 0;
  let n = 0;
  for (let i = 0; i < at; i++) n += units[i].words;
  return n + units[at].words * Math.min(1, Math.max(0, f));
};

export interface Progress {
  /** 0..1 through the chapter. */
  chapter: number;
  /** 0..1 through the book. */
  book: number;
  minutesLeftInChapter: number;
  minutesLeftInBook: number;
}

export const progressAt = (chapters: BookChapter[], chapterId: string, u: string | null, f: number): Progress => {
  const totals = chapters.map(chapterWords);
  const all = totals.reduce((a, b) => a + b, 0) || 1;
  const ci = Math.max(0, chapters.findIndex(c => c.id === chapterId));
  const ch = chapters[ci];
  const inCh = u ? wordsBefore(ch, u, f) : 0;
  const before = totals.slice(0, ci).reduce((a, b) => a + b, 0);
  const chTotal = totals[ci] || 1;
  const leftCh = Math.max(0, chTotal - inCh);
  const leftBook = Math.max(0, all - before - inCh);
  return {
    chapter: Math.min(1, inCh / chTotal),
    book: Math.min(1, (before + inCh) / all),
    minutesLeftInChapter: Math.ceil(leftCh / WORDS_PER_MINUTE),
    minutesLeftInBook: Math.ceil(leftBook / WORDS_PER_MINUTE),
  };
};

export const minutesFor = (ch: BookChapter): number => Math.max(1, Math.round(chapterWords(ch) / WORDS_PER_MINUTE));

/** Action steps in reading order. */
export const actionSteps = (chapters: BookChapter[]) =>
  chapters.flatMap(ch => ch.blocks.filter(b => b.kind === 'action').map(b => ({ chapterId: ch.id, block: b as Extract<typeof b, { kind: 'action' }> })));

/* ═══ The AppState slice ═══ */

export const MAX_HIGHLIGHTS = 2000;
export const MAX_BOOKMARKS = 300;
export const MAX_NOTE = 4000;
export const MAX_QUOTE = 2000;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max: number): string | null => (typeof v === 'string' ? v.slice(0, max) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const anchor = (v: unknown): Anchor | null => {
  if (!isObj(v)) return null;
  const u = str(v.u, 80);
  const o = num(v.o);
  return u && o !== null && o >= 0 ? { u, o: Math.floor(o) } : null;
};

/**
 * Everything that arrives from storage or another device goes through here.
 * `legacyChapterId` comes from the old `rewards.bookChapter` (an index, looked
 * up in `BOOK.chapterIds` by the caller): a student who was reading before the
 * reader was rebuilt reopens in the same chapter. A position whose `u` is ''
 * means "the top of that chapter".
 */
export const normalizeReading = (raw: unknown, legacyChapterId?: string | null, now = Date.now()): ReadingState => {
  const r = isObj(raw) ? raw : {};
  const expired = (d: number | null) => d !== null && now - d > TOMBSTONE_DAYS * 86_400_000;
  const highlights: Highlight[] = [];
  const seen = new Set<string>();
  (Array.isArray(r.highlights) ? r.highlights : []).forEach(h => {
    if (!isObj(h)) return;
    const id = str(h.id, 64);
    const chapterId = str(h.chapterId, 40);
    const start = anchor(h.start);
    const end = anchor(h.end);
    const color = HIGHLIGHT_COLORS.includes(h.color as HighlightColor) ? (h.color as HighlightColor) : 'yellow';
    const createdAt = num(h.createdAt) ?? 0;
    const deletedAt = num(h.deletedAt);
    if (!id || !chapterId || !start || !end || seen.has(id) || expired(deletedAt)) return;
    seen.add(id);
    const note = str(h.note, MAX_NOTE);
    highlights.push({
      id, chapterId, start, end, color,
      quote: str(h.quote, MAX_QUOTE) ?? '',
      ...(note ? { note } : {}),
      createdAt,
      updatedAt: num(h.updatedAt) ?? createdAt,
      ...(deletedAt ? { deletedAt } : {}),
    });
  });
  highlights.sort((a, b) => a.createdAt - b.createdAt);

  const bookmarks: Bookmark[] = [];
  const seenB = new Set<string>();
  (Array.isArray(r.bookmarks) ? r.bookmarks : []).forEach(b => {
    if (!isObj(b)) return;
    const id = str(b.id, 64);
    const chapterId = str(b.chapterId, 40);
    const u = str(b.u, 80);
    const deletedAt = num(b.deletedAt);
    if (!id || !chapterId || !u || seenB.has(id) || expired(deletedAt)) return;
    seenB.add(id);
    const createdAt = num(b.createdAt) ?? 0;
    bookmarks.push({
      id, chapterId, u, snippet: str(b.snippet, 200) ?? '', createdAt,
      updatedAt: num(b.updatedAt) ?? createdAt,
      ...(deletedAt ? { deletedAt } : {}),
    });
  });
  bookmarks.sort((a, b) => a.createdAt - b.createdAt);

  let position: ReadingPosition | null = null;
  if (isObj(r.position)) {
    const chapterId = str(r.position.chapterId, 40);
    const u = str(r.position.u, 80) ?? '';
    if (chapterId) {
      position = {
        chapterId, u,
        f: Math.min(1, Math.max(0, num(r.position.f) ?? 0)),
        at: num(r.position.at) ?? 0,
      };
    }
  }
  if (!position && legacyChapterId) position = { chapterId: legacyChapterId.slice(0, 40), u: '', f: 0, at: 0 };

  const furthest: Record<string, number> = {};
  if (isObj(r.furthest)) {
    Object.entries(r.furthest).slice(0, 100).forEach(([k, v]) => {
      const n = num(v);
      if (n !== null) furthest[k.slice(0, 40)] = Math.min(1, Math.max(0, n));
    });
  }
  const actions: Record<string, number> = {};
  if (isObj(r.actions)) {
    Object.entries(r.actions).slice(0, 100).forEach(([k, v]) => {
      const n = num(v);
      if (n !== null) actions[k.slice(0, 80)] = n;
    });
  }

  return {
    highlights: highlights.slice(-MAX_HIGHLIGHTS),
    bookmarks: bookmarks.slice(-MAX_BOOKMARKS),
    position,
    furthest,
    actions,
  };
};

/**
 * Local-newer sync path only, like `mergeMocks`: union highlights and
 * bookmarks by id with the later `updatedAt` winning (a deletion is an update,
 * so it wins over an older live copy), take the newer position, keep the
 * furthest of each chapter, and the later tick or untick of each action step.
 */
export const mergeReading = (local: ReadingState, remote: ReadingState, now = Date.now()): ReadingState => {
  const hl = new Map(local.highlights.map(h => [h.id, h]));
  remote.highlights.forEach(h => {
    const mine = hl.get(h.id);
    if (!mine || h.updatedAt > mine.updatedAt) hl.set(h.id, h);
  });
  const bm = new Map(local.bookmarks.map(b => [b.id, b]));
  remote.bookmarks.forEach(b => {
    const mine = bm.get(b.id);
    if (!mine || b.updatedAt > mine.updatedAt) bm.set(b.id, b);
  });
  const actions = { ...remote.actions };
  Object.entries(local.actions).forEach(([k, v]) => {
    if (Math.abs(v) >= Math.abs(actions[k] ?? 0)) actions[k] = v;
  });
  const furthest = { ...remote.furthest };
  Object.entries(local.furthest).forEach(([k, v]) => { furthest[k] = Math.max(v, furthest[k] ?? 0); });
  const position = !remote.position ? local.position
    : !local.position ? remote.position
      : remote.position.at > local.position.at ? remote.position : local.position;
  return normalizeReading({
    highlights: [...hl.values()],
    bookmarks: [...bm.values()],
    position,
    furthest,
    actions,
  }, null, now);
};

/** Short random ids; collision odds across one student's notebook are nil. */
export const newId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
