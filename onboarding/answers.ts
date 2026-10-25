/* ── What onboarding asks, and what it works out ──
   Pure and React-free. The answers become things the app already
   understands: a stream, the exams and the year, a class, a daily goal, a
   timer mode, and the one chapter to start with. Onboarding no longer builds a Plan: a timetable
   guessed from four questions alternated subjects the way no real student
   studies, so the opening shows the Plan tab instead and the student builds
   their own day there. */

import type { ChapterProgress, ExamPreference, Subject, TimerMode } from '../types';
import { getChaptersFor, getCoreSubjects } from '../constants';
import { defaultExam, defaultYear, examById, examDateFor, streamOf, targetExams, type ExamId, type ExamTarget } from '../content/exams';
import { getWeight, TIER_LABELS, TIER_ORDER, type WeightTier } from '../content';
import { getDaysRemaining } from '../utils';

export interface Answers {
  /** The stream, as the app stores it: 'JEE' is PCM, 'NEET' is PCB. */
  exam: ExamPreference;
  /** The exams picked, main exam first (content/exams.ts). */
  exams: ExamId[];
  /** The year they write them. Follows the class until the student picks one. */
  year: number;
  yearPicked: boolean;
  cls: 11 | 12;
  hours: number;
  style: TimerMode;
}

export const DEFAULT_ANSWERS = (exam: ExamPreference, cls: 11 | 12, hours: number, style: TimerMode, target?: ExamTarget): Answers => ({
  exam,
  exams: target ? targetExams(target) : [defaultExam(streamOf(exam))],
  year: target?.year ?? defaultYear(cls),
  yearPicked: false,
  cls,
  hours: Math.min(14, Math.max(1, Math.round(hours))),
  style,
});

export const examLabel = (id: ExamId): string => examById(id).name;
export const examDate = (id: ExamId, year: number): Date => examDateFor(id, year).date;
export const daysLeft = (id: ExamId, year: number): number => Math.max(0, getDaysRemaining(examDate(id, year)));

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
