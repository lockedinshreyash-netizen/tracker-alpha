import { BlockKind, ScheduleBlock, Subject } from '../types';

/**
 * How a block looks and what it means.
 *
 * Two families share the grid. Study blocks are coloured by subject — that is
 * the thing the app is about, so it is the thing that owns its colour, and
 * those colours are **not up for negotiation**: Physics is that blue, Chemistry
 * that green, Maths that purple, on every device and in every screenshot. A
 * subject you can recolour is a subject you can no longer read at a glance
 * across the heatmap, the charts and the grid.
 *
 * Everything else — class, sleep, meals, the gym, travel, breaks — is the
 * user's day, not the app's data model, so the user picks. `ACTIVITY_BASE`
 * holds the defaults; `state.schedule.colors` holds whatever they chose
 * instead, and both go through the same `derive` so a hand-picked colour sits
 * on the grid exactly as convincingly as a shipped one.
 *
 * The accent red (#E10600) appears in neither palette. It belongs to the
 * now-line and to actions.
 */
export interface BlockStyle {
  /** Every field is a CSS colour, applied inline. */
  bg: string;
  bgLight: string;
  border: string;
  borderLight: string;
  text: string;
  textLight: string;
  /** Solid dot / rail — the same in both themes. */
  dot: string;
}

/* ── Colour maths ──────────────────────────────────────────────── */

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const toRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** `hex` pulled `amount` of the way toward white (1) or black (0). */
const mix = (hex: string, toward: 0 | 255, amount: number): string => {
  const channels = toRgb(hex).map(c => Math.round(c + (toward - c) * amount));
  return `rgb(${channels.join(', ')})`;
};

/**
 * A full block style from one colour.
 *
 * Translucent fills and borders rather than opaque ones, so a block reads as
 * tinted glass over whichever ground it lands on — the dark grid, the light
 * grid, or a 64px swatch in the picker — without three tuned values per
 * colour. The text is pushed toward white on dark and toward black on light,
 * which is what keeps a saturated user-picked colour legible in both themes.
 */
export const derive = (hex: string): BlockStyle => ({
  bg: rgba(hex, 0.16),
  bgLight: rgba(hex, 0.13),
  border: rgba(hex, 0.45),
  borderLight: rgba(hex, 0.34),
  text: mix(hex, 255, 0.38),
  textLight: mix(hex, 0, 0.34),
  dot: hex,
});

/* ── Subjects: locked ──────────────────────────────────────────── */

/**
 * The subject colours, spelled out rather than derived.
 *
 * These are the hand-tuned values the app has always used, and they stay
 * exactly as they are — see the note at the top of this file.
 */
export const SUBJECT_COLORS: Record<Subject, BlockStyle> = {
  Physics: {
    bg: '#132033', bgLight: '#E8F0FA',
    border: '#2B4C77', borderLight: '#B7CFEA',
    text: '#8FBFF0', textLight: '#1D4E8F',
    dot: '#4A90E2',
  },
  Chemistry: {
    bg: '#132B22', bgLight: '#E4F5EC',
    border: '#2C6349', borderLight: '#B2DEC6',
    text: '#7FD8A8', textLight: '#1B6B45',
    dot: '#34C77B',
  },
  Maths: {
    bg: '#2B2033', bgLight: '#F1EAFA',
    border: '#5A3F73', borderLight: '#D3C0EA',
    text: '#C29BF0', textLight: '#5B2E8F',
    dot: '#9B59E2',
  },
  Biology: {
    bg: '#33240F', bgLight: '#FBF0DF',
    border: '#75521F', borderLight: '#E9D1A6',
    text: '#EFB960', textLight: '#8A5B12',
    dot: '#E29B29',
  },
  General: {
    bg: '#1B1B1F', bgLight: '#ECEAE5',
    border: '#3A3A42', borderLight: '#D2CEC5',
    text: '#A1A1AA', textLight: '#57534E',
    dot: '#71717A',
  },
};

/* ── Activities: the user's to colour ──────────────────────────── */

/**
 * The shipped colour for each non-study activity.
 *
 * Deliberately saturated. These used to be near-grey on the theory that a
 * beige day leaves room for the work to stand out, which was true and also
 * made the Plan tab look like a spreadsheet. The work still wins on the grid,
 * because study blocks are the ones carrying a subject's own colour and a
 * chapter name — it does not need the rest of the day to be colourless.
 */
