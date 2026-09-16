import { AnalysisState, DailyLog, SleepLog } from '../types';
import { DAY_START_HOUR, IST_OFFSET_MS, addDays, dateValue, getISTDateString } from '../utils';
import { BUCKET_COUNT, DayGrid, buildGrid, isObserved, observedSince } from './buckets';
import { MIN_DAYS, MIN_SESSIONS, MIN_SPAN_DAYS } from './confidence';
import { WindowFindings, findWindows } from './windows';

/* ── The experiment, as a thing you can look at ──
   The point of this module is that the student can watch their own dataset
   getting richer. Everything here is derived from real records; nothing is
   simulated, projected, or padded to make the screen feel busier than the
   evidence is. */

/**
 * Where the experiment has got to.
 *
 * Deliberately parallel to `Confidence` but not the same enum: that one grades
 * a single claim, this one describes the whole study. An experiment is
 * `observing` long before any individual finding is `established`, and saying
 * so is what stops the first fortnight feeling like an empty room.
 */
export type ExperimentStatus = 'unstarted' | 'started' | 'observing' | 'emerging' | 'established';

export const STATUS_LABEL: Record<ExperimentStatus, string> = {
  unstarted: 'Not started',
  started: 'Started',
  observing: 'Observing',
  emerging: 'Early signal',
  established: 'Established',
};

/**
 * What each state actually means, in the student's terms.
 *
 * Shown next to the status rather than left for them to infer. A status word
 * nobody can define is decoration.
 */
export const STATUS_MEANING: Record<ExperimentStatus, string> = {
  unstarted: 'The experiment has not begun.',
  started: 'Alpha is recording. Nothing can be compared yet.',
  observing: 'Enough sessions to show you your own record, not yet enough to test it.',
  emerging: 'A window is beginning to separate from the rest of your day.',
  established: 'A pattern your own data supports.',
};

export interface ExperimentState {
  status: ExperimentStatus;
  /** Day 1 is the day BEGIN was pressed. Zero when unstarted. */
  dayNumber: number;
  startedOn: string | null;
  /** Observed sessions since the experiment began. */
  sessions: number;
  /** Observed hours since the experiment began. */
  hours: number;
  /** Distinct study days carrying at least one observed session. */
  studyDays: number;
  /** Calendar days from first observation to last. */
  spanDays: number;
  /** Nights of sleep recorded since the experiment began. Zero when off. */
  nights: number;
  grid: DayGrid;
  windows: WindowFindings;
}

/** Day 1 is the start day itself — an experiment begun today is on its first day. */
export const dayNumber = (startedOn: string | null, today: string): number => {
  if (!startedOn) return 0;
  return Math.max(1, Math.round((dateValue(today) - dateValue(startedOn)) / 86_400_000) + 1);
};

/**
 * Everything the observatory needs, from the raw records.
 *
 * One pass, memoised by the caller. `observedSince` is what makes this the
 * *experiment's* state rather than the account's: a user with two years of
 * history who starts the analysis today is on day 1 with zero sessions, which
 * is the truth and is also the only thing that makes the day counter mean
 * anything.
 */
export const buildExperiment = (
  analysis: AnalysisState,
  logs: DailyLog[],
  sleepLogs: SleepLog[],
  today: string = getISTDateString(),
): ExperimentState => {
  const observed = observedSince(logs, analysis.startedAt);
  const grid = buildGrid(observed);
  const windows = findWindows(observed, today);

  const days = new Set(observed.map(l => l.date));
  const sorted = [...days].sort();
  const spanDays = sorted.length ? Math.round((dateValue(sorted[sorted.length - 1]) - dateValue(sorted[0])) / 86_400_000) + 1 : 0;

  const nights = analysis.startedOn
    ? sleepLogs.filter(s => s.date >= (analysis.startedOn as string)).length
    : 0;

  return {
    status: statusOf(analysis, grid, windows),
    dayNumber: dayNumber(analysis.startedOn, today),
    startedOn: analysis.startedOn,
    sessions: observed.length,
    hours: Math.round(observed.reduce((a, l) => a + l.hours, 0) * 10) / 10,
    studyDays: days.size,
    spanDays,
    nights,
    grid,
    windows,
  };
};

