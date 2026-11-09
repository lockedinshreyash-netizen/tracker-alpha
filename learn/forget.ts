/* ── Alpha Learn, as far as sign-out needs to know ──
   App's sign-out path will import this file (Phase 7), so it imports nothing:
   the store, the model and the crypto arrive only with the Learn tab.

   Each account has its own IndexedDB database, `alpha-learn-<uid>`. There is
   no cloud copy of the library, so sign-out does NOT delete it, unlike Notes:
   it deletes the cached key (`kv/key`) and leaves ciphertext behind. Signing
   back in fetches the key from the server and the library opens as it was.
   Deleting the account is the one time the database itself goes. */

export const dbNameFor = (owner: string): string => `alpha-learn-${owner}`;

/* Books' PDFs (books/files.ts) live in a database of their own, unsealed and
   never uploaded. Sign-out keeps them, like the sealed library: the files are
   the student's own copies, and the records that name them stay locked. */
export const booksDbName = (owner: string): string => `alpha-books-${owner}`;

const DBS_KEY = 'alpha_learn_dbs_v1';
export const KV = 'kv';
export const KEY_SLOT = 'key';

const readList = (): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(DBS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((n): n is string => typeof n === 'string' && n.startsWith('alpha-learn-')) : [];
  } catch { return []; }
};

export const knownLearnDbs = (): string[] => readList();

/** Recorded on open, because `indexedDB.databases()` is missing in older Firefox and Safari. */
export const rememberLearnDb = (name: string): void => {
  const list = readList();
  if (list.includes(name)) return;
  try { localStorage.setItem(DBS_KEY, JSON.stringify([...list, name])); } catch { /* full */ }
};

const openConnections = new Set<IDBDatabase>();
export const trackLearnConnection = (db: IDBDatabase): void => {
  openConnections.add(db);
  db.addEventListener('close', () => openConnections.delete(db));
};
export const untrackLearnConnection = (db: IDBDatabase): void => { openConnections.delete(db); };

const dropKey = (name: string): Promise<void> => new Promise(resolve => {
  let req: IDBOpenDBRequest;
  try { req = indexedDB.open(name); } catch { resolve(); return; }
  // Opening a name that was never created must not create it.
  req.onupgradeneeded = () => { req.transaction?.abort(); };
  req.onerror = () => resolve();
  req.onblocked = () => resolve();
  req.onsuccess = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains(KV)) { db.close(); resolve(); return; }
    const tx = db.transaction(KV, 'readwrite');
    tx.objectStore(KV).delete(KEY_SLOT);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = tx.onabort = () => { db.close(); resolve(); };
  };
});

/* Sign-out: every library on this device locks. Awaited (bounded) before the
   page reloads, because a key delete still in flight when the page goes is a
   key that stays. Memory copies die with the page. */
export const lockLearnOnDevice = async (timeoutMs = 2000): Promise<void> => {
  openConnections.forEach(db => { try { db.close(); } catch { /* closed */ } });
  openConnections.clear();
  const work = Promise.all(readList().map(dropKey)).then(() => undefined);
  await Promise.race([work, new Promise<void>(r => setTimeout(r, timeoutMs))]);
};

/** Account deletion: the server's key is gone, so the ciphertext here is only clutter. */
export const forgetLearnLibrary = (owner: string): void => {
  openConnections.forEach(db => { try { db.close(); } catch { /* closed */ } });
  openConnections.clear();
  const name = dbNameFor(owner);
  try { indexedDB.deleteDatabase(name); } catch { /* gone */ }
  try { indexedDB.deleteDatabase(booksDbName(owner)); } catch { /* gone */ }
  try { localStorage.setItem(DBS_KEY, JSON.stringify(readList().filter(n => n !== name))); } catch { /* full */ }
};
