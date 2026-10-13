/**
 * The city: every lit window is someone studying.
 *
 * Generated once from a fixed seed, so every render is byte-identical. What
 * makes it read as a city from the air rather than a starfield is structure:
 * blocks of buildings with lit windows, a grid of sodium streetlights along
 * the avenues, a highway that curves through, and a river with no lights at
 * all. Density falls off from the centre, where the hero's building stands.
 *
 * Every light carries the second it switches on. Windows near the centre
 * first, then a flood outward: the gap between "someone" and "lakhs of them"
 * is the shape of that curve. Streetlights come up a beat behind the windows,
 * so the opening frames stay one lamp in the dark.
 */
import { hash01, mulberry32 } from '../score/random';

export interface City {
  positions: Float32Array; // xyz
  colors: Float32Array; // rgb, HDR (above 1 blooms)
  sizes: Float32Array; // world-space diameter
  onAt: Float32Array; // seconds
  seeds: Float32Array;
  count: number;
}

/** The window the film is about: the centre building, second floor. */
export const HERO = { x: 0, y: 0.26, z: 0 };

export const RADIUS = 560;
const BLOCK = 4.2;
const AVENUE_EVERY = 2; // every other street is an avenue with lights

const WARM: [number, number, number][] = [
  [1.0, 0.74, 0.44],
  [1.0, 0.83, 0.6],
  [1.0, 0.91, 0.74],
];
const COOL: [number, number, number][] = [
  [0.8, 0.88, 1.0],
  [0.66, 0.8, 1.0],
];
const SODIUM: [number, number, number] = [1.0, 0.52, 0.18];

/** Streets bend a little, so the grid reads as a real city and not graph paper. */
const warp = (x: number, z: number): [number, number] => [
  x + 4.5 * Math.sin(z * 0.012) + 0.35 * Math.sin(z * 0.061 + 1.3),
  z + 4.5 * Math.sin(x * 0.011 + 0.7) + 0.35 * Math.sin(x * 0.057),
];

/** The river: a band of dark water winding across the city. */
const riverAt = (x: number, z: number): boolean => {
  // South of the hero, so it crosses the wide shot but never the close-up.
  const centre = 70 * Math.sin(x * 0.011 + 0.9) + 26 * Math.sin(x * 0.031) - 115;
  return Math.abs(z - centre) < 7 + 2 * Math.sin(x * 0.05);
};

/** The highway: a long arc of bright lights crossing the river. */
const highway = (s: number): [number, number] => [s, 0.0009 * s * s - 0.22 * s + 40 * Math.sin(s * 0.008) + 38];

