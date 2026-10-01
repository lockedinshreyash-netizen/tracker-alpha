/* ── Mock tests: the model ──
   Pure and React-free, the same contract as schedule/schedule.ts. Everything
   the Mocks tab knows about a paper — what it is called, what it is out of,
   what colour its line is — lives here, so the sheets, the charts and the
   insights cannot disagree about it.

   Two axes classify a mock and both are first-class everywhere: the EXAM it
   imitates (Main / Advanced / NEET / other) and its SCOPE (full syllabus,
   part syllabus, single chapter). Trend lines are split by exam and filtered
   by both, because a 55% in Advanced and a 55% in Main are different results
   and averaging them produces a number that describes neither. */

import {
  ErrorEntry, ErrorReason, ExamPreference, MockChapter, MockExam, MockMistake, MockResult, MockScope,
  MockSubjectScore, MockTest, MockVerdict, MocksState, Subject,
} from '../types';

export const DEFAULT_MOCKS: MocksState = { tests: [], errors: [], topics: {} };

/* ── Classification ── */

interface ExamMeta {
  label: string;
  short: string;
  /** Default maximum per subject for a full paper. Editable per mock. */
  max: (subject: Subject) => number;
  /** Marks a question is worth, for turning "questions lost" into "≈ marks". */
  perQuestion: number;
  /** The marking scheme, when the paper has one fixed scheme. */
  scheme?: { right: number; wrong: number };
}

export const EXAMS: Record<MockExam, ExamMeta> = {
  mains: { label: 'JEE Main', short: 'Main', max: () => 100, perQuestion: 4, scheme: { right: 4, wrong: -1 } },
  // Paper 1 + Paper 2 together. Advanced changes its pattern yearly, so no scheme.
  advanced: { label: 'JEE Advanced', short: 'Advanced', max: () => 120, perQuestion: 4 },
  neet: { label: 'NEET', short: 'NEET', max: s => (s === 'Biology' ? 360 : 180), perQuestion: 4, scheme: { right: 4, wrong: -1 } },
  other: { label: 'Other', short: 'Other', max: () => 100, perQuestion: 4 },
};

export const SCOPES: Record<MockScope, { label: string; short: string; noun: string; hint: string }> = {
  full: { label: 'Full syllabus', short: 'Full', noun: 'Full Test', hint: 'Every chapter is fair game.' },
  part: { label: 'Part syllabus', short: 'Part', noun: 'Part Test', hint: 'A chunk of chapters. Pick them below.' },
  chapter: { label: 'Chapter test', short: 'Chapter', noun: 'Chapter Test', hint: 'One or two chapters, deep.' },
};

export const SCOPE_ORDER: MockScope[] = ['full', 'part', 'chapter'];

/** The papers a student of this exam can pick. */
export const examsFor = (pref: ExamPreference): MockExam[] =>
  pref === 'NEET' ? ['neet', 'other'] : ['mains', 'advanced', 'other'];

export const MISTAKES: Record<MockMistake, { label: string; hint: string }> = {
  silly: { label: 'Silly', hint: 'Knew it. Messed it up.' },
  concept: { label: 'Concept', hint: 'Didn’t really get it.' },
  time: { label: 'Time', hint: 'Ran out of time.' },
  unstudied: { label: 'Not studied', hint: 'Never covered it.' },
};
export const MISTAKE_ORDER: MockMistake[] = ['silly', 'concept', 'time', 'unstudied'];

/* Exam colours, validated with the dataviz palette checker (adjacent and
   all-pairs, light on #ffffff and dark on #111114). Main and NEET share slot 1
   because no student plots both: NEET against a fourth hue failed the dark
   CVD floor outright. The accent red is absent — it belongs to actions. */
export const EXAM_COLORS: Record<MockExam, { light: string; dark: string }> = {
  mains: { light: '#2a78d6', dark: '#3987e5' },
  neet: { light: '#2a78d6', dark: '#3987e5' },
  advanced: { light: '#eb6834', dark: '#d95926' },
  other: { light: '#1baf7a', dark: '#199e70' },
};
export const examColor = (exam: MockExam, dark: boolean) => EXAM_COLORS[exam][dark ? 'dark' : 'light'];

/* Mistake colours: one hue family light→dark would imply an order these do
   not have, so they take categorical slots 4–7 in the palette's fixed order
   (adjacent pairs validated as a stack). */
