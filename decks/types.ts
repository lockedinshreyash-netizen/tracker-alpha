/* ── Alpha Decks: shapes ──
   camelCase mirrors of supabase/decks.sql. Rows are mapped to these in
   decks/api.ts and nowhere else. */

import type { Subject } from '../types';

export type DeckScope = 'personal' | 'global';
export type DeckStatus = 'draft' | 'published' | 'archived';
/** Which shelf an Alpha deck sits on for students. Personal decks have none. */
export type DeckCollection = 'essentials' | 'more';
export type NoteKind = 'cloze' | 'basic';
export type DeckSubject = Exclude<Subject, 'General'>;

/** 0 new, 1 learning, 2 review, 3 relearning — FSRS's states, as stored. */
export type CardState = 0 | 1 | 2 | 3;
export type Rating = 1 | 2 | 3 | 4;

/** One deck on the caller's shelf, with today's numbers (`deck_summaries`). */
export interface DeckSummary {
  id: string;
  scope: DeckScope;
  status: DeckStatus;
  collection: DeckCollection | null;
  title: string;
  description: string | null;
  subject: DeckSubject | null;
  classId: 11 | 12 | null;
  chapter: string | null;
  ownerId: string | null;
  updatedAt: string;
  /** The Alpha pack this deck sits in, if any. */
  packId: string | null;
  newPerDay: number;
  maxReviews: number;
  desiredRetention: number;
  total: number;
  unseen: number;
  newAvailable: number;
  due: number;
  learning: number;
  young: number;
  mature: number;
  suspended: number;
  reviewsToday: number;
  nextDue: string | null;
}

export interface DeckMeta {
  title: string;
  description: string | null;
  subject: DeckSubject | null;
  classId: 11 | 12 | null;
  chapter: string | null;
}

export interface Note {
  id: string;
  deckId: string;
  kind: NoteKind;
  front: string;
  back: string;
  tags: string[];
  guid: string | null;
  version: number;
  updatedAt: string;
}

/** A note before it has an id — what the editor and the importer produce. */
export interface DraftNote {
  kind: NoteKind;
  front: string;
  back: string;
  tags: string[];
  guid?: string;
}

/** A user's review state on one card. Absent = the card is new to them. */
export interface Progress {
  state: CardState;
  due: string;
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  lastReview: string | null;
}

/** A card ready to study: its note's content plus the caller's progress. */
export interface QueueCard {
  cardId: string;
  /** The deck it came from — a pack's session holds cards from several. */
  deckId?: string;
  noteId: string;
  ord: number;
  kind: NoteKind;
  front: string;
  back: string;
  tags: string[];
  progress: Progress | null;
}

export interface ExploreDeck {
  id: string;
  title: string;
  description: string | null;
  subject: DeckSubject | null;
  classId: 11 | 12 | null;
  chapter: string | null;
  collection: DeckCollection;
  publishedAt: string | null;
  cards: number;
  inLibrary: boolean;
}

export interface AdminDeckStat {
  id: string;
  title: string;
  status: DeckStatus;
  collection: DeckCollection;
  subject: DeckSubject | null;
  chapter: string | null;
  updatedAt: string;
  publishedAt: string | null;
  cards: number;
  students: number;
  active7d: number;
  reviews7d: number;
  /** Share of review-state answers that were Again, last 30 days. Null with no data. */
  againRate: number | null;
  packId: string | null;
  packTitle: string | null;
}

/** How a pack is had: free, bought once, or included with Alpha Pro. */
export type PackAccess = 'free' | 'paid' | 'pro';
/** How a pack is packaged on the rack: black or white. Packs have no shelf; they live in the store. */
export type PackFinish = 'ink' | 'paper';

/** One deck as a pack lists it. */
export interface PackDeck {
  id: string;
  title: string;
  subject: DeckSubject | null;
  status: DeckStatus;
  cards: number;
}

/**
 * An Alpha pack: a set of Alpha decks studied together ("Essential
 * Chemistry" holding Organic, Inorganic and Physical). Packs are made by
 * administrators only; a student adds a whole pack at once.
 */
export interface Pack {
  id: string;
  title: string;
  description: string | null;
  /** Which rack it hangs on in the store. None: the "More packs" rack. */
  subject: DeckSubject | null;
  finish: PackFinish;
  status: DeckStatus;
  sortOrder: number;
  /** When it was published (explore) or last changed (console). */
  at: string | null;
  /** On the caller's shelf. Always false in the console. */
  inLibrary: boolean;
  /** Students who added it — console only, 0 elsewhere. */
  students: number;
  decks: PackDeck[];
  /** The number printed on the packaging: PACK 001. */
  packNo: number;
  access: PackAccess;
  /** Rupees, for a paid pack only. */
  priceInr: number | null;
  /** The short line under the name: "JEE • PCM". */
  examLine: string | null;
  /** The caller may add it now: free, bought, or Pro. Decided by the server. */
  unlocked: boolean;
}

export interface PackMeta {
  title: string;
  description: string | null;
  subject: DeckSubject | null;
  finish: PackFinish;
  access: PackAccess;
  priceInr: number | null;
  examLine: string | null;
}

/** A card shown in the store before a pack is yours. */
export interface PreviewCard {
  deckId: string;
  kind: NoteKind;
  front: string;
  back: string;
}

export interface ActivityDay {
  day: string;
  reviews: number;
  again: number;
}

export interface CardRow {
  cardId: string;
  ord: number;
  suspended: boolean;
  state: CardState;
  due: string | null;
}
