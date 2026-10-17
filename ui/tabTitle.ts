/* ── Who owns the tab title ──
   Two writers, one rule. While nothing is happening, the title is the idle
   title App sets ("🔥12 · 2.5h/10h · Alpha", see usePresence), so a student
   with thirty tabs open can still see their day in the strip. While a Pomodoro
   block runs (or a step needs a clean name to be bookmarked), that writer
   holds the title, and letting go puts the latest idle title back, not
   whatever the title was when the app first loaded. */

let idle = typeof document !== 'undefined' ? document.title : 'Tracker Alpha';
let holders = 0;

export const idleTitle = (): string => idle;

export const setIdleTitle = (t: string): void => {
  idle = t;
  if (holders === 0 && typeof document !== 'undefined') document.title = t;
};

/** Take the title. Returns the release, which restores the idle title. */
export const holdTitle = (): (() => void) => {
  holders += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders === 0 && typeof document !== 'undefined') document.title = idle;
  };
};
