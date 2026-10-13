/* ── Liquid glass ──
   The navigation's material: a slab of glass with a rounded, convex rim. The
   flat middle shows what is behind it, softened. The rim bends it, so content
   sliding under the edge visibly lenses and stretches the way it does through
   a real curved edge, and a thin specular line catches the light top-left and
   bottom-right.

   The bending is real refraction of the live page, not a picture of it:
   `backdrop-filter: url(#filter)` runs an SVG feDisplacementMap over whatever
   is painted behind the element. The map is computed here, per element size,
   from a rounded-rectangle distance field:

     - inside the rim (the outer `bezel` px), the glass surface is a convex
       squircle profile, h(t) = (1 − (1 − t)⁴)^¼;
     - a vertical ray through a surface of slope h′ refracts by Snell's law
       (n = 1.5), and the sideways shift of where it lands is tan(θ − θᵣ);
     - that shift, pointing inward along the normal, is written into R/G
       (128 = none), so the rim shows content from further in, magnified;
     - B carries a mask, 0 at the rim rising to 1 where the glass goes flat.
       The filter blurs the refracted image and lays it back over the middle
       only, so the bending at the edge stays crisp while the body is frosted
       enough for a label to read over a busy page.

   Only Chromium applies SVG filters in backdrop-filter (Chrome, Edge, Samsung
   Internet, and the Play app, which is Chrome). Safari and Firefox accept the
   syntax and then draw nothing at all, so they are told apart up front and get
   frosted glass with the same rim, tint and shadow instead. There is no
   feature test for "renders it", which is why this sniffs brands.

   Geometry must be inline or in index.css, never Tailwind: the CDN build does
   not see class names built in template literals. */

import React, { useEffect, useId, useRef, useState } from 'react';

export type GlassVariant = 'bar' | 'panel';

/* Brands, not the UA string: userAgentData exists only in Chromium, and it
   names the engine honestly ("Chromium") in every browser built on it. */
const REFRACTS: boolean = (() => {
  if (typeof navigator === 'undefined') return false;
  const brands = (navigator as unknown as { userAgentData?: { brands?: Array<{ brand: string }> } }).userAgentData?.brands;
  return !!brands?.some(b => /chromium/i.test(b.brand));
})();

const N = 1.5;
const LIGHT = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 };

/* Sideways shift across the rim, t = 0 at the edge to 1 where the glass goes
   flat, normalised so the strongest is 1. Computed once. */
const PROFILE: Float32Array = (() => {
  const S = 256;
  const h = (t: number) => Math.pow(1 - Math.pow(1 - t, 4), 0.25);
  const out = new Float32Array(S);
  let max = 0;
  for (let i = 0; i < S; i++) {
    const t = i / (S - 1);
    const dt = 1e-3;
    const slope = (h(Math.min(1, t + dt)) - h(Math.max(0, t - dt))) / (Math.min(1, t + dt) - Math.max(0, t - dt));
    const theta = Math.min(Math.atan(slope), 1.48);
    const refracted = Math.asin(Math.sin(theta) / N);
    out[i] = Math.tan(theta - refracted);
    max = Math.max(max, out[i]);
  }
  for (let i = 0; i < S; i++) out[i] /= max || 1;
  return out;
})();

/* Signed distance to a w×h rounded rectangle of radius r (negative inside),
   with the outward normal. Coordinates are from the top-left, in px. */
const sdf = (x: number, y: number, w: number, h: number, r: number) => {
  const px = x - w / 2, py = y - h / 2;
  const qx = Math.abs(px) - (w / 2 - r), qy = Math.abs(py) - (h / 2 - r);
  const sx = px < 0 ? -1 : 1, sy = py < 0 ? -1 : 1;
  if (qx > 0 && qy > 0) {
    const l = Math.hypot(qx, qy);
    return { d: l - r, nx: (qx / l) * sx, ny: (qy / l) * sy };
  }
  return qx > qy ? { d: qx - r, nx: sx, ny: 0 } : { d: qy - r, nx: 0, ny: sy };
};

interface Maps { displacement: string; specular: string; w: number; h: number; r: number }
interface Size { w: number; h: number }

