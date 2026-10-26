import { TimerState } from '../types';
import { getISTDateString } from '../utils';

/* Pure rules for the stopwatch, the counterpart of today/pomodoro.ts. The
   Today card and the voice commands both pause, resume and stop it, and the
   two must agree to the millisecond about what a session earned.

   Three states, told apart by two fields: idle has nothing banked and is not
   running; running has `startTime`; paused is not running with time banked in
   `accumulatedMs` and `pausedAt` marking where the clock stopped. */

/** A session exists — running or paused — and owns the Today card. */
export const isArmed = (t: TimerState | undefined): boolean =>
  !!t && (t.isRunning || t.accumulatedMs > 0);

/** Time banked, clock stopped. */
export const isPaused = (t: TimerState): boolean => !t.isRunning && t.accumulatedMs > 0;

/** Time served so far: the banked runs plus the one on the clock. */
export const elapsedMs = (t: TimerState, now: number = Date.now()): number =>
  Math.max(0, (t.isRunning && t.startTime ? now - t.startTime : 0) + (t.accumulatedMs || 0));

/** Stop the clock, banking the run. Nothing is logged: the session goes on. */
export const pauseRun = (t: TimerState, now: number = Date.now()): Partial<TimerState> => ({
  isRunning: false,
  startTime: null,
  accumulatedMs: elapsedMs(t, now),
  pausedAt: now,
});

/** Back to idle, with nothing banked and nothing stamped. */
export const CLEARED: Partial<TimerState> = {
  isRunning: false,
  startTime: null,
  accumulatedMs: 0,
  pausedAt: undefined,
  chapter: undefined,
  blockId: undefined,
  checkAt: undefined,
};

/** What a session logs: the time served and the interval it is placed on. */
export interface Span {
  hours: number;
  startedAt: number;
  endedAt: number;
}

/**
 * The session as it would be logged now.
 *
 * It ends where the clock last ran — the moment of the pause for a paused
 * session, not the moment somebody came back to press End — and is drawn as
 * one contiguous stretch of exactly the time served, the convention a Pomodoro
 * block cut by a pause already follows. A 9:00 start paused 9:30–10:00 and
 * ended at 10:30 is placed at 9:30–10:30: an hour of study at roughly the
 * right time of day, rather than ninety minutes the analysis would count.
 */
export const sessionSpan = (t: TimerState, now: number = Date.now()): Span => {
  const endedAt = t.isRunning ? now : (t.pausedAt ?? now);
  const ms = elapsedMs(t, now);
  return { hours: ms / 3_600_000, startedAt: endedAt - ms, endedAt };
};

/**
 * Start the clock again.
 *
 * A pause that outlived its study day banks first: the minutes served last
 * night belong to last night, and folding them into a run that ends this
 * morning would move them off the day they were studied — and off the streak.
 * The new run keeps the subject and chapter but not the Plan block, which was
 * the earlier day's.
 */
export const resumeRun = (
  t: TimerState,
  now: number = Date.now(),
): { bank: Span | null; update: Partial<TimerState> } => {
  const pausedAt = t.pausedAt;
  const crossedDay =
    isPaused(t) && pausedAt != null && getISTDateString(new Date(pausedAt)) !== getISTDateString(new Date(now));
  if (crossedDay) {
    return {
      bank: sessionSpan(t, now),
      update: { ...CLEARED, isRunning: true, startTime: now, chapter: t.chapter },
    };
  }
  return { bank: null, update: { isRunning: true, startTime: now, pausedAt: undefined, checkAt: undefined } };
};
