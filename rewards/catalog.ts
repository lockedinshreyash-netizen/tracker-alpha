/**
 * What the streak pays out, and when.
 *
 * The whole reward system reads from this array — the vault, the unlock
 * interstitial, the progress-to-next line. Adding a tier is one entry here and
 * nothing else, provided its `kind` already has a way to be opened.
 */

export type RewardKind = 'wallpaper' | 'book' | 'hamper';

export interface RewardDef {
  id: string;
  /** Streak length, in days, that unlocks it. */
  day: number;
  kind: RewardKind;
  /** Shown once unlocked. */
  title: string;
  /** One blunt line under the title. */
  tagline: string;
  /** Shown while still locked — says what it is without giving it away. */
  lockedHint: string;
  /**
   * Whether the streak has to be made of days the app measured itself.
   *
   * False for the wallpaper: it costs nothing, and a student who logs by hand
   * still showed up. True for anything with a real cost behind it — the book
   * and the hamper are not worth handing to a for-loop.
   */
  requiresVerified: boolean;
}

export const REWARDS: RewardDef[] = [
  {
    id: 'wallpaper-30',
    day: 30,
    kind: 'wallpaper',
    title: 'The 30 Pack',
    tagline: 'Thirty days straight. Your screen should say so.',
    lockedHint: 'Wallpapers for the app. Earned, not downloaded.',
    requiresVerified: false,
  },
  {
    id: 'book-100',
    day: 100,
    kind: 'book',
    title: 'The Book',
    tagline: 'A hundred days in. Read it here, free, forever.',
    lockedHint: 'A book. The whole thing, inside the app.',
    requiresVerified: true,
  },
  {
    id: 'hamper-365',
    day: 365,
    kind: 'hamper',
    title: 'Year One',
    tagline: 'Three hundred and sixty five. Almost nobody gets here.',
    lockedHint: 'Something physical. Sent to you. That is all you get for now.',
    requiresVerified: true,
  },
];

export const rewardById = (id: string): RewardDef | undefined =>
  REWARDS.find(r => r.id === id);

/** Ascending by day — the vault and the "next up" line both depend on this. */
export const REWARDS_IN_ORDER: RewardDef[] = [...REWARDS].sort((a, b) => a.day - b.day);
