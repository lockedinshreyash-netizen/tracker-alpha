/* ── The whiteboard beside a book: the model ──
   Pure and tested (npm run test:books). An endless sheet for working a sum
   or sketching a diagram while the book stays open, one per book, kept on
   this device (books/files.ts `boards`).

   Everything is in WORLD units. The view maps world to screen:
     screen = (world - view.x) * view.z
   so panning moves x/y and zooming changes z about a fixed screen point.
   A stroke's width is set in world units when it is drawn (the chosen size
   divided by the zoom then), so a line looks as thick as the size picked
   whatever the zoom, and then scales with the sheet like ink on paper.

   Freehand strokes keep their points as a flat [x, y, p, x, y, p, …] list
   (p = pressure 0..1, used by the brush). Shapes keep two corners
   [x0, y0, x1, y1]. Ink colours are hex, or 'ink', which is the board's own
   ink (near-black on a light board, near-white on a dark one), so a board
   reads the same when the room's page colour changes. */

export type PenKind = 'pen' | 'pencil' | 'marker' | 'brush';
export type ShapeKind = 'line' | 'arrow' | 'rect' | 'ellipse';
/** 'image' is a picture on the board (a diagram snipped from the page): moved and resized, drawn over, never erased. */
export type StrokeKind = PenKind | ShapeKind | 'image';
export type Tool = Exclude<StrokeKind, 'image'> | 'eraser' | 'hand' | 'stamp' | 'snip';
export type Background = 'dots' | 'grid' | 'lines' | 'blank';

export interface Stroke {
  id: string;
  kind: StrokeKind;
  /** '#rrggbb' or 'ink'. */
  color: string;
  /** Width in world units. */
  w: number;
  pts: number[];
  /** An image's picture, by id in the book's `boardImages` store (books/files.ts). */
  img?: string;
  /** An image shown faint, so working drawn over it stands out. */
  fade?: boolean;
}

export interface View { x: number; y: number; z: number }

export interface Board {
  bookId: string;
  strokes: Stroke[];
  view: View;
  bg: Background;
  updatedAt: number;
}

export const PENS: PenKind[] = ['pen', 'pencil', 'marker', 'brush'];
export const SHAPES: ShapeKind[] = ['line', 'arrow', 'rect', 'ellipse'];
export const isPen = (k: string): k is PenKind => (PENS as string[]).includes(k);
export const isShape = (k: string): k is ShapeKind => (SHAPES as string[]).includes(k);

/** Three sizes per tool, in screen pixels at the moment of drawing (the eraser's is its radius). */
export const SIZES: Record<StrokeKind | 'eraser', [number, number, number]> = {
  pen: [2, 3.5, 7],
  pencil: [1.2, 2, 3.5],
  marker: [12, 20, 32],
  brush: [3.5, 7, 13],
  line: [2, 3.5, 6],
  arrow: [2, 3.5, 6],
  rect: [2, 3.5, 6],
  ellipse: [2, 3.5, 6],
  eraser: [8, 16, 32],
  image: [0, 0, 0],
};
/** Stamps draw with the shapes' widths. */
export const sizeFor = (tool: StrokeKind | 'eraser' | 'stamp', i: 0 | 1 | 2): number => SIZES[tool === 'stamp' ? 'line' : tool][i];

/** The pens' colours. 'ink' first; no #E10600, which is Alpha's action red. */
export const INKS = ['ink', '#e5484d', '#f08c00', '#f2c200', '#2f9e44', '#1c7ed6', '#7048e8', '#d6336c'] as const;

export const MIN_Z = 0.1;
export const MAX_Z = 8;
export const MAX_STROKES = 5000;
const MAX_PTS = 30_000;
const HEX = /^#[0-9a-f]{6}$/i;

export const emptyBoard = (bookId: string): Board => ({ bookId, strokes: [], view: { x: 0, y: 0, z: 1 }, bg: 'dots', updatedAt: 0 });

/* ── The view ── */

export const toWorld = (v: View, sx: number, sy: number): [number, number] => [sx / v.z + v.x, sy / v.z + v.y];
export const toScreen = (v: View, wx: number, wy: number): [number, number] => [(wx - v.x) * v.z, (wy - v.y) * v.z];

