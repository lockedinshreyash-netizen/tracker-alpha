/* ── Which pages are which chapter, guessed before anyone is asked ──
   Pure and tested. Only a book's own table of contents is read, never its
   pages: the PDF's bookmarks when they name chapters, else the printed
   Contents pages near the front (books/pdf.ts findContents). A one-chapter
   file (an NCERT chapter, a DPP) is named by the heading on its first page.

   Three rules keep a guess honest:
   - only CHAPTERS count. "3 Vectors" is a chapter; "3-2 Unit Vectors" or
     "3.2 Coordinate Systems" is a section, and sections name everything
     (Halliday's "Coordinate Systems" once filed a physics book under
     Coordination Compounds);
   - a book is ONE subject. Every chapter votes, the subject with the most
     votes wins, and the chapters are matched again against that subject
     only;
   - a weak match files nothing (Learn's matcher: half the chapter's own
     words). A wrong chapter is worse than none; the sheet shows the rest. */

import { guessChapter, words, type ChapterRef } from '../learn/discover/match';
import { cleanSections, type BookSubject, type OutlineEntry, type Section } from './model';
import { aliasFor } from './aliases';

export const keyOfRef = (r: ChapterRef): string => `${r.classId}|${r.subject}|${r.chapter}`;

/** Every syllabus chapter a file could be about, both classes, the student's subjects. */
export const chapterRefs = (
  subjects: BookSubject[],
  chaptersFor: (classId: 11 | 12, subject: BookSubject) => string[],
): ChapterRef[] =>
  ([11, 12] as const).flatMap(classId => subjects.flatMap(subject => chaptersFor(classId, subject).map(chapter => ({ classId, subject, chapter }))));

/* ── What a chapter title looks like ── */

const WORD_NUMBERS = 'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen';

/* "Chapter 3 Vectors", "CHAPTER THREE: Vectors", "Unit 2 – Kinematics",
   "3 Vectors", "3. Vectors". Not "3-2 Unit Vectors", "3.2 …", "1.1 Introduction". */
const CHAPTER_TITLE = new RegExp(
  `^(?:(?:chapter|ch\\.?|unit|lesson)\\s*(?:\\d{1,2}|${WORD_NUMBERS})\\b|\\d{1,2}(?![\\d.\\-–]\\s*\\d))[\\s.:–\\-]*([A-Za-z].*)$`,
  'i',
);

/* A name is words: a real word in it ("Vectors", "VECTORS"), almost no
   digits, no formula punctuation. Machine-made bookmarks are full of
   "2 H5MgBr" and "1. Mg,THF 2. X", which are not chapters. */
const looksLikeName = (name: string): boolean =>
  name.length >= 3
  && /\b(?:[A-Z]?[a-z]{2,}|[A-Z]{3,})\b/.test(name)
  && (name.match(/\d/g)?.length ?? 0) <= Math.max(1, Math.floor(name.length * 0.08))
  && !/[=/\\{}<>]|\d\s*\./.test(name);

/** The chapter's name when a title is a chapter's, else null. */
export const chapterTitle = (raw: string): string | null => {
  const s = raw.replace(/\s+/g, ' ').trim();
  const m = CHAPTER_TITLE.exec(s);
  if (!m) return null;
  const name = m[1].replace(/[\s.·…_]+\d{1,4}$/, '').replace(/[\s.·…_]+$/, '').trim();
  return looksLikeName(name) ? name : null;
};

/* Real chapters start on different pages, and a chapter is more than a page
   or two. Bookmarks that break either rule were made by a machine from the
   text, and are worth nothing. */
const sane = (entries: OutlineEntry[], pages?: number): boolean => {
  if (new Set(entries.map(e => e.page)).size < entries.length) return false;
  return !pages || entries.length <= Math.max(2, pages / 3);
};

/* Bookmarks: the entries that are chapters, at whatever depth the PDF put
   them (often under "Part 1" or "Volume 2"). With none, the top level only;
   never the sections beneath. */
export const pickChapterEntries = (outline: (OutlineEntry & { depth?: number })[], pages?: number): OutlineEntry[] => {
  const chapters = outline
    .map(e => ({ page: e.page, title: chapterTitle(e.title) }))
    .filter((e): e is OutlineEntry => !!e.title)
    .filter((e, i, all) => all.findIndex(x => x.title.toLowerCase() === e.title.toLowerCase()) === i);
  if (chapters.length >= 2) return sane(chapters, pages) ? chapters : [];
  const top = outline.filter(e => !e.depth && looksLikeName(e.title)).map(e => ({ title: e.title, page: e.page }));
  return top.length >= 2 && sane(top, pages) ? top : [];
};

