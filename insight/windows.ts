import { DailyLog } from '../types';
import { DATE_RE, dateValue } from '../utils';
import {
  BUCKET_COUNT, BUCKET_MINS, DAY_MINS, DayGrid, bucketStart, isObserved, toDayMinute,
} from './buckets';
import {
  Confidence, FLOORS, MIN_COMPARISON_WINDOWS, SampleGate, checkEffect, checkSample,
  gradeConfidence, recencyWeight, winsorize,
} from './confidence';

/* ── Finding the windows ──
   Pure. Takes observed logs and returns what, if anything, they support. */

/**
 * How long a candidate window is. Five buckets — two and a half hours.
 *
 * Short enough that "8:30–11:00" is a thing a student can act on, long enough
 * to gather the eight sessions the sample gate wants inside a couple of weeks.
 * A one-hour window almost never qualifies; a four-hour one is just "mornings",
 * which nobody needed an analysis to discover.
 */
export const WINDOW_BUCKETS = 5;
export const WINDOW_MINS = WINDOW_BUCKETS * BUCKET_MINS;

export interface StudyWindow {
  /** Study-day minutes. 0 is 04:00 IST. */
  start: number;
  end: number;
  /** Observed minutes falling inside this window. */
  minutes: number;
  sessions: number;
  days: number;
  spanDays: number;
  /** Minute-weighted, recency-weighted mean focus rating. Null if never studied. */
  quality: number | null;
  sample: SampleGate;
}

export interface WindowFindings {
  /** Every candidate that clears the sample gates, strongest first. */
  qualified: StudyWindow[];
  best: StudyWindow | null;
  worst: StudyWindow | null;
  /** The tier the best/worst claim is allowed to be stated at. */
  confidence: Confidence;
  /**
   * How many more windows need to qualify before a comparison is possible.
   * Zero once there are enough; this is what the "still learning" panel reads.
   */
  comparisonShort: number;
  /** The single most binding shortfall across all candidates, for the UI copy. */
  nearest: SampleGate | null;
  /** Mean focus outside the strongest window, so the gap can be drawn to scale. */
  restQuality?: number | null;
  /**
   * The candidate closest to qualifying, whole.
   *
   * The UI draws the evidence gates as filling meters — "5 of 8 sessions" — so
   * it needs the counts themselves, not just what is missing. A meter is read
   * in a glance and a sentence is read in a second, and this panel exists to be
   * glanced at.
   */
  nearestWindow: StudyWindow | null;
}

/** Whole days between two study-day strings. */
const daysBetween = (from: string, to: string): number =>
  Math.round((dateValue(to) - dateValue(from)) / 86_400_000);

interface SessionView {
  log: DailyLog;
  start: number;   // study-day minute
  end: number;     // may exceed DAY_MINS before clamping
  quality: number;
  date: string;
}

/**
 * Observed logs as intervals on the study-day axis.
 *
 * Same clamping rule as `buildGrid`: a session running past the 04:00 rollover
 * keeps the study day it started in and loses its tail, because the log's own
 * `date` field has already made that choice and two answers to "which day was
 * this" is the bug the whole time model exists to avoid.
 */
const toSessions = (logs: DailyLog[]): SessionView[] =>
  logs.filter(isObserved).map(log => {
    const start = toDayMinute(log.startedAt as number);
    const end = Math.min(DAY_MINS, start + ((log.endedAt as number) - (log.startedAt as number)) / 60_000);
    return {
      log,
      start,
      end,
      quality: Number.isFinite(log.quality) ? log.quality : 0,
      date: log.date,
    };
  }).filter(s => s.end > s.start && DATE_RE.test(s.date));

const overlaps = (s: SessionView, start: number, end: number): number =>
  Math.max(0, Math.min(s.end, end) - Math.max(s.start, start));

/**
 * Every 2.5-hour window of the day, measured.
 *
 * Candidates slide one bucket at a time, so a window can begin on any half
 * hour. Windows that would run past the end of the study day are dropped rather
 * than wrapped — a window spanning the 04:00 rollover would be comparing two
 * different days' worth of behaviour under one label.
 */
export const measureWindows = (logs: DailyLog[], today: string): StudyWindow[] => {
  const sessions = toSessions(logs);
  if (sessions.length === 0) return [];

  const out: StudyWindow[] = [];

  for (let b = 0; b + WINDOW_BUCKETS <= BUCKET_COUNT; b++) {
    const start = bucketStart(b);
    const end = start + WINDOW_MINS;

    let minutes = 0;
    let weighted = 0;
    let weight = 0;
    let count = 0;
    const days = new Set<string>();
    let first: string | null = null;
    let last: string | null = null;

    for (const s of sessions) {
      const inside = overlaps(s, start, end);
      if (inside <= 0) continue;

      minutes += inside;
      count += 1;
      days.add(s.date);
      if (first === null || s.date < first) first = s.date;
      if (last === null || s.date > last) last = s.date;

      /* Minute-weighted so a two-hour session outvotes a five-minute one, and
         recency-weighted so a routine the student has since abandoned fades
         rather than being averaged in at full strength forever. */
      const w = inside * recencyWeight(daysBetween(s.date, today));
      weighted += w * s.quality;
      weight += w;
    }

    const spanDays = first && last ? daysBetween(first, last) + 1 : 0;
    const sample = checkSample({ n: count, days: days.size, spanDays });

    out.push({
      start,
      end,
      minutes,
      sessions: count,
      days: days.size,
      spanDays,
      quality: weight > 0 ? weighted / weight : null,
      sample,
    });
  }

  return out;
};

