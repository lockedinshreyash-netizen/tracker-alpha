/**
 * The app's sound-effect kit: bright and playful, in D major.
 *
 * The film is in D minor and speaks in tines, gears and an engine. The app is
 * the same family in the parallel major: wooden marimba bars, a glockenspiel
 * ding, bubble pops. Same DSP, same determinism (every random choice is
 * seeded), a lighter mood — these fire dozens of times a day, and a sound
 * that is heard that often has to be friendly or it gets muted.
 */
import { midiToHz } from '../../src/score/harmony';
import { mulberry32 } from '../../src/score/random';
import { Biquad, Bus, SR, TAU, secs, white } from './dsp';
import { partial } from './instruments';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

/** D major pentatonic, as pitch classes: D E F♯ A B. Any two notes from it
 *  sit happily together, which is what lets sparkle be random. */
const PENTA = [2, 4, 6, 9, 11];

/* ── Marimba ─────────────────────────────────────────────────────
   A wooden bar whose overtones are tuned: the second mode sits at 4× the
   fundamental and the third near 10×, which is what makes a marimba sound
   round where a xylophone is sharp. A soft rubber mallet, so a few
   milliseconds of dull noise rather than a click. */
export const marimba = (midi: number, vel: number, decayScale = 1): Float32Array => {
  const f = midiToHz(midi);
  const decay = clamp(1.3 - (midi - 60) * 0.035, 0.35, 1.3) * decayScale;
  const out = secs(decay + 0.05);
  partial(out, f, vel, decay, 0, 0.0015);
  partial(out, f * 3.99, vel * 0.22, decay * 0.22, 0, 0.0008);
  partial(out, f * 9.9, vel * 0.05, decay * 0.07, 0, 0.0005);
  // The resonator tube under the bar: a hint of the octave.
  partial(out, f * 2, vel * 0.04, decay * 0.5);
  const lp = new Biquad('lp', clamp(f * 6, 1500, 5000), 0.7);
  const n = Math.round(0.004 * SR);
  for (let i = 0; i < n; i++) out[i] += lp.tick(white()) * vel * 0.25 * Math.exp(-i / (0.0009 * SR));
  return out;
};

/* ── Glockenspiel ────────────────────────────────────────────────
   A free metal bar. Its modes are inharmonic (2.76×, 5.40×, 8.93×), which is
   the shimmer that reads as "ding" rather than "beep". A hard brass mallet:
   a bright click on the strike. */
export const glock = (midi: number, vel: number, decay = 1.8): Float32Array => {
  const f = midiToHz(midi);
  const out = secs(decay + 0.05);
  partial(out, f, vel, decay, 0, 0.0004);
  partial(out, f * 2.76, vel * 0.32, decay * 0.45);
  partial(out, f * 5.4, vel * 0.14, decay * 0.22);
  partial(out, f * 8.93, vel * 0.06, decay * 0.1);
  const bp = new Biquad('bp', clamp(f * 5, 4000, 10000), 1.2);
  const n = Math.round(0.003 * SR);
  for (let i = 0; i < n; i++) out[i] += bp.tick(white()) * vel * 0.3 * Math.exp(-i / (0.0006 * SR));
  return out;
};

/* ── Pop ─────────────────────────────────────────────────────────
   A bubble: a sine whose pitch glides quickly upward as it dies. That rising
   blip is most of what makes a UI sound feel playful. */
export const pop = (vel: number, f0 = 320, f1 = 980, dur = 0.09): Float32Array => {
  const out = secs(dur + 0.02);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const glide = 1 - Math.exp(-t / (dur * 0.25));
    const f = f0 + (f1 - f0) * glide;
    ph += f / SR;
    ph -= Math.floor(ph);
    const env = Math.min(1, t / 0.0015) * Math.exp(-t / (dur * 0.33));
    out[i] = (Math.sin(TAU * ph) + 0.18 * Math.sin(2 * TAU * ph)) * env * vel;
  }
  return out;
};

/* ── Thud ────────────────────────────────────────────────────────
   A soft wooden knock for a wrong answer. It says "no" without scolding:
   low, short, muffled, no buzz. */
export const thud = (vel: number): Float32Array => {
  const out = secs(0.25);
  partial(out, 150, vel * 0.8, 0.14, 0, 0.002);
  partial(out, 236, vel * 0.35, 0.08, 0, 0.002);
  const lp = new Biquad('lp', 900, 0.8);
  const n = Math.round(0.01 * SR);
  for (let i = 0; i < n; i++) out[i] += lp.tick(white()) * vel * 0.5 * Math.exp(-i / (0.002 * SR));
  return out;
};

/* ── Flick ───────────────────────────────────────────────────────
   A card being turned: a short burst of noise sweeping up through a bandpass. */
export const flick = (vel: number): Float32Array => {
  const dur = 0.09;
  const out = secs(dur);
  const bp = new Biquad('bp', 2000, 1.1);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    if (i % 16 === 0) bp.set('bp', 2000 + 5000 * (t / dur), 1.1);
    const env = Math.sin(Math.PI * Math.min(1, t / dur)) * Math.exp(-t / 0.04);
    out[i] = bp.tick(white()) * env * vel;
  }
  return out;
};

/* ── Tear ────────────────────────────────────────────────────────
   Foil and card giving way. Fibres snap as random impulses, denser as the
   tear runs, over a bed of band-limited noise. Seeded, so it is the same
   tear every render. */
export const tear = (dur: number, vel: number, seed = 5): Float32Array => {
  const rnd = mulberry32(seed);
  const out = secs(dur + 0.05);
  const hi = new Biquad('bp', 3200, 0.9);
  const lo = new Biquad('bp', 1100, 0.8);
  const fall = Math.exp(-1 / (0.0025 * SR));
  let grain = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const p = Math.min(1, t / dur);
    if (rnd() < (300 + 1400 * p) / SR) grain = 0.6 + 0.4 * rnd();
    grain *= fall;
    const env = Math.min(1, t / 0.02) * (t < dur ? 1 : Math.exp(-(t - dur) / 0.01));
    const n = white();
    out[i] = (hi.tick(n) * (0.25 + grain) * 0.9 + lo.tick(n) * 0.35 * grain) * env * vel;
  }
  return out;
};

/* ── Sparkle ─────────────────────────────────────────────────────
   Scattered high glock notes from the pentatonic, thinning out as they go,
   panned across the field. Written straight into a bus because it is many
   notes, not one signal. */
export const sparkleInto = (
  bus: Bus,
  send: Bus | null,
  at: number,
  seed: number,
  dur: number,
  vel: number,
  lo = 86,
  hi = 100,
) => {
  const rnd = mulberry32(seed);
  const notes: number[] = [];
  for (let m = lo; m <= hi; m++) if (PENTA.includes(((m % 12) + 12) % 12)) notes.push(m);
  let t = 0;
  while (t < dur) {
    const p = t / dur;
    const m = notes[Math.floor(rnd() * notes.length)];
    const sig = glock(m, vel * (1 - 0.7 * p) * (0.5 + 0.5 * rnd()), 0.5);
    const pan = rnd() * 1.6 - 0.8;
    bus.addMono(sig, at + t, 1, pan);
    send?.addMono(sig, at + t, 0.6, pan);
    t += 0.03 + rnd() * 0.07 * (1 + p);
  }
};
