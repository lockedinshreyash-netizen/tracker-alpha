/* ── CBT: shapes ──
   The question bank and the papers built from it. None of this is in
   AppState: it lives in the tables of supabase/cbt.sql, and only a finished
   paper's summary (a MockTest and its ErrorEntries) crosses into the synced
   blob. */

import { Subject } from '../types';

export type QKind = 'mcq' | 'numerical';
export type QStatus = 'needs_review' | 'ready' | 'ungraded' | 'rejected';
export type CbtSubject = Exclude<Subject, 'General'>;

/** {option} for an MCQ, {value} for a numerical. */
export type QAnswer = { option: 0 | 1 | 2 | 3 } | { value: number };

export interface BankQuestion {
  id: string;
  sourceId: string;
  number: string | null;
  kind: QKind;
  /** Text with inline LaTeX ($…$, $$…$$) and figure tokens ([[fig:N]]). */
  body: string;
  /** Four, for an MCQ; null for a numerical. Same markup as `body`. */
  options: string[] | null;
  answer: QAnswer | null;
  /** Paths in the private `qbank` bucket. */
  figures: string[];
  subject: CbtSubject;
  classId: 11 | 12 | null;
  chapter: string | null;
  topic: string | null;
  year: number | null;
  shift: string | null;
  difficulty: number | null;
  confidence: number | null;
  status: QStatus;
  textHash: string;
}

export interface BankSource {
  id: string;
  name: string;
  fileHash: string;
  pages: number | null;
  extractor: string | null;
  createdAt: string;
}

/* ── Papers ── */

export type PaperKind = 'full' | 'subject' | 'chapters';

export interface ChapterRef { classId: 11 | 12; subject: CbtSubject; chapter: string }

export type PaperSpec =
  | { kind: 'full' }
  | { kind: 'subject'; subject: CbtSubject }
  | { kind: 'chapters'; chapters: ChapterRef[]; count: number };

export interface Section {
  subject: CbtSubject;
  kind: QKind;
  /** What the blueprint asked for; `ids.length` is what the bank could give. */
  want: number;
  ids: string[];
}

export interface Blueprint {
  exam: 'mains';
  spec: PaperSpec;
  durationMins: number;
  marking: { right: number; wrong: number };
  sections: Section[];
  /** What the generator had to bend to build this paper. Shown before it starts. */
  notes: string[];
}

/** NTA's five palette states. */
export type RespStatus = 'nv' | 'na' | 'ans' | 'mr' | 'amr';

export interface Resp {
  /** The *saved* answer: an option index, or the typed number as a string. */
  a: number | string | null;
  s: RespStatus;
  /** Milliseconds spent on the question, across every visit. */
  t: number;
  /** Visits. */
  v: number;
}

export interface SubjectScore {
  subject: CbtSubject;
  marks: number;
  max: number;
  correct: number;
  incorrect: number;
  unattempted: number;
}

export interface PaperScore {
  marks: number;
  max: number;
  subjects: SubjectScore[];
}

export interface CbtPaper {
  id: string;
  name: string;
  kind: PaperKind;
  blueprint: Blueprint;
  seed: number;
  questionIds: string[];
  responses: Record<string, Resp>;
  startedAt: string | null;
  submittedAt: string | null;
  score: PaperScore | null;
  mockId: string | null;
  createdAt: string;
}
