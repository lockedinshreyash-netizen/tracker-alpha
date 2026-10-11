/* ── What the public syllabus pages say, derived from the app's own data ──
   The chapter lists are `getChaptersFor` (constants.tsx) and the weightage is
   content/weightage*.ts — the same data the Syllabus tab and the coach use, so
   the website can never contradict the app.

   The rules from content/SOURCES.md apply here with more force, because these
   pages are public and quotable:
   - Rank order is reliable, percentages are not. Pages show TIERS, never a
     percentage.
   - Low-confidence rows are marked "estimate".
   - `foundational` chapters are never presented as skippable.
   - Research notes stay internal. Only notes that read as study advice are
     published (`publicNote`). */

import { getChaptersFor } from '../constants';
import { getWeight, type WeightTier } from '../content';
import { topicsForChapter } from '../content/topics';
import type { Subject } from '../types';

export const YEAR = 2027;
export type SiteExam = 'JEE' | 'NEET';
export type SiteSubject = 'Physics' | 'Chemistry' | 'Maths' | 'Biology';

export const SUBJECTS: Record<SiteExam, SiteSubject[]> = {
  JEE: ['Physics', 'Chemistry', 'Maths'],
  NEET: ['Physics', 'Chemistry', 'Biology'],
};

export const SUBJECT_DOT: Record<SiteSubject, string> = {
  Physics: '#4A90E2',
  Chemistry: '#34C77B',
  Maths: '#9B59E2',
  Biology: '#E29B29',
};

/* The paper as the app already models it (mocks/model.ts, cbt/generate.ts). */
export const EXAM_INFO: Record<SiteExam, {
  name: string;
  slug: string;
  weightageSlug: string;
  body: string;
  officialSite: string;
  syllabusFrom: string;
  pattern: Array<[string, string]>;
  perSubject: Record<string, string>;
  pyqBasis: string;
}> = {
  JEE: {
    name: 'JEE Main',
    slug: 'jee-main-syllabus',
    weightageSlug: 'jee-main-chapter-weightage',
    body: 'NTA',
    officialSite: 'jeemain.nta.nic.in',
    syllabusFrom: 'NTA',
    pattern: [
      ['Questions', '75 (25 per subject)'],
      ['Per subject', '20 MCQs + 5 numerical questions'],
      ['Total marks', '300 (100 per subject)'],
      ['Marking', '+4 for a correct answer, −1 for a wrong one, 0 if left blank'],
      ['Duration', '3 hours'],
      ['Subjects', 'Physics, Chemistry, Maths'],
    ],
    perSubject: {
      Physics: '25 questions · 100 marks',
      Chemistry: '25 questions · 100 marks',
      Maths: '25 questions · 100 marks',
    },
    pyqBasis: 'published analyses of past JEE Main papers from 2020 to 2025',
  },
  NEET: {
    name: 'NEET UG',
    slug: 'neet-syllabus',
    weightageSlug: 'neet-chapter-weightage',
    body: 'NTA',
    officialSite: 'neet.nta.nic.in',
    syllabusFrom: 'NMC',
    pattern: [
      ['Questions', '180, all compulsory'],
      ['Sections', 'Physics 45 · Chemistry 45 · Botany 45 · Zoology 45'],
      ['Total marks', '720'],
      ['Marking', '+4 for a correct answer, −1 for a wrong one, 0 if left blank'],
      ['Duration', '3 hours'],
      ['Subjects', 'Physics, Chemistry, Biology'],
    ],
    perSubject: {
      Physics: '45 questions · 180 marks',
      Chemistry: '45 questions · 180 marks',
      Biology: '90 questions · 360 marks',
    },
    pyqBasis: 'published analyses of NEET papers from 2020 to 2024, including one that counted more than 250 questions per subject',
  },
};

export const TIER_LABEL: Record<WeightTier, string> = {
  critical: 'Very high',
  high: 'High',
  medium: 'Medium',
  low: 'Lower',
};
export const TIER_ORDER: WeightTier[] = ['critical', 'high', 'medium', 'low'];

export interface ChapterRow {
  chapter: string;
  classId: 11 | 12;
  subject: SiteSubject;
  tier: WeightTier;
  /** Thin or single-source data: the tier is a judgement, not a count. */
  estimate: boolean;
  foundational: boolean;
  stream?: 'botany' | 'zoology';
  note?: string;
  topics: string[];
  /** For ORDERING only — rank is reliable, the number is not. Never render it. */
  rank: number;
}

/* Research notes (source names, percentages, "never present as...") are for
   us. Anything that reads like that stays off the public page. */
const INTERNAL = /source|dataset|neet-a|conflict|never|must|figure|our chapter|reported|assumption|do not|%|\d{4}/i;
export const publicNote = (note?: string): string | undefined =>
  note && !INTERNAL.test(note) ? note : undefined;

export const chaptersFor = (exam: SiteExam, subject: SiteSubject): ChapterRow[] =>
  ([11, 12] as const).flatMap(classId =>
    getChaptersFor(exam, classId, subject as Subject).map((chapter): ChapterRow => {
      const w = getWeight(exam, classId, subject as Subject, chapter);
      return {
        chapter,
        classId,
        subject,
        tier: w?.tier ?? 'medium',
        estimate: !w || w.confidence === 'low',
        foundational: !!w?.foundational,
        stream: w?.stream,
        note: publicNote(w?.note),
        topics: topicsForChapter(classId, subject, chapter).map(t => t.name),
        rank: w?.percent ?? 0,
      };
    }),
  );

/** Each tier heaviest-first. Across subjects this is only meaningful for NEET (equal sections). */
export const byTier = (rows: ChapterRow[]): Record<WeightTier, ChapterRow[]> => {
  const tier = (t: WeightTier) => rows.filter(r => r.tier === t).sort((a, b) => b.rank - a.rank);
  return { critical: tier('critical'), high: tier('high'), medium: tier('medium'), low: tier('low') };
};

/** The first matching row from each subject, in subject order — for examples that should not all come from Physics. */
export const onePerSubject = (rows: ChapterRow[], subjects: SiteSubject[], test: (r: ChapterRow) => boolean): ChapterRow[] =>
  subjects.map(s => rows.find(r => r.subject === s && test(r))).filter((r): r is ChapterRow => !!r);

/** "A, B and C" */
export const listOf = (items: string[]): string =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export const subjectSlug = (s: SiteSubject) => s.toLowerCase();

/** Where a page's "track this" button goes: straight into the app's Syllabus tab, exam preselected. */
export const appLink = (exam: SiteExam) => `/?open=syllabus&exam=${exam}`;
