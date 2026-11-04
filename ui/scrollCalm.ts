/* ── Scroll calm ──
   While anything on the page is scrolling, `html.scrolling` is set, and
   index.css uses it to hold the expensive things still until the page does:

   - The festive layer and the Aurora wallpaper pause their endless animations,
     so the compositor is not redrawing them under a moving page.

   Liquid glass is NOT touched. It used to swap its refraction for a plain
   frosted blur while scrolling; the instant change of look at the start and
   end of every gesture read as the app flickering, and on a laptop scrolling
   with the refraction left on measured just as smooth (60fps, Syllabus, five
   glass elements). If a phone struggles, make the lens cheaper rather than
   switching it off mid-gesture.

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
