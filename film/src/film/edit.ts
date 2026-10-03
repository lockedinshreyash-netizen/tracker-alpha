/**
 * The edit. Every cut lands on a day, and the cutting rate is the streak:
 * a held shot for a lonely day, a cut a bar in the groove, a cut a beat in
 * top gear. Key moments are directed by hand but anchored to events, not to
 * seconds, so a different year re-times them by itself.
 */
import { hash01 } from '../score/random';
import { PRE_ROLL, TIMELINE, eventsOf, type Step } from '../score/timeline';
import { CLIMAX_FRAME, DROP_FRAME, WALLPAPER_FRAME, type FrameState } from './state';
import { DRUM_LEN, R, laneX } from './look';

export type ShotKind = 'onboard' | 'rear' | 'macro' | 'profile' | 'wide' | 'top' | 'low' | 'void';

export interface Shot {
  from: number;
  kind: ShotKind;
  /** Variant: which lane or side. */
  v: number;
}

export interface CameraState {
  pos: [number, number, number];
  target: [number, number, number];
  up: [number, number, number];
  fov: number;
  /** World distance to focus at; 0 = no depth of field. */
  focus: number;
}

const { steps, notes, examFrame } = TIMELINE;
const stepStart = (d: number) => steps[d].start;

/** Lane of the next note at or after `frame`, so a macro shot has something to watch. */
const nextLane = (frame: number): number => {
  const n = notes.find(x => x.frame >= frame);
  return n ? n.lane : 11;
};

const build = (): Shot[] => {
  const shots: Shot[] = [];
  const at = (from: number, kind: ShotKind, v = 0) => shots.push({ from: Math.round(from), kind, v });

  const crashes = eventsOf('crash');
  const runStarts = eventsOf('runStart');
  const upshifts = eventsOf('upshift');
  const rewards = eventsOf('reward');
  const firstNote = notes[0];

  /* ── Cold open ── */
  at(0, 'macro', firstNote.lane);
  at(stepStart(1), 'onboard', 1);
  at(stepStart(2), 'profile');
  at(stepStart(3) + 8, 'void');

  /* ── The scatter: every lonely day gets a close-up, every gap the void ── */
  for (const run of runStarts) {
    if (run.run === 0 || run.run >= 6) continue;
    const runSteps = steps.filter(s => s.run === run.run);
    const len = runSteps.length;
    if (len <= 2) {
      at(run.frame, run.run % 2 ? 'macro' : 'top', nextLane(run.frame));
      at(runSteps[len - 1].start + runSteps[len - 1].frames + 10, 'void');
      continue;
    }
    at(run.frame, 'onboard', run.run);
    const up = upshifts.find(u => u.frame > run.frame && steps[u.d].run === run.run);
    if (up) at(up.frame, run.run === 5 ? 'top' : 'rear', 2);
    const crash = crashes.find(c => c.frame > run.frame)!;
    at(crash.frame, 'profile', 1);
    at(crash.frame + 42, 'void');
  }

  /* ── The long run and the comeback: cut rate follows the gear ── */
  const pools: ShotKind[][] = [
    [],
    ['onboard', 'macro', 'rear', 'onboard'],
    ['onboard', 'top', 'macro', 'rear'],
    ['onboard', 'profile', 'macro', 'top', 'rear'],
    ['onboard', 'wide', 'macro', 'top', 'profile', 'rear', 'low'],
    ['onboard', 'macro', 'wide', 'top', 'rear', 'profile', 'low', 'macro'],
    ['wide', 'macro', 'low', 'top', 'rear', 'profile', 'onboard', 'macro'],
  ];
  const every = [8, 8, 8, 8, 8, 4, 2];

  const auto = (fromD: number, toD: number, salt: number) => {
    let k = 0;
    for (let d = fromD; d < toD; d++) {
      const st: Step = steps[d];
      if (!st.logged) continue;
      const n = every[st.gear];
      if ((st.s - 1) % n !== 0) continue;
      const pool = pools[st.gear];
      const kind = pool[(k + Math.floor(hash01(d, salt) * 2)) % pool.length];
      at(st.start, kind, kind === 'macro' ? nextLane(st.start) : Math.floor(hash01(d, salt + 1) * 3));
      k++;
    }
  };

  const longRun = runStarts.find(r => r.run === 6)!;
  const comeback = runStarts.find(r => r.run === 7)!;
  const fever = crashes.find(c => c.frame > longRun.frame)!;
  const firstBest = eventsOf('newBest').find(n => !n.climax)!;
  const book = rewards.find(r => r.reward === 'book')!;
  const climaxD = steps.find(s => s.start === CLIMAX_FRAME)!.d;

  auto(longRun.d, fever.d, 11);
  auto(comeback.d, climaxD, 23);

  // Directed moments, laid over the automatic cut.
  const overrides: { from: number; to: number; kind: ShotKind; v: number }[] = [];
  const override = (from: number, to: number, kind: ShotKind, v = 0) => overrides.push({ from: Math.round(from), to: Math.round(to), kind, v });

  override(longRun.frame, stepStart(longRun.d + 8), 'onboard', 1); // the engine catches
  override(firstBest.frame - 70, firstBest.frame + 30, 'onboard', 1); // first ghost, passed
  override(WALLPAPER_FRAME, DROP_FRAME, 'low', 0); // the sky opens
  override(DROP_FRAME, stepStart(steps.find(s => s.start === DROP_FRAME)!.d + 16), 'wide', 0); // whole
  override(book.frame, book.frame + 60, 'top', 0);
  override(fever.frame, fever.frame + 40, 'profile', 1);
  override(fever.frame + 40, comeback.frame, 'macro', nextLane(fever.frame - 1));
  override(comeback.frame, stepStart(comeback.d + 16), 'rear', 1); // the trail, with the gap in it
  override(CLIMAX_FRAME - 320, CLIMAX_FRAME + 26, 'onboard', 1); // the ghost comes over the horizon

  // Top gear: a cut every beat, then the whole machine for the last bar.
  const lastBar = stepStart(steps.length - 1 - 8);
  let k = 0;
  for (let d = climaxD; d < steps.length - 1; d += 2) {
    const f = stepStart(d) + (d === climaxD ? 26 : 0);
    if (f >= lastBar) break;
    const pool = pools[6];
    at(f, pool[k % pool.length], pool[k % pool.length] === 'macro' ? nextLane(f) : k % 3);
    k++;
  }
  at(lastBar, 'wide', 1);

  const base = shots.sort((a, b) => a.from - b.from);
  const inside = (f: number) => overrides.some(o => f >= o.from && f < o.to);
  const activeBase = (f: number) => [...base].filter(b => b.from <= f).pop() ?? base[0];
  const merged: Shot[] = base.filter(b => !inside(b.from));
  for (const o of overrides) {
    merged.push({ from: o.from, kind: o.kind, v: o.v });
    if (!inside(o.to) && !base.some(b => b.from === o.to)) {
      const b = activeBase(o.to);
      merged.push({ from: o.to, kind: b.kind, v: b.v });
    }
  }
  return merged.filter(s => s.from <= examFrame).sort((a, b) => a.from - b.from);
};

