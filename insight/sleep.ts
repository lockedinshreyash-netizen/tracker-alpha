import { DailyLog, SleepLog } from '../types';
import { Confidence, FLOORS, checkEffect, clearOfChance, mean } from './confidence';

/* ── Sleep against the day after it ──
   Pure, and the same contract as the rest of insight/: it takes the
   experiment's observed sessions and its nights, and says only what they
   support. Nothing here is a recommendation. The card under it says that Alpha
   will never suggest sleeping less to study more, and this file is where that
   promise has to hold: it reports what followed a night, never what to do
   about one. */

/** Nights recorded before any comparison is attempted. The figure the sleep card has always shown. */
export const MIN_NIGHTS = 21;

/**
 * Nights each half of the comparison needs, counting only nights followed by
 * a day with a timed session. Seven a side is a week of each, and the split is
 * at the median, so this is reached at fourteen such nights.
 */
export const MIN_NIGHTS_PER_SIDE = 7;

/**
 * How far apart, on average, the longer and shorter nights must be.
 *
 * Somebody who sleeps 6h50 to 7h20 every night still has a longer half and a
 * shorter half, and comparing them is comparing noise in a stopwatch. Under
 * three quarters of an hour there is no short night to speak of, and the card
 * says so rather than inventing a contrast.
 */
export const MIN_CONTRAST_MINS = 45;

/** One half of the split, as figures the card can print. */
export interface SleepSide {
  nights: number;
  /** Mean sleep in this half, minutes. */
  sleepMins: number;
  /** Mean focus rating the day after, minute-weighted within each day. */
  focus: number;
  /** Mean timed study hours the day after. */
  hours: number;
}

export interface SleepMetric {
  confidence: Confidence;
  /** Longer nights minus shorter ones, in the metric's own units. */
  diff: number;
}

/**
 * `nights` — fewer than `MIN_NIGHTS` recorded.
 * `days` — enough nights, too few followed by a timed study day.
 * `contrast` — enough of both, but the nights are all about the same length.
 * `null` — the comparison is drawn. Each metric then carries its own tier.
 */
export type SleepWait = 'nights' | 'days' | 'contrast' | null;

export interface SleepFindings {
  /** Nights recorded since the experiment began. */
  nights: number;
  /** Of those, nights followed by a day with at least one timed session. */
  paired: number;
  /** What `paired` has to reach before the split can be made. */
  pairedNeed: number;
  waiting: SleepWait;
  /** Shortest and longest paired night, minutes. Shown when `waiting` is `contrast`. */
  range: [number, number] | null;
  longer: SleepSide | null;
  shorter: SleepSide | null;
  focus: SleepMetric | null;
  hours: SleepMetric | null;
}

interface Pair {
  sleepMins: number;
  focus: number;
  hours: number;
}

const side = (pairs: Pair[]): SleepSide => ({
  nights: pairs.length,
  sleepMins: mean(pairs.map(p => p.sleepMins)),
  focus: mean(pairs.map(p => p.focus)),
  hours: mean(pairs.map(p => p.hours)),
});

/* Both gates and the chance check. Each half is only a week or two of nights,
   which is exactly the sample size the effect floors alone cannot judge. */
const metric = (a: number[], b: number[], floor: typeof FLOORS.quality): SleepMetric => {
  const { passed, diff } = checkEffect(a, b, floor);
  return { confidence: passed && clearOfChance(a, b) ? 'established' : 'emerging', diff };
};

/**
 * Each night beside the study day it woke into.
 *
 * `SleepLog.date` is already that day, so the pairing is a lookup, not a
 * guess. Only timed sessions count, for the reason the whole Observatory gives:
 * a day with nothing timed is a day nothing was measured, which is not the same
 * as a day nothing was done — so a night followed by one is set aside rather
 * than scored as zero hours.
 *
 * Split at the median, by rank. A fixed line ("under 7 hours") leaves one half
 * empty for a student who never sleeps under it; ranking always gives two
 * halves, and `MIN_CONTRAST_MINS` decides whether they differ enough to be
 * worth comparing. With an odd count the middle night belongs to neither half.
 */
export const compareSleep = (
  observed: DailyLog[],
  nights: SleepLog[],
): SleepFindings => {
  const byDate = new Map<string, DailyLog[]>();
  for (const l of observed) {
    const list = byDate.get(l.date);
    if (list) list.push(l); else byDate.set(l.date, [l]);
  }

  const pairs: Pair[] = [];
  for (const n of nights) {
    const day = byDate.get(n.date);
    if (!day) continue;
    const minutes = day.map(l => ((l.endedAt as number) - (l.startedAt as number)) / 60_000);
    const total = minutes.reduce((a, b) => a + b, 0);
    if (total <= 0) continue;
    /* Minute-weighted, the same rule `buildGrid` keeps: a five-minute session
       rated 1 must not cancel a two-hour one rated 5. */
    const focus = day.reduce((a, l, i) => a + minutes[i] * (Number.isFinite(l.quality) ? l.quality : 0), 0) / total;
    pairs.push({
      sleepMins: (n.wakeAt - n.bedAt) / 60_000,
      focus,
      hours: day.reduce((a, l) => a + l.hours, 0),
    });
  }

  const pairedNeed = MIN_NIGHTS_PER_SIDE * 2;
  const base: SleepFindings = {
    nights: nights.length,
    paired: pairs.length,
    pairedNeed,
    waiting: null,
    range: null,
    longer: null,
    shorter: null,
    focus: null,
    hours: null,
  };

  if (nights.length < MIN_NIGHTS) return { ...base, waiting: 'nights' };
  if (pairs.length < pairedNeed) return { ...base, waiting: 'days' };

  const sorted = [...pairs].sort((a, b) => a.sleepMins - b.sleepMins);
  const half = Math.floor(sorted.length / 2);
  const shortPairs = sorted.slice(0, half);
  const longPairs = sorted.slice(sorted.length - half);
  const shorter = side(shortPairs);
  const longer = side(longPairs);
  const range: [number, number] = [sorted[0].sleepMins, sorted[sorted.length - 1].sleepMins];

  if (longer.sleepMins - shorter.sleepMins < MIN_CONTRAST_MINS) {
    return { ...base, waiting: 'contrast', range };
  }

  return {
    ...base,
    range,
    longer,
    shorter,
    focus: metric(longPairs.map(p => p.focus), shortPairs.map(p => p.focus), FLOORS.quality),
    hours: metric(longPairs.map(p => p.hours), shortPairs.map(p => p.hours), FLOORS.hours),
  };
};
