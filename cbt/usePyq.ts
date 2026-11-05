/* ── May this account sit papers from the shared NTA bank ──
   useFeature's twin for supabase/pyq.sql: `pyq_open()` is a member who holds
   the `pyq` feature, or anyone once the global switch is on. The answer only
   decides whether the Question bank is drawn; every RPC and the figure bucket
   ask the same function again server-side.

   The last answer is remembered per account on this device, so Mocks opens
   on the Question bank from the first frame instead of flashing Mocks while
   the server is asked. A cached "yes" can only draw the segment; the bank
   behind it is still refused if access has gone.

   Tiny and import-light, because it sits in the main bundle. Keyed on the
   user id, not the object, which supabase-js re-creates on every resume. */

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { hasPyq } from './api';

const KEY = (id: string) => `alpha_pyq_v1:${id}`;
const cached = (id: string | null): boolean => {
  if (!id) return false;
  try { return localStorage.getItem(KEY(id)) === '1'; } catch { return false; }
};

export const usePyq = (user: User | null): boolean => {
  const id = user?.id ?? null;
  const [answer, setAnswer] = useState<{ id: string | null; open: boolean }>(() => ({ id, open: cached(id) }));
  useEffect(() => {
    if (!id) return;
    let live = true;
    hasPyq().then(ok => {
      if (!live) return;
      setAnswer({ id, open: ok });
      try { localStorage.setItem(KEY(id), ok ? '1' : '0'); } catch { /* the next visit asks again */ }
    });
    return () => { live = false; };
  }, [id]);
  // A different account than the one answered for reads its own cache until its answer arrives.
  return answer.id === id ? answer.open : cached(id);
};
