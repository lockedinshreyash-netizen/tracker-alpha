/* ── Where the library key comes from ──
   The account's key lives in `learn_keys` (supabase/learn.sql), reachable only
   through `learn_key(p_key)`. Every call offers a fresh random key: an account
   with none keeps it, an account with one gets its own back. So the first
   device makes the key, every later device and every sign-in after a
   sign-out fetches the same one, and two devices starting at once agree.

   Failures are named, because the Learn tab says different things for each:
   offline (try again when online), not set up (learn.sql not run yet), not a
   member, signed out. */

import { supabase } from '../supabaseClient';
import { generateRawKey, keyFromB64, keyToB64 } from './crypto';
import type { KeySource } from './store';

export type KeyFailure = 'signed-out' | 'not-member' | 'not-set-up' | 'offline' | 'bad-key';

export class KeyUnavailable extends Error {
  readonly kind: KeyFailure;
  constructor(kind: KeyFailure, message?: string) {
    super(message ?? kind);
    this.kind = kind;
  }
}

const kindFor = (code: string | undefined): KeyFailure => {
  // learn.sql's own errors, then PostgREST's "no such function", then the network.
  if (code === '28000') return 'signed-out';
  if (code === '42501') return 'not-member';
  if (code === 'PGRST202' || code === '42883') return 'not-set-up';
  return 'offline';
};

export const serverKeySource: KeySource = async () => {
  const offer = keyToB64(generateRawKey());
  const { data, error } = await supabase.rpc('learn_key', { p_key: offer });
  if (error) throw new KeyUnavailable(kindFor(error.code), error.message);
  const raw = typeof data === 'string' ? keyFromB64(data) : null;
  if (!raw) throw new KeyUnavailable('bad-key');
  return raw;
};
