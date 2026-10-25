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
