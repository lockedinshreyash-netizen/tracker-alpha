/* ── Learn is opt-in ──
   Notes' rule (notes/pref.ts), for the same reason: the decision rides
   AppState so turning Learn on once reaches every device, and it is dated so
   an older "off" from another device can never undo a newer "on" here. Every
   merge path keeps whichever decision was made last. Only the decision syncs;
   the library itself never leaves the device.

   Kept import-free: App imports it in the main bundle. */

export interface LearnPref { on: boolean; at: number }

export const learnOn = (p: LearnPref | undefined | null): boolean => !!p?.on;

export const mergeLearnPref = (a: LearnPref | undefined, b: LearnPref | undefined): LearnPref | undefined => {
  if (!a) return b;
  if (!b) return a;
  return b.at > a.at ? b : a;
};
