/* ── A lecture's case ──
   A jewel case with original art: the subject is the colour, the catalogue
   number is the case's place on the shelf, the art family is picked from the
   lecture's id (model.ts coverArt). Never a YouTube thumbnail: a shelf makes
   no request to YouTube, and every case looks like it belongs to Alpha.

   One component at every size, from a 48px chip to the 340px hero, so a
   preview is exactly what the shelf shows. Everything is inline style: the
   colours are data, and CDN Tailwind cannot compile a class from a hex. The
   grain filter id is shared by every case on the page; it has no colour in
   it, so whichever copy the browser resolves draws the same noise. */

import React from 'react';
import type { CoverArt, LearnSubject } from './model';

export type Finish = 'ink' | 'paper';

interface Palette { ground: string; accent: string; ink: string; mute: string }

const INK: Record<LearnSubject, Palette> = {
  Physics: { ground: '#0C1726', accent: '#4A90E2', ink: '#DCEAFB', mute: 'rgba(220,234,251,0.62)' },
  Chemistry: { ground: '#0B1E16', accent: '#34C77B', ink: '#D5F2E2', mute: 'rgba(213,242,226,0.62)' },
  Maths: { ground: '#170F24', accent: '#9B59E2', ink: '#E8DCF8', mute: 'rgba(232,220,248,0.62)' },
  Biology: { ground: '#211709', accent: '#E29B29', ink: '#F7E6C8', mute: 'rgba(247,230,200,0.62)' },
};

const PAPER: Record<LearnSubject, Palette> = {
  Physics: { ground: '#ECE6D8', accent: '#2C67AE', ink: '#1B1813', mute: 'rgba(27,24,19,0.62)' },
  Chemistry: { ground: '#E8E7D9', accent: '#1D8452', ink: '#1B1813', mute: 'rgba(27,24,19,0.62)' },
  Maths: { ground: '#ECE5DE', accent: '#7140B5', ink: '#1B1813', mute: 'rgba(27,24,19,0.62)' },
  Biology: { ground: '#EFE5D2', accent: '#A86A10', ink: '#1B1813', mute: 'rgba(27,24,19,0.62)' },
};

export const paletteFor = (subject: LearnSubject, finish: Finish): Palette => (finish === 'paper' ? PAPER : INK)[subject];

interface Props {
  code: string;
  title: string;
  subject: LearnSubject;
  art: CoverArt;
  size: number;
  finish: Finish;
  chapter?: string | null;
  done?: boolean;
}

const MONO = "var(--font-mono, ui-monospace, 'SF Mono', Menlo, monospace)";

export const Art = ({ art, accent, ink }: { art: CoverArt; accent: string; ink: string }) => (
  <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
    {art === 'rings' && (
      <g fill="none" stroke={accent}>
        <circle cx="68" cy="36" r="48" strokeOpacity="0.12" strokeWidth="0.5" />
        <circle cx="68" cy="36" r="38" strokeOpacity="0.2" strokeWidth="0.5" />
        <circle cx="68" cy="36" r="28" strokeOpacity="0.35" strokeWidth="0.5" />
        <circle cx="68" cy="36" r="18" strokeOpacity="0.6" strokeWidth="0.6" />
        <circle cx="68" cy="36" r="7" fill={accent} stroke="none" />
        <line x1="68" y1="36" x2="97" y2="14" stroke={ink} strokeOpacity="0.55" strokeWidth="0.5" />
        <circle cx="86" cy="22" r="1.6" fill={ink} stroke="none" />
      </g>
    )}
    {art === 'waves' && (
      <g fill="none" stroke={accent} strokeWidth="0.6">
        {[[22, 12, 32, 0.18], [30, 18, 42, 0.3], [38, 24, 52, 0.5], [46, 30, 62, 0.85], [54, 40, 68, 0.3]].map(([y, lo, hi, o]) => (
          <path key={y} d={`M0 ${y} C 12.5 ${lo}, 12.5 ${lo}, 25 ${y} S 37.5 ${hi}, 50 ${y} S 62.5 ${lo}, 75 ${y} S 87.5 ${hi}, 100 ${y}`} strokeOpacity={o} />
        ))}
      </g>
    )}
    {art === 'hex' && (
      <g fill="none" stroke={accent} strokeWidth="0.7">
        <polygon points="62,14 77.6,23 77.6,41 62,50 46.4,41 46.4,23" strokeOpacity="0.9" />
        <circle cx="62" cy="32" r="9.5" strokeOpacity="0.55" />
        <line x1="77.6" y1="23" x2="90" y2="16" strokeOpacity="0.6" />
        <line x1="46.4" y1="41" x2="34" y2="48" strokeOpacity="0.6" />
        <polygon points="21.6,41 34,48 34,62 21.6,69 9.2,62 9.2,48" strokeOpacity="0.25" />
        <circle cx="90" cy="16" r="2" fill={accent} stroke="none" />
        <circle cx="62" cy="14" r="1.4" fill={ink} stroke="none" />
      </g>
    )}
    {art === 'orbit' && (
      <g fill="none" stroke={accent} strokeWidth="0.6">
        <ellipse cx="62" cy="36" rx="32" ry="11" transform="rotate(25 62 36)" strokeOpacity="0.75" />
        <ellipse cx="62" cy="36" rx="32" ry="11" transform="rotate(-35 62 36)" strokeOpacity="0.45" />
        <ellipse cx="62" cy="36" rx="32" ry="11" transform="rotate(85 62 36)" strokeOpacity="0.25" />
        <circle cx="62" cy="36" r="5" fill={accent} stroke="none" />
        <circle cx="90" cy="49" r="1.8" fill={ink} stroke="none" />
      </g>
    )}
    {art === 'curve' && (
      <g>
        <path d="M30 70 L30 52 C 40 30, 50 22, 60 25 C 68 27, 72 33, 76 38 L76 70 Z" fill={accent} fillOpacity="0.32" />
        <path d="M6 70 C 18 69, 25 60, 30 52 C 40 30, 50 22, 60 25 C 70 28, 82 46, 98 40" fill="none" stroke={accent} strokeWidth="0.9" />
        <line x1="6" y1="70" x2="98" y2="70" stroke={ink} strokeOpacity="0.4" strokeWidth="0.4" />
        <line x1="30" y1="70" x2="30" y2="52" stroke={ink} strokeOpacity="0.6" strokeWidth="0.4" />
        <line x1="76" y1="70" x2="76" y2="38" stroke={ink} strokeOpacity="0.6" strokeWidth="0.4" />
      </g>
    )}
  </svg>
);

