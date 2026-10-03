import { PRE_ROLL, TIMELINE } from './timeline';

/** FNV-1a over the timing grid. The score renderer writes this value next to
 *  score.wav; the composition recomputes it and refuses to pair a picture
 *  with a score built from a different timeline. */
export const timelineSignature = (): string => {
  const src = JSON.stringify({ steps: TIMELINE.steps.map(s => [s.start, s.frames]), notes: TIMELINE.notes.length, pre: PRE_ROLL });
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};
