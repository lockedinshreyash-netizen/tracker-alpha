/* ── A book's cover, and the object it is printed on ──
   Thirty designs, every one drawn here as SVG: no image files, the same
   stance as Learn's cases (learn/CdCase.tsx) and the reward wallpapers. A
   design is a motif (15 of them) set in one of two compositions, coloured by
   the subject (`paletteFor`, ink or paper), with the title in Playfair.

   The kind decides the object: a textbook is a hardcover with a spine and
   page edges, a module is spiral bound, a DPP is a stapled stack of sheets,
   notes are a notebook with an elastic band. One component at every size,
   from the 56px chip in a picker to the hero, so a preview is exactly what
   the shelf shows. Colours are data, so everything is inline style.

   A design id is `<motif>-<layout>`; an id this file does not know draws the
   book's default, so a design removed later never leaves a blank cover. */

import React from 'react';
import { paletteFor } from '../learn/CdCase';
import type { BookCover, BookKind, BookSubject } from './model';
import { hashOf } from './model';

type Motif =
  | 'rings' | 'waves' | 'hex' | 'orbit' | 'curve' | 'grid' | 'prism' | 'helix'
  | 'lattice' | 'contour' | 'spiral' | 'stars' | 'ruled' | 'field' | 'sine';
type Layout = 'classic' | 'band';

const MOTIFS: Motif[] = ['rings', 'waves', 'hex', 'orbit', 'curve', 'grid', 'prism', 'helix', 'lattice', 'contour', 'spiral', 'stars', 'ruled', 'field', 'sine'];
const LAYOUTS: Layout[] = ['classic', 'band'];

export const COVER_DESIGNS: string[] = LAYOUTS.flatMap(l => MOTIFS.map(m => `${m}-${l}`));

/* Which motifs suit which subject, so a book's default looks like it belongs. */
const SUITED: Record<BookSubject | 'none', Motif[]> = {
  Physics: ['orbit', 'waves', 'field', 'sine', 'rings'],
  Chemistry: ['hex', 'lattice', 'prism', 'orbit', 'helix'],
  Maths: ['curve', 'grid', 'spiral', 'contour', 'sine'],
  Biology: ['helix', 'contour', 'stars', 'waves', 'hex'],
  none: ['ruled', 'grid', 'rings', 'stars', 'contour'],
};

export const defaultDesign = (id: string, subject?: BookSubject): string => {
  const set = SUITED[subject ?? 'none'];
  const h = hashOf(id);
  return `${set[h % set.length]}-${LAYOUTS[(h >>> 8) % 2]}`;
};

const parse = (design: string, fallback: string): { motif: Motif; layout: Layout } => {
  const [m, l] = (COVER_DESIGNS.includes(design) ? design : fallback).split('-') as [Motif, Layout];
  return { motif: m, layout: l };
};

interface Palette { ground: string; accent: string; ink: string; mute: string }

const NEUTRAL: Record<'ink' | 'paper', Palette> = {
  ink: { ground: '#141417', accent: '#A9A9B3', ink: '#EDEDF0', mute: 'rgba(237,237,240,0.6)' },
  paper: { ground: '#ECE8E0', accent: '#55524B', ink: '#1B1813', mute: 'rgba(27,24,19,0.6)' },
};

export const coverPalette = (subject: BookSubject | undefined, finish: 'ink' | 'paper'): Palette =>
  subject ? paletteFor(subject, finish) : NEUTRAL[finish];

/* ── Motifs: a 100 × 140 artboard; the title sits in the lower part (classic) or on the band ── */

