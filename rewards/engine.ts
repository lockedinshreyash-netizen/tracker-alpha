/**
 * Pure reward logic: what is earned, what is next, and how two devices agree.
 *
 * Nothing here touches React or storage. `evaluate` is called on every state
 * change and must therefore be cheap and idempotent — it returns the *same*
 * object when nothing was earned, so the caller can skip a state write.
 */

import { DailyLog, RewardsState } from '../types';
import { DEFAULT_REWARDS } from '../state';
import { calculateStreak, calculateVerifiedStreak, getISTDateString } from '../utils';
import { REWARDS_IN_ORDER, RewardDef } from './catalog';

/** Fills in anything a saved or remote blob predates. */
export const normalizeRewards = (r: Partial<RewardsState> | undefined): RewardsState => ({
  ...DEFAULT_REWARDS,
  ...(r || {}),
  unlocked: { ...(r?.unlocked || {}) },
  acknowledged: [...(r?.acknowledged || [])],
});

export const isUnlocked = (rewards: RewardsState, id: string): boolean =>
  Object.prototype.hasOwnProperty.call(rewards.unlocked, id);

/** The streak that counts towards a given reward. */
export const streakFor = (def: RewardDef, streak: number, verifiedStreak: number): number =>
  def.requiresVerified ? verifiedStreak : streak;

export interface RewardProgress {
  def: RewardDef;
  unlocked: boolean;
  unlockedOn?: string;
  /** Best streak so far against this reward's rule, capped at its day. */
  current: number;
  daysLeft: number;
  /** 0-100. */
  percent: number;
}

/**
 * Progress against every reward, using the high-water marks rather than the
 * live streak — a user sitting on a broken streak should see how far they got,
 * not a zero.
 */
export const rewardProgress = (rewards: RewardsState): RewardProgress[] =>
  REWARDS_IN_ORDER.map(def => {
    const best = streakFor(def, rewards.bestStreak, rewards.bestVerifiedStreak);
    const unlocked = isUnlocked(rewards, def.id);
    const current = Math.min(best, def.day);
    return {
      def,
      unlocked,
      unlockedOn: rewards.unlocked[def.id],
      current,
      daysLeft: Math.max(0, def.day - best),
      percent: unlocked ? 100 : Math.min(100, Math.round((best / def.day) * 100)),
    };
  });

/** The next thing to chase, or undefined once everything is earned. */
export const nextReward = (rewards: RewardsState): RewardProgress | undefined =>
  rewardProgress(rewards).find(p => !p.unlocked);

/** Unlocks the user has not been shown yet, oldest tier first. */
export const pendingCelebrations = (rewards: RewardsState): RewardDef[] =>
  REWARDS_IN_ORDER.filter(
    def => isUnlocked(rewards, def.id) && !rewards.acknowledged.includes(def.id),
  );

/**
 * Advance rewards for the current logs.
 *
 * Returns the input object unchanged when nothing moved, so callers can use
 * referential equality to avoid a pointless state update (and the sync write
 * that would follow it).
 */
export const evaluate = (
  logs: DailyLog[],
  rewards: RewardsState,
  today: string = getISTDateString(),
): RewardsState => {
  const streak = calculateStreak(logs);
  const verifiedStreak = calculateVerifiedStreak(logs);

  const bestStreak = Math.max(rewards.bestStreak, streak);
  const bestVerifiedStreak = Math.max(rewards.bestVerifiedStreak, verifiedStreak);

  const newlyUnlocked: Record<string, string> = {};
  for (const def of REWARDS_IN_ORDER) {
    if (isUnlocked(rewards, def.id)) continue;
    if (streakFor(def, bestStreak, bestVerifiedStreak) >= def.day) {
      newlyUnlocked[def.id] = today;
    }
  }

  const streakMoved = bestStreak !== rewards.bestStreak || bestVerifiedStreak !== rewards.bestVerifiedStreak;
  if (!streakMoved && Object.keys(newlyUnlocked).length === 0) return rewards;

  return {
    ...rewards,
    bestStreak,
    bestVerifiedStreak,
    unlocked: { ...rewards.unlocked, ...newlyUnlocked },
  };
};

/**
 * Combine two devices' rewards.
 *
 * Unlocks only ever accumulate, so this is a union with the earlier unlock
 * date winning, and a max over the high-water marks. Without it the ordinary
 * last-write-wins sync could drop a reward earned on a phone the moment a
 * laptop pushed older state — and taking a reward back is not something the
 * user would ever forgive or understand.
 *
 * `wallpaper` and `bookChapter` are ordinary preferences: `mine` wins, since
 * the merge always runs on the device the user is looking at.
 */
export const mergeRewards = (mine: RewardsState, theirs: RewardsState | undefined): RewardsState => {
  if (!theirs) return mine;

  const unlocked: Record<string, string> = { ...mine.unlocked };
  for (const [id, date] of Object.entries(theirs.unlocked || {})) {
    unlocked[id] = unlocked[id] && unlocked[id] <= date ? unlocked[id] : date;
  }

  return {
    ...mine,
    unlocked,
    acknowledged: Array.from(new Set([...mine.acknowledged, ...(theirs.acknowledged || [])])),
    bestStreak: Math.max(mine.bestStreak, theirs.bestStreak || 0),
    bestVerifiedStreak: Math.max(mine.bestVerifiedStreak, theirs.bestVerifiedStreak || 0),
    /* A claim made anywhere is a claim. Keep the earliest. */
    hamperClaimedOn:
      [mine.hamperClaimedOn, theirs.hamperClaimedOn].filter(Boolean).sort()[0] || null,
  };
};
