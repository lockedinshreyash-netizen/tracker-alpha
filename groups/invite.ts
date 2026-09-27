/* ── An invite link, carried across sign-in ──
   A friend opening `/?join=CODE` is very often a first-time visitor: no
   session, no account, the landing page and onboarding still ahead of them.
   The code has to survive all of that — including an email-confirmation link
   that lands in a brand-new tab — so it is lifted out of the URL on load and
   kept in localStorage until it is used, refused, or dismissed.

   The URL is cleaned immediately (replaceState), so a reload or a copied
   address bar does not re-offer an invite the user already dealt with.

   The same mechanics serve the Mentor beta's `/?beta=CODE` links — one
   implementation of "carry a code through sign-up", parameterised by which
   query key and which storage slot, so the two cannot drift apart. */

import { normalizeInviteCode } from './api';

/* Long enough to cover signing up and confirming an email tomorrow morning;
   short enough that a code from last month does not ambush a later visit. */
const TTL_MS = 3 * 24 * 60 * 60 * 1000;

interface Pending { code: string; at: number }

export interface PendingInviteSlot {
  /** Called once, at app start: moves `?param=` into storage, returns what is pending. */
  take: () => string | null;
  clear: () => void;
}

export const pendingInviteSlot = (param: string, key: string): PendingInviteSlot => {
  const read = (): string | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const p = JSON.parse(raw) as Pending;
      if (!p.code || Date.now() - p.at > TTL_MS) {
        localStorage.removeItem(key);
        return null;
      }
      return p.code;
    } catch {
      return null;
    }
  };

  const write = (code: string): void => {
    try {
      localStorage.setItem(key, JSON.stringify({ code, at: Date.now() } satisfies Pending));
    } catch {
      // Storage refused: the invite still works for this page load, just not across a sign-up.
    }
  };

  return {
    take: () => {
      try {
        const url = new URL(window.location.href);
        const raw = url.searchParams.get(param);
        if (raw !== null) {
          url.searchParams.delete(param);
          window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
          const code = normalizeInviteCode(raw);
          if (code.length === 12) {
            write(code);
            return code;
          }
        }
      } catch {
        // Malformed URL — fall through to whatever is stored.
      }
      return read();
    },
    clear: () => {
      try { localStorage.removeItem(key); } catch { /* nothing to clear */ }
    },
  };
};

const groupInvite = pendingInviteSlot('join', 'groups_pending_invite_v1');

/**
 * Called once, at app start. Moves `?join=` from the URL into storage and
 * returns whatever invite is now pending — the fresh one, or one saved earlier.
 */
export const takePendingInvite = (): string | null => groupInvite.take();

export const clearPendingInvite = (): void => groupInvite.clear();
