/* ── Mock tests: what the numbers say ──
   Pure, like share/stats.ts: this is the only file in mocks/ that does
   arithmetic about performance, and the components ask it questions rather
   than re-deriving answers. Every insight is computed from what the student
   actually logged — nothing is guessed for a mock that lacks a breakdown,
   and a claim needs enough mocks behind it before it is made at all. */

import { getChaptersFor } from '../constants';
import { getWeight } from '../content';
import { WeightTier } from '../content/types';
import {
  ChapterProgress, ErrorEntry, ExamPreference, MockExam, MockMistake, MockScope, MockTest,
  MockVerdict, Subject,
} from '../types';
import { addDays } from '../utils';
import {
  EXAMS, MISTAKE_ORDER, accuracy, isCleared, attemptRate, chapterKey, isTaken,
  parseKey, scorePct, subjectPct,
} from './model';

export type ExamFilter = MockExam | 'all';
export type ScopeFilter = MockScope | 'all';

export interface TakenMock {
  test: MockTest;
  pct: number;
  accuracy: number | null;
  attempt: number | null;
  percentile: number | null;
  bySubject: Partial<Record<Subject, number>>;
}

/** Taken mocks, oldest first. */
export const takenMocks = (tests: MockTest[]): TakenMock[] =>
  tests.filter(isTaken).flatMap(test => {
    const pct = scorePct(test.result);
    if (pct === null) return [];
    const bySubject: Partial<Record<Subject, number>> = {};
    test.result!.scores.forEach(s => {
      const p = subjectPct(s);
      if (p !== null) bySubject[s.subject] = p;
    });
    return [{
      test,
      pct,
      accuracy: accuracy(test.result),
      attempt: attemptRate(test.result),
      percentile: test.result!.percentile ?? null,
      bySubject,
    }];
  });

export const applyFilter = (taken: TakenMock[], exam: ExamFilter, scope: ScopeFilter): TakenMock[] =>
  taken.filter(t => (exam === 'all' || t.test.exam === exam) && (scope === 'all' || t.test.scope === scope));

/* ── Small statistics ── */

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

const stdev = (xs: number[]): number | null => {
  const m = mean(xs);
  if (m === null || xs.length < 2) return null;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};

/** Least-squares slope per step, over the values in order. */
export const slope = (ys: number[]): number | null => {
  const n = ys.length;
  if (n < 3) return null;
  const xm = (n - 1) / 2;
  const ym = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  ys.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) ** 2; });
  return den ? num / den : null;
};

export interface Summary {
  count: number;
  last: TakenMock | null;
  /** Last score minus the mean of up to five before it. */
  lastDelta: number | null;
  avg: number | null;
  best: TakenMock | null;
  accuracy: number | null;
  percentile: number | null;
  /** Points per mock across the last six. */
  trend: number | null;
  spread: number | null;
}

export const summarize = (series: TakenMock[]): Summary => {
  const pcts = series.map(t => t.pct);
  const last = series[series.length - 1] ?? null;
  const before = pcts.slice(Math.max(0, pcts.length - 6), -1);
  const accs = series.map(t => t.accuracy).filter((x): x is number => x !== null);
  const pctiles = series.slice(-5).map(t => t.percentile).filter((x): x is number => x !== null);
  return {
    count: series.length,
    last,
    lastDelta: last && before.length ? last.pct - (mean(before) as number) : null,
    avg: mean(pcts),
    best: series.reduce<TakenMock | null>((b, t) => (!b || t.pct > b.pct ? t : b), null),
    accuracy: mean(accs.slice(-5)),
    percentile: mean(pctiles),
    trend: slope(pcts.slice(-6)),
    spread: stdev(pcts.slice(-8)),
  };
};

/* ── Subjects ── */

export interface SubjectTrend {
  subject: Subject;
  points: { id: string; pct: number }[];
  avg: number | null;
  /** Mean of the last three minus the mean of the three before. */
  delta: number | null;
}

export const subjectTrends = (series: TakenMock[], subjects: Subject[]): SubjectTrend[] =>
  subjects.map(subject => {
    const points = series
      .filter(t => t.bySubject[subject] !== undefined)
      .map(t => ({ id: t.test.id, pct: t.bySubject[subject] as number }));
    const ys = points.map(p => p.pct);
    const recent = ys.slice(-3);
    const prior = ys.slice(-6, -3);
    return {
      subject,
      points,
      avg: mean(ys.slice(-5)),
      delta: recent.length && prior.length ? (mean(recent) as number) - (mean(prior) as number) : null,
    };
  });

