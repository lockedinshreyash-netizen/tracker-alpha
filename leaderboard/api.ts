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
}

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

/**
 * Publish (or refresh) the signed-in user's row for today.
 *
 * Upsert on the primary key, so a user only ever has one row and it is rewritten
 * as the day's hours climb. Returns false on any failure — the leaderboard is a
 * side feature and must never surface an error into the study flow.
 */
export const publishEntry = async (
  userId: string,
  displayName: string,
  logs: DailyLog[]
): Promise<boolean> => {
  const name = validateName(displayName);
  if (!name) return false;

  try {
    const { error } = await supabase
      .from('leaderboard_entries')
      .upsert(
        {
          user_id: userId,
          display_name: name,
          date: getISTDateString(),
          hours: hoursToday(logs),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );
    return !error;
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
}

/** Today's board, highest first. */
export const fetchBoard = async (limit = 100): Promise<BoardResult> => {
  try {
    const { data, error } = await supabase
      .from('leaderboard_entries')
      .select('user_id, display_name, hours')
      .eq('date', getISTDateString())
      .order('hours', { ascending: false })
      .limit(limit);

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
    return { rows: (data as LeaderboardRow[]) ?? [], error: null };
  } catch {
    return { rows: [], error: 'COULDN’T REACH THE LEADERBOARD.' };
  }
};
