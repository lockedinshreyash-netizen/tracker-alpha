/**
 * Renders the score from the timeline.
 *
 *   npx tsx scripts/render-score.ts      → public/score.wav
 *
 * Nothing here decides *when* anything happens. Every onset is read from
 * src/score/timeline.ts, which the video reads too, so picture and sound
 * cannot drift. This file decides only what each event sounds like:
 *
 *   day studied        → a tine (pitch from chapter, loudness from hours,
 *                        brightness from focus, grit from distractions,
 *                        muted if it was typed in afterwards)
 *   every day          → the escapement tick, studied or not
 *   streak             → the engine and the drums, one layer per gear
 *   missed day         → the run stalls: tape-stop, then the ratchet lets go
 *   syllabus           → the chord, and how loud it is
 *   open errors        → one wrong note held above everything
 *   mock scores        → the melody
 *   gear six           → strings, heard nowhere else in the film
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { bassNote, midiToHz, nearestTone, tonesInRange, STAGES, type Chord } from '../src/score/harmony';
import { FPS, LANES, TIMELINE, eventsOf, stepIndexAt, type Step } from '../src/score/timeline';
import { timelineSignature } from '../src/score/signature';
import { Biquad, Bus, SR, compress, encodeWav16, limit, reverb, softClip } from './audio/dsp';
import {
  chime, chordVoice, clap, clatter, clunk, hat, idle, impact, kick, pageTurn, renderEngine, renderLead,
  renderTension, riser, shepard, shimmer, squelch, tapeStop, tick, tine, whoosh, windup,
  type EngineStep, type LeadPoint,
} from './audio/instruments';

const T = (frame: number) => frame / FPS;
const { steps, notes, examFrame, durationInFrames } = TIMELINE;
const LEN = Math.ceil(T(durationInFrames) * SR) + SR;
const EXAM = T(examFrame);

const groove = new Bus(LEN); // tape-stops with the run
const phantom = new Bus(LEN); // what the run would have played; heard only inside a stall
const persist = new Bus(LEN); // survives a stall: harmony, the clock, the room
const send = new Bus(LEN); // into the hall
const ending = new Bus(LEN); // after the exam-day stop

const panLane = (lane: number) => ((lane - (LANES - 1) / 2) / ((LANES - 1) / 2)) * 0.75;
const stepAtT = (t: number): Step => steps[stepIndexAt(t * FPS)];

/* ── Tines ───────────────────────────────────────────────────────── */
const longRunDay = eventsOf('runStart').find(r => r.run === 6)!.d;
for (const n of notes) {
  const st = steps[n.d];
  const scattered = n.d < longRunDay;
  const weight = scattered ? 1 : 0;
  const decayScale = scattered ? 1 : [1, 0.7, 0.5, 0.42, 0.36, 0.32, 0.32][st.gear];
  const sig = tine({ midi: n.midi, vel: n.vel, bright: n.bright, grit: n.grit, muted: n.muted, weight, decayScale });
  const g = scattered ? 0.5 : [0.3, 0.3, 0.32, 0.34, 0.36, 0.38, 0.4][st.gear];
  groove.addMono(sig, T(n.frame), g, panLane(n.lane));
  send.addMono(sig, T(n.frame), g * (n.muted ? 0.15 : 0.32), panLane(n.lane));
}

/* ── The clock ───────────────────────────────────────────────────── */
for (const st of steps) {
  if (st.frames === 0) continue;
  const v = st.logged ? (st.gear >= 3 ? 0.08 : 0.16) : 0.22;
  persist.addMono(tick(v), T(st.start), 0.5, -0.12);
}

/* ── Engine and drums ────────────────────────────────────────────── */
const engineSteps: EngineStep[] = [];
const phantomEngine: EngineStep[] = [];
const kickTimes: number[] = [];

