/* ── Sync: only when there is another device to agree with ──
   Postgres is the mailbox, Realtime is the doorbell (the Groups chat model).

   Push: the outbox (store.ts) is sent in batches to `note_updates`, one row
   per page per burst of typing. One device writing alone costs only these
   small inserts; nothing is ever read back.

   Pull: rows written by other origins since the cursor. The cursor is a
   server timestamp, read again with a 60s overlap, because an identity id is
   not a commit order: a row can become visible after one with a higher id.
   Re-applying a Yjs update is a no-op, so the overlap costs nothing but bytes.

   Doorbell: a Realtime INSERT from another origin is applied at once (the
   other device's words appear while they type) and a pull is scheduled to
   move the cursor.

   Compaction: once a page has gathered many rows, its full state replaces
   them (`compact_note_doc`), deleting only rows older than everything this
   device has certainly seen. Any device may compact; the snapshot is newer
   than the rows it replaces, so a device that is behind receives it. */

import * as Y from 'yjs';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { fromB64, toB64 } from './bytes';
import { idbCount, idbEntries, idbGet, idbPut, type FileRow } from './idb';
import { pushOutbox } from './push';
import type { NotesStore } from './store';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'unavailable';

const OVERLAP_MS = 60_000;
const PAGE = 200;
const COMPACT_AFTER = 150;
const PULL_THROTTLE_MS = 20_000;

interface Row { doc_id: string; data: string; created_at: string; origin: string }

type Listener = () => void;

export class NotesSync {
  status: SyncStatus = 'idle';
  lastSyncedAt: number | null = null;
  private store: NotesStore;
  private userId: string;
  private channel: RealtimeChannel | null = null;
  private pushing = false;
  private pushAgain = false;
  private pulling: Promise<void> | null = null;
  private pullTimer: ReturnType<typeof setTimeout> | null = null;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPull = 0;
  private stopped = false;
  private listeners = new Set<Listener>();
  private disposers: (() => void)[] = [];

  constructor(store: NotesStore, userId: string) {
    this.store = store;
    this.userId = userId;
  }