/**
 * The experiment's state, derived and never asserted.
 *
 * `observing` begins the moment there is a second study day, because that is
 * the first point at which the chart shows something a single day could not —
 * the student can see one session become a distribution. Everything above it is
 * handed straight to the confidence engine rather than decided here, so the
 * status can never outrun what the gates would actually allow to be said.
 */
const statusOf = (analysis: AnalysisState, grid: DayGrid, windows: WindowFindings): ExperimentStatus => {
  if (analysis.startedAt === null) return 'unstarted';
  if (grid.sessionCount === 0 || grid.dayCount < 2) return 'started';
  if (windows.confidence === 'established') return 'established';
  if (windows.confidence === 'emerging') return 'emerging';
  return 'observing';
};

/* ── Accumulation ──
   The one thing this feature has to make visible is the dataset getting
   richer. A list of sessions cannot do it; a grid of days can — sparse rows at
   the start, filling in as the study runs. */

export interface DayRow {
  date: string;
  /** Observed minutes per 30-minute bucket. Length BUCKET_COUNT. */
  buckets: number[];
  minutes: number;
  /** Nothing recorded — a rest day, or a day the clock was never started. */
  empty: boolean;
}

/**
 * Every calendar day of the experiment, most recent last.
 *
 * Days with nothing on them are **kept as empty rows** rather than skipped.
 * That is the honest picture and it is also the more useful one: a gap is a
 * fact about the student's consistency, and a grid that quietly closed up its
 * gaps would show a perfect record to somebody who had studied four days out of
 * ten.
 *
 * Capped at `max` rows from the end, so a year-long study stays a readable
 * block rather than a mile of rows.
 */
export const dayRows = (
  logs: DailyLog[],
  startedOn: string | null,
  today: string = getISTDateString(),
  max = 28,
): DayRow[] => {
  if (!startedOn) return [];

  const span = Math.round((dateValue(today) - dateValue(startedOn)) / 86_400_000) + 1;
  if (span <= 0) return [];

  const from = span > max ? addDays(startedOn, span - max) : startedOn;
  const count = Math.min(span, max);

  const byDate = new Map<string, DailyLog[]>();
  for (const l of logs) {
    if (!isObserved(l) || l.date < from) continue;
    const list = byDate.get(l.date);
    if (list) list.push(l); else byDate.set(l.date, [l]);
  }

  const rows: DayRow[] = [];
  for (let i = 0; i < count; i++) {
    const date = addDays(from, i);
    const dayLogs = byDate.get(date) ?? [];
    const grid = buildGrid(dayLogs);
    rows.push({
      date,
      buckets: grid.buckets.map(b => b.minutes),
      minutes: grid.totalMinutes,
      empty: dayLogs.length === 0,
    });
  }
  return rows;
};

/* ── Evidence, as quantities rather than sentences ──
   The gates are counts, and counts can be drawn. A meter that reads 5 of 8 is
   understood in a glance; the same fact written out is read, parsed, and
   forgotten. */

export interface Gate {
  label: string;
  have: number;
  need: number;
  unit: string;
}

/**
 * What the strongest candidate window still needs, as filling meters.
 *
 * Measured against the window closest to qualifying rather than the day as a
 * whole, because that is the one the student is actually building evidence in —
 * and the numbers are its real counts, never a percentage invented to make a
 * bar look fuller.
 */
export const evidenceGates = (exp: ExperimentState): Gate[] => {
  const w = exp.windows.nearestWindow ?? exp.windows.qualified[0] ?? null;
  return [
    { label: 'Sessions in a window', have: w?.sessions ?? 0, need: MIN_SESSIONS, unit: '' },
    { label: 'Study days covered', have: w?.days ?? 0, need: MIN_DAYS, unit: '' },
    { label: 'Days of elapsed time', have: w?.spanDays ?? 0, need: MIN_SPAN_DAYS, unit: '' },
  ];
};

