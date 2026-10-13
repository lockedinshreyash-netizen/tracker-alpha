/* ── What onboarding builds ──
   Pure and React-free, like schedule/schedule.ts. The answers a student gives
   become real things the app already understands: repeating Plan blocks
   (TemplateRule), a daily goal, a timer mode, and the one chapter to start
   with. Nothing here is decoration — the plan revealed at the end is the plan
   on the Plan tab the next morning.

   Times are DayMinute (minutes since 04:00 IST, schedule/schedule.ts), so a
   sleep at 23:30 is minute 1170 and needs no special case; only a block that
   would cross 04:00 is split, exactly as the Plan tab clamps it. */

import type { ChapterProgress, DayMinute, ExamPreference, Subject, TemplateRule, TimerMode } from '../types';
import { getChaptersFor, getCoreSubjects, JEE_2027_DATE, NEET_2027_DATE } from '../constants';
import { getWeight, TIER_LABELS, TIER_ORDER, type WeightTier } from '../content';
import { DAY_MINUTES } from '../schedule/schedule';
import { getDaysRemaining } from '../utils';

export interface Busy {
  on: boolean;
  start: DayMinute;
  end: DayMinute;
}

export interface Answers {
  exam: ExamPreference;
  cls: 11 | 12;
  wake: DayMinute;
  sleep: DayMinute;
  school: Busy;
  coaching: Busy;
  hours: number;
  style: TimerMode;
}

/** A TemplateRule before App gives it an id and a start date. */
export type RuleDraft = Omit<TemplateRule, 'id' | 'from' | 'until'>;

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
/* School and coaching run Monday to Saturday in India. Sunday keeps the
   study blocks and gains the free hours. */
export const WORK_DAYS = [1, 2, 3, 4, 5, 6];

/** 04:00 axis ↔ wall clock. 6:30 AM is minute 150. */
export const atClock = (h: number, m = 0): DayMinute => ((h * 60 + m - 240) % DAY_MINUTES + DAY_MINUTES) % DAY_MINUTES;

export const DEFAULT_ANSWERS = (exam: ExamPreference, cls: 11 | 12, hours: number, style: TimerMode): Answers => ({
  exam,
  cls,
  wake: atClock(6, 30),
  sleep: atClock(23, 0),
  school: { on: true, start: atClock(8, 0), end: atClock(14, 0) },
  coaching: { on: false, start: atClock(16, 0), end: atClock(19, 0) },
  hours: Math.min(14, Math.max(1, Math.round(hours))),
  style,
});

export const examLabel = (exam: ExamPreference): string => (exam === 'NEET' ? 'NEET' : 'JEE Main');
export const examDate = (exam: ExamPreference): Date => (exam === 'NEET' ? NEET_2027_DATE : JEE_2027_DATE);
export const daysLeft = (exam: ExamPreference): number => Math.max(0, getDaysRemaining(examDate(exam)));

/* ── Time ── */

/** After waking, a morning before the first block; before sleep, a wind-down. */
const MORNING = 45;
const WIND_DOWN = 30;
/** Getting home from school or coaching. */
const AFTER_BUSY = 30;
const GAP = 15;

/** Busy windows that apply on a school day, sorted, inside the waking day. */
const busyOf = (a: Answers): Array<[number, number]> =>
  [a.school, a.coaching]
    .filter(b => b.on && b.end > b.start)
    .map(b => [b.start, b.end] as [number, number])
    .sort((x, y) => x[0] - y[0]);

/** The gaps on a school day where study can go, longest-lived first in time order. */
export const freeWindows = (a: Answers): Array<[number, number]> => {
  const dayStart = a.wake + MORNING;
  const dayEnd = (a.sleep > a.wake ? a.sleep : DAY_MINUTES) - WIND_DOWN;
  const out: Array<[number, number]> = [];
  let cursor = dayStart;
  for (const [s, e] of busyOf(a)) {
    if (s > cursor) out.push([cursor, Math.min(s, dayEnd)]);
    cursor = Math.max(cursor, e + AFTER_BUSY);
  }
  if (dayEnd > cursor) out.push([cursor, dayEnd]);
  return out.filter(([s, e]) => e - s >= 30);
};

export const freeMinutes = (a: Answers): number => freeWindows(a).reduce((n, [s, e]) => n + (e - s), 0);

/** Waking minutes on a school day, for the day bar. */
export const sleepMinutes = (a: Answers): number =>
  a.sleep > a.wake ? DAY_MINUTES - a.sleep + a.wake : a.wake - a.sleep;

export const formatHours = (mins: number): string => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

/* ── The chapter to start with ── */

export interface StartHere {
  subject: Subject;
  chapter: string;
  tier: WeightTier;
  label: string; // TIER_LABELS, on-voice ("MAX DAMAGE")
}

