/**
 * Renders the app's sound effects.
 *
 *   npm run sfx                   → every cue
 *   npm run sfx -- --only=streak  → ids containing "streak"
 *
 * For each id in the app's catalog (sound/cues.ts) this builds the sound from
 * the instruments in audio/, masters it, and writes three things:
 *
 *   film/public/sfx/<id>.wav        the master, for the SoundBoard in Studio
 *   public/sounds/<id>.aac          what the app ships (ADTS AAC via afconvert,
 *                                   the same encoder as the voice clips)
 *   film/src/sfx/board.generated.ts     labels, lengths and waveform peaks
 *
 * The catalog is the single list of ids. A cue in it with no recipe here is
 * an error, not a silent gap — the app would fetch a file that never exists.
 *
 * Levels: every master is normalised to the same −1 dBFS peak. How loud a cue
 * plays next to the others is the catalog's `gain`, tuned in the app, so a
 * level change never needs a re-render.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUES, CUE_IDS, type Cue } from '../../sound/cues';
import { Biquad, Bus, SR, encodeWav16, limit, reverb } from './audio/dsp';
import { clap, clunk, impact, kick, riser as noiseRiser, shepard, shimmer, whoosh } from './audio/instruments';
import { BEATS, ARENA_SECONDS } from '../../onboarding/arena';
import { flick, glock, marimba, pop, sparkleInto, tear, thud } from './audio/sfx-instruments';

const FILM = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(FILM, '..');
const MASTERS = join(FILM, 'public', 'sfx');
const OUT = join(APP, 'public', 'sounds');
const BOARD = join(FILM, 'src', 'sfx', 'board.generated.ts');

const only = process.argv.slice(2).find(a => a.startsWith('--only='))?.split('=')[1];

/* D major, by MIDI number. */
const D3 = 50, F3 = 53, A3 = 57;
const D4 = 62, E4 = 64, Fs4 = 66, A4 = 69, B4 = 71;
const D5 = 74, E5 = 76, Fs5 = 78, A5 = 81, B5 = 83;
const D6 = 86, Fs6 = 90, A6 = 93, D7 = 98;

/** A dry bus and a reverb send, built side by side. */
class Mix {
  dry: Bus;
  send: Bus;
  constructor(len: number) {
    this.dry = new Bus(Math.round(len * SR));
    this.send = new Bus(Math.round(len * SR));
  }
  add(sig: Float32Array, at: number, gain = 1, pan = 0, wet = 0.3) {
    this.dry.addMono(sig, at, gain, pan);
    if (wet > 0) this.send.addMono(sig, at, gain * wet, pan);
  }
  addStereo([l, r]: [Float32Array, Float32Array], at: number, gain = 1, wet = 0.3) {
    this.dry.addStereo(l, r, at, gain);
    if (wet > 0) this.send.addStereo(l, r, at, gain * wet);
  }
  sparkle(at: number, seed: number, dur: number, vel: number) {
    sparkleInto(this.dry, this.send, at, seed, dur, vel);
  }
  /** Notes in a row, `gap` apart. Returns when the last one lands. */
  run(notes: number[], at: number, gap: number, vel: number, instrument = marimba, pan = 0) {
    notes.forEach((m, k) => this.add(instrument(m, vel * (0.85 + (0.15 * k) / Math.max(1, notes.length - 1))), at + k * gap, 1, pan + (k - (notes.length - 1) / 2) * 0.08));
    return at + (notes.length - 1) * gap;
  }
}

interface Recipe {
  len: number;
  /** Freeverb room size. Absent = dry. */
  room?: number;
  /** How much of the reverb return reaches the mix. */
  wet?: number;
  build: (m: Mix) => void;
}

/* Every streak tier is the same gesture — a whoosh up, a pop, a run of
   notes, a bell — and each tier adds notes and layers. A longer streak is
   literally a bigger sound. */
const streakTier = (rise: number, notes: number[], chord: number[], extra: (m: Mix, land: number) => void): Recipe => ({
  len: rise + notes.length * 0.065 + 2.2,
  room: 0.78,
  wet: 0.5,
  build: m => {
    m.add(noiseRiser(rise, 1), 0, 0.32, 0, 0.4);
    m.add(pop(0.7, 220, 900, 0.12), rise, 1, 0, 0.2);
    m.add(marimba(D4, 0.55), rise, 1, 0, 0.2);
    const land = m.run(notes, rise, 0.065, 0.85);
    chord.forEach((n, k) => m.add(glock(n, 0.7 - k * 0.08, 1.8), land + 0.04 + k * 0.025, 1, (k - (chord.length - 1) / 2) * 0.35, 0.45));
    extra(m, land + 0.04);
  },
});

