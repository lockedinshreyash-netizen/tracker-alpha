import React from 'react';

/* ── Alpha Avatars ──
   Tracker Alpha's own avatar set: 16 badges, no image files. Same reasoning
   rewards/wallpapers.ts gives for wallpapers — a generated design renders
   instantly instead of popping in, and there is nothing to host or version.
   Each glyph is drawn in the exact stroke language Sidebar.tsx's TabIcon
   already uses (24×24 viewBox, stroke="currentColor", weight 1.8, round caps)
   so a badge reads as part of this app's own icon set, not a borrowed one —
   and deliberately geometric/iconographic rather than cartoon mascots, the
   thing the brief explicitly warns against.

   avatar_id is the only thing profiles.sql stores for an Alpha Avatar — this
   registry is code, so adding #17 is one entry here, never a migration. */

export interface AlphaAvatar {
  id: string;
  /** Shown as a label in the picker; never on the avatar itself. */
  name: string;
  /** children of a 24×24 <svg>, stroke="currentColor" already applied by the wrapper. */
  glyph: React.ReactNode;
  /** Badge background. A handful of near-black tones for variety — never the accent, which stays reserved for selection state and the rest of the app's actions. */
  tone: string;
}

const glyphProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/* Five dark neutral tones, all drawn from the app's own near-black family
   (bg-base/card/inset) rather than inventing a new palette. */
export const TONES = ['#141417', '#111114', '#17171c', '#0D0D10', '#191a20'];

export const ALPHA_AVATARS: AlphaAvatar[] = [
  {
    id: 'alpha_01', name: 'Mark', tone: TONES[0],
    glyph: <><path d="M12 4L5 20" /><path d="M12 4l7 16" /><path d="M8.2 14.5h7.6" /></>,
  },
  {
    id: 'alpha_02', name: 'Focus', tone: TONES[1],
    glyph: <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" />
      <line x1="12" y1="2.5" x2="12" y2="5.5" />
      <line x1="12" y1="18.5" x2="12" y2="21.5" />
      <line x1="2.5" y1="12" x2="5.5" y2="12" />
      <line x1="18.5" y1="12" x2="21.5" y2="12" />
    </>,
  },
  {
    id: 'alpha_03', name: 'Ascent', tone: TONES[2],
    glyph: <><polyline points="6 17 12 11 18 17" /><polyline points="6 11 12 5 18 11" /></>,
  },
  {
    id: 'alpha_04', name: 'Code', tone: TONES[3],
    glyph: <><polyline points="9 7 4 12 9 17" /><polyline points="15 7 20 12 15 17" /></>,
  },
  {
    id: 'alpha_05', name: 'Flask', tone: TONES[4],
    glyph: <>
      <path d="M10 3h4" />
      <path d="M10.5 3v6l-5 9.5a1.5 1.5 0 0 0 1.3 2.5h10.4a1.5 1.5 0 0 0 1.3-2.5l-5-9.5V3" />
      <line x1="8.5" y1="15" x2="15.5" y2="15" />
    </>,
  },
  {
    id: 'alpha_06', name: 'Compass', tone: TONES[1],
    glyph: <><circle cx="12" cy="12" r="9" /><polygon points="15 9 13 13 9 15 11 11" /></>,
  },
  {
    id: 'alpha_07', name: 'Flag', tone: TONES[0],
    glyph: <><line x1="5" y1="21" x2="5" y2="3" /><path d="M5 4h13l-3.5 4L18 12H5" /></>,
  },
  {
    id: 'alpha_08', name: 'Night', tone: TONES[3],
    glyph: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" />,
  },
  {
    id: 'alpha_09', name: 'Sunrise', tone: TONES[2],
    glyph: <>
      <path d="M4 15h16" />
      <path d="M8 15a4 4 0 0 1 8 0" />
      <line x1="12" y1="4" x2="12" y2="7" />
      <line x1="5.5" y1="9.5" x2="7.4" y2="11" />
      <line x1="18.5" y1="9.5" x2="16.6" y2="11" />
    </>,
  },
  {
    id: 'alpha_10', name: 'Peak', tone: TONES[4],
    glyph: <>
      <path d="M3 19l6-11 4 6 2-3 6 8H3z" />
      <line x1="9" y1="8" x2="9" y2="3" />
      <path d="M9 3l4 2-4 2" />
    </>,
  },
  {
    id: 'alpha_11', name: 'Rocket', tone: TONES[1],
    glyph: <>
      <path d="M12 3c3 2 4.5 5.5 4.5 9.5S14 19 12 21c-2-2-4.5-4.5-4.5-8.5S9 5 12 3z" />
      <circle cx="12" cy="10" r="1.5" />
      <path d="M8.5 16.5L6 19M15.5 16.5L18 19" />
    </>,
  },
  {
    id: 'alpha_12', name: 'Shield', tone: TONES[0],
    glyph: <path d="M12 3l7 3v6c0 5-3.5 7.5-7 9-3.5-1.5-7-4-7-9V6l7-3z" />,
  },
  {
    id: 'alpha_13', name: 'Hourglass', tone: TONES[2],
    glyph: <path d="M6 3h12M6 21h12M6 3v3.5a3 3 0 0 0 1.2 2.4L12 12l-4.8 3.1A3 3 0 0 0 6 17.5V21M18 3v3.5a3 3 0 0 1-1.2 2.4L12 12l4.8 3.1a3 3 0 0 1 1.2 2.4V21" />,
  },
  {
    id: 'alpha_14', name: 'Split', tone: TONES[3],
    glyph: <>
      <circle cx="12" cy="13" r="8" />
      <line x1="12" y1="13" x2="12" y2="9" />
      <line x1="12" y1="13" x2="15" y2="14.5" />
      <line x1="9" y1="2" x2="15" y2="2" />
      <line x1="12" y1="2" x2="12" y2="4.5" />
    </>,
  },
  {
    id: 'alpha_15', name: 'Orbit', tone: TONES[4],
    glyph: <>
      <circle cx="12" cy="12" r="1.8" />
      <ellipse cx="12" cy="12" rx="9" ry="4" />
      <circle cx="20.3" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </>,
  },
  {
    id: 'alpha_16', name: 'Alpha Points', tone: TONES[1],
    glyph: <>
      <path d="M6 9l3-6h6l3 6-6 12-6-12z" />
      <path d="M6 9h12" />
      <path d="M9 3l1.5 6M15 3l-1.5 6" />
    </>,
  },
];

const BY_ID: Record<string, AlphaAvatar> = Object.fromEntries(ALPHA_AVATARS.map(a => [a.id, a]));

export const DEFAULT_ALPHA_AVATAR_ID = 'alpha_01';

export const getAlphaAvatar = (id: string | null | undefined): AlphaAvatar =>
  (id && BY_ID[id]) || BY_ID[DEFAULT_ALPHA_AVATAR_ID];

/** Renders one badge. Sizing is the caller's — this only draws the 24×24 art at the given box size. */
export const AlphaAvatarGlyph: React.FC<{ avatar: AlphaAvatar; size: number }> = ({ avatar, size }) => (
  <div
    className="flex items-center justify-center rounded-full"
    style={{ width: size, height: size, background: avatar.tone, color: '#F2F0EC' }}
  >
    <svg {...glyphProps} width={size * 0.56} height={size * 0.56}>
      {avatar.glyph}
    </svg>
  </div>
);
