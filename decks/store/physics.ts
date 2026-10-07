/* ── The rack has mass ──
   Pure arithmetic for PackRack, React-free and tested (decks/tests/store.test.ts).

   The rack is one object. A drag moves it with the finger. Pulling past an
   end meets resistance (`rubber`). Letting go hands the finger's velocity to
   the rack, which glides and slows under friction. It settles with a hook at
   the left margin, so it never stops with a pack cut in half.

   The glide is an exponential decay with time constant TAU, the curve iOS
   scrolling uses. Its distance is v × TAU, so a fast swipe travels far and a
   slow drag barely carries on. That landing point is rounded to the nearest
   hook, and the decay is re-timed to land on it exactly. So the rack slows into
   place rather than stopping and then snapping. Anything a glide cannot
   express exactly falls back to a critically damped spring: no bounce, nothing
   wobbles. That covers a release with no speed, and a rounded point that sits
   behind the direction of travel.

   The ends are firm, like a rail meeting its end bracket. Pulling past one
   gives at most MAX_OVER pixels, whatever the screen size. A throw that
   would run off the end glides until it reaches the end (`edgeHit`), then
   takes one short, stiff bump: its speed is capped at EDGE_SPEED, which is
   about 13px of overshoot, settled in under 200ms. Letting go past an end
   springs back on the same stiff spring. The first version used the screen
   width for the give and a soft spring for the return. A fast flick then
   carried the rack about 60px past the end and drifted back over a third of
   a second, which read as loose rather than heavy.

   Packs hang, so they sway. Each one is a damped pendulum driven by the rack's
   acceleration: the rack speeds up left and the pack's foot lags right, then
   settles. The gain and the cap keep it to two or three degrees. It should be
   felt rather than noticed. */

export interface Bounds {
  /** Most negative offset: the last hook in view. */
  min: number;
  /** Zero: the first hook at the margin. */
  max: number;
}

/** Glide time constant, ms. Distance travelled after release = v × TAU. */
export const TAU = 325;
/** Faster than this and a flick is a throw; the cap keeps a wild one sane (px/ms). */
export const MAX_SPEED = 2.6;
/** Below this a release is a placement, not a throw (px/ms). */
export const MIN_THROW = 0.08;

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** The most the rack can be pulled past an end, px. */
export const MAX_OVER = 64;
/** The fastest the rack may arrive at an end; what it has left becomes a short bump (px/ms). */
export const EDGE_SPEED = 0.8;

/** Past an end, the rack follows less and less, and never more than MAX_OVER. */
export const rubber = (x: number, b: Bounds): number => {
  if (x > b.max) return b.max + MAX_OVER * (1 - 1 / (((x - b.max) * 0.5) / MAX_OVER + 1));
  if (x < b.min) return b.min - MAX_OVER * (1 - 1 / (((b.min - x) * 0.5) / MAX_OVER + 1));
  return x;
};

/** The resting offset nearest x: a hook at the margin, within the ends. */
export const snap = (x: number, spacing: number, b: Bounds): number =>
  clamp(spacing > 0 ? Math.round(x / spacing) * spacing : x, b.min, b.max);

export interface Sample { t: number; x: number }

/**
 * The finger's speed at release, from the last ~90ms of movement. A finger
 * that stopped and then lifted throws nothing.
 */
export const releaseVelocity = (samples: Sample[], now: number): number => {
  const last = samples[samples.length - 1];
  if (!last || now - last.t > 60) return 0;
  const recent = samples.filter(s => last.t - s.t <= 90);
  const first = recent[0];
  const dt = last.t - first.t;
  if (dt < 12) return 0;
  return clamp((last.x - first.x) / dt, -MAX_SPEED, MAX_SPEED);
};

export type Motion =
  | { kind: 'glide'; from: number; to: number; tau: number; t0: number }
  | { kind: 'spring'; to: number; v: number; stiff?: boolean };

