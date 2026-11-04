/* ── Discover's calls ──
   Everything goes through the `learn-search` Edge Function, which holds the
   YouTube key and counts the allowance (learn.sql §3). Every failure has a
   name, because Discover says something different for each, and none of them
   blames the student's connection unless the browser really is offline.

   In development (`?learnkey=dev`, or `?discover=fixtures`) the calls are
   answered by fixtures on this device, so the screens can be built and tried
   without a key, a quota or a deployed function. */

import { supabase } from '../../supabaseClient';
import { devKeyOn } from '../devKey';

export type Length = 'medium' | 'long';

export interface FoundVideo {
  id: string;
  title: string;
  channel: string;
  durationS: number | null;
  /** False when the creator turned embedding off since, or the video is gone. */
  embeddable: boolean;
  madeForKids: boolean;
  /** YouTube's own thumbnail, shown live in Discover, never stored. */
  thumb: string | null;
}

export type DiscoverFailure = 'limit' | 'busy' | 'offline' | 'unreachable' | 'not-set-up' | 'not-member' | 'signed-out' | 'error';

/* Both sides name every field: this tsconfig has no strictNullChecks, so
   TypeScript cannot narrow a union on `ok` (video/model.ts says the same). */
export type SearchResult =
  | { ok: true; results: FoundVideo[]; remaining: number | null; reason?: undefined }
  | { ok: false; reason: DiscoverFailure; results?: undefined; remaining?: undefined };

export type RefreshResult =
  | { ok: true; titles: { id: string; title: string | null }[]; reason?: undefined }
  | { ok: false; reason: DiscoverFailure; titles?: undefined };

/** Discover is drawn only when the function is deployed (or in dev with fixtures). */
export const discoverEnabled = (): boolean =>
  import.meta.env.VITE_LEARN_DISCOVER === 'true' || (import.meta.env.DEV && (devKeyOn() || fixturesOn()));

const fixturesOn = (): boolean => {
  if (!import.meta.env.DEV) return false;
  try {
    if (new URLSearchParams(location.search).get('discover') === 'fixtures') sessionStorage.setItem('learn_discover_fixtures_v1', '1');
    return sessionStorage.getItem('learn_discover_fixtures_v1') === '1' || devKeyOn();
  } catch { return false; }
};

const failureFor = async (error: unknown): Promise<DiscoverFailure> => {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.status === 'number') {
    let code = '';
    try { code = (await ctx.clone().json())?.error ?? ''; } catch { /* not JSON */ }
    if (ctx.status === 429) return code === 'busy' ? 'busy' : 'limit';
    if (ctx.status === 401) return 'signed-out';
    if (ctx.status === 403) return 'not-member';
    if (ctx.status === 404 || code === 'not_configured' || code === 'not_set_up') return 'not-set-up';
    if (code === 'busy') return 'busy';
    return 'error';
  }
  return typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'unreachable';
};

export const searchYouTube = async (q: string, length: Length): Promise<SearchResult> => {
  if (import.meta.env.DEV && fixturesOn()) return (await import('./fixtures')).fixtureSearch(q, length);
  const { data, error } = await supabase.functions.invoke('learn-search', { body: { mode: 'search', q, duration: length } });
  if (error) return { ok: false, reason: await failureFor(error) };
  if (!data || !Array.isArray(data.results)) return { ok: false, reason: 'error' };
  return { ok: true, results: data.results as FoundVideo[], remaining: typeof data.remaining === 'number' ? data.remaining : null };
};

/** Current titles for lectures whose title came from YouTube (it may not be kept 30 days unrefreshed). */
export const refreshTitles = async (ids: string[]): Promise<RefreshResult> => {
  if (import.meta.env.DEV && fixturesOn()) return (await import('./fixtures')).fixtureRefresh(ids);
  const { data, error } = await supabase.functions.invoke('learn-search', { body: { mode: 'refresh', ids } });
  if (error) return { ok: false, reason: await failureFor(error) };
  if (!data || !Array.isArray(data.titles)) return { ok: false, reason: 'error' };
  return { ok: true, titles: data.titles };
};

/** Searches left today, for the quiet count under the box. Null when it can't be known. */
export const searchesLeft = async (): Promise<number | null> => {
  if (import.meta.env.DEV && fixturesOn()) return (await import('./fixtures')).fixtureLeft();
  const { data, error } = await supabase.rpc('learn_search_left');
  return error || typeof data !== 'number' ? null : data;
};
