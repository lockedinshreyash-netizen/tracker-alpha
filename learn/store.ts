/* ── The library on disk ──
   One IndexedDB database per account (forget.ts names it), five stores:

   lectures     id → { id, iv, data }   a sealed Lecture
   collections  id → { id, iv, data }   a sealed Collection
   marks        id → { id, iv, data }   a sealed Mark
   progress     id → { id, iv, data }   a sealed Progress (id = its lecture's id)
   kv           key → value             'key' the cached CryptoKey, 'check', 'counters'

   Only random ids are stored in the clear. Titles, video ids, chapters, notes
   and progress are sealed (crypto.ts), each to its own slot.

   The whole library is decrypted into memory when it opens (a few hundred
   small records) and every change is a function of learn/model.ts from one
   Library to the next. `commit` works out which rows that changed by object
   identity, seals them, and writes them in one transaction. Commits are
   serialised, so two quick changes land in order. The screen never waits for
   the disk: memory is the truth while the tab is open, and a failed write is
   reported through `status`. */

import {
  addLecture, addMark, createCollection, deleteCollection, deleteLecture, deleteMark, exportLibrary, importLibrary,
  libraryFrom, moveInCollection, prune, recordWatch, refreshTitle, renameCollection, setCollectionLectures, setInCollection,
  updateLecture, updateMark,
  type AddResult, type ImportResult, type LecturePatch, type Library, type LibraryExport, type NewLecture,
  type NewMark, type WatchUpdate,
} from './model';
import {
  addBook, addBookMark, deleteBook, deleteBookMark, recordReading, restoreBookMark, touchBook, updateBook, updateBookMark,
  type AddBookResult, type BookPatch, type MarkColor, type NewBook, type NewBookMark, type ReadingUpdate, type Shelf,
} from '../books/model';
import { importKey, isSealed, makeCheck, seal, unseal, verifyCheck, type Sealed } from './crypto';
import { KEY_SLOT, KV, dbNameFor, rememberLearnDb, trackLearnConnection, untrackLearnConnection } from './forget';

/* v2 added the books stores (books/model.ts): same sealing, same slots. */
const VERSION = 2;
const ROWS = ['lectures', 'collections', 'marks', 'progress', 'books', 'bookMarks', 'bookProgress'] as const;
type RowStore = typeof ROWS[number];
const COUNTERS_SLOT = 'kv:counters';

interface Row { id: string; iv: Uint8Array; data: ArrayBuffer }

/** Where the account's key comes from: the server (Phase 3), raw bytes. Throws when it cannot be reached. */
export type KeySource = () => Promise<Uint8Array>;

export class LockedError extends Error {
  readonly reason: 'no-key' | 'wrong-key';
  /** Why the key could not be fetched (keys.ts's KeyUnavailable), for the screen to word it. */
  readonly cause: unknown;
  constructor(reason: 'no-key' | 'wrong-key', cause?: unknown) {
    super(reason === 'no-key' ? 'The library key could not be fetched.' : 'This library cannot be opened with this account.');
    this.reason = reason;
    this.cause = cause;
  }
}

export interface StoreStatus {
  saving: boolean;
  error: string | null;
  /** Rows on disk that would not open or validate when the library loaded. */
  unreadable: number;
}

/* ── IndexedDB, wrapped ── */

const wrap = <T,>(req: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const done = (tx: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error ?? new Error('aborted'));
});

const openDb = (name: string): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const req = indexedDB.open(name, VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    for (const s of ROWS) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
    if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
  };
  req.onsuccess = () => { rememberLearnDb(name); trackLearnConnection(req.result); resolve(req.result); };
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('blocked'));
});

const kvGet = <T,>(db: IDBDatabase, key: string): Promise<T | undefined> =>
  wrap(db.transaction(KV).objectStore(KV).get(key)) as Promise<T | undefined>;

const kvPut = async (db: IDBDatabase, key: string, value: unknown): Promise<void> => {
  const tx = db.transaction(KV, 'readwrite');
  tx.objectStore(KV).put(value, key);
  await done(tx);
};

const newId = (prefix: string): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  let s = '';
  bytes.forEach(b => { s += alphabet[b % 36]; });
  return `${prefix}_${s}`;
};

type Listener = () => void;

export class LearnStore {
  readonly owner: string;
  private db: IDBDatabase;
  private key: CryptoKey;
  private lib: Library;
  private version = 0;
  private listeners = new Set<Listener>();
  private chain: Promise<unknown> = Promise.resolve();
  private pending = 0;
  private status: StoreStatus;
  private closed = false;

  private constructor(owner: string, db: IDBDatabase, key: CryptoKey, lib: Library, unreadable: number) {
    this.owner = owner;
    this.db = db;
    this.key = key;
    this.lib = lib;
    this.status = { saving: false, error: null, unreadable };
  }

