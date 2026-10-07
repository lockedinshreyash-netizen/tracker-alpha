/* ── The pack, as an object ──
   Premium retail packaging, not a trading card: a die-cut backer with a
   reinforced hang tab, a euro slot, a perforated strip under the tab, and
   the label. ALPHA, the pack number, the name in heavy type, what is inside,
   which exam, and the price. A small barcode sits in the corner, because
   real packaging has one.

   Two finishes, ink (black) and paper (off-white), chosen by the
   administrator when the pack is made. The label reads the same in either
   room. The subject colour appears once, as a
   short bar, because colour here is data (schedule/colors.ts).

   Layers, back to front: shadow → cards (only during an opening) → body →
   flap. The flap is the tab plus the strip above the perforation. It is its
   own element so the opening can tear it off along the seeded jagged edge.
   The body's top edge is that same line, so what is left looks torn, fibres
   and all. On the rack every part is static and painted once. The rack only
   ever moves the pack by transform. */

import React, { useId, useMemo } from 'react';
import { deckAccent } from '../theme';
import { geometry, type PackGeometry } from './geometry';
import type { Pack } from '../types';

export interface PackParts {
  flap?: React.Ref<HTMLDivElement>;
  body?: React.Ref<HTMLDivElement>;
  crackDown?: React.Ref<SVGPathElement>;
  crackLeft?: React.Ref<SVGPathElement>;
  crackRight?: React.Ref<SVGPathElement>;
  fibers?: React.Ref<SVGPathElement>;
}

type Finish = Pack['finish'];
export const finishOf = (pack: Pick<Pack, 'finish'>): Finish => (pack.finish === 'paper' ? 'paper' : 'ink');

const SKIN: Record<Finish, { top: string; bottom: string; ink: string; muted: string; rule: string; edge: string; perf: string; ring: string; fiber: string; crack: string }> = {
  ink: { top: '#1a1a1e', bottom: '#09090b', ink: '#FAFAFA', muted: '#8f8f98', rule: 'rgba(255,255,255,0.12)', edge: 'rgba(255,255,255,0.22)', perf: 'rgba(255,255,255,0.28)', ring: 'rgba(255,255,255,0.22)', fiber: '#d9d4c9', crack: '#e9e4d8' },
  paper: { top: '#f8f6f1', bottom: '#e9e6de', ink: '#0e0e10', muted: '#6f6f78', rule: 'rgba(14,14,16,0.12)', edge: 'rgba(255,255,255,0.95)', perf: 'rgba(14,14,16,0.3)', ring: 'rgba(14,14,16,0.16)', fiber: '#ffffff', crack: '#8b857a' },
};

/** "PACK 007". A pack not yet saved has no number: "NEW PACK". */
export const packNumber = (n: number) => (n > 0 ? `PACK ${String(n).padStart(3, '0')}` : 'NEW PACK');

/** The price line, as the packaging prints it. */
export const priceLabel = (p: Pick<Pack, 'access' | 'priceInr'>): string =>
  p.access === 'paid' && p.priceInr ? `₹${p.priceInr}` : p.access === 'pro' ? 'ALPHA PRO' : 'FREE';

/** Thin bars of a seeded width — decoration that reads as "a real product". */
const barcode = (seed: number) => {
  let a = (seed * 9301 + 49297) % 233280;
  return Array.from({ length: 15 }, () => { a = (a * 9301 + 49297) % 233280; return 1 + Math.floor((a / 233280) * 3); });
};

/* ── The packs behind the front one ──
   A hook holds a stack, and the stack is what tells a student that taking a
   pack does not empty the hook. Behind every pack hang two more copies,
   further back on the rod: higher, a little smaller, in shadow. Only their
   tops show above the pack in front, as two stepped strips with the rod
   through their slots.

   They are deliberately out of focus: a dark, soft, outline-free mass, so the
   front pack is the one crisp object on the hook and the stack is felt
   rather than read. (Outlined copies made every hook a set of stepped lines
   and the rack looked busy.)

   Kept cheap, because every hook draws them: a flat die-cut silhouette per
   copy, one solid fill, no label, no gradient, and a light blur that is
   painted once. They live inside the pack's sway element, whose layer only
   ever moves by transform, so neither sliding nor swaying repaints them. */

const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(Math.min(255, v * f)).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
};