const drumsFor = (s: number, gear: number, t: number, dur: number, bus: Bus, collectKicks: boolean) => {
  const p = (s - 1) % 8;
  if (gear >= 2 && p % 2 === 0) {
    bus.addMono(kick(p === 0 ? 1 : 0.86, gear >= 6 ? 2.2 : 1.6), t, [0, 0, 0.3, 0.38, 0.5, 0.56, 0.66][gear]);
    if (collectKicks) kickTimes.push(t);
  }
  if (gear >= 4 && (p === 2 || p === 6)) bus.addMono(clap(0.9), t, gear >= 6 ? 0.34 : 0.26, 0.02);
  if (gear >= 3 && p % 2 === 1) bus.addMono(hat(0.8, true), t, gear >= 5 ? 0.11 : 0.08, 0.18);
  if (gear >= 5) {
    if (p % 2 === 0) bus.addMono(hat(0.5, false), t, 0.07, 0.25);
    bus.addMono(hat(0.38, false), t + dur / 2, 0.06, 0.25);
  }
};

for (let i = 0; i < steps.length; i++) {
  const st = steps[i];
  if (!st.logged) continue;
  const t = T(st.start);
  const dur = T(st.frames);
  const prev = steps[i - 1];
  const upshift = st.s > 1 && prev && prev.gear < st.gear;
  engineSteps.push({
    t,
    dur,
    midi: bassNote(st.chord),
    gear: st.gear,
    upshift,
    octave: st.gear >= 5 && (st.s - 1) % 2 === 1,
  });
  drumsFor(st.s, st.gear, t, dur, groove, true);
  if (upshift) {
    groove.addMono(clunk(0.9), t, 0.35);
    send.addMono(clunk(0.9), t, 0.1);
  }
}

// What each stalled run would have played next. Only the tape-stop hears it.
for (const c of eventsOf('crash')) {
  if (!c.stall) continue;
  const prev = steps[c.d - 1];
  let t = T(c.frame);
  for (let k = 1; k <= 8; k++) {
    const s = prev.s + k;
    const dur = T(prev.frames);
    phantomEngine.push({ t, dur, midi: bassNote(prev.chord), gear: prev.gear, upshift: false, octave: prev.gear >= 5 && (s - 1) % 2 === 1 });
    drumsFor(s, prev.gear, t, dur, phantom, false);
    t += dur;
  }
}

const eng = renderEngine(engineSteps, LEN);
groove.addMono(eng, 0, 0.36);
phantom.addMono(renderEngine(phantomEngine, LEN), 0, 0.36);

/* ── Harmony ─────────────────────────────────────────────────────── */
interface Span { chord: Chord; from: number; to: number }
const spans: Span[] = [];
for (const st of steps) {
  const t = T(st.start);
  const last = spans[spans.length - 1];
  if (!last || last.chord !== st.chord) {
    if (last) last.to = t;
    spans.push({ chord: st.chord, from: t, to: EXAM });
  }
}
spans[spans.length - 1].to = EXAM;

let voicing: number[] = [50, 57, 62, 65];
const voice = (chord: Chord): number[] => {
  // Nearest-voice-leading: each chord tone placed as close as possible to the
  // previous voicing, plus the root below.
  const pool = tonesInRange(chord, 50, 70);
  const next = voicing.map(v => pool.reduce((b, m) => (Math.abs(m - v) < Math.abs(b - v) ? m : b), pool[0]));
  const uniq = [...new Set(next)].sort((a, b) => a - b);
  for (const pc of chord.tones) if (!uniq.some(m => m % 12 === pc)) uniq.push(pool.find(m => m % 12 === pc)!);
  voicing = uniq.slice(0, 5).sort((a, b) => a - b);
  return [bassNote(chord) + 12, ...voicing];
};