const RECIPES: Record<Cue, Recipe> = {
  /* ── Core ── */
  tap: {
    len: 0.22,
    build: m => {
      m.add(marimba(D5, 1, 0.2), 0, 1, 0, 0);
      m.add(glock(D6, 0.1, 0.1), 0, 1, 0, 0);
    },
  },
  'session-start': {
    len: 0.9,
    room: 0.6,
    wet: 0.35,
    build: m => {
      m.add(marimba(A4, 0.9, 0.7), 0);
      m.add(marimba(D5, 1, 0.8), 0.075);
      m.add(pop(0.6, 300, 1100, 0.1), 0.15, 1, 0, 0.15);
      m.add(glock(D6, 0.35, 0.8), 0.15);
    },
  },
  'logged-1': {
    len: 1.0,
    room: 0.6,
    wet: 0.35,
    build: m => {
      m.run([D5, Fs5], 0, 0.09, 0.95);
      m.add(glock(Fs5, 0.3, 0.9), 0.09);
    },
  },
  'logged-2': {
    len: 1.4,
    room: 0.65,
    wet: 0.4,
    build: m => {
      const land = m.run([D5, Fs5, A5], 0, 0.08, 0.9);
      m.add(glock(A5, 0.4, 1.1), land, 1, 0.15);
      m.add(pop(0.3, 500, 1300, 0.07), land, 1, 0, 0.1);
    },
  },
  'logged-3': {
    len: 1.9,
    room: 0.7,
    wet: 0.45,
    build: m => {
      const land = m.run([D5, Fs5, A5, D6], 0, 0.07, 0.9);
      m.add(glock(D6, 0.45, 1.3), land, 1, 0.1);
      m.sparkle(land + 0.04, 31, 0.55, 0.18);
    },
  },
  'block-done': {
    len: 3.0,
    room: 0.82,
    wet: 0.55,
    build: m => {
      // Two strikes, the second a step up: hard to miss from another tab,
      // warm enough not to feel like an alarm.
      m.add(marimba(D4, 0.6), 0, 1, 0, 0.2);
      m.add(glock(D5, 0.8, 2.2), 0, 1, -0.25);
      m.add(glock(Fs5, 0.7, 2.0), 0.03, 1, 0);
      m.add(glock(A5, 0.7, 2.0), 0.06, 1, 0.25);
      m.add(glock(A5, 0.6, 2.0), 0.5, 1, -0.15);
      m.add(glock(D6, 0.7, 2.0), 0.53, 1, 0.15);
    },
  },
  'break-over': {
    len: 1.1,
    room: 0.5,
    wet: 0.3,
    build: m => {
      m.add(pop(0.8, 250, 700, 0.1), 0, 1, 0, 0.1);
      m.add(pop(0.9, 320, 950, 0.1), 0.13, 1, 0, 0.1);
      m.add(marimba(A4, 0.8, 0.6), 0.26);
      m.add(marimba(D5, 0.9, 0.6), 0.33);
    },
  },
  'target-hit': {
    len: 2.3,
    room: 0.75,
    wet: 0.5,
    build: m => {
      const land = m.run([D5, Fs5, A5, D6], 0, 0.06, 0.9);
      m.add(glock(D6, 0.6, 1.6), land + 0.06, 1, -0.2);
      m.add(glock(Fs6, 0.5, 1.4), land + 0.06, 1, 0.2);
      m.add(pop(0.5, 400, 1200, 0.08), land + 0.06, 1, 0, 0.1);
      m.add(kick(0.5, 1.2), land + 0.06, 0.3, 0, 0);
      m.sparkle(land + 0.12, 7, 0.9, 0.25);
    },
  },
  'task-done': {
    len: 0.9,
    room: 0.55,
    wet: 0.35,
    build: m => {
      // Pitched at D so the combo steps (pentatonic from D) stay in key.
      m.add(glock(D6, 0.7, 0.9), 0);
      m.add(marimba(D5, 0.5, 0.5), 0);
      m.add(pop(0.35, 700, 1600, 0.05), 0, 1, 0, 0);
    },
  },
  'board-clear': {
    len: 1.9,
    room: 0.72,
    wet: 0.5,
    build: m => {
      const land = m.run([D5, Fs5, A5, D6, Fs6], 0, 0.06, 0.65, (n, v) => glock(n, v, 1.2));
      m.add(marimba(D4, 0.5), land);
      m.add(pop(0.5, 500, 1500, 0.08), land, 1, 0, 0.1);
      m.sparkle(land + 0.06, 11, 0.7, 0.22);
    },
  },
  'chapter-complete': {
    len: 1.7,
    room: 0.7,
    wet: 0.45,
    build: m => {
      m.add(pop(0.3, 600, 1400, 0.06), 0, 1, 0, 0);
      m.add(glock(D6, 0.7, 1.3), 0);
      // The chord, strummed.
      m.add(marimba(D4, 0.6), 0.04, 1, -0.2);
      m.add(marimba(Fs4, 0.6), 0.07, 1, 0);
      m.add(marimba(A4, 0.6), 0.1, 1, 0.2);
      m.add(glock(A5, 0.4, 1.0), 0.12, 1, 0.1);
    },
  },
  correct: {
    len: 1.0,
    room: 0.55,
    wet: 0.35,
    build: m => {
      // The rising ding: a fourth up, glock doubled by marimba.
      m.add(glock(A5, 0.8, 0.9), 0);
      m.add(marimba(A4, 0.35, 0.5), 0);
      m.add(glock(D6, 1, 1.1), 0.085);
      m.add(marimba(D5, 0.35, 0.5), 0.085);
    },
  },
  wrong: {
    len: 0.65,
    room: 0.4,
    wet: 0.2,
    build: m => {
      // Down a minor third, soft and short. "Not quite", never a buzzer.
      m.add(thud(0.5), 0, 1, 0, 0);
      m.add(marimba(A3, 0.8, 0.35), 0);
      m.add(marimba(F3, 0.9, 0.45), 0.1);
    },
  },
  cleared: {
    len: 1.5,
    room: 0.65,
    wet: 0.45,
    build: m => {
      m.add(glock(A5, 0.8, 0.9), 0);
      m.add(glock(D6, 1, 1.1), 0.085);
      m.add(marimba(D5, 0.35, 0.5), 0.085);
      m.add(glock(Fs6, 0.6, 1.0), 0.17, 1, 0.15);
      m.sparkle(0.2, 23, 0.5, 0.2);
    },
  },
  reveal: {
    len: 0.15,
    build: m => {
      m.add(flick(0.9), 0, 1, 0, 0);
      m.add(pop(0.18, 700, 1300, 0.04), 0.01, 1, 0, 0);
    },
  },
  'run-complete': {
    len: 1.9,
    room: 0.7,
    wet: 0.5,
    build: m => {
      const land = m.run([D5, Fs5, A5], 0, 0.07, 0.9);
      m.add(glock(D6, 0.6, 1.4), land + 0.1, 1, -0.1);
      m.add(glock(A5, 0.45, 1.2), land + 0.1, 1, 0.1);
      m.add(clap(0.5), land + 0.1, 0.25, 0.05, 0.3);
      m.sparkle(land + 0.14, 41, 0.5, 0.15);
    },
  },

  /* ── Streak moment ── */
  'streak-1': streakTier(0.35, [D5, Fs5, A5], [D6], () => {}),
  'streak-2': streakTier(0.45, [D5, Fs5, A5, D6], [D6, Fs6], (m, at) => m.sparkle(at + 0.05, 52, 0.6, 0.2)),
  'streak-3': streakTier(0.55, [D5, Fs5, A5, D6, Fs6], [D6, Fs6, A6], (m, at) => {
    m.add(kick(0.6, 1.3), 0.55, 0.3, 0, 0);
    m.add(marimba(D3, 0.5), 0.55, 1, 0, 0.1);
    m.sparkle(at + 0.05, 63, 0.8, 0.22);
  }),
  'streak-4': streakTier(0.6, [D5, Fs5, A5, D6, Fs6, A6], [D6, Fs6, A6], (m, at) => {
    m.add(kick(0.6, 1.3), 0.6, 0.3, 0, 0);
    m.add(kick(0.6, 1.3), at, 0.3, 0, 0);
    m.add(marimba(D3, 0.5), 0.6, 1, 0, 0.1);
    m.add(clap(0.6), at, 0.25, 0.05, 0.3);
    m.add(clap(0.6), at + 0.24, 0.25, -0.05, 0.3);
    m.sparkle(at + 0.05, 74, 1.0, 0.24);
  }),
  'streak-milestone': {
    len: 4.0,
    room: 0.85,
    wet: 0.55,
    build: m => {
      m.add(noiseRiser(0.7, 1), 0, 0.35, 0, 0.4);
      m.add(pop(0.7, 200, 900, 0.14), 0.7, 1, 0, 0.2);
      m.add(kick(0.7, 1.3), 0.7, 0.32, 0, 0);
      m.add(marimba(D3, 0.55), 0.7, 1, 0, 0.1);
      // A short fanfare, then the held chord.
      m.add(marimba(D5, 0.85), 0.7, 1, -0.2);
      m.add(marimba(Fs5, 0.9), 0.8, 1, 0);
      m.add(marimba(A5, 0.95), 0.9, 1, 0.2);
      const hit = 1.05;
      [D6, Fs6, A6, D7].forEach((n, k) => m.add(glock(n, 0.7 - k * 0.08, 2.4), hit + k * 0.03, 1, (k - 1.5) * 0.3, 0.5));
      m.add(marimba(D4, 0.7), hit, 1, 0, 0.2);
      m.add(kick(0.7, 1.3), hit, 0.32, 0, 0);
      m.add(clap(0.7), hit, 0.28, 0.05, 0.3);
      m.add(clap(0.7), hit + 0.25, 0.28, -0.05, 0.3);
      m.addStereo(shimmer([D6, Fs6, A6], 1.6, 0.12), hit, 1, 0.5);
      m.sparkle(hit + 0.05, 85, 1.3, 0.26);
    },
  },

  /* ── Rewards ── */
  'reward-unlock': {
    len: 4.4,
    room: 0.88,
    wet: 0.55,
    build: m => {
      m.add(noiseRiser(0.9, 1), 0, 0.38, 0, 0.4);
      m.addStereo(shimmer([D5, Fs5, A5, D6], 1.0, 0.08), 0, 1, 0.4);
      const hit = 0.9;
      m.add(pop(0.7, 200, 1000, 0.14), hit, 1, 0, 0.2);
      m.add(kick(0.8, 1.4), hit, 0.35, 0, 0);
      [D5, Fs5, A5, D6].forEach((n, k) => m.add(glock(n, 0.75 - k * 0.05, 2.6), hit + k * 0.03, 1, (k - 1.5) * 0.3, 0.5));
      [D4, A4, D5].forEach((n, k) => m.add(marimba(n, 0.6), hit + k * 0.02, 1, (k - 1) * 0.3, 0.2));
      [0, 0.25, 0.5].forEach((o, k) => m.add(clap(0.7), hit + o, 0.27, k % 2 ? -0.08 : 0.08, 0.3));
      m.add(glock(A6, 0.55, 1.6), hit + 0.35, 1, 0.2);
      m.add(glock(D7, 0.6, 1.8), hit + 0.55, 1, -0.2);
      m.sparkle(hit + 0.1, 96, 1.8, 0.28);
    },
  },

  /* ── Alpha Packs ── */
  'pack-lift': {
    len: 0.5,
    room: 0.4,
    wet: 0.2,
    build: m => {
      m.add(pop(0.8, 220, 520, 0.1), 0, 1, 0, 0.1);
      m.add(marimba(D5, 0.4, 0.4), 0.02);
    },
  },
  'pack-tear': {
    len: 0.8,
    room: 0.5,
    wet: 0.25,
    build: m => {
      m.add(tear(0.55, 1, 5), 0, 1, -0.2, 0.2);
      m.add(tear(0.55, 0.6, 9), 0.01, 1, 0.2, 0.2);
    },
  },
  'pack-reveal': {
    len: 1.7,
    room: 0.72,
    wet: 0.5,
    build: m => {
      m.addStereo(whoosh(0.8, 0.3, 0.9), 0, 0.6, 0.3);
      m.add(glock(A5, 0.5, 1.2), 0.3);
      m.add(marimba(D5, 0.4), 0.3);
      m.sparkle(0.25, 107, 0.8, 0.25);
    },
  },
  'pack-added': {
    len: 1.7,
    room: 0.72,
    wet: 0.5,
    build: m => {
      m.add(pop(0.6, 400, 1200, 0.08), 0, 1, 0, 0.1);
      m.add(marimba(D4, 0.5), 0);
      m.add(glock(D6, 0.8, 1.4), 0, 1, 0);
      m.add(glock(A5, 0.55, 1.2), 0.04, 1, -0.25);
      m.add(glock(Fs5, 0.5, 1.2), 0.08, 1, 0.25);
      m.sparkle(0.12, 118, 0.4, 0.15);
    },
  },

  /* ── Social ── */
  overtake: {
    len: 1.1,
    room: 0.5,
    wet: 0.3,
    build: m => {
      m.addStereo(whoosh(0.7, 0.3, 1), 0, 0.8, 0.2);
      m.add(marimba(A5, 0.6, 0.5), 0.3, 1, 0.2);
      m.add(marimba(D6, 0.7, 0.6), 0.38, 1, 0.3);
    },
  },

  /* ── Onboarding ── */
  ignite: {
    len: 2.1,
    room: 0.82,
    wet: 0.5,
    build: m => {
      m.add(noiseRiser(0.6, 1), 0, 0.4, 0, 0.4);
      m.add(pop(0.8, 180, 700, 0.14), 0.6, 1, 0, 0.2);
      m.add(kick(0.7, 1.3), 0.6, 0.3, 0, 0);
      m.add(glock(D5, 0.7, 1.6), 0.6);
      m.sparkle(0.65, 129, 0.5, 0.15);
    },
  },
  riser: {
    len: 2.6,
    room: 0.75,
    wet: 0.45,
    build: m => {
      // Accelerating up two octaves, resolving on the top D as the number lands.
      const notes = [D4, E4, Fs4, A4, B4, D5, E5, Fs5, A5, B5];
      notes.forEach((n, k) => {
        const t = 1.2 * Math.sqrt(k / notes.length);
        m.add(marimba(n, 0.35 + (0.45 * k) / notes.length, 0.6), t, 1, -0.4 + (0.8 * k) / notes.length);
      });
      m.add(glock(D6, 0.8, 1.4), 1.25);
      m.add(glock(Fs6, 0.4, 1.2), 1.28, 1, 0.2);
    },
  },
  lock: {
    len: 1.8,
    room: 0.65,
    wet: 0.45,
    build: m => {
      m.add(clunk(0.9), 0, 0.7, 0, 0.1);
      m.add(pop(0.6, 260, 800, 0.1), 0.02, 1, 0, 0.1);
      m.add(marimba(D4, 0.6), 0.06);
      [D5, A5, D6].forEach((n, k) => m.add(glock(n, 0.6, 1.4), 0.06 + k * 0.025, 1, (k - 1) * 0.3));
    },
  },

  /* ── The new onboarding ── */

  /* Scored to the Arena film (onboarding/arena.ts), so its hits land on the
     film's beats: one bell for one lamp, a few for the neighbours, a pulse
     that starts as a heartbeat and races as the city floods in, one hit on
     "This one is you", then a breath of silence for the wordmark. */
  arena: {
    len: ARENA_SECONDS + 0.6,
    room: 0.86,
    wet: 0.5,
    build: m => {
      // A low bed under everything, gone before the end.
      m.addStereo(shimmer([D3, A3], BEATS.out + 0.4, 0.22), 0, 0.5, 0.6);
      // One lamp.
      m.add(glock(D5, 0.55, 2.2), BEATS.time, 1, 0, 0.55);
      // Its neighbours.
      [[Fs5, 1.25, -0.3], [A5, 1.7, 0.35], [D6, 2.05, -0.15]].forEach(([n, at, pan]) => m.add(glock(n, 0.32, 1.6), at, 1, pan, 0.6));
      // The flood: a heartbeat that quickens into a race.
      let t = BEATS.someone;
      let k = 0;
      while (t < BEATS.you - 0.06) {
        const p = (t - BEATS.someone) / (BEATS.you - BEATS.someone);
        m.add(kick(0.35 + 0.45 * p, 1.4), t, 0.55, 0, 0.05);
        if (k % 2 === 1) m.add(marimba([D4, Fs4, A4, B4, D5, E5, Fs5, A5][Math.min(7, Math.floor(p * 8))], 0.25 + 0.3 * p, 0.5), t, 1, (k % 4 === 1 ? -0.3 : 0.3), 0.3);
        t += 0.62 - 0.48 * Math.pow(p, 0.8);
        k++;
      }
      m.add(shepard(BEATS.you - BEATS.lakhs + 0.2, 0.55), BEATS.lakhs - 0.2, 0.45, 0, 0.3);
      m.add(noiseRiser(1.6, 1), BEATS.you - 1.6, 0.35, 0, 0.3);
      m.addStereo(shimmer([D5, A5, D6, Fs6], BEATS.you - BEATS.someone + 0.4, 0.07), BEATS.someone, 1, 0.6);
      // "This one is you."
      m.add(impact(0.9), BEATS.you, 0.8, 0, 0.15);
      m.add(kick(0.9, 1.8), BEATS.you, 0.7, 0, 0);
      m.addStereo(whoosh(0.9, 0.35, 0.5), BEATS.you - 0.35, 0.5, 0.3);
      [D6, Fs6, A6].forEach((n, i) => m.add(glock(n, 0.6, 2.4), BEATS.you + 0.02 + i * 0.03, 1, (i - 1) * 0.4, 0.6));
      m.sparkle(BEATS.you + 0.05, 2027, 0.9, 0.16);
    },
  },
  wordmark: {
    len: 2.8,
    room: 0.8,
    wet: 0.45,
    build: m => {
      m.add(kick(1, 1.9), 0, 0.85, 0, 0);
      m.add(impact(0.7), 0, 0.6, 0, 0.1);
      m.add(clap(0.5), 0.005, 0.5, 0, 0.35);
      m.add(clunk(0.6), 0, 0.4, 0, 0.1);
      [D5, A5, D6].forEach((n, k) => m.add(glock(n, 0.55, 2.0), 0.02 + k * 0.02, 1, (k - 1) * 0.35, 0.5));
      m.sparkle(0.04, 77, 0.6, 0.12);
    },
  },
  /* Exactly as long as the hold (onboarding/HoldToCommit.tsx, HOLD_MS), so
     letting go early cuts it and holding to the end lands on `commit`. */
  hold: {
    len: 1.75,
    room: 0.6,
    wet: 0.35,
    build: m => {
      m.add(shepard(1.6, 0.8), 0, 0.5, 0, 0.2);
      m.add(noiseRiser(1.6, 1), 0, 0.3, 0, 0.2);
      const notes = [D4, E4, Fs4, A4, B4, D5, E5, Fs5, A5, B5, D6];
      notes.forEach((n, k) => {
        const at = 1.55 * Math.sqrt(k / notes.length);
        m.add(marimba(n, 0.3 + (0.4 * k) / notes.length, 0.45), at, 1, -0.3 + (0.6 * k) / notes.length, 0.2);
      });
    },
  },
  commit: {
    len: 3.4,
    room: 0.85,
    wet: 0.5,
    build: m => {
      m.add(kick(1, 1.9), 0, 0.9, 0, 0);
      m.add(impact(1), 0, 0.75, 0, 0.15);
      m.add(pop(0.9, 160, 900, 0.14), 0, 0.8, 0, 0.2);
      m.addStereo(whoosh(0.8, 0.1, 0.6), 0, 0.6, 0.4);
      [D5, Fs5, A5, D6, Fs6, A6].forEach((n, k) => m.add(glock(n, 0.55 - k * 0.04, 2.4), 0.03 + k * 0.028, 1, (k - 2.5) * 0.25, 0.55));
      m.addStereo(shimmer([D6, A6, D7], 2.4, 0.07), 0.1, 1, 0.6);
      m.sparkle(0.08, 4242, 1.2, 0.2);
    },
  },
  'plan-reveal': {
    len: 2.6,
    room: 0.8,
    wet: 0.5,
    build: m => {
      m.addStereo(whoosh(0.7, 0.32, 0.35), 0, 0.5, 0.4);
      const land = m.run([D4, Fs4, A4, D5, Fs5], 0.28, 0.07, 0.55);
      m.add(glock(A5, 0.6, 2.0), land + 0.05, 1, -0.2);
      m.add(glock(D6, 0.6, 2.2), land + 0.08, 1, 0.2);
      m.sparkle(land + 0.06, 31, 0.6, 0.12);
    },
  },
};

