/* ── Alpha Decks: the visual tokens ──
   Everything Decks paints that is not already in ui/kit.tsx. Colours that
   carry data were run through the dataviz validator against the surfaces
   they sit on (#ffffff light, #141418 dark), both modes:

   - CARD STATE (new / learning / due) is categorical identity: palette slots
     1–3, all-pairs CVD ΔE ≥ 9.2, normal-vision ≥ 20.9. Aqua is 2.8:1 on
     white, so a state colour is never shown without its number and word.
   - RATINGS (Again → Easy) are ordinal: one blue ramp, light → dark on
     white and flipped on dark, so "more recall" always reads as "more ink".
   - MASTERY (learning → young → mature) is ordinal too, in ink — so it can
     sit beside the state colours without borrowing their meaning, and red
     stays where the house keeps it: actions, progress, the now-line. */

import type { CardState, DeckSubject, Rating } from './types';
import { SUBJECT_COLORS } from '../schedule/colors';

export const STATE_COLOR = (dark: boolean) => ({
  new: dark ? '#3987e5' : '#2a78d6',
  learning: dark ? '#d95926' : '#eb6834',
  due: dark ? '#199e70' : '#1baf7a',
});

export const stateKey = (s: CardState | undefined | null): 'new' | 'learning' | 'due' =>
  !s ? 'new' : s === 1 || s === 3 ? 'learning' : 'due';

export const STATE_LABEL = { new: 'New', learning: 'Learning', due: 'Review' } as const;

export const RATING_RAMP = (dark: boolean): Record<Rating, string> =>
  dark
    ? { 1: '#184f95', 2: '#2a78d6', 3: '#5598e7', 4: '#9ec5f4' }
    : { 1: '#86b6ef', 2: '#5598e7', 3: '#2a78d6', 4: '#184f95' };

/** Mastery, least to most: learning, young, mature. Unseen is the empty track. */
export const MASTERY_RAMP = (dark: boolean) =>
  dark
    ? { track: 'rgba(255,255,255,0.06)', learning: '#52525b', young: '#a1a1aa', mature: '#f4f4f5' }
    : { track: '#f4f4f5', learning: '#a1a1aa', young: '#52525b', mature: '#18181b' };

/** A deck's own colour: its subject's, which is data (schedule/colors.ts). Ink when it has none. */
export const deckAccent = (subject: DeckSubject | null | undefined, dark: boolean): string =>
  subject ? SUBJECT_COLORS[subject].dot : dark ? '#d4d4d8' : '#3f3f46';

/** The page the room sits on, and the card that sits on it. */
export const room = (dark: boolean) => ({
  page: dark ? '#0B0B0D' : '#F2F0EC',
  card: dark ? '#18181C' : '#FFFFFF',
  layer: dark ? '#141418' : '#FAF9F6',
  layer2: dark ? '#111114' : '#F4F2EE',
  cardShadow: dark
    ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(255,255,255,0.06), 0 50px 120px -40px rgba(0,0,0,0.9), 0 20px 40px -20px rgba(0,0,0,0.6)'
    : '0 0 0 1px rgba(24,24,27,0.05), 0 1px 2px rgba(24,24,27,0.04), 0 40px 80px -36px rgba(24,24,27,0.28), 0 12px 24px -16px rgba(24,24,27,0.12)',
  layerShadow: dark
    ? 'inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 1px rgba(255,255,255,0.07), 0 20px 50px -30px rgba(0,0,0,0.8)'
    : '0 0 0 1px rgba(24,24,27,0.05), 0 14px 30px -24px rgba(24,24,27,0.2)',
  ink: dark ? '#FAFAFA' : '#09090B',
  muted: dark ? '#71717A' : '#71717A',
  faint: dark ? '#52525B' : '#A1A1AA',
  rule: dark ? 'rgba(255,255,255,0.07)' : 'rgba(24,24,27,0.08)',
});

/** "6 min", "1h 12m". */
export const fmtDuration = (ms: number): string => {
  const m = Math.round(ms / 60000);
  if (m < 1) return '<1 min';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

/** "in 3h", "in 12 min", "tomorrow", "in 4 days". */
export const fmtUntil = (iso: string | null, now = Date.now()): string | null => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return 'now';
  const min = Math.round(ms / 60000);
  if (min < 60) return `in ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `in ${h}h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'tomorrow' : `in ${d} days`;
};