/**
 * What the experiment is still waiting for, in the order it will arrive.
 *
 * This is the "what Alpha is still learning" panel, and it exists because an
 * empty state that says "not enough data" is an apology. A student who is told
 * "4 more study days before this can be tested" knows what to do and knows the
 * system is not stalled.
 *
 * Only genuine shortfalls are listed. Nothing here invents a milestone to fill
 * space — when the analysis is waiting on nothing, this returns nothing.
 */
export const stillLearning = (exp: ExperimentState, sleepEnabled: boolean): string[] => {
  const out: string[] = [];

  if (exp.status === 'started') {
    out.push('Alpha needs a second study day before your record becomes a distribution.');
    return out;
  }

  const gate = exp.windows.nearest;
  if (exp.windows.confidence === 'insufficient') {
    if (gate && gate.missing.length) {
      const m = gate.missing[0];
      if (m.kind === 'days') {
        out.push(`${m.short} more study ${m.short === 1 ? 'day' : 'days'} before your strongest window can be tested.`);
      } else if (m.kind === 'sessions') {
        out.push(`${m.short} more ${m.short === 1 ? 'session' : 'sessions'} before your strongest window can be tested.`);
      } else {
        out.push(`${m.short} more ${m.short === 1 ? 'day' : 'days'} of elapsed time — a pattern needs to hold across more than one week.`);
      }
    } else {
      out.push(`A window needs ${MIN_SESSIONS} sessions across ${MIN_DAYS} study days, spanning ${MIN_SPAN_DAYS} days.`);
    }

    if (exp.windows.comparisonShort > 0 && exp.windows.qualified.length > 0) {
      out.push(`${exp.windows.comparisonShort} more ${exp.windows.comparisonShort === 1 ? 'window' : 'windows'} need enough data before yours can be compared against anything.`);
    }
  } else if (exp.windows.confidence === 'emerging') {
    out.push('Your strongest window has enough observations, but the gap is still inside normal variation.');
  }

  if (!sleepEnabled) {
    out.push('Sleep is not being recorded. Without it, nothing can be compared against the night before.');
  } else if (exp.nights < 21) {
    out.push(`${21 - exp.nights} more nights before sleep can be compared against the following day.`);
  }

  return out;
};

/* ── Formatting ──
   12-hour with a meridiem, matching the Plan tab's `formatClock`. The
   study-day axis stays 24-hour arithmetic; the meridiem is presentation only. */

export const formatClock = (dayMinute: number): string => {
  const total = (DAY_START_HOUR * 60 + dayMinute) % (24 * 60);
  const h24 = Math.floor(total / 60);
  const m = total % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
};

/** "6 AM" — the axis gutter on the observation chart. */
export const formatHour = (dayMinute: number): string => {
  const total = (DAY_START_HOUR * 60 + dayMinute) % (24 * 60);
  const h24 = Math.floor(total / 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}${h24 < 12 ? 'AM' : 'PM'}`;
};

/** "6:00 – 8:30 AM", writing the meridiem once when both ends share it. */
export const formatRange = (start: number, end: number): string => {
  const a = formatClock(start);
  const b = formatClock(end);
  const meridiem = a.slice(-2);
  return meridiem === b.slice(-2) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`;
};

/** The wall-clock time of an instant, on the IST clock. "09:12". */
export const clockOf = (epochMs: number): string => {
  const ist = epochMs + IST_OFFSET_MS;
  const minuteOfDay = Math.floor(ist / 60_000) % (24 * 60);
  const h = Math.floor(minuteOfDay / 60);
  const m = minuteOfDay % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

/** "3 SEP" — the experiment's start date, for the anchor line. */
export const formatStartDate = (date: string): string =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
    .format(new Date(date + 'T12:00:00'))
    .toUpperCase();

export { addDays };
