/* ── Sending a note to the founder ──
   One RPC, send_founder_note (supabase/support.sql). It is separate from
   feedback/api.ts on purpose: different table, different promise.

   The page shows "Message received" only when this resolves, and this
   resolves only when the database returned the new row's id. Every failure
   comes back as a sentence a student can act on; Postgres' own wording never
   reaches the screen. */

import { supabase } from '../supabaseClient';

export const NOTE_MAX = 500;

export class NoteError extends Error {}

const humanError = (error: { code?: string; message?: string } | null): string => {
  const code = error?.code ?? '';
  const message = error?.message ?? '';
  if (/founder_note_rate/.test(message)) return 'That’s three notes today. You can write again tomorrow.';
  if (/founder_note_signed_out/.test(message) || code === '28000') return 'Sign in to send a note.';
  if (/founder_note_length/.test(message) || code === '23514') return `Keep it between 1 and ${NOTE_MAX} characters.`;
  /* PGRST202: support.sql has not been run on this project yet. */
  if (code === 'PGRST202' || code === '42883' || /could not find the function|does not exist/i.test(message)) {
    return 'Notes aren’t open yet. Try again soon.';
  }
  if (/failed to fetch|network|timeout|load failed/i.test(message)) return 'No connection. Check your network and try again.';
  return 'Couldn’t send it. Try again in a moment.';
};

/** Resolves only once the note is stored. Throws a NoteError with a readable message otherwise. */
export const sendFounderNote = async (body: string, signed: boolean): Promise<void> => {
  const text = body.trim();
  if (!text) throw new NoteError('Write something first.');
  if (text.length > NOTE_MAX) throw new NoteError(`Keep it under ${NOTE_MAX} characters.`);
  let result: { data: unknown; error: { code?: string; message?: string } | null };
  try {
    result = await supabase.rpc('send_founder_note', { p_body: text, p_signed: signed });
  } catch (e) {
    throw new NoteError(humanError({ message: e instanceof Error ? e.message : String(e) }));
  }
  if (result.error) throw new NoteError(humanError(result.error));
  if (typeof result.data !== 'string' || !result.data) throw new NoteError('Couldn’t send it. Try again in a moment.');
};

/* ── Replies ──
   One reply per note, written from Console → Notes and read on the Support
   page. Reading the author's own list and counting unseen replies never
   throw: before support.sql is re-run there is simply nothing to show. */

export const REPLY_MAX = 1000;

export interface MyNote {
  id: string;
  body: string;
  signed: boolean;
  created_at: string;
  reply: string | null;
  replied_at: string | null;
  reply_seen_at: string | null;
}

export interface AdminNote {
  id: string;
  body: string;
  /** Only when the author chose to sign. The author's account is never returned. */
  signed_name: string | null;
  created_at: string;
  reply: string | null;
  replied_at: string | null;
  /** The author has opened the page with this reply on it. */
  reply_seen: boolean;
}

export const isUnseen = (n: Pick<MyNote, 'reply' | 'replied_at' | 'reply_seen_at'>): boolean =>
  !!n.reply && !!n.replied_at && (!n.reply_seen_at || Date.parse(n.reply_seen_at) < Date.parse(n.replied_at));

export const listMyNotes = async (): Promise<MyNote[]> => {
  try {
    const { data, error } = await supabase.rpc('my_founder_notes');
    return error || !Array.isArray(data) ? [] : (data as MyNote[]);
  } catch {
    return [];
  }
};

export const countUnseenReplies = async (): Promise<number> => {
  try {
    const { data, error } = await supabase.rpc('unseen_founder_replies');
    return error || typeof data !== 'number' ? 0 : data;
  } catch {
    return 0;
  }
};

export const ackReplies = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  const { error } = await supabase.rpc('ack_founder_replies', { p_ids: ids });
  if (error) throw new NoteError(humanError(error));
};

const adminError = (error: { code?: string; message?: string } | null): string => {
  const code = error?.code ?? '';
  const message = error?.message ?? '';
  if (code === '42501' || /not authorized/.test(message)) return 'Only administrators can read notes.';
  if (/founder_reply_length/.test(message)) return `Keep the reply under ${REPLY_MAX} characters.`;
  if (/founder_note_missing/.test(message)) return 'That note no longer exists. Its author may have deleted their account.';
  if (code === 'PGRST202' || /could not find the function/i.test(message)) return 'Replies aren’t set up yet. Re-run supabase/support.sql.';
  if (/failed to fetch|network|timeout|load failed/i.test(message)) return 'No connection. Check your network and try again.';
  return 'Something went wrong. Try again in a moment.';
};

export const adminListNotes = async (unreplied: boolean, before: string | null): Promise<AdminNote[]> => {
  const { data, error } = await supabase.rpc('admin_founder_notes', { p_unreplied: unreplied, p_before: before, p_limit: 50 });
  if (error) throw new NoteError(adminError(error));
  return Array.isArray(data) ? (data as AdminNote[]) : [];
};

/** An empty reply takes the reply back. */
export const adminReply = async (id: string, reply: string): Promise<void> => {
  if (reply.trim().length > REPLY_MAX) throw new NoteError(`Keep the reply under ${REPLY_MAX} characters.`);
  const { error } = await supabase.rpc('admin_reply_founder_note', { p_id: id, p_reply: reply });
  if (error) throw new NoteError(adminError(error));
};