/* ── Mastering ───────────────────────────────────────────────────── */

const SILENCE = Math.pow(10, -54 / 20);

const master = (id: Cue, r: Recipe): Bus => {
  const m = new Mix(r.len);
  r.build(m);
  const out = m.dry;
  if (r.room !== undefined) out.addBus(reverb(m.send, r.room, 0.4, 0.9), r.wet ?? 0.4);

  // Nothing a laptop speaker can play lives under 40 Hz; it only eats headroom.
  const hpL = new Biquad('hp', 40, 0.7);
  const hpR = new Biquad('hp', 40, 0.7);
  hpL.run(out.L);
  hpR.run(out.R);

  if (!CUES[id].stereo) {
    for (let i = 0; i < out.length; i++) out.L[i] = out.R[i] = (out.L[i] + out.R[i]) * 0.5;
  }

  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out.L[i]), Math.abs(out.R[i]));
  if (peak === 0) throw new Error(`${id}: the recipe made no sound`);
  const norm = Math.pow(10, -1 / 20) / peak;
  for (let i = 0; i < out.length; i++) {
    out.L[i] *= norm;
    out.R[i] *= norm;
  }
  limit(out, -1);

  // Trim the tail at −54 dB with a 5 ms fade, so a file never carries
  // silence the browser has to fetch and decode.
  let end = out.length - 1;
  while (end > 0 && Math.abs(out.L[end]) < SILENCE && Math.abs(out.R[end]) < SILENCE) end--;
  const fade = Math.round(0.005 * SR);
  const len = Math.min(out.length, end + fade);
  const trimmed = new Bus(len);
  trimmed.L.set(out.L.subarray(0, len));
  trimmed.R.set(out.R.subarray(0, len));
  for (let i = 0; i < fade && len - 1 - i >= 0; i++) {
    const g = i / fade;
    trimmed.L[len - 1 - i] *= g;
    trimmed.R[len - 1 - i] *= g;
  }
  return trimmed;
};