export const MISTAKE_COLORS: Record<MockMistake, { light: string; dark: string }> = {
  silly: { light: '#eda100', dark: '#c98500' },
  concept: { light: '#e87ba4', dark: '#d55181' },
  time: { light: '#008300', dark: '#008300' },
  unstudied: { light: '#4a3aa7', dark: '#9085e9' },
};

/* ── Keys ── a chapter, or one topic inside it. Used for verdicts and for the
   custom-topic library. No chapter name in the syllabus contains '|', and
   topic names are stripped of it on the way in. */
export const chapterKey = (c: Pick<MockChapter, 'classId' | 'subject' | 'chapter'>): string =>
  `${c.classId}|${c.subject}|${c.chapter}`;
export const topicKey = (c: Pick<MockChapter, 'classId' | 'subject' | 'chapter'>, topic: string): string =>
  `${chapterKey(c)}|${topic}`;

export const parseKey = (key: string): { classId: 11 | 12; subject: Subject; chapter: string; topic?: string } | null => {
  const [cls, subject, chapter, topic] = key.split('|');
  if ((cls !== '11' && cls !== '12') || !subject || !chapter) return null;
  return { classId: Number(cls) as 11 | 12, subject: subject as Subject, chapter, topic: topic || undefined };
};

export const cleanTopic = (raw: string): string =>
  raw.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);

/* ── Scores ── */

export const totals = (r: MockResult | undefined): { marks: number; max: number } => {
  if (!r) return { marks: 0, max: 0 };
  return r.scores.reduce((t, s) => ({ marks: t.marks + s.marks, max: t.max + s.max }), { marks: 0, max: 0 });
};

/** Score as a percentage of the paper, or null when there is no paper to score. */
export const scorePct = (r: MockResult | undefined): number | null => {
  const t = totals(r);
  return t.max > 0 ? (t.marks / t.max) * 100 : null;
};

export const subjectPct = (s: MockSubjectScore): number | null => (s.max > 0 ? (s.marks / s.max) * 100 : null);

/** Correct over attempted, across the subjects that carry a breakdown. */
export const accuracy = (r: MockResult | undefined): number | null => {
  if (!r) return null;
  let c = 0, w = 0;
  r.scores.forEach(s => {
    if (s.correct !== undefined && s.incorrect !== undefined) { c += s.correct; w += s.incorrect; }
  });
  return c + w > 0 ? (c / (c + w)) * 100 : null;
};

/** Attempted over total questions, across the subjects that carry a breakdown. */
export const attemptRate = (r: MockResult | undefined): number | null => {
  if (!r) return null;
  let a = 0, n = 0;
  r.scores.forEach(s => {
    if (s.correct !== undefined && s.incorrect !== undefined && s.unattempted !== undefined) {
      a += s.correct + s.incorrect;
      n += s.correct + s.incorrect + s.unattempted;
    }
  });
  return n > 0 ? (a / n) * 100 : null;
};

export const isTaken = (t: MockTest): t is MockTest & { result: MockResult } =>
  !!t.result && t.result.scores.length > 0;

/* ── Papers ──
   The thing a trend line, a filter chip and a "vs last" delta compare within.
   For the fixed exams that is the exam itself; for "Other" it is whatever the
   student named it, so BITSAT and a school pre-board never share a line. */
type PaperRef = Pick<MockTest, 'exam' | 'paperName'>;

export const DEFAULT_OTHER_MAX = 300;

export const paperKey = (t: PaperRef): string =>
  t.exam === 'other' && t.paperName ? `other:${t.paperName.toLowerCase()}` : t.exam;
export const paperLabel = (t: PaperRef): string =>
  t.exam === 'other' && t.paperName ? t.paperName : EXAMS[t.exam].label;
export const paperShort = (t: PaperRef): string =>
  t.exam === 'other' && t.paperName ? t.paperName : EXAMS[t.exam].short;

/** What a full paper is out of, before anyone edits a subject. */
export const paperTotal = (t: Pick<MockTest, 'exam' | 'maxMarks'>, subjects: Subject[]): number =>
  t.exam === 'other' ? (t.maxMarks ?? DEFAULT_OTHER_MAX) : subjects.reduce((a, s) => a + EXAMS[t.exam].max(s), 0);

