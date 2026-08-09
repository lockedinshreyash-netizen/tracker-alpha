/**
 * Single entry point for the content layer. UI code imports from here and
 * never reaches into a per-exam weightage file directly.
 */

import { ExamPreference, Subject } from '../types';
import { ChapterWeight, WeightTier } from './types';
import { JEE_WEIGHTAGE } from './weightageJEE';
import { NEET_WEIGHTAGE } from './weightageNEET';

export * from './types';
export { JEE_WEIGHTAGE } from './weightageJEE';
export { NEET_WEIGHTAGE } from './weightageNEET';

export const getWeight = (
  exam: ExamPreference,
  classId: 11 | 12,
  subject: Subject,
  chapter: string,
): ChapterWeight | undefined =>
  (exam === 'NEET' ? NEET_WEIGHTAGE : JEE_WEIGHTAGE).find(
    (w) => w.classId === classId && w.subject === subject && w.chapter === chapter,
  );

/**
 * Blunt, on-voice labels. The tier thresholds behind these differ per exam
 * (NEET critical >= 7%, JEE >= 4%) because the sections are sized differently —
 * the label is comparable across exams even though the number is not.
 */
export const TIER_LABELS: Record<WeightTier, string> = {
  critical: 'MAX DAMAGE',
  high: 'HIGH YIELD',
  medium: 'MID',
  low: 'LOW YIELD',
};

export const TIER_ORDER: Record<WeightTier, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

export const TIER_STYLES: Record<WeightTier, { chip: string; bar: string }> = {
  critical: { chip: 'border-[#E10600]/60 text-[#E10600] bg-[#E10600]/10', bar: 'bg-[#E10600]' },
  high:     { chip: 'border-orange-500/50 text-orange-400 bg-orange-500/10', bar: 'bg-orange-500' },
  medium:   { chip: 'border-zinc-600/50 text-zinc-400 bg-zinc-500/5', bar: 'bg-zinc-500' },
  low:      { chip: 'border-zinc-700/50 text-zinc-600 bg-transparent', bar: 'bg-zinc-700' },
};

/**
 * Whether a percentage may be shown to a student as a number.
 *
 * Low-confidence rows are assumptions or single-source figures — see
 * SOURCES.md. Their tier is still useful as a rough signal, but printing
 * "2.0% of the paper" next to a chapter a student might then drop is a claim
 * the data cannot support.
 */
export const canShowPercent = (w: ChapterWeight | undefined): boolean =>
  !!w && w.confidence !== 'low';
