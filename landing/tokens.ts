import type { CSSProperties } from 'react';

/* ── Landing page design tokens ──
   Single source of truth for the editorial landing system, so the
   sections can't drift apart the way they did before. */

export const PAPER = '#F2F0EC';
export const SURFACE = '#FFFFFF';
export const INK = '#17150F';
export const INK_DEEP = '#100E0A';
export const INK_MUTED = '#6B675C';
export const INK_FAINT = '#B5AFA0';
export const RULE = '#DDD9D0';
export const RULE_DARK = 'rgba(242,240,236,0.14)';
export const ACCENT = '#E10600';

/* Page gutter — full-bleed layout hangs off this, no centered column. */
export const PAGE_X = 'clamp(22px, 6vw, 88px)';

/* Type scale — deliberately wide range. The display sizes are meant to be
   10-20x the micro labels, which is what creates hierarchy. */
export const TYPE = {
  /* the countdown number — used as a graphic element, not as text */
  displayXL: 'clamp(88px, 14vw, 190px)',
  /* hero headline */
  displayL: 'clamp(34px, 5.8vw, 76px)',
  /* section headlines */
  displayM: 'clamp(26px, 3.6vw, 46px)',
  /* the one dominant stat */
  statHero: 'clamp(56px, 8vw, 116px)',
  /* secondary stat numbers */
  statSm: 'clamp(26px, 3vw, 40px)',
  body: 'clamp(14px, 1.15vw, 16px)',
  micro: '10.5px',
};

export const MICRO_LABEL: CSSProperties = {
  fontSize: TYPE.micro,
  fontWeight: 500,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
};
