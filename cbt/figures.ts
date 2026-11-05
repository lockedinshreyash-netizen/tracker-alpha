/* ── Figure URLs ──
   Figures live in a private bucket and are shown through signed URLs. One
   module-level cache so a figure signed for the exam is not signed again for
   the review or the error test; URLs last six hours, and are re-signed after
   five. */

import { useEffect, useState } from 'react';
import { signFigures } from './api';

const TTL_MS = 5 * 60 * 60 * 1000;
const cache = new Map<string, { url: string; at: number }>();

const fresh = (path: string): string | undefined => {
  const hit = cache.get(path);
  return hit && Date.now() - hit.at < TTL_MS ? hit.url : undefined;
};

export const signAll = async (paths: string[]): Promise<void> => {
  const missing = Array.from(new Set(paths)).filter(p => !fresh(p));
  for (let i = 0; i < missing.length; i += 100) {
    const signed = await signFigures(missing.slice(i, i + 100));
    const at = Date.now();
    Object.entries(signed).forEach(([path, url]) => cache.set(path, { url, at }));
  }
};

/** Path → URL for whatever is signed so far. A figure that cannot be signed (offline, no access) is simply absent. */
export const useFigureUrls = (paths: string[]): Record<string, string> => {
  const key = paths.join('\n');
  const [urls, setUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(paths.flatMap(p => { const u = fresh(p); return u ? [[p, u]] : []; })),
  );
  useEffect(() => {
    if (!paths.length) return;
    let live = true;
    signAll(paths).then(() => {
      if (!live) return;
      setUrls(Object.fromEntries(paths.flatMap(p => { const u = fresh(p); return u ? [[p, u]] : []; })));
    }).catch(() => { /* figures are a nicety; the text stands alone */ });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
};

/* ── Preloading a whole paper ──
   The exam asks for this the moment it opens, so every figure is signed and
   in the browser's cache before the clock starts: no question shows a blank
   frame on a slow connection, and a dropped connection mid-paper costs
   nothing already fetched. The <img> tags later ask for the same signed URL
   (one cache, above), so they are served from the HTTP cache. Six at a
   time, so a 300-figure paper does not open 300 connections. */

const isRemote = (p: string) => !p.startsWith('data:') && !p.startsWith('http');

export const usePreload = (paths: string[]): { done: number; total: number } => {
  const key = paths.join('\n');
  const [done, setDone] = useState(0);
  useEffect(() => {
    let live = true;
    const remote = Array.from(new Set(paths.filter(isRemote)));
    const local = paths.length - paths.filter(isRemote).length;
    setDone(local);
    if (!remote.length) return;
    (async () => {
      try { await signAll(remote); } catch { /* unsigned figures load when shown, as before */ }
      const queue = [...remote];
      const one = async (): Promise<void> => {
        const p = queue.shift();
        if (!p || !live) return;
        const url = fresh(p);
        if (url) {
          await new Promise<void>(res => {
            const img = new Image();
            img.onload = img.onerror = () => res();
            img.src = url;
          });
        }
        if (live) setDone(d => d + 1);
        return one();
      };
      await Promise.all(Array.from({ length: 6 }, one));
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { done: Math.min(done, paths.length), total: paths.length };
};
