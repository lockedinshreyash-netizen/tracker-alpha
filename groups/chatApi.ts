/* ── Group chat data ──
   `group_messages` (supabase/groups.sql). Reads and inserts go straight to the
   table under RLS — members read, members post as themselves — and deletion is
   an RPC, because it is a soft delete that blanks the body and no client may
   UPDATE a message directly.

   Pagination is by `id`, a bigint identity: a total order no two messages can
   tie on, and a cursor by itself. `id < oldest` is an index range scan on
   (group_id, id) whose cost does not depend on how deep into history it is —
   the thing OFFSET cannot promise.

   Replies and reactions arrived later. A page is fetched with its reactions
   embedded — one request, one consistent snapshot. A reply quoting something
   above the loaded window has its parent looked up by id (fetchQuotes) rather
   than embedded: a self-referencing embed is the one PostgREST relationship
   whose hint rules have changed between versions, and chat is not the place
   to find out. Reactions are written only through an RPC. */

import { supabase } from '../supabaseClient';

export interface GroupMessage {
  id: number;
  group_id: string;
  sender_id: string;
  client_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  /** The message this one answers. Absent on a schema that predates replies. */
  reply_to?: number | null;
}

/** Just enough of a message to draw it as a quote. */
export interface QuotedMessage {
  id: number;
  sender_id: string;
  body: string;
  deleted_at: string | null;
}

export interface Reaction {
  message_id: number;
  user_id: string;
  /** null = taken back. Kept, not deleted — see supabase/groups.sql. */
  emoji: string | null;
  updated_at: string;
}

/** Mirrors the reaction_emoji CHECK in supabase/groups.sql, byte for byte. */
export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'] as const;
/** What a double tap on a message means, as on Instagram. */
export const QUICK_REACTION = '❤️';

/** A page of messages plus the reactions embedded alongside them. */
export interface MessagePage {
  messages: GroupMessage[];
  reactions: Reaction[];
}

export const PAGE_SIZE = 50;
export const MAX_MESSAGE = 1000;

const BASE_COLUMNS = 'id, group_id, sender_id, client_id, body, created_at, deleted_at';
const COLUMNS = `${BASE_COLUMNS}, reply_to`;
const PAGE_COLUMNS = `${COLUMNS}, reactions:group_message_reactions(message_id, user_id, emoji, updated_at)`;

/* Until supabase/groups.sql is re-run, `reply_to` and the reactions table do
   not exist and every select naming them fails. Chat must not break in that
   gap, so the first such failure drops back to the original columns for the
   rest of the session; replies and reactions simply stay hidden. */
let extrasAvailable = true;
const isMissingExtras = (error: { code?: string; message?: string } | null): boolean =>
  !!error && (error.code === '42703' || error.code === 'PGRST200' || error.code === 'PGRST204'
    || /reply_to|group_message_reactions/i.test(error.message ?? ''));
export const chatExtrasAvailable = () => extrasAvailable;

/** Mirrors the CHECK constraint; collapses runs of blank lines like race chat does. */
export const validateMessage = (raw: string): string | null => {
  const trimmed = raw.trim().replace(/\n{3,}/g, '\n\n');
  if (trimmed.length < 1 || trimmed.length > MAX_MESSAGE) return null;
  return trimmed;
};

/* crypto.randomUUID needs a secure context and a recent browser; the fallback
   builds the same v4 shape from getRandomValues, which every supported browser
   has. The id only has to be unique per sender. */
