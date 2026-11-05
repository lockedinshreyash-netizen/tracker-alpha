/* ── May this account sit papers from the shared NTA bank ──
   useFeature's twin for supabase/pyq.sql: `pyq_open()` is a member who holds
   the `pyq` feature, or anyone once the global switch is on. The answer only
   decides whether the Question bank is drawn; every RPC and the figure bucket
   ask the same function again server-side.

   Tiny and import-light, because it sits in the main bundle. Keyed on the
   user id, not the object, which supabase-js re-creates on every resume. */

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { hasPyq } from './api';

export const usePyq = (user: User | null): boolean => {
  const [open, setOpen] = useState(false);
  const id = user?.id ?? null;
  useEffect(() => {
    if (!id) { setOpen(false); return; }
    let live = true;
    hasPyq().then(ok => { if (live) setOpen(ok); });
    return () => { live = false; };
  }, [id]);
  return open;
};
