/* ── Am I on track? ──
   Deterministic, and deliberately modest about it. The output separates three
   kinds of statement and the card renders them under three labels, so the
   distinction never depends on a model remembering to make it:

     facts        — read straight off the student's record
     estimates    — derived from the effort model, always as a range
     assumptions  — choices this calculation made that the student can dispute

   No single finish date is ever produced. A range whose width is honest is
   worth more than a precise date that is wrong. */

import { AppState } from '../types';
import { addDays } from '../utils';
import { resolveExamDate } from '../constants';
import { normalizeMentor } from '../state';
import { countDays, daysBetween, formatDay } from './dates';
import { recentStudy } from './capacity';
import { HoursRange, IN_PROGRESS_REMAINING, personalFactor, summarize, syllabusFlags, syllabusRows, FLAG_TEXT, SyllabusRow } from './syllabus';

export type PaceVerdict = 'ahead' | 'on_track' | 'behind' | 'off_track' | 'no_history' | 'past';

export const VERDICT_LABEL: Record<PaceVerdict, string> = {
  ahead: 'AHEAD',
  on_track: 'ON TRACK',
  behind: 'BEHIND',
  off_track: 'OFF TRACK',
  no_history: 'NOT ENOUGH DATA',
  past: 'DATE HAS PASSED',
};

/* When the target is the exam itself, the last stretch belongs to revision and
   mocks, not first passes. 15%, never more than three weeks. */
const EXAM_RESERVE_SHARE = 0.15;
const EXAM_RESERVE_MAX_DAYS = 21;

export interface PaceOptions {
  /** Hours per study day that would finish the mid estimate on time. */
  hoursPerDayNeeded: number;
  /** Mid-estimate finish date at the current pace, or null with no pace. */
  finishAtCurrentPace: string | null;
  /** Lowest-yield chapters not yet started — never foundational — that cover the gap. */
  dropCandidates: { classId: 11 | 12; subject: string; chapter: string; hours: number }[];
}