const MotifArt = ({ motif, a, i }: { motif: Motif; a: string; i: string }) => {
  switch (motif) {
    case 'rings':
      return (
        <g fill="none" stroke={a}>
          {[52, 42, 32, 22, 12].map((r, k) => <circle key={r} cx="70" cy="40" r={r} strokeOpacity={0.12 + k * 0.16} strokeWidth="0.5" />)}
          <circle cx="70" cy="40" r="5" fill={a} stroke="none" />
          <line x1="70" y1="40" x2="98" y2="18" stroke={i} strokeOpacity="0.5" strokeWidth="0.4" />
        </g>
      );
    case 'waves':
      return (
        <g fill="none" stroke={a} strokeWidth="0.6">
          {[20, 28, 36, 44, 52, 60].map((y, k) => (
            <path key={y} d={`M0 ${y} C 12 ${y - 9}, 25 ${y - 9}, 37 ${y} S 62 ${y + 9}, 75 ${y} S 92 ${y - 9}, 100 ${y}`} strokeOpacity={0.15 + k * 0.14} />
          ))}
        </g>
      );
    case 'hex':
      return (
        <g fill="none" stroke={a} strokeWidth="0.6">
          {[[62, 30, 0.9], [84, 42, 0.5], [40, 42, 0.35], [62, 54, 0.6], [84, 18, 0.25], [40, 18, 0.2]].map(([x, y, o]) => (
            <polygon key={`${x}-${y}`} points={`${x},${y - 12} ${x + 10.4},${y - 6} ${x + 10.4},${y + 6} ${x},${y + 12} ${x - 10.4},${y + 6} ${x - 10.4},${y - 6}`} strokeOpacity={o} />
          ))}
          <circle cx="62" cy="30" r="6" strokeOpacity="0.6" />
        </g>
      );
    case 'orbit':
      return (
        <g fill="none" stroke={a} strokeWidth="0.55">
          {[25, -35, 85].map((r, k) => <ellipse key={r} cx="64" cy="40" rx="34" ry="11" transform={`rotate(${r} 64 40)`} strokeOpacity={0.75 - k * 0.22} />)}
          <circle cx="64" cy="40" r="5" fill={a} stroke="none" />
          <circle cx="94" cy="54" r="1.6" fill={i} stroke="none" />
        </g>
      );
    case 'curve':
      return (
        <g>
          <path d="M28 76 L28 56 C 38 32, 50 22, 60 26 C 68 29, 72 36, 78 42 L78 76 Z" fill={a} fillOpacity="0.3" />
          <path d="M4 76 C 16 75, 23 65, 28 56 C 38 32, 50 22, 60 26 C 70 30, 82 50, 98 44" fill="none" stroke={a} strokeWidth="0.9" />
          <line x1="4" y1="76" x2="98" y2="76" stroke={i} strokeOpacity="0.4" strokeWidth="0.4" />
          <line x1="10" y1="80" x2="10" y2="8" stroke={i} strokeOpacity="0.4" strokeWidth="0.4" />
        </g>
      );
    case 'grid':
      return (
        <g stroke={a} strokeWidth="0.3">
          {Array.from({ length: 11 }, (_, k) => <line key={`v${k}`} x1={k * 10} y1="0" x2={k * 10} y2="80" strokeOpacity={k === 6 ? 0.8 : 0.2} />)}
          {Array.from({ length: 9 }, (_, k) => <line key={`h${k}`} x1="0" y1={k * 10} x2="100" y2={k * 10} strokeOpacity={k === 4 ? 0.8 : 0.2} />)}
          <path d="M0 78 Q 60 70, 100 4" fill="none" stroke={a} strokeWidth="1" />
          <circle cx="60" cy="40" r="2" fill={a} stroke="none" />
        </g>
      );
    case 'prism':
      return (
        <g>
          <polygon points="50,14 76,64 24,64" fill="none" stroke={i} strokeOpacity="0.7" strokeWidth="0.6" />
          <line x1="0" y1="48" x2="38" y2="40" stroke={i} strokeOpacity="0.8" strokeWidth="0.7" />
          {[0.95, 0.75, 0.55, 0.38, 0.22].map((o, k) => (
            <line key={o} x1="62" y1="42" x2="100" y2={46 + k * 6} stroke={a} strokeOpacity={o} strokeWidth="1.1" />
          ))}
        </g>
      );
    case 'helix':
      return (
        <g fill="none" strokeWidth="0.8">
          <path d="M30 0 C 70 15, 70 25, 30 40 S -10 65, 30 80" stroke={a} />
          <path d="M70 0 C 30 15, 30 25, 70 40 S 110 65, 70 80" stroke={i} strokeOpacity="0.55" />
          {[6, 14, 26, 34, 46, 54, 66, 74].map(y => <line key={y} x1="36" y1={y} x2="64" y2={y} stroke={a} strokeOpacity="0.35" strokeWidth="0.5" />)}
        </g>
      );
    case 'lattice':
      return (
        <g>
          {[0, 1, 2, 3].flatMap(r => [0, 1, 2, 3, 4].map(c => {
            const x = 14 + c * 19 + (r % 2) * 9.5;
            const y = 12 + r * 17;
            return <circle key={`${r}-${c}`} cx={x} cy={y} r={r === 1 && c === 2 ? 4 : 2} fill={r === 1 && c === 2 ? a : 'none'} stroke={a} strokeOpacity={0.3 + ((r + c) % 3) * 0.2} strokeWidth="0.6" />;
          }))}
        </g>
      );
    case 'contour':
      return (
        <g fill="none" stroke={a} strokeWidth="0.5">
          {[30, 24, 18, 12, 6].map((r, k) => (
            <path key={r} d={`M${60 - r * 1.4} 40 C ${60 - r * 1.4} ${40 - r}, ${60 + r} ${40 - r * 1.2}, ${60 + r * 1.3} 38 S ${60 + r * 0.6} ${40 + r * 1.1}, ${60 - r * 1.4} 40`} strokeOpacity={0.2 + k * 0.17} />
          ))}
        </g>
      );
    case 'spiral': {
      const pts: string[] = [];
      for (let t = 0; t < 6 * Math.PI; t += 0.15) {
        const r = 1.6 * Math.exp(0.16 * t);
        pts.push(`${(62 + r * Math.cos(t)).toFixed(1)},${(42 + r * Math.sin(t)).toFixed(1)}`);
      }
      return <polyline points={pts.join(' ')} fill="none" stroke={a} strokeWidth="0.7" strokeOpacity="0.85" />;
    }
    case 'stars':
      return (
        <g>
          {[[18, 14], [34, 30], [52, 18], [70, 36], [86, 22], [62, 58], [28, 56], [80, 66]].map(([x, y], k) => (
            <circle key={k} cx={x} cy={y} r={k === 3 ? 2.2 : 1 + (k % 3) * 0.4} fill={k === 3 ? a : i} fillOpacity={k === 3 ? 1 : 0.7} />
          ))}
          <polyline points="18,14 34,30 52,18 70,36 86,22" fill="none" stroke={a} strokeOpacity="0.5" strokeWidth="0.4" />
          <polyline points="70,36 62,58 80,66" fill="none" stroke={a} strokeOpacity="0.35" strokeWidth="0.4" />
        </g>
      );
    case 'ruled':
      return (
        <g stroke={a}>
          {Array.from({ length: 14 }, (_, k) => <line key={k} x1="0" y1={8 + k * 5.5} x2="100" y2={8 + k * 5.5} strokeOpacity="0.22" strokeWidth="0.35" />)}
          <line x1="16" y1="0" x2="16" y2="84" stroke={a} strokeOpacity="0.8" strokeWidth="0.6" />
        </g>
      );
    case 'field':
      return (
        <g fill="none" stroke={a} strokeWidth="0.5">
          {[-30, -18, -6, 6, 18, 30].map((d, k) => (
            <path key={d} d={`M30 40 C 45 ${40 + d * 2}, 55 ${40 + d * 2}, 70 40`} strokeOpacity={0.25 + (k % 3) * 0.22} />
          ))}
          <circle cx="30" cy="40" r="4" fill={a} stroke="none" />
          <circle cx="70" cy="40" r="4" fill="none" stroke={i} strokeOpacity="0.8" />
        </g>
      );
    case 'sine':
      return (
        <g fill="none" strokeWidth="0.8">
          {[0, 1, 2].map(k => (
            <path key={k} d={`M0 ${40 + k * 12} ${Array.from({ length: 21 }, (_, j) => `L${j * 5} ${(40 + k * 12 + Math.sin(j * 0.6 + k) * (10 - k * 3)).toFixed(1)}`).join(' ')}`} stroke={k === 0 ? a : i} strokeOpacity={k === 0 ? 0.95 : 0.35 - k * 0.08} />
          ))}
        </g>
      );
  }
};