/**
 * The heaviest chapter in this class the student has not finished. Tier
 * first, then its share of the paper. Only chapters with weightage data are
 * candidates: "start here" is a claim, and a chapter we know nothing about
 * cannot back it.
 */
export const startHere = (exam: ExamPreference, cls: 11 | 12, progress: ChapterProgress[]): StartHere | null => {
  const done = new Set(progress.filter(p => p.classId === cls && p.status === 'completed').map(p => `${p.subject}|${p.chapter}`));
  let best: (StartHere & { percent: number }) | null = null;
  for (const subject of getCoreSubjects(exam)) {
    for (const chapter of getChaptersFor(exam, cls, subject)) {
      if (done.has(`${subject}|${chapter}`)) continue;
      const w = getWeight(exam, cls, subject, chapter);
      if (!w) continue;
      const better = !best
        || TIER_ORDER[w.tier] < TIER_ORDER[best.tier]
        || (TIER_ORDER[w.tier] === TIER_ORDER[best.tier] && w.percent > best.percent);
      if (better) best = { subject, chapter, tier: w.tier, label: TIER_LABELS[w.tier], percent: w.percent };
    }
  }
  if (!best) return null;
  const { percent: _p, ...rest } = best;
  return rest;
};

/** Chapters in the syllabus the student will see, both classes. */
export const chapterCount = (exam: ExamPreference): number =>
  getCoreSubjects(exam).reduce((n, s) => n + getChaptersFor(exam, 11, s).length + getChaptersFor(exam, 12, s).length, 0);

/* ── The plan ── */

export interface Plan {
  rules: RuleDraft[];
  /** Study minutes the plan actually fits on a school day. */
  studyMins: number;
  /** The goal asked for, in minutes. */
  goalMins: number;
}

/**
 * Repeating blocks for the day described: sleep, school and coaching, and
 * study in the free windows, each block a subject in turn starting with the
 * start-here chapter's. A stopwatch student gets 90-minute blocks; a Pomodoro
 * student gets hour blocks that hold two 25-minute sprints with their break.
 *
 * Fits what it can and says so (studyMins < goalMins), never squeezing study
 * into the wind-down or the walk home.
 */
export const buildPlan = (a: Answers, first: StartHere | null): Plan => {
  const rules: RuleDraft[] = [];

  // Sleep, split at 04:00 the way the Plan tab clamps a block.
  if (a.sleep > a.wake) {
    if (a.sleep < DAY_MINUTES) rules.push({ kind: 'sleep', start: a.sleep, durationMins: DAY_MINUTES - a.sleep, days: ALL_DAYS });
    if (a.wake > 0) rules.push({ kind: 'sleep', start: 0, durationMins: a.wake, days: ALL_DAYS });
  } else if (a.wake > a.sleep) {
    rules.push({ kind: 'sleep', start: a.sleep, durationMins: a.wake - a.sleep, days: ALL_DAYS });
  }
  if (a.school.on && a.school.end > a.school.start) {
    rules.push({ kind: 'class', label: 'School', start: a.school.start, durationMins: a.school.end - a.school.start, days: WORK_DAYS });
  }
  if (a.coaching.on && a.coaching.end > a.coaching.start) {
    rules.push({ kind: 'class', label: 'Coaching', start: a.coaching.start, durationMins: a.coaching.end - a.coaching.start, days: WORK_DAYS });
  }

  const subjects = getCoreSubjects(a.exam);
  const order = first ? [first.subject, ...subjects.filter(s => s !== first.subject)] : subjects;
  const block = a.style === 'pomodoro' ? 60 : 90;
  const goalMins = a.hours * 60;
  let left = goalMins;
  let k = 0;
  const study: RuleDraft[] = [];
  for (const [ws, we] of freeWindows(a)) {
    let t = ws;
    while (left >= 30 && we - t >= 30) {
      const len = Math.min(block, left, we - t);
      if (len < 30) break;
      study.push({ kind: 'study', subject: order[k % order.length], start: t, durationMins: len, days: ALL_DAYS });
      left -= len;
      t += len + GAP;
      k++;
    }
    if (left < 30) break;
  }

  /* The chapter to start with gets the first full-length block, not a
     45-minute sliver before school, and that block becomes its subject. */
  if (first && study.length) {
    const host = study.find(b => b.durationMins >= block) ?? study.reduce((x, y) => (y.durationMins > x.durationMins ? y : x));
    const was = host.subject;
    const swap = study.find(b => b !== host && b.subject === first.subject);
    if (swap && was) swap.subject = was;
    host.subject = first.subject;
    host.chapter = first.chapter;
  }
  rules.push(...study);

  return { rules, studyMins: goalMins - Math.max(0, left), goalMins };
};
