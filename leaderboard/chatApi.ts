/* ── Race chat data ──
   Talks to `race_chat_messages` (see supabase/race_chat.sql). One room per
   Race, and the Race's own identifier — the IST study-day string
   `getISTDateString()` computes — is what a message is filed under; see that
   migration for why there's no separate `races` table to point at instead.

   Row-level security does the real enforcement, exactly as leaderboard/api.ts
   describes for the board itself: reads are open to signed-in users, writes
   are restricted to `auth.uid() = user_id`. Nothing here is a security
   boundary.

   Replies, reactions and deletion arrived later, shaped like group chat's
   (groups/chatApi.ts): a page is fetched with its reactions embedded, a reply
   above the loaded window has its parent looked up by id, and reactions and
   deletion go through RPCs. */

import { supabase } from '../supabaseClient';
import { ReactionRow } from '../chat/reactions';

export interface RaceChatMessage {
  id: string;
  race_date: string;
  user_id: string;
  display_name: string;
  message: string;
  created_at: string;
  /** Soft-deleted: the body is blank. Absent on a schema that predates deletion. */
  deleted_at?: string | null;
  /** The message this one answers. */
  reply_to?: string | null;
}

export interface RaceReaction extends ReactionRow {
  message_id: string;
}

/** Just enough of a message to draw it as a quote. */
export interface QuotedRaceMessage {
  id: string;
  user_id: string;
  display_name: string;
  message: string;
  deleted_at: string | null;
}

export interface RacePage {
  messages: RaceChatMessage[];
  reactions: RaceReaction[];
}

export const MIN_MESSAGE = 1;
export const MAX_MESSAGE = 500;

/** How many messages a race chat opens with. Enough for context, not a scroll. */
export const HISTORY_LIMIT = 50;

const BASE_COLUMNS = 'id, race_date, user_id, display_name, message, created_at';
const COLUMNS = `${BASE_COLUMNS}, deleted_at, reply_to`;
const PAGE_COLUMNS = `${COLUMNS}, reactions:race_chat_reactions(message_id, user_id, emoji, updated_at)`;

/* Until race_chat.sql is re-run, `reply_to` and the reactions table do not
   exist and every select naming them fails. The chat must not break in that
   gap, so the first such failure drops back to the original columns for the
   rest of the session; replies, reactions and deletion simply stay hidden. */
let extrasAvailable = true;
const isMissingExtras = (error: { code?: string; message?: string } | null): boolean =>
  !!error && (error.code === '42703' || error.code === 'PGRST200' || error.code === 'PGRST204'
    || /reply_to|race_chat_reactions/i.test(error.message ?? ''));
export const raceChatExtrasAvailable = () => extrasAvailable;

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
  const e = error as { code?: string; message?: string; hint?: string } | null;
  const code = e?.code ?? '';
  const message = e?.message ?? '';

  if (e?.hint === 'rate_limited') return 'Easy — one reaction at a time.';
  if (e?.hint === 'message_deleted') return 'That message was deleted.';
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

type PageRow = RaceChatMessage & { reactions?: RaceReaction[] | null };

/** The current race's messages, oldest first — chronological the way a chat reads. */
export const fetchMessages = async (raceDate: string): Promise<RacePage> => {
  if (extrasAvailable) {
    const { data, error } = await supabase
      .from('race_chat_messages')
      .select(PAGE_COLUMNS)
      .eq('race_date', raceDate)
      .order('created_at', { ascending: false })
      .limit(HISTORY_LIMIT);
    if (!error) {
      const rows = ((data ?? []) as unknown as PageRow[]).reverse();
      const page: RacePage = { messages: [], reactions: [] };
      rows.forEach(({ reactions, ...msg }) => {
        page.messages.push(msg);
        reactions?.forEach(r => page.reactions.push(r));
      });
      return page;
    }
    if (!isMissingExtras(error)) throw error;
    extrasAvailable = false;
  }

  const { data, error } = await supabase
    .from('race_chat_messages')
    .select(BASE_COLUMNS)
    .eq('race_date', raceDate)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT);

  if (error) throw error;
  return { messages: ((data ?? []) as RaceChatMessage[]).reverse(), reactions: [] };
};

/** Quoted parents that are not in the loaded window. */
export const fetchQuotes = async (ids: string[]): Promise<QuotedRaceMessage[]> => {
  if (!ids.length || !extrasAvailable) return [];
  const { data, error } = await supabase
    .from('race_chat_messages')
    .select('id, user_id, display_name, message, deleted_at')
    .in('id', ids);
  if (error) throw error;
  return (data ?? []) as QuotedRaceMessage[];
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
  message: string,
  replyTo: string | null = null
): Promise<RaceChatMessage> => {
  // `reply_to` is only named when there is one, so a plain message still
  // sends against a schema that predates replies.
  const columns: string = extrasAvailable ? COLUMNS : BASE_COLUMNS;
  const { data, error } = await supabase
    .from('race_chat_messages')
    .insert({
      race_date: raceDate,
      user_id: userId,
      display_name: displayName,
      message,
      ...(replyTo ? { reply_to: replyTo } : {}),
    })
    .select(columns)
    .single();

  if (error) throw error;
  return data as unknown as RaceChatMessage;
};

/** Your own message, or anyone's if you are app staff. The server decides. */
export const deleteMessage = async (messageId: string): Promise<void> => {
  const { error } = await supabase.rpc('delete_race_message', { p_message: messageId });
  if (error) throw error;
};

/** Set, change (any emoji) or take back (null) the caller's reaction. */
export const reactToMessage = async (messageId: string, emoji: string | null): Promise<RaceReaction | null> => {
  const { data, error } = await supabase.rpc('react_to_race_message', { p_message: messageId, p_emoji: emoji });
  if (error) throw error;
  // A no-op take-back returns an all-null composite.
  const row = data as RaceReaction | null;
  return row && row.message_id != null ? row : null;
};
