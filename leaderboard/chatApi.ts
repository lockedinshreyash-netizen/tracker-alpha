/* ── Race chat data ──
   Talks to `race_chat_messages` (see supabase/race_chat.sql). One room per
   Race, and the Race's own identifier — the IST study-day string
   `getISTDateString()` computes — is what a message is filed under; see that
   migration for why there's no separate `races` table to point at instead.

   Row-level security does the real enforcement, exactly as leaderboard/api.ts
   describes for the board itself: reads are open to signed-in users, writes
   are restricted to `auth.uid() = user_id`. Nothing here is a security
   boundary. */

import { supabase } from '../supabaseClient';

export interface RaceChatMessage {
  id: string;
  race_date: string;
  user_id: string;
  display_name: string;
  message: string;
  created_at: string;
}

export const MIN_MESSAGE = 1;
export const MAX_MESSAGE = 500;

/** How many messages a race chat opens with. Enough for context, not a scroll. */
export const HISTORY_LIMIT = 50;

/**
 * Mirrors the CHECK constraint, so an empty or oversized message fails here
 * rather than at the DB. Internal newlines survive — Shift+Enter writes a
 * real one — collapsed only so a wall of blank lines can't be used to make
 * one message occupy the whole panel.
 */
export const validateMessage = (raw: string): string | null => {
  const trimmed = raw.trim().replace(/\n{3,}/g, '\n\n');
  if (trimmed.length < MIN_MESSAGE || trimmed.length > MAX_MESSAGE) return null;
  return trimmed;
};

/**
 * Whatever went wrong, in words that don't require reading Postgres.
 * Mirrors feedback/api.ts's humanError — same three failures actually happen
 * here: not set up yet, not authorized, no connection.
 */
export const humanError = (error: unknown): string => {
  const e = error as { code?: string; message?: string } | null;
  const code = e?.code ?? '';
  const message = e?.message ?? '';

  if (code === '42501' || /row-level security|not authorized/i.test(message)) {
    return "You don't have permission to do that.";
  }
  if (code === '42P01' || code === 'PGRST202' || code === 'PGRST205'
    || /does not exist|could not find the (table|function)/i.test(message)) {
    return 'Race chat isn’t set up yet — run supabase/race_chat.sql.';
  }
  if (code === '23514' || /violates check constraint/i.test(message)) {
    return 'Message too long — trim it down.';
  }
  if (/failed to fetch|network|timeout/i.test(message)) {
    return 'No connection. Check your network and try again.';
  }
  return 'Couldn’t send that. Try again in a moment.';
};

/** The current race's messages, oldest first — chronological the way a chat reads. */
export const fetchMessages = async (raceDate: string): Promise<RaceChatMessage[]> => {
  const { data, error } = await supabase
    .from('race_chat_messages')
    .select('id, race_date, user_id, display_name, message, created_at')
    .eq('race_date', raceDate)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) throw error;
  return ((data ?? []) as RaceChatMessage[]).reverse();
};

/**
 * Post a message to today's race.
 *
 * `user_id` is sent explicitly and also pinned by the insert policy's WITH
 * CHECK — the second one is the one that matters, the first only makes the
 * request valid. Returns the inserted row so the caller can reconcile it
 * against the optimistic entry it already showed.
 */
export const sendMessage = async (
  userId: string,
  displayName: string,
  raceDate: string,
  message: string
): Promise<RaceChatMessage> => {
  const { data, error } = await supabase
    .from('race_chat_messages')
    .insert({
      race_date: raceDate,
      user_id: userId,
      display_name: displayName,
      message,
    })
    .select('id, race_date, user_id, display_name, message, created_at')
    .single();

  if (error) throw error;
  return data as RaceChatMessage;
};
