/* ── Publishing what the server should hold ──
   A reconciler, not a set of per-mutation API calls.

   Tasks are mutated from App.tsx (add / update / move / toggle / delete), from
   three voice intents, from the board, and from the sync merge. A
   cancel-on-delete plus cancel-on-complete plus move-on-edit trio would need
   every one of those to remember, and the one that forgot would be the one that
   fires a push for a task the user threw away last week.

   The desired row set is a pure function of the tasks. Every cancellation then
   falls out of the diff with no code of its own. */

import { DailyLog, ReminderPrefs, Task } from '../types';
import { supabase } from '../supabaseClient';
import { dueInstant, fireKey } from './reminders';
import { fireCopy } from './reminders';
import { nudgePlan } from './nudgeState';

/* The gap between when the app would fire locally and when the server is
   allowed to. An app that is open — or that gets reopened — fires at T and
   deletes its own row well before T+90s, so the server only ever sends for an
   app that was genuinely shut.

   Ninety seconds is invisible on a deadline reminder and is comfortably wider
   than one cron tick plus a slow round trip. Without it, a foregrounded app and
   the cron land in the same minute and the user is told twice, which is the
   exact failure this whole arrangement exists to prevent. */
export const PUSH_LAG_MS = 90_000;

/* A task due in 2027 does not need a row sitting in a table for a year. The
   reconciler runs on every app open and rolls the horizon forward by itself. */
export const PUBLISH_HORIZON_DAYS = 7;

export interface ReminderRow {
  /** The fire key. Republishing the same fire is an upsert, never a duplicate. */
  id: string;
  user_id: string;
  fire_at: string;
  title: string;
  body: string;
}

export const desiredRows = (
  tasks: Task[],
  prefs: ReminderPrefs,
  userId: string,
  now: number,
): ReminderRow[] => {
  if (!prefs.enabled || !prefs.push) return [];
  const horizon = now + PUBLISH_HORIZON_DAYS * 86_400_000;

  const rows: ReminderRow[] = [];
  for (const task of tasks) {
    if (task.completed) continue;
    const at = dueInstant(task, prefs);
    if (at === null) continue;
    const key = fireKey(task.id, at);
    if (task.remindedKey === key) continue;   // already delivered somewhere
    if (at > horizon) continue;
    /* Already long past. The local engine drops these silently rather than
       announcing them, and the server must not announce them either. */
    if (at < now - 12 * 3_600_000) continue;

    const copy = fireCopy({ task, key, at }, prefs, at);
    rows.push({
      id: key,
      user_id: userId,
      fire_at: new Date(at + PUSH_LAG_MS).toISOString(),
      title: copy.title.slice(0, 120),
      body: copy.body.slice(0, 200),
    });
  }
  return rows;
};

/**
 * The day's nudges, as rows. Recomputed on every log, so the copy always
 * carries today's real numbers ("7.5H TO GO") and a goal met withdraws the
 * rest of the day. Nudges already said on some device are left out.
 */
export const nudgeRows = (
  logs: DailyLog[],
  goalHours: number,
  prefs: ReminderPrefs,
  userId: string,
  now: number,
): ReminderRow[] => {
  if (!prefs.nudge || !prefs.push) return [];
  const said = new Set(prefs.nudged ?? []);
  return nudgePlan(logs, goalHours, prefs, now)
    .filter(n => !said.has(n.key))
    .map(n => ({
      id: n.key,
      user_id: userId,
      fire_at: new Date(n.at + PUSH_LAG_MS).toISOString(),
      title: n.copy.title.slice(0, 120),
      body: n.copy.body.slice(0, 200),
    }));
};

/** A cheap identity for "have I already published exactly this?". */
export const signatureOf = (rows: ReminderRow[]): string =>
  rows.map(r => `${r.id}|${r.fire_at}|${r.title}|${r.body}`).sort().join('\n');

/**
 * Make the server hold exactly `desired`, and nothing else of this user's.
 *
 * Never deletes a row that has already been sent: that is the record of what
 * the user was actually told, and the function's own retention sweep owns it.
 * Nor a `check:` row: each device holds its own (publishCheck), and the
 * timer it is about runs on that device only.
 * Nor a `founder:` row: those are written by the database when the founder
 * replies to a note (supabase/support.sql) and withdrawn by it when the reply
 * is read, so they are not this device's to reconcile.
 */
export const reconcile = async (desired: ReminderRow[], userId: string): Promise<void> => {
  try {
    if (desired.length) {
      const { error } = await supabase.from('due_reminders').upsert(desired, { onConflict: 'id' });
      if (error) return;
    }

    const keep = desired.map(r => r.id);
    let query = supabase.from('due_reminders').delete().eq('user_id', userId).is('sent_at', null)
      .not('id', 'like', 'founder:%')
      .not('id', 'like', 'check:%');
    if (keep.length) query = query.not('id', 'in', `(${keep.map(k => `"${k}"`).join(',')})`);
    await query;
  } catch {
    /* Offline, or signed out mid-flight. Not an error path: the reconciler runs
       again on the next task change and on the next app open, and the local
       engine is unaffected either way. */
  }
};

/* ── "Still studying?" for a closed app (today/presence.ts) ──
   One row per device, `check:<device>@<instant>`, due at the check itself (no
   PUSH_LAG_MS: the open app deletes it the moment it pauses for the check, and
   the seen ledger covers the overlap). Every tap moves the check, which
   replaces the row; `at` null withdraws it. */
const deviceId = (): string => {
  try {
    let id = localStorage.getItem('alpha_device_v1');
    if (!id) { id = Math.random().toString(36).slice(2, 10); localStorage.setItem('alpha_device_v1', id); }
    return id;
  } catch {
    return 'device';
  }
};

let publishedCheck: string | null | undefined;

export const publishCheck = async (userId: string, at: number | null): Promise<void> => {
  const prefix = `check:${deviceId()}@`;
  const key = at === null || at <= Date.now() ? null : `${prefix}${at}`;
  if (key === publishedCheck) return;
  try {
    let del = supabase.from('due_reminders').delete().eq('user_id', userId).is('sent_at', null).like('id', `${prefix}%`);
    if (key) del = del.neq('id', key);
    await del;
    if (key) {
      await supabase.from('due_reminders').upsert({
        id: key,
        user_id: userId,
        fire_at: new Date(at as number).toISOString(),
        title: 'Still studying?',
        body: 'Your timer is paused. Open Alpha where it is running within 10 minutes, or this session is removed.',
      }, { onConflict: 'id' });
    }
    publishedCheck = key;
  } catch {
    /* Offline. The next tap or open publishes again. */
  }
};
