import { useEffect, useState } from 'react';

/* ── Presence ──
   Keeps something on screen for its exit animation after it has been told to
   go. `mounted` is whether to render it at all; `closing` is true for the
   `ms` between "close" and unmounting, which is when the leave animation
   plays (CSS keyed on `data-closing`). Reopening mid-exit cancels the exit
   and the element stays, so a quick double tap never flashes it away.

   Liquid glass cannot fade (opacity makes its own element a backdrop root),
   so its exit is a transform back into the thing that opened it. Without
   this the glass simply vanished on close, which is the opposite of how it
   arrived. Reduced motion skips the wait. */
export function usePresence(open: boolean, ms = 240): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) { setMounted(true); return; }
    if (!mounted) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setMounted(false); return; }
    const t = window.setTimeout(() => setMounted(false), ms);
    return () => window.clearTimeout(t);
  }, [open, mounted, ms]);
  return { mounted: open || mounted, closing: !open && mounted };
}
