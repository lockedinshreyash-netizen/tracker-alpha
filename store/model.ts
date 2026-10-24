/* ── The store's pure rules ──
   React-free, so they are tested (decks/tests/storeModel.test.ts):
   how a sheet's formulas are grouped and searched, and which owned items the
   Decks library draws as one item (a kit hides what it brought with it, the
   way a pack already hides its decks). */

import { toPlain } from '../decks/html';
import type { Kit, Sheet, SheetEntry } from './types';

export interface SheetSection {
  deckId: string;
  title: string;
  entries: SheetEntry[];
}

/** Entries arrive in reading order; consecutive runs of one deck become its section. */
export const groupEntries = (entries: SheetEntry[]): SheetSection[] => {
  const out: SheetSection[] = [];
  for (const e of entries) {
    const last = out[out.length - 1];
    if (last && last.deckId === e.deckId) last.entries.push(e);
    else out.push({ deckId: e.deckId, title: e.deckTitle, entries: [e] });
  }
  return out;
};

/* Curly quotes and the ellipsis fold to their plain forms, so "dont" and
   "don't" both find "don’t" — the reader's search does the same. */
const fold = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/'/g, '');

/** The words a formula can be found by: its label, its formula (TeX included), its tags, its section. */
export const entryText = (e: SheetEntry): string =>
  fold(`${toPlain(e.front)} ${toPlain(e.back)} ${e.tags.join(' ')} ${e.deckTitle}`);

/** Every word of the query must appear. An empty query keeps everything. */
export const searchEntries = (entries: SheetEntry[], query: string): SheetEntry[] => {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return entries;
  return entries.filter(e => {
    const text = entryText(e);
    return words.every(w => text.includes(w));
  });
};

/**
 * What My Alpha draws for packs and sheets once kits are counted: a kit you
 * own is one item, and the packs and sheets it put on your shelf are not
 * listed again beside it. Deck ids are returned too, so a deck that came in a
 * kit is not listed as a loose Alpha deck either.
 */
export const shelfItems = <P extends { id: string; inLibrary: boolean }>(
  kits: Pick<Kit, 'id' | 'inLibrary' | 'items'>[],
  packs: P[],
  sheets: Pick<Sheet, 'id' | 'inLibrary'>[],
): { kits: string[]; packs: string[]; sheets: string[]; hiddenDecks: Set<string> } => {
  const owned = kits.filter(k => k.inLibrary);
  const inKit = (kind: 'pack' | 'sheet' | 'deck', id: string) => owned.some(k => k.items.some(i => i.kind === kind && i.id === id));
  const hiddenDecks = new Set(owned.flatMap(k => k.items.filter(i => i.kind === 'deck').map(i => i.id)));
  return {
    kits: owned.map(k => k.id),
    packs: packs.filter(p => p.inLibrary && !inKit('pack', p.id)).map(p => p.id),
    sheets: sheets.filter(s => s.inLibrary && !inKit('sheet', s.id)).map(s => s.id),
    hiddenDecks,
  };
};
