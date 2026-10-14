/* ── The onboarding's building blocks ──
   The stage everything sits on, the chrome above it, and the few primitives
   every scene uses. Styles are in onboarding.css. */

import React from 'react';
import LiquidGlass from '../ui/LiquidGlass';

/* ── Device ──────────────────────────────────────────────────────────── */

interface Nav {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  connection?: { saveData?: boolean; effectiveType?: string };
}
const nav = (): Nav => (typeof navigator === 'undefined' ? {} : (navigator as unknown as Nav));

export const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/** A phone that should not be asked for the heavier glass and motion. */
export const isLite = (): boolean => {
  const n = nav();
  return (n.hardwareConcurrency !== undefined && n.hardwareConcurrency <= 4)
    || (n.deviceMemory !== undefined && n.deviceMemory <= 2)
    || n.connection?.saveData === true;
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

const GRAIN = `url("data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.6 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

/**
 * What every scene sits on: near-black, one soft neutral light from above and
 * a fine grain, so the black has depth without competing with the words.
 * Static, so it costs one paint and nothing per frame. (It used to be a
 * drifting field of blurred orange city lights from the old opening film.)
 */
export const Stage: React.FC = () => (
  <>
    <div className="ob-light-top" />
    <div className="ob-grain" style={{ backgroundImage: GRAIN }} />
  </>
);

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
