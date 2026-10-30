/**
 * The showcase's sound: a short, bright score in D major and the app's own
 * cues on the frames where the picture does what plays them in the app.
 *
 *   npm run showcase:audio   → public/showcase/score.wav
 *
 * Every onset is read from src/showcase/timeline.ts, which the picture reads
 * too. 120 bpm, so a beat is 15 frames and every cut lands on one.
 *
 * The score uses the same instruments as the app's sound kit
 * (audio/sfx-instruments.ts: marimba, glockenspiel, pops) over the film's
 * drums, pads and risers (audio/instruments.ts). I – V – vi – IV, the plainest
 * happy progression there is, resolving home on the end card.
 *
 * The cues are the files the app ships (public/sounds/*.aac), decoded with
 * Remotion's bundled ffmpeg and mixed at their catalogue gain, so the film
 * sounds like the app because it is the app.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUES as CATALOG } from '../../sound/cues';
import { midiToHz } from '../src/score/harmony';
import { BAR, BEAT, CUES, DURATION, FPS, SCENES } from '../src/showcase/timeline';
import { Biquad, Bus, SR, TAU, compress, encodeWav16, limit, reverb, secs, softClip } from './audio/dsp';
import { chordVoice, clap, hat, impact, kick, riser, shimmer, whoosh } from './audio/instruments';
import { glock, marimba, pop } from './audio/sfx-instruments';

const FILM = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(FILM, '..');
const OUT = join(FILM, 'public', 'showcase', 'score.wav');

const T = (frame: number) => frame / FPS;
const LEN = Math.round(T(DURATION) * SR);
const beat = T(BEAT);
const bar = T(BAR);
const END = T(SCENES.end.from);

const music = new Bus(LEN);
const send = new Bus(LEN);
const drums = new Bus(LEN);
const cues = new Bus(LEN);

const add = (sig: Float32Array, at: number, gain: number, pan = 0, wet = 0.25) => {
  music.addMono(sig, at, gain, pan);
  if (wet > 0) send.addMono(sig, at, gain * wet, pan);
};
const addSt = ([l, r]: [Float32Array, Float32Array], at: number, gain: number, wet = 0.3) => {
  music.addStereo(l, r, at, gain);
  if (wet > 0) send.addStereo(l, r, at, gain * wet);
};

/* ── Harmony ──
   Bar 0 is the door (no beat). Bars 1–9 run under the app, one chord a bar,
   with the last bar on the dominant so the end card lands home. */
interface Chord { root: number; tones: number[] }
const D: Chord = { root: 38, tones: [62, 66, 69, 74] };
const A: Chord = { root: 33, tones: [61, 64, 69, 73] };
const Bm: Chord = { root: 35, tones: [62, 66, 71, 74] };
const G: Chord = { root: 31, tones: [62, 67, 71, 74] };
const Asus: Chord = { root: 33, tones: [62, 64, 69, 74] };
const BARS: Chord[] = [D, D, A, Bm, G, D, A, Bm, G, Asus];

/* A round sub bass: a sine with a soft pluck of upper harmonic on the attack. */
const bass = (midi: number, vel: number, len: number): Float32Array => {
  const f = midiToHz(midi);
  const out = secs(len + 0.08);
  let ph = 0;
  const lp = new Biquad('lp', 900, 0.8);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    ph += f / SR;
    const env = Math.min(1, t / 0.004) * (t < len ? Math.exp(-t / (len * 1.6)) : Math.exp(-len / (len * 1.6)) * Math.exp(-(t - len) / 0.02));
    const tone = Math.sin(TAU * ph) + 0.35 * Math.sin(2 * TAU * ph) * Math.exp(-t / 0.05) + 0.12 * Math.sin(3 * TAU * ph) * Math.exp(-t / 0.03);
    out[i] = lp.tick(softClip(tone * env * 1.2, 1.4)) * vel;
  }
  return out;
};