/** The rack reaches an end at speed v: one stiff, short bump, never a long overshoot. */
export const edgeHit = (b: Bounds, v: number): Motion => ({
  kind: 'spring',
  to: v > 0 ? b.max : b.min,
  v: clamp(v, -EDGE_SPEED, EDGE_SPEED),
  stiff: true,
});

/** What the rack does once it is let go. */
export const planRelease = (x: number, v: number, spacing: number, b: Bounds, now: number): Motion => {
  if (x > b.max || x < b.min) {
    // Back from past the end, firmly. A fling further out is not honoured.
    const outward = x > b.max ? v > 0 : v < 0;
    return { kind: 'spring', to: clamp(x, b.min, b.max), v: outward ? 0 : v, stiff: true };
  }
  if (Math.abs(v) < MIN_THROW) return { kind: 'spring', to: snap(x, spacing, b), v };
  const raw = x + v * TAU;
  // Heading off the end: glide naturally until the end is reached, then bump
  // (the loop switches to `edgeHit` at the moment of contact).
  if (raw > b.max || raw < b.min) return { kind: 'glide', from: x, to: raw, tau: TAU, t0: now };
  const to = snap(raw, spacing, b);
  const dist = to - x;
  if (dist === 0 || Math.sign(dist) !== Math.sign(v)) return { kind: 'spring', to, v };
  const tau = dist / v;
  // Too short is a wall, too long a crawl: let the spring take those.
  if (tau < 120 || tau > 700) return { kind: 'spring', to, v };
  return { kind: 'glide', from: x, to, tau, t0: now };
};

export const glideAt = (m: { from: number; to: number; tau: number; t0: number }, now: number): number =>
  m.to - (m.to - m.from) * Math.exp(-(now - m.t0) / m.tau);

/** Critically damped: arrives, does not bounce. ω ≈ 0.0126/ms, settled in ~320ms. */
const K = 0.00016;
const C = 2 * Math.sqrt(K);
/** The end bracket: also critically damped, about 1.8× quicker. ω ≈ 0.0224/ms. */
const K_EDGE = 0.0005;
const C_EDGE = 2 * Math.sqrt(K_EDGE);

export const springStep = (x: number, v: number, to: number, dt: number, stiff = false): { x: number; v: number } => {
  const a = -(stiff ? K_EDGE : K) * (x - to) - (stiff ? C_EDGE : C) * v;
  const nv = v + a * dt;
  return { x: x + nv * dt, v: nv };
};

export const atRest = (x: number, v: number, to: number) => Math.abs(x - to) < 0.3 && Math.abs(v) < 0.004;

/* ── Sway ── */

export const SWAY = {
  /** A ~0.9s pendulum. */
  omega: (2 * Math.PI) / 900,
  /** Under-damped just enough to settle with one small, soft return. */
  zeta: 0.28,
  /** Radians of lean per px/ms² of rack acceleration, at rest. */
  gain: 4.3e-4,
  /** About 3.4°: hanging, not swinging. */
  max: 0.06,
};

/**
 * One pendulum step. θ'' = −ω²θ − 2ζωθ' + a·gain. A positive CSS rotation
 * swings the foot left, so a rack accelerating left (a < 0) leans the foot right.
 */
export const swayStep = (theta: number, w: number, accel: number, dt: number, omega = SWAY.omega): { theta: number; w: number } => {
  const a = -omega * omega * theta - 2 * SWAY.zeta * omega * w + accel * SWAY.gain;
  const nw = w + a * dt;
  return { theta: clamp(theta + nw * dt, -SWAY.max, SWAY.max), w: nw };
};

/** A finger's acceleration is noise at frame scale; this is what a hanging object feels. */
export const smoothAccel = (prev: number, raw: number, dt: number) => prev + (raw - prev) * (1 - Math.exp(-dt / 70));

/** Packs of slightly different weight sway at slightly different rates. */
export const omegaFor = (i: number) => SWAY.omega * (1 + (((i * 7) % 5) - 2) * 0.035);

export const swaying = (theta: number, w: number) => Math.abs(theta) > 0.0004 || Math.abs(w) > 0.00002;