/* ── Where marks leak ──
   Every verdict a student gave a chapter or a topic, across the mocks in
   view, weighted toward the recent: a chapter that was weak in March and
   strong in every mock since is not a weakness. */

export interface Leak {
  key: string;
  subject: Subject;
  classId: 11 | 12;
  chapter: string;
  topic?: string;
  weak: number;
  okay: number;
  strong: number;
  last: MockVerdict;
  lastDate: string;
  /** Recency-weighted: positive is a leak, negative is solid ground. */
  score: number;
  tier?: WeightTier;
}

const VERDICT_WEIGHT: Record<MockVerdict, number> = { weak: 1, okay: 0.35, strong: -0.7 };

export const leaks = (series: TakenMock[], pref: ExamPreference): Leak[] => {
  const map = new Map<string, Leak>();
  const n = series.length;
  series.forEach((t, i) => {
    const recency = 0.55 + 0.45 * ((i + 1) / n);
    Object.entries(t.test.result?.verdicts ?? {}).forEach(([key, verdict]) => {
      const p = parseKey(key);
      if (!p) return;
      const l = map.get(key) ?? {
        key, subject: p.subject, classId: p.classId, chapter: p.chapter, topic: p.topic,
        weak: 0, okay: 0, strong: 0, last: verdict, lastDate: t.test.date, score: 0,
        tier: getWeight(pref, p.classId, p.subject, p.chapter)?.tier,
      };
      l[verdict] += 1;
      l.last = verdict;
      l.lastDate = t.test.date;
      l.score += VERDICT_WEIGHT[verdict] * recency;
      map.set(key, l);
    });
  });
  return Array.from(map.values());
};

const TIER_BOOST: Record<WeightTier, number> = { critical: 1.35, high: 1.15, medium: 1, low: 0.85 };

/** The worst leaks first; a heavyweight chapter outranks a light one. */
export const topLeaks = (all: Leak[], limit = 8): Leak[] =>
  all
    .filter(l => l.score > 0 && l.last !== 'strong')
    .sort((a, b) => b.score * TIER_BOOST[b.tier ?? 'medium'] - a.score * TIER_BOOST[a.tier ?? 'medium'])
    .slice(0, limit);

/** Weak at some point, strong the last time it was tested. */
export const fixedLeaks = (all: Leak[]): Leak[] =>
  all.filter(l => l.weak > 0 && l.last === 'strong').sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1));

export const leakName = (l: Pick<Leak, 'chapter' | 'topic'>): string => l.topic ?? l.chapter;

/* ── Mistakes ── */

export interface MistakeMix {
  totals: Record<MockMistake, number>;
  sum: number;
  perTest: { test: MockTest; counts: Record<MockMistake, number>; sum: number }[];
  /** ≈ marks, at the paper's per-question value. */
  marks: Record<MockMistake, number>;
}

export const mistakeMix = (series: TakenMock[], lastN = 8): MistakeMix => {
  const zero = () => ({ silly: 0, concept: 0, time: 0, unstudied: 0 } as Record<MockMistake, number>);
  const totalsBy = zero();
  const marks = zero();
  const perTest = series
    .filter(t => t.test.result?.mistakes && Object.keys(t.test.result.mistakes).length)
    .slice(-lastN)
    .map(t => {
      const counts = zero();
      MISTAKE_ORDER.forEach(k => {
        const v = t.test.result!.mistakes![k] ?? 0;
        counts[k] = v;
        totalsBy[k] += v;
        marks[k] += v * EXAMS[t.test.exam].perQuestion;
      });
      return { test: t.test, counts, sum: MISTAKE_ORDER.reduce((a, k) => a + counts[k], 0) };
    });
  return { totals: totalsBy, sum: MISTAKE_ORDER.reduce((a, k) => a + totalsBy[k], 0), perTest, marks };
};

/* ── Readiness for an upcoming mock ──
   The one place the Mocks tab reads the Syllabus tab: a chapter in Sunday's
   paper that the student has never started is the most useful sentence this
   tab can say on a Thursday. */

export interface Readiness {
  total: number;
  done: number;
  started: number;
  notStarted: { subject: Subject; chapter: string; classId: 11 | 12 }[];
  /** Chapters/topics in this paper that leaked in earlier mocks. */
  risky: Leak[];
}

