/* ── A device that was here before the doors closed ──
   Founding members are accounts created before the cutover, and the server
   knows those by itself. A guest never had an account, so the only record of
   them is this device: a stamp written the first time the app proper is used
   here (past onboarding), plus any log dated before the cutover, for a device
   that was not opened between this build and the cutover.

   Such a device keeps guest mode for good — local only, nothing reaches the
   backend — and if its owner signs into a new account it claims founding
   access for it (`claim_founding_device`, flagged for staff). localStorage can
   be forged; that is accepted, because the cost is one account and staff see
   every claim.

   The stamp is never cleared on sign-out (App's forgetAccountOnDevice removes
   only sb-* and the state blob), or signing out would demote the device. */

import { getISTDateString } from '../utils';
import { ACCESS_FROM, ACCESS_FROM_DAY } from './cutover';

const STAMP = 'alpha_device_since_v1';

const readStamp = (): number | null => {
  try {
    const v = Number(localStorage.getItem(STAMP));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};

/** Called once the app proper is in use on this device. Writes only once. */
export const stampDevice = (): void => {
  try {
    if (readStamp() === null) localStorage.setItem(STAMP, String(Date.now()));
  } catch {
    // Storage refused: the device simply has no stamp.
  }
};

/**
 * The earliest study day this device can show from before the cutover, or
 * null if it has none. What `claim_founding_device` is sent.
 */
export const foundingDay = (logs: ReadonlyArray<{ date: string }>): string | null => {
  let best: string | null = null;
  const stamp = readStamp();
  if (stamp !== null && stamp < ACCESS_FROM) best = getISTDateString(new Date(stamp));
  for (const l of logs) {
    if (typeof l.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(l.date) && l.date < ACCESS_FROM_DAY && (best === null || l.date < best)) {
      best = l.date;
    }
  }
  return best;
};