export const PackStackEdges: React.FC<{
  g: PackGeometry;
  finish: Finish;
  dark: boolean;
  /** Copies to draw, nearest first: 1 is just behind the front pack. */
  depths: number[];
  /** How far back along the rod each copy hangs, px. */
  step: number;
}> = ({ g, finish, dark, depths, step }) => {
  const s = SKIN[finish];
  // Each copy further back sits deeper in the shadow of the ones in front.
  const falloff = finish === 'ink' ? [0.5, 0.32] : dark ? [0.34, 0.24] : [0.58, 0.46];
  return (
    <>
      {[...depths].sort((a, b) => b - a).map(dp => (
        <svg
          key={dp}
          aria-hidden
          width={g.w}
          height={g.h}
          viewBox={`0 0 ${g.w} ${g.h}`}
          className="absolute left-0 top-0 pointer-events-none"
          style={{
            transform: `translateY(${-dp * step}px) scale(${1 - 0.035 * dp})`,
            transformOrigin: `${g.pivot.x}px ${g.pivot.y}px`,
            filter: `blur(${(0.9 + 0.5 * dp).toFixed(1)}px)`,
          }}
        >
          <path d={`${g.silhouette} ${g.holePath}`} fillRule="evenodd" fill={shade(s.top, falloff[Math.min(dp, 2) - 1])} />
        </svg>
      ))}
    </>
  );
};

