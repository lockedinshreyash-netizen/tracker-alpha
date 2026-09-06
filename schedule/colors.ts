import { BlockKind, ScheduleBlock, Subject } from '../types';

/**
 * How a block looks and what it means.
 *
 * Two families share the grid. Study blocks are coloured by subject — that is
 * the thing the app is about, so it is the thing that gets the colour. Life
 * blocks (sleep, meals, school, the gym) are deliberately low-chroma: they
 * give the day its shape without competing with the work, and a day that is
 * mostly beige is a day with room in it.
 *
 * The accent red (#E10600) appears in neither palette. It belongs to the
 * now-line and to actions.
 */
export interface BlockStyle {
  bg: string;
  bgLight: string;
  border: string;
  borderLight: string;
  text: string;
  textLight: string;
  /** Solid dot / rail — the same in both themes. */
  dot: string;
}

export const SUBJECT_COLORS: Record<Subject, BlockStyle> = {
  Physics: {
    bg: 'bg-[#132033]', bgLight: 'bg-[#E8F0FA]',
    border: 'border-[#2B4C77]', borderLight: 'border-[#B7CFEA]',
    text: 'text-[#8FBFF0]', textLight: 'text-[#1D4E8F]',
    dot: 'bg-[#4A90E2]',
  },
  Chemistry: {
    bg: 'bg-[#132B22]', bgLight: 'bg-[#E4F5EC]',
    border: 'border-[#2C6349]', borderLight: 'border-[#B2DEC6]',
    text: 'text-[#7FD8A8]', textLight: 'text-[#1B6B45]',
    dot: 'bg-[#34C77B]',
  },
  Maths: {
    bg: 'bg-[#2B2033]', bgLight: 'bg-[#F1EAFA]',
    border: 'border-[#5A3F73]', borderLight: 'border-[#D3C0EA]',
    text: 'text-[#C29BF0]', textLight: 'text-[#5B2E8F]',
    dot: 'bg-[#9B59E2]',
  },
  Biology: {
    bg: 'bg-[#33240F]', bgLight: 'bg-[#FBF0DF]',
    border: 'border-[#75521F]', borderLight: 'border-[#E9D1A6]',
    text: 'text-[#EFB960]', textLight: 'text-[#8A5B12]',
    dot: 'bg-[#E29B29]',
  },
  General: {
    bg: 'bg-[#1B1B1F]', bgLight: 'bg-[#ECEAE5]',
    border: 'border-[#3A3A42]', borderLight: 'border-[#D2CEC5]',
    text: 'text-[#A1A1AA]', textLight: 'text-[#57534E]',
    dot: 'bg-[#71717A]',
  },
};

const NEUTRAL: BlockStyle = {
  bg: 'bg-[#151517]', bgLight: 'bg-zinc-50',
  border: 'border-white/[0.07]', borderLight: 'border-zinc-200',
  text: 'text-zinc-400', textLight: 'text-zinc-500',
  dot: 'bg-zinc-600',
};

const KIND_COLORS: Partial<Record<BlockKind, BlockStyle>> = {
  class: {
    bg: 'bg-[#161B24]', bgLight: 'bg-[#EFF2F7]',
    border: 'border-[#2A3444]', borderLight: 'border-[#D3DAE5]',
    text: 'text-[#93A4BC]', textLight: 'text-[#4A5871]',
    dot: 'bg-[#6B7F9E]',
  },
  gym: {
    bg: 'bg-[#12211F]', bgLight: 'bg-[#E9F4F2]',
    border: 'border-[#265049]', borderLight: 'border-[#BEDCD7]',
    text: 'text-[#7CC6BB]', textLight: 'text-[#1F6157]',
    dot: 'bg-[#3FA394]',
  },
  meal: {
    bg: 'bg-[#241C13]', bgLight: 'bg-[#F7F0E6]',
    border: 'border-[#4D3B26]', borderLight: 'border-[#E2D3BC]',
    text: 'text-[#C9A87C]', textLight: 'text-[#7A5B33]',
    dot: 'bg-[#B08650]',
  },
  /* Dimmest of the lot on purpose: sleep is the part of the day that is
     supposed to recede. */
  sleep: {
    bg: 'bg-[#0F1015]', bgLight: 'bg-[#EDEEF2]',
    border: 'border-[#1F2130]', borderLight: 'border-[#DADCE4]',
    text: 'text-[#6A6E82]', textLight: 'text-[#787D91]',
    dot: 'bg-[#4A4E60]',
  },
};

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

export const subjectStyle = (subject: Subject): BlockStyle =>
  SUBJECT_COLORS[subject] || SUBJECT_COLORS.General;

/** Study blocks are coloured by subject; everything else by what it is. */
export const blockStyle = (block: Pick<ScheduleBlock, 'kind' | 'subject'>): BlockStyle => {
  if (countsAsStudy(block.kind) && block.subject) return subjectStyle(block.subject);
  return KIND_COLORS[block.kind] || NEUTRAL;
};

/** What to call this block on the grid. */
export const blockTitle = (block: Pick<ScheduleBlock, 'kind' | 'subject' | 'label'>): string => {
  if (block.label) return block.label;
  if (countsAsStudy(block.kind) && block.subject) return block.subject;
  return ACTIVITIES[block.kind]?.label || 'Other';
};
