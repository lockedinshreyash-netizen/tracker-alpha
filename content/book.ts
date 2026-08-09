/**
 * The day-100 book, as read inside the app.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * THIS FILE IS A SCAFFOLD. The manuscript is not in it yet.
 *
 * To ship the real book, replace `BOOK.chapters` with the actual chapters and
 * set `BOOK.complete = true`. Nothing else in the app needs to change — the
 * reader, the progress bar and the vault all read from here.
 *
 * Keep each paragraph as its own string. The reader sets its own measure,
 * leading and drop cap, so the text must arrive without formatting of its own.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Bundling the text as a module rather than fetching it is deliberate: a
 * student on a bad connection who earned this at day 100 should still be able
 * to read it on the train. It ships with the app and works offline.
 */

export interface BookChapter {
  id: string;
  /** Shown in the contents list, e.g. "One". */
  number: string;
  title: string;
  /** One paragraph per string. */
  body: string[];
}

export interface Book {
  title: string;
  author: string;
  /** Shown on the cover, under the title. */
  subtitle: string;
  /**
   * False while the manuscript is still a placeholder. The reader shows an
   * honest "being written" note instead of pretending the sample is the book —
   * a reward that turns out to be lorem ipsum is worse than one that is late.
   */
  complete: boolean;
  chapters: BookChapter[];
}

export const BOOK: Book = {
  title: 'Untitled',
  author: 'Tracker Alpha',
  subtitle: 'For the ones who kept going',
  complete: false,
  chapters: [
    {
      id: 'foreword',
      number: 'Foreword',
      title: 'You are reading this because you did not stop',
      body: [
        'A hundred days ago you started a timer. Since then you have started it again every single day, and the app has watched you do it. Nobody had to check. Nobody was watching but the clock.',
        'That is the entire qualification for this book. Not a score, not a rank, not a percentile. A hundred days of showing up to something boring on days when nothing about it felt like progress.',
        'The rest of this is being written. It will appear here when it is done — you have already paid for it, and you will not have to do anything to get it.',
      ],
    },
  ],
};

export const bookChapterCount = (): number => BOOK.chapters.length;
