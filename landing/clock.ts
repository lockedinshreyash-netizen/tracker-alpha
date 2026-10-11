/* ── The landing page's idea of "now" on its first render ──
   The page is rendered to HTML at build time (landing/prerender.tsx) and then
   hydrated in the browser. Hydration only works if the browser's first render
   produces the same markup, and the countdown is a number that depends on the
   clock. So both sides start from the BUILD time: the build sets it before
   rendering, index.tsx reads it back off #root before hydrating, and the page
   moves to the real time in an effect one tick later. */

let firstNow: number | null = null;

export const setLandingClock = (ms: number): void => {
  firstNow = Number.isFinite(ms) ? ms : null;
};

/** The time the page's first render should use. */
export const landingNow = (): number => firstNow ?? Date.now();
