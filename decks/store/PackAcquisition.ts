/* ── Taking a pack: the states ──
   One reducer, explicit phases, and nothing else allowed:

     IDLE → SELECTED → ACQUIRING → DETACHING → CENTERING → TEARING
          → REVEALING → TRANSITIONING → ACQUIRED → IDLE

   ACQUIRING is the server's turn. The pack only comes off its hook after
   `add_pack` (and, for a paid pack, the payment hook before it) has said
   yes. The animation shows a pack that is already yours, never a hopeful one.
   Every event that does not fit the current phase returns the same state
   object. So a double tap, a second click mid-animation or a stray Escape
   during the tear changes nothing, and a pack cannot be taken twice.

   React-free, so the rules are tested (decks/tests/store.test.ts). */

export type Phase =
  | 'idle' | 'selected' | 'acquiring'
  | 'detaching' | 'centering' | 'tearing' | 'revealing' | 'transitioning'
  | 'acquired';

export interface AcqState {
  phase: Phase;
  packId: string | null;
  /** The last refusal, shown under the button. */
  error: string | null;
}

export type AcqEvent =
  | { type: 'SELECT'; packId: string }
  | { type: 'DESELECT' }
  | { type: 'ACQUIRE' }
  | { type: 'CONFIRMED' }
  | { type: 'FAILED'; error: string }
  | { type: 'STEP' }
  | { type: 'FINISH' };

export const IDLE: AcqState = { phase: 'idle', packId: null, error: null };

/** The opening, in order. STEP moves one along. */
export const SEQUENCE: Phase[] = ['detaching', 'centering', 'tearing', 'revealing', 'transitioning', 'acquired'];

/** Anything past SELECTED: the store is busy and every other pack waits. */
export const isBusy = (s: AcqState) => s.phase !== 'idle' && s.phase !== 'selected';
export const isOpening = (s: AcqState) => SEQUENCE.includes(s.phase);

export const transition = (s: AcqState, e: AcqEvent): AcqState => {
  switch (e.type) {
    case 'SELECT':
      if (s.phase !== 'idle' && s.phase !== 'selected') return s;
      if (s.phase === 'selected' && s.packId === e.packId) return s;
      return { phase: 'selected', packId: e.packId, error: null };
    case 'DESELECT':
      return s.phase === 'selected' ? IDLE : s;
    case 'ACQUIRE':
      return s.phase === 'selected' ? { ...s, phase: 'acquiring', error: null } : s;
    case 'CONFIRMED':
      return s.phase === 'acquiring' ? { ...s, phase: 'detaching' } : s;
    case 'FAILED':
      return s.phase === 'acquiring' ? { ...s, phase: 'selected', error: e.error } : s;
    case 'STEP': {
      const i = SEQUENCE.indexOf(s.phase);
      if (i < 0 || i === SEQUENCE.length - 1) return s;
      return { ...s, phase: SEQUENCE[i + 1] };
    }
    case 'FINISH':
      return s.phase === 'acquired' ? IDLE : s;
    default:
      return s;
  }
};
