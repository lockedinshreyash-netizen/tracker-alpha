/* ── The store's filter ──
   What to show: everything, or one type (kits, formula sheets, flashcard
   packs), for every subject or one. Never saved: the Store always opens on
   everything, and a filter lasts until you leave the tab. React-free and
   tested (store/tests/store.test.ts). */

import type { DeckSubject } from '../decks/types';
import type { ExamPreference } from '../types';
import { KITS_LAUNCHED } from './launch';

export type StoreType = 'all' | 'kits' | 'sheets' | 'packs';
export type StoreSubject = 'all' | DeckSubject;

export interface StoreFilter {
  type: StoreType;
  subject: StoreSubject;
}

export const ALL: StoreFilter = { type: 'all', subject: 'all' };

/** In the order the page shows them. */
export const TYPES: { value: StoreType; label: string }[] = [
  { value: 'all', label: 'Everything' },
  // Kits are not launched yet (store/launch.ts): no option, and a stored "kits" reads as everything.
  ...(KITS_LAUNCHED ? [{ value: 'kits' as StoreType, label: 'Kits' }] : []),
  { value: 'sheets', label: 'Formula sheets' },
  { value: 'packs', label: 'Flashcard packs' },
];

/** The subjects worth a chip: the student's exam's. Anything else is still under "All subjects". */
export const subjectsFor = (exam: ExamPreference): DeckSubject[] =>
  exam === 'NEET' ? ['Physics', 'Chemistry', 'Biology'] : ['Physics', 'Chemistry', 'Maths'];

export const showsType = (f: StoreFilter, type: Exclude<StoreType, 'all'>): boolean =>
  (type !== 'kits' || KITS_LAUNCHED) && (f.type === 'all' || f.type === type);

export const matchesSubject = (item: { subject: DeckSubject | null }, f: StoreFilter): boolean =>
  f.subject === 'all' || item.subject === f.subject;

const NOUN: Record<Exclude<StoreType, 'all'>, string> = { kits: 'kits', sheets: 'formula sheets', packs: 'packs' };

/** What a rack says when the filter leaves nothing on it. Null: nothing is filtered, so say the usual. */
export const emptyFor = (type: Exclude<StoreType, 'all'>, f: StoreFilter): { title: string; line: string } | null =>
  f.subject === 'all' ? null : { title: `No ${f.subject} ${NOUN[type]} yet.`, line: 'Try another subject, or all of them.' };

/** The heading's line: what the page is showing. */
export const filterLine = (f: StoreFilter): string => {
  const kind = TYPES.find(t => t.value === f.type)?.label ?? 'Everything';
  if (f.type === 'all' && f.subject === 'all') return KITS_LAUNCHED ? 'Kits, formula sheets and flashcard packs, made by Alpha.' : 'Formula sheets and flashcard packs, made by Alpha.';
  if (f.type === 'all') return `Everything for ${f.subject}.`;
  return f.subject === 'all' ? `${kind}, every subject.` : `${kind} for ${f.subject}.`;
};
