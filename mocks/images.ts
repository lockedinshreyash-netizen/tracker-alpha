/* ── Pictures of questions, kept on this device ──
   A student pastes a screenshot of a question and its options; the picture
   is the question. It never enters AppState (an image in the synced jsonb
   blob would be uploaded again on every change) and never leaves the device:
   the error entry carries only its id (`ErrorEntry.image`), so on another
   device the entry syncs and the picture says it is on the first one.

   One IndexedDB database for the device, keyed by a random id, with each
   picture marked by the account that last saved it (`owner`, a user id or
   'guest'):
     · Signing out keeps them, like Learn's library: signing back in pulls the
       entries from the cloud and their pictures are still here.
     · Deleting the account deletes that account's pictures.
     · `sweepErrorImages` deletes a picture no entry refers to any more — a
       deleted error, a replaced or removed picture — but only the current
       owner's, and only after a week, so Undo, a draft that was never saved
       and another account's notebook are never touched. A picture still in
       use is re-marked as the current owner's, which is how pictures pasted
       as a guest pass to the account they were synced into. */

import { IMAGE_ID } from './model';

export { IMAGE_ID };

const DB = 'alpha-error-images';
const STORE = 'images';
const MAX_SIDE = 1600;
const MAX_BYTES = 3 * 1024 * 1024;
const SWEEP_AFTER_MS = 7 * 86_400_000;

interface Row { id: string; blob: Blob; w: number; h: number; owner: string; at: number }

let dbPromise: Promise<IDBDatabase> | null = null;
const open = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = () => {
        const db = req.result;
        // Another tab deleting the database must not hang on this connection.
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
  }
  return dbPromise;
};

const tx = async <T,>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
};

const newId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return 'ei_' + Array.from(bytes, b => (b % 36).toString(36)).join('');
};

const encode = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> =>
  new Promise(resolve => canvas.toBlob(resolve, type, quality));

/** First image file in a paste, a drop or a file picker. */
export const imageFrom = (files: FileList | null | undefined): File | null => {
  for (const f of Array.from(files ?? [])) if (f.type.startsWith('image/')) return f;
  return null;
};

/** Compress (at most 1600px, WebP or JPEG) and keep. Returns the id. */
export const saveErrorImage = async (file: Blob, owner: string): Promise<string> => {
  if (!file.type.startsWith('image/')) throw new Error('That isn’t a picture.');
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error('Couldn’t read that picture.'); }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  // A transparent PNG screenshot over white, so black text stays readable in dark mode too.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  let blob = await encode(canvas, 'image/webp', 0.85);
  if (!blob || blob.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg', 0.88);
  if (!blob) throw new Error('Couldn’t read that picture.');
  if (blob.size > MAX_BYTES) throw new Error('That picture is too large.');
  const id = newId();
  await tx('readwrite', s => s.put({ id, blob, w, h, owner, at: Date.now() } satisfies Row));
  return id;
};

/* Object URLs, made once per picture per page load. */
const urls = new Map<string, Promise<string | null>>();

/** A displayable URL, or null when the picture isn't on this device. */
export const errorImageUrl = (id: string): Promise<string | null> => {
  let p = urls.get(id);
  if (!p) {
    p = tx<Row | undefined>('readonly', s => s.get(id) as IDBRequest<Row | undefined>)
      .then(row => (row ? URL.createObjectURL(row.blob) : null))
      .catch(() => null);
    urls.set(id, p);
  }
  return p;
};

/** Tidy up: see the header. Never throws. */
export const sweepErrorImages = async (owner: string, inUse: Set<string>): Promise<void> => {
  try {
    const rows = (await tx<Row[]>('readonly', s => s.getAll() as IDBRequest<Row[]>)) ?? [];
    const cutoff = Date.now() - SWEEP_AFTER_MS;
    const claim = rows.filter(r => inUse.has(r.id) && r.owner !== owner);
    const drop = rows.filter(r => !inUse.has(r.id) && r.owner === owner && r.at < cutoff);
    if (!claim.length && !drop.length) return;
    await tx('readwrite', s => {
      for (const r of claim) s.put({ ...r, owner });
      for (const r of drop) s.delete(r.id);
    });
  } catch { /* tidying can wait for the next visit */ }
};

/** Deleting the account: its pictures go with it. */
export const forgetErrorImages = async (owner: string): Promise<void> => {
  try {
    const rows = (await tx<Row[]>('readonly', s => s.getAll() as IDBRequest<Row[]>)) ?? [];
    const mine = rows.filter(r => r.owner === owner);
    if (mine.length) await tx('readwrite', s => { for (const r of mine) s.delete(r.id); });
  } catch { /* nothing to forget */ }
};
