/**
 * The showcase, frame by frame. The one place that says when anything happens.
 *
 * The picture (Showcase.tsx and the scenes) and the sound
 * (scripts/render-showcase-audio.ts) both read this file, so a cut, a tick or
 * a pack tearing lands on the same frame in both. The captions file
 * (public/showcase/captions.vtt) is written from it too.
 *
 * 120 bpm at 30 fps: a beat is 15 frames, a bar is 60. Every cut sits on a
 * beat, most on a bar.
 */
import type { Cue } from '../../../sound/cues';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const BEAT = 15;
export const BAR = BEAT * 4;

/** Frames a scene runs on under the next one, so every cut is a short dissolve. */
export const OVERLAP = 8;

export type SceneId = 'open' | 'today' | 'plan' | 'syllabus' | 'mocks' | 'decks' | 'pack' | 'notes' | 'streak' | 'end';

export const SCENES: Record<SceneId, { from: number; dur: number }> = {
  open: { from: 0, dur: BAR },
  today: { from: BAR, dur: BAR + 2 * BEAT },
  plan: { from: 2.5 * BAR, dur: BAR },
  syllabus: { from: 3.5 * BAR, dur: BAR },
  mocks: { from: 4.5 * BAR, dur: BAR },
  decks: { from: 5.5 * BAR, dur: BAR },
  pack: { from: 6.5 * BAR, dur: BAR },
  notes: { from: 7.5 * BAR, dur: BAR },
  streak: { from: 8.5 * BAR, dur: BAR + 2 * BEAT },
  end: { from: 10 * BAR, dur: 2 * BAR },
};

export const DURATION = SCENES.end.from + SCENES.end.dur; // 720 frames, 24 s

/** Moments inside each scene, in frames from that scene's start. */
export const AT = {
  sealPress: 8,
  todayStart: 14,
  todayLift: 54,
  todayDrop: 70,
  planGrab: 14,
  planDrop: 38,
  syllabusTicks: [14, 20, 26, 32],
  mocksDraw: [6, 40] as [number, number],
  deckReveal: 18,
  deckGood: 36,
  packLift: 4,
  packTear: 12,
  packReveal: 28,
  packAdded: 46,
  notesType: [10, 26] as [number, number],
  notesForm: 32,
  streakPop: 4,
  streakRoll: 18,
  endSeal: 6,
};

/** The app's own sounds (public/sounds), where the picture does the thing that plays them in the app. */
export const CUES: Array<{ id: Cue; at: number }> = [
  { id: 'commit', at: SCENES.open.from + AT.sealPress + 4 },
  { id: 'session-start', at: SCENES.today.from + AT.todayStart },
  { id: 'task-done', at: SCENES.today.from + AT.todayDrop },
  { id: 'tap', at: SCENES.plan.from + AT.planGrab },
  { id: 'tap', at: SCENES.plan.from + AT.planDrop },
  ...AT.syllabusTicks.slice(0, -1).map(t => ({ id: 'tap' as const, at: SCENES.syllabus.from + t })),
  { id: 'chapter-complete', at: SCENES.syllabus.from + AT.syllabusTicks[AT.syllabusTicks.length - 1] },
  { id: 'target-hit', at: SCENES.mocks.from + AT.mocksDraw[1] },
  { id: 'reveal', at: SCENES.decks.from + AT.deckReveal },
  { id: 'correct', at: SCENES.decks.from + AT.deckGood },
  { id: 'pack-tear', at: SCENES.pack.from + AT.packTear },
  { id: 'pack-reveal', at: SCENES.pack.from + AT.packReveal },
  { id: 'pack-added', at: SCENES.pack.from + AT.packAdded },
  { id: 'streak-3', at: SCENES.streak.from + AT.streakRoll },
  { id: 'wordmark', at: SCENES.end.from + AT.endSeal },
];

/** One short line per scene. The last word is set in italic, like the landing page's "gets in." */
export const CAPTIONS: Record<SceneId, { label?: string; lead: string; em: string }> = {
  open: { label: 'Members only', lead: 'Not everyone', em: 'gets in.' },
  today: { label: 'Today', lead: 'Start the', em: 'clock.' },
  plan: { label: 'Plan', lead: 'Plan the whole', em: 'day.' },
  syllabus: { label: 'Syllabus', lead: 'Tick off every', em: 'chapter.' },
  mocks: { label: 'Mocks', lead: 'Watch your marks', em: 'climb.' },
  decks: { label: 'Decks', lead: 'Never forget a', em: 'formula.' },
  pack: { label: 'Alpha Packs', lead: 'Open a', em: 'pack.' },
  notes: { label: 'Notes', lead: 'Notes that speak', em: 'maths.' },
  streak: { label: 'Streak', lead: 'Show up every', em: 'day.' },
  end: { lead: 'Look inside.', em: 'Then get in.' },
};

export const SITE_LINE = 'trackeralpha.in';
