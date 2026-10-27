/* ── Scroll calm ──
   While anything on the page is scrolling, `html.scrolling` is set, and
   index.css uses it to hold the expensive things still until the page does:

   - Liquid glass drops its refraction (an SVG filter chain of displacement,
     blur, masks and merges) for the plain frosted blur it already uses before
     its maps load. A backdrop filter re-runs on every frame its backdrop
     changes, and during a scroll that is every frame, for every glass element
     on screen. The bending at the rim is invisible on a page in motion anyway.
   - The festive layer and the Aurora wallpaper pause their endless animations,
     so the compositor is not redrawing them under a moving page too.

   One passive listener, capture phase so inner scrollers (the board's columns,
   a chat) count too. The class changes twice per gesture, never per frame. */

const SETTLE_MS = 160;

let installed = false;

export const installScrollCalm = (): void => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const root = document.documentElement;
  let timer = 0;
  let on = false;
  const settle = () => {
    on = false;
    root.classList.remove('scrolling');
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!on) {
        on = true;
        root.classList.add('scrolling');
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, SETTLE_MS);
    },
    { passive: true, capture: true },
  );
};
