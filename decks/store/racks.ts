/* Where a pack is seen: the Alpha Packs store, on the rack for its subject.
   That is the whole of "where" for a pack. It has no shelf, unlike a deck. */

import type { DeckSubject } from '../types';

export const RACK_NAME: Record<DeckSubject, string> = { Physics: 'Physics', Chemistry: 'Chemistry', Maths: 'Mathematics', Biology: 'Biology' };

/** "Physics", or "More packs" for a pack with no subject. */
export const rackName = (subject: DeckSubject | null | undefined): string => (subject ? RACK_NAME[subject] : 'More packs');
