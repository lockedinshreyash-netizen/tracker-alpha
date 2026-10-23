/* ── The notes store: local first, always ──
   Everything is written to IndexedDB on this device before anything else
   happens. Typing never waits on the network, the tab opens offline, and a
   guest has the whole feature with nothing leaving the device.

   Each page body is a Yjs document. A keystroke becomes a small binary update
   that is (1) folded into the page's saved state, debounced, and (2) queued in
   the outbox, if the student is signed in, for sync.ts to send. Updates that
   arrive from another device are tagged REMOTE and never go back out.

   Writes for one document are serialised (`lock`): a pull merging into a
   closed page while the student opens it would otherwise let the open copy
   save over the merged one. */

import * as Y from 'yjs';
import { dbNameFor, GUEST, knownDbs, untrackConnection, writeChapterIndex } from './forget';
import { idbDel, idbEntries, idbGet, idbPut, openDb, type FileRow } from './idb';
import { newId, toB64 } from './bytes';
import { buildTree, chapterIndex, readPages, updatePage, WORKSPACE, type PageMeta } from './workspace';
import { docText, textOfState } from './text';

export const LOAD = Symbol('load');
export const REMOTE = Symbol('remote');

const SAVE_MS = 400;
const OUTBOX_MS = 800;
const TOUCH_MS = 30_000;

type Listener = () => void;

export class NotesStore {
  readonly owner: string;
  readonly db: IDBDatabase;
  readonly origin: string;
  readonly workspace: Y.Doc;
  signedIn: boolean;
  /** Called after updates land in the outbox: sync.ts sends them. */
  onOutbox: (() => void) | null = null;

  private live = new Map<string, { doc: Y.Doc; refs: number }>();
  private opening = new Map<string, Promise<Y.Doc>>();
  private locks = new Map<string, Promise<unknown>>();
  private saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private pending = new Map<string, Uint8Array[]>();
  private outboxTimer: ReturnType<typeof setTimeout> | null = null;
  private touched = new Map<string, number>();
  private listeners = new Set<Listener>();
  private version = 0;
  private pagesCache: { v: number; pages: PageMeta[] } = { v: -1, pages: [] };
  private texts: Map<string, string> | null = null;
  private urls = new Map<string, string>();
  private closed = false;

  private constructor(owner: string, db: IDBDatabase, origin: string, workspace: Y.Doc, signedIn: boolean) {
    this.owner = owner;
    this.db = db;
    this.origin = origin;
    this.workspace = workspace;
    this.signedIn = signedIn;
  }

  static async open(owner: string, signedIn: boolean): Promise<NotesStore> {
    const db = await openDb(dbNameFor(owner));
    /* The origin belongs to the database, not the device: a wiped database is
       a new origin, so its first pull fetches this account's rows written from
       here before the wipe instead of skipping them as its own. */
    let origin = await idbGet<string>(db, 'kv', 'origin');
    if (!origin) {
      origin = newId(16);
      await idbPut(db, 'kv', origin, 'origin');
    }
    const ws = new Y.Doc();
    const state = await idbGet<Uint8Array>(db, 'docs', WORKSPACE);
    if (state) Y.applyUpdate(ws, state, LOAD);
    const store = new NotesStore(owner, db, origin, ws, signedIn);
    store.live.set(WORKSPACE, { doc: ws, refs: Infinity });
    store.watch(WORKSPACE, ws);
    store.writeIndex();
    return store;
  }

  /* ── Subscriptions (useSyncExternalStore over the workspace) ── */

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  getVersion = (): number => this.version;

  pages(): PageMeta[] {
    if (this.pagesCache.v !== this.version) this.pagesCache = { v: this.version, pages: readPages(this.workspace) };
    return this.pagesCache.pages;
  }

  private emit() {
    this.version++;
    this.listeners.forEach(fn => fn());
  }

  private writeIndex() {
    writeChapterIndex(this.owner, chapterIndex(buildTree(this.pages())));
  }

  /* ── Documents ── */

  private lock<T>(id: string, work: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(id) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(work);
    this.locks.set(id, next);
    void next.finally(() => { if (this.locks.get(id) === next) this.locks.delete(id); }).catch(() => undefined);
    return next;
  }

