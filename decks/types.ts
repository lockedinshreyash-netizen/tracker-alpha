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
