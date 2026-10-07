/* ── Sign-out, for Decks ──
   Kept apart from decks/outbox.ts on purpose: App.tsx calls this on every
   sign-out, and importing the outbox would pull the whole Decks data layer
   into the main bundle that the tab otherwise loads lazily. */

export const OUTBOX_PREFIX = 'decks_outbox_v1:';
export const SESSION_PREFIX = 'decks_session_v1:';

/** Nothing of this account's unsent reviews, or half-finished sessions, stays on the device. */
export const forgetDecksOnDevice = (): void => {
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(OUTBOX_PREFIX) || k.startsWith(SESSION_PREFIX))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* nothing to forget */ }
};
