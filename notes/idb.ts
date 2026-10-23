/* ── A small promise wrapper over IndexedDB ──
   Five stores, one database per owner (forget.ts names them):

   docs    docId → Uint8Array   the whole Yjs state of a page (or the workspace)
   outbox  auto  → OutboxRow    updates typed here and not yet on the server
   files   id    → FileRow      images, compressed on this device
   texts   docId → string       plain text of a page, for search
   kv      key   → any          origin, pull cursor, compaction counters

   No library: `idb` would be 1 kB, but these are the only calls made. */

import { rememberDb, trackConnection } from './forget';

export interface OutboxRow { doc: string; data: string; at: number }
export interface FileRow { id: string; blob: Blob; w: number; h: number; uploaded: boolean }

export type StoreName = 'docs' | 'outbox' | 'files' | 'texts' | 'kv';

const VERSION = 1;

export const openDb = (name: string): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const req = indexedDB.open(name, VERSION);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs');
    if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { autoIncrement: true });
    if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('texts')) db.createObjectStore('texts');
    if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
  };
  req.onsuccess = () => { rememberDb(name); trackConnection(req.result); resolve(req.result); };
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error('blocked'));
});

const wrap = <T>(req: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

export const idbGet = <T>(db: IDBDatabase, store: StoreName, key: IDBValidKey): Promise<T | undefined> =>
  wrap(db.transaction(store).objectStore(store).get(key)) as Promise<T | undefined>;

export const idbPut = (db: IDBDatabase, store: StoreName, value: unknown, key?: IDBValidKey): Promise<IDBValidKey> =>
  wrap(db.transaction(store, 'readwrite').objectStore(store).put(value, key));

export const idbDel = (db: IDBDatabase, store: StoreName, key: IDBValidKey | IDBKeyRange): Promise<undefined> =>
  wrap(db.transaction(store, 'readwrite').objectStore(store).delete(key));

export const idbKeys = (db: IDBDatabase, store: StoreName): Promise<IDBValidKey[]> =>
  wrap(db.transaction(store).objectStore(store).getAllKeys());

/** Every [key, value] pair, in key order. */
export const idbEntries = async <T>(db: IDBDatabase, store: StoreName, limit?: number): Promise<[IDBValidKey, T][]> => {
  const os = db.transaction(store).objectStore(store);
  const [keys, values] = await Promise.all([wrap(os.getAllKeys(null, limit)), wrap(os.getAll(null, limit))]);
  return keys.map((k, i) => [k, values[i] as T]);
};

export const idbCount = (db: IDBDatabase, store: StoreName): Promise<number> =>
  wrap(db.transaction(store).objectStore(store).count());
