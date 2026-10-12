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

/**
 * How much of its sessions a window has to actually hold to describe them.
 *
 * Sliding windows overlap, so a window can clear every sample gate on the first
 * twenty minutes of sessions that mostly ran after it closed. Measured, that
 * window is "6:30 – 9:00 AM" for a student whose sessions start at 8:40 — and
 * it can top the ranking, because it only ever sees the fresh opening minutes.
 * Half of what each session could have spent inside (all of it, or the whole
 * window for a session longer than one) keeps the label on the hours that were
 * actually worked, without ruling out a student whose sessions run all day.
 */
export const MIN_COVERAGE = 0.5;

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
  /** Share of its sessions' time that fell inside it, 0–1. See `MIN_COVERAGE`. */
  coverage: number;
  sample: SampleGate;
}

/**
 * What the claim is waiting on, in the order the requirements are met.
 *
 * `window` — no time of day has enough evidence yet.
 * `second` — one has. "Best" needs a separate time of day with the same before
 *   there is anything to compare it with.
 * `gap` — both have. The difference between them is too small to call, and
 *   that is an answer: more sessions are not owed, they only keep checking it.
 * `null` — established.
 *
 * Each stage needs its own panel. One set of meters drawn across all three
 * pointed, after the first stage, at whichever stray half-hour had not
 * qualified — a single 10 PM session read "1 of 6 days" a month into the
 * study, and the panel could never fill, because filling it was not what the
 * claim was waiting for.
 */
export type WindowWait = 'window' | 'second' | 'gap' | null;

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
   * The gated difference, best window minus the rest of the day, in rating
   * points. Present once `best` is. Raw rather than recency-weighted, because
   * it is the figure the effect gate judged.
   */
  gap?: number;
  waiting: WindowWait;
  /**
   * The qualified window that best describes where the evidence already is —
   * the one holding the most observed time. Set while `waiting` is `second`, so
   * the panel can say which time of day is done.
   */
  anchor: StudyWindow | null;
  /**
   * The candidate the evidence meters follow, whole.
   *
   * The UI draws the evidence gates as filling meters — "5 of 8 sessions" — so
   * it needs the counts themselves, not just what is missing. A meter is read
   * in a glance and a sentence is read in a second, and this panel exists to be
   * glanced at.
   *
   * At `window` it is the busiest time of day not yet qualified. At `second`
   * it is the busiest one clear of every qualified window, so a meter never
   * names another slice of the hours that already count. Null when nothing
   * that would move the claim can be filled — including `second` for somebody
   * who has only ever studied at one time of day.
   */
  nearestWindow: StudyWindow | null;
}

const disjoint = (a: StudyWindow, b: StudyWindow): boolean =>
  a.end <= b.start || a.start >= b.end;

const byMinutes = (a: StudyWindow, b: StudyWindow) => b.minutes - a.minutes;

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
    let reachable = 0;
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
      reachable += Math.min(s.end - s.start, WINDOW_MINS);
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
      coverage: reachable > 0 ? minutes / reachable : 0,
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
 *     Nor is one holding only the edges of its sessions (`MIN_COVERAGE`).
 *  2. Fewer than `MIN_COMPARISON_WINDOWS` qualified windows means there is
 *     nothing to compare against, and "best" is withheld entirely rather than
 *     awarded by default to the only window that happens to have data.
 *  3. Best and worst may not overlap. "Best 08:30–11:00, worst 09:00–11:30"
 *     is arithmetic, not a finding, and a student reading it would rightly stop
 *     believing the rest.
 *
 * Passing all three still only earns `emerging` — the claim itself waits on the
 * effect gate, which also has to point the right way: the best window's
 * sessions rated *above* the rest of the day, not merely apart from them.
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
    .filter(w => w.sample.passed && w.quality !== null && w.coverage >= MIN_COVERAGE)
    .sort(byQuality(1));

  /* Ranked by how much observed time a window already holds — the window the
     student is actually building evidence in is the one they care about the
     wait for. Slivers are left out so a meter never names one. */
  const pending = all
    .filter(w => !w.sample.passed && w.minutes > 0 && w.coverage >= MIN_COVERAGE)
    .sort(byMinutes);

  const comparisonShort = Math.max(0, MIN_COMPARISON_WINDOWS - qualified.length);
  const best = qualified[0] ?? null;
  /* Sorted ascending rather than reversed, so the minutes tie-break still runs
     the right way round — reversing a descending sort would prefer the window
     holding the *least* evidence among equals, which is exactly backwards. */
  const worst = best
    ? [...qualified].sort(byQuality(-1)).find(w => disjoint(w, best)) ?? null
    : null;

  if (!best || !worst || qualified.length < MIN_COMPARISON_WINDOWS) {
    /* Waiting on a second time of day only when nothing qualified is clear of
       the best — two separated windows short of the count is still a wait on
       windows, and the meters follow the busiest one left. */
    const second = best !== null && !worst;
    const nearestWindow = second
      ? pending.find(w => qualified.every(q => disjoint(w, q))) ?? null
      : pending[0] ?? null;
    return {
      qualified, best: null, worst: null, confidence: 'insufficient', comparisonShort,
      nearest: nearestWindow?.sample ?? null,
      waiting: second ? 'second' : 'window',
      anchor: second ? [...qualified].sort(byMinutes)[0] : null,
      nearestWindow,
    };
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
  /* `checkEffect` judges the size of a gap in either direction. "You focus
     best between…" needs it in this one: best is ranked on the recency-weighted
     figure, and a window can top that while its sessions, all told, rated
     below the rest of the day. */
  const confidence = gradeConfidence(best.sample, effect.passed && effect.diff > 0);

  return {
    qualified,
    best,
    worst,
    confidence,
    comparisonShort,
    nearest: null,
    waiting: confidence === 'established' ? null : 'gap',
    anchor: null,
    nearestWindow: null,
    gap: effect.diff,
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