const draw = (w: number, h: number, radius: number, bezel: number): Maps => {
  const r = Math.min(radius, w / 2, h / 2);

  // Displacement, at CSS-pixel resolution: the field is smooth.
  const dc = document.createElement('canvas');
  dc.width = w; dc.height = h;
  const dctx = dc.getContext('2d')!;
  const dimg = dctx.createImageData(w, h);
  const dd = dimg.data;

  // Specular rim, at device resolution: it is a hairline.
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const sw = Math.round(w * dpr), sh = Math.round(h * dpr);
  const sc = document.createElement('canvas');
  sc.width = sw; sc.height = sh;
  const sctx = sc.getContext('2d')!;
  const simg = sctx.createImageData(sw, sh);
  const sd = simg.data;

  const smooth = (a: number, b: number, v: number) => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const { d, nx, ny } = sdf(x + 0.5, y + 0.5, w, h, r);
      const e = -d;
      let vx = 0, vy = 0;
      if (e > 0 && e < bezel) {
        const m = PROFILE[Math.min(255, Math.round((e / bezel) * 255))];
        vx = -nx * m; vy = -ny * m; // inward
      }
      dd[i] = 128 + Math.round(vx * 127);
      dd[i + 1] = 128 + Math.round(vy * 127);
      dd[i + 2] = e <= 0 ? 0 : Math.round(smooth(bezel * 0.3, bezel * 1.05, e) * 255); // frost mask
      dd[i + 3] = 255;
    }
  }
  dctx.putImageData(dimg, 0, 0);

  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const { d, nx, ny } = sdf((x + 0.5) / dpr, (y + 0.5) / dpr, w, h, r);
      const e = -d;
      if (e < 0) continue;
      // Light from the top-left, and its exit glint bottom-right.
      const facing = Math.pow(Math.abs(nx * LIGHT.x + ny * LIGHT.y), 3);
      const line = 1 - smooth(0.25, 1.35, e);
      const glow = (1 - smooth(0, bezel * 0.9, e)) * 0.09;
      const a = Math.min(1, line * (0.16 + 0.84 * facing) * 0.9 + glow * (0.35 + 0.65 * facing));
      if (a <= 0.002) continue;
      const i = (y * sw + x) * 4;
      sd[i] = sd[i + 1] = sd[i + 2] = 255;
      sd[i + 3] = Math.round(a * 255);
    }
  }
  sctx.putImageData(simg, 0, 0);

  return { displacement: dc.toDataURL('image/png'), specular: sc.toDataURL('image/png'), w, h, r: radius };
};

interface Props extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'aside' | 'nav';
  dark: boolean;
  /** Corner radius in px. The rim is shaped around it. */
  radius: number;
  /** `bar` is a thin floating control strip; `panel` holds a list and is tinted more for reading. */
  variant?: GlassVariant;
  /** Width of the curved rim, px. */
  bezel?: number;
  /** Largest sideways shift at the rim, px. */
  strength?: number;
}

/* Light enough that the bending is the thing you see; heavy enough that a
   label stays readable over a busy page. The panel holds a list of text and
   sits over a dimmed page, so it is tinted more. */
const TINT = {
  bar: { dark: 'rgba(22, 22, 26, 0.30)', light: 'rgba(255, 255, 255, 0.24)' },
  panel: { dark: 'rgba(18, 18, 22, 0.46)', light: 'rgba(255, 255, 255, 0.50)' },
};

