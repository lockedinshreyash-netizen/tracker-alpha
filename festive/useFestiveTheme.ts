/* ── The festive theme everyone is seeing right now ──

   One global value, chosen by an administrator (Console → Theme) and kept in
   the single-row `app_settings` table (supabase/festive.sql). Never in
   `AppState`: the blob is per-student and client-written, and a theme that
   rode it would be a theme each device could set for itself.

   How a flip reaches an open tab:
     1. Realtime UPDATE on `app_settings` — the doorbell, within a second.
     2. A re-read when the tab comes back to the foreground (throttled), for a
        socket that died while the laptop slept.
   And the last answer is cached in localStorage, so a reload paints the
   theme on the first frame instead of popping it in after a round trip.

   Everything fails quiet. Before festive.sql is run the select errors, the
   cache stays empty, and the app looks exactly as it always has. */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export type FestiveTheme = 'none' | 'dussehra' | 'diwali' | 'christmas';

export const FESTIVE_THEMES: FestiveTheme[] = ['none', 'dussehra', 'diwali', 'christmas'];

/** The one greeting line a theme adds to Today's header, with its ink per mode. */
export const FESTIVE_GREETING: Record<Exclude<FestiveTheme, 'none'>, { text: string; dark: string; light: string }> = {
  dussehra: { text: 'Happy Dussehra', dark: '#FFC078', light: '#C2410C' },
  diwali: { text: 'Shubh Deepavali', dark: '#FFC078', light: '#C2410C' },
  christmas: { text: 'Merry Christmas', dark: '#F2C14E', light: '#1F5A3C' },
};

const CACHE_KEY = 'alpha_festive_v1';
const RECHECK_MS = 2 * 60 * 1000;

const isTheme = (v: unknown): v is FestiveTheme =>
  typeof v === 'string' && (FESTIVE_THEMES as string[]).includes(v);

/* DEV only: `?festive=diwali` (or dussehra, christmas, none) paints a theme without a database, so the
   designs can be judged before the migration is run. Tree-shaken in prod. */
const devOverride = (): FestiveTheme | null => {
  if (!import.meta.env.DEV) return null;
  try {
    const v = new URLSearchParams(window.location.search).get('festive');
    return isTheme(v) ? v : null;
  } catch { return null; }
};

const readCache = (): FestiveTheme => {
  try {
    const v = localStorage.getItem(CACHE_KEY);
    return isTheme(v) ? v : 'none';
  } catch { return 'none'; }
};

const writeCache = (t: FestiveTheme) => {
  try { localStorage.setItem(CACHE_KEY, t); } catch { /* private window */ }
};

export const fetchFestiveTheme = async (): Promise<FestiveTheme | null> => {
  const { data, error } = await supabase
    .from('app_settings')
    .select('festive_theme')
    .eq('id', 1)
    .maybeSingle();
  if (error || !data) return null;
  return isTheme(data.festive_theme) ? data.festive_theme : null;
};

/** Admin only — the database refuses everyone else. Returns a message on failure. */
export const setFestiveTheme = async (t: FestiveTheme): Promise<string | null> => {
  const { error } = await supabase.rpc('admin_set_festive_theme', { p_theme: t });
  if (!error) { writeCache(t); return null; }
  if (error.code === 'PGRST202') return 'Theme switch is not set up yet. Run supabase/festive.sql first.';
  if (error.code === '42501') return 'Only administrators can change the theme.';
  return 'Could not change the theme. Try again.';
};

export const useFestiveTheme = (): FestiveTheme => {
  const override = devOverride();
  const [theme, setTheme] = useState<FestiveTheme>(() => override ?? readCache());

  const apply = useCallback((t: FestiveTheme) => {
    writeCache(t);
    setTheme(t);
  }, []);

  useEffect(() => {
    if (override) return;
    let live = true;
    let last = 0;

    const check = () => {
      last = Date.now();
      fetchFestiveTheme().then(t => { if (live && t) apply(t); });
    };
    check();

    const channel = supabase
      .channel('app_settings_festive')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'app_settings' },
        payload => {
          const t = (payload.new as { festive_theme?: unknown })?.festive_theme;
          if (live && isTheme(t)) apply(t);
        },
      )
      .subscribe();

    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - last > RECHECK_MS) check();
    };
    document.addEventListener('visibilitychange', onVisible);

    /* The admin's own tab hears the flip at once, before Realtime echoes it. */
    const onLocal = (e: Event) => {
      const t = (e as CustomEvent).detail;
      if (isTheme(t)) apply(t);
    };
    window.addEventListener('alpha:festive', onLocal);

    return () => {
      live = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('alpha:festive', onLocal);
      supabase.removeChannel(channel);
    };
  }, [override, apply]);

  return override ?? theme;
};

export const announceLocalFlip = (t: FestiveTheme) => {
  window.dispatchEvent(new CustomEvent('alpha:festive', { detail: t }));
};