const padBus = new Bus(LEN);
spans.forEach((sp, k) => {
  const st = stepAtT(sp.from + 0.001);
  const level = 0.62 * Math.min(1, st.syllabus * 1.15) * (st.gear === 0 ? 0.75 : st.gear < 4 ? 0.85 : 1);
  const cutoff = 650 + 2300 * st.syllabus + 160 * st.gear;
  const [l, r] = chordVoice(voice(sp.chord), sp.to - sp.from, {
    attack: k === 0 ? 2.5 : 0.45,
    release: 1.4,
    cutoff,
    detune: [-9, 0, 8],
    seed: k + 1,
  });
  padBus.addStereo(l, r, sp.from, level);
});
// The pad breathes with the kick once the groove is full.
{
  const pump = new Float32Array(LEN).fill(1);
  for (const kt of kickTimes) {
    if (stepAtT(kt).gear < 4) continue;
    const s0 = Math.round(kt * SR);
    for (let i = 0; i < 0.3 * SR && s0 + i < LEN; i++) pump[s0 + i] = Math.min(pump[s0 + i], 1 - 0.38 * Math.exp(-i / (0.1 * SR)));
  }
  for (let i = 0; i < LEN; i++) {
    padBus.L[i] *= pump[i];
    padBus.R[i] *= pump[i];
  }
}
persist.addBus(padBus, 0.2);
send.addBus(padBus, 0.12);

/* ── Strings: gear six only ──────────────────────────────────────── */
const climax = eventsOf('newBest').find(e => e.climax);
if (climax) {
  const from = T(climax.frame);
  spans
    .filter(sp => sp.to > from)
    .forEach((sp, k) => {
      const a = Math.max(sp.from, from);
      const tones = tonesInRange(sp.chord, 50, 86);
      const [l, r] = chordVoice(tones, sp.to - a, {
        attack: k === 0 ? 0.3 : 0.5,
        release: 0.6,
        cutoff: 4200,
        detune: [-11, -4, 3, 10],
        vibrato: 0.0045,
        seed: 40 + k,
      });
      persist.addStereo(l, r, a, 0.36);
      send.addStereo(l, r, a, 0.3);
    });
}

/* ── Melody: mock scores ─────────────────────────────────────────── */
const leadPoints: LeadPoint[] = [];
{
  const mocks = eventsOf('mock');
  const chordEvents = eventsOf('chord');
  let current = 62;
  type Mark = { t: number; kind: 'mock' | 'chord'; score?: number; chord?: Chord };
  const marks: Mark[] = [
    ...mocks.map(m => ({ t: T(m.frame), kind: 'mock' as const, score: m.score })),
    ...chordEvents.map(c => ({ t: T(c.frame), kind: 'chord' as const, chord: c.chord })),
  ].sort((a, b) => a.t - b.t);
  let started = false;
  let target = 62;
  for (const m of marks) {
    const chord = stepAtT(m.t + 0.001).chord;
    if (m.kind === 'mock') {
      started = true;
      target = 62 + ((m.score! - 30) / 60) * 19;
      current = nearestTone(chord, target, 60, 84);
      leadPoints.push({ t: m.t, midi: current, accent: true });
    } else if (started) {
      current = nearestTone(m.chord!, target, 60, 84);
      leadPoints.push({ t: m.t, midi: current, accent: false });
    }
  }
}
const leadLevel = (t: number) => {
  if (t >= EXAM) return 0;
  const g = stepAtT(t).gear;
  return g === 0 ? 0 : g < 4 ? 0.55 : g < 6 ? 0.8 : 1;
};
const lead = renderLead(leadPoints, leadLevel, LEN);
groove.addMono(lead, 0, 0.13);
send.addMono(lead, 0, 0.1);

/* ── The wrong note: open errors ─────────────────────────────────── */
{
  const rootAt = (t: number) => {
    const c = stepAtT(t).chord;
    return 84 + ((c.root + 1) % 12);
  };
  const amountAt = (t: number) => Math.min(1, stepAtT(t).errors / 100);
  const ten = renderTension(rootAt, amountAt, 0, EXAM, LEN);
  persist.addMono(ten, 0, 0.022, 0.3);
  send.addMono(ten, 0, 0.03);
}

/* ── Moments ─────────────────────────────────────────────────────── */
// Pre-roll: the machine is on.
persist.addMono(idle(T(TIMELINE.titleIn - 30), 1), T(30), 0.035);

