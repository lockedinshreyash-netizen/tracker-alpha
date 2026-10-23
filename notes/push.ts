/* ── Sending the outbox ──
   No Yjs here: rows are already base64 when they reach the outbox, so the
   sign-out path (forget.ts) can push them without loading the editor.

   A retry after a lost response inserts the same update twice. That is
   harmless: applying a Yjs update twice is the same as applying it once. */

import { supabase } from '../supabaseClient';
import { idbDel, idbEntries, idbGet, openDb, type OutboxRow } from './idb';

const BATCH = 40;

/** Push everything waiting in `db`. Returns how many rows went up per page. Throws on a network or policy error. */
export const pushOutbox = async (db: IDBDatabase, userId: string, origin: string): Promise<Map<string, number>> => {
  const sent = new Map<string, number>();
  for (let round = 0; round < 50; round++) {
    const rows = await idbEntries<OutboxRow>(db, 'outbox', BATCH);
    if (!rows.length) return sent;
    const { error } = await supabase.from('note_updates').insert(
      rows.map(([, r]) => ({ user_id: userId, doc_id: r.doc, origin, data: r.data })),
    );
    if (error) throw error;
    const first = rows[0][0] as number;
    const last = rows[rows.length - 1][0] as number;
    await idbDel(db, 'outbox', IDBKeyRange.bound(first, last));
    rows.forEach(([, r]) => sent.set(r.doc, (sent.get(r.doc) ?? 0) + 1));
    if (rows.length < BATCH) return sent;
  }
  return sent;
};

export const pushAllFromDb = async (name: string, userId: string): Promise<void> => {
  const db = await openDb(name);
  try {
    const origin = await idbGet<string>(db, 'kv', 'origin');
    if (origin) await pushOutbox(db, userId, origin);
  } finally {
    db.close();
  }
};
