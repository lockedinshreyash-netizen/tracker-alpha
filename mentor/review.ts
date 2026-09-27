/* ── REVIEW MY WEEK, without a model ──
   The last seven complete days against the seven before them, like for like.
   The card renders from this alone; the model only adds a few sentences of
   reading on top, and the card is complete if that never arrives. */

import { AppState, Subject } from '../types';
import { addDays, isVerifiedLog } from '../utils';
import { getCoreSubjects } from '../constants';

export interface WeekReview {
  from: string;
  to: string;
  hours: number;
  prevHours: number;
  studyDays: number;
  timedShare: number | null;
  bySubject: { subject: Subject; hours: number; prev: number }[];
  /** Mentor-planned cards due in the week, and how many got done. */
  planned: number;
  plannedDone: number;
  cardsDone: number;
  /** Core subjects with no hours at all this week. */
  untouched: Subject[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export const buildWeekReview = (state: AppState, today: string): WeekReview => {
  const to = addDays(today, -1);
  const from = addDays(today, -7);
  const prevFrom = addDays(today, -14);
  const prevTo = addDays(today, -8);

  const inRange = (d: string, a: string, b: string) => d >= a && d <= b;
  const week = state.logs.filter(l => inRange(l.date, from, to));
  const prev = state.logs.filter(l => inRange(l.date, prevFrom, prevTo));

  const hours = week.reduce((a, l) => a + l.hours, 0);
  const timed = week.filter(isVerifiedLog).reduce((a, l) => a + l.hours, 0);
  const core = getCoreSubjects(state.examPreference || 'JEE');

  const sum = (logs: typeof week, s: Subject) => r1(logs.filter(l => l.subject === s).reduce((a, l) => a + l.hours, 0));
  const bySubject = core.map(s => ({ subject: s, hours: sum(week, s), prev: sum(prev, s) }));

  const planned = state.tasks.filter(t => t.origin === 'mentor' && t.dueAt && inRange(t.dueAt, from, to));

  return {
    from,
    to,
    hours: r1(hours),
    prevHours: r1(prev.reduce((a, l) => a + l.hours, 0)),
    studyDays: new Set(week.filter(l => l.hours > 0).map(l => l.date)).size,
    timedShare: hours > 0 ? Math.round((timed / hours) * 100) / 100 : null,
    bySubject,
    planned: planned.length,
    plannedDone: planned.filter(t => t.completed).length,
    cardsDone: state.tasks.filter(t => t.completed && t.completedAt && inRange(t.completedAt, from, to)).length,
    untouched: bySubject.filter(b => b.hours === 0).map(b => b.subject),
  };
};
