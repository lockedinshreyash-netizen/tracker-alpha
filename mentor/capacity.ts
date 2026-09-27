/* ── How much a day can actually hold ──
   The planner's first question, and the one a todo generator never asks.

   Four sources, in the order they are trusted:
     1. What the student said (MentorPrefs.weeklyHours / restDays).
     2. What they have actually been doing (the last 14 days of logs).
     3. What the timetable leaves free (non-study blocks on the Plan tab).
     4. Their daily goal, when there is nothing else.

   Stated and actual are combined by taking the smaller: a student who says six
   hours and has been doing three will get a three-hour plan with a little
   stretch, because a plan that fails on day one teaches them to ignore the
   next one. Then it is scaled by how much of the Mentor's own recent plans got
   done — a planner that keeps overfilling days should notice. */

import { AppState, DailyLog, ScheduleState, Task } from '../types';
import { addDays, weekdayOf } from '../utils';
import { materializeDay } from '../schedule/schedule';
import { countsAsStudy } from '../schedule/colors';
import { normalizeMentor } from '../state';

/** Never plan more than this in a day, whatever anyone says. The users are teenagers. */
export const MAX_DAY_MINUTES = 12 * 60;
/* A day's plan leaves room: interruptions happen, and a plan with no slack is
   a plan that is already late at 10 am. */
export const PLAN_FILL = 0.9;
const HISTORY_DAYS = 14;
const STRETCH = 1.15;

export interface RecentStudy {
  /** Hours per calendar day over the window, zero days included — real throughput. */
  avgPerDay: number;
  /** Hours per day on days something was logged. */
  avgPerStudyDay: number;
  /** 75th percentile of hours on study days — a good day, not a fantasy. */
  p75: number;
  studyDays: number;
  windowDays: number;
}

/** The last `days` complete days, today excluded — today is still being written. */
export const recentStudy = (logs: DailyLog[], today: string, days = HISTORY_DAYS): RecentStudy => {
  const from = addDays(today, -days);
  const perDay = new Map<string, number>();
  for (const l of logs) {
    if (l.date >= from && l.date < today) perDay.set(l.date, (perDay.get(l.date) || 0) + l.hours);
  }
  const values = [...perDay.values()].filter(h => h > 0).sort((a, b) => a - b);
  const total = values.reduce((a, b) => a + b, 0);
  const p75 = values.length ? values[Math.min(values.length - 1, Math.floor(values.length * 0.75))] : 0;
  return {
    avgPerDay: total / days,
    avgPerStudyDay: values.length ? total / values.length : 0,
    p75,
    studyDays: values.length,
    windowDays: days,
  };
};

/**
 * Minutes on a study day not covered by a non-study block, or null when the
 * student has put nothing on the timeline for that day — "unknown" and "all
 * 24 hours free" are very different answers.
 */
export const freeMinutes = (schedule: ScheduleState, date: string, fromMinute = 0): number | null => {
  /* Every non-study kind takes time away from studying. `break` counts: it is
     time that is spoken for. */
  const blocks = materializeDay(schedule, date).filter(b => !countsAsStudy(b.kind));
  if (!blocks.length) return null;
  /* Union of intervals, so two overlapping commitments are not subtracted twice. */
  const spans = blocks
    .map(b => [Math.max(fromMinute, b.start), Math.max(fromMinute, b.start + b.durationMins)] as const)
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  let busy = 0;
  let curS = -1;
  let curE = -1;
  for (const [s, e] of spans) {
    if (s > curE) {
      if (curE > curS) busy += curE - curS;
      curS = s;
      curE = e;
    } else curE = Math.max(curE, e);
  }
  if (curE > curS) busy += curE - curS;
  return Math.max(0, 1440 - fromMinute - busy);
};

export const plannedStudyMinutes = (schedule: ScheduleState, date: string): number =>
  materializeDay(schedule, date)
    .filter(b => countsAsStudy(b.kind))
    .reduce((a, b) => a + b.durationMins, 0);

/**
 * Share of the Mentor's own planned minutes that were done, over the last two
 * weeks of days that are already over. Null until there are enough cards to
 * mean anything.
 */
