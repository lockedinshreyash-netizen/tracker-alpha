/* ── What a group can see of you, and nothing more ──
   The source of truth never leaves the device's own AppState: `logs` and
   `tasks`. This file derives the two narrow projections supabase/groups.sql
   reads for other members — one row per study day with two hour totals, and
   one snapshot of today's board — and publishes the difference from what was
   last sent.

   The derivation is pure and the publish is a reconciler, not a set of calls
   sprinkled through the mutators. Every change to a log (a new session, an
   edit, a deletion, a sync from another device) arrives here the same way,
   as a new `logs` array, so there is exactly one path that can make the
   published figure wrong and it is this one. reminders/publish.ts takes the
   same stance for the same reason. */

import { supabase } from '../supabaseClient';
import { DailyLog, Task } from '../types';
import { isVerifiedLog } from '../utils';
import { SharedTask, TaskShareLevel } from './api';

export interface DayTotals {
  hours: number;
  tracked: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
/* Clamped to the table's CHECK. A corrupted local state must not make the
   whole batch fail, and a single impossible day is better published as 24
   than dropped. */
const clampDay = (n: number): number => Math.min(24, Math.max(0, round2(n)));

/** Every study day in the history, totalled. Pure. */
export const studyDays = (logs: DailyLog[]): Map<string, DayTotals> => {
  const raw = new Map<string, DayTotals>();
  for (const log of logs) {
    if (!log.date || !(log.hours > 0)) continue;
    const day = raw.get(log.date) ?? { hours: 0, tracked: 0 };
    day.hours += log.hours;
    if (isVerifiedLog(log)) day.tracked += log.hours;
    raw.set(log.date, day);
  }
  const out = new Map<string, DayTotals>();
  raw.forEach((d, date) => {
    const hours = clampDay(d.hours);
    // Rounded separately, then held under the total, so tracked <= hours
    // always satisfies the constraint even when clamping bites.
    out.set(date, { hours, tracked: Math.min(hours, clampDay(d.tracked)) });
  });
  return out;
};

const LEVEL_RANK: Record<TaskShareLevel, number> = { private: 0, summary: 1, tasks: 2 };

/** The most any one group is allowed to see — what has to be published at all. */
export const widestLevel = (levels: TaskShareLevel[]): TaskShareLevel =>
  levels.reduce<TaskShareLevel>((best, l) => (LEVEL_RANK[l] > LEVEL_RANK[best] ? l : best), 'private');

export interface TaskSnapshot {
  date: string;
  done: number;
  total: number;
  tasks: SharedTask[] | null;
}

const MAX_SHARED_TASKS = 50;
const MAX_TASK_TEXT = 200;

/**
 * Today's board as a group would see it.
 *
 * "Today" is everything still open plus everything ticked off today — which is
 * the board the user is looking at, minus the history below the Done fold. A
 * task finished before `completedAt` existed has no day and is not counted as
 * today's, the same rule share/stats.ts follows.
 */
export const taskSnapshot = (tasks: Task[], today: string, level: TaskShareLevel): TaskSnapshot => {
  const open = tasks.filter(t => !t.completed);
  const doneToday = tasks.filter(t => t.completed && t.completedAt === today);
  const columnRank = (t: Task) => (t.column === 'doing' ? 0 : t.completed ? 2 : 1);

  const list = level === 'tasks'
    ? [...open, ...doneToday]
        .sort((a, b) => columnRank(a) - columnRank(b) || (a.order ?? 0) - (b.order ?? 0))
        .slice(0, MAX_SHARED_TASKS)
        .map<SharedTask>(t => ({
          text: t.text.slice(0, MAX_TASK_TEXT),
          done: t.completed,
          ...(t.subject ? { subject: t.subject } : {}),
        }))
    : null;

  return {
    date: today,
    done: Math.min(doneToday.length, 500),
    total: Math.min(open.length + doneToday.length, 500),
    tasks: list,
  };
};

/* ── The ledger of what this device last published ──
   Per user, in localStorage: it is only an optimisation — the first publish of
   every session ignores it and sends everything (see `publishStudyDays`), so
   a lost or stale ledger costs one larger request, never a wrong figure. */
const ledgerKey = (userId: string) => `groups_published_v1:${userId}`;

interface Ledger {
  days: Record<string, string>;
  task: string | null;
}

const readLedger = (userId: string): Ledger => {
  try {
    const raw = localStorage.getItem(ledgerKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Ledger>;
      return { days: parsed.days ?? {}, task: parsed.task ?? null };
    }
  } catch {
    // Private mode or corrupted JSON — start empty, which means "send it all".
  }
  return { days: {}, task: null };
};

const writeLedger = (userId: string, ledger: Ledger): void => {
  try {
    localStorage.setItem(ledgerKey(userId), JSON.stringify(ledger));
  } catch {
    // The next session's full publish covers it.
  }
};

/** True if this device has ever published anything for this user. */
export const hasLedger = (userId: string): boolean => {
  try { return localStorage.getItem(ledgerKey(userId)) !== null; } catch { return false; }
};

export const clearLedger = (userId: string): void => {
  try { localStorage.removeItem(ledgerKey(userId)); } catch { /* nothing to do */ }
};

const sig = (d: DayTotals) => `${d.hours}|${d.tracked}`;
const CHUNK = 500;

/**
 * Upsert every day whose totals differ from the ledger — and, with `full`,
 * every day, full stop. A day that has vanished from the logs (every log on it
 * deleted) is published as zero rather than deleted: an upsert is idempotent
 * whichever device sends it, a delete racing an upsert is not.
 *
 * Returns false on any failure. Groups are a side feature and must never
 * surface an error into the study flow.
 */
export const publishStudyDays = async (userId: string, logs: DailyLog[], full: boolean): Promise<boolean> => {
  const ledger = readLedger(userId);
  const current = studyDays(logs);
  const rows: { user_id: string; date: string; hours: number; tracked_hours: number; updated_at: string }[] = [];
  const now = new Date().toISOString();

  current.forEach((d, date) => {
    if (full || ledger.days[date] !== sig(d)) {
      rows.push({ user_id: userId, date, hours: d.hours, tracked_hours: d.tracked, updated_at: now });
    }
  });
  Object.keys(ledger.days).forEach(date => {
    if (!current.has(date) && ledger.days[date] !== sig({ hours: 0, tracked: 0 })) {
      rows.push({ user_id: userId, date, hours: 0, tracked_hours: 0, updated_at: now });
    }
  });
  if (!rows.length) return true;

  try {
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase
        .from('study_days')
        .upsert(rows.slice(i, i + CHUNK), { onConflict: 'user_id,date' });
      if (error) return false;
    }
  } catch {
    return false;
  }

