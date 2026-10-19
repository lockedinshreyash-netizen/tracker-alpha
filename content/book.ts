/**
 * The day-100 book: LOCK IN.
 *
 * Two files. This one is the book's shape and its cover facts — small, read by
 * the vault on every render. The text itself is `content/bookText.ts`, loaded
 * only when the reader opens, so the main bundle carries none of it.
 *
 * ─── Where the text came from ───────────────────────────────────────────
 * The author's Canva PDF. Its text layer was damaged (words run together,
 * "fi"/"fl" doubled, sentences broken across lines, a page's paragraphs out of
 * order), so it was rebuilt by hand against the page images and checked
 * word-for-word against the PDF's own text. Only formatting was repaired; the
 * wording, spelling and voice are the author's.
 *
 * ─── Block IDs are permanent ─────────────────────────────────────────────
 * Every block (and every list item) has an id such as `ch1.07`. Highlights,
 * notes and bookmarks anchor to these, so:
 *   - fixing a typo inside a block is safe;
 *   - a NEW block takes a new id (e.g. `ch1.07a`) — never renumber;
 *   - deleting a block orphans annotations on it; the reader falls back to
 *     finding the quoted text, so prefer editing over deleting.
 *
 * Inline marks in `text`: *italic* and **bold**. Nothing else.
 */

export type BookBlock =
  /** A paragraph. */
  | { id: string; kind: 'p'; text: string }
  /** A section heading inside a chapter ("Mistake 1: …", "Pillar 2: Learning"). */
  | { id: string; kind: 'h'; text: string }
  /** A smaller heading ("Monday (Upper body)", "Books to read"). */
  | { id: string; kind: 'h3'; text: string }
  /** A quotation set apart from the text. */
  | { id: string; kind: 'quote'; text: string }
  /** A single set-off line (chat messages, the breathing loop). Consecutive lines sit together. */
  | { id: string; kind: 'line'; text: string }
  /** One of the book's numbered Action Steps. */
  | { id: string; kind: 'action'; label: string; text: string }
  | { id: string; kind: 'list'; ordered: boolean; items: BookListItem[] }
  /** The title card of a story fragment (the sneak peek). */
  | { id: string; kind: 'fragment'; label: string; title: string };

export interface BookListItem {
  id: string;
  text: string;
  sub?: Array<{ id: string; text: string }>;
}

export interface BookChapter {
  id: string;
  /** Shown above the title and in the contents: "Chapter 1", "Introduction", "Bonus chapter". */
  number: string;
  title: string;
  /** A part opens before this chapter ("Level 2."), with its own short intro. */
  part?: { title: string; intro: string[] };
  blocks: BookBlock[];
}

export interface Book {
  title: string;
  subtitle: string;
  /** The line at the foot of the cover. */
  tagline: string;
  author: string;
  /**
   * False while the manuscript is still a placeholder. The reader then shows
   * an honest "being written" note instead of pretending the sample is the
   * book — a reward that turns out to be lorem ipsum is worse than a late one.
   */
  complete: boolean;
  /** Kept here so the vault can say "13 chapters" without loading the text. */
  chapterCount: number;
  /**
   * The chapter ids in order, for the same reason: App migrates the old
   * `rewards.bookChapter` index to a reading position without the text.
   * A test (reader/tests) checks this list against bookText.ts.
   */
  chapterIds: string[];
}

export const BOOK: Book = {
  title: 'LOCK IN.',
  subtitle: 'Unfiltered Advice for Indian Teens Who Want to Win at Life.',
  tagline: 'Not your average “self-development” book.',
  author: 'Shreyash Mishra',
  complete: true,
  chapterCount: 13,
  chapterIds: ['intro', 'ch0', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6', 'ch8', 'bonus', 'parents', 'resources', 'next'],
};

export const bookChapterCount = (): number => BOOK.chapterCount;