  /* The cached key first, so the library opens offline. With no cached key
     (a first open, or the first after a sign-out) the server is asked; a
     check that fails on a cached key is asked once more, in case the cached
     one is stale, before the library is called locked. */
  static async open(owner: string, fetchKey: KeySource, now = Date.now()): Promise<LearnStore> {
    const db = await openDb(dbNameFor(owner));
    try {
      const check = await kvGet<Sealed>(db, 'check');
      let key = await kvGet<CryptoKey>(db, KEY_SLOT);
      let fromServer = false;

      const fetchFresh = async (): Promise<CryptoKey> => {
        let raw: Uint8Array;
        try { raw = await fetchKey(); } catch (e) { throw new LockedError('no-key', e); }
        fromServer = true;
        return importKey(raw);
      };

      if (!key) key = await fetchFresh();
      if (isSealed(check) && !(await verifyCheck(key, check))) {
        if (fromServer) throw new LockedError('wrong-key');
        key = await fetchFresh();
        if (!(await verifyCheck(key, check))) throw new LockedError('wrong-key');
      }
      if (!isSealed(check)) await kvPut(db, 'check', await makeCheck(key));
      if (fromServer) await kvPut(db, KEY_SLOT, key);

      const { lib, unreadable, stale } = await LearnStore.load(db, key, now);
      const store = new LearnStore(owner, db, key, lib, unreadable);
      if (stale.length) void store.deleteRows(stale);
      return store;
    } catch (e) {
      untrackLearnConnection(db);
      db.close();
      throw e;
    }
  }

  private static async load(db: IDBDatabase, key: CryptoKey, now: number) {
    let unreadable = 0;
    const read = async (store: RowStore): Promise<unknown[]> => {
      const rows = (await wrap(db.transaction(store).objectStore(store).getAll())) as Row[];
      const out = await Promise.all(rows.map(async r => {
        try { return await unseal(key, `${store}:${r.id}`, { iv: r.iv, data: r.data }); } catch { unreadable++; return null; }
      }));
      return out.filter(x => x !== null);
    };
    const [lectures, collections, marks, progress, books, bookMarks, bookProgress] = await Promise.all(ROWS.map(read));
    const sealedCounters = await kvGet<Sealed>(db, 'counters');
    let counters: unknown = null;
    if (isSealed(sealedCounters)) {
      try { counters = await unseal(key, COUNTERS_SLOT, sealedCounters); } catch { unreadable++; }
    }
    const raw = libraryFrom({ lectures, collections, marks, progress, counters, books, bookMarks, bookProgress });
    unreadable += lectures.length - Object.keys(raw.lectures).length + collections.length - Object.keys(raw.collections).length
      + marks.length - Object.keys(raw.marks).length + progress.length - Object.keys(raw.progress).length
      + books.length - Object.keys(raw.books).length + bookMarks.length - Object.keys(raw.bookMarks).length
      + bookProgress.length - Object.keys(raw.bookProgress).length;
    const lib = prune(raw, now);
    const stale: [RowStore, string][] = [];
    for (const s of ROWS) for (const id of Object.keys(raw[s])) if (!(id in lib[s])) stale.push([s, id]);
    return { lib, unreadable, stale };
  }

  /* ── Subscriptions (useSyncExternalStore) ── */

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  getVersion = (): number => this.version;
  getLibrary = (): Library => this.lib;
  getStatus = (): StoreStatus => this.status;

  private emit() {
    this.version++;
    this.listeners.forEach(fn => fn());
  }

  private setStatus(patch: Partial<StoreStatus>) {
    this.status = { ...this.status, ...patch };
    this.emit();
  }

  /* ── Writing ── */

  private commit(next: Library): void {
    if (this.closed || next === this.lib) return;
    const prev = this.lib;
    this.lib = next;
    this.emit();

    const puts: [RowStore, string, unknown][] = [];
    const dels: [RowStore, string][] = [];
    for (const s of ROWS) {
      const before = prev[s] as Record<string, unknown>;
      const after = next[s] as Record<string, unknown>;
      for (const id of Object.keys(after)) if (after[id] !== before[id]) puts.push([s, id, after[id]]);
      for (const id of Object.keys(before)) if (!(id in after)) dels.push([s, id]);
    }
    const counters = prev.counters !== next.counters ? next.counters : null;
    this.enqueue(async () => {
      const sealed = await Promise.all(puts.map(async ([s, id, v]) => [s, { id, ...(await seal(this.key, `${s}:${id}`, v)) }] as const));
      const sealedCounters = counters ? await seal(this.key, COUNTERS_SLOT, counters) : null;
      const tx = this.db.transaction([...ROWS, KV], 'readwrite');
      for (const [s, row] of sealed) tx.objectStore(s).put(row);
      for (const [s, id] of dels) tx.objectStore(s).delete(id);
      if (sealedCounters) tx.objectStore(KV).put(sealedCounters, 'counters');
      await done(tx);
    });
  }

