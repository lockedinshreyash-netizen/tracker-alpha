/**
 * Three grounds, one system.
 *
 * The cards are the only surface in the app that is neither the dark theme nor
 * the light one — they are print, and they carry their own colour whichever
 * theme generated them. A card that changed with the app theme would not be a
 * recognisable artifact; it would be a screenshot.
 *
 * `#E10600` appears nowhere here on purpose. The accent belongs to actions and
 * to the now-line, exactly as `schedule/colors.ts` reserves it — a card is not
 * an action, and a red mark on it would read as a notification.
 */

import { CardPeriod } from '../types';

export interface Palette {
  /** The ground. */
  bg: string;
  /** Primary type. */
  ink: string;
  /** Metadata, labels, axis. */
  muted: string;
  /** Hairline rules and dividers. */
  rule: string;
  /** Bars, and the fill of an active day. */
  mark: string;
  /** A day that happened but fell short of the goal. */
  markSoft: string;
  /** A day that did not happen — drawn as an outline, never as nothing. */
  markEmpty: string;
}

const PALETTES: Record<CardPeriod, Palette> = {
  /* Private, late-night. Nearly the app's own `--bg-base`, so a Daily card
     shared from the dark theme looks like it came from the same place. */
  daily: {
    bg: '#0B0B0D',
    ink: '#F5F2EC',
    muted: '#77767D',
    rule: 'rgba(245, 242, 236, 0.16)',
    mark: 'rgba(245, 242, 236, 0.95)',
    markSoft: 'rgba(245, 242, 236, 0.30)',
    markEmpty: 'rgba(245, 242, 236, 0.15)',
  },
  /* Warm paper rather than white — the same warmth as `--bg-base-light`,
     pushed one step deeper so it reads as stock and not as an empty page. */
  weekly: {
    bg: '#EDE9E0',
    ink: '#14140F',
    muted: '#7E7A6E',
    rule: 'rgba(20, 20, 15, 0.18)',
    mark: 'rgba(20, 20, 15, 0.78)',
    markSoft: 'rgba(20, 20, 15, 0.28)',
    markEmpty: 'rgba(20, 20, 15, 0.13)',
  },
  /* Deep, monumental. Green dark enough to be almost black, so the cream type
     carries the whole card and the colour is felt rather than seen. */
  monthly: {
    bg: '#132119',
    ink: '#F0EDE4',
    muted: '#728576',
    rule: 'rgba(240, 237, 228, 0.16)',
    mark: 'rgba(240, 237, 228, 0.97)',
    markSoft: 'rgba(240, 237, 228, 0.28)',
    markEmpty: 'rgba(240, 237, 228, 0.14)',
  },
};

export const paletteFor = (period: CardPeriod): Palette => PALETTES[period];
