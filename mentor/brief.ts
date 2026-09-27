/* ── The only thing that leaves the device ──
   Same contract as insight/packet.ts, one level wider: the Mentor needs
   chapter names, card text and dates to plan anything, so it sends them. What
   it never sends is anything that identifies the student — no id, no name, no
   email, no chapter notes, no sleep, nothing about anybody else. The consent
   copy in MentorTab lists exactly this, and this file is where that list is
   kept true.

   Rebuilt on every turn, from live state. A conversation is not the record:
   if a chapter was finished since the last message, the model sees it done
   rather than trusting what was said three weeks ago. */

import { AppState, QSubject, Subject, Task } from '../types';
import { resolveExamDate, getCoreSubjects } from '../constants';
import { addDays, calculateStreak } from '../utils';
import { formatClock } from '../schedule/schedule';
import { normalizeMentor } from '../state';
import { calendarFrom, daysBetween, DAY_NAMES } from './dates';
import { dayCapacity, recentStudy } from './capacity';
import { FLAG_TEXT, personalFactor, summarize, syllabusFlags, syllabusRows } from './syllabus';
import { roadmapStatus } from './roadmap';
import { slippedTasks } from './replan';
import { weekdayOf } from '../utils';

/* ── Task handles ──
   The model refers to cards as t1, t2… rather than by id: a short handle
   costs fewer tokens, and a model cannot invent a handle the device will
   accept, whereas it can invent something shaped like an id. Handles live on
   the thread so an earlier "t3" still means the same card later. */
export type Handles = Record<string, string>; // taskId -> handle

export const handleOf = (handles: Handles, taskId: string): string => {
  if (handles[taskId]) return handles[taskId];
  const n = Object.keys(handles).length + 1;
  handles[taskId] = `t${n}`;
  return handles[taskId];
};

export const taskIdOf = (handles: Handles, handle: string): string | undefined =>
  Object.keys(handles).find(id => handles[id] === handle.trim().toLowerCase());

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export const taskLine = (t: Task, handles: Handles) => ({
  h: handleOf(handles, t.id),
  text: clip(t.text, 90),
  subject: t.subject,
  ...(t.chapter ? { chapter: t.chapter } : {}),
  ...(t.dueAt ? { dueAt: t.dueAt } : {}),
  ...(t.estMins ? { estMins: t.estMins } : {}),
  ...(t.column && t.column !== 'todo' ? { column: t.column } : {}),
  ...(t.origin ? { byMentor: true } : {}),
});

const r1 = (n: number) => Math.round(n * 10) / 10;

export const hoursBySubject = (state: AppState, from: string, to: string) => {
  const out: Partial<Record<Subject, number>> = {};
  let total = 0;
  const days = new Set<string>();
  for (const l of state.logs) {
    if (l.date < from || l.date > to) continue;
    out[l.subject] = r1((out[l.subject] || 0) + l.hours);
    total += l.hours;
    if (l.hours > 0) days.add(l.date);
  }
  return { hours: r1(total), studyDays: days.size, bySubject: out };
};

export interface SnapshotInput {
  state: AppState;
  today: string;
  /** Study-day minute of now. */
  now: number;
  handles: Handles;
  /** Engine output for a quick action, when there is one. */
  prepared?: unknown;
}

export const buildSnapshot = ({ state, today, now, handles, prepared }: SnapshotInput) => {
  const exam = state.examPreference || 'JEE';
  const examDate = resolveExamDate(exam, state.examDates);
  const mentor = normalizeMentor(state.mentor);

  const rows = syllabusRows(state);
  const factor = personalFactor(state, rows);
  const summary = summarize(rows, factor);
  const flags = syllabusFlags(state, rows);

  const bySubject: Record<string, unknown> = {};
  for (const [subject, s] of Object.entries(summary.bySubject)) {
    if (!s) continue;
    bySubject[subject] = {
      done: s.completed, revision: s.revision, inProgress: s.inProgress, notStarted: s.notStarted,
      total: s.total, hoursLeft: [s.hoursLeft.low, s.hoursLeft.mid, s.hoursLeft.high],
    };
  }

  const open = state.tasks.filter(t => !t.completed);
  const overdue = open.filter(t => t.dueAt && t.dueAt < today).sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));
  const recent = recentStudy(state.logs, today);
  const capToday = dayCapacity(state, today, today, now);
  const tomorrow = addDays(today, 1);
  const capTomorrow = dayCapacity(state, tomorrow, today);
  const status = roadmapStatus(state, today);
  const todayHours = r1(state.logs.filter(l => l.date === today).reduce((a, l) => a + l.hours, 0));

  const qFrom = addDays(today, -6);
  const questions: Partial<Record<QSubject, number>> = {};
  for (const d of state.questionTracking.dailyQuestionsLog) {
    if (d.date < qFrom || d.date > today) continue;
    for (const [k, v] of Object.entries(d.counts)) questions[k as QSubject] = (questions[k as QSubject] || 0) + (v || 0);
  }

  return {
    now: { date: today, day: DAY_NAMES[weekdayOf(today)], time: formatClock(now), note: 'Study days roll over at 4:00 AM IST.' },
    calendar: calendarFrom(today, 14),
    exam: {
      name: exam,
      date: examDate.date,
      daysLeft: Math.max(0, daysBetween(today, examDate.date)),
      placeholder: examDate.isDefault,
    },
    syllabusDeadline: mentor.prefs.syllabusBy,
    currentClass: state.currentClass,
    subjects: getCoreSubjects(exam),
    syllabus: {
      percentDone: summary.percentDone,
      done: summary.done,
      total: summary.total,
      hoursLeft: [summary.hoursLeft.low, summary.hoursLeft.mid, summary.hoursLeft.high],
      hoursAreEstimates: true,
      calibratedOnChapters: factor.basis,
      bySubject,
      warnings: flags.map(f => FLAG_TEXT[f]),
    },
    study: {
      streak: calculateStreak(state.logs),
      today: { hours: todayHours, goal: state.dailyGoalHours },
      last7: hoursBySubject(state, addDays(today, -7), addDays(today, -1)),
      last30: hoursBySubject(state, addDays(today, -30), addDays(today, -1)),
      avgPerDayLast14: r1(recent.avgPerDay),
      questionsLast7: questions,
    },
    capacity: {
      today: { minutes: capToday.minutes, basis: capToday.basis, notes: capToday.notes },
      tomorrow: { minutes: capTomorrow.minutes, basis: capTomorrow.basis, notes: capTomorrow.notes },
    },
    tasks: {
      open: open.length,
      overdue: overdue.length,
      dueToday: open.filter(t => t.dueAt === today).length,
      dueTomorrow: open.filter(t => t.dueAt === tomorrow).length,
      overdueList: overdue.slice(0, 6).map(t => taskLine(t, handles)),
      slippedMentorCards: slippedTasks(state.tasks, today).length,
    },
    roadmap: status
      ? {
        target: status.targetDate,
        revision: status.revision,
        thisWeek: status.thisWeek.slice(0, 10).map(i => ({ subject: i.subject, chapter: i.chapter, action: i.action, hours: i.hours, done: i.done })),
        behind: status.behind.slice(0, 8).map(i => ({ subject: i.subject, chapter: i.chapter, hours: i.hours })),
        behindHours: status.behindHours,
      }
      : null,
    prefs: {
      weeklyHours: mentor.prefs.weeklyHours,
      restDays: mentor.prefs.restDays.map(d => DAY_NAMES[d]),
    },
    ...(prepared ? { prepared } : {}),
  };
};

export type Snapshot = ReturnType<typeof buildSnapshot>;
