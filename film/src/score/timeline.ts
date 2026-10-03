/**
 * The timeline. The single source of truth for picture and sound.
 *
 * One day is one step. A step is a whole number of frames at 60 fps, and the
 * number depends only on the streak: each gear makes a day one frame
 * shorter. Rhythm exists only inside a run — bars are counted from the
 * run's own first day, so every streak starts a phrase on a downbeat, and a
 * missed day lands exactly where a beat should have been.
 *
 * The audio renderer (scripts/render-score.ts) and the Remotion composition
 * both import this module and nothing else about timing.
 */
import { REVISION, STAGES, stageFor, tonesInRange, type Chord } from './harmony';
import { DAYS, TOTAL_CHAPTERS, YEAR, type MockScope, type Subject3 } from './year';

export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** Black and the red line before day one. */
export const PRE_ROLL = 96;
/** From the exam-day stop to the last frame. */
export const ENDING = 1020;

/** Frames per day, by gear. Neutral and first gear share the slowest step. */
export const STEP_FRAMES = [18, 18, 17, 16, 15, 14, 13];
/** Streak day on which each gear begins: after 1, 2, 4, 8 and 16 bars. */
export const GEAR_AT = [0, 1, 9, 17, 33, 65, 129];

export const gearOf = (s: number): number => {
  if (s <= 0) return 0;
  let g = 1;
  for (let i = 1; i < GEAR_AT.length; i++) if (s >= GEAR_AT[i]) g = i;
  return g;
};

/* ── The comb ─────────────────────────────────────────────────── */

export const LANES = 24;
export const LANES_PER_SUBJECT = 8;
export const LANE_BASE: Record<Subject3, number> = { Physics: 0, Chemistry: 8, Maths: 16 };
/** Where each subject sits in pitch. Chemistry rings highest, Maths lowest. */
export const REGISTER: Record<Subject3, [number, number]> = {
  Physics: [67, 86],
  Chemistry: [74, 93],
  Maths: [60, 79],
};
/** Same-day subjects are spread across the step, in day units. */
const STRUM = [0, 0.5, 0.75];

/* ── Shapes ───────────────────────────────────────────────────── */

export interface Step {
  /** 0-based day index. DAY n on screen is d + 1. */
  d: number;
  start: number;
  frames: number;
  gear: number;
  /** Position in the current run, 1-based; 0 on a missed day. */
  s: number;
  run: number;
  logged: boolean;
  downbeat: boolean;
  chord: Chord;
  syllabus: number; // 0..1, before this day
  errors: number;
  best: number; // longest run before this day
}

export interface PluckNote {
  d: number;
  /** Position on the drum, in day units. The note sounds when the drum reaches it. */
  pos: number;
  frame: number; // fractional onset frame
  subject: Subject3;
  midi: number;
  lane: number;
  vel: number; // 0..1, from hours
  bright: number; // 0..1, from focus quality
  grit: number; // 0..1, from distractions
  muted: boolean; // a manual backfill
  hours: number;
  chapter: string;
}

export type FilmEvent =
  | { type: 'runStart'; frame: number; d: number; run: number }
  | { type: 'upshift'; frame: number; d: number; gear: number }
  | { type: 'crash'; frame: number; d: number; gear: number; s: number; stall: boolean }
  | { type: 'newBest'; frame: number; d: number; s: number; climax: boolean }
  | { type: 'reward'; frame: number; d: number; reward: 'wallpaper' | 'book' }
  | { type: 'mock'; frame: number; d: number; score: number; scope: MockScope }
  | { type: 'chord'; frame: number; d: number; chord: Chord }
  | { type: 'note'; frame: number; d: number; text: string }
  | { type: 'exam'; frame: number; d: number };

export interface Gate {
  run: number;
  /** Day index the gate stands on: the day that would beat the best. */
  d: number;
  best: number;
  from: number;
  until: number;
  passed: boolean;
}

export interface Timeline {
  steps: Step[];
  notes: PluckNote[];
  events: FilmEvent[];
  gates: Gate[];
  examFrame: number;
  durationInFrames: number;
  titleIn: number;
  titleOut: number;
  ignition: number;
}

/* ── Build ────────────────────────────────────────────────────── */

