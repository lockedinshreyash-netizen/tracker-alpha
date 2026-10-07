/* The two things about the device the store has to know: how much rack fits,
   and whether the user asked for less motion. */

import { useEffect, useState } from 'react';
import { RACK_SIZES, type RackSize } from './geometry';

const pick = (): RackSize => {
  if (typeof window === 'undefined') return RACK_SIZES.desk;
  if (window.matchMedia('(min-width: 1024px)').matches) return RACK_SIZES.desk;
  if (window.matchMedia('(min-width: 640px)').matches) return RACK_SIZES.tablet;
  return RACK_SIZES.phone;
};

export const useRackSize = (): RackSize => {
  const [size, setSize] = useState(pick);
  useEffect(() => {
    const qs = ['(min-width: 1024px)', '(min-width: 640px)'].map(q => window.matchMedia(q));
    const on = () => setSize(pick());
    qs.forEach(q => q.addEventListener('change', on));
    return () => qs.forEach(q => q.removeEventListener('change', on));
  }, []);
  return size;
};

const reducedNow = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(reducedNow);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(q.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return reduced;
};
