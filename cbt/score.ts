/* ── Marking a paper, and what it becomes ──
   Pure. The exam screen hands over responses; this decides what was right,
   what it scores, and what a finished sitting turns into in the rest of the
   app — one MockTest for the trend lines and the weak-spot board, and
   ErrorEntries for the notebook. Mocks and the notebook do not know the CBT
   exists; they receive ordinary rows. */

import { ErrorEntry, ErrorReason, MockChapter, MockMistake, MockResult, MockScope, MockTest, MockVerdict } from '../types';
import { chapterKey, suggestName } from '../mocks/model';
import { BankQuestion, CbtPaper, CbtSubject, PaperScore, Resp, RespStatus, SubjectScore } from './types';

export const EMPTY_RESP: Resp = { a: null, s: 'nv', t: 0, v: 0 };

/** NTA's rule: an answer counts if it was saved — "answered & marked" included, "marked" alone not. */
export const counts = (r: Resp | undefined): boolean =>
  !!r && r.a !== null && (r.s === 'ans' || r.s === 'amr');

/** Numerical answers are compared to two decimals, the way NTA rounds them. */
export const numericMatches = (typed: string | number, value: number): boolean => {
  const n = typeof typed === 'number' ? typed : Number(typed);
  return Number.isFinite(n) && Math.abs(n - value) < 0.01 + 1e-9;
};

export type Outcome = 'right' | 'wrong' | 'skipped';

export const outcomeOf = (q: BankQuestion, r: Resp | undefined): Outcome => {
  if (!counts(r) || !q.answer) return 'skipped';
  if ('option' in q.answer) return r!.a === q.answer.option ? 'right' : 'wrong';
  return numericMatches(r!.a as string | number, q.answer.value) ? 'right' : 'wrong';
};

export const scorePaper = (paper: Pick<CbtPaper, 'blueprint' | 'responses'>, byId: Map<string, BankQuestion>): PaperScore => {
  const { right, wrong } = paper.blueprint.marking;
  const subjects = new Map<CbtSubject, SubjectScore>();
  paper.blueprint.sections.forEach(sec => {
    const s = subjects.get(sec.subject) ?? { subject: sec.subject, marks: 0, max: 0, correct: 0, incorrect: 0, unattempted: 0 };
    sec.ids.forEach(id => {
      const q = byId.get(id);
      s.max += right;
      const o = q ? outcomeOf(q, paper.responses[id]) : 'skipped';
      if (o === 'right') { s.correct += 1; s.marks += right; }
      else if (o === 'wrong') { s.incorrect += 1; s.marks += wrong; }
      else s.unattempted += 1;
    });
    subjects.set(sec.subject, s);
  });
  const list = Array.from(subjects.values());
  return { marks: list.reduce((a, s) => a + s.marks, 0), max: list.reduce((a, s) => a + s.max, 0), subjects: list };
};

/** Palette tallies for the submit summary. */
export const statusCounts = (ids: string[], responses: Record<string, Resp>): Record<RespStatus, number> => {
  const c: Record<RespStatus, number> = { nv: 0, na: 0, ans: 0, mr: 0, amr: 0 };
  ids.forEach(id => { c[(responses[id] ?? EMPTY_RESP).s] += 1; });
  return c;
};

/* ── Chapter verdicts ──
   Filled in for the student, editable before saving. Judged only on the
   questions the student actually opened: a chapter whose questions were never
   reached (the clock ran out, the subject was left for last) says nothing
   about the chapter, and calling it weak would fill the weak-spot board with
   noise after every rushed paper. Read-and-skipped does count — you looked at
   it and could not do it. And it takes two such questions to earn a verdict:
   one is a coin toss. */

export interface ChapterLine {
  ref: Pick<MockChapter, 'classId' | 'subject' | 'chapter'>;
  key: string;
  right: number;
  wrong: number;
  skipped: number;
  /** Never opened. Counted in `skipped` too, but not judged. */
  unseen: number;
  verdict: MockVerdict | null;
}

export const chapterLines = (paper: Pick<CbtPaper, 'questionIds' | 'responses'>, byId: Map<string, BankQuestion>): ChapterLine[] => {
  const m = new Map<string, ChapterLine>();
  paper.questionIds.forEach(id => {
    const q = byId.get(id);
    if (!q || !q.chapter || !q.classId) return;
    const ref = { classId: q.classId, subject: q.subject, chapter: q.chapter };
    const key = chapterKey(ref);
    const line = m.get(key) ?? { ref, key, right: 0, wrong: 0, skipped: 0, unseen: 0, verdict: null };
    const r = paper.responses[id];
    const o = outcomeOf(q, r);
    if (o === 'right') line.right += 1; else if (o === 'wrong') line.wrong += 1; else line.skipped += 1;
    if (o === 'skipped' && (!r || r.s === 'nv')) line.unseen += 1;
    m.set(key, line);
  });
  return Array.from(m.values()).map(l => {
    const n = l.right + l.wrong + l.skipped - l.unseen;
    const verdict: MockVerdict | null = n < 2 ? null
      : l.right === n ? 'strong'
        : (l.wrong + l.skipped - l.unseen) * 2 >= n ? 'weak'
          : 'okay';
    return { ...l, verdict };
  }).sort((a, b) => (b.wrong + b.skipped) - (a.wrong + a.skipped) || (a.key < b.key ? -1 : 1));
};

