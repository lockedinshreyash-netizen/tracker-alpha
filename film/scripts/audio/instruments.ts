/**
 * The instruments. Every one exists because something in the data needs a
 * voice; see render-score.ts for which.
 */
import { midiToHz } from '../../src/score/harmony';
import { Biquad, SR, SVF, TAU, sawSample, secs, softClip, white } from './dsp';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const t60k = (t60: number) => Math.exp(Math.log(0.001) / (t60 * SR));

/** A decaying sine via rotating phasor, added into `out`. */
const partial = (out: Float32Array, f: number, amp: number, t60: number, delay = 0, attack = 0.0006) => {
  if (f >= SR * 0.45 || amp <= 0) return;
  const w = (TAU * f) / SR;
  const c = Math.cos(w);
  const s = Math.sin(w);
  let x = 1;
  let y = 0;
  let a = amp;
  const k = t60k(t60);
  const atk = Math.max(1, Math.round(attack * SR));
  const o = Math.round(delay * SR);
  for (let i = 0; i + o < out.length; i++) {
    const nx = x * c - y * s;
    y = x * s + y * c;
    x = nx;
    const ramp = i < atk ? i / atk : 1;
    out[i + o] += y * a * ramp;
    a *= k;
    if (a < 1e-6) break;
  }
};

/* ── The tine ──────────────────────────────────────────────────────
   A music-box tine is a clamped bar, not a string, so its overtones are
   not harmonic: the second mode sits near 5.9× the fundamental and the third
   near 17×. That inharmonic shimmer is what makes it read as metal. */
export interface TineOpts {
  midi: number;
  vel: number;
  bright: number;
  grit: number;
  muted: boolean;
  /** Sub-thump under the pluck, for the moments one note has to fill a room. */
  weight: number;
  /** Damping. A lone note rings out; inside a groove the tines are stopped short. */
  decayScale?: number;
}

export const tine = (o: TineOpts): Float32Array => {
  const f = midiToHz(o.midi);
  const decay = (o.muted ? 0.45 : clamp(3.8 - (o.midi - 60) * 0.07, 1.1, 3.8)) * (o.decayScale ?? 1);
  const out = secs(decay + 0.15);
  const v = Math.pow(o.vel, 1.25) * (o.muted ? 0.5 : 1);
  const b = o.muted ? o.bright * 0.25 : o.bright;

  partial(out, f, v, decay);
  partial(out, f * 2.0, v * 0.05 * (0.4 + b), decay * 0.3);
  partial(out, f * 5.93, v * (0.12 + 0.3 * b), o.muted ? 0.06 : 0.32);
  partial(out, f * 16.7, v * 0.05 * b, 0.07);
  // Distraction: a second, slightly wrong fundamental. It beats against the
  // first — a note that is not quite clean.
  if (o.grit > 0.05) {
    partial(out, f * (1 + 0.012 * o.grit), v * 0.55 * o.grit, decay * 0.7);
    partial(out, f * 3.01, v * 0.12 * o.grit, 0.25);
  }
  // The comb's body: a short wooden thunk.
  partial(out, 410, v * 0.1, 0.05);
  if (o.weight > 0) partial(out, clamp(f / 4, 42, 92), v * 0.55 * o.weight, 0.22, 0, 0.002);

  // Pin strike.
  const strike = new Biquad('bp', clamp(f * 7, 2500, 9000), 1.4);
  const sn = Math.round(0.006 * SR);
  for (let i = 0; i < sn; i++) out[i] += strike.tick(white()) * v * (0.35 + 0.4 * b) * Math.exp(-i / (0.0012 * SR));
  return out;
};

/* ── Engine ──────────────────────────────────────────────────────
   The bass is the engine. It fires once per day, and it only runs while a
   streak does. */
export interface EngineStep {
  t: number;
  dur: number;
  midi: number;
  gear: number;
  upshift: boolean;
  /** Second gear-five bounce: the offbeat jumps an octave. */
  octave: boolean;
}

