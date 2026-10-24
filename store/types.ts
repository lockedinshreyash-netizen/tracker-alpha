/* ── The Alpha Store: shapes ──
   camelCase mirrors of the store tables in supabase/decks.sql (§1b, §11).
   Rows become these in store/api.ts and nowhere else. Packs keep their own
   shape (decks/types.ts) because the rack store and My Alpha already read it. */

import type { DeckStatus, DeckSubject, NoteKind, PackAccess, PackFinish } from '../decks/types';

/** The store page's three sections, top to bottom. Another tab can ask to land on one. */
export type StoreSection = 'kits' | 'sheets' | 'packs';

/** Anything the store sells, by kind. The checkout seam and the buttons take this. */
export type StoreKind = 'pack' | 'sheet' | 'kit';

/** One deck as a sheet lists it: a section of the sheet. */
export interface SheetDeck {
  id: string;
  title: string;
  subject: DeckSubject | null;
  status: DeckStatus;
  /** Formulas (notes) in it. */
  entries: number;
}

/**
 * A formula sheet: every card of a set of Alpha decks on one page, for
 * revising at a glance. Made by Alpha only. Read in Decks, never printed.
 */
export interface Sheet {
  id: string;
  title: string;
  description: string | null;
  subject: DeckSubject | null;
  examLine: string | null;
  access: PackAccess;
  priceInr: number | null;
  status: DeckStatus;
  sortOrder: number;
  /** The number printed on the sheet: SHEET 004. */
  sheetNo: number;
  at: string | null;
  inLibrary: boolean;
  /** The caller may open it now. Decided by the server. */
  unlocked: boolean;
  /** Console only. */
  students: number;
  decks: SheetDeck[];
  entries: number;
}

export interface SheetMeta {
  title: string;
  description: string | null;
  subject: DeckSubject | null;
  examLine: string | null;
  access: PackAccess;
  priceInr: number | null;
}

/** One formula on a sheet: a note of one of its decks. */
export interface SheetEntry {
  deckId: string;
  deckTitle: string;
  noteId: string;
  kind: NoteKind;
  front: string;
  back: string;
  tags: string[];
}

/** The box colour. An administrator's choice per kit. */
export type KitFinish = 'white' | 'black';
export type KitItemKind = 'pack' | 'sheet' | 'deck';

/** One thing in a kit, as the box lists it. */
export interface KitItem {
  kind: KitItemKind;
  id: string;
  title: string;
  subject: DeckSubject | null;
  status: DeckStatus;
  /** Cards in a pack or deck, formulas on a sheet. */
  count: number;
  /** Decks in a pack, for its packaging. */
  decks?: number;
  /** A pack's packaging, so its miniature is drawn the way it hangs. */
  finish?: PackFinish;
  packNo?: number;
}

/**
 * A subject kit: packs, sheets and decks in one box. Owning a kit unlocks
 * everything inside it, whatever each item costs on its own.
 */
export interface Kit {
  id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  subject: DeckSubject | null;
  examLine: string | null;
  finish: KitFinish;
  access: PackAccess;
  priceInr: number | null;
  status: DeckStatus;
  sortOrder: number;
  kitNo: number;
  at: string | null;
  inLibrary: boolean;
  unlocked: boolean;
  students: number;
  items: KitItem[];
}

export interface KitMeta {
  title: string;
  tagline: string | null;
  description: string | null;
  subject: DeckSubject | null;
  examLine: string | null;
  finish: KitFinish;
  access: PackAccess;
  priceInr: number | null;
}

/** "3 packs · 2 sheets · 4 decks", leaving out what the kit has none of. */
export const kitLine = (items: Pick<KitItem, 'kind'>[]): string => {
  const n = (k: KitItemKind) => items.filter(i => i.kind === k).length;
  const part = (k: KitItemKind, one: string, many: string) => (n(k) ? `${n(k)} ${n(k) === 1 ? one : many}` : null);
  return [part('pack', 'pack', 'packs'), part('sheet', 'sheet', 'sheets'), part('deck', 'deck', 'decks')].filter(Boolean).join(' · ') || 'Empty for now';
};

/** "62 formulas · 4 decks". */
export const sheetLine = (sheet: Pick<Sheet, 'entries' | 'decks'>): string =>
  `${sheet.entries.toLocaleString()} ${sheet.entries === 1 ? 'formula' : 'formulas'} · ${sheet.decks.length} ${sheet.decks.length === 1 ? 'section' : 'sections'}`;