  private deleteRows(rows: [RowStore, string][]): Promise<void> {
    return this.enqueue(async () => {
      const tx = this.db.transaction([...ROWS], 'readwrite');
      for (const [s, id] of rows) tx.objectStore(s).delete(id);
      await done(tx);
    });
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    this.pending++;
    if (!this.status.saving) this.setStatus({ saving: true });
    const run = this.chain.catch(() => undefined).then(work).then(
      () => { if (this.status.error) this.setStatus({ error: null }); },
      (e: unknown) => { this.setStatus({ error: e instanceof Error ? e.message : 'save failed' }); },
    ).finally(() => {
      this.pending--;
      if (!this.pending && !this.closed) this.setStatus({ saving: false });
    });
    this.chain = run;
    return run;
  }

  /** Resolves when every change so far is on disk. */
  flush(): Promise<void> {
    return this.chain.then(() => undefined, () => undefined);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    void this.flush().then(() => {
      untrackLearnConnection(this.db);
      this.db.close();
    });
  }

  /* ── The library's verbs ── */

  addLecture(input: NewLecture, now = Date.now()): AddResult {
    const res = addLecture(this.lib, input, newId('lec'), now);
    this.commit(res.lib);
    return res;
  }

  updateLecture(id: string, patch: LecturePatch, now = Date.now()): void { this.commit(updateLecture(this.lib, id, patch, now)); }
  refreshTitle(id: string, title: string | null, now = Date.now()): void { this.commit(refreshTitle(this.lib, id, title, now)); }
  deleteLecture(id: string, now = Date.now()): void { this.commit(deleteLecture(this.lib, id, now)); }

  addMark(input: NewMark, now = Date.now()): string {
    const id = newId('mark');
    this.commit(addMark(this.lib, input, id, now));
    return id;
  }

  updateMark(id: string, patch: { t?: number; text?: string }, now = Date.now()): void { this.commit(updateMark(this.lib, id, patch, now)); }
  deleteMark(id: string, now = Date.now()): void { this.commit(deleteMark(this.lib, id, now)); }

  createCollection(name: string, now = Date.now()): string {
    const id = newId('col');
    this.commit(createCollection(this.lib, name, id, now));
    return id;
  }

  renameCollection(id: string, name: string, now = Date.now()): void { this.commit(renameCollection(this.lib, id, name, now)); }
  setCollectionLectures(id: string, ids: string[], now = Date.now()): void { this.commit(setCollectionLectures(this.lib, id, ids, now)); }
  deleteCollection(id: string, now = Date.now()): void { this.commit(deleteCollection(this.lib, id, now)); }
  setInCollection(id: string, lectureId: string, on: boolean, now = Date.now()): void { this.commit(setInCollection(this.lib, id, lectureId, on, now)); }
  moveInCollection(id: string, lectureId: string, dir: 1 | -1, now = Date.now()): void { this.commit(moveInCollection(this.lib, id, lectureId, dir, now)); }

  /** Called by the player rarely (on pause, on hide, every few seconds at most), never per frame. */
  recordWatch(lectureId: string, w: WatchUpdate, now = Date.now()): void { this.commit(recordWatch(this.lib, lectureId, w, now)); }

  /* ── Books (books/model.ts). The verbs return a Shelf spread over the whole library. ── */

  private commitShelf(next: Shelf): void { this.commit(next as Library); }

  addBook(input: NewBook, now = Date.now()): AddBookResult {
    const res = addBook(this.lib, input, newId('book'), now);
    this.commitShelf(res.shelf);
    return res;
  }

  updateBook(id: string, patch: BookPatch, now = Date.now()): void { this.commitShelf(updateBook(this.lib, id, patch, now)); }
  touchBook(id: string, now = Date.now()): void { this.commitShelf(touchBook(this.lib, id, now)); }
  deleteBook(id: string, now = Date.now()): void { this.commitShelf(deleteBook(this.lib, id, now)); }

  addBookMark(input: NewBookMark, now = Date.now()): string | null {
    const id = newId('bm');
    const next = addBookMark(this.lib, input, id, now);
    if (next === this.lib) return null;
    this.commitShelf(next);
    return id;
  }

  updateBookMark(id: string, patch: { color?: MarkColor; note?: string | null }, now = Date.now()): void {
    this.commitShelf(updateBookMark(this.lib, id, patch, now));
  }
  deleteBookMark(id: string, now = Date.now()): void { this.commitShelf(deleteBookMark(this.lib, id, now)); }
  restoreBookMark(id: string, now = Date.now()): void { this.commitShelf(restoreBookMark(this.lib, id, now)); }

  /** Called by the reader rarely (on close, on hide, every 30 s at most), never per scroll. */
  recordReading(bookId: string, u: ReadingUpdate, now = Date.now()): void { this.commitShelf(recordReading(this.lib, bookId, u, now)); }

  exportLibrary(now = Date.now()): LibraryExport { return exportLibrary(this.lib, now); }

  importLibrary(raw: unknown, now = Date.now()): ImportResult {
    const res = importLibrary(this.lib, raw, now);
    if (res.ok) this.commit(res.lib);
    return res;
  }
}