export const clampZ = (z: number): number => Math.min(MAX_Z, Math.max(MIN_Z, z));

/** Zoom by `factor` about a screen point, which stays over the same world point. */
export const zoomAt = (v: View, sx: number, sy: number, factor: number): View => {
  const z = clampZ(v.z * factor);
  const [wx, wy] = toWorld(v, sx, sy);
  return { x: wx - sx / z, y: wy - sy / z, z };
};

export const panBy = (v: View, dx: number, dy: number): View => ({ x: v.x - dx / v.z, y: v.y - dy / v.z, z: v.z });

/* ── Geometry ── */

export interface Box { x0: number; y0: number; x1: number; y1: number }

/* A committed stroke never changes (edits make new arrays), so its box is worked out once. */
const boxes = new WeakMap<Stroke, Box>();

export const boxOf = (s: Stroke): Box => {
  const hit = boxes.get(s);
  if (hit) return hit;
  const b = measure(s);
  boxes.set(s, b);
  return b;
};

const measure = (s: Stroke): Box => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const step = isPen(s.kind) ? 3 : 2;
  for (let i = 0; i + 1 < s.pts.length; i += step) {
    const x = s.pts[i], y = s.pts[i + 1];
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  // An arrowhead reaches past the line's end by about its own size.
  const pad = s.w / 2 + (s.kind === 'arrow' ? s.w * 4 + 6 : 0);
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
};

/** The box from two corners dragged in any direction. */
export const boxFrom = (ax: number, ay: number, bx: number, by: number): Box =>
  ({ x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) });

/** Is there any ink in this box? (A snip of empty sheet is not worth sending anywhere.) */
export const inkIn = (strokes: Stroke[], b: Box): boolean => strokes.some(s => overlaps(boxOf(s), b));

export const overlaps = (a: Box, b: Box): boolean => a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;

/** The world box a screen of `w`×`h` shows. */
export const viewBox = (v: View, w: number, h: number): Box => ({ x0: v.x, y0: v.y, x1: v.x + w / v.z, y1: v.y + h / v.z });

/** A shape's corners with Shift held: a square box, a circle, or a line snapped to 45°. */
export const constrain = (kind: ShapeKind, x0: number, y0: number, x1: number, y1: number): [number, number] => {
  const dx = x1 - x0, dy = y1 - y0;
  if (kind === 'rect' || kind === 'ellipse') {
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    return [x0 + Math.sign(dx || 1) * d, y0 + Math.sign(dy || 1) * d];
  }
  const len = Math.hypot(dx, dy);
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return [x0 + Math.cos(a) * len, y0 + Math.sin(a) * len];
};

/** The polyline a shape is drawn (and hit) as. Arrows return the shaft; the head is drawn apart. */
export const shapeOutline = (kind: ShapeKind, pts: number[]): number[] => {
  const [x0, y0, x1, y1] = pts;
  if (kind === 'line' || kind === 'arrow') return [x0, y0, x1, y1];
  if (kind === 'rect') return [x0, y0, x1, y0, x1, y1, x0, y1, x0, y0];
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.abs(x1 - x0) / 2, ry = Math.abs(y1 - y0) / 2;
  const out: number[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    out.push(cx + rx * Math.cos(t), cy + ry * Math.sin(t));
  }
  return out;
};

/** The two barbs of an arrowhead at (x1, y1), pointing away from (x0, y0). */
export const arrowHead = (x0: number, y0: number, x1: number, y1: number, w: number): number[] => {
  const len = Math.min(Math.hypot(x1 - x0, y1 - y0) * 0.45, w * 4 + 10);
  const a = Math.atan2(y1 - y0, x1 - x0);
  const spread = Math.PI / 7;
  return [
    x1 - len * Math.cos(a - spread), y1 - len * Math.sin(a - spread),
    x1, y1,
    x1 - len * Math.cos(a + spread), y1 - len * Math.sin(a + spread),
  ];
};

