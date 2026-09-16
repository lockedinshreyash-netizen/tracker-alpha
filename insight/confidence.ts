/* ── The gates ──
   Everything the analysis is willing to say out loud passes through here.

   The rule the whole feature rests on: Alpha does not tell the student
   something is true about them until their own data supports it. A tracker
   that guesses at a personality from four sessions is worse than one that
   counts hours, because the student will believe it — and will reorganise
   their week around noise.

   Two independent gates, both of which must open. Sample size answers "have we
   watched enough?", effect size answers "is the difference big enough to act
   on?". Passing only the first is the interesting middle state, and it has its
   own name rather than being rounded down to silence. */

/**
 * How certain the analysis is allowed to sound.
 *
 * `insufficient` — the sample gates are not met. The figure is withheld and the
 *   UI says exactly how much more is needed, because "not enough data" without
 *   a number is an apology rather than information.
 * `emerging` — enough observations exist, but the difference sits inside normal
 *   variation. The number is shown; the claim is not.
 * `established` — both gates open. The claim is made, with its sample beside it.
 */
export type Confidence = 'insufficient' | 'emerging' | 'established';

/* ── Sample gates ──
   The three thresholds are deliberately independent, because each one closes a
   different way of being fooled. */

/** Sessions overlapping the window being judged. */
export const MIN_SESSIONS = 8;

/**
 * Distinct study days those sessions are spread across.
 *
 * Thirty sessions inside one week is a fact about that week — exam week, a
 * holiday, a burst of motivation — not a fact about time of day. This is the
 * gate that stops a single unusual stretch becoming a personality trait.
 */
export const MIN_DAYS = 6;

/**
 * Calendar days between the first and last observation.
 *
 * A student can hit six study days inside eight calendar days while still
 * living one continuous mood. Two weeks is the shortest span that can contain
 * two different weeks.
 */
export const MIN_SPAN_DAYS = 14;

/**
 * Windows that must independently clear the sample gates before any of them
 * can be called "best".
 *
 * "Best" is a comparison, and a comparison needs something to compare against.
 * With only one qualified window, the honest statement is "this is where you
 * study", which the observation chart already shows without claiming anything.
 */
export const MIN_COMPARISON_WINDOWS = 3;

/** Half-life of the recency weighting, in days. */
export const RECENCY_HALF_LIFE_DAYS = 30;

export interface Sample {
  /** Number of observations — sessions, or nights for sleep. */
  n: number;
  /** Distinct study days represented. */
  days: number;
  /** Calendar days from first observation to last. */
  spanDays: number;
}

export interface SampleGate {
  passed: boolean;
  /** What is still missing, most-binding first. Empty when passed. */
  missing: { kind: 'sessions' | 'days' | 'span'; short: number }[];
}

/**
 * Whether a sample is big enough to be asked a question.
 *
 * Returns what is *short* rather than a boolean alone, because the UI's job in
 * the insufficient state is to name the shortfall: "4 MORE STUDY DAYS" tells a
 * student what to do, and "not enough data" tells them nothing.
 */
export const checkSample = (s: Sample, min: Partial<Sample> = {}): SampleGate => {
  const needSessions = min.n ?? MIN_SESSIONS;
  const needDays = min.days ?? MIN_DAYS;
  const needSpan = min.spanDays ?? MIN_SPAN_DAYS;

  const missing: SampleGate['missing'] = [];
  if (s.days < needDays) missing.push({ kind: 'days', short: needDays - s.days });
  if (s.n < needSessions) missing.push({ kind: 'sessions', short: needSessions - s.n });
  if (s.spanDays < needSpan) missing.push({ kind: 'span', short: needSpan - s.spanDays });

  return { passed: missing.length === 0, missing };
};

/* ── Effect gate ──
   A difference can be perfectly real and completely useless. Both conditions
   below have to hold: separated from the noise, AND large enough that acting on
   it could change anything. */

export interface EffectFloor {
  /** Smallest difference in the metric's own units that is worth mentioning. */
  absolute: number;
  /** Multiples of the pooled standard deviation. */
  sd: number;
}

/**
 * Floors per metric, in the metric's own units.
 *
 * `quality` is a 1–5 self-report, so 0.4 is a bit under half a point — smaller
 * than that and the student could not have told the two windows apart while
 * living them. `minutes` is mean session length; twelve minutes is the
 * difference between a session you would describe differently. `ratio` is for
 * anything compared proportionally, at 15%.
 */
export const FLOORS = {
  quality: { absolute: 0.4, sd: 0.5 } as EffectFloor,
  minutes: { absolute: 12, sd: 0.5 } as EffectFloor,
  ratio: { absolute: 0.15, sd: 0.5 } as EffectFloor,
};

/** Population standard deviation of a list. Zero for fewer than two values. */
export const stdDev = (values: number[]): number => {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
};

export const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;

/**
 * Whether a difference clears both halves of the effect gate.
 *
 * Both, not either. A separation of 0.05 quality points can be statistically
 * clean and still not be worth a student rearranging their morning over; a gap
 * of a full point inside wild variance is worth mentioning but not asserting.
 */
export const checkEffect = (
  a: number[],
  b: number[],
  floor: EffectFloor,
): { passed: boolean; diff: number } => {
  const diff = mean(a) - mean(b);
  const magnitude = Math.abs(diff);
  if (magnitude < floor.absolute) return { passed: false, diff };

  /* Pooled across both groups rather than either alone — a window whose own
     variance happens to be small must not be able to clear the gate against a
     wildly variable rest-of-day. */
  const pooled = stdDev([...a, ...b]);
  if (pooled > 0 && magnitude < floor.sd * pooled) return { passed: false, diff };

  return { passed: true, diff };
};

/**
 * The two gates resolved into one tier.
 *
 * The order matters: a sample too small to judge is never `emerging`, however
 * large the apparent difference. That is the exact case — three sessions at
 * 9 AM that happened to go well — the tiers exist to refuse.
 */
export const gradeConfidence = (sample: SampleGate, effectPassed: boolean): Confidence => {
  if (!sample.passed) return 'insufficient';
  return effectPassed ? 'established' : 'emerging';
};

/**
 * How much an observation from `daysAgo` counts towards an average.
 *
 * Applied to the **means only**, never to the sample counts. You cannot weight
 * your way to having watched enough days, and a gate that could be satisfied by
 * a scaling factor is not a gate. A routine from three months ago is real
 * history but it is not a current trait, and at a 30-day half-life it carries a
 * quarter of the vote of last week.
 */
export const recencyWeight = (daysAgo: number): number =>
  Math.pow(0.5, Math.max(0, daysAgo) / RECENCY_HALF_LIFE_DAYS);

/**
 * A list with its extremes pulled in to the 5th and 95th percentiles.
 *
 * One nine-hour Sunday should not be allowed to define a window. Winsorising
 * rather than dropping keeps the observation count honest — the session did
 * happen, and the sample gates are counting real sessions — while stopping its
 * magnitude from dominating the mean.
 */
export const winsorize = (values: number[], p = 0.05): number[] => {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const lo = sorted[Math.floor(sorted.length * p)];
  const hi = sorted[Math.ceil(sorted.length * (1 - p)) - 1];
  return values.map(v => Math.min(hi, Math.max(lo, v)));
};
