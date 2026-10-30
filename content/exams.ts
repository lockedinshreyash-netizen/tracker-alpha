/* ── The exams ──
   The one list of every exam Alpha knows, and the only place an exam is
   defined. A student's target is one primary exam, any others they are also
   writing (same stream), and one year: `ExamTarget` on AppState.

   THE STREAM DECIDES THE SYLLABUS. Everything that is per-subject (subjects
   shown, chapter lists, weightage, Plan colours) still keys off the stream,
   stored as `examPreference` for the 38 places that already read it:
   'JEE' means PCM, 'NEET' means PCB. An exam only changes what is genuinely
   its own: its name, its date, how its mock paper is marked. Exams that also
   test something outside the stream (BITSAT's English and Logical Reasoning,
   VITEEE's English and Aptitude) list it in `extra`; those subjects arrive in
   a later phase, so today they are named, not tracked.

   DATES ARE EXPECTED, NOT ANNOUNCED. Each exam has the month it is usually
   held, and the countdown counts to the start of that window (NEET to its
   usual first Sunday of May, as the app always has). When a body announces
   real dates, add them to OFFICIAL and the countdown says "on" instead of
   "expected". Patterns (questions, marks, marking) are the published patterns
   of recent years, checked before each season; see content/SOURCES.md.

   React-free and tested (content/tests/exams.test.ts). */

import type { ExamPreference } from '../types';

export type Stream = 'PCM' | 'PCB';

export type ExamId =
  | 'jee-main' | 'jee-advanced' | 'bitsat' | 'mht-cet' | 'wbjee'
  | 'kcet' | 'comedk' | 'viteee' | 'neet-ug';

export interface ExamDef {
  id: ExamId;
  /** "JEE Main". */
  name: string;
  /** Short enough for a chip: "MHT CET". */
  short: string;
  /** Who conducts it. */
  body: string;
  /** The streams it can be written in. The first is its home stream. */
  streams: Stream[];
  /** Tested but outside the stream's three subjects; tracked in a later phase. */
  extra?: string[];
  /** The month (1–12) it is usually held, and a day for the window's start. */
  usual: { month: number; day: number; note: string };
  /** The whole paper, for a mock's default total. */
  maxMarks: number;
  /** One fixed marking scheme, when the paper has one; otherwise marks are typed. */
  scheme?: { right: number; wrong: number };
  /** Needs another exam: JEE Advanced is only open to JEE Main qualifiers. */
  requires?: ExamId;
}

/* In the order the picker lists them: the national exams, then the rest. */
export const EXAMS: ExamDef[] = [
  { id: 'jee-main', name: 'JEE Main', short: 'JEE Main', body: 'NTA', streams: ['PCM'],
    usual: { month: 1, day: 1, note: 'Session 1 is usually in January, Session 2 in April.' },
    maxMarks: 300, scheme: { right: 4, wrong: -1 } },
  // Its pattern changes every year, so no fixed scheme: marks are typed.
  { id: 'jee-advanced', name: 'JEE Advanced', short: 'JEE Adv', body: 'IITs', streams: ['PCM'], requires: 'jee-main',
    usual: { month: 5, day: 15, note: 'Usually held in the second half of May.' },
    maxMarks: 360 },
  { id: 'bitsat', name: 'BITSAT', short: 'BITSAT', body: 'BITS Pilani', streams: ['PCM'], extra: ['English Proficiency', 'Logical Reasoning'],
    usual: { month: 5, day: 1, note: 'Session 1 is usually in May, Session 2 in June.' },
    maxMarks: 390, scheme: { right: 3, wrong: -1 } },
  // Maths carries two marks a question and the rest one, so no single scheme.
  { id: 'mht-cet', name: 'MHT CET', short: 'MHT CET', body: 'Maharashtra CET Cell', streams: ['PCM', 'PCB'],
    usual: { month: 4, day: 1, note: 'Usually held between April and May.' },
    maxMarks: 200 },
  // Mixed marking by question category, so no single scheme.
  { id: 'wbjee', name: 'WBJEE', short: 'WBJEE', body: 'WBJEE Board', streams: ['PCM'],
    usual: { month: 4, day: 1, note: 'Usually held in April.' },
    maxMarks: 200 },
  { id: 'kcet', name: 'KCET', short: 'KCET', body: 'KEA Karnataka', streams: ['PCM', 'PCB'],
    usual: { month: 4, day: 1, note: 'Usually held in April.' },
    maxMarks: 180, scheme: { right: 1, wrong: 0 } },
  { id: 'comedk', name: 'COMEDK UGET', short: 'COMEDK', body: 'COMEDK', streams: ['PCM'],
    usual: { month: 5, day: 1, note: 'Usually held in May.' },
    maxMarks: 180, scheme: { right: 1, wrong: 0 } },
  { id: 'viteee', name: 'VITEEE', short: 'VITEEE', body: 'VIT', streams: ['PCM'], extra: ['English', 'Aptitude'],
    usual: { month: 4, day: 1, note: 'Usually held in April.' },
    maxMarks: 125, scheme: { right: 1, wrong: 0 } },
  { id: 'neet-ug', name: 'NEET UG', short: 'NEET', body: 'NTA', streams: ['PCB'],
    usual: { month: 5, day: 0, note: 'Usually held on the first Sunday of May.' },
    maxMarks: 720, scheme: { right: 4, wrong: -1 } },
];