const segDist = (px: number, py: number, ax: number, ay: number, bx: number, by: number): number => {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

/** Does a circle of radius `r` at (x, y) touch the stroke's ink? */
export const hits = (s: Stroke, x: number, y: number, r: number): boolean => {
  if (s.kind === 'image') return inImage(s, x, y, r);
  const b = boxOf(s);
  if (x < b.x0 - r || x > b.x1 + r || y < b.y0 - r || y > b.y1 + r) return false;
  const reach = r + s.w / 2;
  let line: number[];
  if (isPen(s.kind)) {
    line = [];
    for (let i = 0; i + 1 < s.pts.length; i += 3) line.push(s.pts[i], s.pts[i + 1]);
  } else {
    line = shapeOutline(s.kind, s.pts);
    if (s.kind === 'arrow') {
      const h = arrowHead(s.pts[0], s.pts[1], s.pts[2], s.pts[3], s.w);
      if (segDist(x, y, h[0], h[1], h[2], h[3]) <= reach || segDist(x, y, h[2], h[3], h[4], h[5]) <= reach) return true;
    }
  }
  if (line.length === 2) return Math.hypot(x - line[0], y - line[1]) <= reach;
  for (let i = 0; i + 3 < line.length; i += 2) {
    if (segDist(x, y, line[i], line[i + 1], line[i + 2], line[i + 3]) <= reach) return true;
  }
  return false;
};

/** Ids of strokes the eraser touches moving from (ax, ay) to (bx, by): sampled so a fast swipe misses nothing. */
export const erasedBy = (strokes: Stroke[], ax: number, ay: number, bx: number, by: number, r: number, skip: Set<string>): string[] => {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / Math.max(1, r * 0.75)));
  const out: string[] = [];
  for (const s of strokes) {
    if (skip.has(s.id) || s.kind === 'image') continue; // the eraser takes ink, never the diagram under it
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (hits(s, ax + (bx - ax) * t, ay + (by - ay) * t, r)) { out.push(s.id); break; }
    }
  }
  return out;
};

/* ── Drawing a stroke ── */

/** Append a point unless it is within `min` of the last (world units). Returns whether it was added. */
export const pushPoint = (pts: number[], x: number, y: number, p: number, min: number): boolean => {
  const n = pts.length;
  if (n >= 3 && Math.hypot(x - pts[n - 3], y - pts[n - 2]) < min) return false;
  if (n >= MAX_PTS) return false;
  pts.push(x, y, p);
  return true;
};

/** A mouse or finger has no pressure: the brush thins as the hand speeds up, like a nib. px per ms → 0..1. */
export const speedPressure = (pxPerMs: number): number => Math.max(0.25, Math.min(1, 1.15 - pxPerMs * 0.35));

/** Ramer–Douglas–Peucker on a finished freehand stroke, keeping pressure with its point. */
export const simplify = (pts: number[], tolerance: number): number[] => {
  const n = pts.length / 3;
  if (n <= 2) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = -1, far = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = segDist(pts[i * 3], pts[i * 3 + 1], pts[a * 3], pts[a * 3 + 1], pts[b * 3], pts[b * 3 + 1]);
      // A pressure swing is detail worth keeping on a brush stroke.
      const dp = Math.abs(pts[i * 3 + 2] - (pts[a * 3 + 2] + pts[b * 3 + 2]) / 2) * 4 * tolerance;
      if (Math.max(d, dp) > far) { far = Math.max(d, dp); best = i; }
    }
    if (best >= 0) { keep[best] = 1; stack.push([a, best], [best, b]); }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
  return out;
};

/** One decimal is plenty for ink, and halves what is stored. */
export const roundPts = (pts: number[]): number[] => pts.map(v => Math.round(v * 10) / 10);

/* ── Undo ── */

export interface History { past: Stroke[][]; present: Stroke[]; future: Stroke[][] }
const KEEP = 100;

export const historyOf = (strokes: Stroke[]): History => ({ past: [], present: strokes, future: [] });
export const commit = (h: History, next: Stroke[]): History =>
  next === h.present ? h : { past: [...h.past, h.present].slice(-KEEP), present: next, future: [] };
export const undo = (h: History): History =>
  h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h;
export const redo = (h: History): History =>
  h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h;

/* ── Finding your work ── */

