/**
 * Harmony is the syllabus.
 *
 * The progression only moves forward when chapters are completed, so weeks
 * of study without finishing anything sit on one chord, and a finished
 * syllabus is the only way to reach the dominant. After that it is revision:
 * the music rocks between ♭VI and V, building pull, and refuses to resolve.
 * The tonic is held back for the very last note of the film.
 *
 * Key: D minor.
 */

export interface Chord {
  name: string;
  root: number; // pitch class
  tones: number[]; // pitch classes, root first
}

const C = (name: string, root: number, tones: number[]): Chord => ({ name, root, tones });

export const STAGES: Chord[] = [
  C('Dm', 2, [2, 5, 9]),
  C('B♭maj7', 10, [10, 2, 5, 9]),
  C('F', 5, [5, 9, 0]),
  C('C', 0, [0, 4, 7]),
  C('Gm7', 7, [7, 10, 2, 5]),
  C('B♭', 10, [10, 2, 5]),
  C('Dm7', 2, [2, 5, 9, 0]),
  C('E♭maj7', 3, [3, 7, 10, 2]),
  C('Gm/B♭', 10, [10, 2, 7]),
  C('A', 9, [9, 1, 4]),
];

/** Revision: ♭VI ↔ V, two bars each. */
export const REVISION: [Chord, Chord] = [C('B♭', 10, [10, 2, 5]), C('A', 9, [9, 1, 4])];

export const TONIC_D = 2;

export const stageFor = (fraction: number): number =>
  fraction >= 1 ? STAGES.length - 1 : Math.min(STAGES.length - 2, Math.floor(fraction * (STAGES.length - 1)));

/** Every MIDI note in [lo, hi] whose pitch class is a chord tone, ascending. */
export const tonesInRange = (chord: Chord, lo: number, hi: number): number[] => {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (chord.tones.includes(((m % 12) + 12) % 12)) out.push(m);
  return out;
};

/** The chord tone in range nearest to `target`. */
export const nearestTone = (chord: Chord, target: number, lo = 48, hi = 96): number => {
  const tones = tonesInRange(chord, lo, hi);
  let best = tones[0];
  for (const t of tones) if (Math.abs(t - target) < Math.abs(best - target)) best = t;
  return best;
};

/** Root as a bass note in octave 2 (D2 = 38). */
export const bassNote = (chord: Chord): number => {
  let m = 36 + chord.root;
  if (m > 43) m -= 12;
  return m;
};

export const midiToHz = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