export interface CoverProps {
  id: string;
  title: string;
  kind: BookKind;
  subject?: BookSubject;
  cover: BookCover;
  /** Width in CSS pixels. The height follows A4 (1 : 1.4). */
  width: number;
  /** Small caption above the title (a chapter, a class). */
  kicker?: string | null;
  /** 0–1, drawn as a hairline at the foot. */
  progress?: number;
  /** Page 1, when the cover is the file's own first page. */
  thumb?: string | null;
  /** Dimmed with a note, when the file is not on this device. */
  missing?: boolean;
}

const MONO = "var(--font-mono, ui-monospace, 'SF Mono', Menlo, monospace)";

export const Cover = ({ id, title, kind, subject, cover, width, kicker, progress, thumb, missing }: CoverProps) => {
  const w = width;
  const h = Math.round(w * 1.4);
  const pal = coverPalette(subject, cover.finish);
  const { motif, layout } = parse(cover.design, defaultDesign(id, subject));
  const showText = w >= 72;
  const pad = Math.round(w * 0.09);
  const usePage = cover.firstPage && thumb;

  /* The object: where the face starts, and what is drawn beside it. */
  const spine = kind === 'book' ? Math.max(3, Math.round(w * 0.055)) : 0;
  const coil = kind === 'module' ? Math.max(5, Math.round(w * 0.085)) : 0;
  const faceLeft = spine + coil;
  const r = kind === 'dpp' ? Math.max(1, Math.round(w * 0.008)) : Math.max(2, Math.round(w * 0.022));

  const face = (
    <span style={{ position: 'absolute', left: faceLeft, top: 0, right: 0, bottom: 0, overflow: 'hidden', background: pal.ground, borderRadius: kind === 'book' ? `0 ${r}px ${r}px 0` : r }}>
      {usePage ? (
        <img src={thumb!} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }} />
      ) : (
        <>
          <svg viewBox={layout === 'band' ? '0 0 100 80' : '0 0 100 84'} preserveAspectRatio="xMidYMid slice"
            style={{ position: 'absolute', left: 0, right: 0, top: 0, width: '100%', height: layout === 'band' ? '58%' : '64%' }} aria-hidden="true">
            <MotifArt motif={motif} a={pal.accent} i={pal.ink} />
          </svg>
          {layout === 'band' && (
            <span style={{ position: 'absolute', left: 0, right: 0, top: '58%', bottom: 0, background: pal.accent, opacity: cover.finish === 'paper' ? 0.9 : 0.85 }} />
          )}
          <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: cover.finish === 'paper' ? 0.2 : 0.12, mixBlendMode: 'overlay' }} aria-hidden="true">
            <filter id="bk-grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
            <rect width="100%" height="100%" filter="url(#bk-grain)" />
          </svg>
          {showText && (
            <span style={{ position: 'absolute', left: pad, right: pad, bottom: pad, top: layout === 'band' ? '62%' : '66%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: Math.round(w * 0.03), textAlign: 'left' }}>
              {kicker && (
                <span style={{ fontFamily: MONO, fontSize: Math.max(7, Math.round(w * 0.042)), letterSpacing: '0.1em', textTransform: 'uppercase', color: layout === 'band' ? pal.ground : pal.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: layout === 'band' ? 0.75 : 1 }}>
                  {kicker}
                </span>
              )}
              <span style={{
                fontFamily: "'Playfair Display', Georgia, serif", fontSize: Math.round(w * 0.105), lineHeight: 1.08,
                color: layout === 'band' ? pal.ground : pal.ink,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere',
              }}>
                {title}
              </span>
            </span>
          )}
          {showText && (
            <span style={{ position: 'absolute', top: pad * 0.8, right: pad * 0.8, fontFamily: 'Georgia, serif', fontSize: Math.round(w * 0.07), color: pal.ink, opacity: 0.5 }}>α</span>
          )}
        </>
      )}
      {/* Light across the face, the same sheen the cases carry. */}
      <span style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.03) 28%, rgba(255,255,255,0) 44%)' }} />
      {progress !== undefined && progress > 0 && (
        <span style={{ position: 'absolute', left: 0, bottom: 0, height: Math.max(2, Math.round(w * 0.016)), width: `${Math.min(1, progress) * 100}%`, background: pal.accent, boxShadow: '0 0 0 0.5px rgba(0,0,0,0.25)' }} />
      )}
    </span>
  );

  return (
    <span
      className="bk-cover"
      role="img"
      aria-label={`${title}${missing ? ', file not on this device' : ''}`}
      style={{ position: 'relative', display: 'block', width: w, height: h, flexShrink: 0, opacity: missing ? 0.55 : 1, filter: missing ? 'saturate(0.4)' : undefined }}
    >
      {/* Behind the face: the sheets of a DPP, the pages of a book. */}
      {kind === 'dpp' && [2, 1].map(k => (
        <span key={k} style={{ position: 'absolute', inset: 0, transform: `translate(${k * Math.max(2, w * 0.02)}px, ${k * Math.max(2, w * 0.02)}px) rotate(${k * 1.2}deg)`, background: k === 2 ? '#CFCBC2' : '#E4E0D8', borderRadius: r, boxShadow: '0 1px 2px rgba(0,0,0,0.25)' }} />
      ))}
      {kind === 'book' && (
        <span style={{ position: 'absolute', top: Math.round(h * 0.012), bottom: Math.round(h * 0.012), right: -Math.max(2, Math.round(w * 0.025)), width: Math.max(2, Math.round(w * 0.03)), borderRadius: `0 ${r}px ${r}px 0`, background: 'repeating-linear-gradient(90deg, #F2EFE8 0 1px, #D9D4CA 1px 2px)' }} />
      )}
      {kind === 'notes' && (
        <span style={{ position: 'absolute', top: 0, bottom: 0, right: Math.round(w * 0.14), width: Math.max(2, Math.round(w * 0.03)), background: pal.accent, opacity: 0.9, zIndex: 2 }} />
      )}
      {face}
      {kind === 'book' && (
        <span style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: spine + 1, borderRadius: `${r}px 0 0 ${r}px`,
          background: `linear-gradient(90deg, rgba(0,0,0,0.45), rgba(255,255,255,0.12) 55%, rgba(0,0,0,0.25)), ${pal.ground}`,
        }} />
      )}
      {kind === 'module' && (
        <span style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: coil + 2, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center', zIndex: 2 }}>
          {Array.from({ length: Math.max(6, Math.round(h / Math.max(7, w * 0.07))) }, (_, k) => (
            <span key={k} style={{ width: coil + 2, height: Math.max(2, Math.round(w * 0.02)), borderRadius: 99, background: 'linear-gradient(180deg, #E5E5EA, #77777F)', boxShadow: '0 1px 1px rgba(0,0,0,0.4)' }} />
          ))}
        </span>
      )}
      {kind === 'dpp' && (
        <span style={{ position: 'absolute', left: Math.round(w * 0.06), top: Math.round(w * 0.05), width: Math.max(6, Math.round(w * 0.13)), height: Math.max(2, Math.round(w * 0.022)), transform: 'rotate(-38deg)', borderRadius: 2, background: 'linear-gradient(180deg, #F1F1F4, #8B8B93)', boxShadow: '0 1px 1px rgba(0,0,0,0.45)', zIndex: 3 }} />
      )}
      <span style={{ position: 'absolute', inset: 0, borderRadius: r, boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 0 0 1px rgba(255,255,255,0.08) inset, 0 8px 20px -10px rgba(0,0,0,0.6)', pointerEvents: 'none' }} />
    </span>
  );
};

export default Cover;
