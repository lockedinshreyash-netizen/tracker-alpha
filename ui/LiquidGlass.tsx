/* ── Liquid glass ──
   The navigation's material: a slab of glass with a rounded, convex rim. The
   flat middle shows what is behind it, softened. The rim bends it, so content
   sliding under the edge visibly lenses and stretches the way it does through
   a real curved edge, and a thin specular line catches the light top-left and
   bottom-right.

   The bending is real refraction of the live page, not a picture of it:
   `backdrop-filter: url(#filter)` runs an SVG feDisplacementMap over whatever
   is painted behind the element. The map is computed here, once per shape
   (see Nine-slice glass below), from a rounded-rectangle distance field:

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

import React, { useId, useLayoutEffect, useRef, useState } from 'react';

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

/* ── Nine-slice glass ──
   The rim of a rounded rectangle is the same everywhere along a straight
   edge: away from the corners, the field depends only on the distance to that
   one edge. So the maps are never drawn per size. They are drawn once per
   radius and bezel as nine small pieces (four fixed corners, four edges that
   stretch along their length, a flat middle) and assembled at whatever size
   the element is, on every frame, by moving the pieces. A rail animating its
   width keeps exact bending and an exact specular rim throughout, and a pane
   popping in has its real glass on its first frame. There is no redraw, no
   debounce and no pixel loop on the main thread mid-animation, which is what
   made the rail and the countdown pane stall and show a stretched rim.

   An axis shorter than two corners (the 52px capsule, a 48px round button)
   has no straight run to stretch, so it is drawn whole at that length and
   only the other axis slices. Those sizes are fixed in practice. */

const STRETCH = 2;

interface Axis { locked: boolean; len: number; cap: number }
interface Kit {
  key: string;
  cols: Axis; rows: Axis;
  /** Displacement pieces, row-major, 1 / 3 / 9 of them. */
  pieces: string[];
  specular: string;
  /** Specular slices (top/bottom, left/right), in CSS px and image px. */
  sliceY: number; sliceX: number; dpr: number;
  decoded: boolean;
  ready: Promise<void>;
}

const capFor = (radius: number, bezel: number) => Math.ceil(Math.max(radius, bezel * 1.05)) + 1;

const axisFor = (len: number, cap: number): Axis =>
  len >= cap * 2 + STRETCH
    ? { locked: false, len: cap * 2 + STRETCH, cap }
    : { locked: true, len, cap: len };

/* Segments along one axis of the virtual map: [start, size] in its px. */
const segs = (a: Axis): Array<[number, number]> =>
  a.locked ? [[0, a.len]] : [[0, a.cap], [a.cap, STRETCH], [a.cap + STRETCH, a.cap]];

const smooth = (a: number, b: number, v: number) => {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w); c.height = Math.max(1, h);
  return c;
};

const buildKit = (key: string, cols: Axis, rows: Axis, radius: number, bezel: number): Kit => {
  const w = cols.len, h = rows.len;
  const r = Math.min(radius, w / 2, h / 2);

  // Displacement, at CSS-pixel resolution: the field is smooth.
  const dc = canvas(w, h);
  const dctx = dc.getContext('2d', { willReadFrequently: true })!;
  const dimg = dctx.createImageData(w, h);
  const dd = dimg.data;
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

  const pieces: string[] = [];
  for (const [y0, ph] of segs(rows)) {
    for (const [x0, pw] of segs(cols)) {
      const pc = canvas(pw, ph);
      pc.getContext('2d')!.drawImage(dc, x0, y0, pw, ph, 0, 0, pw, ph);
      pieces.push(pc.toDataURL('image/png'));
    }
  }

  // Specular rim, at device resolution: it is a hairline. One image, sliced by border-image.
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const sw = Math.round(w * dpr), sh = Math.round(h * dpr);
  const sc = canvas(sw, sh);
  const sctx = sc.getContext('2d', { willReadFrequently: true })!;
  const simg = sctx.createImageData(sw, sh);
  const sd = simg.data;
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
  const specular = sc.toDataURL('image/png');

  // A locked axis is drawn at its real length, so any slice is exact there: half of it.
  const kit: Kit = {
    key, cols, rows, pieces, specular, dpr,
    sliceY: rows.locked ? h / 2 : rows.cap,
    sliceX: cols.locked ? w / 2 : cols.cap,
    decoded: false, ready: Promise.resolve(),
  };
  /* feImage and border-image load their URLs asynchronously. Until every
     piece has decoded, the glass stays frosted rather than refract through a
     missing map for a frame (an empty map shifts the whole page sideways). */
  kit.ready = Promise.all([...pieces, specular].map(src => {
    const img = new Image();
    img.src = src;
    return img.decode().catch(() => undefined);
  })).then(() => { kit.decoded = true; });
  return kit;
};

/* Kits are small (a corner is ~25px square) and keyed by shape, not size, so
   a whole app's worth fits comfortably. The cap is a backstop for locked axes. */
const kits = new Map<string, Kit>();
const KITS_MAX = 48;
const kitFor = (w: number, h: number, radius: number, bezel: number): Kit => {
  const cap = capFor(radius, bezel);
  const cols = axisFor(w, cap), rows = axisFor(h, cap);
  const key = `${cols.locked ? w : '*'}x${rows.locked ? h : '*'}/${radius}/${bezel}/${window.devicePixelRatio || 1}`;
  const have = kits.get(key);
  if (have) return have;
  const kit = buildKit(key, cols, rows, radius, bezel);
  kits.set(key, kit);
  if (kits.size > KITS_MAX) kits.delete(kits.keys().next().value as string);
  return kit;
};

