/* ── Picking up where you left off ──
   A review session is remembered on this device after every answer: the
   cards still to come, the ones waiting out a learning step, the count and
   the answers so far. Leaving mid-session and coming back resumes at
   "13 / 34", not at "1 / 22" — the numbers a student watches are part of
   what "my progress was saved" means, and the outbox alone (which saves the
   answers) cannot give them back.

   Same study day only, and stale after eight hours: a session half-done
   yesterday is not today's session. Keyed per user and per deck (and tag
   filter), wiped on sign-out with the outbox (decks/forget.ts). Capped in
   size — a deck of image-heavy cards is still saved by the outbox, it just
   restarts its count. */

import { SESSION_PREFIX } from './forget';
import { remaining, type Session } from './session';

export interface Snapshot {
  /** 2: one card per note. A session saved under 1 holds per-blank cards that no longer exist. */
  v: 2;
  day: string;
  savedAt: number;
  startedAt: number;
  session: Session;
}

const MAX_AGE_MS = 8 * 3600_000;
const MAX_BYTES = 1_500_000;

const key = (uid: string, scope: string) => `${SESSION_PREFIX}${uid}:${scope}`;

export const loadSnapshot = (uid: string, scope: string, day: string): Snapshot | null => {
  try {
    const raw = localStorage.getItem(key(uid, scope));
    if (!raw) return null;
    const s = JSON.parse(raw) as Snapshot;
    const fresh = s?.v === 2 && s.day === day && Date.now() - s.savedAt < MAX_AGE_MS;
    if (!fresh || !s.session || !Array.isArray(s.session.queue) || !Array.isArray(s.session.learning) || remaining(s.session) === 0) {
      localStorage.removeItem(key(uid, scope));
      return null;
    }
    return s;
  } catch {
    return null;
  }
};

export const saveSnapshot = (uid: string, scope: string, snap: Omit<Snapshot, 'v' | 'savedAt'>): void => {
  try {
    const raw = JSON.stringify({ v: 2, savedAt: Date.now(), ...snap });
    if (raw.length > MAX_BYTES) { localStorage.removeItem(key(uid, scope)); return; }
    localStorage.setItem(key(uid, scope), raw);
  } catch { /* storage full or blocked: the outbox still holds every answer */ }
};

export const clearSnapshot = (uid: string, scope: string): void => {
  try { localStorage.removeItem(key(uid, scope)); } catch { /* nothing to clear */ }
};