  private watch(id: string, doc: Y.Doc) {
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === LOAD) return;
      this.scheduleSave(id);
      if (id === WORKSPACE) {
        this.emit();
        this.writeIndex();
      } else if (origin !== REMOTE) {
        this.touch(id);
      }
      if (origin !== REMOTE) this.enqueue(id, update);
    });
  }

  /** Bump a page's "edited" time, at most every 30s: each bump is a workspace update that syncs. */
  private touch(id: string) {
    const now = Date.now();
    if (now - (this.touched.get(id) ?? 0) < TOUCH_MS) return;
    this.touched.set(id, now);
    updatePage(this.workspace, id, { updatedAt: now });
  }

  async openDoc(id: string): Promise<Y.Doc> {
    const held = this.live.get(id);
    if (held) { held.refs++; return held.doc; }
    const inflight = this.opening.get(id);
    if (inflight) {
      const doc = await inflight;
      const h = this.live.get(id);
      if (h) h.refs++;
      return doc;
    }
    const p = this.lock(id, async () => {
      const doc = new Y.Doc({ gc: true });
      const state = await idbGet<Uint8Array>(this.db, 'docs', id);
      if (state) Y.applyUpdate(doc, state, LOAD);
      this.live.set(id, { doc, refs: 1 });
      this.watch(id, doc);
      return doc;
    });
    this.opening.set(id, p);
    try { return await p; } finally { this.opening.delete(id); }
  }

  release(id: string) {
    const held = this.live.get(id);
    if (!held || held.refs === Infinity) return;
    held.refs--;
    if (held.refs > 0) return;
    // Keep it a moment: going back and forth between two pages should not reload either.
    setTimeout(() => {
      const h = this.live.get(id);
      if (!h || h.refs > 0) return;
      void this.saveNow(id).then(() => {
        const again = this.live.get(id);
        if (again && again.refs <= 0) { again.doc.destroy(); this.live.delete(id); }
      });
    }, 20_000);
  }

  /** Updates from the server. Many updates to one page should be merged by the caller first. */
  async applyRemote(id: string, update: Uint8Array): Promise<void> {
    const inflight = this.opening.get(id);
    if (inflight) await inflight.catch(() => undefined);
    const held = this.live.get(id);
    if (held) { Y.applyUpdate(held.doc, update, REMOTE); return; }
    await this.lock(id, async () => {
      if (this.live.get(id)) { Y.applyUpdate(this.live.get(id)!.doc, update, REMOTE); return; }
      const stored = await idbGet<Uint8Array>(this.db, 'docs', id);
      const merged = stored ? Y.mergeUpdates([stored, update]) : update;
      await idbPut(this.db, 'docs', merged, id);
      const text = textOfState(merged);
      await idbPut(this.db, 'texts', text, id);
      this.texts?.set(id, text);
    });
  }

  /** A state written somewhere else on this device (a guest's notes), merged in as if typed here. */
  async importState(id: string, state: Uint8Array): Promise<void> {
    const held = this.live.get(id);
    if (held) { Y.applyUpdate(held.doc, state); return; }
    await this.lock(id, async () => {
      const stored = await idbGet<Uint8Array>(this.db, 'docs', id);
      const merged = stored ? Y.mergeUpdates([stored, state]) : state;
      await idbPut(this.db, 'docs', merged, id);
      if (id !== WORKSPACE) {
        const text = textOfState(merged);
        await idbPut(this.db, 'texts', text, id);
        this.texts?.set(id, text);
      }
    });
    this.enqueue(id, state);
  }

  /** The full saved state of a page, for compaction. */
  async stateOf(id: string): Promise<Uint8Array | null> {
    return this.lock(id, async () => {
      const held = this.live.get(id);
      if (held) return Y.encodeStateAsUpdate(held.doc);
      return (await idbGet<Uint8Array>(this.db, 'docs', id)) ?? null;
    });
  }

  async dropDocs(ids: string[]): Promise<void> {
    for (const id of ids) {
      const held = this.live.get(id);
      if (held) { held.doc.destroy(); this.live.delete(id); }
      const t = this.saveTimers.get(id);
      if (t) { clearTimeout(t); this.saveTimers.delete(id); }
      this.pending.delete(id);
      await idbDel(this.db, 'docs', id);
      await idbDel(this.db, 'texts', id);
      this.texts?.delete(id);
    }
  }

  /* ── Saving ── */

  private scheduleSave(id: string) {
    if (this.saveTimers.has(id)) return;
    this.saveTimers.set(id, setTimeout(() => { void this.saveNow(id); }, SAVE_MS));
  }

  private saveNow(id: string): Promise<void> {
    const t = this.saveTimers.get(id);
    if (t) { clearTimeout(t); this.saveTimers.delete(id); }
    const held = this.live.get(id);
    if (!held || this.closed) return Promise.resolve();
    return this.lock(id, async () => {
      const state = Y.encodeStateAsUpdate(held.doc);
      await idbPut(this.db, 'docs', state, id);
      if (id !== WORKSPACE) {
        const text = docText(held.doc);
        if (this.texts?.get(id) !== text) {
          await idbPut(this.db, 'texts', text, id);
          this.texts?.set(id, text);
        }
      }
    });
  }

  private enqueue(id: string, update: Uint8Array) {
    if (!this.signedIn) return;
    const list = this.pending.get(id) ?? [];
    list.push(update);
    this.pending.set(id, list);
    if (!this.outboxTimer) this.outboxTimer = setTimeout(() => { void this.flushOutbox(); }, OUTBOX_MS);
  }

  /** Folds the waiting updates per page into one row each. */
  async flushOutbox(): Promise<void> {
    if (this.outboxTimer) { clearTimeout(this.outboxTimer); this.outboxTimer = null; }
    if (!this.pending.size || this.closed) return;
    const batch = [...this.pending.entries()];
    this.pending.clear();
    const at = Date.now();
    const tx = this.db.transaction('outbox', 'readwrite');
    const os = tx.objectStore('outbox');
    batch.forEach(([doc, updates]) => os.add({ doc, data: toB64(Y.mergeUpdates(updates)), at }));
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    this.onOutbox?.();
  }

  /** Everything to disk now: the tab is hiding, or the student is leaving. */
  async flush(): Promise<void> {
    const ids = [...this.saveTimers.keys()];
    await Promise.all(ids.map(id => this.saveNow(id)));
    await this.flushOutbox();
  }

  /* ── Search text ── */

  async allTexts(): Promise<Map<string, string>> {
    if (!this.texts) {
      const rows = await idbEntries<string>(this.db, 'texts');
      this.texts = new Map(rows.map(([k, v]) => [String(k), v]));
    }
    // Open pages may be ahead of what was last saved.
    this.live.forEach((h, id) => { if (id !== WORKSPACE) this.texts!.set(id, docText(h.doc)); });
    return this.texts;
  }

  /* ── Files ── */

  putFile(row: FileRow): Promise<unknown> { return idbPut(this.db, 'files', row); }
  getFile(id: string): Promise<FileRow | undefined> { return idbGet<FileRow>(this.db, 'files', id); }

  /** An object URL for a stored image, made once per session. */
  async fileUrl(id: string): Promise<string | null> {
    const cached = this.urls.get(id);
    if (cached) return cached;
    const row = await this.getFile(id);
    if (!row) return null;
    const url = URL.createObjectURL(row.blob);
    this.urls.set(id, url);
    return url;
  }

  close() {
    void this.flush().finally(() => {
      this.closed = true;
      this.live.forEach(h => h.doc.destroy());
      this.live.clear();
      this.urls.forEach(u => URL.revokeObjectURL(u));
      this.urls.clear();
      untrackConnection(this.db);
      this.db.close();
    });
  }
}