/** A view that shows every stroke, with a margin, never closer than 100%. Null for an empty board. */
export const fitView = (strokes: Stroke[], w: number, h: number, margin = 40): View | null => {
  if (!strokes.length || w <= 0 || h <= 0) return null;
  const all = strokes.map(boxOf).reduce((a, b) => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) }));
  const bw = Math.max(1, all.x1 - all.x0), bh = Math.max(1, all.y1 - all.y0);
  const z = clampZ(Math.min(1, (w - margin * 2) / bw, (h - margin * 2) / bh));
  return { x: (all.x0 + all.x1) / 2 - w / 2 / z, y: (all.y0 + all.y1) / 2 - h / 2 / z, z };
};

/* ── Reading a saved board back ── */

const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const KINDS: StrokeKind[] = [...PENS, ...SHAPES, 'image'];
const IMG_ID = /^[a-z0-9]{6,40}$/;

export const normalizeBoard = (raw: unknown, bookId: string): Board => {
  const b = emptyBoard(bookId);
  if (!raw || typeof raw !== 'object') return b;
  const r = raw as Record<string, unknown>;
  const v = (r.view ?? {}) as Record<string, unknown>;
  b.view = { x: num(v.x, 0), y: num(v.y, 0), z: clampZ(num(v.z, 1)) };
  b.bg = (['dots', 'grid', 'lines', 'blank'] as Background[]).includes(r.bg as Background) ? r.bg as Background : 'dots';
  b.updatedAt = num(r.updatedAt, 0);
  const strokes = Array.isArray(r.strokes) ? r.strokes : [];
  for (const s of strokes.slice(-MAX_STROKES)) {
    if (!s || typeof s !== 'object') continue;
    const o = s as Record<string, unknown>;
    if (typeof o.id !== 'string' || !KINDS.includes(o.kind as StrokeKind)) continue;
    const kind = o.kind as StrokeKind;
    const pts = Array.isArray(o.pts) ? o.pts.filter((p): p is number => typeof p === 'number' && Number.isFinite(p)) : [];
    if (isPen(kind) ? pts.length < 3 || pts.length % 3 : pts.length !== 4) continue;
    if (kind === 'image') {
      if (typeof o.img !== 'string' || !IMG_ID.test(o.img)) continue;
      b.strokes.push({ id: o.id, kind, color: 'ink', w: 0, pts: pts.slice(0, 4), img: o.img, ...(o.fade === true ? { fade: true } : {}) });
      continue;
    }
    const color = o.color === 'ink' || (typeof o.color === 'string' && HEX.test(o.color)) ? o.color : 'ink';
    b.strokes.push({ id: o.id, kind, color, w: Math.min(500, Math.max(0.05, num(o.w, 2))), pts: pts.slice(0, MAX_PTS) });
  }
  return b;
};

/* ── Stamps: premade shapes to draw on top of ──
   Placed as ordinary strokes, one per bond or side, so a student can erase
   a single bond, add a substituent, or draw a double bond over a single one
   to get the structure they want. A placement is one step of undo.

   Each stamp is drawn in its own units (y down) and fitted into the box the
   student drags, keeping its proportions. Rings are drawn the way a
   textbook draws them: a vertex at the top, Kekulé double bonds as a
   shorter line inside the ring. */

export interface StampDef {
  id: string;
  label: string;
  group: 'shape' | 'chem';
  /** Lines: [x0, y0, x1, y1] each. */
  lines: number[][];
  /** Arrows: [x0, y0, x1, y1] each, head at the end. */
  arrows?: number[][];
  /** Circles: [cx, cy, r] each. */
  circles?: number[][];
}

type Pt = [number, number];

/** A regular polygon of radius 1 about (cx, cy), first vertex straight up. */
const polygon = (n: number, cx = 0, cy = 0, turn = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + turn + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a), cy + Math.sin(a)] as Pt;
  });

const ringLines = (pts: Pt[]): number[][] => pts.map((p, i) => [...p, ...pts[(i + 1) % pts.length]]);

/** The inner line of a double bond: the edge pulled 22% toward the ring's centre and trimmed 18% at each end. */
const inner = (a: Pt, b: Pt, c: Pt): number[] => {
  const pull = (p: Pt): Pt => [p[0] + (c[0] - p[0]) * 0.22, p[1] + (c[1] - p[1]) * 0.22];
  const [p, q] = [pull(a), pull(b)];
  const t = 0.18;
  return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, q[0] + (p[0] - q[0]) * t, q[1] + (p[1] - q[1]) * t];
};

