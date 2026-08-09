/**
 * The day-30 wallpaper pack.
 *
 * Every design is pure CSS — layered gradients, no image files. That keeps the
 * bundle flat and means a wallpaper renders instantly instead of popping in
 * behind the UI. To ship a photographic one instead, drop the file in
 * `public/wallpapers/` and return `url('/wallpapers/x.jpg') center/cover`
 * from `background`; nothing else has to change.
 *
 * Two constraints every design here is built to:
 *
 * 1. These sit *behind* every card, so each one stays quiet enough not to
 *    fight the numbers, which are the point of the app. Contrast belongs to
 *    the content, never the backdrop.
 * 2. The same string paints a full viewport and a 64px swatch in the picker,
 *    so sizes are percentages or small px tiles — never viewport units, which
 *    would make the swatch a meaningless crop of one huge shape.
 */

export interface Wallpaper {
  id: string;
  name: string;
  /** One line on why it exists. Shown under the swatch. */
  note: string;
  /** CSS `background` shorthand, per theme. */
  background: (dark: boolean) => string;
  /**
   * Named animated treatment layered over `background`, drawn by
   * `WallpaperLayer`. A CSS `background` cannot move on its own, so anything
   * that drifts needs real elements — see `AURORA_CURTAINS`.
   */
  animation?: 'aurora';
}

/**
 * One ribbon of the aurora.
 *
 * The thing that makes a photograph read as northern lights is not the colour,
 * it is the **rays** — hundreds of fine near-vertical striations, brightest
 * along the ribbon's lower edge and dissolving upwards. A soft green blob has
 * the colour and none of the structure, and looks like a smudge on the lens.
 *
 * So each ribbon is built from repeating hairline gradients rather than a
 * blurred fill, and it is barely blurred at all — enough to soften the rays,
 * never enough to merge them. Every colour is a shade of green.
 */
export interface AuroraCurtain {
  /** Placement and extent, as CSS lengths. */
  left: string;
  width: string;
  top: string;
  height: string;
  /** Lean, in degrees. Ribbons fan; they are never upright or parallel. */
  skew: number;
  /**
   * The luminous sheet the rays sit on.
   *
   * Rays alone are hairlines with gaps between them — about a quarter of the
   * ribbon is actually lit, which averages out to a dark grey-green however
   * saturated the colour is. The sheet supplies the glow; the rays supply the
   * structure. Neither reads as aurora without the other.
   */
  sheet: string;
  /** The rays themselves — two weights, so they do not comb. */
  ray: string;
  rayFaint: string;
  /** The bright lower hem the rays hang from. */
  edge: string;
  /** Sideways drift cycle. */
  duration: string;
  /**
   * Brightness cycle, deliberately unrelated to `duration`, and `shimmer` —
   * the rays sliding within the ribbon — unrelated to both.
   *
   * These are applied as a three-value `animation-duration`. A single value
   * would set *every* keyframe animation, locking a ribbon's brightness and
   * ripple to its position: it would then dim in exactly the same place on
   * every pass, which is the mechanical look this is trying to avoid.
   */
  glow: string;
  shimmer: string;
  delay: string;
}

export const AURORA_CURTAINS: AuroraCurtain[] = [
  /* Saturated, near-fluorescent greens on purpose. These are `screen`-blended
     over a near-black sky, which lifts and desaturates whatever it is given —
     Tailwind's emerald palette came out of it looking like grey searchlights. */
  {
    left: '-10%', width: '30%', top: '-20%', height: '50%', skew: -17,
    sheet: 'rgba(0,240,150,0.24)',
    ray: 'rgba(0,255,160,0.55)', rayFaint: 'rgba(0,209,132,0.32)', edge: 'rgba(178,255,220,0.34)',
    duration: '23s', glow: '9s', shimmer: '17s', delay: '-4s',
  },
  {
    left: '14%', width: '21%', top: '-8%', height: '44%', skew: -8,
    sheet: 'rgba(80,255,190,0.19)',
    ray: 'rgba(90,255,190,0.46)', rayFaint: 'rgba(0,230,150,0.26)', edge: 'rgba(205,255,235,0.28)',
    duration: '31s', glow: '13s', shimmer: '23s', delay: '-11s',
  },
  {
    left: '33%', width: '27%', top: '-24%', height: '62%', skew: 7,
    sheet: 'rgba(0,225,140,0.23)',
    ray: 'rgba(0,235,145,0.52)', rayFaint: 'rgba(0,180,115,0.30)', edge: 'rgba(160,250,205,0.30)',
    duration: '27s', glow: '7s', shimmer: '19s', delay: '-2s',
  },
  {
    left: '55%', width: '19%', top: '0%', height: '40%', skew: 14,
    sheet: 'rgba(60,255,180,0.17)',
    ray: 'rgba(60,255,180,0.42)', rayFaint: 'rgba(0,214,140,0.24)', edge: 'rgba(190,255,228,0.24)',
    duration: '37s', glow: '17s', shimmer: '29s', delay: '-16s',
  },
  {
    left: '69%', width: '29%', top: '-14%', height: '56%', skew: -11,
    sheet: 'rgba(0,235,150,0.18)',
    ray: 'rgba(0,245,155,0.44)', rayFaint: 'rgba(0,190,120,0.26)', edge: 'rgba(170,252,212,0.26)',
    duration: '41s', glow: '11s', shimmer: '31s', delay: '-21s',
  },
  {
    left: '86%', width: '24%', top: '4%', height: '46%', skew: 9,
    sheet: 'rgba(60,250,175,0.15)',
    ray: 'rgba(40,255,170,0.36)', rayFaint: 'rgba(0,200,128,0.20)', edge: 'rgba(185,255,226,0.20)',
    duration: '34s', glow: '15s', shimmer: '25s', delay: '-7s',
  },
];

