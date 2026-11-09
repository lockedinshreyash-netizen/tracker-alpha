/* ── Hold to snap: turning a rough stroke into the shape it meant ──
   Pure and tested (npm run test:books). Procreate's QuickShape, for the
   whiteboard: finish a stroke and hold still, and a slightly bent line
   becomes straight, a wobbly loop a circle or an ellipse, three or four
   corners a triangle or a rectangle. A stroke only snaps on that hold, so
   handwriting is never touched.

   Everything is measured against the stroke's own size (D, the diagonal of
   its box), so a small sketch and a large one are judged alike.

   The snapped shape is returned as geometry, not as a stroke kind: the
   board draws it back with the pen that drew it (`shapePoints`), so a
   snapped highlighter line is still a highlighter, and a pencil circle
   still pencil. */

export type Pt = [number, number];

export type Shape =
  | { type: 'line'; a: Pt; b: Pt }
  | { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { type: 'poly'; pts: Pt[]; closed: boolean };

export interface Recognized { shape: Shape; label: string }

/* ── Geometry ── */

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const segDist = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};

const pathLength = (pts: Pt[]) => pts.reduce((sum, p, i) => (i ? sum + dist(pts[i - 1], p) : 0), 0);

const boxOf = (pts: Pt[]) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
};

/** `n` points evenly spaced along the path, so a slow part of the stroke does not outweigh a fast one. */
export const resample = (pts: Pt[], n: number): Pt[] => {
  const total = pathLength(pts);
  if (pts.length < 2 || total === 0) return pts.slice();
  const step = total / (n - 1);
  const out: Pt[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length && out.length < n; i++) {
    let a = pts[i - 1];
    const b = pts[i];
    let d = dist(a, b);
    while (acc + d >= step && out.length < n) {
      const t = (step - acc) / d;
      const q: Pt = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(q);
      a = q;
      d = dist(a, b);
      acc = 0;
    }
    acc += d;
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out;
};

const rdp = (pts: Pt[], tol: number): Pt[] => {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = -1, far = tol;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(pts[i], pts[a], pts[b]);
      if (d > far) { far = d; best = i; }
    }
    if (best >= 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  return pts.filter((_, i) => keep[i]);
};

/** How far the path turns at `b`, in degrees: 0 is straight on. */
const turn = (a: Pt, b: Pt, c: Pt): number => {
  const ux = b[0] - a[0], uy = b[1] - a[1], vx = c[0] - b[0], vy = c[1] - b[1];
  const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
  if (!lu || !lv) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv)))) * 180) / Math.PI;
};