const peaksOf = (b: Bus, bins = 120): number[] => {
  const out: number[] = [];
  const per = b.length / bins;
  for (let k = 0; k < bins; k++) {
    let p = 0;
    for (let i = Math.floor(k * per); i < Math.min(b.length, Math.floor((k + 1) * per)); i++) p = Math.max(p, Math.abs(b.L[i]), Math.abs(b.R[i]));
    out.push(Math.round(p * 1000) / 1000);
  }
  return out;
};

/* ── Run ─────────────────────────────────────────────────────────── */

const missing = CUE_IDS.filter(id => !RECIPES[id]);
if (missing.length) throw new Error(`No recipe for: ${missing.join(', ')}`);

mkdirSync(MASTERS, { recursive: true });
mkdirSync(OUT, { recursive: true });
mkdirSync(dirname(BOARD), { recursive: true });

const board: { id: Cue; label: string; when: string; seconds: number; stereo: boolean; peaks: number[] }[] = [];
let total = 0;

for (const id of CUE_IDS) {
  const def = CUES[id];
  const wavPath = join(MASTERS, `${id}.wav`);
  const aacPath = join(OUT, `${id}.aac`);
  if (!only || id.includes(only)) {
    const bus = master(id, RECIPES[id]);
    writeFileSync(wavPath, encodeWav16(bus));
    const stereo = !!def.stereo;
    execFileSync('afconvert', ['-f', 'adts', '-d', 'aac', '-b', stereo ? '80000' : '48000', ...(stereo ? [] : ['-c', '1']), wavPath, aacPath], { stdio: 'pipe' });
    const kb = statSync(aacPath).size / 1024;
    console.log(`${id.padEnd(18)} ${(bus.length / SR).toFixed(2)}s  ${stereo ? 'stereo' : 'mono  '}  ${kb.toFixed(1)} kB`);
    board.push({ id, label: def.label, when: def.when, seconds: Math.round((bus.length / SR) * 1000) / 1000, stereo, peaks: peaksOf(bus) });
  }
  total += statSync(aacPath, { throwIfNoEntry: false })?.size ?? 0;
}

if (!only) {
  const rows = board.map(c => '  ' + JSON.stringify(c)).join(',\n');
  writeFileSync(
    BOARD,
    `/* Written by scripts/render-sfx.ts. Do not edit. */\nimport type { Cue } from '../../../sound/cues';\n\nexport interface BoardCue {\n  id: Cue;\n  label: string;\n  when: string;\n  seconds: number;\n  stereo: boolean;\n  peaks: number[];\n}\n\nexport const BOARD: BoardCue[] = [\n${rows},\n];\n`,
  );
}
console.log(`\n${CUE_IDS.length} cues, ${(total / 1024).toFixed(0)} kB shipped in public/sounds/${only ? ' (board left as it was: --only)' : ''}`);
