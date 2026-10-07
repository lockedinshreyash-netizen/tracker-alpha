/* ── The packaging, measured ──
   Every pack is the same die-cut: a backer card with a reinforced hang tab
   on top and a euro slot punched through it. A perforation runs across just
   under the tab. The rack hangs the pack from the top of that slot. The
   opening tears from the slot down to the perforation, then along it, and
   the strip above folds away.

   Everything here is a number of the pack's size, so one function draws the
   rack's pack, the 72px one on the store sign and the one that flies to the
   middle of the screen. The tear line is jagged but seeded by the pack
   number, so the same pack always tears the same way and a re-render never
   re-rolls it. Pure; tested. */

export interface Pt { x: number; y: number }

export interface PackGeometry {
  w: number;
  h: number;
  tab: { l: number; r: number; h: number };
  /** The euro slot: centre and half-sizes. */
  hole: { cx: number; cy: number; hw: number; hh: number };
  /** Where the perforation runs. */
  perf: number;
  /** Where the hook's rod rests: the top of the slot. Packs rotate about it. */
  pivot: Pt;
  /** The tear, left to right. */
  edge: Pt[];
  flapPath: string;
  bodyPath: string;
  holePath: string;
  /** The whole die-cut outline in one piece, no tear: for a pack that is not there yet. */
  silhouette: string;
  crackDown: string;
  crackLeft: string;
  crackRight: string;
  crackLen: { down: number; side: number };
}

/** A small seeded PRNG (mulberry32), the same one cbt/generate.ts uses. */
const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const f = (n: number) => Math.round(n * 10) / 10;
const len = (pts: Pt[]) => pts.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);
const poly = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${f(p.x)} ${f(p.y)}`).join(' ');

export const geometry = (w: number, h: number, seed = 1): PackGeometry => {
  const k = w / 200;
  const tabH = Math.round(h * 0.16);
  const tabW = Math.round(w * 0.5);
  const l = (w - tabW) / 2;
  const r = l + tabW;
  const rt = 10 * k; // tab corners
  const sh = 6 * k; // shoulders
  const rb = 8 * k; // body's top corners
  const R = 13 * k; // body's bottom corners
  const perf = tabH + Math.round(h * 0.05);
  const hole = { cx: w / 2, cy: tabH * 0.46, hw: w * 0.088, hh: Math.max(4.5, h * 0.019) };

  const rand = rng(seed * 2654435761);
  const step = 5 * k;
  const n = Math.max(8, Math.round(w / step));
  const edge: Pt[] = Array.from({ length: n + 1 }, (_, i) => ({
    x: (w * i) / n,
    y: perf + (i === 0 || i === n ? 0 : (rand() - 0.5) * 2.6 * k),
  }));
  // The flap overlaps the body by a hair, so the join never shows a seam.
  const over = 1.2;

  const flapPath = [
    `M0 ${f(tabH + rb)}`,
    `Q0 ${f(tabH)} ${f(rb)} ${f(tabH)}`,
    `H${f(l - sh)}`,
    `Q${f(l)} ${f(tabH)} ${f(l)} ${f(tabH - sh)}`,
    `V${f(rt)}`,
    `Q${f(l)} 0 ${f(l + rt)} 0`,
    `H${f(r - rt)}`,
    `Q${f(r)} 0 ${f(r)} ${f(rt)}`,
    `V${f(tabH - sh)}`,
    `Q${f(r)} ${f(tabH)} ${f(r + sh)} ${f(tabH)}`,
    `H${f(w - rb)}`,
    `Q${f(w)} ${f(tabH)} ${f(w)} ${f(tabH + rb)}`,
    ...[...edge].reverse().map(p => `L${f(p.x)} ${f(p.y + over)}`),
    'Z',
  ].join(' ');

  const { cx, cy, hw, hh } = hole;
  const holePath = `M${f(cx - hw + hh)} ${f(cy - hh)} H${f(cx + hw - hh)} A${f(hh)} ${f(hh)} 0 0 1 ${f(cx + hw - hh)} ${f(cy + hh)} H${f(cx - hw + hh)} A${f(hh)} ${f(hh)} 0 0 1 ${f(cx - hw + hh)} ${f(cy - hh)} Z`;

  const silhouette = [
    `M0 ${f(tabH + rb)}`,
    `Q0 ${f(tabH)} ${f(rb)} ${f(tabH)}`,
    `H${f(l - sh)}`,
    `Q${f(l)} ${f(tabH)} ${f(l)} ${f(tabH - sh)}`,
    `V${f(rt)}`,
    `Q${f(l)} 0 ${f(l + rt)} 0`,
    `H${f(r - rt)}`,
    `Q${f(r)} 0 ${f(r)} ${f(rt)}`,
    `V${f(tabH - sh)}`,
    `Q${f(r)} ${f(tabH)} ${f(r + sh)} ${f(tabH)}`,
    `H${f(w - rb)}`,
    `Q${f(w)} ${f(tabH)} ${f(w)} ${f(tabH + rb)}`,
    `V${f(h - R)}`,
    `Q${f(w)} ${f(h)} ${f(w - R)} ${f(h)}`,
    `H${f(R)}`,
    `Q0 ${f(h)} 0 ${f(h - R)}`,
    'Z',
  ].join(' ');

  const bodyPath = [
    poly(edge),
    `V${f(h - R)}`,
    `Q${f(w)} ${f(h)} ${f(w - R)} ${f(h)}`,
    `H${f(R)}`,
    `Q0 ${f(h)} 0 ${f(h - R)}`,
    'Z',
  ].join(' ');

  // The tear starts where the hook went through, runs down to the
  // perforation, then along it both ways.
  const mid = Math.round(n / 2);
  const down: Pt[] = [];
  for (let y = cy + hh, i = 0; y < edge[mid].y; y += 4 * k, i += 1) down.push({ x: cx + (i % 2 ? 1 : -1) * (rand() * 1.4 * k), y });
  down.push(edge[mid]);
  const left = edge.slice(0, mid + 1).reverse();
  const right = edge.slice(mid);

  return {
    w, h,
    tab: { l, r, h: tabH },
    hole,
    perf,
    pivot: { x: cx, y: cy - hh },
    edge,
    flapPath: `${flapPath} ${holePath}`,
    bodyPath,
    holePath,
    silhouette,
    crackDown: poly(down),
    crackLeft: poly(left),
    crackRight: poly(right),
    crackLen: { down: len(down), side: Math.max(len(left), len(right)) },
  };
};

/** Rack sizes. A phone shows fewer, narrower packs; it does not shrink the desktop. */
export interface RackSize {
  w: number;
  h: number;
  /** Hook to hook. */
  spacing: number;
  /** Rail margin before the first hook. */
  pad: number;
  /** Where the rod meets the slot, measured from the top of the rack. */
  pivotY: number;
}

export const RACK_SIZES: Record<'phone' | 'tablet' | 'desk', RackSize> = {
  phone: { w: 156, h: 236, spacing: 182, pad: 22, pivotY: 52 },
  tablet: { w: 178, h: 268, spacing: 208, pad: 30, pivotY: 54 },
  desk: { w: 198, h: 298, spacing: 232, pad: 40, pivotY: 56 },
};