/**
 * The ambient glow the ribbons cast on everything else.
 *
 * Without this the aurora stops dead at the bottom of its mask, which looks
 * like a band pasted across the top of the page rather than a light source in
 * the room. These are unmasked, heavily blurred and reach far down the
 * viewport, so the green falls off gradually across the whole page.
 */
export interface AuroraGlow {
  left: string;
  width: string;
  top: string;
  height: string;
  color: string;
  blur: number;
  duration: string;
  delay: string;
}

export const AURORA_GLOWS: AuroraGlow[] = [
  { left: '-15%', width: '70%', top: '-25%', height: '105%', color: 'rgba(0,225,140,0.20)', blur: 110, duration: '43s', delay: '-6s' },
  { left: '35%',  width: '80%', top: '-20%', height: '95%',  color: 'rgba(40,240,170,0.16)', blur: 130, duration: '57s', delay: '-23s' },
];

/** Deterministic PRNG. Same stars every load, no runtime randomness. */
const mulberry32 = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * A real starfield: individually placed circles, as an SVG.
 *
 * This used to be tiled `radial-gradient` dots, which is the obvious way to do
 * it and completely wrong — a repeating gradient puts every star on a lattice,
 * and a lattice across a whole viewport reads as graph paper, not as sky. No
 * amount of restyling the dot fixes that; the positions themselves have to be
 * scattered.
 *
 * The tile is deliberately larger than most viewports so its repeat rarely
 * shows, and radii are biased small (`r * r`) because a sky is mostly faint
 * stars with a few bright ones — uniform sizes look synthetic.
 */
const starfield = (count: number, w: number, h: number, seed: number): string => {
  const rnd = mulberry32(seed);
  let circles = '';
  for (let i = 0; i < count; i++) {
    const x = (rnd() * w).toFixed(1);
    const y = (rnd() * h).toFixed(1);
    const r = (0.35 + rnd() * rnd() * 1.2).toFixed(2);
    const o = (0.12 + rnd() * 0.8).toFixed(2);
    circles += `%3Ccircle cx='${x}' cy='${y}' r='${r}' fill='%23fff' opacity='${o}'/%3E`;
  }
  return (
    `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'%3E` +
    `${circles}%3C/svg%3E") 0 0/${w}px ${h}px`
  );
};

const AURORA_STARS = starfield(260, 1400, 1000, 20260809);
const NIGHT_STARS = starfield(300, 1500, 1100, 31415926);

/**
 * Film grain, as a tiled SVG. Desaturated on purpose — coloured turbulence
 * reads as a rendering fault rather than as texture.
 *
 * The opacity is the whole trick. There is no blend mode available inside a
 * `background` shorthand, so this grey noise simply sits on top and lifts
 * everything under it towards grey; at 0.5 it buried two designs in what
 * looked like sandpaper. Kept low enough to feel like texture rather than
 * static — if it is visible as noise, it is too strong.
 */
const GRAIN =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E` +
  `%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E` +
  `%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E` +
  `%3Crect width='140' height='140' filter='url(%23n)' opacity='0.09'/%3E%3C/svg%3E") 0 0/140px 140px`;

