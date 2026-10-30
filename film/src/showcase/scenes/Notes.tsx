import type React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { SUBJECT_COLORS } from '../../../../schedule/colors';
import { Caption, Shot, useRise } from '../kit';
import { BOOK, MONO, SANS, tw } from '../look';
import { AT, CAPTIONS, SCENES } from '../timeline';

/* notes/notes.css, the light page: a bone-white room in a dark film. */
const NT = {
  paper: '#ffffff',
  ink: '#1c1c1e',
  body: '#2c2c2f',
  muted: '#7a7a82',
  faint: '#ababb2',
  rule: 'rgba(28, 28, 30, 0.09)',
  hover: 'rgba(28, 28, 30, 0.04)',
  accent: '#E10600',
};
const PHY = SUBJECT_COLORS.Physics;

/* What the student types, and what it becomes: notes/editor turns $…$ into
   an equation as you type. The typeset form is set by hand, as notes/Cover.tsx
   sets its own, so the film never loads KaTeX. */
const RAW = '$F = Gm_1m_2/r^2$';

const Fraction: React.FC = () => (
  <span style={{ fontFamily: BOOK, fontSize: 52, color: NT.ink, display: 'inline-flex', alignItems: 'center', gap: 14 }}>
    <i>F</i>
    <span>=</span>
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', fontSize: '0.86em' }}>
      <span style={{ padding: '0 8px 2px', borderBottom: `2px solid ${NT.ink}`, lineHeight: 1.2 }}>
        <i>G</i> <i>m</i>
        <sub style={{ fontSize: '0.55em' }}>1</sub>
        <i>m</i>
        <sub style={{ fontSize: '0.55em' }}>2</sub>
      </span>
      <span style={{ padding: '2px 8px 0', lineHeight: 1.2 }}>
        <i>r</i>
        <sup style={{ fontSize: '0.55em' }}>2</sup>
      </span>
    </span>
  </span>
);

export const Notes: React.FC = () => {
  const f = useCurrentFrame();
  const rise = useRise(0);
  const c = CAPTIONS.notes;
  const [t0, t1] = AT.notesType;
  const typed = Math.round(tw(f, [t0, t1], [0, RAW.length], (x: number) => x));
  const form = tw(f, [AT.notesForm, AT.notesForm + 10], [0, 1]);
  const caretOn = Math.floor(f / 8) % 2 === 0 || (f >= t0 && f <= t1);

  return (
    <Shot dur={SCENES.notes.dur} push={[1, 1.04]} origin="60% 55%">
      <Caption label={c.label} lead={c.lead} em={c.em} at={2} size={88} stack style={{ position: 'absolute', left: 140, top: 410, width: 680 }} />
      <AbsoluteFill style={{ perspective: 2400 }}>
        <div
          style={{
            position: 'absolute',
            left: 880,
            top: 180,
            width: 940,
            height: 720,
            borderRadius: 22,
            background: NT.paper,
            boxShadow: '0 1px 2px rgba(0,0,0,0.2), 0 90px 140px -50px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.4)',
            overflow: 'hidden',
            translate: `0 ${(1 - rise) * 180}px`,
            transform: `rotateY(${-16 + rise * 7}deg) rotateX(${8 - rise * 4}deg)`,
            opacity: tw(f, [0, 8], [0, 1]),
          }}
        >
          {/* Toolbar: back to the parent, pin, more. */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 34px', fontFamily: SANS, fontWeight: 500, fontSize: 15, color: NT.muted }}>
            <span>‹ Physics</span>
            <span style={{ display: 'flex', gap: 18, letterSpacing: '0.1em' }}>
              <span>☆</span>
              <span>•••</span>
            </span>
          </div>
          <div style={{ padding: '30px 110px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: SANS, fontWeight: 700, fontSize: 13, color: PHY.textLight }}>
              <i style={{ width: 8, height: 8, borderRadius: 4, background: PHY.dot }} />
              Physics · Class 11
            </div>
            <div style={{ marginTop: 18, fontFamily: BOOK, fontWeight: 600, fontSize: 58, letterSpacing: '-0.02em', color: NT.ink, lineHeight: 1.05 }}>Gravitation</div>
            <div style={{ marginTop: 14, fontFamily: "'Playfair Display', Georgia, serif", fontStyle: 'italic', fontSize: 24, color: NT.muted }}>Everything pulls on everything.</div>

            <p style={{ margin: '42px 0 0', fontFamily: BOOK, fontSize: 24, lineHeight: 1.6, color: NT.body }}>
              Newton’s law of gravitation, for two masses a distance <i>r</i> apart:
            </p>

            {/* The line being written, then the equation it becomes. */}
            <div style={{ position: 'relative', height: 140, marginTop: 18 }}>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 40,
                  fontFamily: MONO,
                  fontSize: 26,
                  color: NT.body,
                  opacity: 1 - form,
                  filter: form > 0 ? `blur(${form * 8}px)` : undefined,
                }}
              >
                {RAW.slice(0, typed).split('').map((ch, i) => (
                  <span key={i} style={{ color: ch === '$' ? NT.faint : NT.body }}>{ch}</span>
                ))}
                <span style={{ display: 'inline-block', width: 2.5, height: 30, marginLeft: 2, verticalAlign: '-6px', background: NT.accent, opacity: caretOn ? 1 : 0 }} />
              </div>
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 0,
                  height: 140,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 14,
                  background: NT.hover,
                  opacity: form,
                  scale: String(0.94 + form * 0.06),
                  filter: form < 1 ? `blur(${(1 - form) * 10}px)` : undefined,
                }}
              >
                <Fraction />
              </div>
            </div>

            <div style={{ marginTop: 34, display: 'flex', alignItems: 'center', gap: 14, fontFamily: BOOK, fontSize: 22, color: NT.body, opacity: tw(f, [AT.notesForm + 8, AT.notesForm + 16], [0, 1]) }}>
              <span style={{ width: 20, height: 20, borderRadius: 5, border: `1.6px solid ${NT.faint}` }} />
              Solve 10 PYQs on orbits
              <span style={{ padding: '4px 10px', borderRadius: 999, background: 'rgba(28,28,30,0.06)', fontFamily: SANS, fontWeight: 700, fontSize: 12, color: NT.muted }}>→ Today</span>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </Shot>
  );
};
