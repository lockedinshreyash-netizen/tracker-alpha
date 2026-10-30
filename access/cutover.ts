/* ── When Alpha closes its doors ──
   From this instant a new account needs a way in (an invite, the Priority
   Pass, or the waitlist). Before it the gate is inert and everyone already
   here becomes a founding member. supabase/access.sql holds the same instant
   (`access_cutover()`); change both or neither.

   DEV: `?access=open|closed` forces the gate either way for this tab (kept in
   sessionStorage so it survives the Google round trip). Tree-shaken from
   production. */

export const ACCESS_FROM = Date.parse('2026-11-01T00:00:00+05:30');
/** The first study day that is NOT founding (IST, YYYY-MM-DD). */
export const ACCESS_FROM_DAY = '2026-11-01';

const FORCE_KEY = 'alpha_access_force';

const forced = (): boolean | null => {
  if (!import.meta.env.DEV) return null;
  try {
    const q = new URLSearchParams(window.location.search).get('access');
    if (q === 'open' || q === 'closed') sessionStorage.setItem(FORCE_KEY, q);
    const v = sessionStorage.getItem(FORCE_KEY);
    return v === 'closed' ? true : v === 'open' ? false : null;
  } catch {
    return null;
  }
};

/** Is the door closed right now. */
export const accessLive = (now: number = Date.now()): boolean => forced() ?? now >= ACCESS_FROM;

/** The Priority Pass, in rupees. One price, one place. */
export const PASS_PRICE_INR = 2500;
export const PASS_PRICE_LABEL = '₹2,500';

/** Whatever was typed or pasted → the stored shape (supabase/access.sql). */
export const normalizeAccessCode = (raw: string): string =>
  raw.toUpperCase().replace(/[OIL]/g, c => (c === 'O' ? '0' : '1')).replace(/[^0-9A-Z]/g, '');

/** ABCD-EFGH-JKMN, for reading aloud and for the card. */
export const formatAccessCode = (code: string): string =>
  normalizeAccessCode(code).replace(/(.{4})(?=.)/g, '$1-');

export const inviteLink = (code: string): string =>
  `${window.location.origin}/?invite=${normalizeAccessCode(code)}`;
