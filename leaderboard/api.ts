/* ── Leaderboard data ──
   Talks to `leaderboard_entries` (see supabase/leaderboard.sql), which is
   deliberately separate from `user_profiles`: that table holds every user's
   whole AppState and must never be readable by anyone else. This one holds a
   chosen name, a date and an hour count, nothing more.

   Row-level security does the real enforcement — reads are open to signed-in
   users, writes are restricted to `auth.uid() = user_id`. Nothing here is a
   security boundary; a hostile client can only ever rewrite its own row. */

import { supabase } from '../supabaseClient';
import { DailyLog } from '../types';
import { getISTDateString } from '../utils';

export interface LeaderboardRow {
  user_id: string;
  display_name: string;
  hours: number;
  /* ── Race signals ──
     Absent when the row predates supabase/leaderboard.sql's second half, or
     when the whole extended select fell back (see fetchBoard). Every consumer
     has to treat them as optional. */
  updated_at?: string;
  is_studying?: boolean;
  active_since?: string | null;
  last_gain_at?: string | null;
}

/** What the app publishes about the session it is running right now. */
export interface ActivitySignal {
  isStudying: boolean;
  /** Epoch ms the running session started, or null when nothing is running. */
  activeSince: number | null;
}

export const IDLE_ACTIVITY: ActivitySignal = { isStudying: false, activeSince: null };

export const MIN_NAME = 2;
export const MAX_NAME = 24;

/** Mirrors the CHECK constraint, so bad input fails here rather than at the DB. */
export const validateName = (raw: string): string | null => {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < MIN_NAME) return null;
  return name.slice(0, MAX_NAME);
};

/* Only time the app measured itself. Hours typed in after the fact still count
   towards the user's own totals, streak and score — they just can't be ranked
   against other people, because there is nothing behind them but typing. */
const RANKED_SOURCES: ReadonlySet<string> = new Set(['timer', 'pomodoro']);

/** True if this log was measured by the stopwatch or a Pomodoro block. */
export const isRanked = (log: DailyLog): boolean => RANKED_SOURCES.has(log.source ?? '');

/**
 * Today's leaderboard total.
 *
 * Deliberately not the same as the number on the Today tab: that one is the
 * user's own record of their day and includes everything. Logs written before
 * `source` existed have no origin to verify, so they don't count either.
 */
export const hoursToday = (logs: DailyLog[]): number => {
  const today = getISTDateString();
  const total = logs
    .filter(l => l.date === today && isRanked(l))
    .reduce((sum, l) => sum + l.hours, 0);
  // Clamped to match the DB constraint; a corrupted local state can't post 900h.
  return Math.min(24, Math.max(0, Math.round(total * 100) / 100));
};

/** PostgREST/Postgres for "you asked for a column that isn't there". */
const isMissingColumn = (error: { code?: string; message?: string }): boolean =>
  error.code === '42703' ||
  error.code === 'PGRST204' ||
  /column .* does not exist/i.test(error.message || '');

/* ── last_gain_at ──
   The server can't tell a real gain from an activity heartbeat: both are the
   same upsert. So the client remembers what it last published for today and
   only moves the timestamp when the figure actually climbs. Kept in
   localStorage rather than a ref so a reload doesn't reset everyone's row to
   "just studied". */
const GAIN_KEY = 'race_last_gain_v1';

interface GainMemo { date: string; hours: number; at: number }

const readGainMemo = (): GainMemo | null => {
  try {
    const raw = localStorage.getItem(GAIN_KEY);
    return raw ? (JSON.parse(raw) as GainMemo) : null;
  } catch {
    return null;
  }
};

/** The moment today's total last increased, as an ISO string, or null. */
const stampGain = (date: string, hours: number, now: number): string | null => {
  const memo = readGainMemo();
  const fresh = !memo || memo.date !== date;
  // A first publish with real hours on it counts as a gain; a first publish of 0 doesn't.
  const gained = fresh ? hours > 0 : hours > memo.hours + 0.001;
  const at = gained ? now : (fresh ? 0 : memo.at);

  try {
    localStorage.setItem(GAIN_KEY, JSON.stringify({ date, hours, at } satisfies GainMemo));
  } catch {
    // Hardened browsers can refuse writes; the row still publishes without it.
  }
  return at ? new Date(at).toISOString() : null;
};

