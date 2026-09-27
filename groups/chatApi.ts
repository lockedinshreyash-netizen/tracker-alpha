/* ── Group chat data ──
   `group_messages` (supabase/groups.sql). Reads and inserts go straight to the
   table under RLS — members read, members post as themselves — and deletion is
   an RPC, because it is a soft delete that blanks the body and no client may
   UPDATE a message directly.

   Pagination is by `id`, a bigint identity: a total order no two messages can
   tie on, and a cursor by itself. `id < oldest` is an index range scan on
   (group_id, id) whose cost does not depend on how deep into history it is —
   the thing OFFSET cannot promise. */

import { supabase } from '../supabaseClient';

export interface GroupMessage {
  id: number;
  group_id: string;
  sender_id: string;
  client_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
}

export const PAGE_SIZE = 50;
export const MAX_MESSAGE = 1000;

const COLUMNS = 'id, group_id, sender_id, client_id, body, created_at, deleted_at';

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

const normalize = (row: GroupMessage): GroupMessage => ({ ...row, id: Number(row.id) });

/** The newest page, returned oldest-first. */
export const fetchLatest = async (groupId: string): Promise<GroupMessage[]> => {
  const { data, error } = await supabase
    .from('group_messages')
    .select(COLUMNS)
    .eq('group_id', groupId)
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);
  if (error) throw error;
  return ((data ?? []) as GroupMessage[]).map(normalize).reverse();
};

/** The page immediately older than `beforeId`, returned oldest-first. */
export const fetchOlder = async (groupId: string, beforeId: number): Promise<GroupMessage[]> => {
  const { data, error } = await supabase
    .from('group_messages')
    .select(COLUMNS)
    .eq('group_id', groupId)
    .lt('id', beforeId)
    .order('id', { ascending: false })
    .limit(PAGE_SIZE);
  if (error) throw error;
  return ((data ?? []) as GroupMessage[]).map(normalize).reverse();
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
  body: string
): Promise<GroupMessage> => {
  const { data, error } = await supabase
    .from('group_messages')
    .insert({ group_id: groupId, sender_id: senderId, client_id: clientId, body })
    .select(COLUMNS)
    .single();

  if (!error) return normalize(data as GroupMessage);

  if (error.code === '23505') {
    const { data: existing, error: lookup } = await supabase
      .from('group_messages')
      .select(COLUMNS)
      .eq('sender_id', senderId)
      .eq('client_id', clientId)
      .single();
    if (!lookup && existing) return normalize(existing as GroupMessage);
  }
  throw error;
};

export const deleteMessage = async (messageId: number): Promise<void> => {
  const { error } = await supabase.rpc('delete_group_message', { p_message: messageId });
  if (error) throw error;
};