export const renderEngine = (steps: EngineStep[], length: number): Float32Array => {
  const out = new Float32Array(length);
  let phase = 0;
  let sub = 0;
  let f = 0;
  let lastEnd = -1;
  const lp = new Biquad('lp', 950, 0.8);
  steps.forEach((st, idx) => {
    const start = Math.round(st.t * SR);
    const n = Math.round(st.dur * SR);
    const contiguous = Math.abs(start - lastEnd) < 4;
    const target = midiToHz(st.midi) * (st.octave ? 2 : 1);
    if (!contiguous || f === 0) f = target;
    const tauPulse = st.gear >= 4 ? 0.05 : 0.08;
    const level = [0, 0.32, 0.45, 0.55, 0.7, 0.82, 0.95][st.gear] ?? 0.95;
    const next = steps[idx + 1];
    const ends = !next || Math.abs(Math.round(next.t * SR) - (start + n)) > 4;
    const total = ends ? n + Math.round(0.25 * SR) : n;
    for (let i = 0; i < total && start + i < length; i++) {
      const t = i / SR;
      f += (target - f) * (1 - Math.exp(-1 / (0.03 * SR)));
      const dip = st.upshift ? Math.pow(2, (-5 / 12) * Math.exp(-t / 0.07)) : 1;
      const ff = f * dip;
      phase += ff / SR;
      sub += (ff * 0.5) / SR;
      phase -= Math.floor(phase);
      sub -= Math.floor(sub);
      const sp = Math.sin(TAU * phase);
      const pulse = 0.5 + 0.5 * Math.exp(-t / tauPulse);
      const release = i >= n ? Math.exp(-(i - n) / (0.06 * SR)) : 1;
      const attack = !contiguous && i < 0.004 * SR ? i / (0.004 * SR) : 1;
      const sig = 0.6 * sp + 0.22 * Math.sin(TAU * sub) + 0.32 * Math.tanh(2.6 * sp);
      out[start + i] += lp.tick(sig) * pulse * level * release * attack;
    }
    lastEnd = start + n;
  });
  return out;
};

/* ── Drums ───────────────────────────────────────────────────────── */

export const kick = (vel: number, drive = 1.6): Float32Array => {
  const out = secs(0.5);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const f = 44 + 125 * Math.exp(-t / 0.026);
    ph += f / SR;
    const amp = Math.exp(-t / 0.24) * Math.min(1, i / 40);
    const click = white() * Math.exp(-t / 0.0014) * 0.35;
    out[i] = softClip((Math.sin(TAU * ph) * amp + click) * 1.1, drive) * vel;
  }
  return out;
};

const METAL = [263, 400, 421, 474, 587, 845].map(x => x * 2.7);
export const hat = (vel: number, open: boolean): Float32Array => {
  const out = secs(open ? 0.3 : 0.08);
  const h1 = new Biquad('hp', 7200, 0.7);
  const h2 = new Biquad('hp', 7200, 0.7);
  const tau = open ? 0.075 : 0.017;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let m = 0;
    for (const f of METAL) m += Math.sin(TAU * f * t) > 0 ? 1 : -1;
    const x = white() * 0.7 + m * 0.05;
    out[i] = h2.tick(h1.tick(x)) * Math.exp(-t / tau) * vel;
  }
  return out;
};

export const clap = (vel: number): Float32Array => {
  const out = secs(0.35);
  const bp = new Biquad('bp', 1450, 1.1);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    let env = 0;
    for (const o of [0, 0.009, 0.018]) if (t >= o) env += Math.exp(-(t - o) / 0.004);
    if (t > 0.022) env += 0.9 * Math.exp(-(t - 0.022) / 0.1);
    out[i] = bp.tick(white()) * env * vel * 1.4 + Math.sin(TAU * 190 * t) * Math.exp(-t / 0.03) * 0.25 * vel;
  }
  return out;
};

/** The escapement. One per day, studied or not — time passes either way. */
export const tick = (vel: number): Float32Array => {
  const out = secs(0.06);
  partial(out, 3150, vel * 0.5, 0.025);
  partial(out, 5230, vel * 0.3, 0.012);
  const bp = new Biquad('bp', 4000, 2);
  for (let i = 0; i < 96; i++) out[i] += bp.tick(white()) * vel * 0.6 * Math.exp(-i / 18);
  return out;
};

/** A gear engaging. */
export const clunk = (vel: number): Float32Array => {
  const out = secs(0.25);
  partial(out, 82, vel * 0.9, 0.12, 0, 0.002);
  const bp = new Biquad('bp', 1700, 1.5);
  for (const o of [0, 0.021]) {
    const s = Math.round(o * SR);
    for (let i = 0; i < 400; i++) out[s + i] += bp.tick(white()) * vel * 0.7 * Math.exp(-i / 60);
  }
  return out;
};