const CdCase = ({ code, title, subject, art, size, finish, chapter, done }: Props) => {
  const s = size;
  const pal = paletteFor(subject, finish);
  const r = Math.max(2, Math.round(s * 0.016));
  const hinge = Math.max(4, Math.round(s * 0.06));
  const pad = Math.round(s * 0.075);
  const showText = s >= 112;
  const tick = Math.max(12, Math.round(s * 0.085));

  return (
    <span
      className="ln-case"
      style={{ position: 'relative', display: 'block', width: s, height: s, borderRadius: r, background: '#08080A', flexShrink: 0 }}
    >
      <span style={{ position: 'absolute', left: hinge, top: 0, right: 0, bottom: 0, background: pal.ground, overflow: 'hidden', borderRadius: `0 ${r}px ${r}px 0` }}>
        <Art art={art} accent={pal.accent} ink={pal.ink} />
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: finish === 'paper' ? 0.22 : 0.14, mixBlendMode: 'overlay' }} aria-hidden="true">
          <filter id="ln-grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
          <rect width="100%" height="100%" filter="url(#ln-grain)" />
        </svg>
        {showText ? (
          <span style={{ position: 'absolute', inset: 0, padding: pad, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxSizing: 'border-box', textAlign: 'left' }}>
            <span style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: Math.max(8, Math.round(s * 0.048)), letterSpacing: '0.08em', color: pal.ink, fontWeight: 500 }}>
              <span>{code}</span>
              <span style={{ opacity: 0.55, fontFamily: 'Georgia, serif' }}>α</span>
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: Math.max(2, Math.round(s * 0.025)) }}>
              <span
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif", fontSize: Math.round(s * 0.1), lineHeight: 1.06, color: pal.ink,
                  display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere',
                }}
              >
                {title}
              </span>
              {chapter && (
                <span style={{ fontFamily: MONO, fontSize: Math.max(7, Math.round(s * 0.036)), letterSpacing: '0.1em', textTransform: 'uppercase', color: pal.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {chapter}
                </span>
              )}
            </span>
          </span>
        ) : (
          <span style={{ position: 'absolute', left: pad, top: pad, fontFamily: MONO, fontSize: Math.max(8, Math.round(s * 0.13)), letterSpacing: '0.04em', color: pal.ink, fontWeight: 700 }}>
            {code.split('-')[1]}
          </span>
        )}
      </span>
      <span
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: hinge, borderRadius: `${r}px 0 0 ${r}px`,
          background: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, rgba(255,255,255,0.02) 1px, rgba(255,255,255,0.02) 3px), linear-gradient(90deg, #1B1B20, #0E0E11)',
          borderRight: '1px solid rgba(255,255,255,0.10)',
        }}
      />
      <span
        style={{
          position: 'absolute', inset: 0, borderRadius: r, border: '1px solid rgba(255,255,255,0.16)', pointerEvents: 'none',
          background: 'linear-gradient(118deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.04) 26%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 64%, rgba(255,255,255,0.06) 74%, rgba(255,255,255,0) 84%)',
        }}
      />
      {done && (
        <span
          role="img"
          aria-label="Watched"
          style={{
            position: 'absolute', left: hinge + Math.round(s * 0.05), bottom: Math.round(s * 0.05), width: tick, height: tick, borderRadius: 999,
            background: pal.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          <svg viewBox="0 0 12 12" style={{ width: '62%', height: '62%' }} aria-hidden="true">
            <path d="M2.5 6.2 5 8.5 9.5 3.5" fill="none" stroke="#08080A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </span>
  );
};

export default CdCase;