export const readiness = (
  test: MockTest,
  progress: ChapterProgress[],
  allLeaks: Leak[],
  subjects: Subject[],
  pref: ExamPreference,
): Readiness => {
  const chapters = test.scope === 'full'
    ? subjects.flatMap(subject => ([11, 12] as const).flatMap(classId =>
        getChaptersFor(pref, classId, subject).map(chapter => ({ classId, subject, chapter }))))
    : test.chapters;
  const status = new Map(progress.map(p => [chapterKey(p), p.status]));
  let done = 0, started = 0;
  const notStarted: Readiness['notStarted'] = [];
  chapters.forEach(c => {
    const s = status.get(chapterKey(c));
    if (s === 'completed' || s === 'revision_pending') done += 1;
    else if (s === 'in_progress' || s === 'practice_pending') started += 1;
    else notStarted.push({ subject: c.subject, chapter: c.chapter, classId: c.classId });
  });
  const inPaper = new Set(chapters.map(chapterKey));
  const risky = topLeaks(allLeaks.filter(l => inPaper.has(chapterKey(l))), 4);
  return { total: chapters.length, done, started, notStarted, risky };
};

/* ── Dates ── */

export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

export const relativeDay = (date: string, today: string): string => {
  const d = daysBetween(today, date);
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  if (d === -1) return 'Yesterday';
  if (d > 1 && d < 7) return `In ${d} days`;
  if (d < -1 && d > -7) return `${-d} days ago`;
  return formatDate(date, today);
};

export const formatDate = (date: string, today?: string): string => {
  const [y, m, d] = date.split('-').map(Number);
  const sameYear = today ? today.slice(0, 4) === date.slice(0, 4) : true;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)));
};

/** The coming Sunday (or today, if it is Sunday) — when most test series run. */
export const nextSunday = (today: string): string => {
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDays(today, (7 - dow) % 7);
};

/* ── The read ──
   Ranked sentences, each needing enough evidence before it is said. The voice
   is the app's: short, blunt, specific. Never "keep it up". */

export type Tone = 'up' | 'down' | 'warn' | 'info';

export interface Insight {
  id: string;
  tone: Tone;
  title: string;
  body: string;
  priority: number;
}

const fmt = (x: number, digits = 0) => (Math.round(x * 10 ** digits) / 10 ** digits).toFixed(digits);
const signed = (x: number, digits = 1) => `${x >= 0 ? '+' : '−'}${fmt(Math.abs(x), digits)}`;

export interface InsightInput {
  series: TakenMock[];       // filtered, oldest first
  everything: TakenMock[];   // unfiltered, oldest first
  tests: MockTest[];         // every mock, planned and taken
  subjects: Subject[];
  allLeaks: Leak[];
  progress: ChapterProgress[];
  pref: ExamPreference;
  today: string;
  errors?: ErrorEntry[];
}

