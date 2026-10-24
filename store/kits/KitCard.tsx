/* ── A kit on the table ──
   The surface a single kit box is set down on (its page in the store, and in
   My Alpha), and the tag a kit wears. In the store's listing kits stand in
   piles on shelves instead (KitShelf). The table is a step lighter than the
   page in dark mode (graphite, the pack wall's lesson: black boxes on a black
   table vanish). */

import React, { useEffect, useState } from 'react';
import { priceLabel } from '../../decks/store/PackCard';
import type { Kit } from '../types';

export const tableStyle = (dark: boolean): React.CSSProperties => ({
  background: dark
    ? 'radial-gradient(120% 70% at 50% 0%, #26262c 0%, #1b1b20 55%, #151519 100%)'
    : 'radial-gradient(120% 70% at 50% 0%, #ffffff 0%, #f1efea 55%, #e7e4dd 100%)',
  boxShadow: dark ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'inset 0 1px 0 rgba(255,255,255,0.9)',
});

/** Box width on the table. */
export const useBoxSize = (): number => {
  const pick = () => (typeof window === 'undefined' ? 210
    : window.matchMedia('(min-width: 1024px)').matches ? 210
    : window.matchMedia('(min-width: 640px)').matches ? 190 : 168);
  const [s, setS] = useState(pick);
  useEffect(() => {
    const qs = ['(min-width: 1024px)', '(min-width: 640px)'].map(q => window.matchMedia(q));
    const on = () => setS(pick());
    qs.forEach(q => q.addEventListener('change', on));
    return () => qs.forEach(q => q.removeEventListener('change', on));
  }, []);
  return s;
};

export const kitTag = (k: Pick<Kit, 'inLibrary' | 'status' | 'access' | 'priceInr'>): string =>
  k.inLibrary ? 'In My Alpha' : k.status === 'draft' ? 'Draft' : k.access === 'pro' ? 'Alpha Pro' : priceLabel(k) === 'FREE' ? 'Free' : priceLabel(k);
