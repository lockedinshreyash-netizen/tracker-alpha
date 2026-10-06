/* ── Card images ──
   Images live in the private `decks` bucket under `<deck id>/<file name>`,
   and the card HTML names them the way Anki does: `<img src="benzene.png">`.
   So an Anki deck's media can be dropped in after the CSV and every card
   that mentions a file finds it by name, and an export goes back to Anki
   unchanged.

   Uploaded from the editor, a picture is downscaled to 1600px, re-encoded as
   WebP and named by its own hash — the same picture added twice is one file.
   Media dropped in from Anki keeps its original name, because the cards
   already refer to that name; only its size is reduced.

   Shown through signed URLs, cached for five hours, as cbt/figures.ts does. */

import { useEffect, useState } from 'react';
import { signMedia, uploadMedia } from './api';
import { sha256 } from './hash';
import { isMediaName } from './html';

export const MAX_BYTES = 1024 * 1024;
const MAX_SIDE = 1600;
const TTL_MS = 5 * 60 * 60 * 1000;
const cache = new Map<string, { url: string; at: number }>();
const missing = new Map<string, number>();

const fresh = (path: string): string | undefined => {
  const hit = cache.get(path);
  return hit && Date.now() - hit.at < TTL_MS ? hit.url : undefined;
};

const sign = async (paths: string[]): Promise<void> => {
  const todo = Array.from(new Set(paths)).filter(p => !fresh(p) && Date.now() - (missing.get(p) ?? 0) > 60_000);
  for (let i = 0; i < todo.length; i += 100) {
    const chunk = todo.slice(i, i + 100);
    const signed = await signMedia(chunk);
    const at = Date.now();
    chunk.forEach(p => {
      if (signed[p]) cache.set(p, { url: signed[p], at });
      else missing.set(p, at);
    });
  }
};

/** Name → URL for a deck's media. Names that cannot be signed (not uploaded yet) stay absent. */
export const useMediaUrls = (deckId: string | null, names: string[]): Record<string, string> => {
  const paths = deckId ? names.filter(isMediaName).map(n => `${deckId}/${n}`) : [];
  const key = paths.join('\n');
  const pick = () => Object.fromEntries(paths.flatMap(p => { const u = fresh(p); return u ? [[p.slice(p.indexOf('/') + 1), u]] : []; }));
  const [urls, setUrls] = useState<Record<string, string>>(pick);
  useEffect(() => {
    if (!paths.length) { setUrls({}); return; }
    let live = true;
    setUrls(pick());
    sign(paths).then(() => { if (live) setUrls(pick()); }).catch(() => { /* text stands alone */ });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
};

const loadImage = (file: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not an image we can read.')); };
    img.src = url;
  });

const encode = async (file: Blob, type: string, maxSide: number, quality: number): Promise<Blob> => {
  const img = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d')!;
  if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not process that image.'))), type, quality));
};

/** Shrink until it fits, keeping the format a name already promises. */
const fit = async (file: Blob, type: string): Promise<Blob> => {
  let out = await encode(file, type, MAX_SIDE, 0.86);
  for (const [side, q] of [[1200, 0.8], [900, 0.72], [700, 0.65]] as const) {
    if (out.size <= MAX_BYTES) break;
    out = await encode(file, type, side, q);
  }
  if (out.size > MAX_BYTES) throw new Error('That image is too large even after shrinking it.');
  return out;
};

const hex = async (blob: Blob): Promise<string> => {
  const buf = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
};

/** From the editor: shrink, WebP, hash-named. Returns the name to put in `<img src>`. GIFs keep their animation. */
export const uploadEditorImage = async (deckId: string, file: File): Promise<string> => {
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw new Error('Use a PNG, JPG, WebP or GIF.');
  if (file.type === 'image/gif') {
    if (file.size > MAX_BYTES) throw new Error('GIFs must be under 1 MB.');
    const name = `${(await hex(file)).slice(0, 32)}.gif`;
    await uploadMedia(`${deckId}/${name}`, file);
    cache.delete(`${deckId}/${name}`);
    return name;
  }
  const blob = await fit(file, 'image/webp');
  const name = `${(await hex(blob)).slice(0, 32)}.webp`;
  await uploadMedia(`${deckId}/${name}`, blob);
  missing.delete(`${deckId}/${name}`);
  return name;
};

/** Anki media, dropped in after an import: keeps its name, so the cards find it. */
export const uploadNamedMedia = async (deckId: string, file: File): Promise<void> => {
  if (!isMediaName(file.name)) throw new Error(`${file.name} isn't an image file name we can use.`);
  const ext = file.name.split('.').pop()!.toLowerCase();
  const type = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  if (ext === 'svg') throw new Error(`${file.name}: SVG images aren't supported.`);
  const blob = file.size <= MAX_BYTES || type === 'image/gif' ? file : await fit(file, type);
  if (blob.size > MAX_BYTES) throw new Error(`${file.name} is over 1 MB.`);
  await uploadMedia(`${deckId}/${file.name}`, blob.type ? blob : new Blob([blob], { type }));
  missing.delete(`${deckId}/${file.name}`);
  cache.delete(`${deckId}/${file.name}`);
};

