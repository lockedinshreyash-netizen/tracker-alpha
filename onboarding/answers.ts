/* ── What onboarding asks, and what it works out ──
   Pure and React-free. The answers become things the app already
   understands: an exam, a class, a daily goal, a timer mode, and the one
   chapter to start with. Onboarding no longer builds a Plan: a timetable
   guessed from four questions alternated subjects the way no real student
   studies, so the opening shows the Plan tab instead and the student builds
   their own day there. */

import type { ChapterProgress, ExamPreference, Subject, TimerMode } from '../types';
import { getChaptersFor, getCoreSubjects, JEE_2027_DATE, NEET_2027_DATE } from '../constants';
import { getWeight, TIER_LABELS, TIER_ORDER, type WeightTier } from '../content';
import { getDaysRemaining } from '../utils';

export interface Answers {
  exam: ExamPreference;
  cls: 11 | 12;
  hours: number;
  style: TimerMode;
}

export const DEFAULT_ANSWERS = (exam: ExamPreference, cls: 11 | 12, hours: number, style: TimerMode): Answers => ({
  exam,
  cls,
  hours: Math.min(14, Math.max(1, Math.round(hours))),
  style,
});

export const examLabel = (exam: ExamPreference): string => (exam === 'NEET' ? 'NEET' : 'JEE Main');
export const examDate = (exam: ExamPreference): Date => (exam === 'NEET' ? NEET_2027_DATE : JEE_2027_DATE);
export const daysLeft = (exam: ExamPreference): number => Math.max(0, getDaysRemaining(examDate(exam)));

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
