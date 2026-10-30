/**
 * The pieces every scene is built from: the shot envelope, the caption, the
 * seal, the two devices, a coloured light, and the app's small labels.
 */
import type React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { ALPHA_FACE, APP, BONE, BONE_3, IN_OUT, LINEAR, SANS, SERIF, pop, tw } from './look';
import { OVERLAP } from './timeline';

/* ── A shot ──
   Fades and focuses in, slowly pushes in for its whole length, and on the
   way out blurs and lifts toward the camera while the next shot comes up
   underneath. `dur` is the scene's own length; the shot runs OVERLAP frames
   past it, which is the dissolve. */
export const Shot: React.FC<{ dur: number; push?: [number, number]; origin?: string; children: React.ReactNode }> = ({
  dur,
  push = [1, 1.045],
  origin = '50% 50%',
  children,
}) => {
  const f = useCurrentFrame();
  const end = dur + OVERLAP;
  const opacity = Math.min(tw(f, [0, 9], [0, 1]), tw(f, [dur - 2, end], [1, 0], IN_OUT));
  const blur = Math.max(tw(f, [0, 10], [14, 0]), tw(f, [dur - 2, end], [0, 16], IN_OUT));
  const exit = tw(f, [dur - 2, end], [1, 1.06], IN_OUT);
  return (
    <AbsoluteFill
      style={{
        opacity,
        filter: blur > 0.05 ? `blur(${blur}px)` : undefined,
        scale: String(tw(f, [0, end], push, LINEAR) * exit),
        transformOrigin: origin,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/* ── The caption ──
   One short line in Playfair at 400, the last word in italic. Each word
   arrives out of a blur, a few frames after the one before. */
export const Caption: React.FC<{
  label?: string;
  lead: string;
  em: string;
  at?: number;
  size?: number;
  align?: 'left' | 'center' | 'right';
  stack?: boolean;
  style?: React.CSSProperties;
}> = ({ label, lead, em, at = 4, size = 104, align = 'left', stack = false, style }) => {
  const f = useCurrentFrame();
  const words = [...lead.split(' ').map(w => ({ w, em: false })), ...em.split(' ').map(w => ({ w, em: true }))];
  const word = (i: number): React.CSSProperties => {
    const t = at + 4 + i * 3;
    const b = tw(f, [t, t + 14], [12, 0]);
    return {
      display: 'inline-block',
      opacity: tw(f, [t, t + 10], [0, 1]),
      translate: `0 ${tw(f, [t, t + 16], [28, 0])}px`,
      filter: b > 0.05 ? `blur(${b}px)` : undefined,
    };
  };
  const leadCount = lead.split(' ').length;
  return (
    <div style={{ textAlign: align, ...style }}>
      {label && (
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: '0.34em',
            textTransform: 'uppercase',
            color: BONE_3,
            marginBottom: 26,
            opacity: tw(f, [at, at + 10], [0, 1]),
            translate: `0 ${tw(f, [at, at + 14], [10, 0])}px`,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          fontFamily: SERIF,
          fontWeight: 400,
          fontSize: size,
          lineHeight: 0.98,
          letterSpacing: '-0.03em',
          color: BONE,
        }}
      >
        {words.map((x, i) => (
          <span key={i}>
            <span style={{ ...word(i), fontStyle: x.em ? 'italic' : 'normal' }}>{x.w}</span>
            {stack && i === leadCount - 1 ? <br /> : i < words.length - 1 ? ' ' : null}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ── The wax seal ──
   The landing page's seal (landing/Hero.tsx), same formula for its edge, so
   the film and the page press the same object. */
const SEAL_PATH = (() => {
  const pts: string[] = [];
  const n = 72;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const r = 46 + 1.6 * Math.sin(t * 7 + 0.6) + 1.1 * Math.sin(t * 13 + 2.1) + 0.7 * Math.cos(t * 5);
    pts.push(`${(50 + r * Math.cos(t)).toFixed(2)},${(50 + r * Math.sin(t)).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
})();

export const Seal: React.FC<{ size: number; id: string; style?: React.CSSProperties }> = ({ size, id, style }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    style={{ display: 'block', overflow: 'visible', filter: 'drop-shadow(0 10px 18px rgba(0,0,0,0.55)) drop-shadow(0 0 30px rgba(177,14,8,0.3))', ...style }}
  >
    <defs>
      <radialGradient id={id} cx="38%" cy="32%" r="75%">
        <stop offset="0" stopColor="#e2261b" />
        <stop offset="0.55" stopColor="#a90d07" />
        <stop offset="1" stopColor="#5c0603" />
      </radialGradient>
    </defs>
    <path d={SEAL_PATH} fill={`url(#${id})`} />
    <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.6" />
    <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(255,190,170,0.22)" strokeWidth="0.8" transform="translate(-0.7 -0.7)" />
    <text x="50.9" y="64.9" textAnchor="middle" style={{ fontFamily: ALPHA_FACE, fontSize: 46, fill: 'rgba(255,150,130,0.45)' }}>α</text>
    <text x="50" y="64" textAnchor="middle" style={{ fontFamily: ALPHA_FACE, fontSize: 46, fill: '#4a0402' }}>α</text>
  </svg>
);

/* ── Light ──
   A soft coloured pool behind a device: the subject's colour, so the room
   takes on whatever is being studied. */
export const Glow: React.FC<{ color: string; x: number; y: number; size: number; opacity?: number }> = ({ color, x, y, size, opacity = 0.35 }) => (
  <div
    style={{
      position: 'absolute',
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      borderRadius: '50%',
      background: `radial-gradient(closest-side, ${color}, transparent)`,
      opacity,
    }}
  />
);

/* ── Devices ── */

/** An iPhone-shaped frame around a 390×844 screen. */
export const Phone: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      width: 390 + 28,
      height: 844 + 28,
      padding: 14,
      borderRadius: 66,
      background: 'linear-gradient(150deg, #4a4a50 0%, #141416 22%, #0a0a0b 60%, #2c2c31 100%)',
      boxShadow:
        '0 0 0 1.5px rgba(255,255,255,0.12) inset, 0 0 0 3px #050506 inset, 0 90px 140px -50px rgba(0,0,0,0.95), 0 40px 70px -40px rgba(0,0,0,0.8)',
      position: 'relative',
      ...style,
    }}
  >
    <div style={{ position: 'relative', width: 390, height: 844, borderRadius: 52, overflow: 'hidden', background: APP.page }}>
      {children}
      {/* The island. */}
      <div style={{ position: 'absolute', top: 11, left: 195 - 62, width: 124, height: 36, borderRadius: 20, background: '#000' }} />
      {/* Glass over the screen: one soft diagonal reflection. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(115deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0) 32%, rgba(255,255,255,0) 100%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  </div>
);

/** A laptop: a thin black bezel around a 1200×750 screen, and an aluminium base. */
export const Laptop: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ position: 'relative', width: 1200 + 36, ...style }}>
    <div
      style={{
        padding: 18,
        paddingBottom: 26,
        borderRadius: '26px 26px 8px 8px',
        background: '#0a0a0b',
        boxShadow: '0 0 0 2px #3a3a40 inset, 0 0 0 3.5px #1b1b1e inset, 0 80px 120px -50px rgba(0,0,0,0.9)',
      }}
    >
      <div style={{ position: 'relative', width: 1200, height: 750, borderRadius: 8, overflow: 'hidden', background: APP.page }}>
        {children}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(120deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 30%)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
    <div
      style={{
        position: 'relative',
        left: -110,
        width: 1236 + 220,
        height: 22,
        borderRadius: '0 0 30px 30px',
        background: 'linear-gradient(180deg, #c9c9ce 0%, #8e8e94 45%, #4d4d53 100%)',
        boxShadow: '0 30px 50px -20px rgba(0,0,0,0.9)',
      }}
    >
      <div style={{ position: 'absolute', left: '50%', top: 0, width: 200, height: 9, marginLeft: -100, borderRadius: '0 0 10px 10px', background: 'linear-gradient(180deg, #6b6b71, #9a9aa0)' }} />
    </div>
  </div>
);

/* ── The app's own small pieces ── */

/** ui/kit.tsx's Eyebrow: 10px, bold, uppercase, tracked, zinc. */
export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }> = ({
  children,
  color = APP.z500,
  size = 10,
  style,
}) => (
  <div style={{ fontFamily: SANS, fontWeight: 700, fontSize: size, letterSpacing: '0.06em', textTransform: 'uppercase', color, ...style }}>{children}</div>
);

/** The app's phone capsule: liquid glass over the page, the α and the tab's name. */
export const Capsule: React.FC<{ tab: string }> = ({ tab }) => (
  <div
    style={{
      position: 'absolute',
      top: 52,
      left: 16,
      right: 16,
      height: 46,
      borderRadius: 999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 18px',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.09), rgba(255,255,255,0.04))',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 0 0 1px rgba(255,255,255,0.08), 0 10px 30px -12px rgba(0,0,0,0.7)',
      backdropFilter: 'blur(18px) saturate(1.6)',
      zIndex: 5,
    }}
  >
    <span style={{ fontFamily: ALPHA_FACE, fontSize: 22, color: APP.ink, lineHeight: 1 }}>α</span>
    <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 13, color: APP.ink, letterSpacing: '0.01em' }}>{tab}</span>
    <span style={{ display: 'flex', gap: 3 }}>
      {[0, 1, 2].map(i => (
        <i key={i} style={{ width: 4, height: 4, borderRadius: 2, background: APP.z400 }} />
      ))}
    </span>
  </div>
);

/** The pointer on a laptop. */
export const Pointer: React.FC<{ x: number; y: number; down?: number }> = ({ x, y, down = 0 }) => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 28 28"
    style={{ position: 'absolute', left: x, top: y, zIndex: 20, scale: String(1 - down * 0.12), transformOrigin: '4px 3px', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.5))' }}
  >
    <path d="M5 3 L5 22 L10 17.5 L13.5 25 L17 23.4 L13.6 16 L20.5 16 Z" fill="#fff" stroke="#000" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

/** A fingertip on a phone screen. */
export const Touch: React.FC<{ x: number; y: number; on: number }> = ({ x, y, on }) => (
  <div
    style={{
      position: 'absolute',
      left: x - 22,
      top: y - 22,
      width: 44,
      height: 44,
      borderRadius: '50%',
      background: 'rgba(255,255,255,0.22)',
      boxShadow: '0 0 0 1.5px rgba(255,255,255,0.4)',
      opacity: on,
      scale: String(0.8 + on * 0.2),
      zIndex: 30,
    }}
  />
);

/* ── The demo mark ──
   Every number in the film is illustrative. The corner says so. */
export const DemoMark: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const f = useCurrentFrame();
  const o = Math.min(tw(f, [from, from + 12], [0, 1]), tw(f, [to - 10, to], [1, 0]));
  if (o <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        top: 46,
        right: 56,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '9px 16px',
        borderRadius: 999,
        boxShadow: `0 0 0 1px rgba(236,230,218,0.16) inset`,
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        color: BONE_3,
        opacity: o,
      }}
    >
      <i style={{ width: 6, height: 6, borderRadius: 3, background: BONE_3 }} />
      Demo account
    </div>
  );
};

/** A device rising into place, tilted, then settling. */
export const useRise = (at = 0) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return pop(f, at, fps, 18, 90);
};