/** Per-session focus ratings inside / outside a window, winsorised. */
const splitQuality = (sessions: SessionView[], start: number, end: number) => {
  const inside: number[] = [];
  const outside: number[] = [];
  for (const s of sessions) {
    (overlaps(s, start, end) > 0 ? inside : outside).push(s.quality);
  }
  return { inside: winsorize(inside), outside: winsorize(outside) };
};

/**
 * The best and worst windows the evidence actually supports.
 *
 * Three refusals are built in, and each one closes a way this feature could lie:
 *
 *  1. A window that does not clear the sample gates is never a candidate, so
 *     three good mornings can never become "you work best in the morning".
 *  2. Fewer than `MIN_COMPARISON_WINDOWS` qualified windows means there is
 *     nothing to compare against, and "best" is withheld entirely rather than
 *     awarded by default to the only window that happens to have data.
 *  3. Best and worst may not overlap. "Best 08:30–11:00, worst 09:00–11:30"
 *     is arithmetic, not a finding, and a student reading it would rightly stop
 *     believing the rest.
 *
 * Passing all three still only earns `emerging` — the claim itself waits on the
 * effect gate.
 */
export const findWindows = (logs: DailyLog[], today: string): WindowFindings => {
  const all = measureWindows(logs, today);
  const sessions = toSessions(logs);

  /* Ties are broken by observed minutes, and that is not cosmetic. Sliding
     windows overlap, so a window clipping the last ten minutes of every
     afternoon session scores identically to the one containing those sessions
     whole — same rating, a fifth of the evidence. Without this, "your lowest
     window is 4:00–6:30 PM" can be returned for sessions that actually ran
     3:20–4:10, which is a true statement about a sliver and a misleading one
     about the student's day. More observed time inside the window means the
     window is a better description of what was measured. */
    const byQuality = (dir: 1 | -1) => (a: StudyWindow, b: StudyWindow) =>
      dir * ((b.quality as number) - (a.quality as number)) || (b.minutes - a.minutes);

  const qualified = all
    .filter(w => w.sample.passed && w.quality !== null)
    .sort(byQuality(1));

  /* The candidate closest to qualifying, so the "still learning" panel can name
     a real shortfall rather than a generic one. Ranked by how much observed
     time it already holds — the window the student is actually building
     evidence in is the one they care about the wait for. */
  const nearestWindow = all
    .filter(w => !w.sample.passed && w.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)[0] ?? null;
  const nearest = nearestWindow?.sample ?? null;

  const comparisonShort = Math.max(0, MIN_COMPARISON_WINDOWS - qualified.length);

  if (qualified.length < MIN_COMPARISON_WINDOWS) {
    return { qualified, best: null, worst: null, confidence: 'insufficient', comparisonShort, nearest, nearestWindow };
  }

  const best = qualified[0];
  /* Sorted ascending rather than reversed, so the minutes tie-break still runs
     the right way round — reversing a descending sort would prefer the window
     holding the *least* evidence among equals, which is exactly backwards. */
  const worst = [...qualified]
    .sort(byQuality(-1))
    .find(w => w.end <= best.start || w.start >= best.end) ?? null;

  if (!worst) {
    return { qualified, best: null, worst: null, confidence: 'insufficient', comparisonShort, nearest, nearestWindow };
  }

  const { inside, outside } = splitQuality(sessions, best.start, best.end);
  /* The gate is run on raw per-session ratings across the whole observed
     period, while the figure on screen is recency-weighted. They answer
     different questions on purpose: the gate asks whether a difference has
     really been there, the display asks what it looks like lately. Letting
     recency weighting into the gate would let a good fortnight reopen a claim
     that months of data had closed. */
  const effect = outside.length > 0
    ? checkEffect(inside, outside, FLOORS.quality)
    : { passed: false, diff: 0 };

  return {
    qualified,
    best,
    worst,
    confidence: gradeConfidence(best.sample, effect.passed),
    comparisonShort,
    nearest,
    nearestWindow,
    /* The rest-of-day mean, so the comparison can be drawn rather than
       described. A finding that says "4.6 vs 2.9" against a scale the reader
       can see is understood instantly; the same fact in a sentence is not. */
    restQuality: outside.length ? outside.reduce((a, b) => a + b, 0) / outside.length : null,
  };
};

/**
 * Where the observed time actually sits, as a 0–1 share per bucket.
 *
 * This is the observation chart's data and it is deliberately not gated: it
 * describes what happened rather than claiming what it means, and the student
 * is entitled to see their own record from the first session. The distinction
 * between observation and interpretation is the one this whole module keeps.
 */
export const density = (grid: DayGrid): number[] => {
  const peak = Math.max(...grid.buckets.map(b => b.minutes), 0);
  if (peak <= 0) return grid.buckets.map(() => 0);
  return grid.buckets.map(b => b.minutes / peak);
};
