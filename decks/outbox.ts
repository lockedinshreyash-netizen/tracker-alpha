/* ── The review outbox ──
   A review is the student's work, and a dropped connection on a train must
   not take it. Every answer is written to localStorage first and uploaded
   after, in batches: every ten answers, every twenty seconds, when the tab is
   hidden, when the network comes back, and when the session ends. Nothing
   leaves the outbox until the server has said it landed.

   Each entry carries a client id, and the server records a client id once
   (`record_reviews`, unique per user), so a batch retried after a lost
   response cannot double-count.

   Keyed per user: a shared laptop's next account must never upload the last
   one's reviews. Wiped on sign-out with everything else. */

import { recordReviews, undoReview, type ReviewEntry } from './api';
import { OUTBOX_PREFIX as PREFIX } from './forget';

export { forgetDecksOnDevice } from './forget';

const BATCH = 200;

const key = (uid: string) => `${PREFIX}${uid}`;

const read = (uid: string): ReviewEntry[] => {
  try {
    const raw = localStorage.getItem(key(uid));
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch { return []; }
};

const write = (uid: string, entries: ReviewEntry[]) => {
  try {
    if (entries.length) localStorage.setItem(key(uid), JSON.stringify(entries));
    else localStorage.removeItem(key(uid));
  } catch { /* storage full or blocked: the in-flight flush still carries them */ }
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

export const pendingCount = (uid: string): number => read(uid).length;

export const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

export const enqueue = (uid: string, entry: ReviewEntry): void => {
  write(uid, [...read(uid), entry]);
  notify();
};

let flushing: Promise<boolean> | null = null;

/** Upload everything waiting. True when the outbox is empty afterwards. */
export const flush = (uid: string): Promise<boolean> => {
  if (flushing) return flushing;
  flushing = (async () => {
    try {
      for (;;) {
        const batch = read(uid).slice(0, BATCH);
        if (!batch.length) return true;
        await recordReviews(batch);
        // Remove exactly what was sent; anything enqueued meanwhile stays.
        const sent = new Set(batch.map(e => e.client_id));
        write(uid, read(uid).filter(e => !sent.has(e.client_id)));
        notify();
      }
    } catch {
      return false;
    } finally {
      flushing = null;
    }
  })();
  return flushing;
};

/**
 * Undo one review. Still in the outbox: it never left the device, so it is
 * simply taken out. Already uploaded: the server restores the card's previous
 * state (only if it is still that card's latest review).
 */
export const undo = async (uid: string, clientId: string): Promise<boolean> => {
  if (flushing) await flushing.catch(() => false);
  const all = read(uid);
  if (all.some(e => e.client_id === clientId)) {
    write(uid, all.filter(e => e.client_id !== clientId));
    notify();
    return true;
  }
  return undoReview(clientId).catch(() => false);
};