/**
 * Publish (or refresh) the signed-in user's row for today.
 *
 * Upsert on the primary key, so a user only ever has one row and it is rewritten
 * as the day's hours climb. Returns false on any failure — the leaderboard is a
 * side feature and must never surface an error into the study flow.
 *
 * Also republished on a heartbeat while the app is open, because the race
 * signals go stale: `is_studying` is only believable next to a recent
 * `updated_at`.
 */
export const publishEntry = async (
  userId: string,
  displayName: string,
  logs: DailyLog[],
  activity: ActivitySignal = IDLE_ACTIVITY
): Promise<boolean> => {
  const name = validateName(displayName);
  if (!name) return false;

  const now = Date.now();
  const date = getISTDateString();
  const hours = hoursToday(logs);

  const base = {
    user_id: userId,
    display_name: name,
    date,
    hours,
    updated_at: new Date(now).toISOString(),
  };
  const withRace = {
    ...base,
    is_studying: activity.isStudying,
    active_since: activity.activeSince ? new Date(activity.activeSince).toISOString() : null,
    last_gain_at: stampGain(date, hours, now),
  };

  try {
    const { error } = await supabase
      .from('leaderboard_entries')
      .upsert(withRace, { onConflict: 'user_id' });
    if (!error) return true;

    /* The race columns are a later migration. Rather than leave the board
       frozen for anyone who only ran the first half of leaderboard.sql, drop
       them and publish the hours — the part that actually ranks people. */
    if (!isMissingColumn(error)) return false;
    const { error: retry } = await supabase
      .from('leaderboard_entries')
      .upsert(base, { onConflict: 'user_id' });
    return !retry;
  } catch {
    return false;
  }
};

/** Remove the user from the board entirely. */
export const leaveBoard = async (userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase.from('leaderboard_entries').delete().eq('user_id', userId);
    return !error;
  } catch {
    return false;
  }
};

export interface BoardResult {
  rows: LeaderboardRow[];
  /** Set when the table or its policies aren't in place yet. */
  error: string | null;
  /* True when the board came back without its race columns. The ranking is
     still real; only the live signals — who is studying now, who has gone
     quiet — are missing, and the UI says so rather than inventing them. */
  degraded?: boolean;
}

const BASE_COLUMNS = 'user_id, display_name, hours';
const RACE_COLUMNS = `${BASE_COLUMNS}, updated_at, is_studying, active_since, last_gain_at`;

/** Today's board, highest first. */
export const fetchBoard = async (limit = 100): Promise<BoardResult> => {
  const query = (columns: string) =>
    supabase
      .from('leaderboard_entries')
      .select(columns)
      .eq('date', getISTDateString())
      .order('hours', { ascending: false })
      .limit(limit);

  try {
    let degraded = false;
    let { data, error } = await query(RACE_COLUMNS);

    if (error && isMissingColumn(error)) {
      degraded = true;
      ({ data, error } = await query(BASE_COLUMNS));
    }

    if (error) {
      /* PGRST205 is what PostgREST returns when the table isn't in its schema
         cache — i.e. supabase/leaderboard.sql hasn't been run. 42P01 is the raw
         Postgres equivalent. Worth naming, because otherwise the first person to
         open this tab just sees a generic network failure. */
      const missing =
        error.code === 'PGRST205' ||
        error.code === '42P01' ||
        /schema cache|does not exist/i.test(error.message || '');
      return {
        rows: [],
        error: missing
          ? 'LEADERBOARD TABLE NOT CREATED YET — RUN supabase/leaderboard.sql.'
          : 'COULDN’T REACH THE LEADERBOARD.',
      };
    }
    return { rows: ((data as unknown) as LeaderboardRow[]) ?? [], error: null, degraded };
  } catch {
    return { rows: [], error: 'COULDN’T REACH THE LEADERBOARD.' };
  }
};