const HEXAGON = polygon(6);
// Naphthalene: two hexagons sharing a vertical edge (the right ring's 4 and 5 are the left ring's 2 and 1).
const W = Math.cos(Math.PI / 6);
const LEFT = polygon(6, -W, 0);
const RIGHT = polygon(6, W, 0);
const CHAIR: Pt[] = [[0, 0], [0.5, -0.6], [1.4, -0.3], [2.3, -0.45], [1.8, 0.15], [0.9, -0.15]];

export const STAMPS: StampDef[] = [
  { id: 'triangle', label: 'Triangle', group: 'shape', lines: ringLines([[0, 0], [1, 1.6], [-1, 1.6]].map(([x, y]) => [x, y - 0.8] as Pt)) },
  { id: 'right-triangle', label: 'Right triangle', group: 'shape', lines: ringLines([[0, 0], [0, 1.2], [1.6, 1.2]]) },
  { id: 'axes', label: 'Axes', group: 'shape', lines: [], arrows: [[-0.2, 1.6, 2.2, 1.6], [0, 1.8, 0, -0.6]] },
  {
    id: 'benzene',
    label: 'Benzene',
    group: 'chem',
    lines: [...ringLines(HEXAGON), inner(HEXAGON[0], HEXAGON[1], [0, 0]), inner(HEXAGON[2], HEXAGON[3], [0, 0]), inner(HEXAGON[4], HEXAGON[5], [0, 0])],
  },
  { id: 'aromatic', label: 'Benzene (ring)', group: 'chem', lines: ringLines(HEXAGON), circles: [[0, 0, 0.58]] },
  { id: 'cyclohexane', label: 'Cyclohexane', group: 'chem', lines: ringLines(HEXAGON) },
  { id: 'chair', label: 'Chair', group: 'chem', lines: ringLines(CHAIR) },
  { id: 'cyclopentane', label: 'Cyclopentane', group: 'chem', lines: ringLines(polygon(5)) },
  { id: 'cyclobutane', label: 'Cyclobutane', group: 'chem', lines: ringLines(polygon(4, 0, 0, Math.PI / 4)) },
  { id: 'cyclopropane', label: 'Cyclopropane', group: 'chem', lines: ringLines(polygon(3)) },
  {
    id: 'naphthalene',
    label: 'Naphthalene',
    group: 'chem',
    // Kekulé: the shared bond, two more in the left ring, two in the right; every carbon has one double bond.
    lines: [
      ...ringLines(LEFT),
      // The right ring without edge 4→5, which is the left ring's 1→2.
      ...ringLines(RIGHT).filter((_, i) => i !== 4),
      inner(LEFT[1], LEFT[2], [-W, 0]),
      inner(LEFT[3], LEFT[4], [-W, 0]),
      inner(LEFT[5], LEFT[0], [-W, 0]),
      inner(RIGHT[0], RIGHT[1], [W, 0]),
      inner(RIGHT[2], RIGHT[3], [W, 0]),
    ],
  },
  {
    id: 'chain',
    label: 'Carbon chain',
    group: 'chem',
    lines: [0, 1, 2, 3, 4].map(i => [i * W, i % 2 ? -0.5 : 0, (i + 1) * W, i % 2 ? 0 : -0.5]),
  },
];

export const stampById = (id: string): StampDef | undefined => STAMPS.find(s => s.id === id);

/** A stamp's own extent, in its units. */
export const stampBox = (s: StampDef): Box => {
  const xs: number[] = [], ys: number[] = [];
  for (const l of [...s.lines, ...(s.arrows ?? [])]) { xs.push(l[0], l[2]); ys.push(l[1], l[3]); }
  for (const [cx, cy, r] of s.circles ?? []) { xs.push(cx - r, cx + r); ys.push(cy - r, cy + r); }
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
};

/**
 * The stamp as strokes, fitted inside the box (x0, y0)–(x1, y1) in world
 * units, centred, keeping its proportions. `id` makes each stroke's id.
 */