export const buildCity = (): City => {
  const rnd = mulberry32(2027);
  const pos: number[] = [];
  const col: number[] = [];
  const size: number[] = [];
  const on: number[] = [];
  const seed: number[] = [];
  let n = 0;

  const push = (x: number, y: number, z: number, c: [number, number, number], bright: number, s: number, onAt: number) => {
    pos.push(x, y, z);
    col.push(c[0] * bright, c[1] * bright, c[2] * bright);
    size.push(s);
    on.push(onAt);
    seed.push(hash01(n++, 3));
  };
  /* 0 at the centre, 1 at the edge, with most of the change early: the near
     neighbourhood lights first, then the city floods in. */
  const reach = (x: number, z: number) => Math.pow(Math.min(1, Math.hypot(x, z) / RADIUS), 0.5);

  const cells = Math.ceil(RADIUS / BLOCK);

  // ── Buildings: lit windows ──
  for (let i = -cells; i <= cells; i++) {
    for (let j = -cells; j <= cells; j++) {
      const [cx, cz] = warp(i * BLOCK, j * BLOCK);
      const r = Math.hypot(cx, cz);
      if (r > RADIUS) continue;
      if (riverAt(cx, cz)) continue;
      const core = Math.exp(-r / 85);
      const centre = i === 0 && j === 0;
      // Thins out towards the edge so the city dissolves into the haze
      // instead of stopping at a line.
      const edge = 1 - Math.pow(Math.min(1, r / RADIUS), 3);
      if (!centre && rnd() > (0.5 + 0.5 * core) * edge) continue; // some lots are dark
      const buildings = centre ? 5 : 2 + Math.floor(rnd() * 4);
      for (let b = 0; b < buildings; b++) {
        const bx = cx + (rnd() - 0.5) * (BLOCK - 1.4);
        const bz = cz + (rnd() - 0.5) * (BLOCK - 1.4);
        const floors = 1 + Math.floor(rnd() * (2 + 14 * core * core + 3 * core));
        const lit = Math.max(1, Math.round(floors * (0.35 + rnd() * 0.6) * (1 + 2 * core)));
        for (let k = 0; k < lit; k++) {
          const f = Math.floor(rnd() * floors);
          const x = bx + (rnd() - 0.5) * 0.7;
          const z = bz + (rnd() - 0.5) * 0.7;
          const id = n;
          const cool = hash01(id, 7) < 0.18;
          const pal = cool ? COOL : WARM;
          const c = pal[Math.floor(hash01(id, 11) * pal.length)];
          const onAt = 1.15 + reach(x, z) * 3.6 + rnd() * 0.9;
          push(x, 0.05 + f * 0.13, z, c, 1.3 + rnd() * 1.6, 0.05 + rnd() * 0.03, onAt);
        }
      }
    }
  }

  // ── Avenues: sodium streetlights in lines ──
  const lamp = (x: number, z: number) => {
    if (Math.hypot(x, z) > RADIUS || riverAt(x, z)) return;
    const onAt = 2.1 + reach(x, z) * 2.8 + rnd() * 0.5;
    const edge = 1 - Math.pow(Math.min(1, Math.hypot(x, z) / RADIUS), 2);
    push(x, 0.03, z, SODIUM, (2.1 + rnd() * 0.6) * (0.4 + 0.6 * edge), 0.055, onAt);
  };
  for (let i = -cells; i <= cells; i++) {
    if (((i % AVENUE_EVERY) + AVENUE_EVERY) % AVENUE_EVERY !== 0) continue;
    const g = (i + 0.5) * BLOCK;
    for (let s = -RADIUS; s <= RADIUS; s += 0.85) {
      const density = Math.exp(-Math.abs(s) / 300) * Math.exp(-Math.abs(g) / 300);
      if (rnd() > 0.45 + 0.55 * density) continue;
      lamp(...warp(g, s));
      lamp(...warp(s, g));
    }
  }

  // ── The highway: two dense strings of white and amber ──
  for (let s = -RADIUS; s <= RADIUS; s += 0.55) {
    const [x, z] = highway(s);
    const [x2, z2] = highway(s + 0.6);
    const nx = -(z2 - z), nz = x2 - x;
    const l = Math.hypot(nx, nz) || 1;
    if (Math.hypot(x, z) > RADIUS) continue;
    const onAt = 2.4 + reach(x, z) * 2.4 + rnd() * 0.3;
    push(x + (nx / l) * 0.6, 0.3, z + (nz / l) * 0.6, [1, 0.95, 0.85], 2.2, 0.07, onAt);
    push(x - (nx / l) * 0.6, 0.3, z - (nz / l) * 0.6, [1, 0.38, 0.16], 1.8, 0.07, onAt);
  }

  // ── The hero's neighbours: soft bokeh in the first close frames ──
  for (let k = 0; k < 30; k++) {
    const a = rnd() * Math.PI * 2;
    const d = 0.14 + rnd() * 0.9;
    const c = WARM[Math.floor(rnd() * WARM.length)];
    push(HERO.x + Math.cos(a) * d, 0.06 + Math.floor(rnd() * 6) * 0.13, HERO.z + Math.sin(a) * d * 0.6 - 0.15, c, 1.6 + rnd(), 0.05, 0.85 + rnd() * 1.3);
  }

  return {
    positions: new Float32Array(pos),
    colors: new Float32Array(col),
    sizes: new Float32Array(size),
    onAt: new Float32Array(on),
    seeds: new Float32Array(seed),
    count: pos.length / 3,
  };
};
