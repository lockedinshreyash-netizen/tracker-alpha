import { PomodoroRuntime, TimerState } from '../types';
import { pauseRun, Span } from './stopwatch';
import { pausePhase } from './pomodoro';

/* "Are you still studying?" — the Netflix check, kept pure.

   A sitting is time on the clock since the last tap on the timer: start,
   resume, Continue, and for Pomodoro also rating a block. Auto-start is not a
   tap. After SITTING_MS without one, the timer pauses at that exact instant
   and asks. ANSWER_MS later with no answer, the sitting is removed: only the
   stretch since the last tap, never time that already ended with one.

   Everything is a timestamp, so a hidden tab, a slept laptop or a closed app
   only changes when this is noticed, never what it decides. */

export const SITTING_MS = 3.5 * 3_600_000;
export const ANSWER_MS = 10 * 60_000;
/** Below this, what is left is a mis-tap, not a session (MIN_LOGGABLE_MS). */
const MIN_KEEP_MS = 60_000;

export type CheckStatus = 'none' | 'due' | 'asking' | 'missed';

/** When the current sitting gets asked, or was asked. Null: nothing to ask. */
export const stopwatchCheckAt = (t: TimerState | undefined): number | null => {
  if (!t) return null;
  if (t.checkAt) return t.checkAt;
  return t.isRunning && t.startTime ? t.startTime + SITTING_MS : null;
};

export const pomodoroCheckAt = (p: PomodoroRuntime): number | null => {
  if (p.checkAt) return p.checkAt;
  return p.isRunning && p.presenceAt ? p.presenceAt + SITTING_MS : null;
};

/**
 * `due`: past the check but not yet paused for it (the caller pauses).
 * `asking`: paused and waiting. `missed`: the answer window has closed.
 */
export const checkStatus = (checkAt: number | null, paused: boolean, now: number): CheckStatus => {
  if (checkAt === null || now < checkAt) return 'none';
  if (now >= checkAt + ANSWER_MS) return 'missed';
  return paused ? 'asking' : 'due';
};

/** Stop the run at the check instant, not when somebody noticed. */
export const pauseStopwatchForCheck = (t: TimerState, checkAt: number): Partial<TimerState> => ({
  ...pauseRun(t, checkAt),
  checkAt,
});

export const pausePomodoroForCheck = (p: PomodoroRuntime, checkAt: number): Partial<PomodoroRuntime> => ({
  ...pausePhase(p, checkAt),
  checkAt,
});

/**
 * What an unanswered stopwatch check keeps: the runs banked before the last
 * tap, placed where they ended (the start of the unanswered run).
 * Works on the timer before or after `pauseStopwatchForCheck`.
 */
export const stopwatchKeeps = (t: TimerState, checkAt: number): Span | null => {
  const banked = t.checkAt ? t.accumulatedMs - SITTING_MS : t.accumulatedMs;
  if (!(banked >= MIN_KEEP_MS)) return null;
  const endedAt = checkAt - SITTING_MS;
  return { hours: banked / 3_600_000, startedAt: endedAt - banked, endedAt };
};