/* ── Bar 0: the door ── */
addSt(chordVoice([50, 57, 64, 66], bar + 0.6, { attack: 0.9, release: 1.2, cutoff: 1100, detune: [-7, 0, 7], seed: 3 }), 0, 0.26, 0.5);
add(impact(0.9), T(SCENES.open.from + 12), 0.45, 0, 0.3);
add(glock(86, 0.6, 2.4), T(SCENES.open.from + 26), 0.32, 0.2, 0.55);
add(glock(93, 0.45, 2.4), T(SCENES.open.from + 32), 0.26, -0.2, 0.55);
add(riser(0.9, 0.9), bar - 0.9, 0.28, 0, 0.3);
addSt(whoosh(0.7, 0.55, 0.9), bar - 0.6, 0.2, 0.2);

/* ── Bars 1–9: under the app ── */
const ARP = [0, 2, 3, 1, 2, 3, 1, 2]; // indices into the chord's tones, an octave up on 3
for (let b = 1; b < BARS.length; b++) {
  const c = BARS[b];
  const t0 = b * bar;
  const lift = b >= 5 ? 1 : 0; // the second half is bigger: four on the floor from Decks on

  // Pad
  addSt(
    chordVoice(c.tones.map(m => m - 12), bar, { attack: 0.25, release: 0.5, cutoff: 1500 + b * 120, detune: [-6, 0, 6], seed: b }),
    t0,
    0.16,
    0.45,
  );

  // Bass: on 1, the "and" of 2, 3, and the "and" of 4.
  for (const at of [0, 1.5, 2, 3.5]) add(bass(c.root + 12, at === 0 ? 1 : 0.8, beat * 0.9), t0 + at * beat, 0.42, 0, 0);

  // Marimba arpeggio in eighths, the app's own mallet.
  for (let k = 0; k < 8; k++) {
    const idx = ARP[k];
    const midi = c.tones[idx] + (k >= 4 && idx > 1 ? 12 : 0);
    const vel = (k % 2 === 0 ? 0.75 : 0.55) * (b === 1 ? 0.7 : 1);
    add(marimba(midi, vel, 0.7), t0 + k * beat * 0.5, 0.2, (k % 2 ? 0.3 : -0.3), 0.18);
  }

  // Drums
  for (let q = 0; q < 4; q++) {
    const t = t0 + q * beat;
    if (q % 2 === 0 || lift) drums.addMono(kick(q === 0 ? 1 : 0.85, 1.3), t, 0.5);
    if (b >= 2 && (q === 1 || q === 3)) drums.addMono(clap(0.9), t, 0.2, 0.05);
    if (b >= 3) drums.addMono(hat(0.7, false), t + beat / 2, 0.07, 0.25);
    if (lift && q % 2 === 1) drums.addMono(hat(0.5, true), t + beat / 2, 0.05, -0.25);
  }
}

/* ── Every cut: a glockenspiel accent on a tone of the chord it lands in ── */
for (const id of ['today', 'plan', 'syllabus', 'mocks', 'decks', 'pack', 'notes', 'streak'] as const) {
  const t = T(SCENES[id].from);
  const c = BARS[Math.min(BARS.length - 1, Math.floor(t / bar))];
  add(glock(c.tones[3] + 12, 0.42, 1.4), t, 0.15, 0.25, 0.5);
  add(pop(0.35, 300, 900, 0.08), t, 0.1, -0.2, 0.2);
}

/* Notes: each typed character is a soft tick, as the editor would sound if it made one. */
{
  const [a, b] = [SCENES.notes.from + 10, SCENES.notes.from + 26];
  for (let k = 0; k < 8; k++) add(pop(0.25, 900, 1600, 0.025), T(a + ((b - a) * k) / 7), 0.06, (k % 2 ? 0.2 : -0.2), 0);
  add(glock(93, 0.5, 1.6), T(SCENES.notes.from + 32), 0.14, 0.1, 0.6);
}

/* ── Into the end card ── */
add(riser(1.1, 1), END - 1.1, 0.3, 0, 0.35);
addSt(whoosh(0.8, 0.6, 1), END - 0.7, 0.24, 0.25);