/** Announced dates, by exam and year ("2027-05-02"). Empty until a body announces one. */
export const OFFICIAL: Partial<Record<ExamId, Record<number, string>>> = {};

const BY_ID = new Map(EXAMS.map(e => [e.id, e]));
export const examById = (id: ExamId): ExamDef => BY_ID.get(id)!;
export const isExamId = (v: unknown): v is ExamId => typeof v === 'string' && BY_ID.has(v as ExamId);

/* ── Streams and the old two-way choice ── */

export const streamOf = (pref: ExamPreference | undefined): Stream => (pref === 'NEET' ? 'PCB' : 'PCM');
export const prefOf = (stream: Stream): ExamPreference => (stream === 'PCB' ? 'NEET' : 'JEE');
export const STREAM_LABEL: Record<Stream, { title: string; sub: string }> = {
  PCM: { title: 'Engineering', sub: 'Physics, Chemistry, Maths' },
  PCB: { title: 'Medical', sub: 'Physics, Chemistry, Biology' },
};

/** The exams that can be written in a stream, in list order. */
export const examsIn = (stream: Stream): ExamDef[] => EXAMS.filter(e => e.streams.includes(stream));

/** The exam a stream starts on: its national exam. */
export const defaultExam = (stream: Stream): ExamId => (stream === 'PCB' ? 'neet-ug' : 'jee-main');

/* ── The target ── */

export interface ExamTarget {
  primary: ExamId;
  /** Others the student is also writing, same stream, primary excluded. */
  also: ExamId[];
  /** The year they write them. */
  year: number;
}

export const MAX_ALSO = 4;

/**
 * The year a student in this class writes their exams, as of `now`. Entrance
 * exams fall between January and June; from June on, Class 12 is aiming at
 * next year's. Class 11 is a year behind that.
 */
export const defaultYear = (cls: 11 | 12, now: Date = new Date()): number => {
  const y = now.getFullYear();
  const season = now.getMonth() >= 5 ? y + 1 : y; // June or later: next season
  return cls === 12 ? season : season + 1;
};

/**
 * The exams most students write next: this season (Class 12's year). It is the
 * default for anyone not yet asked, whatever their class, because most of the
 * people choosing are writing this year; a Class 11 student picks the next one
 * themselves.
 */
export const seasonYear = (now: Date = new Date()): number => defaultYear(12, now);

/** The years worth offering: this season and the three after. */
export const yearChoices = (now: Date = new Date()): number[] => {
  const first = defaultYear(12, now);
  return [first, first + 1, first + 2, first + 3];
};

/**
 * A target made whole and true to its stream: the primary belongs to the
 * stream (or the stream's default replaces it), the others belong too, are
 * not the primary, are not repeated, and are capped; an exam that requires
 * another brings it along; the year is a real year near now.
 */
