/* ── Does this account hold a feature ──
   The CBT counterpart of admin/useAdmin.ts, and safe for the same reason: the
   answer decides whether the Question bank is drawn and nothing else. Every
   table, the figure bucket and every policy behind it re-derive the grant
   server-side from the caller's JWT (`public.has_feature`, supabase/cbt.sql).

   Asked of the server, never read from AppState — the synced blob is written
   by this client, so a grant kept there is one the client could give itself.

   Deliberately tiny and free of the CBT's own imports: it is in the main
   bundle, and everything it gates is loaded lazily. */

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { hasFeature } from './api';

export const useFeature = (user: User | null, feature: string): boolean => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!user) { setEnabled(false); return; }
    let live = true;
    hasFeature(feature).then(ok => { if (live) setEnabled(ok); });
    return () => { live = false; };
  }, [user, feature]);
  return enabled;
};
