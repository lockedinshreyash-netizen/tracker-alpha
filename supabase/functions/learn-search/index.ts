/* ── learn-search: Discover's door to YouTube ──
   The only place Alpha talks to the YouTube Data API, so the key never
   reaches a browser and every call can be counted. Two modes:

   search   { mode: 'search', q, duration: 'medium' | 'long' }
            search.list for embeddable videos (safeSearch strict, India,
            English first), then one videos.list for the lengths, the
            embeddable flag and Made For Kids. 101 quota units, unless the
            same search was made in the last 6 hours (the cache).
   refresh  { mode: 'refresh', ids: [...up to 50] }
            videos.list for current titles, so a title Alpha prefilled from
            YouTube is kept fresh (it may not be kept 30 days unrefreshed).
            1 unit. A video no longer returned comes back as title null.

   Rules this file keeps (YouTube API Services policies):
   - results are returned in YouTube's order and never edited or dropped
     (III.C.5). Limiting to lectures is done with YouTube's own parameters
     only: type=video, videoEmbeddable=true, videoDuration medium|long (which
     also keeps Shorts out). Videos that can't be embedded or are gone are
     flagged, not removed;
   - nothing about who searched is stored: the cache key is a SHA-256 of the
     search alone, and the cache holds YouTube's public results for hours.

   Limits live in learn.sql §3: `learn_search_take` (the student's own token)
   takes one from today's allowance or says limit/busy; the global count of
   searches that reached YouTube is written here with the service role.

   Deploy: supabase/functions/learn-search/README.md. */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const CACHE_HOURS = 6;
const MAX_RESULTS = 12;
const ID = /^[A-Za-z0-9_-]{11}$/;
const API = 'https://www.googleapis.com/youtube/v3';

interface Found {
  id: string;
  title: string;
  channel: string;
  durationS: number | null;
  embeddable: boolean;
  madeForKids: boolean;
  thumb: string | null;
}

/** PT1H2M5S → 3725. */
const isoSeconds = (iso: string | undefined): number | null => {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? '');
  if (!m) return null;
  const [, d, h, mi, s] = m.map(x => Number(x ?? 0));
  return d * 86400 + h * 3600 + mi * 60 + s;
};

/* search.list returns HTML-escaped titles ("Newton&#39;s Laws"). */
const unescape = (s: string): string =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const sha256 = async (text: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
};

