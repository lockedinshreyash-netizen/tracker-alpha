/* ── Notes, as far as the main bundle needs to know ──
   App.tsx and the Syllabus tab import this file, so it imports nothing: the
   editor, Yjs and the sync engine arrive only with the Notes tab.

   Each owner has its own IndexedDB database: `alpha-notes-guest` for a
   signed-out student, `alpha-notes-<uid>` for an account. Signing out deletes
   the account's database, exactly as it clears `locked_in_state_v2`; the
   guest's is emptied when it moves into an account (see store.ts). */

export const GUEST = 'guest';
export const dbNameFor = (owner: string): string => `alpha-notes-${owner}`;

const DBS_KEY = 'alpha_notes_dbs_v1';
const CHAPTERS_PREFIX = 'alpha_notes_chapters_v1:';

const readList = (): string[] => {
  try {
    const raw = JSON.parse(localStorage.getItem(DBS_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((n): n is string => typeof n === 'string') : [];
  } catch { return []; }
};

export const knownDbs = (): string[] => readList();

/* Open connections, so sign-out can close them first: deleteDatabase waits
   for every open connection, and a page about to reload may never let it
   finish. idb.ts registers each one it opens. */
const openConnections = new Set<IDBDatabase>();
export const trackConnection = (db: IDBDatabase): void => {
  openConnections.add(db);
  db.addEventListener('close', () => openConnections.delete(db));
};
export const untrackConnection = (db: IDBDatabase): void => { openConnections.delete(db); };

/** Recorded on open, because `indexedDB.databases()` is missing in older Firefox and Safari. */
export const rememberDb = (name: string): void => {
  const list = readList();
  if (list.includes(name)) return;
  try { localStorage.setItem(DBS_KEY, JSON.stringify([...list, name])); } catch { /* full */ }
};

/* ── Chapter → page index ──
   The Syllabus tab shows "Notes" on a chapter that has a page. It cannot open
   the workspace (that is Yjs, in the lazy chunk), so the Notes tab writes this
   small map whenever a page's chapter changes, per owner. */

export type ChapterIndex = Record<string, string>;

export const readChapterIndex = (owner: string): ChapterIndex => {
  try {
    const raw = JSON.parse(localStorage.getItem(CHAPTERS_PREFIX + owner) || '{}');
    return raw && typeof raw === 'object' ? raw as ChapterIndex : {};
  } catch { return {}; }
};

export const writeChapterIndex = (owner: string, index: ChapterIndex): void => {
  try { localStorage.setItem(CHAPTERS_PREFIX + owner, JSON.stringify(index)); } catch { /* full */ }
};

/* ── Sign-out ──
   Unsent edits are pushed first: the outbox is the only copy of them, and
   deleting it would lose words the student typed offline. Bounded, because a
   sign-out must never hang on a dead connection. The push module needs no
   Yjs, so this costs a few kB, and only when there is something to send. */

const countOutbox = (name: string): Promise<number> => new Promise(resolve => {
  let req: IDBOpenDBRequest;
  try { req = indexedDB.open(name); } catch { resolve(0); return; }
  req.onupgradeneeded = () => { req.transaction?.abort(); resolve(0); };
  req.onerror = () => resolve(0);
  req.onsuccess = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('outbox')) { db.close(); resolve(0); return; }
    const c = db.transaction('outbox').objectStore('outbox').count();
    c.onsuccess = () => { db.close(); resolve(c.result); };
    c.onerror = () => { db.close(); resolve(0); };
  };
});

export const flushNotesBeforeSignOut = async (userId: string, timeoutMs = 4000): Promise<void> => {
  const name = dbNameFor(userId);
  if (!(await countOutbox(name))) return;
  const work = import('./push').then(m => m.pushAllFromDb(name, userId));
  await Promise.race([work.catch(() => undefined), new Promise(r => setTimeout(r, timeoutMs))]);
};

/** Nothing of an account's notes stays on the device. The guest's database is not an account's. */
export const forgetNotesOnDevice = (): void => {
  openConnections.forEach(db => { try { db.close(); } catch { /* closed */ } });
  openConnections.clear();
  const keep = dbNameFor(GUEST);
  const list = readList();
  list.filter(n => n !== keep).forEach(n => { try { indexedDB.deleteDatabase(n); } catch { /* gone */ } });
  try {
    localStorage.setItem(DBS_KEY, JSON.stringify(list.filter(n => n === keep)));
    Object.keys(localStorage)
      .filter(k => k.startsWith(CHAPTERS_PREFIX) && k !== CHAPTERS_PREFIX + GUEST)
      .forEach(k => localStorage.removeItem(k));
  } catch { /* nothing to forget */ }
};
