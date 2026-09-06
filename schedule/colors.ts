import { BlockKind, Subject } from '../types';

/**
 * Per-subject colour for the timeline.
 *
 * New ground — nothing in the app had a subject colour map before, because
 * nothing before this needed to tell two subjects apart at a glance in a
 * dense grid. Modelled on STATUS_COLORS in constants.tsx: Tailwind arbitrary
 * values rather than CSS variables, matching how every other component here
 * is written.
 *
 * The accent red (#E10600) is deliberately absent. It belongs to the now-line
 * and to actions; spending it on a subject would make every Physics block
 * look like a call to action.
 */
export interface SubjectStyle {
  /** Block fill, dark theme. */
  bg: string;
  /** Block fill, light theme. */
  bgLight: string;
  border: string;
  borderLight: string;
  text: string;
  textLight: string;
  /** Solid dot / left rail — same in both themes. */
  dot: string;
}

export const SUBJECT_COLORS: Record<Subject, SubjectStyle> = {
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

export const subjectStyle = (subject: Subject): SubjectStyle =>
  SUBJECT_COLORS[subject] || SUBJECT_COLORS.General;

export const BLOCK_KIND_LABELS: Record<BlockKind, string> = {
  study: 'STUDY',
  revision: 'REVISION',
  test: 'TEST',
  break: 'BREAK',
  fixed: 'FIXED',
};

/** Kinds that are not you studying, and so are excluded from planned hours. */
export const isCommitment = (kind: BlockKind): boolean =>
  kind === 'break' || kind === 'fixed';