export const newClientId = (): string => {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

export const normalize = (row: GroupMessage): GroupMessage => ({
  id: Number(row.id),
  group_id: row.group_id,
  sender_id: row.sender_id,
  client_id: row.client_id,
  body: row.body,
  created_at: row.created_at,
  deleted_at: row.deleted_at,
  reply_to: row.reply_to == null ? null : Number(row.reply_to),
});

export const normalizeReaction = (r: Reaction): Reaction => ({ ...r, message_id: Number(r.message_id) });

type PageRow = GroupMessage & { reactions?: Reaction[] | null };

const toPage = (rows: PageRow[]): MessagePage => {
  const page: MessagePage = { messages: [], reactions: [] };
  // Rows arrive newest first; a page is returned oldest first.
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    page.messages.push(normalize(row));
    row.reactions?.forEach(r => page.reactions.push(normalizeReaction(r)));
  }
  return page;
};

const selectPage = async (
  build: (columns: string) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>
): Promise<MessagePage> => {
  if (extrasAvailable) {
    const { data, error } = await build(PAGE_COLUMNS);
    if (!error) return toPage((data ?? []) as PageRow[]);
    if (!isMissingExtras(error)) throw error;
    extrasAvailable = false;
  }
  const { data, error } = await build(BASE_COLUMNS);
  if (error) throw error;
  return toPage((data ?? []) as PageRow[]);
};

/** The newest page, returned oldest-first. */
export const fetchLatest = (groupId: string): Promise<MessagePage> =>
  selectPage(columns => supabase
    .from('group_messages')
    .select(columns)
    .eq('group_id', groupId)
    .order('id', { ascending: false })
    .limit(PAGE_SIZE));

/** The page immediately older than `beforeId`, returned oldest-first. */
export const fetchOlder = (groupId: string, beforeId: number): Promise<MessagePage> =>
  selectPage(columns => supabase
    .from('group_messages')
    .select(columns)
    .eq('group_id', groupId)
    .lt('id', beforeId)
    .order('id', { ascending: false })
    .limit(PAGE_SIZE));

/** Quoted parents that are not in the loaded window. */
export const fetchQuotes = async (ids: number[]): Promise<QuotedMessage[]> => {
  if (!ids.length || !extrasAvailable) return [];
  const { data, error } = await supabase
    .from('group_messages')
    .select('id, sender_id, body, deleted_at')
    .in('id', ids);
  if (error) throw error;
  return ((data ?? []) as QuotedMessage[]).map(q => ({ ...q, id: Number(q.id) }));
};

/**
 * Insert one message. `client_id` makes this idempotent: if a previous attempt
 * with the same id already landed (the response was lost, not the request),
 * the unique constraint refuses the second and we return the first.
 */
export const insertMessage = async (
  groupId: string,
  senderId: string,
  clientId: string,
  body: string,
  replyTo: number | null = null
): Promise<GroupMessage> => {
  // `reply_to` is only named when there is one, so a plain message still
  // sends against a schema that predates replies.
  const columns: string = extrasAvailable ? COLUMNS : BASE_COLUMNS;
  const { data, error } = await supabase
    .from('group_messages')
    .insert({ group_id: groupId, sender_id: senderId, client_id: clientId, body, ...(replyTo ? { reply_to: replyTo } : {}) })
    .select(columns)
    .single();

  if (!error) return normalize(data as unknown as GroupMessage);

  if (error.code === '23505') {
    const { data: existing, error: lookup } = await supabase
      .from('group_messages')
      .select(columns)
      .eq('sender_id', senderId)
      .eq('client_id', clientId)
      .single();
    if (!lookup && existing) return normalize(existing as unknown as GroupMessage);
  }
  throw error;
};

export const deleteMessage = async (messageId: number): Promise<void> => {
  const { error } = await supabase.rpc('delete_group_message', { p_message: messageId });
  if (error) throw error;
};

/** Set, change (any emoji) or take back (null) the caller's reaction. */
export const reactToMessage = async (messageId: number, emoji: string | null): Promise<Reaction | null> => {
  const { data, error } = await supabase.rpc('react_to_group_message', { p_message: messageId, p_emoji: emoji });
  if (error) throw error;
  // A no-op take-back returns an all-null composite.
  const row = data as Reaction | null;
  return row && row.message_id != null ? normalizeReaction(row) : null;
};
