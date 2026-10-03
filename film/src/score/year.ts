/**
 * The reference year: 365 days of one student's JEE preparation, in the
 * app's own data shapes.
 *
 * This is authored, not real. Its shape is what a real year looks like: a
 * strong first three days, a long scatter, a run that broke at 12, one that
 * broke at 9 while chasing it, then the long run, a fever, and the comeback.
 * Everything downstream (every note, every cut, every light) is derived from
 * this file by rule, so swapping in a real exported year changes the film
 * without anyone touching the timeline.
 */
import { SYLLABUS_DATA } from '../../../constants';
import { mulberry32 } from './random';

export type Subject3 = 'Physics' | 'Chemistry' | 'Maths';
export type Source = 'timer' | 'pomodoro' | 'manual';
export type MockScope = 'full' | 'part' | 'chapter';

export interface StudyLog {
  subject: Subject3;
  hours: number;
  quality: number; // 1–5
  distractions: number;
  source: Source;
  chapter: string;
  chapterIndex: number;
  daysOnChapter: number;
}

export interface Mock {
  score: number; // percent
  scope: MockScope;
}

export interface YearDay {
  /** 1-based, as printed. */
  day: number;
  logs: StudyLog[];
  mock?: Mock;
  /** Cumulative chapters marked completed, end of this day. */
  chaptersDone: number;
  /** Error-notebook entries not yet cleared, end of this day. */
  errorsOpen: number;
  /** Something the student wrote down that day, shown as it was typed. */
  note?: string;
}

export const DAYS = 365;
export const SUBJECTS: Subject3[] = ['Physics', 'Chemistry', 'Maths'];

export const CHAPTERS: Record<Subject3, string[]> = {
  Physics: [...SYLLABUS_DATA[11].Physics, ...SYLLABUS_DATA[12].Physics],
  Chemistry: [...SYLLABUS_DATA[11].Chemistry, ...SYLLABUS_DATA[12].Chemistry],
  Maths: [...SYLLABUS_DATA[11].Maths, ...SYLLABUS_DATA[12].Maths],
};
export const TOTAL_CHAPTERS =
  CHAPTERS.Physics.length + CHAPTERS.Chemistry.length + CHAPTERS.Maths.length;

/** Consecutive logged days, inclusive. Everything else is a missed day. */
export const RUNS: [number, number][] = [
  [1, 3],
  [7, 8],
  [13, 13],
  [19, 19],
  [21, 32],
  [47, 55],
  [70, 197],
  [203, 364],
];

const MANUAL_DAYS = new Set([7, 8, 13]);

const NOTES: Record<number, string> = {
  4: 'start physics properly from monday',
  57: 'tmrw for sure',
  198: 'fever. resting today',
};

const MOCKS: Record<number, Mock> = {
  84: { score: 41, scope: 'chapter' },
  91: { score: 47, scope: 'chapter' },
  104: { score: 45, scope: 'part' },
  117: { score: 50, scope: 'part' },
  130: { score: 46, scope: 'full' },
  143: { score: 51, scope: 'full' },
  155: { score: 49, scope: 'full' },
  167: { score: 55, scope: 'part' },
  179: { score: 57, scope: 'full' },
  190: { score: 60, scope: 'full' },
  208: { score: 56, scope: 'full' },
  219: { score: 61, scope: 'full' },
  230: { score: 66, scope: 'part' },
  240: { score: 63, scope: 'full' },
  250: { score: 67, scope: 'full' },
  259: { score: 70, scope: 'full' },
  268: { score: 68, scope: 'full' },
  276: { score: 72, scope: 'full' },
  284: { score: 74, scope: 'full' },
  291: { score: 73, scope: 'full' },
  298: { score: 76, scope: 'full' },
  305: { score: 78, scope: 'full' },
  311: { score: 77, scope: 'full' },
  317: { score: 80, scope: 'full' },
  323: { score: 81, scope: 'full' },
  331: { score: 84, scope: 'full' },
  335: { score: 83, scope: 'full' },
  341: { score: 85, scope: 'full' },
  347: { score: 86, scope: 'full' },
  352: { score: 85, scope: 'full' },
  357: { score: 88, scope: 'full' },
  361: { score: 89, scope: 'full' },
};

/** The syllabus is finished by this day; after it, it is all revision. */
const SYLLABUS_DONE_BY = 318;

const isLogged = (day: number) => RUNS.some(([a, b]) => day >= a && day <= b);

interface RawLog {
  subject: Subject3;
  hours: number;
  quality: number;
  distractions: number;
  source: Source;
}