// Title: winding the key, then the engine catches on the long run's first beat.
{
  const from = T(TIMELINE.titleIn) + 0.4;
  const ign = T(TIMELINE.ignition);
  persist.addMono(windup(ign - from, 1), from, 0.42);
  persist.addMono(impact(1), ign, 0.75);
  send.addMono(impact(1), ign, 0.25);
}

for (const c of eventsOf('crash')) {
  const t = T(c.frame);
  if (c.stall) {
    persist.addMono(clatter(1), t + 0.35 + 0.08 * c.gear, 0.3, -0.1);
    send.addMono(clatter(1), t + 0.35 + 0.08 * c.gear, 0.12);
  }
}

for (const u of eventsOf('upshift')) {
  if (u.gear === 4 && u.d < 200) {
    // The first time the groove is whole.
    persist.addMono(impact(0.8), T(u.frame), 0.5);
    send.addMono(impact(0.8), T(u.frame), 0.2);
  }
}

for (const r of eventsOf('reward')) {
  const t = T(r.frame);
  const chord = stepAtT(t + 0.001).chord;
  const tones = tonesInRange(chord, 81, 96);
  persist.addMono(chime(tones[0], 1), t, 0.12, -0.2);
  persist.addMono(chime(tones[Math.min(2, tones.length - 1)], 0.8), t + 0.13, 0.1, 0.2);
  send.addMono(chime(tones[0], 1), t, 0.2);
  if (r.reward === 'wallpaper') {
    const [l, rr] = shimmer(tonesInRange(chord, 74, 93), 4.5, 0.05);
    persist.addStereo(l, rr, t, 1);
    send.addStereo(l, rr, t, 0.8);
    // Rise from the unlock into the drop three days later.
    const drop = eventsOf('upshift').find(u => u.gear === 4 && u.frame > r.frame)!;
    const rz = riser(T(drop.frame) - t, 1);
    groove.addMono(rz, t, 0.16);
  } else {
    persist.addMono(pageTurn(1), t - 0.05, 0.12, 0.3);
  }
}

for (const nb of eventsOf('newBest')) {
  const t = T(nb.frame);
  const dur = nb.climax ? 1.6 : 1.0;
  const [l, r] = whoosh(dur, dur / 2, 1);
  persist.addStereo(l, r, t - dur / 2, nb.climax ? 0.5 : 0.3);
  if (nb.climax) {
    persist.addMono(impact(1), t, 0.85);
    send.addMono(impact(1), t, 0.3);
    const sh = shepard(4.6, 1);
    groove.addMono(sh, t - 4.6, 0.11);
    send.addMono(sh, t - 4.6, 0.06);
  }
}

for (const n of eventsOf('note')) {
  persist.addMono(squelch(1), T(n.frame) + 0.12, 0.12, -0.35);
}

/* ── Stalls: varispeed the groove, then let the room have it ─────── */
const crashes = eventsOf('crash');
for (const c of crashes) {
  const t = T(c.frame);
  const nextRun = eventsOf('runStart').find(r => r.frame > c.frame);
  const resume = nextRun ? T(nextRun.frame) - 0.002 : EXAM;
  if (c.stall) {
    const outDur = 0.32 + 0.11 * c.gear;
    tapeStop(groove, phantom, t, outDur);
    groove.zero(t + outDur, resume);
  } else {
    // A short run just dies.
    groove.zero(t + 0.6, resume);
  }
}

/* ── Mix ─────────────────────────────────────────────────────────── */
const hall = reverb(send, 0.9, 0.32, 1);

