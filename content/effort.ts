/**
 * How long a chapter takes — an ESTIMATE, and every consumer must say so.
 *
 * There is no sourced dataset for this. Unlike weightage (content/SOURCES.md),
 * nobody publishes "hours per chapter" in a form that survives the same
 * independence check, so this is a model, not a measurement:
 *
 *   learn hours = BASE_LEARN_HOURS[tier] × SUBJECT_FACTOR[subject]
 *   revise hours = learn hours × REVISE_SHARE
 *
 * "Learn" means a first pass that is exam-usable: theory plus enough practice
 * to attempt PYQs, for a student meeting the chapter properly for the first
 * time. The tier is the proxy for size because heavier-examined chapters are,
 * overwhelmingly, the bigger ones — a weak proxy, which is why the Mentor
 * always shows a range and calibrates against the student's own logged hours
 * once there is enough of them (mentor/syllabus.ts, `personalFactor`).
 *
 * Roughly 11h × ~76 JEE chapters ≈ 850h for a full first pass — in line with
 * the commonly quoted ~2,000–3,000 total hours of two-year JEE preparation
 * once practice and mocks are added on top. Change a number here → bump
 * EFFORT_VERSION, which every stored roadmap records.
 */

import { ExamPreference, Subject } from '../types';
import { getWeight } from './index';
import { WeightTier } from './types';

export const EFFORT_VERSION = 1;

const BASE_LEARN_HOURS: Record<WeightTier, number> = {
  critical: 18,
  high: 14,
  medium: 11,
  low: 8,
};

/** A chapter with no weightage row is treated as medium-sized. */
const UNKNOWN_TIER_HOURS = 11;

const SUBJECT_FACTOR: Record<Subject, number> = {
  Maths: 1.15,
  Physics: 1.1,
  Chemistry: 0.9,
  Biology: 0.85,
  General: 1,
};

/** A full revision pass as a share of the first pass. */
export const REVISE_SHARE = 0.3;

/** The range every estimate is shown with — never a single number. */
export const RANGE_LOW = 0.75;
export const RANGE_HIGH = 1.35;

export interface ChapterEffort {
  learn: number;
  revise: number;
  tier: WeightTier | null;
  foundational: boolean;
}

export const chapterEffort = (
  exam: ExamPreference,
  classId: 11 | 12,
  subject: Subject,
  chapter: string,
): ChapterEffort => {
  const w = getWeight(exam, classId, subject, chapter);
  const base = w ? BASE_LEARN_HOURS[w.tier] : UNKNOWN_TIER_HOURS;
  const learn = Math.round(base * SUBJECT_FACTOR[subject] * 2) / 2;
  return {
    learn,
    revise: Math.round(learn * REVISE_SHARE * 2) / 2,
    tier: w?.tier ?? null,
    foundational: !!w?.foundational,
  };
};
