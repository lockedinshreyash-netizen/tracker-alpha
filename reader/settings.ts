/* ── How the page looks: device-local reading settings ──

   Text size, typeface, spacing, measure and page colour belong to the screen
   in front of the reader, not to the account: 19px on a laptop is wrong on a
   phone held at arm's length on a bus. So they live in localStorage, like the
   sound preference, and never in AppState (where every tap of A+ would fire a
   sync of the whole blob). */

import { useCallback, useEffect, useState } from 'react';

export type PageTheme = 'auto' | 'paper' | 'sepia' | 'dusk' | 'night';
export type Typeface = 'serif' | 'sans';

export interface ReaderSettings {
  theme: PageTheme;
  font: Typeface;
  /** Index into SIZES. */
  size: number;
  /** Index into LEADINGS. */
  leading: number;
  /** Index into MEASURES. */
  width: number;
  justify: boolean;
}

export const SIZES = [15, 16, 17, 18, 19, 20, 22, 24];
export const LEADINGS = [1.5, 1.65, 1.8];
export const LEADING_NAMES = ['Compact', 'Normal', 'Airy'];
/** Line length in ems: ~60, ~68 and ~78 characters. */
export const MEASURES = [30, 34, 39];
export const MEASURE_NAMES = ['Narrow', 'Normal', 'Wide'];

export const PAGE_THEMES: Array<{ id: Exclude<PageTheme, 'auto'>; name: string; bg: string; ink: string }> = [
  { id: 'paper', name: 'Paper', bg: '#FBFAF7', ink: '#1E1D1A' },
  { id: 'sepia', name: 'Sepia', bg: '#F3EAD7', ink: '#3A2E21' },
  { id: 'dusk', name: 'Dusk', bg: '#1C1D20', ink: '#DAD6CE' },
  { id: 'night', name: 'Night', bg: '#000000', ink: '#B9B5AD' },
];

export const DEFAULT_SETTINGS: ReaderSettings = { theme: 'auto', font: 'serif', size: 3, leading: 1, width: 1, justify: false };

const KEY = 'reader_settings_v1';
const clampInt = (v: unknown, max: number, d: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : d;

export const normalizeSettings = (raw: unknown): ReaderSettings => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    theme: ['auto', 'paper', 'sepia', 'dusk', 'night'].includes(r.theme as string) ? (r.theme as PageTheme) : DEFAULT_SETTINGS.theme,
    font: r.font === 'sans' ? 'sans' : 'serif',
    size: clampInt(r.size, SIZES.length - 1, DEFAULT_SETTINGS.size),
    leading: clampInt(r.leading, LEADINGS.length - 1, DEFAULT_SETTINGS.leading),
    width: clampInt(r.width, MEASURES.length - 1, DEFAULT_SETTINGS.width),
    justify: r.justify === true,
  };
};

const read = (): ReaderSettings => {
  try { return normalizeSettings(JSON.parse(localStorage.getItem(KEY) ?? 'null')); } catch { return DEFAULT_SETTINGS; }
};

/**
 * `override` (the design board) pins the settings and stops them being saved,
 * so one frame's choices never leak into another's through shared storage.
 */
export const useReaderSettings = (override?: Partial<ReaderSettings>) => {
  const [settings, setSettings] = useState<ReaderSettings>(() => (override ? normalizeSettings({ ...DEFAULT_SETTINGS, ...override }) : read()));
  const update = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings(prev => {
      const next = normalizeSettings({ ...prev, ...patch });
      if (!override) {
        try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* private window: holds for the visit */ }
      }
      return next;
    });
  }, [override]);
  return [settings, update] as const;
};

export const resolveTheme = (t: PageTheme, appDark: boolean): Exclude<PageTheme, 'auto'> =>
  t === 'auto' ? (appDark ? 'dusk' : 'paper') : t;

/* ── The book face ──
   Literata was drawn for long-form reading on screens (it is Google Play
   Books' text face), with optical sizes, so the same family sets 15px body
   and a 40px title well. Loaded only when the reader opens; until it lands
   the page reads in Georgia, which has the same proportions. */
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;0,7..72,500;0,7..72,600;1,7..72,400;1,7..72,500&display=swap';

export const useBookFont = () => {
  useEffect(() => {
    if (document.querySelector('link[data-reader-font]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    link.dataset.readerFont = '1';
    document.head.appendChild(link);
  }, []);
};