export interface Pace {
  verdict: PaceVerdict;
  target: { date: string; kind: 'syllabus' | 'exam'; isDefault: boolean };
  percentDone: number;
  remaining: HoursRange;
  studyDaysLeft: number;
  reserveDays: number;
  /** Hours per study day required to finish [low, mid, high]. */
  required: HoursRange;
  /** Actual recent hours per study day (calendar-averaged over 14 days, per study day of the week pattern). */
  recentPerDay: number;
  projectedFinish: { early: string; late: string } | null;
  options: PaceOptions | null;
  facts: string[];
  estimates: string[];
  assumptions: string[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export const computePace = (state: AppState, today: string, targetDate?: string): Pace => {
  const mentor = normalizeMentor(state.mentor);
  const exam = state.examPreference || 'JEE';
  const examDate = resolveExamDate(exam, state.examDates);

  const target = targetDate
    ? { date: targetDate, kind: 'syllabus' as const, isDefault: false }
    : mentor.prefs.syllabusBy
      ? { date: mentor.prefs.syllabusBy, kind: 'syllabus' as const, isDefault: false }
      : { date: examDate.date, kind: 'exam' as const, isDefault: examDate.isDefault };

  const rows = syllabusRows(state);
  const factor = personalFactor(state, rows);
  const summary = summarize(rows, factor);
  const flags = syllabusFlags(state, rows);
  const restDays = mentor.prefs.restDays;

  /* Study days from today up to the day before the target. */
  const lastDay = addDays(target.date, -1);
  const span = countDays(today, lastDay, restDays);
  const reserveDays = target.kind === 'exam'
    ? Math.min(EXAM_RESERVE_MAX_DAYS, Math.round(span.studyDays * EXAM_RESERVE_SHARE))
    : 0;
  const studyDaysLeft = Math.max(0, span.studyDays - reserveDays);

  const recent = recentStudy(state.logs, today);
  /* Throughput per study day: the calendar average rescaled to the days the
     student actually intends to study. */
  const studyDaysPerWeek = 7 - restDays.length;
  const recentPerDay = studyDaysPerWeek > 0 ? recent.avgPerDay * (7 / studyDaysPerWeek) : 0;

  const per = (h: number) => (studyDaysLeft > 0 ? round1(h / studyDaysLeft) : Infinity);
  const required: HoursRange = {
    low: per(summary.hoursLeft.low),
    mid: per(summary.hoursLeft.mid),
    high: per(summary.hoursLeft.high),
  };

  const projectDate = (hours: number): string => {
    const studyDaysNeeded = Math.ceil(hours / recentPerDay);
    const calendar = Math.ceil(studyDaysNeeded * (7 / Math.max(1, studyDaysPerWeek)));
    return addDays(today, calendar);
  };

  const hasPace = recent.studyDays >= 3 && recentPerDay > 0;
  const projectedFinish = hasPace && summary.hoursLeft.mid > 0
    ? { early: projectDate(summary.hoursLeft.low), late: projectDate(summary.hoursLeft.high) }
    : null;

  let verdict: PaceVerdict;
  if (daysBetween(today, target.date) <= 0) verdict = 'past';
  else if (!hasPace) verdict = 'no_history';
  else if (summary.hoursLeft.mid === 0) verdict = 'ahead';
  else {
    const ratio = recentPerDay / required.mid;
    verdict = ratio >= 1.1 ? 'ahead' : ratio >= 0.9 ? 'on_track' : ratio >= 0.7 ? 'behind' : 'off_track';
  }

  let options: PaceOptions | null = null;
  if (verdict === 'behind' || verdict === 'off_track' || verdict === 'no_history') {
    const capacityHours = recentPerDay * studyDaysLeft;
    const gap = Math.max(0, summary.hoursLeft.mid - capacityHours);
    const dropCandidates: PaceOptions['dropCandidates'] = [];
    if (gap > 0) {
      const rank = { low: 0, medium: 1, high: 2, critical: 3 } as const;
      const candidates = rows
        .filter((r: SyllabusRow) => r.status === 'not_started' && !r.foundational)
        .sort((a, b) => (a.tier ? rank[a.tier] : 1) - (b.tier ? rank[b.tier] : 1) || b.remainingHours - a.remainingHours);
      let covered = 0;
      for (const r of candidates) {
        if (covered >= gap || dropCandidates.length >= 8) break;
        const hours = Math.round(r.remainingHours * factor.factor);
        dropCandidates.push({ classId: r.classId, subject: r.subject, chapter: r.chapter, hours });
        covered += hours;
      }
    }
    options = {
      hoursPerDayNeeded: required.mid,
      finishAtCurrentPace: hasPace ? projectDate(summary.hoursLeft.mid) : null,
      dropCandidates,
    };
  }

  const facts: string[] = [
    `${summary.done} of ${summary.total} chapters marked done or in revision (${summary.percentDone}%).`,
    `${studyDaysLeft} study days until ${formatDay(target.date)}${reserveDays ? `, after keeping ${reserveDays} for revision and mocks` : ''}.`,
    hasPace
      ? `Last 14 days: ${round1(recent.avgPerDay * 14)}h logged across ${recent.studyDays} days.`
      : `Only ${recent.studyDays} study day${recent.studyDays === 1 ? '' : 's'} logged in the last 14 — too few to measure a pace.`,
  ];

  const estimates: string[] = [
    `About ${summary.hoursLeft.low}–${summary.hoursLeft.high}h of syllabus work left (middle estimate ${summary.hoursLeft.mid}h).`,
    Number.isFinite(required.mid)
      ? `That needs roughly ${required.low}–${required.high}h per study day; you have been averaging ${round1(recentPerDay)}h.`
      : 'There are no study days left before the target.',
  ];
  if (projectedFinish) {
    estimates.push(`At your current pace: somewhere between ${formatDay(projectedFinish.early)} and ${formatDay(projectedFinish.late)}.`);
  }

  const assumptions: string[] = [
    'Hours per chapter come from the app\'s effort model, not your own timings' +
      (factor.basis ? `, adjusted by your pace on ${factor.basis} finished chapters (×${round1(factor.factor)}).` : '.'),
    `An in-progress chapter is counted as ${Math.round(IN_PROGRESS_REMAINING * 100)}% left.`,
    'Every hour you log counts toward the syllabus — practice and mocks included.',
  ];
  if (target.kind === 'exam' && target.isDefault) {
    assumptions.push(`The exam date (${formatDay(target.date)}) is the app's placeholder, not one you set.`);
  }
  for (const f of flags) assumptions.push(FLAG_TEXT[f]);

  return {
    verdict,
    target,
    percentDone: summary.percentDone,
    remaining: summary.hoursLeft,
    studyDaysLeft,
    reserveDays,
    required,
    recentPerDay: round1(recentPerDay),
    projectedFinish,
    options,
    facts,
    estimates,
    assumptions,
  };
};
