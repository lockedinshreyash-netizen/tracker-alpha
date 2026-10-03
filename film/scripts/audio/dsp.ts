/**
 * Offline DSP. Plain typed arrays, no dependencies, deterministic.
 * Everything here runs in Node once per score render; none of it ships in
 * the Remotion bundle.
 */
import { mulberry32 } from '../../src/score/random';

export const SR = 48000;
export const TAU = Math.PI * 2;

export class Bus {
  L: Float32Array;
  R: Float32Array;
  constructor(public length: number) {
    this.L = new Float32Array(length);
    this.R = new Float32Array(length);
  }
  /** Mix a mono signal in at `at` seconds, equal-power panned (-1..1). */
  addMono(sig: Float32Array, at: number, gain = 1, pan = 0) {
    const o = Math.round(at * SR);
    const a = ((pan + 1) * Math.PI) / 4;
    const gl = Math.cos(a) * gain * Math.SQRT2;
    const gr = Math.sin(a) * gain * Math.SQRT2;
    const n = Math.min(sig.length, this.length - o);
    for (let i = Math.max(0, -o); i < n; i++) {
      this.L[o + i] += sig[i] * gl;
      this.R[o + i] += sig[i] * gr;
    }
  }
  addStereo(l: Float32Array, r: Float32Array, at: number, gain = 1) {
    const o = Math.round(at * SR);
    const n = Math.min(l.length, this.length - o);
    for (let i = Math.max(0, -o); i < n; i++) {
      this.L[o + i] += l[i] * gain;
      this.R[o + i] += r[i] * gain;
    }
  }
  addBus(b: Bus, gain = 1) {
    for (let i = 0; i < this.length; i++) {
      this.L[i] += b.L[i] * gain;
      this.R[i] += b.R[i] * gain;
    }
  }
  zero(from: number, to: number) {
    const a = Math.max(0, Math.round(from * SR));
    const b = Math.min(this.length, Math.round(to * SR));
    this.L.fill(0, a, b);
    this.R.fill(0, a, b);
  }
}

export const secs = (s: number) => new Float32Array(Math.max(1, Math.round(s * SR)));

/* ── Noise ─────────────────────────────────────────────────────── */

const noiseRnd = mulberry32(777);
export const white = (): number => noiseRnd() * 2 - 1;

/* ── Filters ───────────────────────────────────────────────────── */

