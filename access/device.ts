/* ── A device that was here before the doors closed ──
   A guest never had an account, so the only record of them is this device: a
   stamp written the first time the app proper is used here, and the logs it
   holds. When such a device signs into a new account, the Gate says "You used
   Alpha before" and the application carries the earliest of those days
   (`device_since`), so staff can let them in first.

   It is a hint and never access. Both can be forged in localStorage, which is
   why the old automatic founding claim was removed.

   The stamp is never cleared on sign-out (App's forgetAccountOnDevice removes
   only sb-* and the state blob). */

import { getISTDateString } from '../utils';

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

/** The earliest study day this device shows Alpha in use, or null. */
export const deviceSince = (logs: ReadonlyArray<{ date: string }>): string | null => {
  let best: string | null = null;
  const stamp = readStamp();
  if (stamp !== null) best = getISTDateString(new Date(stamp));
  for (const l of logs) {
    if (typeof l.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(l.date) && (best === null || l.date < best)) {
      best = l.date;
    }
  }
  return best;
};
