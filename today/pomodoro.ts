import { PomodoroPhase, PomodoroRuntime, PomodoroSettings } from '../types';

/* Pure rules for the Pomodoro cycle. Kept out of React so the whole state
   machine is readable in one place, and so the same transitions serve the UI,
   the voice commands and the background engine — three callers that used to
   each have their own idea of what "stop" meant. */

export const PHASE_LABEL: Record<PomodoroPhase, string> = {
  work: 'Focus',
  short_break: 'Short break',
  long_break: 'Long break',
};

/**
 * The shortest stretch of focus that gets written to the log.
 *
 * Below this it is a mis-tap, not a study session, and a log per mis-tap is
 * noise in the history and in the day's total. Everything above it is kept,
 * however far short of the bell it stopped.
 */
export const MIN_LOGGABLE_MS = 60_000;

/**
 * How much of a block has to be served for it to count towards the set.
 *
 * The dots — and the long break they earn — mean "blocks of real focus". Time
 * served is always logged either way; this only decides whether a block cut
 * short also advances the cycle, so that four ten-second blocks cannot buy a
 * fifteen-minute break.
 */
export const COUNTS_TOWARDS_SET = 0.5;

/**
 * How long after its bell a phase can still be settled.
 *
 * A block whose end is minutes or hours old was almost certainly studied
 * through — the tab was just in the background. One from last week was not:
 * the browser was closed the whole time, and crediting a full block against a
 * long-past day would rewrite a streak out of nothing.
 */
export const STALE_PHASE_MS = 12 * 60 * 60 * 1000;

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

/* ── Runtime reading ──
   Three states, told apart by two fields. Nothing else in the app should be
   inspecting `phaseEndsAt` directly. */

/** Nothing armed: the next start begins a fresh phase. */
export const isIdle = (p: PomodoroRuntime): boolean => !p.isRunning && p.phaseTotalMs === null;

/** Armed and part-served, but the clock is stopped. */
export const isPaused = (p: PomodoroRuntime): boolean => !p.isRunning && p.phaseTotalMs !== null;

/** Time served in the armed phase. Off the clock while running, banked while paused. */
export const servedMs = (p: PomodoroRuntime, now: number = Date.now()): number => {
  const total = p.phaseTotalMs;
  if (total === null) return 0;
  if (!p.isRunning || p.phaseEndsAt === null) return Math.min(total, Math.max(0, p.servedMs));
  return Math.min(total, Math.max(0, total - remainingMs(p.phaseEndsAt, now)));
};

/** Time left in the armed phase — or the full length of the next one when idle. */
export const leftMs = (p: PomodoroRuntime, s: PomodoroSettings, now: number = Date.now()): number => {
  const total = p.phaseTotalMs ?? phaseDurationMs(p.phase, s);
  return Math.max(0, total - servedMs(p, now));
};

/** 0–1 through the armed phase. Zero when idle. */
export const phaseProgress = (p: PomodoroRuntime, now: number = Date.now()): number => {
  const total = p.phaseTotalMs;
  if (!total) return 0;
  return Math.min(1, servedMs(p, now) / total);
};

/** True once a running phase has reached its bell. */
export const hasElapsed = (p: PomodoroRuntime, now: number = Date.now()): boolean =>
  p.isRunning && p.phaseEndsAt !== null && now >= p.phaseEndsAt;

/* ── Transitions ──
   Each returns the fields to merge into the runtime. They never log; deciding
   what a transition earns is `creditFor`, and writing it is the caller's. */

/** Begin the armed phase, or arm a fresh one. Resumes a pause where it left off. */
export const beginPhase = (
  p: PomodoroRuntime,
  s: PomodoroSettings,
  now: number = Date.now()
): Partial<PomodoroRuntime> => {
  const total = p.phaseTotalMs ?? phaseDurationMs(p.phase, s);
  const served = Math.min(total, Math.max(0, isPaused(p) ? p.servedMs : 0));
  return {
    isRunning: true,
    phaseTotalMs: total,
    servedMs: served,
    phaseEndsAt: now + (total - served),
  };
};

/** Stop the clock, keeping the time served. */
export const pausePhase = (p: PomodoroRuntime, now: number = Date.now()): Partial<PomodoroRuntime> => ({
  isRunning: false,
  servedMs: servedMs(p, now),
  phaseEndsAt: null,
});

/** Disarm: the phase is over, whatever it earned has already been banked. */
export const clearPhase = (): Partial<PomodoroRuntime> => ({
  isRunning: false,
  phaseEndsAt: null,
  phaseTotalMs: null,
  servedMs: 0,
});

/**
 * What a work phase has earned, at the instant it ends.
 *
 * `hours` is what gets logged — the time actually served, never the length the
 * block was nominally set to. `counted` decides whether the cycle advances.
 */
export interface PhaseCredit {
  hours: number;
  loggable: boolean;
  counted: boolean;
  partial: boolean;
}

export const creditFor = (
  p: PomodoroRuntime,
  at: number = Date.now()
): PhaseCredit => {
  const total = p.phaseTotalMs ?? 0;
  const served = p.phase === 'work' ? servedMs(p, at) : 0;
  const partial = served < total;
  return {
    hours: served / 3_600_000,
    loggable: p.phase === 'work' && served >= MIN_LOGGABLE_MS,
    counted: p.phase === 'work' && total > 0 && served >= total * COUNTS_TOWARDS_SET,
    partial,
  };
};

/**
 * Move to whatever follows the phase that just ended.
 *
 * `counted` comes from `creditFor`: a block abandoned early still advances to a
 * break, it just doesn't fill a dot or bring the long break closer.
 */
export const advancePhase = (
  p: PomodoroRuntime,
  s: PomodoroSettings,
  opts: { counted: boolean; autoStart: boolean; now?: number }
): Partial<PomodoroRuntime> => {
  const now = opts.now ?? Date.now();
  const blocks = opts.counted
    ? blocksAfterPhase(p.phase, p.completedBlocks)
    // A break always closes its set, whether or not it ran to the bell.
    : p.phase === 'long_break' ? 0 : p.completedBlocks;
  const upcoming = nextPhase(p.phase, blocks, s);
  const total = phaseDurationMs(upcoming, s);

  return {
    phase: upcoming,
    completedBlocks: blocks,
    isRunning: opts.autoStart,
    phaseTotalMs: opts.autoStart ? total : null,
    servedMs: 0,
    phaseEndsAt: opts.autoStart ? now + total : null,
  };
};

/* ── Formatting ── */

/** mm:ss, or h:mm:ss once a phase is an hour or longer. */
export const formatCountdown = (ms: number): string => {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** "18 min", "1h 05m" — for durations being reported, not counted down. */
export const formatDuration = (ms: number): string => {
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m.toString().padStart(2, '0')}m`;
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