const youtube = async (path: string, params: Record<string, string>, key: string) => {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', key);
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body?.error?.errors?.[0]?.reason ?? '';
    throw new Error(/quota/i.test(reason) ? 'quota' : 'youtube');
  }
  return body;
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return ok({ error: 'method_not_allowed' }, 405);

  const key = Deno.env.get('YOUTUBE_API_KEY');
  if (!key) return ok({ error: 'not_configured' }, 503);

  // ── Who is asking: the caller's own token, verified ──
  const user = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth, error: authError } = await user.auth.getUser();
  if (authError || !auth?.user) return ok({ error: 'unauthorized' }, 401);
  const userId = auth.user.id;

  let body: { mode?: unknown; q?: unknown; duration?: unknown; ids?: unknown };
  try { body = await req.json(); } catch { return ok({ error: 'bad_request' }, 400); }

  const mode = body.mode === 'refresh' ? 'refresh' : body.mode === 'search' ? 'search' : null;
  if (!mode) return ok({ error: 'bad_request' }, 400);

  // Checked before the allowance is spent, so a bad request costs nothing.
  const q = typeof body.q === 'string' ? body.q.replace(/\s+/g, ' ').trim().slice(0, 120) : '';
  const duration = body.duration === 'long' ? 'long' : 'medium';
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter((x): x is string => typeof x === 'string' && ID.test(x)))].slice(0, 50) : [];
  if (mode === 'search' && q.length < 2) return ok({ error: 'bad_request' }, 400);
  if (mode === 'refresh' && !ids.length) return ok({ error: 'bad_request' }, 400);

  // ── Today's allowance (learn.sql §3) ──
  const { data: took, error: takeError } = await user.rpc('learn_search_take', { p_kind: mode });
  if (takeError) {
    if (takeError.code === '42501') return ok({ error: 'not_member' }, 403);
    if (takeError.code === 'PGRST202' || takeError.code === '42883') return ok({ error: 'not_set_up' }, 503);
    return ok({ error: 'server' }, 500);
  }
  if (!took?.ok) return ok({ error: took?.reason === 'busy' ? 'busy' : 'limit', remaining: took?.remaining ?? 0 }, 429);
  const remaining = typeof took.remaining === 'number' ? took.remaining : null;

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    if (mode === 'refresh') {
      const v = await youtube('videos', { part: 'snippet,status', id: ids.join(','), maxResults: '50' }, key);
      const titles = new Map<string, string>();
      for (const item of v.items ?? []) {
        if (item?.status?.embeddable !== false && typeof item?.snippet?.title === 'string') titles.set(item.id, item.snippet.title);
      }
      return ok({ titles: ids.map(id => ({ id, title: titles.get(id) ?? null })), remaining });
    }

    // ── The cache: the same words, the same length, in the last 6 hours ──
    const cacheKey = await sha256(`v1|${duration}|${q.toLowerCase()}`);
    const since = new Date(Date.now() - CACHE_HOURS * 3600_000).toISOString();
    const { data: hit } = await admin.from('learn_search_cache').select('results').eq('key', cacheKey).gte('created_at', since).maybeSingle();
    if (hit?.results) return ok({ results: hit.results, remaining, cached: true });

    const s = await youtube('search', {
      part: 'snippet',
      type: 'video',
      videoEmbeddable: 'true',
      safeSearch: 'strict',
      regionCode: 'IN',
      relevanceLanguage: 'en',
      videoDuration: duration,
      maxResults: String(MAX_RESULTS),
      q,
    }, key);
    const order: string[] = (s.items ?? []).map((i: { id?: { videoId?: string } }) => i?.id?.videoId).filter((x: unknown): x is string => typeof x === 'string' && ID.test(x));
    const snippets = new Map<string, { title?: string; channelTitle?: string; thumbnails?: Record<string, { url?: string }> }>();
    for (const i of s.items ?? []) if (i?.id?.videoId) snippets.set(i.id.videoId, i.snippet ?? {});

    const details = new Map<string, { durationS: number | null; embeddable: boolean; madeForKids: boolean }>();
    if (order.length) {
      const v = await youtube('videos', { part: 'contentDetails,status', id: order.join(','), maxResults: '50' }, key);
      for (const item of v.items ?? []) {
        details.set(item.id, {
          durationS: isoSeconds(item?.contentDetails?.duration),
          embeddable: item?.status?.embeddable !== false,
          madeForKids: item?.status?.madeForKids === true,
        });
      }
    }

    const results: Found[] = order.map(id => {
      const sn = snippets.get(id) ?? {};
      const d = details.get(id);
      return {
        id,
        title: unescape(sn.title ?? ''),
        channel: unescape(sn.channelTitle ?? ''),
        durationS: d?.durationS ?? null,
        // Not in videos.list: gone or private since search indexed it.
        embeddable: d ? d.embeddable : false,
        madeForKids: d?.madeForKids ?? false,
        thumb: sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url ?? null,
      };
    });

    await admin.from('learn_search_cache').upsert({ key: cacheKey, results, created_at: new Date().toISOString() });
    // One search reached YouTube: counted against the app-wide ceiling.
    const { data: row } = await admin.from('learn_search_usage').select('misses, day').eq('user_id', userId).order('day', { ascending: false }).limit(1).maybeSingle();
    if (row) await admin.from('learn_search_usage').update({ misses: (row.misses ?? 0) + 1 }).eq('user_id', userId).eq('day', row.day);

    return ok({ results, remaining });
  } catch (e) {
    return ok({ error: (e as Error).message === 'quota' ? 'busy' : 'youtube' }, 502);
  }
});
