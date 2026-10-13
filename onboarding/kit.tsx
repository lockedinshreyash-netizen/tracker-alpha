/* ── The onboarding's building blocks ──
   The stage everything sits on, the chrome above it, and the few primitives
   every scene uses. Styles are in onboarding.css. */

import React, { useMemo, useRef } from 'react';
import LiquidGlass from '../ui/LiquidGlass';
import { formatClock, fromClockValue, toClockValue } from '../schedule/schedule';
import type { DayMinute } from '../types';

/* ── Device ──────────────────────────────────────────────────────────── */

interface Nav {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
}
const nav = (): Nav => (typeof navigator === 'undefined' ? {} : (navigator as unknown as Nav));

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** A phone that should not be asked to animate a field of lights behind glass. */
export const isLite = (): boolean => {
  const n = nav();
  return (n.hardwareConcurrency !== undefined && n.hardwareConcurrency <= 4)
    || (n.deviceMemory !== undefined && n.deviceMemory <= 2)
    || n.connection?.saveData === true;
};

/**
 * Whether to play the cold open at all. Data Saver and 2G mean several
 * megabytes the student did not ask for; reduced motion means a camera move
 * they asked not to see. Both get the questions straight away.
 */
export const shouldPlayFilm = (): boolean => {
  const n = nav();
  if (prefersReducedMotion()) return false;
  if (n.connection?.saveData) return false;
  if (n.connection?.effectiveType && /(^|-)2g$/.test(n.connection.effectiveType)) return false;
  return true;
};

/* ── Haptics ─────────────────────────────────────────────────────────── */
/* Android Chrome only (and so the Play app). Everywhere else these are no-ops. */

const vibrate = (p: number | number[]) => {
  try { navigator.vibrate?.(p); } catch { /* not allowed yet: no gesture */ }
};
export const haptic = {
  tick: () => vibrate(6),
  select: () => vibrate(12),
  heavy: () => vibrate([0, 34, 50, 70]),
};

/* ── The stage ───────────────────────────────────────────────────────── */

const mulberry = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const WARM = ['255,186,112', '255,210,150', '255,228,190', '255,160,90'];
const COOL = ['190,210,255', '214,226,255'];

/** One layer of out-of-focus city lights: many flat discs, one element. */
const bokehLayer = (seed: number, count: number, rMin: number, rMax: number, aMin: number, aMax: number): string => {
  const rnd = mulberry(seed);
  const discs: string[] = [];
  for (let i = 0; i < count; i++) {
    const c = rnd() < 0.24 ? COOL[Math.floor(rnd() * COOL.length)] : WARM[Math.floor(rnd() * WARM.length)];
    const r = Math.round(rMin + rnd() * (rMax - rMin));
    const a = aMin + rnd() * (aMax - aMin);
    // The lights sit low in the frame, where the city was in the film.
    const x = Math.round(rnd() * 100);
    const y = Math.round(30 + Math.pow(rnd(), 0.7) * 72);
    discs.push(`radial-gradient(circle ${r}px at ${x}% ${y}%, rgba(${c},${a.toFixed(3)}) 0%, rgba(${c},${(a * 0.92).toFixed(3)}) 72%, rgba(${c},0) 100%)`);
  }
  return discs.join(',');
};

const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

/**
 * The city from the film, thrown out of focus: three layers of discs at
 * three depths drifting at three speeds. Only `transform` moves, so this is
 * three composited layers and no repaint. `dim` is how far the stage steps
 * back behind the words (0 = full city, 1 = a whisper of it).
 */
export const Stage: React.FC<{ dim: number }> = ({ dim }) => {
  const layers = useMemo(() => [
    bokehLayer(11, 10, 90, 180, 0.05, 0.12),
    bokehLayer(23, 22, 34, 80, 0.08, 0.2),
    bokehLayer(37, 46, 6, 22, 0.18, 0.42),
  ], []);
  return (
    <>
      <div className="ob-bokeh c" style={{ backgroundImage: layers[2] }} />
      <div className="ob-bokeh b" style={{ backgroundImage: layers[1] }} />
      <div className="ob-bokeh a" style={{ backgroundImage: layers[0] }} />
      <div className="ob-dim" style={{ opacity: 0.35 + 0.65 * dim }} />
      <div className="ob-grain" style={{ backgroundImage: GRAIN }} />
    </>
  );
};

/* ── Chrome ──────────────────────────────────────────────────────────── */

