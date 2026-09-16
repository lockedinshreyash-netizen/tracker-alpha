import { DailyLog } from '../types';
import { DAY_START_HOUR, IST_OFFSET_MS } from '../utils';

/* ── Turning sessions into a shape you can ask questions of ──
   Pure and React-free, the same contract schedule/schedule.ts and board/board.ts
   already keep. Nothing here reads AppState; everything takes the narrowest
   input that answers the question. */

/**
 * How finely the day is cut. 30 minutes × 48 = one study day.
 *
 * Half an hour is the smallest slice that still holds enough sessions to
 * average — at 15 minutes the sample gates in confidence.ts would never open,
 * and at a full hour a genuine 08:30 start is indistinguishable from a 09:00
 * one, which is precisely the distinction the feature exists to find.
 */
export const BUCKET_MINS = 30;
export const BUCKET_COUNT = (24 * 60) / BUCKET_MINS; // 48

/** Minutes in a study day. Minute 0 is 04:00 IST; 1439 is 03:59 the next morning. */
export const DAY_MINS = 24 * 60;

/**
 * A session the analysis is allowed to look at.
 *
 * Both timestamps or neither — a log carrying one of the two is treated as
 * carrying none, because half an interval cannot be placed on a clock. Manual
 * backfills never have them at all, which is the point: they keep the streak
 * honest but they cannot vote on what time of day anybody works best, since
 * nothing measured when they happened.
 *
 * `startedAt` must also precede `endedAt` and the pair must span something. A
 * clock that jumped backwards mid-session (or a device whose time was
 * corrected) can produce a negative span, and a negative span distributed over
 * buckets would subtract minutes the student actually studied.
 */
export const isObserved = (log: DailyLog): boolean =>
  Number.isFinite(log.startedAt) &&
  Number.isFinite(log.endedAt) &&
  (log.endedAt as number) > (log.startedAt as number);

/**
 * Only the sessions belonging to the experiment.
 *
 * `since` is `AnalysisState.startedAt`. A session that ended before the student
 * pressed begin is not an observation in their experiment, however well
 * measured it was — the experiment has a genuine beginning, and a day counter
 * that says DAY 04 has to mean four days of actually watching.
 *
 * A null `since` means the experiment has not started, and the honest answer is
 * that there are no observations yet.
 */
export const observedSince = (logs: DailyLog[], since: number | null): DailyLog[] =>
  since === null ? [] : logs.filter(l => isObserved(l) && (l.startedAt as number) >= since);

/**
 * A wall-clock instant as a minute on the study-day axis.
 *
 * The axis starts at 04:00 IST, so minute 0 is 04:00, 1200 is midnight, and
 * 1439 is 03:59 the following calendar morning while still belonging to the
 * same study day. Deliberately IST rather than the device's zone, for the
 * reason `istInstant` in utils.ts gives: every date in this app already means
 * an Indian date, and a phone set to the wrong region must not relabel when
 * somebody studied.
 */
export const toDayMinute = (epochMs: number): number => {
  const ist = epochMs + IST_OFFSET_MS;
  const minuteOfDay = Math.floor(ist / 60_000) % DAY_MINS;
  const shifted = minuteOfDay - DAY_START_HOUR * 60;
  return (shifted + DAY_MINS) % DAY_MINS;
};

/** Which 30-minute bucket a study-day minute falls in. 0 … 47. */
export const bucketOf = (dayMinute: number): number =>
  Math.min(BUCKET_COUNT - 1, Math.floor(dayMinute / BUCKET_MINS));

/** The study-day minute a bucket opens at. */
export const bucketStart = (bucket: number): number => bucket * BUCKET_MINS;

/**
 * What one bucket has accumulated.
 *
 * `minutes` is real elapsed time attributed by overlap, not a session count —
 * two minutes of a 90-minute session belong to the bucket they fell in and
 * nowhere else. `qualityMinutes` is the minute-weighted sum of the quality
 * ratings, so `qualityMinutes / minutes` is the average focus of the time spent
 * here rather than the average of the ratings, which would let a two-minute
 * session outvote a two-hour one.
 */
export interface Bucket {
  minutes: number;
  qualityMinutes: number;
  /** Sessions that touched this bucket at all. The sample size, for the gates. */
  sessions: number;
  /** Distinct study days on which this bucket saw any time. */
  days: Set<string>;
}

export interface DayGrid {
  buckets: Bucket[];
  totalMinutes: number;
  sessionCount: number;
  /** Distinct study days with at least one observed session. */
  dayCount: number;
  /** Earliest and latest observed session, epoch ms. Null when there are none. */
  firstAt: number | null;
  lastAt: number | null;
}

const emptyBucket = (): Bucket => ({ minutes: 0, qualityMinutes: 0, sessions: 0, days: new Set() });

/**
 * Sessions distributed across the day by **interval overlap**, not by start hour.
 *
 * A two-hour session beginning at 08:55 is not "a 9 AM session": it puts five
 * minutes in the 08:30 bucket and thirty in each of the next three. Bucketing
 * on the start time alone is the single most common way a time-of-day chart
 * ends up describing when somebody *sits down* rather than when they *work*,
 * and the two answers diverge most for exactly the long sessions that matter
 * most.
 *
 * The 04:00 rollover is clamped, not split. A session running 03:30 → 05:00
 * spans two study days; its minutes are attributed to the study day of
 * `startedAt` and the tail is cut at minute 1439. Splitting it across days
 * would make a session's hours disagree with its own log row, and the log's
 * `date` field has already made this choice — this only follows it. The same
 * stance `clampBlock` takes on the Plan tab.
 */
export const buildGrid = (logs: DailyLog[]): DayGrid => {
  const buckets = Array.from({ length: BUCKET_COUNT }, emptyBucket);
  const days = new Set<string>();
  let totalMinutes = 0;
  let firstAt: number | null = null;
  let lastAt: number | null = null;

  const observed = logs.filter(isObserved);

  for (const log of observed) {
    const startedAt = log.startedAt as number;
    const endedAt = log.endedAt as number;

    if (firstAt === null || startedAt < firstAt) firstAt = startedAt;
    if (lastAt === null || endedAt > lastAt) lastAt = endedAt;
    days.add(log.date);

    const start = toDayMinute(startedAt);
    /* Measured from the start rather than converted independently, so a
       session that runs past the rollover stays one contiguous interval on
       this day's axis instead of wrapping to minute 0. */
    const rawEnd = start + (endedAt - startedAt) / 60_000;
    const end = Math.min(DAY_MINS, rawEnd);
    if (end <= start) continue;

    const quality = Number.isFinite(log.quality) ? log.quality : 0;

    for (let b = bucketOf(start); b < BUCKET_COUNT; b++) {
      const from = Math.max(start, bucketStart(b));
      const to = Math.min(end, bucketStart(b) + BUCKET_MINS);
      const overlap = to - from;
      if (overlap <= 0) break;

      const bucket = buckets[b];
      bucket.minutes += overlap;
      bucket.qualityMinutes += overlap * quality;
      bucket.sessions += 1;
      bucket.days.add(log.date);
      totalMinutes += overlap;
    }
  }

  return {
    buckets,
    totalMinutes,
    sessionCount: observed.length,
    dayCount: days.size,
    firstAt,
    lastAt,
  };
};

/** Average focus rating across the time spent in a bucket, or null if it saw none. */
export const bucketQuality = (b: Bucket): number | null =>
  b.minutes > 0 ? b.qualityMinutes / b.minutes : null;