const LiquidGlass = React.forwardRef<HTMLElement, Props>(function LiquidGlass(
  { as = 'div', dark, radius, variant = 'bar', bezel = 16, strength = 18, className = '', style, children, ...rest },
  forwarded,
) {
  const local = useRef<HTMLElement | null>(null);
  const id = `lg${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [maps, setMaps] = useState<Maps | null>(null);
  const [size, setSize] = useState<Size | null>(null);

  const setRef = (el: HTMLElement | null) => {
    local.current = el;
    if (typeof forwarded === 'function') forwarded(el);
    else if (forwarded) forwarded.current = el;
  };

  /* The maps are redrawn once the element settles at a new size, not on every
     frame of a resize (the rail's collapse animates its width). In between,
     a map that no longer matches would read as a hard shift at its old edge,
     so the glass goes frosted until the new one is ready. offsetWidth is the
     layout size, so the drawer sliding in (a transform) never redraws. */
  useEffect(() => {
    const el = local.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let timer = 0;
    const read = (): Size => ({ w: Math.round(el.offsetWidth), h: Math.round(el.offsetHeight) });
    const settle = () => {
      const s = read();
      if (s.w < 8 || s.h < 8) return; // display: none (the phone bar on a laptop)
      setMaps(prev => {
        if (prev && prev.w === s.w && prev.h === s.h && prev.r === radius) return prev;
        try { return draw(s.w, s.h, radius, bezel); } catch { return null; }
      });
    };
    const ro = new ResizeObserver(() => {
      const s = read();
      setSize(prev => (prev && prev.w === s.w && prev.h === s.h ? prev : s));
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 140);
    });
    ro.observe(el);
    setSize(read());
    settle();
    return () => { ro.disconnect(); window.clearTimeout(timer); };
  }, [radius, bezel]);

  const fresh = !!maps && !!size && maps.w === size.w && maps.h === size.h;
  const tint = TINT[variant][dark ? 'dark' : 'light'];
  const frosted = variant === 'panel' ? 'blur(22px) saturate(185%)' : 'blur(16px) saturate(180%)';
  /* The frost lives inside the filter (masked to the middle), not as a CSS
     blur after it: that would soften the rim's bending too. */
  const lens = REFRACTS && fresh
    ? `url(#${id}) saturate(170%) brightness(${dark ? 1.03 : 1.04})`
    : frosted;
  const frost = variant === 'panel' ? 5 : 3.2;

  const shadow = dark
    ? '0 12px 32px -10px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.3)'
    : '0 12px 32px -12px rgba(24, 24, 32, 0.24), 0 2px 6px rgba(24, 24, 32, 0.07), 0 0 0 0.5px rgba(24, 24, 32, 0.08)';

  const layer: React.CSSProperties = { position: 'absolute', inset: 0, borderRadius: radius, pointerEvents: 'none', zIndex: -1 };

  return React.createElement(
    as,
    {
      ...rest,
      ref: setRef,
      className: `lg ${className}`,
      // --lg-solid: the opaque fill for "reduce transparency" (index.css).
      style: { ...style, borderRadius: radius, isolation: 'isolate', boxShadow: shadow, ['--lg-solid' as string]: dark ? '#141418' : '#ffffff' } as React.CSSProperties,
    },
    <span aria-hidden="true" style={{ ...layer, backdropFilter: lens, WebkitBackdropFilter: frosted }} className="lg-lens" />,
    <span
      aria-hidden="true"
      style={{
        ...layer,
        background: dark
          ? `linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0) 45%), ${tint}`
          : `linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 50%), ${tint}`,
      }}
      className="lg-tint"
    />,
    <span
      aria-hidden="true"
      style={{
        ...layer,
        backgroundImage: maps ? `url(${maps.specular})` : undefined,
        backgroundSize: '100% 100%',
        opacity: dark ? 1 : 0.9,
        // Before the first draw (and if canvas fails), a plain hairline.
        boxShadow: maps ? undefined : `inset 0 0 0 1px rgba(255,255,255,${dark ? 0.14 : 0.5})`,
      }}
    />,
    REFRACTS && fresh && maps && (
      <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <filter id={id} x="0" y="0" width={maps.w} height={maps.h} filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feImage href={maps.displacement} x="0" y="0" width={maps.w} height={maps.h} preserveAspectRatio="none" result="map" />
          <feDisplacementMap in="SourceGraphic" in2="map" scale={strength * 2} xChannelSelector="R" yChannelSelector="G" result="refracted" />
          <feGaussianBlur in="refracted" stdDeviation={frost} edgeMode="duplicate" result="frosted" />
          {/* B → alpha: the frost mask. */}
          <feColorMatrix in="map" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0" result="mask" />
          <feComposite in="frosted" in2="mask" operator="in" result="body" />
          <feMerge>
            <feMergeNode in="refracted" />
            <feMergeNode in="body" />
          </feMerge>
        </filter>
      </svg>
    ),
    children,
  );
});

export default LiquidGlass;