export const planCompletion = (tasks: Task[], today: string): number | null => {
  const from = addDays(today, -HISTORY_DAYS);
  const planned = tasks.filter(t => t.origin === 'mentor' && t.dueAt && t.dueAt >= from && t.dueAt < today);
  if (planned.length < 5) return null;
  const mins = (t: Task) => t.estMins || 45;
  const total = planned.reduce((a, t) => a + mins(t), 0);
  const done = planned.filter(t => t.completed).reduce((a, t) => a + mins(t), 0);
  return total > 0 ? done / total : null;
};

export type CapacityBasis = 'stated' | 'history' | 'stated+history' | 'goal' | 'rest_day';

export interface DayCapacity {
  date: string;
  /** Realistic study minutes still available on this day. */
  minutes: number;
  basis: CapacityBasis;
  /** Timetable-free minutes, or null when the timetable says nothing. */
  free: number | null;
  /** Minutes already logged (today only). */
  studied: number;
  /** Plain-language notes on how this was arrived at — shown as assumptions. */
  notes: string[];
}

export const dayCapacity = (
  state: AppState,
  date: string,
  today: string,
  /** Study-day minute of "now", when `date` is today. */
  now?: number,
): DayCapacity => {
  const prefs = normalizeMentor(state.mentor).prefs;
  const wd = weekdayOf(date);
  const notes: string[] = [];

  if (prefs.restDays.includes(wd)) {
    return { date, minutes: 0, basis: 'rest_day', free: null, studied: 0, notes: ['Rest day'] };
  }

  const stated = prefs.weeklyHours ? prefs.weeklyHours[wd] * 60 : null;
  const recent = recentStudy(state.logs, today);
  const history = recent.studyDays >= 5 ? Math.round(recent.p75 * STRETCH * 60) : null;

  let minutes: number;
  let basis: CapacityBasis;
  if (stated !== null && history !== null) {
    minutes = Math.min(stated, history);
    basis = 'stated+history';
    if (history < stated) notes.push(`Capped to your recent good days (~${(history / 60).toFixed(1)}h), below the ${(stated / 60).toFixed(1)}h you set`);
  } else if (stated !== null) {
    minutes = stated;
    basis = 'stated';
  } else if (history !== null) {
    minutes = history;
    basis = 'history';
    notes.push(`Based on your last ${recent.windowDays} days, not hours you have told the Mentor`);
  } else {
    minutes = Math.round(state.dailyGoalHours * 60);
    basis = 'goal';
    notes.push('Not enough history yet — using your daily goal');
  }

  const completion = planCompletion(state.tasks, today);
  if (completion !== null && completion < 0.9) {
    const k = Math.max(0.5, completion);
    minutes = Math.round(minutes * k);
    notes.push(`Scaled to ${Math.round(k * 100)}% — the share of recent Mentor plans that got done`);
  }

  const isToday = date === today;
  const free = freeMinutes(state.schedule ?? { blocks: [], rules: [], overrides: [] }, date, isToday && now !== undefined ? now : 0);
  if (free !== null) {
    /* Free time is not all study time: travel between things, eating, the
       phone. Three-quarters of it is already generous. */
    const usable = Math.round(free * 0.75);
    if (usable < minutes) {
      minutes = usable;
      notes.push('Limited by what your timetable leaves free');
    }
  }

  let studied = 0;
  if (isToday) {
    studied = Math.round(state.logs.filter(l => l.date === date).reduce((a, l) => a + l.hours, 0) * 60);
    minutes = Math.max(0, minutes - studied);
    /* With no timetable, the day still ends. 23:00 is minute 1140 on the
       study-day axis; whatever is left before it bounds what can be planned. */
    if (free === null && now !== undefined) {
      const left = Math.max(0, 1140 - now);
      if (left * 0.75 < minutes) {
        minutes = Math.round(left * 0.75);
        notes.push('Limited by how much of today is left');
      }
    }
  }

  return { date, minutes: Math.max(0, Math.min(MAX_DAY_MINUTES, minutes)), basis, free, studied, notes };
};
