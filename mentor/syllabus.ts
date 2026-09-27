/* ── The syllabus, as the Mentor sees it ──
   Both classes, always. The existing coach (today/recommend.ts) looks only at
   `currentClass`, which is right for "what next today" and wrong for "how much
   is left": JEE and NEET examine Class 11 and Class 12 together.

   That creates the single likeliest way for the Mentor to be confidently
   wrong — a Class 12 student who never marked their Class 11 chapters looks as
   if they have all of Class 11 still to do. So `syllabusFlags` names that case
   and the roadmap refuses to pretend it is fine. */

import { AppState, ChapterProgress, ExamPreference, Subject, SyllabusStatus } from '../types';
import { getChaptersFor, getCoreSubjects } from '../constants';
import { chapterEffort, RANGE_HIGH, RANGE_LOW } from '../content/effort';
import { WeightTier } from '../content/types';
import { topicsForChapter } from '../content/topics';

export const chapterKey = (classId: 11 | 12, subject: Subject, chapter: string): string =>
  `${classId}|${subject}|${chapter}`;

/* An in-progress chapter has no recorded fraction. Half is the assumption, and
   every card that uses it says so. */
export const IN_PROGRESS_REMAINING = 0.5;

export interface SyllabusRow {
  key: string;
  classId: 11 | 12;
  subject: Subject;
  chapter: string;
  /** Position in the catalogue within its class and subject — NCERT order. */
  order: number;
  status: SyllabusStatus;
  tier: WeightTier | null;
  foundational: boolean;
  learnHours: number;
  reviseHours: number;
  /** Mid estimate of what is left, before personal calibration. */
  remainingHours: number;
  completedAt?: string;
  lastRevisedAt?: string;
  /** Topics the chapter test flagged as a gap or a guess. */
  masteryGaps: number;
}

const remainingFor = (status: SyllabusStatus, learn: number, revise: number): number => {
  switch (status) {
    case 'not_started': return learn;
    case 'in_progress': return learn * IN_PROGRESS_REMAINING;
    case 'revision_pending': return revise;
    case 'completed': return 0;
  }
};

export const syllabusRows = (state: AppState): SyllabusRow[] => {
  const exam: ExamPreference = state.examPreference || 'JEE';
  const byKey = new Map<string, ChapterProgress>();
  for (const p of state.progress) byKey.set(chapterKey(p.classId, p.subject, p.chapter), p);

  const rows: SyllabusRow[] = [];
  for (const classId of [11, 12] as const) {
    for (const subject of getCoreSubjects(exam)) {
      getChaptersFor(exam, classId, subject).forEach((chapter, order) => {
        const key = chapterKey(classId, subject, chapter);
        const p = byKey.get(key);
        const status = p?.status ?? 'not_started';
        const effort = chapterEffort(exam, classId, subject, chapter);
        const masteryGaps = topicsForChapter(classId, subject, chapter)
          .filter(t => {
            const r = state.topicMastery?.[t.id]?.result;
            return r === 'gap' || r === 'shaky';
          }).length;
        rows.push({
          key, classId, subject, chapter, order, status,
          tier: effort.tier,
          foundational: effort.foundational,
          learnHours: effort.learn,
          reviseHours: effort.revise,
          remainingHours: remainingFor(status, effort.learn, effort.revise),
          completedAt: p?.completedAt,
          lastRevisedAt: p?.lastRevisedAt,
          masteryGaps,
        });
      });
    }
  }
  return rows;
};

export const isDone = (status: SyllabusStatus): boolean =>
  status === 'completed' || status === 'revision_pending';

/* ── Personal calibration ──
   Once the student has finished a few chapters with sessions tagged to them,
   their own hours per chapter say more about their pace than the effort model
   does. Clamped hard, because three chapters is a small sample and a student
   who rushed three easy ones must not be told the syllabus is a fortnight. */
const MIN_CALIBRATION_CHAPTERS = 3;
const MIN_TAGGED_HOURS = 2;

export interface PersonalFactor {
  factor: number;
  /** How many chapters the factor is based on. 0 means uncalibrated. */
  basis: number;
}

