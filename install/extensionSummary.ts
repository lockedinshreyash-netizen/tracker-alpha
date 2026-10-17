/* ── What the new-tab extension may know ──
   The extension (extension/) turns every new tab into Alpha: the streak, today
   against the goal, the week, the exam countdown, what's on the board, and a
   live clock if a session is running. It never sees AppState. The app writes
   this small summary to one localStorage key, computed with the app's own
   logic (firewood included), and the extension's content script copies it
   into the extension's storage on this device. Nothing leaves the device.

   Computed here rather than in the extension so the two can never disagree
   about a streak: the ledger lives in one place. Bounded and text-only, and
   versioned so an old extension can tell a newer summary apart.

   After each write a DOM event wakes the content script; content scripts
   share the page's DOM and localStorage but not its JavaScript. */

import type { AppState } from '../types';
import { addDays, getISTDateString, istInstant, streakLedger } from '../utils';
import { SUBJECT_COLORS } from '../schedule/colors';
import { examDate, examLabel } from '../onboarding/answers';

export const SUMMARY_KEY = 'alpha_ext_summary_v1';
export const SUMMARY_EVENT = 'alpha:summary';

export interface ExtensionSummary {
  v: 1;
  /** When this was written, epoch ms. */
  at: number;
  /** The 04:00-IST study day it describes. */
  day: string;
  /** Epoch ms of the next 04:00 IST: past it, "today" in here is yesterday. */
  rollover: number;
  name: string | null;
  streak: number;
  best: number;
  bank: number;
  /** Held by firewood right now: yesterday was missed, today not yet logged. */
  holding: boolean;
  todayHours: number;
  goalHours: number;
  /** Last seven study days, oldest first, today last. */
  week: Array<{ day: string; hours: number }>;
  exam: { label: string; at: number };
  /** Doing first, then Todo. At most five. */
  tasks: Array<{ text: string; doing: boolean; color: string | null }>;
  /** A session in flight on this device, or null. */
  session: null | {
    kind: 'stopwatch' | 'pomodoro';
    subject: string;
    /** Stopwatch: start of the current run, or null when paused. */
    runningSince: number | null;
    /** Stopwatch: time banked by earlier runs. */
    bankedMs: number;
    /** Pomodoro: when the running phase ends, or null when paused. */
    endsAt: number | null;
    phase: string | null;
  };
}

const round1 = (h: number) => Math.round(h * 10) / 10;

export const buildSummary = (state: AppState, name: string | null, now = Date.now()): ExtensionSummary => {
  const day = getISTDateString(new Date(now));
  const ledger = streakLedger(state.logs, { today: day });
  const byDay = new Map<string, number>();
  for (const l of state.logs) byDay.set(l.date, (byDay.get(l.date) ?? 0) + (l.hours || 0));

  const t = state.timer;
  const p = state.pomodoro;
  const pomodoroArmed = !!p && p.phaseTotalMs !== null;
  const stopwatchArmed = !!t && (t.isRunning || (t.accumulatedMs ?? 0) > 0);

  const tasks = (state.tasks ?? [])
    .filter(task => !task.completed)
    .sort((a, b) => Number(b.column === 'doing') - Number(a.column === 'doing'))
    .slice(0, 5)
    .map(task => ({
      text: task.text.slice(0, 90),
      doing: task.column === 'doing',
      color: task.subject ? SUBJECT_COLORS[task.subject]?.dot ?? null : null,
    }));

  return {
    v: 1,
    at: now,
    day,
    rollover: istInstant(addDays(day, 1), 0),
    name: name ? name.slice(0, 40) : null,
    streak: ledger.streak,
    best: ledger.longest,
    bank: ledger.bank,
    holding: ledger.holding,
    todayHours: round1(byDay.get(day) ?? 0),
    goalHours: state.dailyGoalHours ?? 0,
    week: Array.from({ length: 7 }, (_, i) => {
      const d = addDays(day, i - 6);
      return { day: d, hours: round1(byDay.get(d) ?? 0) };
    }),
    exam: { label: examLabel(state.examPreference), at: examDate(state.examPreference).getTime() },
    tasks,
    session: pomodoroArmed
      ? { kind: 'pomodoro', subject: String(p.subject), runningSince: null, bankedMs: 0, endsAt: p.isRunning ? p.phaseEndsAt : null, phase: p.phase }
      : stopwatchArmed
        ? { kind: 'stopwatch', subject: String(t.subject), runningSince: t.isRunning ? t.startTime : null, bankedMs: t.accumulatedMs ?? 0, endsAt: null, phase: null }
        : null,
  };
};

/** Written on the device, read by the extension's content script. Never throws. */
export const publishSummary = (s: ExtensionSummary): void => {
  try {
    localStorage.setItem(SUMMARY_KEY, JSON.stringify(s));
    window.dispatchEvent(new Event(SUMMARY_EVENT));
  } catch {
    /* Private mode or a full quota: the new tab shows what it last had. */
  }
};