export const PackCard: React.FC<{
  pack: Pick<Pack, 'title' | 'packNo' | 'subject' | 'decks' | 'examLine' | 'access' | 'priceInr' | 'finish' | 'status'>;
  w: number;
  h: number;
  parts?: PackParts;
  /** Drawn between the body and its back: the cards inside, during an opening. */
  inside?: React.ReactNode;
  /** The geometry, when the caller already has it. */
  geo?: PackGeometry;
  className?: string;
  style?: React.CSSProperties;
}> = ({ pack, w, h, parts: partsProp, inside, geo, className = '', style }) => {
  const parts: PackParts = partsProp ?? {};
  const g = useMemo(() => geo ?? geometry(w, h, pack.packNo || 1), [geo, w, h, pack.packNo]);
  const finish = finishOf(pack);
  const s = SKIN[finish];
  const raw = useId();
  const id = raw.replace(/[^a-zA-Z0-9_-]/g, '');
  const k = w / 198;
  const cards = pack.decks.reduce((n, d) => n + d.cards, 0);
  const accent = deckAccent(pack.subject ?? pack.decks.find(d => d.subject)?.subject ?? null, finish === 'ink');
  const title = pack.title.toUpperCase();
  // Sized so the longest word fits on one line: a name never breaks mid-word.
  const longest = Math.max(...title.split(/\s+/).map(x => x.length), 1);
  const fs = Math.min((title.length > 30 ? 16.5 : title.length > 20 ? 19.5 : 23) * k, (w - 30 * k) / (longest * 0.7));
  const bars = useMemo(() => barcode(pack.packNo || 1), [pack.packNo]);
  const label = priceLabel(pack);

  return (
    <div className={`relative select-none ${className}`} style={{ width: w, height: h, perspective: 700, ...style }}>
      {/* The pack's shadow on the wall. Lifted packs cast a longer one (index.css, .pk-lift). */}
      <div aria-hidden className="pk-shadow absolute" style={{ left: 12 * k, right: 12 * k, top: g.perf + 10, bottom: 6, borderRadius: 18 * k, background: '#000', filter: 'blur(14px)' }} />

      {/* The cards sit in their own layer under the body, whatever z-index they use among themselves. */}
      {inside && <div className="absolute inset-0" style={{ zIndex: 0 }}>{inside}</div>}

      {/* Body: everything under the perforation. */}
      <div ref={parts.body} className="absolute inset-0" style={{ transformOrigin: '50% 100%', zIndex: 1 }}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0" aria-hidden>
          <defs>
            <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.top} /><stop offset="1" stopColor={s.bottom} /></linearGradient>
            <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity={finish === 'ink' ? 0.07 : 0.5} />
              <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={g.bodyPath} fill={`url(#${id}f)`} />
          <path d={g.bodyPath} fill={`url(#${id}s)`} />
          <path d={g.bodyPath} fill="none" stroke={s.edge} strokeWidth="1" opacity="0.8" />
          {/* What a tear leaves behind: a fibrous light edge. Shown by the opening. */}
          <path ref={parts.fibers} d={g.edge.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y + 0.6}`).join(' ')} fill="none" stroke={s.fiber} strokeWidth={1.6} strokeLinejoin="round" opacity="0" />
        </svg>

        {/* The label. */}
        <div className="absolute font-ui" style={{ left: 15 * k, right: 15 * k, top: g.perf + 12 * k, bottom: 13 * k, color: s.ink }}>
          <div className="flex items-baseline justify-between">
            <span className="font-display" style={{ fontSize: 12.5 * k, letterSpacing: '0.2em', fontWeight: 900 }}>ALPHA</span>
            <span className="tabular-nums" style={{ fontSize: 9 * k, letterSpacing: '0.14em', fontWeight: 700, color: s.muted }}>{packNumber(pack.packNo)}</span>
          </div>
          <div style={{ marginTop: 13 * k, width: 22 * k, height: 3 * k, borderRadius: 2, background: accent }} />
          <p className="font-display" style={{ marginTop: 9 * k, fontSize: fs, lineHeight: 0.98, letterSpacing: '-0.005em', fontWeight: 900, display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'break-word' }}>
            {title}
          </p>
          <div className="absolute inset-x-0 bottom-0">
            <p style={{ fontSize: 10 * k, letterSpacing: '0.14em', fontWeight: 800 }}>{cards.toLocaleString()} {cards === 1 ? 'CARD' : 'CARDS'}</p>
            {pack.examLine && <p style={{ fontSize: 9 * k, letterSpacing: '0.12em', fontWeight: 700, color: s.muted, marginTop: 3 * k }}>{pack.examLine.toUpperCase()}</p>}
            <div style={{ height: 1, background: s.rule, margin: `${9 * k}px 0 ${8 * k}px` }} />
            <div className="flex items-end justify-between">
              {pack.access === 'pro' ? (
                <span style={{ fontSize: 8.5 * k, letterSpacing: '0.12em', fontWeight: 800, lineHeight: 1.25 }}>INCLUDED WITH<br />ALPHA PRO</span>
              ) : (
                <span className={label === 'FREE' ? '' : 'num-stat'} style={{ fontSize: label === 'FREE' ? 12 * k : 21 * k, letterSpacing: label === 'FREE' ? '0.2em' : '-0.01em', fontWeight: 900, lineHeight: 1 }}>{label}</span>
              )}
              <span aria-hidden className="flex items-end gap-[1px]" style={{ height: 16 * k, opacity: 0.55 }}>
                {bars.map((b, i) => <span key={i} style={{ width: b * 0.75 * k, height: i % 5 === 0 ? '100%' : '82%', background: s.ink }} />)}
              </span>
            </div>
          </div>
        </div>

        {pack.status === 'draft' && (
          <span className="absolute font-ui" style={{ right: 10 * k, top: g.perf + 30 * k, transform: 'rotate(8deg)', fontSize: 8.5 * k, fontWeight: 900, letterSpacing: '0.14em', padding: `${3 * k}px ${7 * k}px`, borderRadius: 4, background: '#eda100', color: '#111' }}>DRAFT</span>
        )}
      </div>

      {/* Flap: the hang tab and the strip down to the perforation. */}
      <div ref={parts.flap} className="absolute inset-x-0 top-0" style={{ height: g.perf + 3, transformOrigin: `50% ${g.perf}px`, zIndex: 2 }}>
        <svg width={w} height={g.perf + 3} viewBox={`0 0 ${w} ${g.perf + 3}`} className="absolute inset-0 overflow-visible" aria-hidden>
          <path d={g.flapPath} fill={`url(#${id}f)`} fillRule="evenodd" />
          <path d={g.flapPath} fill={`url(#${id}s)`} fillRule="evenodd" />
          {/* The reinforced slot: a pressed ring around the hole. */}
          <path d={g.holePath} fill="none" stroke={s.ring} strokeWidth={2.4 * k} />
          <path d={g.holePath} fill="none" stroke={s.edge} strokeWidth="0.8" opacity="0.6" transform="translate(0 0.8)" />
          {/* The perforation. */}
          <line x1={7 * k} x2={w - 7 * k} y1={g.perf} y2={g.perf} stroke={s.perf} strokeWidth={1.1} strokeDasharray={`${2.2 * k} ${2.6 * k}`} strokeLinecap="round" />
          <text x={w - 9 * k} y={g.perf - 4 * k} textAnchor="end" fontSize={6.5 * k} fontWeight="800" letterSpacing={0.9 * k} fill={s.muted} className="font-ui">TEAR TO OPEN</text>
          {/* The tear, hidden until the opening draws it (stroke-dashoffset). */}
          <path ref={parts.crackDown} d={g.crackDown} fill="none" stroke={s.crack} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={g.crackLen.down} strokeDashoffset={g.crackLen.down} />
          <path ref={parts.crackLeft} d={g.crackLeft} fill="none" stroke={s.crack} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={g.crackLen.side} strokeDashoffset={g.crackLen.side} />
          <path ref={parts.crackRight} d={g.crackRight} fill="none" stroke={s.crack} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={g.crackLen.side} strokeDashoffset={g.crackLen.side} />
        </svg>
      </div>
    </div>
  );
};