/** Drop corners that are hardly corners (nearly straight on, or crowded onto a neighbour). */
const tidyCorners = (v: Pt[], closed: boolean, minEdge: number): Pt[] => {
  let pts = v.slice();
  for (let changed = true; changed && pts.length > (closed ? 3 : 2);) {
    changed = false;
    const n = pts.length;
    for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
      const a = pts[(i - 1 + n) % n], b = pts[i], c = pts[(i + 1) % n];
      if (turn(a, b, c) < 28 || dist(a, b) < minEdge) {
        pts = pts.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return pts;
};

/** The mean distance of the samples from a polygon's edges. */
const polyError = (samples: Pt[], v: Pt[], closed: boolean): number => {
  const edges = closed ? v.length : v.length - 1;
  let sum = 0;
  for (const p of samples) {
    let best = Infinity;
    for (let i = 0; i < edges; i++) best = Math.min(best, segDist(p, v[i], v[(i + 1) % v.length]));
    sum += best;
  }
  return sum / samples.length;
};

/** A line within a few degrees of level, upright or a diagonal is set exactly there. */
const settleAngle = (a: Pt, b: Pt, within = 4): Pt => {
  const len = dist(a, b);
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const near = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
  if (Math.abs(ang - near) > (within * Math.PI) / 180) return b;
  return [a[0] + Math.cos(near) * len, a[1] + Math.sin(near) * len];
};

const POLY_NAMES: Record<number, string> = { 3: 'Triangle', 4: 'Quadrilateral', 5: 'Pentagon', 6: 'Hexagon' };

/**
 * The shape a stroke meant, or null if it was not one. `flat` is the board's
 * [x, y, p, …]; `minSize` is the smallest stroke (world units) worth judging.
 */
export const recognize = (flat: number[], minSize: number): Recognized | null => {
  const raw: Pt[] = [];
  for (let i = 0; i + 1 < flat.length; i += 3) raw.push([flat[i], flat[i + 1]]);
  if (raw.length < 4) return null;
  const box = boxOf(raw);
  const D = Math.hypot(box.w, box.h);
  if (D < minSize) return null;
  const first = raw[0], last = raw[raw.length - 1];
  const L = pathLength(raw);
  const chord = dist(first, last);

  /* A line: the ends far apart, and nothing strays far from the straight between them. */
  if (chord > 0.8 * D && L < 1.3 * chord) {
    const dev = Math.max(...raw.map(p => segDist(p, first, last)));
    if (dev <= Math.max(0.09 * chord, minSize * 0.2)) {
      return { shape: { type: 'line', a: first, b: settleAngle(first, last) }, label: 'Line' };
    }
  }

  const closed = chord < 0.25 * D && L > 1.6 * D;
  if (closed) {
    const ring = resample([...raw, first], 72).slice(0, -1);
    const rb = boxOf(ring);
    const cx = (rb.x0 + rb.x1) / 2, cy = (rb.y0 + rb.y1) / 2, rx = rb.w / 2, ry = rb.h / 2;

    // How far, on average, the stroke strays from the ellipse in its box.
    let ell = 0;
    for (const [x, y] of ring) ell += Math.abs(Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * ((rx + ry) / 2);
    const ellErr = ell / ring.length / D;

    // A polygon: start at the point furthest from the middle (a corner, if there are any), then find the corners.
    let far = 0;
    ring.forEach((p, i) => { if (Math.hypot(p[0] - cx, p[1] - cy) > Math.hypot(ring[far][0] - cx, ring[far][1] - cy)) far = i; });
    const rot = [...ring.slice(far), ...ring.slice(0, far)];
    const corners = tidyCorners(rdp([...rot, rot[0]], 0.045 * D).slice(0, -1), true, 0.12 * D);
    const polyErr = corners.length >= 3 ? polyError(ring, corners, true) / D : Infinity;

    if (corners.length >= 3 && corners.length <= 6 && polyErr < 0.03 && polyErr < ellErr * 0.8) {
      if (corners.length === 4) {
        const axial = corners.every((p, i) => {
          const q = corners[(i + 1) % 4];
          const a = Math.abs((Math.atan2(q[1] - p[1], q[0] - p[0]) * 180) / Math.PI) % 90;
          return a < 14 || a > 76;
        });
        if (axial) {
          const b = boxOf(corners);
          let { x0, y0, x1, y1 } = b;
          const square = Math.abs(b.w - b.h) / Math.max(b.w, b.h) < 0.1;
          if (square) { const s = (b.w + b.h) / 2; x1 = x0 + s; y1 = y0 + s; }
          return { shape: { type: 'poly', pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], closed: true }, label: square ? 'Square' : 'Rectangle' };
        }
      }
      return { shape: { type: 'poly', pts: corners, closed: true }, label: POLY_NAMES[corners.length] };
    }
    if (ellErr < 0.045) {
      if (Math.abs(rx - ry) / Math.max(rx, ry) < 0.12) {
        const r = (rx + ry) / 2;
        return { shape: { type: 'ellipse', cx, cy, rx: r, ry: r }, label: 'Circle' };
      }
      return { shape: { type: 'ellipse', cx, cy, rx, ry }, label: 'Ellipse' };
    }
    return null;
  }

  /* An open run of straight pieces: an angle, a zigzag, an axis. */
  // An arc cut into chords fits almost as closely as a real angle does; what tells them apart is that each
  // piece of an angle is straight along its own length, while every chord of an arc bows.
  const samples = resample(raw, 64);
  const v = tidyCorners(rdp(samples, 0.04 * D), false, 0.12 * D);
  const straightPieces = () => v.slice(1).every((b, i) => {
    const a = v[i];
    const len = dist(a, b);
    const mine = samples.filter(p => {
      const d = segDist(p, a, b);
      return v.slice(1).every((q, j) => segDist(p, v[j], q) >= d);
    });
    return mine.every(p => segDist(p, a, b) <= 0.05 * len + 0.004 * D);
  });
  if (v.length >= 3 && v.length <= 5 && polyError(samples, v, false) / D < 0.018 && straightPieces()) {
    return { shape: { type: 'poly', pts: v, closed: false }, label: v.length === 3 ? 'Angle' : 'Lines' };
  }
  return null;
};

/* ── After the snap: adjusting it while the finger is still down ── */

export const centreOf = (s: Shape): Pt => {
  if (s.type === 'ellipse') return [s.cx, s.cy];
  if (s.type === 'line') return [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2];
  const b = boxOf(s.pts);
  return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
};

/** Grow or shrink about the centre (a line's end follows the finger instead: see `moveEnd`). */
export const scaleShape = (s: Shape, k: number): Shape => {
  const [cx, cy] = centreOf(s);
  const at = ([x, y]: Pt): Pt => [cx + (x - cx) * k, cy + (y - cy) * k];
  if (s.type === 'ellipse') return { ...s, rx: s.rx * k, ry: s.ry * k };
  if (s.type === 'line') return { type: 'line', a: at(s.a), b: at(s.b) };
  return { ...s, pts: s.pts.map(at) };
};

/** A snapped line's far end, wherever the finger takes it; `exact` (Shift) holds it to 15° steps. */
export const moveEnd = (s: Extract<Shape, { type: 'line' }>, to: Pt, exact: boolean): Shape => {
  if (!exact) return { ...s, b: settleAngle(s.a, to) };
  const len = dist(s.a, to);
  const ang = Math.round(Math.atan2(to[1] - s.a[1], to[0] - s.a[0]) / (Math.PI / 12)) * (Math.PI / 12);
  return { ...s, b: [s.a[0] + Math.cos(ang) * len, s.a[1] + Math.sin(ang) * len] };
};

/** Shift: an ellipse becomes a circle, a rectangle a square. */
export const perfect = (s: Shape): Shape => {
  if (s.type === 'ellipse') { const r = (s.rx + s.ry) / 2; return { ...s, rx: r, ry: r }; }
  if (s.type === 'poly' && s.closed && s.pts.length === 4) {
    const b = boxOf(s.pts);
    const side = (b.w + b.h) / 2;
    return { ...s, pts: [[b.x0, b.y0], [b.x0 + side, b.y0], [b.x0 + side, b.y0 + side], [b.x0, b.y0 + side]] };
  }
  return s;
};

/**
 * The shape as the board's freehand points [x, y, p, …], to be drawn with
 * the pen that drew it. Corners are written twice: the board smooths a
 * stroke through the midpoints of its samples, and a doubled point is its
 * own midpoint, so a corner stays sharp.
 */
export const shapePoints = (s: Shape, p: number): number[] => {
  const out: number[] = [];
  const put = ([x, y]: Pt) => out.push(x, y, p);
  if (s.type === 'line') { put(s.a); put(s.b); return out; }
  if (s.type === 'ellipse') {
    for (let i = 0; i <= 72; i++) {
      const t = (i / 72) * Math.PI * 2;
      put([s.cx + s.rx * Math.cos(t), s.cy + s.ry * Math.sin(t)]);
    }
    return out;
  }
  const v = s.closed ? [...s.pts, s.pts[0]] : s.pts;
  v.forEach((q, i) => { put(q); if (i > 0 && i < v.length - 1) put(q); });
  if (s.closed) put(s.pts[0]);
  return out;
};