export const EDIT: Shot[] = build();

export const shotAt = (frame: number): { shot: Shot; index: number; start: number; end: number } => {
  let i = 0;
  for (let k = 0; k < EDIT.length; k++) if (EDIT[k].from <= frame) i = k;
  const end = EDIT[i + 1]?.from ?? TIMELINE.durationInFrames;
  return { shot: EDIT[i], index: i, start: EDIT[i].from, end };
};

/* ── Lenses ───────────────────────────────────────────────────────── */

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

export const cameraFor = (s: FrameState): CameraState => {
  const frame = s.sceneFrame;
  const { shot, start, end } = shotAt(frame);
  const u = ease((frame - start) / Math.max(1, Math.min(end - start, 600)));
  const side = [-1.4, 0.2, 1.5][shot.v % 3];
  let cam: CameraState;
  switch (shot.kind) {
    case 'onboard':
      cam = { pos: [side + 0.15 * u, R + 0.66, 1.15 - 0.15 * u], target: [side * 0.45, R - 0.55, -7], up: [0, 1, 0], fov: 46, focus: 0 };
      break;
    case 'rear':
      cam = { pos: [side, R + 0.55, -1.25 - 0.2 * u], target: [side * 0.6, R - 1.4, 7], up: [0, 1, 0], fov: 48, focus: 0 };
      break;
    case 'macro': {
      const x = laneX(shot.v);
      cam = { pos: [x + 0.5, R + 0.24, -0.85 + 0.1 * u], target: [x, R + 0.14, 0.0], up: [0, 1, 0], fov: 22, focus: 0.98 };
      break;
    }
    case 'profile':
      cam = { pos: [DRUM_LEN / 2 + 3.7 - 0.5 * u, R + 1.05, 3.3], target: [0.8, R - 0.45, -0.3], up: [0, 1, 0], fov: 34, focus: 0 };
      break;
    case 'wide':
      cam = { pos: [8 - 1.4 * u, R + 4.6, 14.5 - 1.6 * u], target: [0, R - 1.8, 0], up: [0, 1, 0], fov: 30, focus: 0 };
      break;
    case 'top':
      cam = { pos: [0, R + 10.5 - 1.2 * u, 0.4], target: [0, R, -0.2], up: [0, 0, -1], fov: 24, focus: 0 };
      break;
    case 'low':
      cam = { pos: [-3.6 + 0.7 * u, R - 2.7, 10], target: [0, R + 0.5, -3], up: [0, 1, 0], fov: 28, focus: 0 };
      break;
    case 'void':
    default:
      cam = { pos: [0.6 * Math.sin(frame / 400), R + 2.3, 24 - 2.2 * u], target: [0, R - 0.6, 0], up: [0, 1, 0], fov: 17, focus: 0 };
      break;
  }

  // The machine shakes when it is working hard, and when it fails.
  const onboardish = shot.kind === 'onboard' || shot.kind === 'rear' ? 1.8 : 1;
  const amp = (0.0035 * s.step.gear * (s.step.logged ? 1 : 0) + 0.07 * s.shock + 0.035 * s.impact) * onboardish;
  if (amp > 0) {
    const n = (k: number) => Math.sin(frame * (0.9 + k * 0.37) + k * 11.3) * 0.6 + Math.sin(frame * (2.3 + k * 0.53) + k * 5.1) * 0.4;
    cam.pos = [cam.pos[0] + n(1) * amp, cam.pos[1] + n(2) * amp, cam.pos[2] + n(3) * amp * 0.5];
  }
  return cam;
};

export const PRE_ROLL_FRAMES = PRE_ROLL;