const build = (): Timeline => {
  const steps: Step[] = [];
  const notes: PluckNote[] = [];
  const events: FilmEvent[] = [];
  const gates: Gate[] = [];

  let frame = PRE_ROLL;
  let s = 0;
  let run = -1;
  let best = 0;
  let prevChord: Chord = STAGES[0];
  let wallpaper = false;
  let book = false;
  let verifiedRun = 0;
  let openGate: Gate | null = null;
  /** The record this run is chasing: the best as it stood when the run began. */
  let runBest = 0;

  for (let d = 0; d < DAYS; d++) {
    const day = YEAR[d];
    const exam = d === DAYS - 1;
    const logged = !exam && day.logs.length > 0;
    const prevS = s;
    const prevGear = gearOf(prevS);

    s = logged ? s + 1 : 0;
    if (logged && s === 1) run += 1;
    const gear = gearOf(s);
    const frames = exam ? 0 : STEP_FRAMES[gear];
    const downbeat = logged && (s - 1) % 8 === 0;

    const syllabus = d === 0 ? 0 : YEAR[d - 1].chaptersDone / TOTAL_CHAPTERS;
    const stage = stageFor(syllabus);
    let chord = prevChord;
    if (!logged || downbeat) {
      chord = STAGES[stage];
      if (logged && stage === STAGES.length - 1) chord = REVISION[Math.floor((s - 1) / 16) % 2];
    }
    if (chord !== prevChord) events.push({ type: 'chord', frame, d, chord });
    prevChord = chord;

    const step: Step = {
      d,
      start: frame,
      frames,
      gear,
      s,
      run: logged ? run : -1,
      logged,
      downbeat,
      chord,
      syllabus,
      errors: d === 0 ? 0 : YEAR[d - 1].errorsOpen,
      best,
    };
    steps.push(step);

    if (exam) {
      if (openGate && !openGate.passed) openGate.until = frame;
      events.push({ type: 'exam', frame, d });
      break;
    }

    if (logged && s === 1) {
      runBest = best;
      events.push({ type: 'runStart', frame, d, run });
      if (best >= 9) {
        openGate = { run, d: d + best, best, from: frame, until: Infinity, passed: false };
        gates.push(openGate);
      }
    }
    if (logged && gear > prevGear && s > 1) events.push({ type: 'upshift', frame, d, gear });
    if (!logged && prevS > 0) {
      events.push({ type: 'crash', frame, d, gear: prevGear, s: prevS, stall: prevS >= 9 });
      if (openGate && !openGate.passed) openGate.until = frame;
      openGate = null;
    }
    if (logged && runBest >= 9 && s === runBest + 1) {
      events.push({ type: 'newBest', frame, d, s, climax: gear === 6 });
      if (openGate) {
        openGate.passed = true;
        openGate.until = frame;
      }
    }

    // Rewards are read off the longest run, and once earned they stay.
    const allVerified = day.logs.every(l => l.source !== 'manual');
    verifiedRun = logged && allVerified ? verifiedRun + 1 : 0;
    if (logged && s === 30 && !wallpaper) {
      wallpaper = true;
      events.push({ type: 'reward', frame, d, reward: 'wallpaper' });
    }
    if (logged && verifiedRun === 100 && !book) {
      book = true;
      events.push({ type: 'reward', frame, d, reward: 'book' });
    }

    if (day.mock && logged) events.push({ type: 'mock', frame, d, score: day.mock.score, scope: day.mock.scope });
    if (day.note) events.push({ type: 'note', frame, d, text: day.note });

    const ordered = [...day.logs].sort((a, b) => b.hours - a.hours);
    ordered.forEach((log, i) => {
      const [lo, hi] = REGISTER[log.subject];
      const tones = tonesInRange(chord, lo, hi);
      // Each chapter is a phrase: the arpeggio climbs and falls through the
      // chord while you stay on it, and starts somewhere new when you move on.
      const k = log.chapterIndex * 3 + log.daysOnChapter;
      const span = Math.max(1, tones.length - 1);
      const m = k % (span * 2);
      const idx = m <= span ? m : span * 2 - m;
      const offset = STRUM[i] ?? 0.75;
      notes.push({
        d,
        pos: d + offset,
        frame: frame + offset * frames,
        subject: log.subject,
        midi: tones[idx],
        lane: LANE_BASE[log.subject] + Math.round((idx / Math.max(1, tones.length - 1)) * (LANES_PER_SUBJECT - 1)),
        vel: Math.min(1, 0.42 + log.hours * 0.075),
        bright: (log.quality - 1) / 4,
        grit: Math.min(1, log.distractions / 16),
        muted: log.source === 'manual',
        hours: log.hours,
        chapter: log.chapter,
      });
    });

    if (s > best) best = s;
    frame += frames;
  }

  const examFrame = steps[steps.length - 1].start;
  // The title lives in the silence before the long run; the engine catches on
  // that run's first downbeat.
  const longRun = events.find(e => e.type === 'runStart' && e.run === 6)!;
  const at = (dIndex: number) => steps[dIndex].start;
  return {
    steps,
    notes,
    events,
    gates,
    examFrame,
    durationInFrames: examFrame + ENDING,
    titleIn: at(longRun.d - 8),
    titleOut: at(longRun.d - 2),
    ignition: longRun.frame,
  };
};

