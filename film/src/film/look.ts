/**
 * Colour and geometry shared by the machine, the HUD and the ending.
 *
 * Subject colours are the app's own (schedule/colors.ts): Physics is that
 * blue here too. Red is the now-line and nothing else. The ghost — the best
 * run you are chasing — is white, because racing's purple for a personal
 * best is taken: Maths is purple.
 */
import { SUBJECT_COLORS } from '../../../schedule/colors';
import type { Subject3 } from '../score/year';

export const SUBJECT_HEX: Record<Subject3, string> = {
  Physics: SUBJECT_COLORS.Physics.dot,
  Chemistry: SUBJECT_COLORS.Chemistry.dot,
  Maths: SUBJECT_COLORS.Maths.dot,
};
export const SUBJECT_TEXT: Record<Subject3, string> = {
  Physics: SUBJECT_COLORS.Physics.text,
  Chemistry: SUBJECT_COLORS.Chemistry.text,
  Maths: SUBJECT_COLORS.Maths.text,
};

export const ACCENT = '#E10600';
export const VOID = '#040405';
export const GHOST = '#F4F4F5';
export const INK = '#FAFAFA';
export const MUTED = '#71717A';
export const FAINT = '#3F3F46';

/* ── The drum ─────────────────────────────────────────────────────── */

export const R = 5;
export const DRUM_LEN = 7.2;
/** One day of the year, as an angle on the drum. */
export const DAY_ANGLE = (Math.PI * 2) / 365;

/** Lanes run Physics | Chemistry | Maths, left to right. */
export const laneX = (lane: number): number => {
  const g = Math.floor(lane / 8);
  const j = lane % 8;
  return (g - 1) * 2.3 + (j - 3.5) * 0.26;
};