/** "JEE Main Full Test 4", "BITSAT Full Test 2" — numbered within its own paper and scope. */
export const suggestName = (tests: MockTest[], paper: PaperRef, scope: MockScope, excludeId?: string): string => {
  const key = paperKey(paper);
  const n = tests.filter(t => paperKey(t) === key && t.scope === scope && t.id !== excludeId).length + 1;
  const prefix = paper.exam === 'other' && !paper.paperName ? '' : `${paperLabel(paper)} `;
  return `${prefix}${SCOPES[scope].noun} ${n}`;
};

/* A custom paper's total, split across its subjects as evenly as whole marks
   allow (300 over three is 100 each; 200 over three is 67/67/66). The result
   sheet lets each subject's maximum be corrected. */
export const blankScores = (t: Pick<MockTest, 'exam' | 'maxMarks'>, subjects: Subject[]): MockSubjectScore[] => {
  if (t.exam !== 'other') return subjects.map(subject => ({ subject, marks: 0, max: EXAMS[t.exam].max(subject) }));
  const total = t.maxMarks ?? DEFAULT_OTHER_MAX;
  const base = Math.floor(total / subjects.length);
  const extra = total - base * subjects.length;
  return subjects.map((subject, i) => ({ subject, marks: 0, max: Math.max(1, base + (i < extra ? 1 : 0)) }));
};

/* ── Persistence ── */

const SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Maths', 'Biology', 'General'];
const EXAM_KEYS: MockExam[] = ['mains', 'advanced', 'neet', 'other'];
const VERDICTS: MockVerdict[] = ['strong', 'okay', 'weak'];
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/* Bounds. This rides in the synced jsonb blob, and a student who takes a mock
   every Sunday for two years has ~100. */
export const MAX_MOCKS = 400;
const MAX_CHAPTERS = 150;
const MAX_TOPICS_PER_CHAPTER = 40;
const MAX_VERDICTS = 400;

const text = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim().slice(0, max);
  return t || undefined;
};
const num = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : undefined;
const count = (v: unknown): number | undefined => {
  const n = num(v, 0, 999);
  return n === undefined ? undefined : Math.round(n);
};

const normalizeChapter = (raw: unknown): MockChapter | null => {
  const c = raw as Partial<MockChapter> | null;
  if (!c || (c.classId !== 11 && c.classId !== 12) || !SUBJECTS.includes(c.subject as Subject)) return null;
  const chapter = text(c.chapter, 120);
  if (!chapter || chapter.includes('|')) return null;
  const topics = Array.isArray(c.topics)
    ? Array.from(new Set(c.topics.filter((t): t is string => typeof t === 'string').map(cleanTopic).filter(Boolean))).slice(0, MAX_TOPICS_PER_CHAPTER)
    : [];
  return { classId: c.classId, subject: c.subject as Subject, chapter, ...(topics.length ? { topics } : {}) };
};

const normalizeResult = (raw: unknown): MockResult | undefined => {
  const r = raw as Partial<MockResult> | null;
  if (!r || !Array.isArray(r.scores)) return undefined;
  const seen = new Set<Subject>();
  const scores: MockSubjectScore[] = r.scores.flatMap(s => {
    if (!s || !SUBJECTS.includes(s.subject) || seen.has(s.subject)) return [];
    const max = num(s.max, 0, 2000);
    if (max === undefined || max <= 0) return [];
    seen.add(s.subject);
    // Negative marking can take a subject below zero, never below -max.
    const marks = num(s.marks, -max, max) ?? 0;
    const out: MockSubjectScore = { subject: s.subject, marks, max };
    const c = count(s.correct), w = count(s.incorrect), u = count(s.unattempted);
    if (c !== undefined) out.correct = c;
    if (w !== undefined) out.incorrect = w;
    if (u !== undefined) out.unattempted = u;
    return [out];
  });
  if (!scores.length) return undefined;

  const result: MockResult = { scores };
  const pct = num(r.percentile, 0, 100);
  if (pct !== undefined) result.percentile = pct;
  const rank = num(r.rank, 1, 10_000_000);
  if (rank !== undefined) result.rank = Math.round(rank);

  if (r.mistakes && typeof r.mistakes === 'object') {
    const m: Partial<Record<MockMistake, number>> = {};
    MISTAKE_ORDER.forEach(k => {
      const v = count((r.mistakes as Record<string, unknown>)[k]);
      if (v) m[k] = v;
    });
    if (Object.keys(m).length) result.mistakes = m;
  }
  if (r.verdicts && typeof r.verdicts === 'object') {
    const entries = Object.entries(r.verdicts as Record<string, unknown>)
      .filter(([k, v]) => k.length <= 260 && parseKey(k) && VERDICTS.includes(v as MockVerdict))
      .slice(0, MAX_VERDICTS);
    if (entries.length) result.verdicts = Object.fromEntries(entries) as Record<string, MockVerdict>;
  }
  const note = text(r.note, 280);
  if (note) result.note = note;
  return result;
};

