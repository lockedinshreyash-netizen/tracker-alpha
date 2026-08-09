import React from 'react';
import { AURORA_CURTAINS, AURORA_GLOWS, Wallpaper } from './wallpapers';

interface Props {
  wallpaper: Wallpaper;
  dark: boolean;
  /** Positioning for the wrapper — full-bleed in the app, a tile in the picker. */
  className?: string;
  /**
   * Swatch mode. The animation is identical; only the blur radius shrinks,
   * because a 60px blur inside a 64px-tall tile is just a smear.
   */
  preview?: boolean;
}

/**
 * Northern lights: soft vertical curtains that drift sideways and breathe.
 *
 * `screen` blending is what makes them behave like light rather than paint —
 * overlapping curtains brighten instead of muddying. That only works against a
 * dark sky, so the light theme falls back to normal blending at lower opacity.
 */
const AuroraCurtains: React.FC<{ dark: boolean; preview?: boolean }> = ({ dark, preview }) => (
  <>
    {/* Ambient spill first, so it sits under the ribbons and carries their
        light down the rest of the page instead of ending at the mask. */}
    {AURORA_GLOWS.map((g, i) => (
      <div
        key={`glow-${i}`}
        className="aurora-spill"
        style={{
          left: g.left,
          width: g.width,
          top: g.top,
          height: g.height,
          background: `radial-gradient(60% 50% at 50% 32%, ${g.color} 0%, transparent 72%)`,
          filter: `blur(${preview ? 18 : g.blur}px)`,
          mixBlendMode: dark ? 'screen' : 'normal',
          opacity: dark ? undefined : 0.4,
          animationDuration: g.duration,
          animationDelay: g.delay,
        }}
      />
    ))}
    {AURORA_CURTAINS.map((c, i) => (
      <div
        key={i}
        className="aurora-curtain"
        style={{
          left: c.left,
          width: c.width,
          top: c.top,
          height: c.height,
          background: [
            // The bright hem along the bottom of the ribbon, over the rays.
            `linear-gradient(to bottom, transparent 46%, ${c.edge} 82%, transparent 99%)`,
            /* The rays. Two repeating hairline gradients on different periods
               (13px and 23px) so the striations read as irregular rather than
               as the teeth of a comb. */
            `repeating-linear-gradient(90deg, transparent 0 2px, ${c.ray} 2px 3px,
               transparent 3px 6px, ${c.rayFaint} 6px 7px, transparent 7px 13px)`,
            `repeating-linear-gradient(90deg, transparent 0 5px, ${c.rayFaint} 5px 6px, transparent 6px 23px)`,
            // The sheet, underneath everything: the actual green light.
            `linear-gradient(to bottom, transparent 6%, ${c.sheet} 58%, ${c.sheet} 80%, transparent 98%)`,
          ].join(', '),
          /* Just enough to take the hard edge off a 1px ray. Anything near the
             38px this used to be turns the whole thing back into a smudge. */
          filter: `blur(${preview ? 1.5 : 4}px)`,
          mixBlendMode: dark ? 'screen' : 'normal',
          opacity: dark ? undefined : 0.45,
          // Three values: drift, glow, shimmer. See AuroraCurtain.
          animationDuration: `${c.duration}, ${c.glow}, ${c.shimmer}`,
          animationDelay: `${c.delay}, ${c.delay}, ${c.delay}`,
          ['--au-skew' as string]: `${c.skew}deg`,
        }}
      />
    ))}
  </>
);

/**
 * Paints a wallpaper: the static gradient stack, plus any animated layers it
 * declares. Used both for the app background and for the picker swatches, so
 * what a user previews is exactly what they get.
 */
const WallpaperLayer: React.FC<Props> = ({ wallpaper, dark, className = '', preview }) => (
  <div
    aria-hidden
    className={`overflow-hidden ${className}`}
    style={{ background: wallpaper.background(dark) }}
  >
    {wallpaper.animation === 'aurora' && <AuroraCurtains dark={dark} preview={preview} />}
  </div>
);

export default WallpaperLayer;