export const buildInsights = (input: InsightInput): Insight[] => {
  const { series, everything, tests, subjects, allLeaks, progress, pref, today, errors = [] } = input;
  const out: Insight[] = [];
  const s = summarize(series);

  // Overdue plans and silence — about the habit, not the filter.
  const overdue = tests.filter(t => !t.result && t.date < today);
  if (overdue.length) {
    const t = overdue[overdue.length - 1];
    out.push({
      id: 'overdue', tone: 'warn', priority: 95,
      title: overdue.length === 1 ? `${t.name} is waiting for a score.` : `${overdue.length} mocks are waiting for scores.`,
      body: 'A mock you don’t review is just a bad Sunday. Log it while you still remember where it went wrong.',
    });
  }
  const upcoming = tests.filter(t => !t.result && t.date >= today).sort((a, b) => (a.date < b.date ? -1 : 1));
  const lastTaken = everything[everything.length - 1];
  if (lastTaken && !upcoming.length) {
    const gap = daysBetween(lastTaken.test.date, today);
    if (gap >= 10) {
      out.push({
        id: 'gap', tone: 'warn', priority: 80,
        title: `No mock in ${gap} days.`,
        body: 'Your rivals took two in that time. Plan the next one now.',
      });
    }
  }

  // Readiness for the next paper.
  const next = upcoming[0];
  if (next) {
    const r = readiness(next, progress, allLeaks, subjects, pref);
    const d = daysBetween(today, next.date);
    if (next.scope !== 'full' && r.notStarted.length && d <= 10) {
      const names = r.notStarted.slice(0, 2).map(c => c.chapter).join(' and ');
      out.push({
        id: 'ready', tone: 'warn', priority: 90,
        title: `${r.notStarted.length} ${r.notStarted.length === 1 ? 'chapter' : 'chapters'} in ${next.name} ${r.notStarted.length === 1 ? 'isn’t' : 'aren’t'} started.`,
        body: `${names}${r.notStarted.length > 2 ? ` and ${r.notStarted.length - 2} more` : ''}. ${d <= 1 ? 'Skim the formulas at least.' : `You have ${d} days.`}`,
      });
    }
    if (r.risky.length && d <= 10) {
      const l = r.risky[0];
      out.push({
        id: 'risky', tone: 'info', priority: 70,
        title: `Revise ${leakName(l)} before ${relativeDay(next.date, today).toLowerCase()}.`,
        body: `It was weak in ${l.weak} of your mocks and it’s in this paper.`,
      });
    }
  }

  // The error notebook: a pile of unresolved errors in one chapter is a test waiting to be taken.
  const pile = errorPiles(errors)[0];
  if (pile && pile.open >= 3) {
    out.push({
      id: 'errors', tone: 'info', priority: 76,
      title: `${pile.open} unresolved errors in ${pile.chapter}.`,
      body: 'Take them as a test in the Error notebook. Two right in a row clears one.',
    });
  }

  if (!series.length) return out.sort((a, b) => b.priority - a.priority);

  // Momentum, only within one exam — slopes across papers mean nothing.
  const exams = Array.from(new Set(series.map(t => t.test.exam)));
  exams.forEach(exam => {
    const ys = series.filter(t => t.test.exam === exam).map(t => t.pct);
    const k = slope(ys.slice(-6));
    if (k === null || ys.length < 4) return;
    const n = Math.min(6, ys.length);
    if (k >= 1.2) {
      out.push({
        id: `climb-${exam}`, tone: 'up', priority: 75,
        title: `Climbing ${signed(k)}% per ${EXAMS[exam].short} mock.`,
        body: `That’s the trend across your last ${n}. Whatever you changed, keep doing it.`,
      });
    } else if (k <= -1.2) {
      out.push({
        id: `slide-${exam}`, tone: 'down', priority: 85,
        title: `Sliding ${signed(k)}% per ${EXAMS[exam].short} mock.`,
        body: `Across your last ${n}. Stop taking new mocks for a week and fix the last three.`,
      });
    }
  });

  // A new best.
  if (s.last && s.best && s.last.test.id === s.best.test.id && s.count >= 3) {
    out.push({
      id: 'best', tone: 'up', priority: 88,
      title: `New personal best: ${fmt(s.last.pct)}%.`,
      body: `${s.last.test.name}. Now make it your floor, not your ceiling.`,
    });
  } else if (s.last && s.lastDelta !== null && s.lastDelta <= -8) {
    out.push({
      id: 'dip', tone: 'down', priority: 72,
      title: `${s.last.test.name} came in ${fmt(Math.abs(s.lastDelta))}% under your average.`,
      body: 'One bad paper is data, not a verdict. Find the two questions that cost the most.',
    });
  }

  // The subject dragging the total down.
  const subj = subjectTrends(series, subjects).filter(t => t.avg !== null && t.points.length >= 2);
  if (subj.length >= 2) {
    const sorted = [...subj].sort((a, b) => (a.avg as number) - (b.avg as number));
    const worst = sorted[0], top = sorted[sorted.length - 1];
    const gap = (top.avg as number) - (worst.avg as number);
    if (gap >= 10) {
      out.push({
        id: 'drag', tone: 'down', priority: 78,
        title: `${worst.subject} is dragging you down.`,
        body: `${fmt(worst.avg as number)}% against ${fmt(top.avg as number)}% in ${top.subject}. Closing half that gap is worth more than polishing ${top.subject}.`,
      });
    }
    const riser = [...subj].filter(t => t.delta !== null).sort((a, b) => (b.delta as number) - (a.delta as number))[0];
    if (riser && (riser.delta as number) >= 6) {
      out.push({
        id: 'riser', tone: 'up', priority: 60,
        title: `${riser.subject} is up ${fmt(riser.delta as number)}%.`,
        body: 'Your last three mocks against the three before. It’s working.',
      });
    }
  }

  // Mistakes.
  const mix = mistakeMix(series, 5);
  if (mix.sum >= 6) {
    const silly = mix.totals.silly;
    if (silly / mix.sum >= 0.3) {
      out.push({
        id: 'silly', tone: 'warn', priority: 82,
        title: `Silly mistakes cost you ~${mix.marks.silly} marks.`,
        body: `Across your last ${mix.perTest.length} mocks — ${Math.round((silly / mix.sum) * 100)}% of everything you lost. Those were yours to keep. Slow down on the easy ones.`,
      });
    }
    if (mix.totals.time / mix.sum >= 0.3) {
      out.push({
        id: 'time', tone: 'warn', priority: 68,
        title: 'The clock is beating you.',
        body: `${mix.totals.time} questions lost to time. Do one round of the easy ones first, then come back.`,
      });
    }
    if (mix.totals.unstudied / mix.sum >= 0.35) {
      out.push({
        id: 'unstudied', tone: 'info', priority: 64,
        title: 'You’re losing marks on chapters you haven’t studied.',
        body: 'More mocks won’t fix that. Finish the syllabus first.',
      });
    }
  }

  // Accuracy vs attempts.
  const recent = series.slice(-4);
  const acc = mean(recent.map(t => t.accuracy).filter((x): x is number => x !== null));
  const att = mean(recent.map(t => t.attempt).filter((x): x is number => x !== null));
  if (acc !== null && att !== null) {
    if (acc < 65 && att > 70) {
      out.push({
        id: 'overattempt', tone: 'warn', priority: 74,
        title: `You attempt ${fmt(att)}% but get ${fmt(acc)}% right.`,
        body: 'Negative marking is eating you. Attempt less, hit more.',
      });
    } else if (acc >= 80 && att < 65) {
      out.push({
        id: 'underattempt', tone: 'info', priority: 66,
        title: `${fmt(acc)}% accurate, only ${fmt(att)}% attempted.`,
        body: 'You can afford to take more shots.',
      });
    }
  }

  // Repeat offenders and fixes.
  const view = leaks(series, pref);
  const worst = topLeaks(view, 1)[0];
  if (worst && worst.weak >= 2) {
    const heavy = worst.tier === 'critical' || worst.tier === 'high';
    out.push({
      id: 'leak', tone: 'down', priority: heavy ? 84 : 69,
      title: `${leakName(worst)} was weak in ${worst.weak} mocks.`,
      body: heavy ? 'And it’s one of the highest-weightage chapters in the paper. Fix this first.' : 'Same hole, every time. Give it one focused day.',
    });
  }
  const fixed = fixedLeaks(view)[0];
  if (fixed) {
    out.push({
      id: 'fixed', tone: 'up', priority: 58,
      title: `You fixed ${leakName(fixed)}.`,
      body: `Weak before, strong on ${formatDate(fixed.lastDate, today)}. That’s how ranks move.`,
    });
  }

  // Consistency, and the Advanced gap.
  if (s.spread !== null && s.count >= 5 && s.spread >= 9) {
    out.push({
      id: 'spread', tone: 'info', priority: 50,
      title: `Your scores swing ±${fmt(s.spread)}%.`,
      body: 'The exam is one paper. Consistency is what turns a good mock into a good rank.',
    });
  }
  const main = everything.filter(t => t.test.exam === 'mains' && t.test.scope === 'full');
  const adv = everything.filter(t => t.test.exam === 'advanced' && t.test.scope === 'full');
  if (main.length >= 2 && adv.length >= 2) {
    const gap = (mean(main.slice(-4).map(t => t.pct)) as number) - (mean(adv.slice(-4).map(t => t.pct)) as number);
    if (gap >= 12) {
      out.push({
        id: 'advgap', tone: 'info', priority: 48,
        title: `Advanced trails Main by ${fmt(gap)}%.`,
        body: 'Normal — but if Advanced is the goal, start doing multi-concept problems daily.',
      });
    }
  }

  return out.sort((a, b) => b.priority - a.priority);
};

