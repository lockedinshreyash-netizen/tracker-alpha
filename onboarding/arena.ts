/* ── The Arena: the onboarding's cold open ──
   One film, two readers. The film project renders it (film/src/arena) into
   public/onboarding/arena.{mp4,webm}; the app plays it and lays its words over
   the top in sync (onboarding/ColdOpen.tsx). Both read these numbers, so the
   red light turns red on the frame the words say "This one is you."

   The words are not baked into the video because one of them is live: the
   first line is the viewer's own clock ("It's 9:14 pm."). */

export const ARENA_FPS = 30;
export const ARENA_SIZE = 1280;
/** Square, so `object-fit: cover` crops evenly on a phone and on a laptop. */
export const ARENA_SECONDS = 8.6;
export const ARENA_FRAMES = Math.round(ARENA_SECONDS * ARENA_FPS);

/** Seconds into the film. */
export const BEATS = {
  /** One lamp, close. "It's 9:14 pm." */
  time: 0.35,
  /** The camera starts to pull back; neighbours switch on. */
  someone: 2.2,
  /** The city fills in. */
  lakhs: 4.2,
  /** The lamp at the centre turns red. "This one is you." */
  you: 6.05,
  /** Everything but the red light goes dark. */
  out: 7.25,
  /** Black, the red light alone at the exact centre of the frame. */
  end: ARENA_SECONDS,
} as const;

/** The still behind the questions: the wide shot, red light at the centre. */
export const ARENA_WIDE_FRAME = Math.round(6.9 * ARENA_FPS);