/** The ratchet letting go after a stall. */
export const clatter = (vel: number): Float32Array => {
  const out = secs(1.4);
  let t = 0;
  let gap = 0.026;
  let a = vel;
  const bp = new Biquad('bp', 2300, 3);
  for (let k = 0; k < 10; k++) {
    const s = Math.round(t * SR);
    for (let i = 0; i < 500 && s + i < out.length; i++) out[s + i] += bp.tick(white()) * a * Math.exp(-i / 70);
    partial(out, 1180 - k * 40, a * 0.15, 0.03, t);
    t += gap;
    gap *= 1.17;
    a *= 0.8;
  }
  return out;
};

/** Winding the key: clicks accelerating, a whir rising under them. */
export const windup = (dur: number, vel: number): Float32Array => {
  const out = secs(dur);
  const bp = new Biquad('bp', 1600, 3);
  const whirF = new SVF();
  let t = 0;
  let k = 0;
  while (t < dur) {
    const p = t / dur;
    const s = Math.round(t * SR);
    bp.set('bp', 1500 + 2600 * p, 3);
    for (let i = 0; i < 420 && s + i < out.length; i++) out[s + i] += bp.tick(white()) * vel * (0.45 + 0.55 * p) * Math.exp(-i / 50);
    t += 1 / (6 + 30 * p * p);
    k++;
  }
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const p = i / out.length;
    const f = 140 + 760 * p * p;
    ph += f / SR;
    ph -= Math.floor(ph);
    out[i] += whirF.tick(sawSample(ph, f / SR), 600 + 2400 * p, 0.4) * vel * 0.18 * p * p;
  }
  return out;
};

export const impact = (vel: number): Float32Array => {
  const out = secs(3);
  let ph = 0;
  const lp = new Biquad('lp', 380, 0.7);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const f = 27 + 34 * Math.exp(-t / 0.25);
    ph += f / SR;
    const body = Math.sin(TAU * ph) * Math.exp(-t / 0.95) * Math.min(1, i / 60);
    const boom = lp.tick(white()) * Math.exp(-t / 0.2) * 1.4;
    out[i] = softClip(body * 1.2 + boom, 1.3) * vel;
  }
  return out;
};

/** Passing through the ghost: a Doppler sweep, high before, low after. */
export const whoosh = (dur: number, centre: number, vel: number): [Float32Array, Float32Array] => {
  const l = secs(dur);
  const r = secs(dur);
  const bpL = new Biquad('bp', 3000, 1.2);
  const bpR = new Biquad('bp', 3000, 1.2);
  for (let i = 0; i < l.length; i++) {
    const t = i / SR;
    const x = (t - centre) / 0.09;
    const fc = 650 + 6200 / (1 + Math.exp(x));
    if (i % 32 === 0) {
      bpL.set('bp', fc, 1.3);
      bpR.set('bp', fc * 1.04, 1.3);
    }
    const env = Math.exp(-Math.pow((t - centre) / (dur * 0.28), 2));
    const panT = 1 / (1 + Math.exp(-x * 0.6));
    const n = white();
    l[i] = bpL.tick(n) * env * vel * (1.2 - panT * 0.8);
    r[i] = bpR.tick(n) * env * vel * (0.4 + panT * 0.8);
  }
  return [l, r];
};

/** An FM bell. Rewards only. */
export const chime = (midi: number, vel: number): Float32Array => {
  const out = secs(4);
  const f = midiToHz(midi);
  let pc = 0;
  let pm = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const idx = 0.6 + 3.2 * Math.exp(-t / 0.18);
    pm += (f * 3.5) / SR;
    pc += f / SR;
    out[i] = Math.sin(TAU * pc + idx * Math.sin(TAU * pm)) * Math.exp(-t / 1.5) * Math.min(1, i / 30) * vel;
  }
  return out;
};

/** Slow high cluster: the aurora arriving. */
export const shimmer = (midis: number[], dur: number, vel: number): [Float32Array, Float32Array] => {
  const l = secs(dur);
  const r = secs(dur);
  midis.forEach((m, k) => {
    const f = midiToHz(m);
    const pan = (k / Math.max(1, midis.length - 1)) * 2 - 1;
    for (let i = 0; i < l.length; i++) {
      const t = i / SR;
      const env = Math.min(1, t / 1.1) * Math.min(1, (dur - t) / 1.6);
      const v = Math.sin(TAU * f * t + 0.004 * Math.sin(TAU * 5.1 * t + k)) * env * vel;
      l[i] += v * (1 - pan) * 0.5;
      r[i] += v * (1 + pan) * 0.5;
    }
  });
  return [l, r];
};