if (process.env.SCORE_DEBUG) {
  const rmsDb = (b: Bus, a: number, z: number) => {
    let acc = 0;
    const i0 = Math.round(a * SR);
    const i1 = Math.round(z * SR);
    for (let i = i0; i < i1; i++) acc += b.L[i] * b.L[i] + b.R[i] * b.R[i];
    return (10 * Math.log10(acc / (2 * (i1 - i0)) + 1e-12)).toFixed(1).padStart(6);
  };
  const wins: [string, number, number][] = [['ActI', 5, 10], ['G1', 22.6, 24.5], ['G2', 25, 26.8], ['G3', 27.2, 30], ['G4', 32, 38], ['G5', 42, 52], ['gap', 54.9, 55.5], ['G6', 88, 94.5]];
  console.log('bus      ' + wins.map(w => w[0].padStart(6)).join(''));
  for (const [name, b] of [['groove', groove], ['persist', persist], ['pad', padBus], ['hall', hall]] as [string, Bus][])
    console.log(name.padEnd(9) + wins.map(w => rmsDb(b, w[1], w[2])).join(''));
}
const master = new Bus(LEN);
master.addBus(groove, 1);
master.addBus(persist, 1);
master.addBus(hall, 0.9);

// Exam day: everything stops. No tail.
master.zero(EXAM, LEN / SR);

/* ── Ending ──────────────────────────────────────────────────────── */
{
  // The year rewinds: the climax, reversed and far away.
  const E = EXAM;
  const cl = climax ? T(climax.frame) : EXAM - 6;
  const from = Math.round((cl + 0.2) * SR);
  const n = Math.round(1.4 * SR);
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  let lp1 = 0;
  let lp2 = 0;
  for (let i = 0; i < n; i++) {
    const k = from + (n - 1 - i);
    const env = Math.pow(i / n, 2) * (i > n - 600 ? (n - i) / 600 : 1);
    lp1 += 0.035 * (master.L[k] - lp1);
    lp2 += 0.035 * (master.R[k] - lp2);
    l[i] = lp1 * env;
    r[i] = lp2 * env;
  }
  ending.addStereo(l, r, E + T(450), 0.13);

  // The last note: day one of somebody else's year, on the tonic the film
  // has been withholding.
  const finalPluck = tine({ midi: 74, vel: 0.85, bright: 0.85, grit: 0, muted: false, weight: 0.6 });
  const fp = E + T(600);
  ending.addMono(finalPluck, fp, 0.55, 0);
  const tail = new Bus(LEN);
  tail.addMono(finalPluck, fp, 0.4, 0);
  const tailHall = reverb(tail, 0.93, 0.25, 1);
  ending.addBus(tailHall, 1);
}
master.addBus(ending, 1);

/* ── Master ──────────────────────────────────────────────────────── */
{
  // Rumble below the engine's sub does nothing on a phone but eat headroom.
  const hpL = new Biquad('hp', 28, 0.7);
  const hpR = new Biquad('hp', 28, 0.7);
  hpL.run(master.L);
  hpR.run(master.R);
}
compress(master, -5, 1.6, 0.01, 0.25, 0);
for (let i = 0; i < LEN; i++) {
  master.L[i] = softClip(master.L[i], 1.05);
  master.R[i] = softClip(master.R[i], 1.05);
}
let peak = 0;
for (let i = 0; i < LEN; i++) peak = Math.max(peak, Math.abs(master.L[i]), Math.abs(master.R[i]));
const norm = Math.pow(10, -1.2 / 20) / peak;
for (let i = 0; i < LEN; i++) {
  master.L[i] *= norm;
  master.R[i] *= norm;
}
limit(master, -1);

const trimmed = new Bus(Math.round(T(durationInFrames) * SR));
trimmed.L.set(master.L.subarray(0, trimmed.length));
trimmed.R.set(master.R.subarray(0, trimmed.length));

mkdirSync('public', { recursive: true });
const wav = encodeWav16(trimmed);
writeFileSync('public/score.wav', wav);

// Picture and sound are built from the same timeline; this hash lets the
// composition refuse to play a score rendered from a different one.
const signature = timelineSignature();
writeFileSync('src/score/signature.generated.ts', `export const SCORE_SIGNATURE = '${signature}';\n`);

console.log(`score.wav  ${(trimmed.length / SR).toFixed(2)}s  peak-norm ${norm.toFixed(3)}  sig ${signature}`);
console.log(`notes ${notes.length}  engine steps ${engineSteps.length}  spans ${spans.length}  lead points ${leadPoints.length}  ${STAGES.length} stages  f(D2)=${midiToHz(38).toFixed(1)}Hz`);
