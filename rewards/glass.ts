/**
 * The Glass wallpaper: liquid metal seen through fluted glass. Still.
 *
 * Drawn once (and again only when the size or the theme changes), so it can
 * afford to be computed properly, pixel by pixel:
 *
 * 1. **The subject**: folds of liquid chrome, blue and violet with peach
 *    rims and white glints, on pure black (or, in light mode, the same folds
 *    in paler metal on paper). **Sharp, never blurred**: drawn at the
 *    canvas's own resolution. The glass is only as crisp as what is behind
 *    it; a blurred subject gave the ribs nothing to bend.
 * 2. **The glass**: the screen is a row of vertical ribs, and every rib is a
 *    lens. Each column of pixels reads the subject at `bend(v)` rib widths
 *    from its rib's centre: a view that sweeps across the picture, then folds
 *    back on itself, mirrored, towards the rib's curved edges. That fold turns
 *    every slanted edge behind the glass into an arch or a flame, rib by rib,
 *    as real reeded glass does. Red, green and blue bend by slightly different
 *    amounts (dispersion), so colour fringes where the glass curves most. The light on the glass is
 *    from the same curve: a soft highlight where the face turns towards the
 *    top-left, a bright rim at the left edge, and the right edge falling into
 *    shade.
 *
 * The 1px groove between ribs, the grain and the corner vignette are CSS
 * (`ribShade`), so they stay crisp at the screen's own resolution whatever
 * the canvas is drawn at, and the vignette sits on the glass, not behind it.
 *
 * Pure drawing, no React. `GlassLayer.tsx` owns the canvas.
 */

/* ── The subject: liquid metal ──
   Polished metal is not drawn, it is lit: what you see on chrome is the room
   around it, reflected in a curved surface. So the metal here is a smooth
   flowing surface (a height field: folds running up from the lower left, a
   trough pressed into the middle), and every pixel shows what the studio
   looks like reflected off the surface at that point. The studio is black,
   with a blue softbox overhead, a violet fill from the left, a peach light
   from the right and one thin white strip. Where the metal lies flat it
   reflects the black room, which is why the ground stays pure black; where a
   fold turns, it picks up the lights as broad, smooth bands with sharp
   edges, the look of the reference. Drawn once, at the canvas's own
   resolution: the surface is sampled on a coarse grid (it is smooth, so its
   tilt can be interpolated) and the reflection is worked out for every pixel,
   so the edges of the reflections stay crisp. */

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Height of the metal at (u, v), both in diagonals, so a phone gets the same folds. */
const height = (u: number, v: number): number => {
  // Along the folds (rising to the right) and across them.
  const along = u * 0.88 - v * 0.47;
  const across = u * 0.47 + v * 0.88;
  const bent = across + 0.11 * Math.sin(3.2 * along + 0.7) + 0.045 * Math.sin(7.6 * along + 2.1);
  let z = 0.5 * Math.sin(7.4 * bent + 0.4) + 0.24 * Math.sin(13.6 * bent + 1.4 * Math.sin(2.6 * along) + 1);
  // The trough pressed into the middle fold.
  z -= 0.9 * Math.exp(-((along - 0.42) ** 2) / 0.018 - ((bent - 0.78) ** 2) / 0.05);
  // Flat (so black) towards the top-left and the bottom-right.
  return z * smooth(0.12, 0.42, across) * (1 - smooth(1.15, 1.5, across));
};

/**
 * The studio, as seen in direction (rx, ry): the reflection a pixel shows.
 * Every light falls off smoothly from its centre, because a reflection of a
 * light with a flat face is a flat patch, and flat patches read as paint.
 */
type Ramp = [number, [number, number, number]][];

const ramp = (stops: Ramp, t: number, out: Float32Array, gain = 1) => {
  t = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
  const [t0, a] = stops[i];
  const [t1, b] = stops[i + 1];
  const f = (t - t0) / (t1 - t0 || 1);
  out[0] += (a[0] + (b[0] - a[0]) * f) * gain;
  out[1] += (a[1] + (b[1] - a[1]) * f) * gain;
  out[2] += (a[2] + (b[2] - a[2]) * f) * gain;
};