/* ── A printed Contents page ── */

export const isContentsPage = (lines: string[]): boolean => {
  const top = lines.slice(0, 8).join(' ');
  if (/\b(table of contents|brief contents|contents)\b/i.test(top)) return true;
  // Some books print no heading: a page that is mostly chapter lines is one.
  return tocLines(lines).length >= 5;
};

export interface TocEntry { title: string; printed: number }

/* "1 Measurement 1", "Chapter 2 Motion Along a Straight Line .......... 13",
   "3 VECTORS 38". The number at the end is the printed page. */
const tocLines = (lines: string[]): TocEntry[] => {
  const out: TocEntry[] = [];
  for (const line of lines) {
    const s = line.replace(/\s+/g, ' ').trim();
    const end = /[\s.·…_]+(\d{1,4})$/.exec(s);
    if (!end) continue;
    const title = chapterTitle(s.slice(0, end.index));
    if (title) out.push({ title, printed: Number(end[1]) });
  }
  return out;
};

/* Every chapter line on the Contents pages, in order, once each. A full
   Contents lists sections under each chapter; only chapter lines are kept,
   and printed pages must not run backwards (a stray line elsewhere would). */
export const parseContents = (pages: string[][]): TocEntry[] => {
  const all = pages.flatMap(tocLines);
  const out: TocEntry[] = [];
  for (const e of all) {
    const prev = out[out.length - 1];
    if (prev && e.printed < prev.printed) continue;
    if (out.some(x => x.title.toLowerCase() === e.title.toLowerCase())) continue;
    out.push(e);
  }
  return out;
};

/* Printed page numbers are not PDF pages: there are covers and a preface
   first. The PDF's own page labels, when it has them, say where each
   printed number is; else one measured offset (the page where the first
   chapter's title is found) applies to all. */
export const toPdfPages = (
  entries: TocEntry[],
  pages: number,
  how: { labels?: (string | null)[] | null; offset?: number | null },
): OutlineEntry[] => {
  const byLabel = new Map<string, number>();
  (how.labels ?? []).forEach((l, i) => { if (l && !byLabel.has(l.trim())) byLabel.set(l.trim(), i + 1); });
  return entries.flatMap(e => {
    const page = byLabel.get(String(e.printed)) ?? (how.offset !== undefined && how.offset !== null ? e.printed + how.offset : null);
    return page && page >= 1 && page <= pages ? [{ title: e.title, page }] : [];
  });
};

/** Does this page open the chapter? Its title's words, near the top. */
export const opensWith = (pageTop: string, title: string): boolean => {
  const norm = (s: string) => s.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  return norm(pageTop).includes(norm(title));
};

/* ── The proposal ── */

export const headingIn = (text: string): string | null => {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 6);
  for (let i = 0; i < lines.length; i++) {
    const t = chapterTitle(lines[i]);
    if (t) return t;
    // "CHAPTER TWO" on one line, the name on the next.
    if (new RegExp(`^(chapter|unit)\\s+(\\d{1,2}|${WORD_NUMBERS})$`, 'i').test(lines[i]) && lines[i + 1]) return lines[i + 1];
  }
  return null;
};

/** Longer than this, a file is a book, not one chapter (an NCERT chapter runs 20–40 pages). */
export const ONE_CHAPTER_MAX = 80;

/* A DPP or a set of notes often prints its chapter's name near the top
   without the word "Chapter" ("Aldehydes, Ketones and Carboxylic Acids"
   under "Chemistry"). Any of the first lines can name it, but only when it
   names most of the chapter's words: a question's line names a bit of many. */
const topLineChapter = (firstText: string, refs: ChapterRef[]): ChapterRef | null => {
  for (const line of firstText.split('\n').slice(0, 6)) {
    if (line.length > 90) continue;
    const best = candidates(line, refs);
    if (best.length && best[0].score >= 0.75 && !(best[1] && best[1].score === best[0].score && best[1].hits === best[0].hits)) return best[0].ref;
  }
  return null;
};

export interface MapProposal {
  subject?: BookSubject;
  classId?: 11 | 12;
  sections: Section[];
}

/** Most pages decide the class: a Class 11 book may quote a Class 12 chapter. */
const majorityClass = (sections: Section[]): 11 | 12 | undefined => {
  const w = { 11: 0, 12: 0 };
  for (const s of sections) w[s.chapterKey.startsWith('12|') ? 12 : 11] += s.to - s.from + 1;
  return w[11] || w[12] ? (w[12] > w[11] ? 12 : 11) : undefined;
};

