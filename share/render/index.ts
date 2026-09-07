/**
 * Card → canvas → PNG.
 *
 * Canvas 2D rather than a DOM screenshot or an SVG round-trip. A screenshot
 * inherits the browser's own rasterisation, its scrollbars and whatever the
 * page happened to be doing; an SVG loaded into an `<img>` cannot load an
 * external font at all, so every line of type would silently fall back. Drawing
 * directly is the only one of the three where the output is exactly the thing
 * that was designed, at whatever resolution is asked for.
 *
 * The canvas that comes back is also the canvas the preview displays. There is
 * no second HTML implementation of a card to keep in sync, so what the user
 * approves is byte-for-byte what they share.
 */

import { CardData, CardFormat } from '../types';
import { formatSpec } from './format';
import { paletteFor } from './palette';
import { loadFaces } from './fonts';
import { createPen } from './primitives';
import { drawDaily } from './daily';
import { drawWeekly } from './weekly';
import { drawMonthly } from './monthly';

/** 1080-wide design, 2160-wide export. Enough for a Story at any device DPR. */
export const EXPORT_SCALE = 2;

export interface RenderResult {
  canvas: HTMLCanvasElement;
  blob: Blob;
  /** False when the real faces did not load and the fallback stack drew. */
  fontsLoaded: boolean;
}

export const renderCard = async (
  data: CardData,
  format: CardFormat,
  scale: number = EXPORT_SCALE
): Promise<RenderResult> => {
  const spec = formatSpec(format);
  const faces = await loadFaces();

  const canvas = document.createElement('canvas');
  canvas.width = spec.w * scale;
  canvas.height = spec.h * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable in this browser.');
  ctx.scale(scale, scale);

  const palette = paletteFor(data.period);
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, spec.w, spec.h);

  const pen = createPen(ctx, faces, palette);
  if (data.period === 'daily') drawDaily(pen, spec, data);
  else if (data.period === 'weekly') drawWeekly(pen, spec, data);
  else drawMonthly(pen, spec, data);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode the card.'))), 'image/png');
  });

  return { canvas, blob, fontsLoaded: faces.sansLoaded && faces.serifLoaded };
};