/* ── Into Mocks ── */

/** The notebook's reasons, folded into the four buckets a mock's mistakes are counted in. */
export const MISTAKE_OF: Record<ErrorReason, MockMistake> = {
  concept: 'concept',
  silly: 'silly',
  calculation: 'silly',
  misread: 'silly',
  time: 'time',
  unstudied: 'unstudied',
};

const SCOPE_OF = { full: 'full', subject: 'part', chapters: 'chapter' } as const satisfies Record<CbtPaper['kind'], MockScope>;

export const CBT_SERIES = 'Alpha CBT';

export const buildMock = (args: {
  paper: CbtPaper;
  score: PaperScore;
  verdicts: Record<string, MockVerdict>;
  reasons: Record<string, ErrorReason>;
  lines: ChapterLine[];
  tests: MockTest[];
  date: string;
  existingId?: string;
}): MockTest => {
  const { paper, score, verdicts, reasons, lines, tests, date } = args;
  const scope: MockScope = SCOPE_OF[paper.kind];
  const mistakes: Partial<Record<MockMistake, number>> = {};
  Object.values(reasons).forEach(r => { const k = MISTAKE_OF[r]; mistakes[k] = (mistakes[k] ?? 0) + 1; });
  const result: MockResult = {
    scores: score.subjects.map(s => ({
      subject: s.subject, marks: s.marks, max: s.max, correct: s.correct, incorrect: s.incorrect, unattempted: s.unattempted,
    })),
  };
  if (Object.keys(mistakes).length) result.mistakes = mistakes;
  if (Object.keys(verdicts).length) result.verdicts = verdicts;
  const existing = args.existingId ? tests.find(t => t.id === args.existingId) : undefined;
  return {
    id: existing?.id ?? args.existingId ?? `cbt-${paper.id}`.slice(0, 64),
    name: existing?.name ?? suggestName(tests, { exam: 'mains' }, scope),
    date,
    exam: 'mains',
    scope,
    series: CBT_SERIES,
    // A full paper stores no chapter list; anything narrower lists what was in it.
    chapters: scope === 'full' ? [] : lines.map(l => ({ ...l.ref })),
    result,
    cbtPaperId: paper.id,
    updatedAt: Date.now(),
  };
};

/* ── Into the notebook ──
   A question already open in the notebook is not added twice: getting it
   wrong again updates that entry — its streak back to zero, the new reason,
   the new mock — which is exactly what re-attempting it in an error test
   would have done. */

export const buildErrors = (args: {
  picks: { q: BankQuestion; reason: ErrorReason }[];
  existing: ErrorEntry[];
  mockId: string;
  now: number;
  newId: () => string;
}): ErrorEntry[] => {
  const { picks, existing, mockId, now, newId } = args;
  return picks.flatMap(({ q, reason }) => {
    if (!q.chapter || !q.classId || !q.answer) return [];
    const prior = existing.find(e => e.qbankId === q.id);
    if (prior) {
      return [{
        ...prior, reason, mockId, attempts: prior.attempts + 1, streak: 0,
        lastResult: 'wrong' as const, lastAttemptAt: now, updatedAt: now,
      }];
    }
    const numeric = 'value' in q.answer ? q.answer.value : undefined;
    const entry: ErrorEntry = {
      id: newId(),
      question: q.body,
      options: (q.options && q.options.length === 4 ? q.options : ['', '', '', '']) as ErrorEntry['options'],
      correct: 'option' in q.answer ? q.answer.option : 0,
      reason,
      classId: q.classId,
      subject: q.subject,
      chapter: q.chapter,
      mockId,
      qbankId: q.id,
      createdAt: now,
      updatedAt: now,
      attempts: 0,
      streak: 0,
    };
    if (q.topic) entry.topic = q.topic;
    if (q.figures.length) entry.figures = q.figures.slice(0, 12);
    if (numeric !== undefined) entry.numeric = numeric;
    return [entry];
  });
};

/** "4:05", "1:02:10". */
export const clock = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
};