/* Learn's matcher's rule (half the chapter's own words, five-letter stems),
   but every candidate is kept, so a tie can be seen instead of settled by
   list order. */
const same = (a: string, b: string): boolean =>
  a === b || (a.length >= 5 && b.length >= 5 && a.startsWith(b.slice(0, 5)) && b.startsWith(a.slice(0, 5)));

const candidates = (title: string, refs: ChapterRef[]) => {
  const q = words(title);
  return refs.flatMap(ref => {
    const c = words(ref.chapter);
    const hits = c.filter(w => q.some(x => same(x, w))).length;
    const score = c.length ? hits / c.length : 0;
    return hits && score >= 0.5 ? [{ ref, score, hits }] : [];
  }).sort((a, b) => b.score - a.score || b.hits - a.hits);
};

/* The chapter for one Contents entry. On a tie ("Force and Motion" is half
   of Laws of Motion and half of Motion in a Plane), a chapter an earlier,
   separate entry already took loses; continuing the entry just before wins
   (Force and Motion I and II are both Laws of Motion). A tie still open
   files nothing. */
const pick = (title: string, refs: ChapterRef[], taken: Set<string>, previous: string | null): ChapterRef | null => {
  // A reference book's own name for an NCERT chapter (books/aliases.ts) settles it outright.
  const subject = refs[0]?.subject;
  const alias = subject ? aliasFor(subject, title) : null;
  const named = alias ? refs.find(r => r.chapter === alias) : undefined;
  if (named) return named;
  const all = candidates(title, refs);
  if (!all.length) return null;
  const top = all.filter(c => c.score === all[0].score && c.hits === all[0].hits);
  if (top.length === 1) return top[0].ref;
  const cont = top.find(c => keyOfRef(c.ref) === previous);
  if (cont) return cont.ref;
  const fresh = top.filter(c => !taken.has(keyOfRef(c.ref)));
  return fresh.length === 1 ? fresh[0].ref : null;
};

/* Each entry runs to the page before the next entry, matched or not, so an
   unmatched chapter ("Vectors") keeps its pages out of its neighbour. */
const rangesFor = (entries: OutlineEntry[], pages: number, refs: ChapterRef[]): Section[] => {
  const sorted = [...entries].sort((a, b) => a.page - b.page);
  const out: Section[] = [];
  const taken = new Set<string>();
  let previous: string | null = null;
  sorted.forEach((e, i) => {
    const ref = pick(e.title, refs, taken, previous);
    previous = ref ? keyOfRef(ref) : null;
    if (!ref) return;
    taken.add(keyOfRef(ref));
    const next = sorted.slice(i + 1).find(x => x.page > e.page);
    out.push({ chapterKey: keyOfRef(ref), from: e.page, to: next ? next.page - 1 : pages });
  });
  return cleanSections(out, pages);
};

export const proposeMap = (
  facts: { pages: number; chapters: OutlineEntry[]; firstText: string; title: string },
  refs: ChapterRef[],
): MapProposal => {
  if (facts.chapters.length) {
    // Vote: which subject do this book's chapters belong to?
    const votes = new Map<BookSubject, number>();
    const subjects = [...new Set(refs.map(r => r.subject))];
    for (const e of facts.chapters) {
      const r = candidates(e.title, refs)[0]?.ref;
      if (r) votes.set(r.subject, (votes.get(r.subject) ?? 0) + 1);
      for (const sub of subjects) {
        const a = aliasFor(sub, e.title);
        if (a && refs.some(x => x.subject === sub && x.chapter === a)) votes.set(sub, (votes.get(sub) ?? 0) + 1);
      }
    }
    const subject = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (subject) {
      const sections = rangesFor(facts.chapters, facts.pages, refs.filter(r => r.subject === subject));
      if (sections.length) return { subject, classId: majorityClass(sections), sections };
    }
  }
  // One chapter, perhaps: the heading on page 1, else the file's own title. Only for a file a chapter's
  // length: a long book with no contents found is not chapter 1 from cover to cover.
  if (facts.pages > ONE_CHAPTER_MAX) return { sections: [] };
  const head = headingIn(facts.firstText);
  const ref = (head && guessChapter(head, refs)) || topLineChapter(facts.firstText, refs) || guessChapter(facts.title, refs);
  if (!ref) return { sections: [] };
  const one: Section[] = [{ from: 1, to: facts.pages, chapterKey: keyOfRef(ref) }];
  return { subject: ref.subject, classId: ref.classId, sections: one };
};