export const riser = (dur: number, vel: number): Float32Array => {
  const out = secs(dur);
  const bp = new Biquad('bp', 400, 1.6);
  for (let i = 0; i < out.length; i++) {
    const p = i / out.length;
    if (i % 32 === 0) bp.set('bp', 400 * Math.pow(20, p), 1.6);
    out[i] = bp.tick(white()) * p * p * vel;
  }
  return out;
};

/** Shepard tone: an ascent that never arrives. */
export const shepard = (dur: number, vel: number): Float32Array => {
  const out = secs(dur);
  const comps = 8;
  const phases = new Float64Array(comps);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const p = t / dur;
    const climb = 0.9 * t + 0.35 * t * p; // octaves risen
    let s = 0;
    for (let k = 0; k < comps; k++) {
      const oct = (((k + climb) % comps) + comps) % comps;
      const f = 55 * Math.pow(2, oct);
      const g = Math.exp(-Math.pow((oct - 3.6) / 1.4, 2));
      phases[k] += f / SR;
      s += Math.sin(TAU * phases[k]) * g;
    }
    out[i] = s * 0.3 * vel * Math.min(1, p * 1.6) * (0.5 + 0.5 * p);
  }
  return out;
};

/** Machine on, nothing happening. */
export const idle = (dur: number, vel: number): Float32Array => {
  const out = secs(dur);
  const lp = new Biquad('lp', 110, 0.7);
  let brown = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    brown = brown * 0.985 + white() * 0.15;
    out[i] = (lp.tick(brown) * 2.2 + Math.sin(TAU * 36.7 * t) * 0.35) * vel * (0.75 + 0.25 * Math.sin(TAU * 0.4 * t));
  }
  return out;
};

/** Radio squelch: something the student wrote, coming through. */
export const squelch = (vel: number): Float32Array => {
  const out = secs(0.18);
  const bp = new Biquad('bp', 2100, 2.5);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = (bp.tick(white()) * Math.exp(-t / 0.03) + Math.sin(TAU * 1240 * t) * 0.25 * (t < 0.05 ? 1 : 0)) * vel;
  }
  return out;
};

export const pageTurn = (vel: number): Float32Array => {
  const out = secs(0.4);
  const bp = new Biquad('bp', 3800, 0.9);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const env = Math.sin(Math.PI * Math.min(1, t / 0.32)) * (0.6 + 0.4 * Math.sin(TAU * 31 * t));
    out[i] = bp.tick(white()) * env * vel;
  }
  return out;
};

/* ── Sustained voices ────────────────────────────────────────────── */

/** A chord, held: detuned band-limited saws through a lowpass. */
export const chordVoice = (
  midis: number[],
  dur: number,
  opts: { attack: number; release: number; cutoff: number; detune: number[]; vibrato?: number; seed: number },
): [Float32Array, Float32Array] => {
  const total = dur + opts.release;
  const l = secs(total);
  const r = secs(total);
  const nv = midis.length * opts.detune.length;
  const g = 1 / Math.sqrt(nv);
  midis.forEach((m, vi) => {
    opts.detune.forEach((cents, di) => {
      const f0 = midiToHz(m) * Math.pow(2, cents / 1200);
      let ph = ((opts.seed * 0.618 + vi * 0.37 + di * 0.21) % 1 + 1) % 1;
      const svf = new SVF();
      const pan = ((vi + di * 0.5) / Math.max(1, nv / 2)) % 2 - 1;
      const gl = Math.cos(((pan * 0.7 + 1) * Math.PI) / 4) * Math.SQRT2;
      const gr = Math.sin(((pan * 0.7 + 1) * Math.PI) / 4) * Math.SQRT2;
      for (let i = 0; i < l.length; i++) {
        const t = i / SR;
        const vib = opts.vibrato ? 1 + opts.vibrato * Math.min(1, t / 0.6) * Math.sin(TAU * (5.1 + vi * 0.13) * t + di) : 1;
        const f = f0 * vib;
        ph += f / SR;
        ph -= Math.floor(ph);
        const env = Math.min(1, t / opts.attack) * (t > dur ? Math.exp(-(t - dur) / (opts.release / 4)) : 1);
        const x = svf.tick(sawSample(ph, f / SR), opts.cutoff, 0.7) * env * g;
        l[i] += x * gl;
        r[i] += x * gr;
      }
    });
  });
  return [l, r];
};

