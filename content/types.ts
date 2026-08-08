/**
 * Content layer — static, ships in the bundle, never stored in AppState.
 *
 * Nothing here is user data. It is versioned reference material about the exam
 * itself, so it must never enter the Supabase `state` blob or localStorage:
 * progress references content by id, content never references progress.
 */

export type ContentSubject = 'Physics' | 'Chemistry' | 'Maths' | 'Biology';

/**
 * How much of the paper a chapter is actually worth.
 *
 * Thresholds are on percentage of the subject's marks:
 *   critical >= 4.0 | high 3.0-3.99 | medium 2.0-2.99 | low < 2.0
 */
export type WeightTier = 'critical' | 'high' | 'medium' | 'low';

/**
 * How much to trust the number, given how it was sourced.
 *
 * `high`   — independent sources agree, and the chapter maps 1:1 onto ours.
 * `medium` — sources agree, but several of their chapters had to be merged
 *            into one of ours (or split), so the figure is a sum, not a
 *            measurement.
 * `low`    — thin or absent source data; the tier is inference, not evidence.
 */
export type Confidence = 'high' | 'medium' | 'low';

/**
 * Which half of NEET Biology a chapter is examined in.
 *
 * NEET splits Biology into Botany and Zoology at 45 questions each, and the
 * split does not follow Class 11/12 — Molecular Basis of Inheritance is a
 * Class 12 chapter examined in Botany. Percentages are of the chapter's own
 * half, so a Botany figure and a Zoology figure are directly comparable.
 */
export type BioStream = 'botany' | 'zoology';

export interface ChapterWeight {
  /** Chapter name exactly as it appears in SYLLABUS_DATA, so this joins today
      without waiting on the stable-id migration. */
  chapter: string;
  classId: 11 | 12;
  subject: ContentSubject;
  stream?: BioStream;

  /** Percent of that subject's marks. Indicative — see `confidence`. Ranking is
      far more reliable than the absolute value; prefer `tier` in the UI.
      Tier thresholds differ per exam: see each weightage file. */
  percent: number;
  tier: WeightTier;
  confidence: Confidence;

  /**
   * The chapter is load-bearing for other chapters regardless of how rarely it
   * is examined directly.
   *
   * This exists because weightage alone is actively dangerous advice. Organic
   * Basic Principles is ~1.6% of the paper and every organic question depends
   * on it; Laws of Motion is ~2% and all of mechanics rests on it. A UI that
   * sorts on weightage and says "skip the bottom" would tell students to skip
   * the foundations. Never let `tier` alone drive a deprioritise/skip hint.
   */
  foundational: boolean;

  /** Source chapters that were summed to produce `percent`, when our chapter is
      coarser than the source's. Empty when the mapping was 1:1. */
  mergedFrom?: string[];

  /** Why the confidence isn't `high`, or anything a student would be misled by. */
  note?: string;
}

/** Identifies a body of source data, so agreement between two rows can be
    checked for independence rather than counted naively. See SOURCES.md. */
export interface SourceCluster {
  id: string;
  /** Sites observed publishing this same dataset. */
  sites: string[];
  /** What the cluster claims its numbers are derived from. */
  basis: string;
  granularity: 'chapter' | 'unit';
  /** Whether the cluster's own percentages sum to ~100 per subject. */
  sumsTo100: Partial<Record<ContentSubject, boolean>>;
}