/* The softbox overhead runs black → deep blue → electric blue → ice at its
   heart; the fill from the left is violet, the light from the right peach. */
const SOFTBOX: Ramp = [[0, [0, 0, 0]], [0.35, [10, 18, 92]], [0.65, [36, 62, 226]], [0.88, [98, 140, 255]], [1, [214, 228, 255]]];
const VIOLET: Ramp = [[0, [0, 0, 0]], [0.6, [52, 30, 140]], [1, [124, 86, 238]]];
const PEACH: Ramp = [[0, [0, 0, 0]], [0.55, [120, 64, 84]], [0.85, [236, 150, 156]], [1, [255, 214, 196]]];

const SOFTBOX_L: Ramp = [[0, [0, 0, 0]], [0.4, [-40, -34, -6]], [0.7, [-120, -100, -10]], [1, [-60, -40, 0]]];
const VIOLET_L: Ramp = [[0, [0, 0, 0]], [1, [-70, -80, -10]]];
const PEACH_L: Ramp = [[0, [0, 0, 0]], [1, [12, -40, -50]]];

const studio = (rx: number, ry: number, dark: boolean, out: Float32Array) => {
  const lift = (x: number, a: number, b: number) => (x - a) / (b - a);
  const above = lift(-ry, 0.15, 1.05) * (1 - 0.35 * Math.abs(rx));
  const fromLeft = lift(-rx, 0.35, 1.05) * (1 - smooth(0.2, 0.9, -ry));
  const fromRight = lift(rx, 0.3, 1.0) * (1 - smooth(-0.1, 0.6, -ry));
  const strip = smooth(-0.6, -0.585, ry) * (1 - smooth(-0.525, -0.51, ry)) * smooth(-0.9, -0.5, rx) * (1 - smooth(0.4, 0.8, rx));
  if (dark) {
    out[0] = 0; out[1] = 0; out[2] = 0;
    ramp(SOFTBOX, above, out);
    ramp(VIOLET, fromLeft, out);
    ramp(PEACH, fromRight, out);
  } else {
    // The same lights in a white room: the room is paper, the lights tint it,
    // and the softbox reads as cool blue shadow so the folds still have depth.
    out[0] = 244; out[1] = 244; out[2] = 247;
    ramp(SOFTBOX_L, above, out);
    ramp(VIOLET_L, fromLeft, out);
    ramp(PEACH_L, fromRight, out);
  }
  const white = 255 * strip;
  out[0] = Math.min(255, out[0] + white);
  out[1] = Math.min(255, out[1] + white);
  out[2] = Math.min(255, out[2] + white);
};

/** Grid step for the surface, in canvas px. The reflection is still per pixel. */
const GRID = 4;

/**
 * The subject, into `ctx`'s whole canvas, which covers the visible `w × h`
 * CSS px plus `pad` px either side (a ray through a rib at the screen's edge
 * looks past it).
 */