/** The melody of mock scores: one continuous voice gliding between results. */
export interface LeadPoint {
  t: number;
  midi: number;
  accent: boolean;
}

export const renderLead = (points: LeadPoint[], levelAt: (t: number) => number, length: number): Float32Array => {
  const out = new Float32Array(length);
  if (!points.length) return out;
  let pi = 0;
  let f = midiToHz(points[0].midi);
  let p1 = 0;
  let p2 = 0.33;
  let p3 = 0;
  let accent = 0;
  let lastChange = points[0].t;
  let level = 0;
  const svf = new SVF();
  const start = Math.round(points[0].t * SR);
  for (let i = start; i < length; i++) {
    const t = i / SR;
    while (pi + 1 < points.length && points[pi + 1].t <= t) {
      pi++;
      lastChange = points[pi].t;
      if (points[pi].accent) accent = 1;
    }
    if (i === start) accent = 1;
    const target = midiToHz(points[pi].midi);
    f += (target - f) * (1 - Math.exp(-1 / (0.06 * SR)));
    const since = t - lastChange;
    const vib = 1 + 0.006 * Math.min(1, Math.max(0, since - 0.25) / 0.5) * Math.sin(TAU * 5.4 * t);
    const ff = f * vib;
    p1 += (ff * 1.003) / SR;
    p2 += (ff * 0.997) / SR;
    p3 += (ff * 0.5) / SR;
    p1 -= Math.floor(p1);
    p2 -= Math.floor(p2);
    p3 -= Math.floor(p3);
    accent *= Math.exp(-1 / (0.45 * SR));
    level += (levelAt(t) - level) * (1 - Math.exp(-1 / (0.12 * SR)));
    const raw = sawSample(p1, ff / SR) + sawSample(p2, ff / SR) + (p3 < 0.5 ? 0.4 : -0.4);
    const y = svf.tick(raw, 900 + 2600 * accent + 900 * level, 0.5);
    out[i] = softClip(y * 0.5, 1.2) * level * (0.55 + 0.45 * accent);
  }
  return out;
};

/** The wrong note: open errors, held high and quiet above everything. */
export const renderTension = (rootAt: (t: number) => number, amountAt: (t: number) => number, from: number, to: number, length: number): Float32Array => {
  const out = new Float32Array(length);
  let p1 = 0;
  let p2 = 0;
  let amt = 0;
  for (let i = Math.round(from * SR); i < Math.min(length, Math.round(to * SR)); i++) {
    const t = i / SR;
    const f = midiToHz(rootAt(t));
    p1 += f / SR;
    p2 += (f + 0.8) / SR;
    p1 -= Math.floor(p1);
    p2 -= Math.floor(p2);
    amt += (amountAt(t) - amt) * (1 - Math.exp(-1 / (0.5 * SR)));
    out[i] = (Math.sin(TAU * p1) + Math.sin(TAU * p2)) * 0.5 * amt;
  }
  return out;
};

/** Varispeed slow-down: what a stalled run sounds like. In place on [from, from+outDur]. */
export const tapeStop = (src: { L: Float32Array; R: Float32Array }, extra: { L: Float32Array; R: Float32Array }, from: number, outDur: number) => {
  const s0 = Math.round(from * SR);
  const n = Math.round(outDur * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  let pos = 0;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const rate = Math.pow(1 - p, 1.7);
    const j = Math.floor(pos);
    const fr = pos - j;
    const a = s0 + j;
    const get = (arr: Float32Array, ex: Float32Array, k: number) => (arr[k] ?? 0) + (ex[k] ?? 0);
    const l = get(src.L, extra.L, a) * (1 - fr) + get(src.L, extra.L, a + 1) * fr;
    const r = get(src.R, extra.R, a) * (1 - fr) + get(src.R, extra.R, a + 1) * fr;
    const fade = p > 0.85 ? (1 - p) / 0.15 : 1;
    L[i] = l * fade;
    R[i] = r * fade;
    pos += rate;
  }
  src.L.set(L, s0);
  src.R.set(R, s0);
};