export const stampStrokes = (s: StampDef, x0: number, y0: number, x1: number, y1: number, color: string, w: number, id: (i: number) => string): Stroke[] => {
  const b = stampBox(s);
  const bw = Math.max(1e-6, b.x1 - b.x0), bh = Math.max(1e-6, b.y1 - b.y0);
  const boxW = Math.abs(x1 - x0), boxH = Math.abs(y1 - y0);
  const k = Math.min(boxW / bw, boxH / bh);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
  const X = (x: number) => cx + (x - mx) * k;
  const Y = (y: number) => cy + (y - my) * k;
  const out: Stroke[] = [];
  let n = 0;
  for (const l of s.lines) out.push({ id: id(n++), kind: 'line', color, w, pts: [X(l[0]), Y(l[1]), X(l[2]), Y(l[3])] });
  for (const l of s.arrows ?? []) out.push({ id: id(n++), kind: 'arrow', color, w, pts: [X(l[0]), Y(l[1]), X(l[2]), Y(l[3])] });
  for (const [ccx, ccy, r] of s.circles ?? []) out.push({ id: id(n++), kind: 'ellipse', color, w, pts: [X(ccx - r), Y(ccy - r), X(ccx + r), Y(ccy + r)] });
  return out;
};

/* ── Images: diagrams brought over from the page ── */

/** Inside an image's box (plus `r`)? */
export const inImage = (s: Stroke, x: number, y: number, r = 0): boolean => {
  const [x0, y0, x1, y1] = s.pts;
  return x >= Math.min(x0, x1) - r && x <= Math.max(x0, x1) + r && y >= Math.min(y0, y1) - r && y <= Math.max(y0, y1) + r;
};

/** The topmost image under a point. Images sit under all ink, so ink never hides one from a tap. */
export const imageAt = (strokes: Stroke[], x: number, y: number): Stroke | null => {
  for (let i = strokes.length - 1; i >= 0; i--) if (strokes[i].kind === 'image' && inImage(strokes[i], x, y)) return strokes[i];
  return null;
};

/** Every picture a board still uses (the rest can be deleted from the device). */
export const imagesIn = (strokes: Stroke[]): Set<string> => new Set(strokes.flatMap(s => (s.kind === 'image' && s.img ? [s.img] : [])));

export type Corner = 0 | 1 | 2 | 3; // top-left, top-right, bottom-right, bottom-left

export const cornersOf = (s: Stroke): [number, number][] => {
  const [x0, y0, x1, y1] = s.pts;
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
};

/**
 * A picture `pw`×`ph` px placed in the middle of the view, at most 70% of
 * it either way and never larger than half its pixels (a 1600 px snip of a
 * page lands about the size the page showed it).
 */
export const placeImage = (v: View, w: number, h: number, pw: number, ph: number): number[] => {
  const k = Math.min((0.7 * w) / v.z / pw, (0.7 * h) / v.z / ph, 0.5 / v.z);
  const iw = pw * k, ih = ph * k;
  const cx = v.x + w / 2 / v.z, cy = v.y + h / 2 / v.z;
  return [cx - iw / 2, cy - ih / 2, cx + iw / 2, cy + ih / 2];
};

/**
 * Drag corner `c` of an image to (x, y): the opposite corner stays put. The
 * picture keeps its shape unless `free` (Shift); it never turns inside out
 * or shrinks below `min`.
 */
export const resizeImage = (pts: number[], c: Corner, x: number, y: number, free: boolean, min: number): number[] => {
  const [x0, y0, x1, y1] = pts;
  const corners: [number, number][] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const [ax, ay] = corners[(c + 2) % 4];
  const [cx, cy] = corners[c];
  const sx = Math.sign(cx - ax) || 1, sy = Math.sign(cy - ay) || 1;
  let w = Math.max(min, (x - ax) * sx);
  let h = Math.max(min, (y - ay) * sy);
  if (!free) {
    const aspect = Math.abs(x1 - x0) / Math.max(1e-6, Math.abs(y1 - y0));
    if (w / h > aspect) h = w / aspect; else w = h * aspect;
  }
  const nx = ax + sx * w, ny = ay + sy * h;
  return [Math.min(ax, nx), Math.min(ay, ny), Math.max(ax, nx), Math.max(ay, ny)];
};

export const moveBy = (pts: number[], dx: number, dy: number): number[] => [pts[0] + dx, pts[1] + dy, pts[2] + dx, pts[3] + dy];