export const WALLPAPERS: Wallpaper[] = [
  {
    id: 'ember',
    name: 'Ember',
    note: 'The red, low and off to one side.',
    background: (dark) =>
      dark
        ? `radial-gradient(120% 80% at 15% 100%, rgba(225,6,0,0.20) 0%, rgba(225,6,0,0.05) 35%, transparent 65%),
           radial-gradient(90% 60% at 85% 0%, rgba(255,255,255,0.05) 0%, transparent 55%),
           linear-gradient(180deg, #0B0B0D 0%, #121013 100%)`
        : `radial-gradient(120% 80% at 15% 100%, rgba(225,6,0,0.10) 0%, rgba(225,6,0,0.03) 35%, transparent 65%),
           linear-gradient(180deg, #F2F0EC 0%, #EFE9E4 100%)`,
  },
  {
    id: 'grid',
    name: 'Grid',
    note: 'Ruled paper. Every square is a day.',
    background: (dark) =>
      dark
        ? `linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px) 0 0/32px 32px,
           linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px) 0 0/32px 32px,
           radial-gradient(100% 70% at 50% 0%, rgba(225,6,0,0.10) 0%, transparent 60%),
           #0B0B0D`
        : `linear-gradient(rgba(23,21,15,0.05) 1px, transparent 1px) 0 0/32px 32px,
           linear-gradient(90deg, rgba(23,21,15,0.05) 1px, transparent 1px) 0 0/32px 32px,
           radial-gradient(100% 70% at 50% 0%, rgba(225,6,0,0.05) 0%, transparent 60%),
           #F2F0EC`,
  },
  {
    id: 'redline',
    name: 'Redline',
    note: 'Livery. One line thicker than the rest.',
    background: (dark) =>
      dark
        ? `repeating-linear-gradient(115deg, rgba(255,255,255,0.022) 0 1px, transparent 1px 46px),
           linear-gradient(115deg, transparent 0 57%, rgba(225,6,0,0.14) 57% 58.4%, transparent 58.4% 61.5%,
             rgba(225,6,0,0.55) 61.5% 62.4%, transparent 62.4%),
           linear-gradient(160deg, #111013 0%, #0B0B0D 65%)`
        : `repeating-linear-gradient(115deg, rgba(23,21,15,0.03) 0 1px, transparent 1px 46px),
           linear-gradient(115deg, transparent 0 57%, rgba(225,6,0,0.10) 57% 58.4%, transparent 58.4% 61.5%,
             rgba(225,6,0,0.38) 61.5% 62.4%, transparent 62.4%),
           linear-gradient(160deg, #FFFFFF 0%, #F0EDE7 65%)`,
  },
  {
    /* The base is only the night behind it — every green thing you see is a
       drifting curtain element, not part of this string. */
    id: 'aurora',
    name: 'Aurora',
    note: 'Northern lights. The only soft thing in the whole app.',
    animation: 'aurora',
    background: (dark) =>
      dark
        ? /* Scattered stars behind the ribbons, because every photograph of
             this has them and they are what set the scale. The veil over them
             thins them towards the bottom rather than cutting them off. The
             green belongs to the ribbons — a green wash down here would only
             muddy whatever drifts over it. */
          `${GRAIN},
           linear-gradient(180deg, transparent 0%, rgba(4,6,10,0.35) 48%, rgba(4,6,10,0.8) 78%, rgba(5,8,11,0.94) 100%),
           ${AURORA_STARS},
           radial-gradient(120% 55% at 50% 0%, rgba(6,78,59,0.22) 0%, transparent 74%),
           linear-gradient(180deg, #04060A 0%, #050A0E 58%, #06100E 100%)`
        : `${GRAIN},
           radial-gradient(120% 50% at 50% 0%, rgba(16,185,129,0.10) 0%, transparent 72%),
           linear-gradient(180deg, #F4F6F3 0%, #EDF1EC 100%)`,
  },
  {
    id: 'topo',
    name: 'Topo',
    note: 'Elevation. You are climbing something.',
    background: (dark) =>
      dark
        ? `repeating-radial-gradient(circle at 22% 78%, transparent 0 17px, rgba(255,255,255,0.05) 17px 18px, transparent 18px 19px),
           repeating-radial-gradient(circle at 84% 20%, transparent 0 21px, rgba(225,6,0,0.10) 21px 22px, transparent 22px 23px),
           linear-gradient(150deg, #0D0D10 0%, #0B0B0D 70%)`
        : `repeating-radial-gradient(circle at 22% 78%, transparent 0 17px, rgba(23,21,15,0.055) 17px 18px, transparent 18px 19px),
           repeating-radial-gradient(circle at 84% 20%, transparent 0 21px, rgba(225,6,0,0.08) 21px 22px, transparent 22px 23px),
           linear-gradient(150deg, #FFFFFF 0%, #F0EDE7 70%)`,
  },
  {
    id: 'carbon',
    name: 'Carbon',
    note: 'Light, and stronger than it looks.',
    background: (dark) =>
      dark
        ? `repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 5px),
           repeating-linear-gradient(-45deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 5px),
           radial-gradient(90% 65% at 50% 0%, rgba(225,6,0,0.09) 0%, transparent 62%),
           #0C0C0E`
        : `repeating-linear-gradient(45deg, rgba(23,21,15,0.045) 0 1px, transparent 1px 5px),
           repeating-linear-gradient(-45deg, rgba(23,21,15,0.045) 0 1px, transparent 1px 5px),
           radial-gradient(90% 65% at 50% 0%, rgba(225,6,0,0.06) 0%, transparent 62%),
           #F1EEE9`,
  },
  {
    /* Two interleaved dot fields rather than one. A single field at a single
       size reads as polka dots; offsetting a fainter second field by half a
       tile breaks the rows up, and the diagonal veil does the thinning that
       real halftone gets from varying the dot size — which CSS cannot do. */
    id: 'halftone',
    name: 'Halftone',
    note: 'Printed dots, thinning out as they fall.',
    background: (dark) =>
      dark
        ? `linear-gradient(200deg, rgba(11,11,13,0) 0%, rgba(11,11,13,0.72) 46%, #0B0B0D 78%),
           radial-gradient(rgba(225,6,0,0.8) 1px, transparent 1.5px) 0 0/11px 11px,
           radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1.5px) 5px 5px/11px 11px,
           #0B0B0D`
        : `linear-gradient(200deg, rgba(242,240,236,0) 0%, rgba(242,240,236,0.74) 46%, #F2F0EC 78%),
           radial-gradient(rgba(225,6,0,0.65) 1px, transparent 1.5px) 0 0/11px 11px,
           radial-gradient(rgba(23,21,15,0.12) 1px, transparent 1.5px) 5px 5px/11px 11px,
           #F2F0EC`,
  },
  {
    /* Light with no object in it. There is no disc, no rim and no hard edge
       anywhere — just warm layers stacked from the bottom of the screen,
       coolest and dimmest at the top, so it reads as the hour before the sun
       is actually up. */
    id: 'sunrise',
    name: 'Sunrise',
    note: 'First light, coming up from the bottom.',
    background: (dark) =>
      dark
        ? `radial-gradient(85% 34% at 50% 104%, rgba(255,232,150,0.50) 0%, rgba(255,232,150,0.16) 40%, transparent 72%),
           radial-gradient(110% 46% at 50% 108%, rgba(255,150,40,0.42) 0%, rgba(255,150,40,0.12) 45%, transparent 76%),
           radial-gradient(150% 62% at 50% 112%, rgba(226,68,10,0.34) 0%, transparent 70%),
           radial-gradient(190% 80% at 50% 120%, rgba(150,26,10,0.26) 0%, transparent 72%),
           linear-gradient(180deg, #07080C 0%, #0A0809 48%, #140B08 100%)`
        : `radial-gradient(85% 34% at 50% 104%, rgba(255,214,110,0.55) 0%, rgba(255,214,110,0.18) 40%, transparent 72%),
           radial-gradient(110% 46% at 50% 108%, rgba(255,150,40,0.34) 0%, transparent 74%),
           radial-gradient(160% 66% at 50% 114%, rgba(226,68,10,0.16) 0%, transparent 72%),
           linear-gradient(180deg, #F6F4F0 0%, #F5EEE6 100%)`,
  },
  {
    /* Same id as the design this replaced, so anyone already using it keeps a
       wallpaper instead of silently falling back to the plain background. */
    id: 'midnight',
    name: '3 AM',
    note: 'For the hours nobody sees you working.',
    background: (dark) =>
      dark
        ? /* Individually placed stars — see `starfield`. Tiled dots put every
             star on a lattice and read as graph paper. */
          `${NIGHT_STARS},
           radial-gradient(120% 60% at 50% 110%, rgba(70,90,180,0.22) 0%, transparent 70%),
           linear-gradient(180deg, #08080C 0%, #0B0B12 100%)`
        : /* Stars would read as dust on a light background, so the light
             variant keeps the hour and drops the sky. */
          `radial-gradient(120% 60% at 50% 110%, rgba(70,90,180,0.12) 0%, transparent 70%),
           linear-gradient(180deg, #FFFFFF 0%, #E9E7E4 100%)`,
  },
];

export const wallpaperById = (id: string | null | undefined): Wallpaper | undefined =>
  id ? WALLPAPERS.find(w => w.id === id) : undefined;
