/* ── What the reading room may reach outside Learn ──
   App builds this (it holds the account, Notes' switch and the Mocks tab);
   Learn passes it through to books/BookRoom.tsx untouched. Types only, so
   App and Learn can name it without loading the reader. */

export interface BookSource {
  bookId: string;
  bookTitle: string;
  page: number;
  /** `11|Physics|Units & Measurements`, from the book's chapter map. */
  chapterKey?: string;
  quote?: string;
  image?: Blob;
  rect?: [number, number, number, number];
}

export interface BookLinks {
  /** Signed in: flashcards can go to a deck. */
  userId: string | null;
  notes: {
    owner: string;
    signedIn: boolean;
    on: boolean;
    enable: () => void;
    /** Open a chapter's notes page in the Notes tab. */
    open: (chapterKey: string) => void;
  };
  /** The error notebook's form, prefilled with what was sent. */
  logMistake: (src: BookSource) => void;
}
