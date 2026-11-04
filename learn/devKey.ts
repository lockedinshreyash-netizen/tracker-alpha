/* ── A pretend key server, for development only ──
   `/?open=learn&learnkey=dev` on the dev server opens the real Learn tab with
   keys kept in localStorage instead of `learn_keys`, so the tab can be built
   and tried before learn.sql is run, and without signing in (the owner is
   then `dev-guest`). The same store DebugLibrary.tsx uses. Every caller
   checks `import.meta.env.DEV` first, so none of this reaches production. */

import { generateRawKey, keyFromB64, keyToB64 } from './crypto';
import type { KeySource } from './store';

const SERVER = 'learn_debug_server_keys_v1';
const FLAG = 'learn_dev_key_v1';

/** On for this tab once `?learnkey=dev` has been seen (sessionStorage, so it survives a reload). */
export const devKeyOn = (): boolean => {
  try {
    if (new URLSearchParams(location.search).get('learnkey') === 'dev') sessionStorage.setItem(FLAG, '1');
    return sessionStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
};

export const devKeySource = (owner: string): KeySource => async () => {
  const keys: Record<string, string> = (() => {
    try { return JSON.parse(localStorage.getItem(SERVER) || '{}'); } catch { return {}; }
  })();
  const have = keys[owner] && keyFromB64(keys[owner]);
  if (have) return have;
  const raw = generateRawKey();
  localStorage.setItem(SERVER, JSON.stringify({ ...keys, [owner]: keyToB64(raw) }));
  return raw;
};
