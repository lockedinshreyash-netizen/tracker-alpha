/**
 * The showcase's look: the landing page's room (warm near-black, bone white,
 * Playfair at 400, one red wax seal) holding the app's own UI, drawn in the
 * app's own tokens. Nothing here is a screenshot; every number is a demo.
 */
import { loadFont } from '@remotion/fonts';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as loadLiterata } from '@remotion/google-fonts/Literata';
import { Easing, interpolate, spring, staticFile } from 'remotion';

for (const weight of ['400', '500', '700', '900'] as const) {
  loadFont({ family: 'Satoshi', url: staticFile(`fonts/Satoshi-${weight}.woff2`), weight });
}
loadPlayfair('normal', { weights: ['400'], subsets: ['latin'] });
loadPlayfair('italic', { weights: ['400'], subsets: ['latin'] });
loadLiterata('normal', { weights: ['400', '600'], subsets: ['latin'] });
loadLiterata('italic', { weights: ['400'], subsets: ['latin'] });

export const SANS = "Satoshi, 'Helvetica Neue', Helvetica, Arial, sans-serif";
export const SERIF = "'Playfair Display', Georgia, serif";
export const BOOK = "Literata, Georgia, serif";
export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
/** Playfair has no Greek, so the α is Georgia, upright (landing/landing.css, --alpha). */
export const ALPHA_FACE = "Georgia, 'Times New Roman', serif";

/* The landing page's room (landing/landing.css). */
export const NIGHT = '#0b0a09';
export const BONE = '#ece6da';
export const BONE_2 = 'rgba(236, 230, 218, 0.64)';
export const BONE_3 = 'rgba(236, 230, 218, 0.4)';
export const HAIR = 'rgba(236, 230, 218, 0.13)';

/* The app, dark (ui/kit.tsx, index.css). */
export const APP = {
  page: '#0B0B0D',
  card: '#111114',
  edge: 'rgba(255, 255, 255, 0.06)',
  inset: 'rgba(255, 255, 255, 0.025)',
  ink: '#FAFAFA',
  z300: '#d4d4d8',
  z400: '#a1a1aa',
  z500: '#71717a',
  z600: '#52525b',
  z700: '#3f3f46',
  z800: '#27272a',
  accent: '#E10600',
  green: '#22c55e',
  yellow: '#eab308',
};

/* ── Motion ── */

export const OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const LINEAR = Easing.linear;

/** interpolate, clamped at both ends, eased out by default. */
export const tw = (f: number, input: [number, number], output: [number, number], easing = OUT): number =>
  interpolate(f, input, output, { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

/** A spring from 0 to 1 that starts at `at`. */
export const pop = (f: number, at: number, fps: number, damping = 14, stiffness = 150): number =>
  spring({ frame: f - at, fps, config: { damping, stiffness, mass: 0.9 } });
