/* ── The pledge ──
   A commitment you have to hold for a second and a half is one you made on
   purpose. The ring fills while you hold, the phone pulses faster, the sound
   climbs; let go early and it all drains back. Holding to the end is the
   moment the answers are written (the one write, in OnboardingFlow). */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as sfx from '../audio';
import { Eyebrow, haptic, Rise } from './kit';
import { type Answers, examLabel } from './answers';

/** Matches the `hold` cue's length (film/scripts/render-sfx.ts). */
export const HOLD_MS = 1600;

const HoldToCommit: React.FC<{ onCommit: () => void; done: boolean }> = ({ onCommit, done }) => {
  const [p, setP] = useState(0);
  const [holding, setHolding] = useState(false);
  const raf = useRef(0);
  const t0 = useRef(0);
  const lastPulse = useRef(0);
  const committed = useRef(false);
  /* The fill, outside React: the loop and the drain read it every frame. */
  const pRef = useRef(0);

  const stopLoop = () => cancelAnimationFrame(raf.current);

  const release = useCallback(() => {
    if (committed.current) return;
    setHolding(false);
    stopLoop();
    sfx.stopAll();
    // Drain back rather than snap: you can see what you let go of.
    const from = performance.now();
    const start = pRef.current;
    const drain = (now: number) => {
      const k = Math.min(1, (now - from) / 380);
      const v = start * (1 - (1 - Math.pow(1 - k, 3)));
      pRef.current = v;
      setP(v);
      if (k < 1) raf.current = requestAnimationFrame(drain);
    };
    raf.current = requestAnimationFrame(drain);
  }, []);

  const press = () => {
    if (committed.current || holding) return;
    stopLoop();
    setHolding(true);
    sfx.play('hold');
    haptic.tick();
    // Resume from wherever a drain left it, so a re-grab is not punished.
    t0.current = performance.now() - pRef.current * HOLD_MS;
    lastPulse.current = 0;
    const loop = (now: number) => {
      const v = Math.min(1, (now - t0.current) / HOLD_MS);
      pRef.current = v;
      setP(v);
      // Pulses quicken as it fills: 220ms apart at the start, 50ms at the end.
      if (now - lastPulse.current > 220 - 170 * v) { haptic.tick(); lastPulse.current = now; }
      if (v >= 1) {
        committed.current = true;
        setHolding(false);
        sfx.stopAll();
        sfx.play('commit');
        haptic.heavy();
        onCommit();
        return;
      }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  useEffect(() => () => stopLoop(), []);

  const R = 70;
  const C = 2 * Math.PI * R;
  return (
    <div className="ob-hold-wrap">
      <button
        type="button"
        className="ob-hold"
        data-holding={holding}
        data-done={done}
        aria-label={done ? 'Locked in' : 'Press and hold to lock in'}
        onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); press(); }}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={e => e.preventDefault()}
        onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press(); } }}
        onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') release(); }}
      >
        <svg viewBox="0 0 160 160" aria-hidden="true">
          <circle cx="80" cy="80" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
          <circle cx="80" cy="80" r={R} fill="none" stroke={done ? '#fff' : '#E10600'} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - (done ? 1 : p))}
            style={{ filter: `drop-shadow(0 0 ${6 + 10 * p}px rgba(225,6,0,${0.4 + 0.5 * p}))` }} />
        </svg>
        <span className="ob-hold-core" style={{ transform: holding ? `scale(${0.9 - 0.08 * p})` : undefined }}>
          {done && (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#050506" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
          )}
        </span>
        {done && <span className="ob-shock" />}
      </button>
      <span className="ob-hold-label" aria-live="polite">
        {done ? 'Locked in.' : holding ? 'Keep holding' : 'Hold to lock in'}
      </span>
    </div>
  );
};

export const Pledge: React.FC<{ a: Answers; onCommit: () => void; onDone: () => void }> = ({ a, onCommit, onDone }) => {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = window.setTimeout(onDone, 1700);
    return () => window.clearTimeout(t);
  }, [done, onDone]);
  return (
    <div className="ob-col">
      {done && <div className="ob-flash" />}
      <Eyebrow>Your word</Eyebrow>
      <h1 className="ob-h1"><Rise text="Make it *official.*" delay={80} /></h1>
      <p className="ob-pledge ob-fade" style={{ animationDelay: '360ms' }}>
        I&apos;ll put in <em>{a.hours} {a.hours === 1 ? 'hour' : 'hours'}</em> a day, every day, until {examLabel(a.exams[0])}.
      </p>
      <HoldToCommit done={done} onCommit={() => { onCommit(); setDone(true); }} />
    </div>
  );
};