export const paintSubject = (ctx: CanvasRenderingContext2D, w: number, h: number, pad: number, dark: boolean) => {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const scale = W / (w + pad * 2);
  const d = Math.hypot(w, h) / Math.SQRT2;
  const per = 1 / (scale * d); // diagonals per canvas px

  // The surface on a grid, one cell past each edge for the differences.
  const gw = Math.ceil(W / GRID) + 3;
  const gh = Math.ceil(H / GRID) + 3;
  const z = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) {
      z[j * gw + i] = height(((i - 1) * GRID) * per - pad / d, ((j - 1) * GRID) * per);
    }
  }
  // Its tilt at each grid point.
  const nx = new Float32Array(gw * gh);
  const ny = new Float32Array(gw * gh);
  const step = 2 * GRID * per;
  for (let j = 1; j < gh - 1; j++) {
    for (let i = 1; i < gw - 1; i++) {
      const k = j * gw + i;
      nx[k] = -((z[k + 1] - z[k - 1]) / step) * TUNE.relief;
      ny[k] = -((z[k + gw] - z[k - gw]) / step) * TUNE.relief;
    }
  }

  const img = ctx.createImageData(W, H);
  const o = img.data;
  const c = new Float32Array(3);
  for (let Y = 0; Y < H; Y++) {
    const gy = Y / GRID + 1;
    const j0 = Math.min(gh - 3, Math.max(1, Math.floor(gy)));
    const fy = gy - j0;
    for (let X = 0; X < W; X++) {
      const gx = X / GRID + 1;
      const i0 = Math.min(gw - 3, Math.max(1, Math.floor(gx)));
      const fx = gx - i0;
      const k = j0 * gw + i0;
      const ax = nx[k] + (nx[k + 1] - nx[k]) * fx;
      const bx = nx[k + gw] + (nx[k + gw + 1] - nx[k + gw]) * fx;
      const ay = ny[k] + (ny[k + 1] - ny[k]) * fx;
      const by = ny[k + gw] + (ny[k + gw + 1] - ny[k + gw]) * fx;
      let px = ax + (bx - ax) * fy;
      let py = ay + (by - ay) * fy;
      const len = Math.sqrt(px * px + py * py + 1);
      px /= len;
      py /= len;
      const pz = 1 / len;
      // Looking straight in: the reflected ray's sideways part.
      studio(2 * pz * px, 2 * pz * py, dark, c);
      const p = (Y * W + X) * 4;
      o[p] = c[0];
      o[p + 1] = c[1];
      o[p + 2] = c[2];
      o[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
};

/* ── The lens ── */

/**
 * The knobs, in one place (`?glass=debug` can override them from the URL).
 * - `reach`: how far either side of its centre a rib looks, in rib widths.
 * - `fold`: how far round the curve the view turns back on itself. At 1 a
 *   rib's edge looks furthest out; above 1 the view peaks inside the rib and
 *   folds back towards the edge, mirrored, which is what turns every slanted
 *   edge behind the glass into an arch.
 * - `disperse`: how much more blue bends than red, as a fraction.
 * - `relief`: how steeply the metal's folds tilt; more tilt catches more light.
 * - `lens`: 0 shows the metal with no glass (for tuning the picture alone).
 */
export const TUNE = { reach: 1.7, fold: 1.75, disperse: 0.05, relief: 0.3, lens: 1 };

/** Rib width in CSS px for a layer this wide. */
export const ribWidth = (w: number, preview: boolean) =>
  preview ? Math.max(5, Math.round(w / 16)) : w < 640 ? 20 : 26;

/**
 * Where the ray through position `v` on a rib (−1 at the left edge, 1 at the
 * right) lands behind the glass, in rib widths from the rib's centre, for
 * colour channel `c` (0 red, 1 green, 2 blue). The shape of a cylinder lens
 * seen from in front: a view that sweeps across the picture as `v` moves, then
 * turns back on itself towards the rib's edges where the face curves away.
 */
const bend = (v: number, c: number) =>
  TUNE.reach * (1 + TUNE.disperse * (c - 1)) * Math.sin((TUNE.fold * Math.PI * v) / 2);

/**
 * Light on the glass at `v`: what is added (a highlight) and how much of the
 * picture is kept (the shade), both from the face's angle.
 */
const light = (v: number, dark: boolean): [number, number] => {
  const sheen = Math.exp(-(((v + 0.42) / 0.16) ** 2));
  const rim = Math.exp(-(((v + 0.94) / 0.05) ** 2));
  const edge = Math.abs(v) ** 5 * (v > 0 ? 1 : 0.45);
  return dark
    ? [255 * (0.11 * sheen + 0.16 * rim), 1 - 0.42 * edge]
    : [255 * (0.2 * sheen + 0.28 * rim), 1 - 0.16 * edge];
};

/**
 * Look at `src` (the subject, `pad` CSS px of margin either side, scaled by
 * `scale`) through the ribs, into a `w × h` CSS px canvas drawn at `q` device
 * px each. One pass over the pixels: everything that depends only on the
 * column (where each channel's ray lands, the light on the glass) is worked
 * out once per column, everything that depends only on the row once per row.
 */
export const paintGlass = (
  ctx: CanvasRenderingContext2D, sctx: CanvasRenderingContext2D,
  w: number, h: number, q: number, scale: number, pad: number, rib: number, dark: boolean,
) => {
  const sw = sctx.canvas.width;
  const sh = sctx.canvas.height;
  const sd = sctx.getImageData(0, 0, sw, sh).data;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const out = ctx.createImageData(W, H);
  const od = out.data;

  // Per column: for each channel the left source pixel and the blend to the right one.
  const x0 = new Int32Array(W * 3);
  const fx = new Float32Array(W * 3);
  const add = new Float32Array(W);
  const keep = new Float32Array(W);
  const sxScale = sw / (w + pad * 2);
  for (let X = 0; X < W; X++) {
    const x = (X + 0.5) / q;
    const i = Math.floor(x / rib);
    const v = ((x - i * rib) / rib) * 2 - 1;
    const centre = (i + 0.5) * rib;
    for (let c = 0; c < 3; c++) {
      const sx = ((TUNE.lens ? centre + bend(v, c) * rib : x) + pad) * sxScale - 0.5;
      const clamped = Math.max(0, Math.min(sw - 1.001, sx));
      const f = Math.floor(clamped);
      x0[X * 3 + c] = f;
      fx[X * 3 + c] = clamped - f;
    }
    const [a, k] = light(v, dark);
    add[X] = a;
    keep[X] = k;
  }

  for (let Y = 0; Y < H; Y++) {
    const sy = Math.max(0, Math.min(sh - 1.001, ((Y + 0.5) / H) * sh - 0.5));
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    const r0 = y0 * sw * 4;
    const r1 = (y0 + 1) * sw * 4;
    let o = Y * W * 4;
    for (let X = 0; X < W; X++) {
      const k = keep[X];
      const a = add[X];
      for (let c = 0; c < 3; c++) {
        const xi = x0[X * 3 + c] * 4 + c;
        const f = fx[X * 3 + c];
        const top = sd[r0 + xi] + (sd[r0 + xi + 4] - sd[r0 + xi]) * f;
        const bot = sd[r1 + xi] + (sd[r1 + xi + 4] - sd[r1 + xi]) * f;
        od[o + c] = (top + (bot - top) * fy) * k + a;
      }
      od[o + 3] = 255;
      o += 4;
    }
  }
  ctx.putImageData(out, 0, 0);
};

/* Film grain, desaturated: the reference is grainy, and grain is what makes
   a blur read as a photograph rather than a CSS gradient. Kept faint, because
   grey noise on top lifts everything under it towards grey. */
const grain = (opacity: number) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E` +
  `%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E` +
  `%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E` +
  `%3Crect width='140' height='140' filter='url(%23n)' opacity='${opacity}'/%3E%3C/svg%3E") 0 0/140px 140px`;

/**
 * The grain, and the groove where two ribs meet: a hairline of shadow with a
 * hairline of light after it. CSS, so both are crisp on a 3× phone. The repeat
 * is one rib, so it lines up with the canvas's ribs exactly.
 */
export const ribShade = (rib: number, dark: boolean): string =>
  dark
    ? `${grain(0.1)},
       radial-gradient(130% 120% at 50% 50%, transparent 55%, rgba(0,0,0,0.5) 100%),
       repeating-linear-gradient(90deg, rgba(0,0,0,0.5) 0 1px, rgba(255,255,255,0.08) 1px 2px, transparent 2px ${rib}px)`
    : `${grain(0.08)},
       radial-gradient(130% 120% at 50% 50%, transparent 55%, rgba(24,24,40,0.14) 100%),
       repeating-linear-gradient(90deg, rgba(40,32,28,0.16) 0 1px, rgba(255,255,255,0.55) 1px 2px, transparent 2px ${rib}px)`;