export const personalFactor = (state: AppState, rows: SyllabusRow[]): PersonalFactor => {
  const hoursByChapter = new Map<string, number>();
  for (const l of state.logs) {
    if (!l.chapter) continue;
    hoursByChapter.set(`${l.subject}|${l.chapter}`, (hoursByChapter.get(`${l.subject}|${l.chapter}`) || 0) + l.hours);
  }
  let logged = 0;
  let modelled = 0;
  let basis = 0;
  for (const r of rows) {
    if (!isDone(r.status)) continue;
    const h = hoursByChapter.get(`${r.subject}|${r.chapter}`) || 0;
    if (h < MIN_TAGGED_HOURS) continue;
    logged += h;
    modelled += r.learnHours;
    basis++;
  }
  if (basis < MIN_CALIBRATION_CHAPTERS || modelled <= 0) return { factor: 1, basis: 0 };
  return { factor: Math.min(1.8, Math.max(0.6, logged / modelled)), basis };
};

export interface HoursRange {
  low: number;
  mid: number;
  high: number;
}

export const rangeOf = (mid: number): HoursRange => ({
  low: Math.round(mid * RANGE_LOW),
  mid: Math.round(mid),
  high: Math.round(mid * RANGE_HIGH),
});

export interface SubjectSummary {
  total: number;
  completed: number;
  revision: number;
  inProgress: number;
  notStarted: number;
  hoursLeft: HoursRange;
}

export interface SyllabusSummary {
  bySubject: Partial<Record<Subject, SubjectSummary>>;
  total: number;
  done: number;
  /** Completed or revision-pending, as a whole percentage of chapters. */
  percentDone: number;
  hoursLeft: HoursRange;
  factor: PersonalFactor;
}

export const summarize = (rows: SyllabusRow[], factor: PersonalFactor): SyllabusSummary => {
  const bySubject: Partial<Record<Subject, SubjectSummary>> = {};
  let totalMid = 0;
  for (const r of rows) {
    const s = bySubject[r.subject] ?? (bySubject[r.subject] = {
      total: 0, completed: 0, revision: 0, inProgress: 0, notStarted: 0, hoursLeft: { low: 0, mid: 0, high: 0 },
    });
    s.total++;
    if (r.status === 'completed') s.completed++;
    else if (r.status === 'revision_pending') s.revision++;
    else if (r.status === 'in_progress') s.inProgress++;
    else s.notStarted++;
    s.hoursLeft.mid += r.remainingHours * factor.factor;
    totalMid += r.remainingHours * factor.factor;
  }
  for (const s of Object.values(bySubject)) if (s) s.hoursLeft = rangeOf(s.hoursLeft.mid);
  const done = rows.filter(r => isDone(r.status)).length;
  return {
    bySubject,
    total: rows.length,
    done,
    percentDone: rows.length ? Math.round((done / rows.length) * 100) : 0,
    hoursLeft: rangeOf(totalMid),
    factor,
  };
};

export type SyllabusFlag = 'nothing_marked' | 'class11_unmarked';

/**
 * Reasons the syllabus record probably does not reflect reality. A roadmap
 * built over either of these would be precise and wrong.
 */
export const syllabusFlags = (state: AppState, rows: SyllabusRow[]): SyllabusFlag[] => {
  const touched = (classId: 11 | 12) => rows.some(r => r.classId === classId && r.status !== 'not_started');
  if (!touched(11) && !touched(12)) return ['nothing_marked'];
  if (state.currentClass === 12 && !touched(11)) return ['class11_unmarked'];
  return [];
};

export const FLAG_TEXT: Record<SyllabusFlag, string> = {
  nothing_marked: 'No chapter is marked as started or done, so every chapter counts as untouched.',
  class11_unmarked: 'You are in Class 12 but no Class 11 chapter is marked — the app counts all of Class 11 as still to do.',
};

/** Does this chapter exist in the student's syllabus? Model-supplied names are checked here. */
export const findRow = (rows: SyllabusRow[], classId: number, subject: string, chapter: string): SyllabusRow | undefined =>
  rows.find(r => r.classId === classId && r.subject === subject && r.chapter.toLowerCase() === chapter.trim().toLowerCase());
