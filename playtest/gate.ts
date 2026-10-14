/* Whether this device should see the Play Store ask (PlaytestMoment.tsx).
   Separate from the component so App can ask without pulling the screen, its
   stylesheet and the onboarding kit into the main bundle. */

import { isAndroidApp, isIOS } from '../install/useInstall';

export const PLAYTEST_URL = 'https://play.google.com/apps/testing/in.trackeralpha.app';
export const PLAYTEST_SEEN_KEY = 'playtest_v1';
/* After this the ask is stale: Alpha is either live or the test has moved on. */
const UNTIL = Date.parse('2026-12-31T23:59:59+05:30');

/** Read once, at App start. No iPhone (no Android app to test), not inside the Play app (already a tester). */
export const shouldShowPlaytest = (): boolean => {
  if (Date.now() > UNTIL || isIOS() || isAndroidApp()) return false;
  try {
    return localStorage.getItem(PLAYTEST_SEEN_KEY) !== '1';
  } catch {
    return false; // storage refused: a "not now" could not be remembered, so do not ask
  }
};
