/* ── The whiteboard on a canvas ──
   Drawing only; the model is books/board.ts. The board takes the reading
   room's page colour (a white sheet in Original, warm paper in Sepia, dark
   grey in Night, pure black in OLED), and 'ink' is that sheet's own ink.

   The pens:
   - pen     an even line, smoothed through the midpoints of its samples
   - pencil  thinner and a little faint, like graphite
   - marker  wide and see-through, multiplied into a light sheet (screened
             into a dark one) so ink under it stays readable; one path, so a
             stroke never darkens where it crosses itself
   - brush   a nib: wider under pressure (a stylus) or when slow (a mouse or
             finger), drawn segment by segment */

import { arrowHead, boxOf, isPen, overlaps, shapeOutline, viewBox, type Background, type Box, type Stroke, type View } from './board';

export type SheetColor = 'paper' | 'sepia' | 'night' | 'oled';

export interface Sheet {
  bg: string; ink: string; mark: string; dark: boolean;
  /** How a picture from the page is shown on this sheet: the same treatment the reader gives the page itself. */
  imageFilter: string;
}

export const SHEETS: Record<SheetColor, Sheet> = {
  paper: { bg: '#ffffff', ink: '#18181b', mark: 'rgba(24, 24, 27, 0.16)', dark: false, imageFilter: 'none' },
  sepia: { bg: '#fbf5e6', ink: '#2e2416', mark: 'rgba(80, 60, 30, 0.2)', dark: false, imageFilter: 'sepia(0.35) saturate(0.85) brightness(0.97)' },
  night: { bg: '#1c1c1f', ink: '#f4f4f5', mark: 'rgba(255, 255, 255, 0.13)', dark: true, imageFilter: 'invert(0.9) hue-rotate(180deg) brightness(0.95) contrast(0.92)' },
  oled: { bg: '#000000', ink: '#fafafa', mark: 'rgba(255, 255, 255, 0.16)', dark: true, imageFilter: 'invert(1) hue-rotate(180deg) contrast(1.25)' },
};

export const inkOf = (color: string, sheet: Sheet): string => (color === 'ink' ? sheet.ink : color);

/* ── The sheet's ruling, in screen space so it stays crisp at any zoom ── */

export const drawBackground = (ctx: CanvasRenderingContext2D, v: View, w: number, h: number, bg: Background, sheet: Sheet, dpr: number) => {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = sheet.bg;
  ctx.fillRect(0, 0, w, h);
  if (bg === 'blank') return;
  // A 24-unit ruling, coarsened by fives when it would get closer than 12px on screen.
  let step = 24;
  while (step * v.z < 12) step *= 5;
  const s = step * v.z;
  const ox = -((v.x * v.z) % s + s) % s;
  const oy = -((v.y * v.z) % s + s) % s;
  ctx.fillStyle = sheet.mark;
  if (bg === 'dots') {
    const r = Math.max(1, Math.min(1.6, s / 18));
    for (let x = ox; x <= w + s; x += s) for (let y = oy; y <= h + s; y += s) ctx.fillRect(Math.round(x) - r / 2, Math.round(y) - r / 2, r, r);
    return;
  }
  for (let y = oy; y <= h + s; y += s) ctx.fillRect(0, Math.round(y), w, 1);
  if (bg === 'grid') for (let x = ox; x <= w + s; x += s) ctx.fillRect(Math.round(x), 0, 1, h);
};

/* ── Strokes, in world space ── */

const smoothPath = (ctx: CanvasRenderingContext2D, pts: number[]) => {
  const n = pts.length / 3;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  if (n === 2) { ctx.lineTo(pts[3], pts[4]); return; }
  for (let i = 1; i < n - 1; i++) {
    const x = pts[i * 3], y = pts[i * 3 + 1];
    ctx.quadraticCurveTo(x, y, (x + pts[i * 3 + 3]) / 2, (y + pts[i * 3 + 4]) / 2);
  }
  ctx.lineTo(pts[(n - 1) * 3], pts[(n - 1) * 3 + 1]);
};

const dot = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
};

/** Pictures by id, decoded once (books/Whiteboard.tsx keeps them). */
export type ImageCache = Map<string, CanvasImageSource & { width: number; height: number }>;

/** A picture from the page, filtered for the sheet like the page itself; a dashed box until it has loaded. */
export const drawImage = (ctx: CanvasRenderingContext2D, s: Stroke, sheet: Sheet, images?: ImageCache) => {
  const [x0, y0, x1, y1] = s.pts;
  const bmp = s.img ? images?.get(s.img) : undefined;
  ctx.save();
  if (bmp) {
    if (s.fade) ctx.globalAlpha = 0.4;
    if (sheet.imageFilter !== 'none') ctx.filter = sheet.imageFilter;
    ctx.drawImage(bmp, x0, y0, x1 - x0, y1 - y0);
  } else {
    ctx.strokeStyle = sheet.mark;
    ctx.lineWidth = 1.5 / Math.max(0.1, ctx.getTransform().a);
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  }
  ctx.restore();
};

