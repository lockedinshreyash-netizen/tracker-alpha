/* ── Will this visit see the landing page? ──
   Asked synchronously, before React exists, by three readers that must agree:
   the inline script in index.html (which hides the pre-rendered page before
   first paint for anyone who will not see it), index.tsx (hydrate or start
   fresh) and App's first render (show the landing at once rather than a blank
   screen while the session is checked).

   The inline script in index.html is a hand copy of this function. Change one,
   change both.

   Only first-time, signed-out visitors without an invite see the page — the
   same rule App has always applied after `getSession()`. A stored Supabase
   session means "probably signed in": App then waits for the real answer, as
   before. */

const INVITE_KEY = 'groups_pending_invite_v1';

export const landingWillShow = (): boolean => {
  try {
    if (localStorage.getItem('hasVisited') === 'true') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.has('join')) return false;
    // A guide page's "track this" link goes straight into the app (landing/deeplink.ts).
    if (params.has('open')) return false;
    if (localStorage.getItem(INVITE_KEY)) return false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) return false;
    }
    return true;
  } catch {
    // Storage blocked: nothing remembers this visitor, so they are new.
    return true;
  }
};
