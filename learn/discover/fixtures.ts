/* ── Discover without YouTube (DEV only) ──
   Deterministic results for any search, in YouTube's response shape, so the
   screens can be designed and tried with no key and no quota. The allowance
   is counted in sessionStorage like the real one (30 a day). Typing
   "limit", "busy", "offline", "nothing" or "error" shows that state.

   Only reached through a dynamic import behind `import.meta.env.DEV`, so none
   of it is in a production bundle. Thumbnails are flat SVG placeholders, not
   YouTube's. */

import type { FoundVideo, Length, RefreshResult, SearchResult } from './api';

const LEFT_KEY = 'learn_discover_fixture_left_v1';

const CHANNELS = ['Axis Physics', 'Concept Lab', 'Problem Room', 'Kinematics Daily', 'Mole Concept Hub', 'Calculus Room'];
const SHAPES = ['Complete chapter', 'One shot', 'Every derivation', 'PYQs solved', 'From zero', 'Revision in one sitting', 'Concept and problems', 'Full lecture'];

const seeded = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0; return ((h ^= h >>> 16) >>> 0) / 4294967296; };
};

const idFor = (rand: () => number): string => {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  return Array.from({ length: 11 }, () => a[Math.floor(rand() * a.length)]).join('');
};

const thumb = (hue: number, label: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},45%,28%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},40%,12%)"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><circle cx="250" cy="60" r="38" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="2"/><text x="20" y="150" fill="rgba(255,255,255,.85)" font-family="sans-serif" font-size="20" font-weight="700">${label.replace(/[<&>]/g, '')}</text></svg>`,
  )}`;

const left = (): number => {
  try { const n = Number(sessionStorage.getItem(LEFT_KEY)); return Number.isFinite(n) && sessionStorage.getItem(LEFT_KEY) !== null ? n : 30; } catch { return 30; }
};

export const fixtureLeft = async (): Promise<number> => left();

export const fixtureSearch = async (q: string, length: Length): Promise<SearchResult> => {
  await new Promise(r => setTimeout(r, 450));
  const words = q.toLowerCase();
  if (words.includes('offline')) return { ok: false, reason: 'offline' };
  if (words.includes('busy')) return { ok: false, reason: 'busy' };
  if (words.includes('error')) return { ok: false, reason: 'error' };
  if (words.includes('limit') || left() <= 0) return { ok: false, reason: 'limit' };
  const remaining = left() - 1;
  try { sessionStorage.setItem(LEFT_KEY, String(remaining)); } catch { /* private mode */ }
  if (words.includes('nothing')) return { ok: true, results: [], remaining };

  const topic = q.replace(/\b(jee|neet|lecture|one shot)\b/gi, '').replace(/\s+/g, ' ').trim() || 'Physics';
  const rand = seeded(`${q}|${length}`);
  const results: FoundVideo[] = Array.from({ length: 10 }, (_, i) => {
    const shape = SHAPES[Math.floor(rand() * SHAPES.length)];
    const base = length === 'long' ? 1500 + rand() * 12000 : 300 + rand() * 900;
    const hue = Math.floor(rand() * 360);
    return {
      // The first result is YouTube's own API sample video, so a fixture can really be played.
      id: i === 0 ? 'M7lc1UVf-VE' : idFor(rand),
      title: `${topic.replace(/\b\w/g, c => c.toUpperCase())} · ${shape}${i % 3 === 0 ? ' | JEE 2027' : ''}`,
      channel: CHANNELS[Math.floor(rand() * CHANNELS.length)],
      durationS: Math.round(base),
      embeddable: i !== 6,
      madeForKids: false,
      thumb: thumb(hue, shape),
    };
  });
  return { ok: true, results, remaining };
};

export const fixtureRefresh = async (ids: string[]): Promise<RefreshResult> =>
  ({ ok: true, titles: ids.map(id => ({ id, title: id === 'M7lc1UVf-VE' ? 'YouTube Developers Live: Embedded Web Player Customization' : null })) });