  subscribe = (fn: Listener) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };

  private set(status: SyncStatus) {
    if (status === 'synced') this.lastSyncedAt = Date.now();
    if (this.status === status && status !== 'synced') return;
    this.status = status;
    this.listeners.forEach(fn => fn());
  }

  start() {
    this.store.onOutbox = () => this.schedulePush(0);
    this.channel = supabase
      .channel(`notes_${this.userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'note_updates', filter: `user_id=eq.${this.userId}`,
      }, payload => {
        const row = payload.new as Partial<Row>;
        if (!row || row.origin === this.store.origin) return;
        if (typeof row.doc_id === 'string' && typeof row.data === 'string') {
          void this.store.applyRemote(row.doc_id, fromB64(row.data)).catch(() => undefined);
        }
        this.schedulePull(1500);
      })
      .subscribe(state => { if (state === 'SUBSCRIBED') this.schedulePull(0); });

    const online = () => { this.schedulePush(0); this.schedulePull(0); };
    const offline = () => this.set('offline');
    const visible = () => {
      if (document.visibilityState === 'visible') {
        if (Date.now() - this.lastPull > PULL_THROTTLE_MS) this.schedulePull(0);
      } else {
        void this.store.flush().then(() => this.push());
      }
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visible);
    this.disposers.push(
      () => window.removeEventListener('online', online),
      () => window.removeEventListener('offline', offline),
      () => document.removeEventListener('visibilitychange', visible),
    );
    this.schedulePush(0);
    void this.uploadFiles();
  }

  stop() {
    this.stopped = true;
    this.store.onOutbox = null;
    if (this.pullTimer) clearTimeout(this.pullTimer);
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.disposers.forEach(d => d());
    if (this.channel) void supabase.removeChannel(this.channel);
    void this.store.flush().then(() => this.push()).catch(() => undefined);
  }

  /* ── Push ── */

  schedulePush(ms: number) {
    if (this.stopped) return;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => { void this.push(); }, ms);
  }

  async push(): Promise<void> {
    if (this.pushing) { this.pushAgain = true; return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { this.set('offline'); return; }
    this.pushing = true;
    try {
      do {
        this.pushAgain = false;
        this.set('syncing');
        const sent = await pushOutbox(this.store.db, this.userId, this.store.origin);
        for (const [doc, n] of sent) await this.count(doc, n);
        if (sent.size) void this.compactDue();
      } while (this.pushAgain);
      this.set('synced');
    } catch (e) {
      const code = (e as { code?: string })?.code;
      this.set(code === 'PGRST205' || code === '42P01' ? 'unavailable' : navigator.onLine === false ? 'offline' : 'error');
      if (this.status === 'error') this.schedulePush(15_000);
    } finally {
      this.pushing = false;
    }
  }

  /* ── Pull ── */

  schedulePull(ms: number) {
    if (this.stopped) return;
    if (this.pullTimer) clearTimeout(this.pullTimer);
    this.pullTimer = setTimeout(() => { void this.pull(); }, ms);
  }

  pull(): Promise<void> {
    if (this.pulling) return this.pulling;
    this.pulling = this.doPull().finally(() => { this.pulling = null; });
    return this.pulling;
  }

  private async doPull() {
    this.lastPull = Date.now();
    const cursor = await idbGet<string>(this.store.db, 'kv', 'cursor');
    const since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : '1970-01-01T00:00:00Z';
    let newest = cursor ?? null;
    const counts = new Map<string, number>();
    try {
      this.set('syncing');
      for (let offset = 0; offset < 100_000; offset += PAGE) {
        const { data, error } = await supabase
          .from('note_updates')
          .select('doc_id, data, created_at, origin')
          .eq('user_id', this.userId)
          .neq('origin', this.store.origin)
          .gt('created_at', since)
          .order('created_at', { ascending: true })
          .order('id', { ascending: true })
          .range(offset, offset + PAGE - 1);
        if (error) throw error;
        const rows = (data ?? []) as Row[];
        // One merged update per page, applied once.
        const byDoc = new Map<string, Uint8Array[]>();
        rows.forEach(r => {
          const list = byDoc.get(r.doc_id) ?? [];
          list.push(fromB64(r.data));
          byDoc.set(r.doc_id, list);
          if (!newest || r.created_at > newest) newest = r.created_at;
          counts.set(r.doc_id, (counts.get(r.doc_id) ?? 0) + 1);
        });
        for (const [doc, updates] of byDoc) {
          await this.store.applyRemote(doc, updates.length === 1 ? updates[0] : Y.mergeUpdates(updates));
        }
        if (rows.length < PAGE) break;
      }
      if (newest && newest !== cursor) await idbPut(this.store.db, 'kv', newest, 'cursor');
      // Rows re-read inside the overlap are not new rows on the server.
      if (cursor) counts.clear();
      for (const [doc, n] of counts) await this.count(doc, n);
      this.set((await idbCount(this.store.db, 'outbox')) ? 'syncing' : 'synced');
      void this.compactDue();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      this.set(code === 'PGRST205' || code === '42P01' ? 'unavailable' : navigator.onLine === false ? 'offline' : 'error');
    }
  }

  /* ── Compaction ── */

  private async count(doc: string, n: number) {
    const key = `rows:${doc}`;
    const prev = (await idbGet<number>(this.store.db, 'kv', key)) ?? 0;
    await idbPut(this.store.db, 'kv', prev + n, key);
  }

  private compacting = false;

  private async compactDue() {
    if (this.compacting) return;
    const cursor = await idbGet<string>(this.store.db, 'kv', 'cursor');
    if (!cursor) return;
    this.compacting = true;
    try {
      const entries = await idbEntries<unknown>(this.store.db, 'kv');
      const due = entries
        .filter(([k, v]) => typeof k === 'string' && k.startsWith('rows:') && typeof v === 'number' && v >= COMPACT_AFTER)
        .map(([k]) => (k as string).slice(5));
      const before = new Date(Date.parse(cursor) - OVERLAP_MS).toISOString();
      for (const doc of due) {
        const state = await this.store.stateOf(doc);
        if (!state) continue;
        const { error } = await supabase.rpc('compact_note_doc', {
          p_doc: doc, p_origin: this.store.origin, p_data: toB64(state), p_before: before,
        });
        if (error) break;
        await idbPut(this.store.db, 'kv', 0, `rows:${doc}`);
      }
    } finally {
      this.compacting = false;
    }
  }

  /* ── Images ──
     Bodies refer to an image by id. The file goes to the private `notes`
     bucket as <uid>/<id>.<ext>, never inside a Yjs document: a photo in the
     document would be re-sent with every compaction. */

  async uploadFiles() {
    const rows = await idbEntries<FileRow>(this.store.db, 'files');
    for (const [, row] of rows) {
      if (row.uploaded || this.stopped) continue;
      const { error } = await supabase.storage
        .from('notes')
        .upload(objectPath(this.userId, row.id, row.blob.type), row.blob, { upsert: true, contentType: row.blob.type });
      if (error) return;
      await this.store.putFile({ ...row, uploaded: true });
    }
  }
}

export const objectPath = (userId: string, id: string, type: string): string =>
  `${userId}/${id}.${type === 'image/webp' ? 'webp' : type === 'image/png' ? 'png' : 'jpg'}`;

/** An image this device has never seen: fetch it from storage and keep it. */
export const fetchRemoteFile = async (store: NotesStore, userId: string, id: string): Promise<boolean> => {
  for (const type of ['image/webp', 'image/jpeg', 'image/png']) {
    const { data, error } = await supabase.storage.from('notes').download(objectPath(userId, id, type));
    if (error || !data) continue;
    const bitmap = await createImageBitmap(data).catch(() => null);
    await store.putFile({ id, blob: data, w: bitmap?.width ?? 0, h: bitmap?.height ?? 0, uploaded: true });
    bitmap?.close();
    return true;
  }
  return false;
};