/**
 * Whatever was persisted, made safe to chart. Same stance as
 * normalizeSchedule: validate every field, drop a row whose identity is
 * unusable. A mock is read to be averaged, so an impossible score is worse
 * than a missing one — it moves a trend the student is shown as a fact.
 */
/* ── The error notebook ── */

export const REASONS: Record<ErrorReason, { label: string; hint: string }> = {
  concept: { label: 'Concept gap', hint: 'Didn’t understand the idea' },
  silly: { label: 'Silly mistake', hint: 'Knew it, slipped' },
  calculation: { label: 'Calculation', hint: 'Right method, wrong arithmetic' },
  misread: { label: 'Misread', hint: 'Read the question wrong' },
  time: { label: 'Time pressure', hint: 'Rushed it' },
  unstudied: { label: 'Not studied', hint: 'Never covered it' },
};
export const REASON_ORDER: ErrorReason[] = ['concept', 'silly', 'calculation', 'misread', 'time', 'unstudied'];

/** Two right in a row. Once can be a guess. */
export const CLEAR_STREAK = 2;
export const isCleared = (e: Pick<ErrorEntry, 'streak'>): boolean => e.streak >= CLEAR_STREAK;

export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

/**
 * Apply one practice run: every answered error gets its attempt counted, a
 * right answer extends its streak and a wrong one resets it. One write for the
 * whole run — answering is a gesture, and every AppState change is a sync.
 */
export const applyAttempts = (errors: ErrorEntry[], answers: Record<string, boolean>, at: number): ErrorEntry[] =>
  errors.map(e => {
    if (!(e.id in answers)) return e;
    const right = answers[e.id];
    return { ...e, attempts: e.attempts + 1, streak: right ? e.streak + 1 : 0, lastResult: right ? 'right' : 'wrong', lastAttemptAt: at, updatedAt: at };
  });

export const MAX_ERRORS = 800;
const ERROR_REASONS: ErrorReason[] = REASON_ORDER;

const normalizeError = (raw: unknown): ErrorEntry | null => {
  const e = raw as Partial<ErrorEntry> | null;
  if (!e || typeof e.id !== 'string' || !e.id) return null;
  const question = text(e.question, 1500);
  if (!question || !Array.isArray(e.options) || e.options.length !== 4) return null;
  const options = e.options.map(o => (typeof o === 'string' ? o.trim().slice(0, 300) : ''));
  if (options.some(o => !o)) return null;
  if (e.correct !== 0 && e.correct !== 1 && e.correct !== 2 && e.correct !== 3) return null;
  const chapter = normalizeChapter({ classId: e.classId, subject: e.subject, chapter: e.chapter });
  if (!chapter) return null;
  const out: ErrorEntry = {
    id: e.id.slice(0, 64),
    question,
    options: options as ErrorEntry['options'],
    correct: e.correct,
    reason: ERROR_REASONS.includes(e.reason as ErrorReason) ? (e.reason as ErrorReason) : 'concept',
    classId: chapter.classId,
    subject: chapter.subject,
    chapter: chapter.chapter,
    createdAt: num(e.createdAt, 0, 8.64e15) ?? 0,
    updatedAt: num(e.updatedAt, 0, 8.64e15) ?? 0,
    attempts: count(e.attempts) ?? 0,
    streak: count(e.streak) ?? 0,
  };
  const why = text(e.why, 600);
  if (why) out.why = why;
  const topic = typeof e.topic === 'string' ? cleanTopic(e.topic) : '';
  if (topic) out.topic = topic;
  if (typeof e.mockId === 'string' && e.mockId) out.mockId = e.mockId.slice(0, 64);
  if (e.lastResult === 'right' || e.lastResult === 'wrong') out.lastResult = e.lastResult;
  const last = num(e.lastAttemptAt, 0, 8.64e15);
  if (last) out.lastAttemptAt = last;
  return out;
};

