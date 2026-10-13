/* ── Deleting your own account ──
   Two halves, in this order:

   1. Files. Storage objects cannot be deleted from SQL, and each bucket's
      delete policy checks a row the database half removes (a personal deck for
      `decks`, the `cbt` feature for `qbank`), so the person's files go first,
      while those policies still say yes.
   2. Everything else, in one call: `delete_my_account()` (supabase/account.sql).

   A failure in step 1 stops before step 2. Better a student who has to press
   the button again than an account deleted with their photo left behind,
   unreachable and still theirs. A bucket or table that was never set up is
   not a failure: there is nothing in it to delete.

   Throws an Error whose message is written for the student, never Postgres'. */

import { supabase } from '../supabaseClient';

interface Failure { message?: string; code?: string; statusCode?: string | number }

/* Storage says "Bucket not found"; PostgREST says PGRST205 for a table it
   does not know, PGRST202 for a function. */
const isMissing = (e: Failure): boolean =>
  /bucket not found/i.test(e.message ?? '') || e.code === 'PGRST205' || e.code === '42P01';

/* Everything under `folder`, sub-folders included. Listing is paged at 1,000
   and a folder entry has no id. */
const emptyFolder = async (bucket: string, folder: string): Promise<void> => {
  for (let round = 0; round < 100; round++) {
    const { data, error } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
    if (error) {
      if (isMissing(error)) return;
      throw error;
    }
    const entries = data ?? [];
    for (const sub of entries.filter(e => !e.id)) await emptyFolder(bucket, `${folder}/${sub.name}`);
    const files = entries.filter(e => e.id).map(e => `${folder}/${e.name}`);
    if (!files.length) return;
    const { error: removeError } = await supabase.storage.from(bucket).remove(files);
    if (removeError) throw removeError;
    if (entries.length < 1000) return;
  }
};

const removeFiles = async (userId: string): Promise<void> => {
  await emptyFolder('avatars', userId);
  await emptyFolder('qbank', userId);

  // Deck images live under the deck's id, not the person's.
  const { data: decks, error } = await supabase
    .from('decks')
    .select('id')
    .eq('owner_id', userId)
    .eq('scope', 'personal');
  if (error && !isMissing(error)) throw error;
  for (const d of decks ?? []) await emptyFolder('decks', d.id);
};

export const deleteAccount = async (userId: string): Promise<void> => {
  try {
    await removeFiles(userId);
  } catch {
    throw new Error('Couldn’t remove your files. Check your connection and try again.');
  }

  const { error } = await supabase.rpc('delete_my_account');
  if (!error) return;
  if (/last_admin/.test(error.message)) {
    throw new Error('You’re the last administrator. Make someone else an admin from the console first.');
  }
  if (error.code === 'PGRST202') {
    throw new Error('Deleting accounts isn’t switched on yet. Email lockinhq@gmail.com and we’ll delete it for you.');
  }
  throw new Error('Couldn’t delete your account. Check your connection and try again.');
};