/** RBJ biquad, processed in place. */
export class Biquad {
  b0 = 1; b1 = 0; b2 = 0; a1 = 0; a2 = 0;
  z1 = 0; z2 = 0;
  constructor(type: 'lp' | 'hp' | 'bp' | 'peak', f: number, q = 0.707, gainDb = 0) {
    this.set(type, f, q, gainDb);
  }
  set(type: 'lp' | 'hp' | 'bp' | 'peak', f: number, q = 0.707, gainDb = 0) {
    const w = (TAU * Math.min(f, SR * 0.45)) / SR;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    const alpha = sw / (2 * q);
    let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
    if (type === 'lp') {
      b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
    } else if (type === 'hp') {
      b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
    } else if (type === 'bp') {
      b0 = alpha; b1 = 0; b2 = -alpha;
      a0 = 1 + alpha; a1 = -2 * cw; a2 = 1 - alpha;
    } else {
      const A = Math.pow(10, gainDb / 40);
      b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A;
      a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0;
    this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  tick(x: number): number {
    const y = this.b0 * x + this.z1;
    this.z1 = this.b1 * x - this.a1 * y + this.z2;
    this.z2 = this.b2 * x - this.a2 * y;
    return y;
  }
  run(buf: Float32Array) {
    for (let i = 0; i < buf.length; i++) buf[i] = this.tick(buf[i]);
    return buf;
  }
}

/** Chamberlin state-variable lowpass, cheap enough to modulate per sample. */
export class SVF {
  low = 0; band = 0;
  tick(x: number, f: number, q = 0.6): number {
    const fc = 2 * Math.sin((Math.PI * Math.min(f, SR / 6)) / SR);
    this.low += fc * this.band;
    const high = x - this.low - q * this.band;
    this.band += fc * high;
    return this.low;
  }
}

/* ── Oscillators ───────────────────────────────────────────────── */

/** PolyBLEP correction for band-limited saws and squares. */
const blep = (t: number, dt: number): number => {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
};

export const sawSample = (phase: number, dt: number): number => 2 * phase - 1 - blep(phase, dt);

/* ── Dynamics ──────────────────────────────────────────────────── */

export const softClip = (x: number, drive = 1): number => Math.tanh(x * drive) / Math.tanh(drive);

/** Feed-forward RMS-ish compressor on a stereo bus, in place. */
export const compress = (b: Bus, thresholdDb: number, ratio: number, attack = 0.01, release = 0.15, makeupDb = 0) => {
  const th = Math.pow(10, thresholdDb / 20);
  const ga = Math.exp(-1 / (attack * SR));
  const gr = Math.exp(-1 / (release * SR));
  const mk = Math.pow(10, makeupDb / 20);
  let env = 0;
  for (let i = 0; i < b.length; i++) {
    const x = Math.max(Math.abs(b.L[i]), Math.abs(b.R[i]));
    env = x > env ? ga * env + (1 - ga) * x : gr * env + (1 - gr) * x;
    let g = 1;
    if (env > th) g = Math.pow(env / th, 1 / ratio - 1);
    b.L[i] *= g * mk;
    b.R[i] *= g * mk;
  }
};

/** Lookahead peak limiter. */
export const limit = (b: Bus, ceilingDb = -1, lookahead = 0.003, release = 0.08) => {
  const ceil = Math.pow(10, ceilingDb / 20);
  const la = Math.round(lookahead * SR);
  const rel = Math.exp(-1 / (release * SR));
  const n = b.length;
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = Math.max(Math.abs(b.L[i]), Math.abs(b.R[i]));
    need[i] = p > ceil ? ceil / p : 1;
  }
  // Minimum over the lookahead window, then smooth release.
  let g = 1;
  for (let i = 0; i < n; i++) {
    let m = 1;
    for (let k = 0; k <= la && i + k < n; k++) if (need[i + k] < m) m = need[i + k];
    g = m < g ? m : rel * g + (1 - rel) * m;
    b.L[i] *= g;
    b.R[i] *= g;
  }
};

/* ── Reverb (Freeverb) ─────────────────────────────────────────── */

class Comb {
  buf: Float32Array; i = 0; store = 0;
  constructor(size: number, public feedback: number, public damp: number) {
    this.buf = new Float32Array(size);
  }
  tick(x: number) {
    const y = this.buf[this.i];
    this.store = y * (1 - this.damp) + this.store * this.damp;
    this.buf[this.i] = x + this.store * this.feedback;
    if (++this.i >= this.buf.length) this.i = 0;
    return y;
  }
}
class Allpass {
  buf: Float32Array; i = 0;
  constructor(size: number) {
    this.buf = new Float32Array(size);
  }
  tick(x: number) {
    const b = this.buf[this.i];
    const y = -x + b;
    this.buf[this.i] = x + b * 0.5;
    if (++this.i >= this.buf.length) this.i = 0;
    return y;
  }
}

export const reverb = (input: Bus, room = 0.88, damp = 0.35, width = 1): Bus => {
  const scale = SR / 44100;
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
  const aps = [556, 441, 341, 225];
  const spread = 23;
  const fb = room * 0.28 + 0.7;
  const cl = combs.map(c => new Comb(Math.round(c * scale), fb, damp));
  const cr = combs.map(c => new Comb(Math.round((c + spread) * scale), fb, damp));
  const al = aps.map(a => new Allpass(Math.round(a * scale)));
  const ar = aps.map(a => new Allpass(Math.round((a + spread) * scale)));
  const out = new Bus(input.length);
  const pre = new Biquad('hp', 180);
  for (let i = 0; i < input.length; i++) {
    const x = pre.tick((input.L[i] + input.R[i]) * 0.015);
    let l = 0;
    let r = 0;
    for (let k = 0; k < 8; k++) {
      l += cl[k].tick(x);
      r += cr[k].tick(x);
    }
    for (let k = 0; k < 4; k++) {
      l = al[k].tick(l);
      r = ar[k].tick(r);
    }
    const w1 = (width + 1) / 2;
    const w2 = (1 - width) / 2;
    out.L[i] = l * w1 + r * w2;
    out.R[i] = r * w1 + l * w2;
  }
  return out;
};

/* ── WAV ───────────────────────────────────────────────────────── */

export const encodeWav16 = (b: Bus): Buffer => {
  const n = b.length;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 4, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 4, 40);
  const rnd = mulberry32(99);
  for (let i = 0; i < n; i++) {
    // TPDF dither.
    const d = (rnd() - rnd()) / 32768;
    const l = Math.max(-1, Math.min(1, b.L[i] + d));
    const r = Math.max(-1, Math.min(1, b.R[i] + d));
    buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4);
  }
  return buf;
};
