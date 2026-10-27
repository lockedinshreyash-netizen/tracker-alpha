import { useEffect, useState } from 'react';

/**
 * The time, redrawn once a second while `active`, on the beat of `anchor`.
 *
 * For a clock that shows whole seconds. A clock redrawn every 100 or 250ms
 * re-renders whatever holds it four to ten times for each change anyone can
 * see; this re-renders once, just after the digit flips. `anchor` is the
 * instant the shown figure is counted from or to (a start, a deadline), so the
 * redraw lands on its second boundaries rather than the wall clock's.
 *
 * Keep the component that calls this small: everything under it redraws every
 * second.
 */
export const useSecondTick = (active: boolean, anchor = 0): number => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    let id = 0;
    const tick = () => {
      const n = Date.now();
      setNow(n);
      const phase = ((n - anchor) % 1000 + 1000) % 1000;
      id = window.setTimeout(tick, 1000 - phase + 8);
    };
    id = window.setTimeout(tick, 1000 - ((((Date.now() - anchor) % 1000) + 1000) % 1000) + 8);
    // A throttled background tab is put right the moment it is looked at.
    const onVisible = () => { if (!document.hidden) setNow(Date.now()); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [active, anchor]);
  return now;
};
