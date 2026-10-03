/**
 * What the picture needs to know about one frame, derived from the timeline
 * and nothing else. The machine, the camera, the HUD and the ending all read
 * this, so a frame always agrees with itself.
 */
import {
  PRE_ROLL, TIMELINE, dayPosAt, eventsOf, pluckEnergyAt, stepAt, type Gate, type Step,
} from '../score/timeline';

const crashes = eventsOf('crash');
const rewards = eventsOf('reward');
const upshifts = eventsOf('upshift');
const newBests = eventsOf('newBest');
const runStarts = eventsOf('runStart');

export const WALLPAPER_FRAME = rewards.find(r => r.reward === 'wallpaper')?.frame ?? Infinity;
export const CLIMAX_FRAME = newBests.find(n => n.climax)?.frame ?? Infinity;
export const DROP_FRAME = upshifts.find(u => u.gear === 4)?.frame ?? Infinity;
export const LONG_RUN_FRAME = runStarts.find(r => r.run === 6)?.frame ?? Infinity;

const decayFrom = (frame: number, at: number, tau: number) => (frame >= at ? Math.exp(-(frame - at) / tau) : 0);

export interface GateState {
  gate: Gate;
  /** 0..1 visibility. */
  opacity: number;
  /** 0..1 flare when passed. */
  flare: number;
}

export interface FrameState {
  frame: number;
  /** The frame the machine shows. Holds still after the exam-day stop. */
  sceneFrame: number;
  dayPos: number;
  step: Step;
  energy: number;
  light: number;
  aurora: number;
  shock: number; // crash: shake and chromatic split
  impact: number; // ignition, the first full groove, the climax
  gates: GateState[];
  /** 1 → 0 across the ending's first seconds. */
  endFade: number;
  preRoll: number; // 0..1 across the black open
}

export const frameState = (frame: number): FrameState => {
  const exam = TIMELINE.examFrame;
  const sceneFrame = Math.min(frame, exam);
  const step = stepAt(sceneFrame);
  const dayPos = dayPosAt(sceneFrame);
  const energy = pluckEnergyAt(sceneFrame);

  let shock = 0;
  for (const c of crashes) if (c.stall) shock = Math.max(shock, decayFrom(sceneFrame, c.frame, 28) * (0.4 + 0.12 * c.gear));
  let impact = 0;
  for (const at of [TIMELINE.ignition, DROP_FRAME, CLIMAX_FRAME]) impact = Math.max(impact, decayFrom(sceneFrame, at, 30));

  const aurora = sceneFrame < WALLPAPER_FRAME ? 0 : Math.min(1, (sceneFrame - WALLPAPER_FRAME) / 200);
  const endFade = frame < exam ? 1 : Math.max(0, 1 - (frame - exam) / 150);

  // The machine is only visible when you show up: light is recent study,
  // plus whatever of the syllabus is already done.
  const light = Math.min(1.2, 0.04 + 0.5 * step.syllabus + 0.32 * Math.min(1.6, energy) + 0.12 * aurora + 0.4 * impact);

  const gates: GateState[] = TIMELINE.gates.map(gate => {
    const inF = Math.min(1, Math.max(0, (sceneFrame - gate.from) / 40));
    let out = 1;
    let flare = 0;
    if (sceneFrame >= gate.until) {
      const since = sceneFrame - gate.until;
      out = gate.passed ? Math.max(0, 1 - since / 50) : Math.max(0, 1 - since / 18);
      flare = gate.passed ? Math.exp(-since / 16) : 0;
    }
    return { gate, opacity: sceneFrame < gate.from ? 0 : inF * out, flare };
  });

  return {
    frame,
    sceneFrame,
    dayPos,
    step,
    energy,
    light,
    aurora,
    shock,
    impact,
    gates,
    endFade,
    preRoll: Math.min(1, frame / PRE_ROLL),
  };
};