/* ── Error notebook ── */

export interface ErrorPile {
  key: string;
  classId: 11 | 12;
  subject: Subject;
  chapter: string;
  total: number;
  open: number;
  /** Most recent activity (logged or attempted), epoch ms. */
  touched: number;
}

/** Errors grouped by chapter, the most unresolved first. */
export const errorPiles = (errors: ErrorEntry[]): ErrorPile[] => {
  const map = new Map<string, ErrorPile>();
  errors.forEach(e => {
    const key = chapterKey(e);
    const p = map.get(key) ?? { key, classId: e.classId, subject: e.subject, chapter: e.chapter, total: 0, open: 0, touched: 0 };
    p.total += 1;
    if (!isCleared(e)) p.open += 1;
    p.touched = Math.max(p.touched, e.lastAttemptAt ?? 0, e.createdAt);
    map.set(key, p);
  });
  return Array.from(map.values()).sort((a, b) => b.open - a.open || b.touched - a.touched);
};

/**
 * The order a practice run asks in: never-attempted and recently-wrong first,
 * cleared last, shuffled within each band so a re-run is not a memory test of
 * the sequence.
 */
export const practiceOrder = (errors: ErrorEntry[], rand: () => number = Math.random): ErrorEntry[] => {
  const band = (e: ErrorEntry) => (isCleared(e) ? 3 : e.lastResult === 'wrong' ? 0 : e.attempts === 0 ? 1 : 2);
  return errors
    .map(e => ({ e, b: band(e), r: rand() }))
    .sort((a, b) => a.b - b.b || a.r - b.r)
    .map(x => x.e);
};