/* ── The end: home, and the room rings out ── */
{
  drums.addMono(kick(1, 1.5), END, 0.55);
  add(impact(1), END, 0.35, 0, 0.4);
  addSt(chordVoice([50, 57, 62, 66, 69], 2.6, { attack: 0.05, release: 1.4, cutoff: 2600, detune: [-6, 0, 6], seed: 11 }), END, 0.2, 0.55);
  add(bass(38, 1, 2.2), END, 0.42, 0, 0);
  [74, 78, 81, 86].forEach((m, k) => add(marimba(m, 0.8, 1.2), END + k * beat * 0.5, 0.22, (k - 1.5) * 0.25, 0.35));
  [86, 90, 93].forEach((m, k) => add(glock(m, 0.6 - k * 0.08, 2.6), END + 2 * beat + k * 0.03, 0.2, (k - 1) * 0.35, 0.6));
  addSt(shimmer([86, 90, 93, 98], 3.2, 0.5), END + 0.1, 0.12, 0.7);
}

/* ── The app's cues ── */
const TMP = join(FILM, 'out', 'showcase-cues');
mkdirSync(TMP, { recursive: true });
/* Remotion's ffmpeg is a slim build with no raw muxer, so each cue goes
   through a 16-bit WAV on disk and is read back from its data chunk. */
const decode = (id: string): [Float32Array, Float32Array] => {
  const src = join(APP, 'public', 'sounds', `${id}.aac`);
  const wav = join(TMP, `${id}.wav`);
  execFileSync('npx', ['remotion', 'ffmpeg', '-v', 'error', '-y', '-i', src, '-ac', '2', '-ar', String(SR), '-c:a', 'pcm_s16le', wav], { cwd: FILM });
  const buf = readFileSync(wav);
  let o = 12;
  while (o < buf.length - 8 && buf.toString('ascii', o, o + 4) !== 'data') o += 8 + buf.readUInt32LE(o + 4);
  const start = o + 8;
  const n = Math.floor((buf.length - start) / 4);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    l[i] = buf.readInt16LE(start + i * 4) / 32768;
    r[i] = buf.readInt16LE(start + i * 4 + 2) / 32768;
  }
  return [l, r];
};
const decoded = new Map<string, [Float32Array, Float32Array]>();
for (const { id, at } of CUES) {
  if (!decoded.has(id)) decoded.set(id, decode(id));
  const [l, r] = decoded.get(id)!;
  cues.addStereo(l, r, T(at), CATALOG[id].gain * 1.1);
}

/* ── Master ── */
const master = new Bus(LEN);
master.addBus(music, 1);
master.addBus(reverb(send, 0.86, 0.32, 1), 0.55);
master.addBus(drums, 1);
{
  const hpL = new Biquad('hp', 30, 0.7);
  const hpR = new Biquad('hp', 30, 0.7);
  hpL.run(master.L);
  hpR.run(master.R);
}
compress(master, -10, 2, 0.008, 0.2, 2);
// The music sits under the app: the cues are what the film is about.
const MUSIC = 0.62;
for (let i = 0; i < LEN; i++) {
  master.L[i] = master.L[i] * MUSIC + cues.L[i];
  master.R[i] = master.R[i] * MUSIC + cues.R[i];
}
let peak = 0;
for (let i = 0; i < LEN; i++) peak = Math.max(peak, Math.abs(master.L[i]), Math.abs(master.R[i]));
const norm = Math.pow(10, -1 / 20) / peak;
for (let i = 0; i < LEN; i++) {
  master.L[i] = softClip(master.L[i] * norm * 1.08, 1.05);
  master.R[i] = softClip(master.R[i] * norm * 1.08, 1.05);
}
limit(master, -1);
// A short fade on the very last frames, so a loop or the end of the clip never clicks.
const fade = Math.round(0.35 * SR);
for (let i = 0; i < fade; i++) {
  const g = 1 - i / fade;
  master.L[LEN - fade + i] *= g;
  master.R[LEN - fade + i] *= g;
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, encodeWav16(master));
console.log(`showcase score  ${(LEN / SR).toFixed(2)}s  ${CUES.length} cues (${decoded.size} files)  peak-norm ${norm.toFixed(3)}  → ${OUT}`);