export const normalizeMocks = (raw: unknown): MocksState => {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<MocksState>;
  const seen = new Set<string>();
  const tests: MockTest[] = (Array.isArray(src.tests) ? src.tests : [])
    .filter(t => t && typeof t.id === 'string' && t.id && typeof t.date === 'string' && DATE_SHAPE.test(t.date))
    .filter(t => (seen.has(t.id) ? false : (seen.add(t.id), true)))
    .map(t => {
      const chapters = (Array.isArray(t.chapters) ? t.chapters : [])
        .map(normalizeChapter)
        .filter((c): c is MockChapter => !!c)
        .filter((c, i, all) => all.findIndex(o => chapterKey(o) === chapterKey(c)) === i)
        .slice(0, MAX_CHAPTERS);
      const exam = EXAM_KEYS.includes(t.exam) ? t.exam : 'other';
      const scope: MockScope = SCOPE_ORDER.includes(t.scope) ? t.scope : 'full';
      const test: MockTest = {
        id: t.id.slice(0, 64),
        name: text(t.name, 60) ?? suggestName([], { exam, paperName: exam === 'other' ? text(t.paperName, 30) : undefined }, scope),
        date: t.date,
        exam,
        scope,
        chapters: scope === 'full' ? [] : chapters,
        updatedAt: num(t.updatedAt, 0, 8.64e15) ?? 0,
      };
      const series = text(t.series, 40);
      if (series) test.series = series;
      if (exam === 'other') {
        const paperName = text(t.paperName, 30);
        if (paperName) test.paperName = paperName;
        const maxMarks = num(t.maxMarks, 1, 5000);
        if (maxMarks !== undefined) test.maxMarks = Math.round(maxMarks);
      }
      const result = normalizeResult(t.result);
      if (result) test.result = result;
      return test;
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.updatedAt - b.updatedAt))
    // Newest kept when the cap bites.
    .slice(-MAX_MOCKS);

  const topics: Record<string, string[]> = {};
  if (src.topics && typeof src.topics === 'object') {
    Object.entries(src.topics as Record<string, unknown>).forEach(([key, list]) => {
      const p = parseKey(key);
      if (!p || p.topic || !Array.isArray(list)) return;
      const clean = Array.from(new Set(list.filter((x): x is string => typeof x === 'string').map(cleanTopic).filter(Boolean)))
        .slice(0, MAX_TOPICS_PER_CHAPTER);
      if (clean.length) topics[key] = clean;
    });
  }
  const seenErrors = new Set<string>();
  const errors: ErrorEntry[] = (Array.isArray(src.errors) ? src.errors : [])
    .map(normalizeError)
    .filter((e): e is ErrorEntry => !!e && (seenErrors.has(e.id) ? false : (seenErrors.add(e.id), true)))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-MAX_ERRORS);

  return { tests, errors, topics };
};

/**
 * Two devices' mocks. Runs in the **local-newer sync path only**, like the
 * by-id merges of `logs` and `tasks` and `mergeSchedule`: a mock planned on
 * the phone while the laptop moved on must survive, and the realtime and
 * cloud-newer paths take the remote copy wholesale so a deletion can travel.
 * On an id both sides have, the later `updatedAt` wins — a result logged on
 * one device is never overwritten by the other's stale plan of the same mock.
 * The topic library is a set of suggestions, so it is simply unioned.
 */
export const mergeMocks = (local: MocksState, remote: MocksState): MocksState => {
  const byId = new Map(local.tests.map(t => [t.id, t]));
  remote.tests.forEach(t => {
    const mine = byId.get(t.id);
    if (!mine || t.updatedAt > mine.updatedAt) byId.set(t.id, t);
  });
  const errorsById = new Map(local.errors.map(e => [e.id, e]));
  remote.errors.forEach(e => {
    const mine = errorsById.get(e.id);
    if (!mine || e.updatedAt > mine.updatedAt) errorsById.set(e.id, e);
  });
  const topics: Record<string, string[]> = { ...remote.topics };
  Object.entries(local.topics).forEach(([k, list]) => {
    topics[k] = Array.from(new Set([...(topics[k] ?? []), ...list])).slice(0, MAX_TOPICS_PER_CHAPTER);
  });
  return normalizeMocks({ tests: Array.from(byId.values()), errors: Array.from(errorsById.values()), topics });
};