  const days: Record<string, string> = {};
  current.forEach((d, date) => { days[date] = sig(d); });
  rows.forEach(r => { if (!current.has(r.date)) days[r.date] = sig({ hours: 0, tracked: 0 }); });
  writeLedger(userId, { ...readLedger(userId), days });
  return true;
};

/** Publish today's task snapshot at `level`, or remove it at 'private'. */
export const publishTaskShare = async (
  userId: string,
  tasks: Task[],
  today: string,
  level: TaskShareLevel,
  full: boolean
): Promise<boolean> => {
  const ledger = readLedger(userId);
  const snapshot = level === 'private' ? null : taskSnapshot(tasks, today, level);
  const signature = snapshot ? JSON.stringify(snapshot) : 'none';
  if (!full && ledger.task === signature) return true;

  try {
    if (snapshot) {
      const { error } = await supabase.from('task_shares').upsert(
        { user_id: userId, ...snapshot, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
      if (error) return false;
    } else {
      const { error } = await supabase.from('task_shares').delete().eq('user_id', userId);
      if (error) return false;
    }
  } catch {
    return false;
  }

  writeLedger(userId, { ...readLedger(userId), task: signature });
  return true;
};

/**
 * Out of every group: nothing of yours needs to be on the server any more,
 * because nobody is left who could read it. Best-effort.
 */
export const withdrawAll = async (userId: string): Promise<void> => {
  try {
    await supabase.from('study_days').delete().eq('user_id', userId);
    await supabase.from('task_shares').delete().eq('user_id', userId);
    clearLedger(userId);
  } catch {
    // Unreadable to anyone anyway; the next session retries.
  }
};

/**
 * Sign-out: everything Groups keeps on this device — the publish ledger, any
 * unsent messages, the last-opened group — goes with the account. A shared
 * laptop's next user must not inherit a previous user's outbox.
 */
export const forgetGroupsOnDevice = (): void => {
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('groups_') || key.startsWith('group_outbox_v1:')) localStorage.removeItem(key);
    });
  } catch {
    // Storage unavailable — nothing was kept there either.
  }
};
