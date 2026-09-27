/* ── Is this account in the Mentor beta ──
   Same stance as admin/useAdmin: this decides what is DRAWN — the Mentor, or
   the invite gate in front of it — and nothing else. The `mentor` edge
   function asks `mentor_access()` again on every single call, with the
   caller's own JWT, so forcing `allowed` true in devtools yields a tab whose
   every request is refused with `forbidden`.

   The answer comes from the server rather than AppState because the blob is
   client-written — an allowlist kept there is one a student could add
   themselves to. */

import { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

/**
 * Whether this deployment ships the Mentor at all. Off unless the build sets
 * VITE_MENTOR_ENABLED=true — until then the tab never renders, gate included.
 * When on, the tab is visible to everyone; what is behind it is invite-only.
 */
export const MENTOR_AVAILABLE = import.meta.env.VITE_MENTOR_ENABLED === 'true';

/* Local development only, tree-shaken out of production builds, changing
   nothing server-side:
     ?mentor=dev   draw the Mentor as a beta member (with invite rights)
     ?mentor=gate  draw the invite gate as an outsider sees it */
const DEV_MODE = import.meta.env.DEV && typeof location !== 'undefined'
  ? new URLSearchParams(location.search).get('mentor')
  : null;

/** Whether the Mentor tab (the Mentor, or its gate) is in the rail at all. */
export const MENTOR_TAB_VISIBLE = MENTOR_AVAILABLE || DEV_MODE === 'dev' || DEV_MODE === 'gate';

export interface MentorAccess {
  allowed: boolean;
  canInvite: boolean;
  checked: boolean;
  /** Ask again — after redeeming an invite, for one. */
  refresh: () => void;
}

export const useMentorAccess = (user: User | null): MentorAccess => {
  const [state, setState] = useState({ allowed: false, canInvite: false, checked: false });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (DEV_MODE === 'dev') { setState({ allowed: true, canInvite: true, checked: true }); return; }
    if (DEV_MODE === 'gate') { setState({ allowed: false, canInvite: false, checked: true }); return; }
    if (!MENTOR_AVAILABLE || !user) { setState({ allowed: false, canInvite: false, checked: true }); return; }

    let live = true;
    setState(s => ({ ...s, checked: false }));
    supabase.rpc('mentor_status').then(({ data, error }) => {
      if (!live) return;
      /* An error is almost always "function does not exist" — supabase/mentor.sql
         has not been run. Not in the beta, and the gate says so honestly. */
      setState({
        allowed: !error && data?.access === true,
        canInvite: !error && data?.can_invite === true,
        checked: true,
      });
    });
    return () => { live = false; };
  }, [user, nonce]);

  const refresh = useCallback(() => setNonce(n => n + 1), []);
  return { ...state, refresh };
};