/** Draw a shape's glass ahead of time, so a pane opening later has its real
 *  glass on the first frame. Cheap (well under a millisecond); call it when
 *  the button that opens the pane mounts. */
export const prewarmGlass = (radius: number, bezel = 16) => {
  if (typeof document === 'undefined') return;
  const go = () => { try { kitFor(400, 400, radius, bezel); } catch { /* canvas refused */ } };
  const w = window as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(go, { timeout: 1000 });
  else window.setTimeout(go, 50);
};

/* Where each piece lands at a given size, in the same order as `pieces`.
   Stretching pieces reach 1px under their neighbours so no seam can open at
   a fractional device pixel; corners are merged last, over them. */
const layout = (a: Axis, len: number): Array<[number, number]> =>
  a.locked ? [[0, len]] : [[0, a.cap], [a.cap - 1, len - a.cap * 2 + 2], [len - a.cap, a.cap]];

interface Props extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'aside' | 'nav' | 'button';
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
  const filterRef = useRef<SVGFilterElement | null>(null);
  const size = useRef({ w: 0, h: 0 });
  const id = `lg${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [kit, setKit] = useState<Kit | null>(null);
  const kitRef = useRef<Kit | null>(null);
  kitRef.current = kit;

  const setRef = (el: HTMLElement | null) => {
    local.current = el;
    if (typeof forwarded === 'function') forwarded(el);
    else if (forwarded) forwarded.current = el;
  };

  /* Moves the pieces to the current size. Written straight to the DOM, not
     through React: it runs from the ResizeObserver, which fires after layout
     and before paint, so a rail animating its width has a matching map in
     the very frame it is drawn at that width. A state update would land a
     frame late, and at full speed the rim would trail the edge by ~20px. */
  const place = () => {
    const f = filterRef.current, k = kitRef.current;
    if (!f || !k) return;
    const { w, h } = size.current;
    f.setAttribute('width', String(w));
    f.setAttribute('height', String(h));
    const xs = layout(k.cols, w), ys = layout(k.rows, h);
    const imgs = f.querySelectorAll('feImage');
    let n = 0;
    for (const [y, ph] of ys) {
      for (const [x, pw] of xs) {
        const img = imgs[n++];
        if (!img) continue;
        img.setAttribute('x', String(x));
        img.setAttribute('y', String(y));
        img.setAttribute('width', String(Math.max(0, pw)));
        img.setAttribute('height', String(Math.max(0, ph)));
      }
    }
  };

  useLayoutEffect(() => {
    const el = local.current;
    if (!el) return;
    let alive = true;
    const measure = () => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      size.current = { w, h };
      if (w < 8 || h < 8) return; // display: none (the phone bar on a laptop)
      let next: Kit;
      try { next = kitFor(w, h, radius, bezel); } catch { return; /* canvas refused: stays frosted */ }
      if (kitRef.current?.key === next.key) { place(); return; }
      if (next.decoded) { kitRef.current = next; setKit(next); return; }
      next.ready.then(() => {
        if (!alive) return;
        const { w: cw, h: ch } = size.current;
        const now = kitFor(cw, ch, radius, bezel);
        if (now === next) { kitRef.current = next; setKit(next); }
      });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return () => { alive = false; };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => { alive = false; ro.disconnect(); };
  }, [radius, bezel]);

  // After React has (re)drawn the filter, before paint.
  useLayoutEffect(place);

  const live = !!kit && kit.decoded;
  const tint = TINT[variant][dark ? 'dark' : 'light'];
  const frosted = variant === 'panel' ? 'blur(22px) saturate(185%)' : 'blur(16px) saturate(180%)';
  /* The frost lives inside the filter (masked to the middle), not as a CSS
     blur after it: that would soften the rim's bending too. */
  const lens = REFRACTS && live
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
      style={live && kit
        ? {
            ...layer,
            // Nine-sliced: corners stay put, edges stretch along their length, so the rim is exact at any size.
            borderStyle: 'solid',
            borderColor: 'transparent',
            borderWidth: `${kit.sliceY}px ${kit.sliceX}px`,
            borderImage: `url(${kit.specular}) ${Math.round(kit.sliceY * kit.dpr)} ${Math.round(kit.sliceX * kit.dpr)} fill / ${kit.sliceY}px ${kit.sliceX}px stretch`,
            borderRadius: 0,
            opacity: dark ? 1 : 0.9,
          }
        : {
            ...layer,
            // Before the first draw (and if canvas fails), a plain hairline.
            boxShadow: `inset 0 0 0 1px rgba(255,255,255,${dark ? 0.14 : 0.5})`,
            opacity: dark ? 1 : 0.9,
          }}
    />,
    REFRACTS && live && kit && (
      <svg aria-hidden="true" width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <filter ref={filterRef} id={id} x="0" y="0" width={size.current.w} height={size.current.h} filterUnits="userSpaceOnUse" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          {kit.pieces.map((src, i) => (
            <feImage key={i} href={src} preserveAspectRatio="none" result={`p${i}`} />
          ))}
          {/* Middle and edges first, corners over them. */}
          <feMerge result="map">
            {order(kit.pieces.length).map(i => <feMergeNode key={i} in={`p${i}`} />)}
          </feMerge>
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

/* Merge order for 1, 3 or 9 pieces: whatever stretches goes under what does not. */
const order = (n: number): number[] =>
  n === 9 ? [4, 1, 3, 5, 7, 0, 2, 6, 8] : n === 3 ? [1, 0, 2] : [0];

export default LiquidGlass;
