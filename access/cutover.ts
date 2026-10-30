/* ── When Alpha closes its doors ──
   From this instant nobody uses Alpha without a way in (a gift invite, or the
   Access Pass). The client is closed from the deploy that carries this: the
   instant is already past. The server's cutover (`access_cutover()` in
   supabase/access.sql) is the moment that file was first run, which is who
   counts as a founding member. Run the SQL first, then deploy: a closed
   client with no SQL behind it lets nobody in.

   DEV: `?access=open|closed` forces the gate either way for this tab (kept in
   sessionStorage so it survives the Google round trip). Tree-shaken from
   production. */

export const ACCESS_FROM = Date.parse('2026-10-30T00:00:00+05:30');

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

/** The Access Pass, in rupees. One price, one place. What a gift invite is worth. */
export const PASS_PRICE_INR = 2500;
export const PASS_PRICE_LABEL = '₹2,500';

/** Whatever was typed or pasted → the stored shape (supabase/access.sql). */
export const normalizeAccessCode = (raw: string): string =>
  raw.toUpperCase().replace(/[OIL]/g, c => (c === 'O' ? '0' : '1')).replace(/[^0-9A-Z]/g, '');

/** ABCD-EFGH-JKMN, for reading aloud and for the card. */
export const formatAccessCode = (code: string): string =>
  normalizeAccessCode(code).replace(/(.{4})(?=.)/g, '$1-');

/* The link a member sends. Always the production origin, so a gift copied in
   development still opens for the friend. `/gift/<code>` is a static page
   (public/gift/index.html, rewritten in vercel.json) whose only jobs are the
   link preview WhatsApp shows and sending the visitor on to `/?invite=`. */
export const GIFT_ORIGIN = 'https://trackeralpha.in';
export const inviteLink = (code: string): string => `${GIFT_ORIGIN}/gift/${formatAccessCode(code)}`;
