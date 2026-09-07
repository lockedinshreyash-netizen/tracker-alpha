/**
 * Getting the real faces onto the canvas before anything is drawn.
 *
 * `document.fonts` loads lazily: a family referenced only from `ctx.font` is
 * never fetched, and a canvas drawn before the fetch resolves silently renders
 * in a fallback. Both failures are invisible until the PNG is already on
 * someone's Story, so the faces are forced and then *verified* rather than
 * assumed.
 *
 * Satoshi is served here from `fonts.cdnfonts.com`, an unofficial mirror that
 * the app has no control over. It working is not something this module gets to
 * take for granted, which is why there is a real fallback path and a flag
 * saying which one ran.
 */

export interface Faces {
  /** Font-family stack for the display/UI face. */
  sans: string;
  /** Font-family stack for the editorial serif. */
  serif: string;
  /** False when Satoshi did not arrive and the stack fell back. */
  sansLoaded: boolean;
  serifLoaded: boolean;
}

const SANS = "Satoshi, 'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif";
const SANS_FALLBACK = "'Helvetica Neue', Helvetica, Arial, system-ui, sans-serif";
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const SERIF_FALLBACK = "Georgia, 'Times New Roman', serif";

/* The exact weights and styles the cards draw with.
 *
 * 900 and not 800: the mirror serves Satoshi at 300/400/500/700/900 with no 800
 * face, so asking for 800 quietly resolves to 900 anyway — and, worse,
 * `fonts.check('800 …')` answers *true* for a weight that does not exist,
 * which would have made the verification below meaningless. Naming the real
 * weights is what makes the check a check. */
const REQUIRED = [
  "500 100px Satoshi",
  "700 100px Satoshi",
  "900 100px Satoshi",
  "700 100px 'Playfair Display'",
  "italic 400 100px 'Playfair Display'",
];

let cached: Promise<Faces> | null = null;

const check = (spec: string): boolean => {
  try {
    return document.fonts.check(spec);
  } catch {
    return false;
  }
};

const load = async (): Promise<Faces> => {
  if (typeof document === 'undefined' || !document.fonts) {
    return { sans: SANS_FALLBACK, serif: SERIF_FALLBACK, sansLoaded: false, serifLoaded: false };
  }

  /* `allSettled`, not `all`: one weight the mirror does not serve must not cost
     us the four that arrived. A rejected face simply fails its check below. */
  await Promise.allSettled(REQUIRED.map(spec => document.fonts.load(spec)));

  const sansLoaded = check("900 100px Satoshi") && check("500 100px Satoshi");
  const serifLoaded = check("italic 400 100px 'Playfair Display'");

  return {
    sans: sansLoaded ? SANS : SANS_FALLBACK,
    serif: serifLoaded ? SERIF : SERIF_FALLBACK,
    sansLoaded,
    serifLoaded,
  };
};

/**
 * Loaded once per session. The result is stable — a face that failed to arrive
 * on the first card is not going to be there for the second, and re-awaiting
 * `document.fonts.load` on every render would add a tick to every redraw for
 * an answer that cannot change.
 */
export const loadFaces = (): Promise<Faces> => {
  if (!cached) cached = load();
  return cached;
};
