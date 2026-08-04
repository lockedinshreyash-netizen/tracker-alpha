import { PomodoroPhase, PomodoroSettings } from '../types';

/* Pure helpers for Pomodoro phase transitions. Kept out of the component so
   the rules are readable in one place and testable without React. */

export const PHASE_LABEL: Record<PomodoroPhase, string> = {
  work: 'Focus',
  short_break: 'Short break',
  long_break: 'Long break',
};

/** Length of a phase, in ms. */
export const phaseDurationMs = (phase: PomodoroPhase, s: PomodoroSettings): number => {
  const minutes =
    phase === 'work' ? s.workMinutes
      : phase === 'short_break' ? s.shortBreakMinutes
        : s.longBreakMinutes;
  // Guard against a corrupted/edited setting producing a zero-length phase.
  return Math.max(1, minutes) * 60 * 1000;
};

/**
 * What comes after `phase`.
 *
 * `completedBlocks` is the count *including* the block that just finished, so
 * after the 4th block of a 4-per-set cycle the next break is the long one.
 */
export const nextPhase = (
  phase: PomodoroPhase,
  completedBlocks: number,
  s: PomodoroSettings
): PomodoroPhase => {
  if (phase !== 'work') return 'work';
  const perSet = Math.max(1, s.blocksBeforeLongBreak);
  return completedBlocks > 0 && completedBlocks % perSet === 0 ? 'long_break' : 'short_break';
};

/** A finished long break closes the set, so the block counter starts over. */
export const blocksAfterPhase = (
  phase: PomodoroPhase,
  completedBlocks: number
): number => {
  if (phase === 'work') return completedBlocks + 1;
  if (phase === 'long_break') return 0;
  return completedBlocks;
};

/** Remaining ms, floored at zero. Always derived from the clock. */
export const remainingMs = (phaseEndsAt: number | null, now: number = Date.now()): number => {
  if (phaseEndsAt === null) return 0;
  return Math.max(0, phaseEndsAt - now);
};

/** mm:ss for a countdown. Pomodoro phases never reach an hour in practice. */
export const formatCountdown = (ms: number): string => {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

/** Human phrasing for a phase that ended while the tab was in the background. */
export const describeLateness = (overdueMs: number): string => {
  const mins = Math.floor(overdueMs / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 minute ago';
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`;
};
