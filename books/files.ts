/* ── The PDFs themselves, on this device only ──
   One IndexedDB database per account, `alpha-books-<owner>`, apart from
   Learn's sealed store: Learn decrypts its whole library into memory when it
   opens, and that must stay a few hundred small records, never megabytes.

   files   fingerprint → { fingerprint, blob, bytes, savedAt }
   thumbs  fingerprint → { fingerprint, blob }   page 1, small, for the cover
   boards  bookId → the book's whiteboard (books/board.ts), since version 2

   Keyed by the file's SHA-256, not the book's id: the file is the content,
   so the same PDF added on a second device (or re-added after removing it)
   lands on the same key, and the book's record (books/model.ts) points at it
   through `fingerprint`.

   The bytes are not encrypted. They are the student's own copy of a book,
   and sealing 100 MB on every open would make a phone wait. The privacy
   policy says so. Nothing here is ever uploaded. */

import { booksDbName, trackLearnConnection, untrackLearnConnection } from '../learn/forget';

const VERSION = 2;
const FILES = 'files';
const THUMBS = 'thumbs';
const BOARDS = 'boards';

interface FileRow { fingerprint: string; blob: Blob; bytes: number; savedAt: number }
interface ThumbRow { fingerprint: string; blob: Blob }

const wrap = <T,>(req: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const done = (tx: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error ?? new Error('aborted'));
});

const dbs = new Map<string, Promise<IDBDatabase>>();

const open = (owner: string): Promise<IDBDatabase> => {
  const name = booksDbName(owner);
  const hit = dbs.get(name);
  if (hit) return hit;
  const p = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(name, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: 'fingerprint' });
      if (!db.objectStoreNames.contains(THUMBS)) db.createObjectStore(THUMBS, { keyPath: 'fingerprint' });
      if (!db.objectStoreNames.contains(BOARDS)) db.createObjectStore(BOARDS, { keyPath: 'bookId' });
    };
    req.onsuccess = () => {
      const db = req.result;
      trackLearnConnection(db);
      // Sign-out and account deletion close every Learn connection; open afresh next time.
      db.addEventListener('close', () => { dbs.delete(name); untrackLearnConnection(db); });
      db.onversionchange = () => { db.close(); dbs.delete(name); };
      resolve(db);
    };
    req.onerror = () => { dbs.delete(name); reject(req.error); };
    req.onblocked = () => { dbs.delete(name); reject(new Error('blocked')); };
  });
  dbs.set(name, p);
  return p;
};

/* A connection closed under us (sign-out closes them all) is opened again once. */
const withDb = async <T,>(owner: string, fn: (db: IDBDatabase) => Promise<T>): Promise<T> => {
  try {
    return await fn(await open(owner));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'InvalidStateError') {
      dbs.delete(booksDbName(owner));
      return fn(await open(owner));
    }
    throw e;
  }
};

/** SHA-256 of the whole file, hex. */
export const fingerprintOf = async (file: Blob): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
};

export class StorageFullError extends Error {
  constructor() { super('This device is out of space for books.'); }
}

export const saveFile = (owner: string, fingerprint: string, blob: Blob, now = Date.now()): Promise<void> =>
  withDb(owner, async db => {
    try {
      const tx = db.transaction(FILES, 'readwrite');
      tx.objectStore(FILES).put({ fingerprint, blob, bytes: blob.size, savedAt: now } satisfies FileRow);
      await done(tx);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') throw new StorageFullError();
      throw e;
    }
  });

export const getFile = (owner: string, fingerprint: string): Promise<Blob | null> =>
  withDb(owner, async db => {
    const row = (await wrap(db.transaction(FILES).objectStore(FILES).get(fingerprint))) as FileRow | undefined;
    return row?.blob ?? null;
  });

/** Which files are on this device, without reading any of them. */
export const filesOnDevice = (owner: string): Promise<Set<string>> =>
  withDb(owner, async db => new Set((await wrap(db.transaction(FILES).objectStore(FILES).getAllKeys())) as string[]));

export const deleteFile = (owner: string, fingerprint: string): Promise<void> =>
  withDb(owner, async db => {
    const tx = db.transaction([FILES, THUMBS], 'readwrite');
    tx.objectStore(FILES).delete(fingerprint);
    tx.objectStore(THUMBS).delete(fingerprint);
    await done(tx);
  });

export const saveThumb = (owner: string, fingerprint: string, blob: Blob): Promise<void> =>
  withDb(owner, async db => {
    const tx = db.transaction(THUMBS, 'readwrite');
    tx.objectStore(THUMBS).put({ fingerprint, blob } satisfies ThumbRow);
    await done(tx);
  });

const thumbUrls = new Map<string, Promise<string | null>>();

/** An object URL for page 1, cached for the page's life (covers redraw often). */
export const thumbUrl = (owner: string, fingerprint: string): Promise<string | null> => {
  const key = `${owner}:${fingerprint}`;
  const hit = thumbUrls.get(key);
  if (hit) return hit;
  const p = withDb(owner, async db => {
    const row = (await wrap(db.transaction(THUMBS).objectStore(THUMBS).get(fingerprint))) as ThumbRow | undefined;
    return row ? URL.createObjectURL(row.blob) : null;
  }).catch(() => null);
  thumbUrls.set(key, p);
  return p;
};

export const forgetThumbUrl = (owner: string, fingerprint: string): void => {
  const key = `${owner}:${fingerprint}`;
  void thumbUrls.get(key)?.then(u => { if (u) URL.revokeObjectURL(u); });
  thumbUrls.delete(key);
};

/* ── The book's whiteboard ──
   One row per book, written whole (debounced by the board). Kept with the
   book's files: on this device only, kept on sign-out, gone with the
   account. A removed book keeps its board, so restoring the book brings it back. */

export const getBoard = (owner: string, bookId: string): Promise<unknown | null> =>
  withDb(owner, async db => ((await wrap(db.transaction(BOARDS).objectStore(BOARDS).get(bookId))) as unknown) ?? null);

export const saveBoard = (owner: string, row: { bookId: string }): Promise<void> =>
  withDb(owner, async db => {
    const tx = db.transaction(BOARDS, 'readwrite');
    tx.objectStore(BOARDS).put(row);
    await done(tx);
  });

export interface StorageInfo { used: number; quota: number; persisted: boolean }

export const storageInfo = async (): Promise<StorageInfo | null> => {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est) return null;
    const persisted = (await navigator.storage.persisted?.()) ?? false;
    return { used: est.usage ?? 0, quota: est.quota ?? 0, persisted };
  } catch { return null; }
};

/** Asked once, when the first book is added: a persisted origin is not evicted under pressure. */
export const askToPersist = async (): Promise<boolean> => {
  try { return (await navigator.storage?.persist?.()) ?? false; } catch { return false; }
};

export const formatBytes = (n: number): string => {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};