export const TIMELINE: Timeline = build();

/* ── Queries ──────────────────────────────────────────────────── */

const { steps } = TIMELINE;

/** Index of the step containing `frame` (clamped). */
export const stepIndexAt = (frame: number): number => {
  if (frame < steps[0].start) return 0;
  let lo = 0;
  let hi = steps.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (steps[mid].start <= frame) lo = mid;
    else hi = mid - 1;
  }
  return lo;
};

/** Continuous drum position in day units. Negative before day one. */
export const dayPosAt = (frame: number): number => {
  if (frame < PRE_ROLL) return (frame - PRE_ROLL) / STEP_FRAMES[0];
  if (frame >= TIMELINE.examFrame) return DAYS - 1;
  const i = stepIndexAt(frame);
  const st = steps[i];
  return st.d + (frame - st.start) / st.frames;
};

/** Drum speed in days per frame at `frame`. */
export const dayRateAt = (frame: number): number => {
  if (frame < PRE_ROLL) return 1 / STEP_FRAMES[0];
  if (frame >= TIMELINE.examFrame) return 0;
  return 1 / steps[stepIndexAt(frame)].frames;
};

export const stepAt = (frame: number): Step => steps[stepIndexAt(frame)];

/** Notes sorted by onset, for binary search. */
const notesByFrame = [...TIMELINE.notes].sort((a, b) => a.frame - b.frame);

/** Sum of recent pluck energy, decaying with time constant `tau` frames. */
export const pluckEnergyAt = (frame: number, tau = 14): number => {
  let lo = 0;
  let hi = notesByFrame.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notesByFrame[mid].frame <= frame) lo = mid + 1;
    else hi = mid;
  }
  let e = 0;
  for (let i = lo - 1; i >= 0; i--) {
    const dt = frame - notesByFrame[i].frame;
    if (dt > tau * 7) break;
    e += notesByFrame[i].vel * (notesByFrame[i].muted ? 0.35 : 1) * Math.exp(-dt / tau);
  }
  return e;
};

/** The most recent note on each lane at or before `frame`. */
export const lastPluckPerLane = (frame: number): (PluckNote | null)[] => {
  const out: (PluckNote | null)[] = new Array(LANES).fill(null);
  let lo = 0;
  let hi = notesByFrame.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (notesByFrame[mid].frame <= frame) lo = mid + 1;
    else hi = mid;
  }
  let found = 0;
  for (let i = lo - 1; i >= 0 && found < LANES; i--) {
    const n = notesByFrame[i];
    if (!out[n.lane]) {
      out[n.lane] = n;
      found++;
    }
    if (frame - n.frame > 240) break;
  }
  return out;
};

export const eventsOf = <T extends FilmEvent['type']>(type: T) =>
  TIMELINE.events.filter((e): e is Extract<FilmEvent, { type: T }> => e.type === type);

export const lastEventBefore = <T extends FilmEvent['type']>(type: T, frame: number) => {
  const list = eventsOf(type);
  let found: Extract<FilmEvent, { type: T }> | null = null;
  for (const e of list) if (e.frame <= frame) found = e;
  return found;
};
