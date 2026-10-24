import { useEffect, useState } from 'react';

/** The width of an element, kept current. 0 until it is measured. */
export const useWidth = (ref: React.RefObject<HTMLElement | null>): number => {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
};