export const TopBar: React.FC<{
  hidden: boolean;
  steps: number;
  at: number;
  onBack?: () => void;
  onSkip?: () => void;
}> = ({ hidden, steps, at, onBack, onSkip }) => (
  <div className="ob-top" data-hidden={hidden}>
    {onBack ? (
      <button className="ob-icon-btn" onClick={onBack} aria-label="Back">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
    ) : <span />}
    <div className="ob-progress" role="progressbar" aria-valuemin={1} aria-valuemax={steps} aria-valuenow={at + 1} aria-label="Setup progress">
      {Array.from({ length: steps }, (_, i) => (
        <span key={i} data-state={i < at ? 'done' : i === at ? 'now' : 'todo'} />
      ))}
    </div>
    {onSkip ? <button className="ob-skip" onClick={onSkip}>Skip</button> : <span />}
  </div>
);

/* ── Type ────────────────────────────────────────────────────────────── */

/**
 * A line whose words rise out of a mask one after another. A phrase wrapped
 * in asterisks ("How many hours *a day?*") is set in the italic accent face;
 * the asterisks are markup only and never reach the screen, however many
 * words the phrase spans.
 */
export const Rise: React.FC<{ text: string; delay?: number; step?: number }> = ({ text, delay = 0, step = 55 }) => {
  let open = false;
  const words = text.split(' ').map(raw => {
    const opens = raw.startsWith('*');
    const closes = raw.endsWith('*');
    const serif = open || opens;
    if (opens) open = true;
    if (closes) open = false;
    return { word: raw.replace(/\*/g, ''), serif };
  });
  return (
    <>
      {words.map(({ word, serif }, i) => {
        const end = word.endsWith('.') && i === words.length - 1;
        return (
          <React.Fragment key={i}>
            <span className="ob-rise">
              <span className={serif ? 'ob-serif' : undefined} style={{ animationDelay: `${delay + i * step}ms` }}>
                {end ? <>{word.slice(0, -1)}<span className="ob-dot">.</span></> : word}
              </span>
            </span>
            {i < words.length - 1 ? ' ' : null}
          </React.Fragment>
        );
      })}
    </>
  );
};

export const Eyebrow: React.FC<{ n?: number; children: React.ReactNode; delay?: number }> = ({ n, children, delay = 0 }) => (
  <p className="ob-eyebrow ob-fade" style={{ animationDelay: `${delay}ms` }}>
    {n !== undefined && <b>{String(n).padStart(2, '0')}</b>}{n !== undefined && ' · '}{children}
  </p>
);

/* ── Choices ─────────────────────────────────────────────────────────── */

const Check = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

export const Tile: React.FC<{
  selected: boolean;
  onClick: () => void;
  title: React.ReactNode;
  sub?: React.ReactNode;
  dots?: string[];
  delay?: number;
}> = ({ selected, onClick, title, sub, dots, delay = 0 }) => (
  <div className="ob-fade" style={{ animationDelay: `${delay}ms` }}>
    <LiquidGlass
      as="button"
      dark
      radius={24}
      variant="panel"
      bezel={16}
      strength={16}
      className="ob-tile"
      onClick={onClick}
      aria-pressed={selected}
    >
      <span className="ob-tile-ring" />
      <span style={{ minWidth: 0 }}>
        <span className="ob-tile-title" style={{ display: 'block' }}>{title}</span>
        {sub && <span className="ob-tile-sub" style={{ display: 'block' }}>{sub}</span>}
        {dots && (
          <span className="ob-dots">
            {dots.map(c => <i key={c} style={{ background: c, boxShadow: `0 0 10px ${c}` }} />)}
          </span>
        )}
      </span>
      <span className="ob-tile-check"><Check /></span>
    </LiquidGlass>
  </div>
);

/* A glass surface that is not a button: rows, stats, cards. */
export const Glass: React.FC<{ className?: string; style?: React.CSSProperties; radius?: number; children: React.ReactNode }> = ({ className = '', style, radius = 20, children }) => (
  <LiquidGlass dark radius={radius} variant="panel" bezel={14} strength={14} className={`relative ${className}`} style={style}>
    {children}
  </LiquidGlass>
);

/* ── Time ────────────────────────────────────────────────────────────── */

/**
 * A time on the study-day axis, shown as "6:30 AM", edited by the system's
 * own picker (the clock dialog on Android). The input is real and focusable;
 * the button only dresses it.
 */
export const TimeButton: React.FC<{ value: DayMinute; onChange: (m: DayMinute) => void; label: string }> = ({ value, onChange, label }) => {
  const input = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      className="ob-time"
      aria-label={`${label}: ${formatClock(value)}`}
      onClick={() => {
        const el = input.current;
        if (!el) return;
        try { el.showPicker?.(); } catch { el.focus(); }
      }}
    >
      {formatClock(value)}
      <input
        ref={input}
        type="time"
        tabIndex={-1}
        aria-hidden="true"
        value={toClockValue(value)}
        onChange={e => {
          const m = fromClockValue(e.target.value);
          if (m !== null) onChange(m);
        }}
      />
    </button>
  );
};