const draftDay = (day: number, rnd: () => number): RawLog[] => {
  if (!isLogged(day)) return [];
  const source: Source = MANUAL_DAYS.has(day) ? 'manual' : rnd() < 0.55 ? 'timer' : 'pomodoro';
  const r2 = (lo: number, hi: number) => Math.round((lo + (hi - lo) * rnd()) * 4) / 4;

  if (day < 70) {
    // The scatter. Physics is the subject being avoided — the note on day 4
    // says so — so it barely appears until the long run.
    const pool: Subject3[] = day < 21 ? ['Maths', 'Chemistry'] : ['Maths', 'Chemistry', 'Maths', 'Physics'];
    const first = pool[Math.floor(rnd() * pool.length)];
    const logs: RawLog[] = [
      { subject: first, hours: r2(1.5, 3.5), quality: 2 + Math.round(rnd()), distractions: 9 + Math.floor(rnd() * 12), source },
    ];
    if (rnd() < 0.2) {
      const second = SUBJECTS.filter(s => s !== first && s !== 'Physics')[0] ?? 'Maths';
      logs.push({ subject: second, hours: r2(1, 2), quality: 2, distractions: 8 + Math.floor(rnd() * 8), source });
    }
    return logs;
  }

  if (day <= 197) {
    const p = (day - 70) / 127;
    const count = p < 0.3 ? 2 : rnd() < 0.6 ? 3 : 2;
    const start = Math.floor(rnd() * 3);
    return Array.from({ length: count }, (_, i) => ({
      subject: SUBJECTS[(start + i) % 3],
      hours: r2(1.4 + 1.6 * p, 2.4 + 1.8 * p),
      quality: Math.min(5, 3 + Math.round(rnd() * (0.6 + p))),
      distractions: Math.max(0, Math.round(10 - 7 * p + rnd() * 3)),
      source,
    }));
  }

  const start = Math.floor(rnd() * 3);
  return Array.from({ length: 3 }, (_, i) => ({
    subject: SUBJECTS[(start + i) % 3],
    hours: r2(2.1, 3.2),
    quality: 4 + Math.round(rnd() * 0.8),
    distractions: Math.floor(rnd() * 3.5),
    source,
  }));
};

const buildYear = (): YearDay[] => {
  const rnd = mulberry32(20270101);
  const raw: RawLog[][] = [];
  for (let day = 1; day <= DAYS; day++) raw.push(draftDay(day, rnd));

  // Work needed per chapter, chosen so the whole syllabus lands on
  // SYLLABUS_DONE_BY. Hours are the only currency the app has.
  const hoursBy: Record<Subject3, number> = { Physics: 0, Chemistry: 0, Maths: 0 };
  raw.slice(0, SYLLABUS_DONE_BY).forEach(logs => logs.forEach(l => (hoursBy[l.subject] += l.hours)));
  const need: Record<Subject3, number> = {
    Physics: hoursBy.Physics / CHAPTERS.Physics.length,
    Chemistry: hoursBy.Chemistry / CHAPTERS.Chemistry.length,
    Maths: hoursBy.Maths / CHAPTERS.Maths.length,
  };

  const cursor: Record<Subject3, { index: number; acc: number; days: number }> = {
    Physics: { index: 0, acc: 0, days: 0 },
    Chemistry: { index: 0, acc: 0, days: 0 },
    Maths: { index: 0, acc: 0, days: 0 },
  };
  let chaptersDone = 0;
  let errors = 0;

  return raw.map((dayLogs, i) => {
    const day = i + 1;
    const logs: StudyLog[] = dayLogs.map(l => {
      const c = cursor[l.subject];
      const list = CHAPTERS[l.subject];
      const revising = c.index >= list.length;
      const log: StudyLog = {
        ...l,
        chapter: revising ? 'Revision' : list[c.index],
        chapterIndex: Math.min(c.index, list.length - 1),
        daysOnChapter: c.days,
      };
      if (!revising) {
        c.acc += l.hours;
        c.days += 1;
        if (c.acc >= need[l.subject] - 1e-6) {
          c.acc -= need[l.subject];
          c.index += 1;
          c.days = 0;
          chaptersDone += 1;
        }
      } else {
        c.days += 1;
      }
      return log;
    });

    const mock = MOCKS[day];
    if (mock) errors += Math.round((100 - mock.score) * 0.3);
    if (logs.length) {
      const clear = day < 203 ? 0.38 : 1.0 + 1.25 * ((day - 203) / 161);
      errors = Math.max(0, errors - clear);
    }

    return {
      day,
      logs,
      mock,
      chaptersDone: Math.min(chaptersDone, TOTAL_CHAPTERS),
      errorsOpen: Math.round(errors),
      note: NOTES[day],
    };
  });
};

export const YEAR: YearDay[] = buildYear();
