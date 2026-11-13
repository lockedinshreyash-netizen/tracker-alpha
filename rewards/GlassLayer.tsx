import React, { useEffect, useRef, useState } from 'react';
import { TUNE, paintGlass, paintSubject, ribShade, ribWidth } from './glass';

/**
 * The Glass wallpaper's canvas (see `glass.ts` for what is drawn and why).
 *
 * Still: it draws once, and again only when the layer settles at a new size or
 * the theme flips. Nothing runs between those, so it costs nothing while the
 * student studies, and nothing needs pausing for scrolling or a hidden tab.
 * The draw lights the metal and then looks at it through the glass, both
 * per pixel, so the canvas is held to about 2.4 million pixels (a 1440 × 900
 * laptop draws at ~1.35×, a phone at 2×): about 150 ms on a laptop, once, in
 * idle time. The metal is drawn at the same resolution, so nothing behind the
 * glass is blurred.
 */

const MAX_PIXELS = 2_400_000;
/** A window being dragged wider fires constantly; draw once it stops. */
const SETTLE_MS = 160;

const GlassLayer: React.FC<{ dark: boolean; preview?: boolean }> = ({ dark, preview = false }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [rib, setRib] = useState(() => ribWidth(preview ? 120 : typeof window === 'undefined' ? 1200 : window.innerWidth, preview));

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (!el || !cv || !ctx) return;
    const src = document.createElement('canvas');
    const sctx = src.getContext('2d', { willReadFrequently: true });
    if (!sctx) return;
    let drawn = '';
    let timer = 0;

    const draw = () => {
      const r = el.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width));
      const h = Math.max(1, Math.round(r.height));
      // A resize that lands on the same pixels (scrollbars, rounding) redraws nothing.
      if (`${w}x${h}` === drawn) return;
      drawn = `${w}x${h}`;
      const q = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(MAX_PIXELS / (w * h)));
      const ribPx = ribWidth(w, preview);
      const pad = Math.ceil(ribPx * (TUNE.reach * 1.2 + 1));
      setRib(ribPx);
      cv.width = Math.max(1, Math.round(w * q));
      cv.height = Math.max(1, Math.round(h * q));
      // The subject at the canvas's own resolution: sharp, never blurred.
      const scale = cv.width / w;
      src.width = Math.max(2, Math.round((w + pad * 2) * scale));
      src.height = Math.max(2, Math.round(h * scale));
      sctx.setTransform(src.width / (w + pad * 2), 0, 0, src.height / h, pad * (src.width / (w + pad * 2)), 0);
      paintSubject(sctx, w, h, pad, dark);
      paintGlass(ctx, sctx, w, h, cv.width / w, scale, pad, ribPx, dark);
    };

    // The first draw waits for a quiet moment, so it never holds up the app's
    // first paint; the wallpaper's CSS stand-in shows until then.
    // Safari has no requestIdleCallback; a short timeout does the same job there.
    const hasIdle = typeof window.requestIdleCallback === 'function';
    const idle = hasIdle ? window.requestIdleCallback(() => draw(), { timeout: 600 }) : window.setTimeout(draw, 50);
    const ro = new ResizeObserver(() => {
      if (!drawn) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(draw, SETTLE_MS);
    });
    ro.observe(el);
    return () => {
      if (hasIdle) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      window.clearTimeout(timer);
      ro.disconnect();
    };
  }, [dark, preview]);

  return (
    <div ref={wrap} className="absolute inset-0">
      <canvas ref={canvas} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0" style={{ background: ribShade(rib, dark) }} />
    </div>
  );
};

export default GlassLayer;