/* ── One store per owner, shared ──
   The tab mounts and unmounts every time the student leaves and comes back,
   and React re-runs effects in development. A store closed and reopened each
   time would close under an editor still typing into it, and every return to
   Notes would re-read the workspace. So the store is shared and counted:
   leaving writes everything to disk at once, and only a minute with nobody
   holding it closes it. */

const shared = new Map<string, { store: Promise<NotesStore>; refs: number; timer: ReturnType<typeof setTimeout> | null }>();
const CLOSE_AFTER_MS = 60_000;

export const acquireStore = (owner: string, signedIn: boolean): Promise<NotesStore> => {
  let entry = shared.get(owner);
  if (!entry) {
    const store = NotesStore.open(owner, signedIn);
    entry = { store, refs: 0, timer: null };
    shared.set(owner, entry);
    store.catch(() => { if (shared.get(owner)?.store === store) shared.delete(owner); });
  }
  if (entry.timer) { clearTimeout(entry.timer); entry.timer = null; }
  entry.refs++;
  return entry.store.then(s => { s.signedIn = signedIn; return s; });
};

export const releaseStore = (owner: string): void => {
  const entry = shared.get(owner);
  if (!entry) return;
  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0) return;
  void entry.store.then(s => s.flush()).catch(() => undefined);
  entry.timer = setTimeout(() => {
    if (shared.get(owner) !== entry || entry.refs > 0) return;
    shared.delete(owner);
    void entry.store.then(s => s.close()).catch(() => undefined);
  }, CLOSE_AFTER_MS);
};

/* ── A guest signs in ──
   Their notes move into the account (pages, bodies, images), then the guest
   database is deleted. Page ids are random, so nothing collides with pages
   the account already has; the two workspaces merge as Yjs maps. */
export const adoptGuestNotes = async (into: NotesStore): Promise<boolean> => {
  if (into.owner === GUEST) return false;
  const guestName = dbNameFor(GUEST);
  if (!knownDbs().includes(guestName)) return false;
  const guest = await openDb(guestName);
  let moved = false;
  try {
    const docs = await idbEntries<Uint8Array>(guest, 'docs');
    for (const [id, state] of docs) {
      await into.importState(String(id), state);
      moved = true;
    }
    const files = await idbEntries<FileRow>(guest, 'files');
    for (const [, row] of files) await into.putFile({ ...row, uploaded: false });
  } finally {
    guest.close();
  }
  await new Promise<void>(resolve => {
    const req = indexedDB.deleteDatabase(guestName);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
  writeChapterIndex(GUEST, {});
  await into.flushOutbox();
  return moved;
};
