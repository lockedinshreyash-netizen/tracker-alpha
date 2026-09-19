/* ── Is the person at this keyboard an administrator ──

   The answer this hook returns decides whether a tab is drawn. It decides
   nothing else, and it is worth stating plainly why that is safe:

   The console can only reach the database through PostgREST, and every table
   and function it touches re-derives the same predicate server-side from the
   caller's verified JWT (`public.is_admin()`, supabase/admin.sql §2). A student
   who forces this to `true` in devtools gets the tab, gets the compose form,
   presses Publish, and receives a row-level-security failure. Nothing they can
   do to this file changes what the database will accept.

   So the check is here for one reason only: not putting an admin console in
   front of people who cannot use it.

   It asks the server rather than reading a role out of `AppState`. The blob in
   `user_profiles` is written by the client on every change, so a role stored
   there would be a privilege the client could grant itself by editing
   localStorage — which is exactly why `user_roles` is a table no client may
   write at all. */

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

export interface AdminState {
  isAdmin: boolean;
  /** False until the answer is in. Nothing admin-shaped should render before. */
  checked: boolean;
}

export const useAdmin = (user: User | null): AdminState => {
  const [state, setState] = useState<AdminState>({ isAdmin: false, checked: false });

  useEffect(() => {
    if (!user) {
      setState({ isAdmin: false, checked: true });
      return;
    }

    let live = true;
    setState({ isAdmin: false, checked: false });

    supabase.rpc('is_admin').then(({ data, error }) => {
      if (!live) return;
      /* An error here is almost always "function does not exist" — the
         migration has not been run on this project yet. Not an administrator,
         and nothing to say about it: the app is entirely usable without any of
         this. */
      setState({ isAdmin: !error && data === true, checked: true });
    });

    return () => { live = false; };
  }, [user]);

  return state;
};
