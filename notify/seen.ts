/* ── The seen ledger ──
   One question: has the user already been shown this exact fire?

   It exists because a reminder can arrive by two independent routes — the
   local engine while a tab is alive, and a Web Push while it is not — and the
   product rule is that the same reminder is never delivered twice. The lag and
   the row deletion in reminders/publish.ts make a collision rare; this makes it
   survivable when it happens anyway (the device was offline when it fired, the
   delete never reached Supabase, the push was already in flight).

   IndexedDB rather than localStorage, which is the obvious choice and is simply
   not available in a service worker — and the worker is the one context that
   most needs to ask this, because it is handling the push. public/sw.js opens
   the same database and store with its own ~40 lines of the same thing; a
   shared module is not possible across that boundary without a build step for
   the worker, which this project does not have and does not need.

   Raw IDB, no wrapper: one store, three operations. A library for that would be
   the fourth dependency in a project that has three.

   Every failure resolves rather than rejects. A ledger that cannot be read must
   never stop a notification being shown — the cost of a missing dedup is one
   duplicate, and the cost of a throw in a push handler is Chrome revoking the
   origin's push permission. */

const DB_NAME = 'tracker-alpha-notify';
const STORE = 'seen';

/* Keys older than this are dropped on open. A ledger that grows forever is a
   ledger nobody notices growing, and nothing needs to remember a fire from
   last week — every key contains its own instant. */
const RETAIN_MS = 3 * 24 * 3_600_000;

interface SeenRow {
  key: string;
  at: number;
}

/* Opened lazily and memoised. Deliberately NOT opened at module load: a
   database handshake during boot competes with first paint for a feature the
   user may never touch. The first reminder pays for it, and nothing else does. */
let dbPromise: Promise<IDBDatabase | null> | null = null;

const openDb = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase | null>(resolve => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
      };
      req.onsuccess = () => {
        const db = req.result;
        prune(db);
        resolve(db);
      };
      /* Private browsing, a blocked origin, a corrupt store. Null means "no
         ledger", and every caller treats that as "not seen". */
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
};

/* Fire-and-forget on open. Nothing waits for it — an oversized ledger is a
   housekeeping problem, not a correctness one. */
const prune = (db: IDBDatabase): void => {
  try {
    const cutoff = Date.now() - RETAIN_MS;
    const store = db.transaction(STORE, 'readwrite').objectStore(STORE);
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const row = cursor.value as SeenRow;
      if (!row || typeof row.at !== 'number' || row.at < cutoff) cursor.delete();
      cursor.continue();
    };
  } catch {
    /* Nothing to do. */
  }
};

export const hasSeen = async (key: string): Promise<boolean> => {
  if (!key) return false;
  const db = await openDb();
  if (!db) return false;
  return new Promise<boolean>(resolve => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(!!req.result);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
};

export const markSeen = async (key: string): Promise<void> => {
  if (!key) return;
  const db = await openDb();
  if (!db) return;
  await new Promise<void>(resolve => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ key, at: Date.now() } satisfies SeenRow);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
};
