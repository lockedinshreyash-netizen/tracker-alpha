/**
 * The drawing vocabulary the three cards are written in.
 *
 * A canvas has no layout engine, so every position in a card is arithmetic
 * somebody has to do. Doing it once here — measuring, tracking, fitting,
 * aligning — is what keeps `daily.ts` and its siblings readable as
 * compositions rather than as coordinate soup, and it is what makes a spacing
 * change a one-line change.
 *
 * All text is drawn on an alphabetic baseline: a `y` in a card is the baseline,
 * never a box top. Cap-height boxes are what make canvas type drift when a font
 * falls back.
 */

import { Palette } from './palette';
import { Faces } from './fonts';

export type Align = 'left' | 'right' | 'center';

export interface TextOpts {
  align?: Align;
  /** Letter spacing in ems. */
  track?: number;
  /** Any CSS colour; defaults to the palette ink. */
  color?: string;
  weight?: number;
  italic?: boolean;
  /** Draw with the serif face instead of the sans. */
  serif?: boolean;
}

export interface Pen {
  ctx: CanvasRenderingContext2D;
  palette: Palette;
  faces: Faces;
  /** Width of `text` as it would actually be drawn, trailing tracking removed. */
  width(text: string, size: number, opts?: TextOpts): number;
  /** Draws `text` with `y` as the baseline. Returns the width drawn. */
  text(text: string, x: number, y: number, size: number, opts?: TextOpts): number;
  /** The largest size at or below `size` at which `text` fits `maxWidth`. */
  fit(text: string, maxWidth: number, size: number, min: number, opts?: TextOpts): number;
  /** A hairline. Drawn at a real sub-pixel height so it reads as a rule, not a border. */
  rule(x: number, y: number, w: number, color?: string): void;
  rect(x: number, y: number, w: number, h: number, color: string): void;
  circle(x: number, y: number, r: number, color: string): void;
  ring(x: number, y: number, r: number, color: string, lineWidth?: number): void;
}

/**
 * `ctx.letterSpacing` is recent (Chrome 99, Safari 17.4, Firefox 121). Where it
 * is missing the uppercase metadata would collapse into an unreadable block —
 * tracking is load-bearing at 19px — so there is a per-glyph fallback rather
 * than a graceful shrug.
 */
const supportsLetterSpacing = (ctx: CanvasRenderingContext2D): boolean =>
  'letterSpacing' in ctx;

const fontString = (faces: Faces, size: number, opts: TextOpts): string => {
  const weight = opts.weight ?? 500;
  const family = opts.serif ? faces.serif : faces.sans;
  const style = opts.italic ? 'italic ' : '';
  return `${style}${weight} ${size}px ${family}`;
};

export const createPen = (
  ctx: CanvasRenderingContext2D,
  faces: Faces,
  palette: Palette
): Pen => {
  const canTrack = supportsLetterSpacing(ctx);
  ctx.textBaseline = 'alphabetic';

  const apply = (size: number, opts: TextOpts): number => {
    ctx.font = fontString(faces, size, opts);
    const trackPx = (opts.track ?? 0) * size;
    if (canTrack) ctx.letterSpacing = `${trackPx}px`;
    return trackPx;
  };

  const clearTrack = () => {
    if (canTrack) ctx.letterSpacing = '0px';
  };

  const rawWidth = (text: string, trackPx: number): number => {
    if (canTrack) {
      /* Tracking is applied after every glyph including the last, exactly as in
         CSS — so the measured advance carries one trailing gap that is not ink
         and would push every right-aligned line off by it. */
      const w = ctx.measureText(text).width;
      return text.length > 0 ? w - trackPx : 0;
    }
    let w = 0;
    for (const ch of text) w += ctx.measureText(ch).width + trackPx;
    return Math.max(0, w - trackPx);
  };

  const width = (text: string, size: number, opts: TextOpts = {}): number => {
    const trackPx = apply(size, opts);
    const w = rawWidth(text, trackPx);
    clearTrack();
    return w;
  };

  const originFor = (x: number, w: number, align: Align): number =>
    align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;

  const text = (str: string, x: number, y: number, size: number, opts: TextOpts = {}): number => {
    const trackPx = apply(size, opts);
    const w = rawWidth(str, trackPx);
    const start = originFor(x, w, opts.align ?? 'left');
    ctx.fillStyle = opts.color ?? palette.ink;

    if (canTrack) {
      ctx.fillText(str, start, y);
    } else {
      let cx = start;
      for (const ch of str) {
        ctx.fillText(ch, cx, y);
        cx += ctx.measureText(ch).width + trackPx;
      }
    }
    clearTrack();
    return w;
  };

  /**
   * Binary-search the size down until the string fits.
   *
   * This is what makes the hero honest at any magnitude: `04:37:12` and
   * `1247:14:38` are the same composition, one of them simply set smaller. It
   * is also the whole font-fallback strategy — a wider fallback face fits by
   * the same mechanism instead of running off the card.
   */
  const fit = (str: string, maxWidth: number, size: number, min: number, opts: TextOpts = {}): number => {
    if (width(str, size, opts) <= maxWidth) return size;
    let lo = min;
    let hi = size;
    for (let i = 0; i < 24 && hi - lo > 0.5; i++) {
      const mid = (lo + hi) / 2;
      if (width(str, mid, opts) <= maxWidth) lo = mid; else hi = mid;
    }
    return lo;
  };

  const rule = (x: number, y: number, w: number, color?: string) => {
    ctx.fillStyle = color ?? palette.rule;
    ctx.fillRect(x, y, w, 1.5);
  };

  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  const circle = (x: number, y: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const ring = (x: number, y: number, r: number, color: string, lineWidth = 1.5) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(x, y, r - lineWidth / 2, 0, Math.PI * 2);
    ctx.stroke();
  };

  return { ctx, palette, faces, width, text, fit, rule, rect, circle, ring };
};