export const normalizeTarget = (raw: unknown, stream: Stream, cls: 11 | 12, now: Date = new Date()): ExamTarget => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof ExamTarget, unknown>>;
  const fits = (id: unknown): id is ExamId => isExamId(id) && examById(id).streams.includes(stream);
  const primary = fits(r.primary) ? r.primary : defaultExam(stream);
  let also = (Array.isArray(r.also) ? r.also : []).filter(fits).filter((id, i, a) => id !== primary && a.indexOf(id) === i);
  const need = examById(primary).requires;
  if (need && need !== primary && !also.includes(need)) also = [need, ...also];
  also.forEach(id => {
    const n = examById(id).requires;
    if (n && n !== primary && !also.includes(n)) also = [...also, n];
  });
  also = also.slice(0, MAX_ALSO);
  const years = yearChoices(now);
  const yr = typeof r.year === 'number' && Number.isInteger(r.year) ? r.year : NaN;
  const year = yr >= years[0] - 1 && yr <= years[years.length - 1] ? yr : seasonYear(now);
  return { primary, also, year };
};

/** Primary first, then the rest. */
export const targetExams = (t: ExamTarget): ExamId[] => [t.primary, ...t.also];

/* ── Dates ── */

/** First Sunday of a month. */
const firstSunday = (year: number, month: number): Date => {
  const d = new Date(year, month - 1, 1);
  d.setDate(1 + ((7 - d.getDay()) % 7));
  return d;
};

/** When an exam is (or is expected to be) held in a year, and whether that is announced. */
export const examDateFor = (id: ExamId, year: number): { date: Date; official: boolean; note: string } => {
  const e = examById(id);
  const announced = OFFICIAL[id]?.[year];
  if (announced) return { date: new Date(`${announced}T00:00:00+05:30`), official: true, note: e.usual.note };
  const date = e.usual.day === 0 ? firstSunday(year, e.usual.month) : new Date(year, e.usual.month - 1, e.usual.day);
  return { date, official: false, note: e.usual.note };
};

/** "JEE Main 2027", "BITSAT ’28" (short). */
export const targetLabel = (id: ExamId, year: number, short = false): string =>
  short ? `${examById(id).short} ’${String(year).slice(-2)}` : `${examById(id).name} ${year}`;

/* ── Colours ──
   Every exam has a colour, shown as a chip that always carries the exam's
   name too (ExamChip), so colour is never the only cue. Run through the
   dataviz palette checker against #ffffff and #111114: the seven hues in
   this order pass every check in both themes for neighbouring pairs, and the
   first three, the exams most students write (JEE Main, JEE Advanced, NEET),
   also pass when any two sit side by side. The palette's red slot is left
   out: red is the app's action colour. Nine exams, seven hues: COMEDK takes
   KCET's hue (both Karnataka) and VITEEE takes BITSAT's (both private
   universities), drawn OUTLINED where the first is filled, so the two are
   still told apart by shape as well as by name. Light-mode chips use the
   colour as a tint and a dot, never as the text (three light hues sit below
   3:1 on white). */

export interface ExamColor { light: string; dark: string; outline?: boolean }

export const EXAM_COLORS: Record<ExamId, ExamColor> = {
  'jee-main': { light: '#2a78d6', dark: '#3987e5' },
  'jee-advanced': { light: '#eb6834', dark: '#d95926' },
  'neet-ug': { light: '#1baf7a', dark: '#199e70' },
  'mht-cet': { light: '#eda100', dark: '#c98500' },
  bitsat: { light: '#e87ba4', dark: '#d55181' },
  kcet: { light: '#008300', dark: '#008300' },
  wbjee: { light: '#6250d6', dark: '#9085e9' },
  comedk: { light: '#008300', dark: '#008300', outline: true },
  viteee: { light: '#e87ba4', dark: '#d55181', outline: true },
};

export const examColor = (id: ExamId, dark: boolean): string => EXAM_COLORS[id][dark ? 'dark' : 'light'];