export const ACTIVITY_BASE: Record<BlockKind, string> = {
  /* Study kinds only land here when no subject has been picked yet. */
  study: '#71717A',
  revision: '#71717A',
  test: '#71717A',
  class: '#4C6EF5',
  sleep: '#7048E8',
  meal: '#F76707',
  gym: '#12B886',
  break: '#FAB005',
  travel: '#22B8CF',
  other: '#868E96',
};

/** Colours the user has chosen, keyed by kind. Anything absent uses the default. */
export type BlockColors = Partial<Record<BlockKind, string>>;

export interface ActivityDef {
  /** Shown on the chip and the card. CSS uppercases it. */
  label: string;
  /** Counts as planned study, and is measured against `logs`. */
  isStudy: boolean;
  /** A sensible hour (study-day minute) and length for a one-tap add. */
  defaultStart: number;
  defaultMins: number;
}

/* Ordered as they appear in the picker: the work first, then the day around
   it. `defaultStart` is only a starting guess — the editor is right there. */
export const ACTIVITIES: Record<BlockKind, ActivityDef> = {
  study:    { label: 'Study',    isStudy: true,  defaultStart: 180, defaultMins: 90 },  // 07:00
  revision: { label: 'Revision', isStudy: true,  defaultStart: 960, defaultMins: 60 },  // 20:00
  test:     { label: 'Test',     isStudy: true,  defaultStart: 360, defaultMins: 180 }, // 10:00
  class:    { label: 'Class',    isStudy: false, defaultStart: 300, defaultMins: 360 }, // 09:00
  sleep:    { label: 'Sleep',    isStudy: false, defaultStart: 1140, defaultMins: 300 },// 23:00 → 04:00
  meal:     { label: 'Meal',     isStudy: false, defaultStart: 240, defaultMins: 30 },  // 08:00
  gym:      { label: 'Gym',      isStudy: false, defaultStart: 1020, defaultMins: 60 }, // 21:00
  break:    { label: 'Break',    isStudy: false, defaultStart: 540, defaultMins: 30 },  // 13:00
  travel:   { label: 'Travel',   isStudy: false, defaultStart: 270, defaultMins: 30 },  // 08:30
  other:    { label: 'Other',    isStudy: false, defaultStart: 600, defaultMins: 60 },  // 14:00
};

export const BLOCK_KINDS = Object.keys(ACTIVITIES) as BlockKind[];

/** The only kinds that are measured against logs. Sleep is not a study debt. */
export const countsAsStudy = (kind: BlockKind): boolean => ACTIVITIES[kind]?.isStudy ?? false;

/**
 * The kinds whose colour the user owns.
 *
 * Study, revision and test are absent because their colour comes from the
 * subject, and subject colours are fixed. Offering a picker there would either
 * do nothing or quietly break the one thing colour is load-bearing for.
 */
export const RECOLOURABLE: BlockKind[] = BLOCK_KINDS.filter(k => !countsAsStudy(k));

/** What an activity is actually painted with right now. */
export const activityColor = (kind: BlockKind, colors?: BlockColors): string => {
  const chosen = colors?.[kind];
  return chosen && HEX_RE.test(chosen) ? chosen : ACTIVITY_BASE[kind];
};

export const subjectStyle = (subject: Subject): BlockStyle =>
  SUBJECT_COLORS[subject] || SUBJECT_COLORS.General;

/** Study blocks are coloured by subject; everything else by what it is. */
export const blockStyle = (
  block: Pick<ScheduleBlock, 'kind' | 'subject'>,
  colors?: BlockColors,
): BlockStyle => {
  if (countsAsStudy(block.kind) && block.subject) return subjectStyle(block.subject);
  return derive(activityColor(block.kind, colors));
};

/** What to call this block on the grid. */
export const blockTitle = (block: Pick<ScheduleBlock, 'kind' | 'subject' | 'label'>): string => {
  if (block.label) return block.label;
  if (countsAsStudy(block.kind) && block.subject) return block.subject;
  return ACTIVITIES[block.kind]?.label || 'Other';
};
