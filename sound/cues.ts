/* ── The cue catalog ──
   One list of every sound the app can make. It is read twice: by `audio.ts`,
   which plays them, and by `film/scripts/render-sfx.ts`, which synthesises
   them — so an id cannot exist on one side and be missing on the other. The
   renderer refuses to run if any id here has no recipe.

   Kept free of DOM and React on purpose: the film's Node script imports it.

   `gain` is the only loudness control that matters. Every master is rendered
   to the same −1 dBFS peak, so how loud a cue lands next to the others is
   decided here, not in the synth — a tap that fires on every press has to sit
   far below the reward that fires once a month. */

export type CueGroup =
  /** Fetched after the first gesture. Anything that can fire in an ordinary session. */
  | 'core'
  /** The daily streak moment. */
  | 'streak'
  /** Reward unlocks. Fetched when the modal mounts. */
  | 'rare'
  /** The Alpha Packs opening. Fetched when the store opens. */
  | 'store'
  | 'social'
  | 'onboarding';

export interface CueDef {
  group: CueGroup;
  /** Relative level, 0–1, before the master volume. */
  gain: number;
  label: string;
  /** When it fires. Shown on the SoundBoard and the debug page. */
  when: string;
  /** Rendered in stereo. Short UI cues are mono: half the bytes, nothing lost. */
  stereo?: boolean;
  /** Allowed to play while the tab is hidden. Only the Pomodoro bells. */
  background?: boolean;
  /** A new play cuts the previous one off instead of stacking on it. */
  choke?: boolean;
}

const cue = (group: CueGroup, gain: number, label: string, when: string, extra: Partial<CueDef> = {}): CueDef => ({
  group,
  gain,
  label,
  when,
  ...extra,
});

export const CUES = {
  /* ── Core ── */
  tap: cue('core', 0.22, 'Tap', 'Pomodoro controls, onboarding choices, a syllabus step', { choke: true }),
  'session-start': cue('core', 0.5, 'Session start', 'Stopwatch or Pomodoro starts'),
  'logged-1': cue('core', 0.5, 'Logged · short', 'A session under 30 minutes is logged'),
  'logged-2': cue('core', 0.55, 'Logged · solid', 'A session of 30–90 minutes is logged', { stereo: true }),
  'logged-3': cue('core', 0.6, 'Logged · long', 'A session over 90 minutes is logged', { stereo: true }),
  'block-done': cue('core', 0.7, 'Block done', 'A Pomodoro focus block ends', { stereo: true, background: true }),
  'break-over': cue('core', 0.6, 'Break over', 'A Pomodoro break ends', { background: true }),
  'target-hit': cue('core', 0.65, 'Target hit', "Today's hours first reach the daily goal", { stereo: true }),
  'task-done': cue('core', 0.45, 'Task done', 'A card reaches Done. Pitch climbs with each one today'),
  'board-clear': cue('core', 0.55, 'Board clear', 'The last open card reaches Done', { stereo: true }),
  'chapter-complete': cue('core', 0.5, 'Chapter complete', 'A chapter is marked completed', { stereo: true }),
  correct: cue('core', 0.45, 'Correct', 'A right answer, or Good on a card. Pitch climbs with a run'),
  wrong: cue('core', 0.4, 'Wrong', 'A wrong answer, or Again on a card'),
  cleared: cue('core', 0.5, 'Cleared', 'An error is cleared: right twice in a row', { stereo: true }),
  reveal: cue('core', 0.25, 'Reveal', 'A flashcard is turned over', { choke: true }),
  'run-complete': cue('core', 0.55, 'Run complete', 'A review session, error test or chapter test ends', { stereo: true }),

  /* ── Streak moment ── */
  'streak-1': cue('streak', 0.6, 'Streak · days 1–6', 'Daily streak moment', { stereo: true }),
  'streak-2': cue('streak', 0.62, 'Streak · days 7–29', 'Daily streak moment', { stereo: true }),
  'streak-3': cue('streak', 0.64, 'Streak · days 30–99', 'Daily streak moment', { stereo: true }),
  'streak-4': cue('streak', 0.66, 'Streak · 100+ days', 'Daily streak moment', { stereo: true }),
  'streak-milestone': cue('streak', 0.7, 'Streak milestone', 'Day 7, 30, 50, 100, 200 or 365', { stereo: true }),

  /* ── Rewards ── */
  'reward-unlock': cue('rare', 0.75, 'Reward unlocked', 'A streak reward unlocks', { stereo: true }),

  /* ── Alpha Packs ── */
  'pack-lift': cue('store', 0.4, 'Pack lift', 'A pack comes off its hook'),
  'pack-tear': cue('store', 0.5, 'Pack tear', 'The pack tears open', { stereo: true }),
  'pack-reveal': cue('store', 0.55, 'Pack reveal', 'The cards rise out of the pack', { stereo: true }),
  'pack-added': cue('store', 0.6, 'Added to Alpha', 'The pack lands in My Alpha', { stereo: true }),

  /* ── Social ── */
  overtake: cue('social', 0.45, 'Overtake', 'Someone passes you in the race, or you pass them', { stereo: true }),

  /* ── Onboarding ── */
  ignite: cue('onboarding', 0.55, 'Ignite', 'Onboarding spotlight turns on', { stereo: true }),
  riser: cue('onboarding', 0.45, 'Riser', 'Under the days-remaining count-up', { stereo: true }),
  lock: cue('onboarding', 0.55, 'Lock in', 'The final "Lock in" button of onboarding', { stereo: true }),
} satisfies Record<string, CueDef>;

export type Cue = keyof typeof CUES;

export const CUE_IDS = Object.keys(CUES) as Cue[];

export const cueFile = (id: Cue) => `/sounds/${id}.aac`;

/** Combo steps: D major pentatonic from the cue's own pitch. Any two of these
 *  sound fine together, so a fast run of right answers never lands a sour
 *  interval. Capped at the octave, where the run stays. */
export const COMBO_STEPS = [0, 2, 4, 7, 9, 12] as const;

export const comboSemitones = (index: number) =>
  COMBO_STEPS[Math.max(0, Math.min(COMBO_STEPS.length - 1, Math.floor(index)))];

/** Streak tiers. Each one is a bigger sound than the last. */
export const STREAK_MILESTONES = [7, 30, 50, 100, 200, 365] as const;

export const streakCue = (streak: number): Cue => {
  if ((STREAK_MILESTONES as readonly number[]).includes(streak)) return 'streak-milestone';
  if (streak >= 100) return 'streak-4';
  if (streak >= 30) return 'streak-3';
  if (streak >= 7) return 'streak-2';
  return 'streak-1';
};

/** Logged-session tiers, by length. More time in, more sound out. */
export const loggedCue = (hours: number): Cue => (hours >= 1.5 ? 'logged-3' : hours >= 0.5 ? 'logged-2' : 'logged-1');
