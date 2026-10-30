/* ── An Alpha invite, carried across sign-in ──
   `/?invite=CODE` is opened by somebody who has never been here: the landing
   page, Google and onboarding are all still ahead of them. The code is lifted
   out of the URL on the first render and kept until it is used or refused,
   exactly like a group invite (groups/invite.ts). The URL is cleaned at once
   so a reload or a copied address does not offer it again.

   landing/gate.ts and the inline script in index.html read KEY too: an invite
   skips the pitch, because the friend who sent it already made it. */

import { normalizeAccessCode } from './cutover';

export const ACCESS_INVITE_KEY = 'alpha_access_invite_v1';
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface Pending { code: string; at: number }

const read = (): string | null => {
  try {
    const raw = localStorage.getItem(ACCESS_INVITE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Pending;
    if (!p.code || Date.now() - p.at > TTL_MS) {
      localStorage.removeItem(ACCESS_INVITE_KEY);
      return null;
    }
    return p.code;
  } catch {
    return null;
  }
};

export const holdAccessInvite = (code: string): void => {
  try {
    localStorage.setItem(ACCESS_INVITE_KEY, JSON.stringify({ code: normalizeAccessCode(code), at: Date.now() } satisfies Pending));
  } catch {
    // Storage refused: the code still works for this page load.
  }
};

/** Once, at app start: `?invite=` → storage, and whatever is pending now. */
export const takeAccessInvite = (): string | null => {
  try {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('invite');
    if (raw !== null) {
      url.searchParams.delete('invite');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      const code = normalizeAccessCode(raw);
      if (code.length === 12) {
        holdAccessInvite(code);
        return code;
      }
    }
  } catch {
    // Malformed URL: fall through to whatever is stored.
  }
  return read();
};

export const clearAccessInvite = (): void => {
  try { localStorage.removeItem(ACCESS_INVITE_KEY); } catch { /* nothing to clear */ }
};