export const drawStroke = (ctx: CanvasRenderingContext2D, s: Stroke, sheet: Sheet, images?: ImageCache) => {
  if (s.kind === 'image') { drawImage(ctx, s, sheet, images); return; }
  const color = inkOf(s.color, sheet);
  const n = s.pts.length / 3;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = s.w;

  if (s.kind === 'marker') {
    ctx.globalAlpha = sheet.dark ? 0.42 : 0.38;
    ctx.globalCompositeOperation = sheet.dark ? 'screen' : 'multiply';
  } else if (s.kind === 'pencil') {
    ctx.globalAlpha = 0.82;
  }

  if (isPen(s.kind)) {
    if (n === 1) {
      dot(ctx, s.pts[0], s.pts[1], (s.kind === 'brush' ? s.w * (0.35 + 0.65 * s.pts[2]) : s.w) / 2, color);
    } else if (s.kind === 'brush') {
      // Each piece of the curve gets the width of the sample it bends around.
      const mid = (i: number): [number, number] => [(s.pts[i * 3] + s.pts[i * 3 + 3]) / 2, (s.pts[i * 3 + 1] + s.pts[i * 3 + 4]) / 2];
      let [px, py] = [s.pts[0], s.pts[1]];
      for (let i = 1; i < n; i++) {
        const last = i === n - 1;
        const [ex, ey] = last ? [s.pts[i * 3], s.pts[i * 3 + 1]] : mid(i);
        ctx.beginPath();
        ctx.lineWidth = s.w * (0.35 + 0.65 * s.pts[i * 3 + 2]);
        ctx.moveTo(px, py);
        if (last) ctx.lineTo(ex, ey); else ctx.quadraticCurveTo(s.pts[i * 3], s.pts[i * 3 + 1], ex, ey);
        ctx.stroke();
        px = ex; py = ey;
      }
    } else {
      smoothPath(ctx, s.pts);
      ctx.stroke();
    }
  } else {
    const line = shapeOutline(s.kind, s.pts);
    ctx.beginPath();
    ctx.moveTo(line[0], line[1]);
    for (let i = 2; i + 1 < line.length; i += 2) ctx.lineTo(line[i], line[i + 1]);
    if (s.kind === 'rect' || s.kind === 'ellipse') ctx.closePath();
    ctx.stroke();
    if (s.kind === 'arrow') {
      const h = arrowHead(s.pts[0], s.pts[1], s.pts[2], s.pts[3], s.w);
      ctx.beginPath();
      ctx.moveTo(h[0], h[1]);
      ctx.lineTo(h[2], h[3]);
      ctx.lineTo(h[4], h[5]);
      ctx.stroke();
    }
  }
  ctx.restore();
};

/** Every visible stroke, skipping those being erased. */
/** Every visible stroke, skipping those being erased. Pictures first: ink is always drawn over a diagram. */
export const drawStrokes = (
  ctx: CanvasRenderingContext2D, strokes: Stroke[], v: View, w: number, h: number, sheet: Sheet, dpr: number,
  hidden?: Set<string>, images?: ImageCache, moved?: Map<string, number[]>,
) => {
  const vb = viewBox(v, w, h);
  ctx.setTransform(dpr * v.z, 0, 0, dpr * v.z, -v.x * v.z * dpr, -v.y * v.z * dpr);
  for (const pass of [true, false]) {
    for (const raw of strokes) {
      if ((raw.kind === 'image') !== pass || hidden?.has(raw.id)) continue;
      const s = moved?.has(raw.id) ? { ...raw, pts: moved.get(raw.id)! } : raw;
      if (!overlaps(s === raw ? boxOf(s) : { x0: Math.min(s.pts[0], s.pts[2]), y0: Math.min(s.pts[1], s.pts[3]), x1: Math.max(s.pts[0], s.pts[2]), y1: Math.max(s.pts[1], s.pts[3]) }, vb)) continue;
      drawStroke(ctx, s, sheet, images);
    }
  }
};

/**
 * A part of the board as a picture, for a flashcard or a notes page: always
 * dark ink on white (the Original sheet) and no ruling, whatever the room's
 * colour, because it will be read on a card or a page that has its own.
 * The longer side is at most `maxSide` px, and at most 4× the board's units.
 */
export const exportRegion = (strokes: Stroke[], b: Box, maxSide = 1600, images?: ImageCache): Promise<Blob | null> => {
  const ww = Math.max(1, b.x1 - b.x0), wh = Math.max(1, b.y1 - b.y0);
  const k = Math.min(maxSide / Math.max(ww, wh), 4);
  const cw = Math.max(1, Math.round(ww * k)), ch = Math.max(1, Math.round(wh * k));
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = SHEETS.paper.bg;
  ctx.fillRect(0, 0, cw, ch);
  drawStrokes(ctx, strokes, { x: b.x0, y: b.y0, z: k }, cw, ch, SHEETS.paper, 1, undefined, images);
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png'));
};
