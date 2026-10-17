/* ── "I am here" ──
   What the app tells the server about itself so the console can count heads:
   that this account was open today, what today's logs add up to, and a dozen
   counts about how the app is set up. supabase/analytics.sql §4 receives it.

   Deliberately thin. No log, task, chapter name or note leaves the device —
   the server already holds the synced blob and does not need a second copy of
   anybody's life to draw a DAU line. Everything here is a number or a flag,
   built by pure functions so the debug board and the real ping agree. */

import { supabase } from '../supabaseClient';
import type { AppState, DailyLog } from '../types';
import { addDays, calculateStreak, getISTDateString, isVerifiedLog } from '../utils';
import { isIOS, isStandalone } from '../install/useInstall';
import { type KeepMethod, keepMethodFor, readEnv } from '../install/platform';
import { readKeep } from '../install/keepState';

/* Which way this device keeps Alpha close, and whether it has. Bookmarks and
   calendar blocks are known only from the gesture that made them
   (install/keepState.ts); a home-screen launch is known for certain. */
const keepFacts = (): { keep: KeepMethod; kept: boolean } => {
  if (typeof window === 'undefined') return { keep: 'none', kept: false };
  const standalone = isStandalone();
  return {
    keep: keepMethodFor(readEnv({ standalone })),
    kept: standalone || readKeep().via.length > 0,
  };
};

export interface DayReport {
  day: string;
  hours: number;
  tracked: number;
  sessions: number;
}

export interface UsageFacts {
  exam: 'JEE' | 'NEET';
  class: 11 | 12;
  streak: number;
  goal: number;
  timer: 'stopwatch' | 'pomodoro';
  theme: 'dark' | 'light';
  plan: number;
  tasks: number;
  mocks: number;
  errors: number;
  started: number;
  done: number;
  rewards: number;
  race: boolean;
  reminders: boolean;
  /** How this device keeps Alpha close (install/platform.ts). */
  keep: KeepMethod;
  /** Installed, bookmarked or added to the calendar, on this device. */
  kept: boolean;
  nudges: boolean;
}

export type Platform = 'ios' | 'android' | 'desktop' | 'other';

export interface Ping {
  /** A new visit: page load, or back after a 30-minute gap. */
  open: boolean;
  platform: Platform;
  installed: boolean;
  days: DayReport[];
  facts?: UsageFacts;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** One study day's logs, totalled the way groups/publish.ts totals them. */
export const dayReport = (logs: DailyLog[], day: string): DayReport => {
  let hours = 0;
  let tracked = 0;
  let sessions = 0;
  for (const log of logs) {
    if (log.date !== day || !(log.hours > 0)) continue;
    hours += log.hours;
    if (isVerifiedLog(log)) tracked += log.hours;
    sessions += 1;
  }
  const h = Math.min(24, round2(hours));
  return { day, hours: h, tracked: Math.min(h, round2(tracked)), sessions: Math.min(500, sessions) };
};

/** Today and yesterday — yesterday because a Pomodoro bell settled after 04:00 still belongs to it. */
export const recentDays = (logs: DailyLog[], today = getISTDateString()): DayReport[] =>
  [dayReport(logs, today), dayReport(logs, addDays(today, -1))];

/** A cheap signature, so an unchanged day is not sent again. */
export const daysSignature = (days: DayReport[]): string =>
  days.map(d => `${d.day}:${d.hours}:${d.tracked}:${d.sessions}`).join('|');

const DONE: ReadonlySet<string> = new Set(['completed', 'revision_pending']);

/** How this person has the app set up. Counts and flags only. */
export const usageFacts = (state: AppState): UsageFacts => {
  const schedule = state.schedule;
  const mocks = state.mocks;
  const progress = Array.isArray(state.progress) ? state.progress : [];
  return {
    exam: state.examPreference === 'NEET' ? 'NEET' : 'JEE',
    class: state.currentClass === 12 ? 12 : 11,
    streak: calculateStreak(Array.isArray(state.logs) ? state.logs : []),
    goal: Number.isFinite(state.dailyGoalHours) ? Math.max(0, Math.min(24, state.dailyGoalHours)) : 0,
    timer: state.timerMode === 'pomodoro' ? 'pomodoro' : 'stopwatch',
    theme: state.theme === 'light' ? 'light' : 'dark',
    plan: (schedule?.blocks?.length ?? 0) + (schedule?.rules?.length ?? 0),
    tasks: Array.isArray(state.tasks) ? state.tasks.length : 0,
    mocks: mocks?.tests?.filter(t => !!t.result).length ?? 0,
    errors: mocks?.errors?.length ?? 0,
    started: progress.filter(p => p.status !== 'not_started').length,
    done: progress.filter(p => DONE.has(p.status)).length,
    rewards: Object.keys(state.rewards?.unlocked ?? {}).length,
    race: !!state.leaderboard?.enabled,
    reminders: !!state.reminders?.push,
    ...keepFacts(),
    nudges: !!state.reminders?.nudge,
  };
};

export const detectPlatform = (): Platform => {
  if (typeof navigator === 'undefined') return 'other';
  if (isIOS()) return 'ios';
  if (/android/i.test(navigator.userAgent)) return 'android';
  if (/mobi|tablet|silk|kindle|playbook/i.test(navigator.userAgent)) return 'other';
  return 'desktop';
};

/** 'missing' when analytics.sql has not been run, so the caller can stop asking. */
export const sendPing = async (ping: Ping): Promise<'ok' | 'missing' | 'failed'> => {
  const { error } = await supabase.rpc('track_activity', { p: ping });
  if (!error) return 'ok';
  const code = (error as { code?: string }).code ?? '';
  if (code === 'PGRST202' || code === '42883' || /could not find the function/i.test(error.message ?? '')) {
    return 'missing';
  }
  return 'failed';
};

/* ── When this device last opened a visit, per user ──
   Only so a refresh storm counts as one visit. Losing it costs one extra
   visit in the count, never a wrong day. */
const visitKey = (userId: string) => `analytics_visit_v1:${userId}`;

export const VISIT_GAP_MS = 30 * 60_000;

/** True if this moment starts a new visit (and records that it did). */
export const claimVisit = (userId: string, now = Date.now(), today = getISTDateString()): boolean => {
  try {
    const raw = localStorage.getItem(visitKey(userId));
    const last = raw ? JSON.parse(raw) as { day?: string; at?: number } : null;
    const fresh = !last || last.day !== today || typeof last.at !== 'number' || now - last.at >= VISIT_GAP_MS;
    localStorage.setItem(visitKey(userId), JSON.stringify({ day: today, at: now }));
    return fresh;
  } catch {
    return true;
  }
};

/** Keeps the current visit alive while the app is in use. */
export const touchVisit = (userId: string, now = Date.now(), today = getISTDateString()): void => {
  try { localStorage.setItem(visitKey(userId), JSON.stringify({ day: today, at: now })); } catch { /* next load re-claims */ }
};

export const platformPing = (): Pick<Ping, 'platform' | 'installed'> => ({
  platform: detectPlatform(),
  installed: isStandalone(),
});

/** Sign-out: nothing personal is in it, but nothing of one account should outlive it on a shared device. */
export const forgetAnalyticsOnDevice = (): void => {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith('analytics_visit_v1:'))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* nothing to do */ }
};
