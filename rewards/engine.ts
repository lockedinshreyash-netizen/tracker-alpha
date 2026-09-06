/**
 * Pure reward logic: what is earned, what is next, and how two devices agree.
 *
 * Nothing here touches React or storage. `evaluate` is called on every state
 * change and must therefore be cheap and idempotent — it returns the *same*
 * object when nothing was earned, so the caller can skip a state write.
 */

import { DailyLog, RewardsState } from '../types';
import { DEFAULT_REWARDS } from '../state';
import { getISTDateString, longestStreak, longestVerifiedStreak } from '../utils';
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
  /** Days of the run that counts for this reward, capped at its day. */
  current: number;
  daysLeft: number;
  /** 0-100. */
  percent: number;
  /**
   * The best run ever made against this reward's rule, when it beats the one
   * running now. Context, never the thing being measured.
   */
  best?: number;
}

/**
 * Progress against every reward, measured by the streak running *now*.
 *
 * It has to be the live streak. Measuring against the all-time best freezes
 * the whole vault for anyone rebuilding after a break — a student on day 8 of
 * a new run, whose best was 12, is told "18 days to go" today, tomorrow and
 * every day after until they pass their old mark. The number stops answering
 * the only question it is there to answer: what does one more day buy me?
 *
 * The high-water marks still decide what is *unlocked* (see `evaluate`), so
 * nothing already earned can be taken back by a broken streak.
 */
export const rewardProgress = (
  rewards: RewardsState,
  streak: number,
  verifiedStreak: number,
): RewardProgress[] =>
  REWARDS_IN_ORDER.map(def => {
    const live = Math.max(0, streakFor(def, streak, verifiedStreak));
    const best = streakFor(def, rewards.bestStreak, rewards.bestVerifiedStreak);
    const unlocked = isUnlocked(rewards, def.id);
    return {
      def,
      unlocked,
      unlockedOn: rewards.unlocked[def.id],
      current: Math.min(live, def.day),
      daysLeft: Math.max(0, def.day - live),
      percent: unlocked ? 100 : Math.min(100, Math.round((live / def.day) * 100)),
      best: best > live ? best : undefined,
    };
  });

/** The next thing to chase, or undefined once everything is earned. */
export const nextReward = (
  rewards: RewardsState,
  streak: number,
  verifiedStreak: number,
): RewardProgress | undefined =>
  rewardProgress(rewards, streak, verifiedStreak).find(p => !p.unlocked);

/** Unlocks the user has not been shown yet, oldest tier first. */
export const pendingCelebrations = (rewards: RewardsState): RewardDef[] =>
  REWARDS_IN_ORDER.filter(
    def => isUnlocked(rewards, def.id) && !rewards.acknowledged.includes(def.id),
  );

/**
 * Advance rewards for the current logs.
 *
 * Unlocks are decided by the longest run anywhere in the history, not by the
 * streak that happens to reach today. The old rule only ever saw the live
 * streak, so a reward was earned solely if the app was looking at the moment
 * the run peaked: a student who logged thirty straight days and then missed
 * one before opening the vault had genuinely done the thirty days and was
 * never given the pack. Backfilled days had the same problem — a month
 * reconstructed after the fact counted for nothing, because it was never the
 * *current* streak.
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
  /* Max with the stored mark rather than replacing it: logs can be deleted,
     and the days behind a receipt were still done. */
  const bestStreak = Math.max(rewards.bestStreak, longestStreak(logs, today));
  const bestVerifiedStreak = Math.max(rewards.bestVerifiedStreak, longestVerifiedStreak(logs, today));

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
