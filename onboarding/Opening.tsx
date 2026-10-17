/* ── The opening: gate → demo → wordmark ──
   The gate asks one thing, sound or not, and that tap is the gesture that
   unlocks audio at all. Then the demo (Demo.tsx) shows the app in three
   beats, and the wordmark lands: a red dot flies from the centre into the
   full stop of LOCK IN.

   Inside Instagram, WhatsApp or another app's browser, the gate is preceded
   by the way out: those webviews cannot install Alpha and often throw its
   storage away, so a student who onboards there can lose everything they set
   up. "Continue here anyway" stays one tap away. */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as sfx from '../audio';
import Demo, { DEMO_SOUNDS } from './Demo';
import { haptic, prefersReducedMotion } from './kit';
import { InAppEscape } from '../install/Guides';
import { isInApp } from '../install/platform';

type Phase = 'inapp' | 'gate' | 'waiting' | 'demo' | 'mark';

const inWebview = (): boolean => typeof navigator !== 'undefined' && isInApp(navigator.userAgent);

/* Where the dot is going, measured once the wordmark has laid out. */
interface Flight { x: number; y: number; s: number }

/** How long the gate waits for the demo's sounds before starting without them. */
const SOUND_WAIT_MS = 1200;

interface Props {
  onDone: () => void;
  /** "Already have an account?": straight to Google. */
  onSignIn: () => void;
}

const Opening: React.FC<Props> = ({ onDone, onSignIn }) => {
  const [phase, setPhase] = useState<Phase>(() => (inWebview() ? 'inapp' : 'gate'));
  const [flight, setFlight] = useState<Flight | null>(null);
  const [landed, setLanded] = useState(false);
  const period = useRef<HTMLSpanElement>(null);

  // The demo's sounds and the stings after it, downloading while the gate is read.
  useEffect(() => { sfx.prefetch([...DEMO_SOUNDS, 'wordmark', 'hold', 'commit']); }, []);

  const begin = (withSound: boolean) => {
    sfx.setSoundEnabled(withSound);
    haptic.select();
    // Reduced motion gets the wordmark, not a reel of moving cards.
    if (prefersReducedMotion()) { setPhase('mark'); return; }
    if (!withSound) { setPhase('demo'); return; }
    /* Decoded before the reel starts, so the first block lands with its
       sound. Briefly: a demo without sound is fine, a gate that never opens
       is not. */
    setPhase('waiting');
    const wait = new Promise<void>(resolve => window.setTimeout(resolve, SOUND_WAIT_MS));
    void Promise.race([Promise.all(DEMO_SOUNDS.map(c => sfx.ready(c, SOUND_WAIT_MS))), wait])
      .then(() => setPhase('demo'));
  };

  /* The wordmark: lay it out with its full stop invisible, measure where that
     full stop is, and fly the dot there from the centre. */
  useLayoutEffect(() => {
    if (phase !== 'mark' || !period.current) return;
    const r = period.current.getBoundingClientRect();
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    setFlight({ x: r.left + r.width / 2 - cx, y: r.top + r.height / 2 - cy, s: r.width / 18 });
    const land = window.setTimeout(() => {
      setLanded(true);
      sfx.play('wordmark');
      haptic.heavy();
    }, 620);
    return () => window.clearTimeout(land);
  }, [phase]);

  const toMark = () => {
    sfx.stopAll();
    setPhase('mark');
  };

  return (
    <div className="ob-scene center" style={{ padding: 0 }}>
      {phase === 'demo' && (
        <>
          <Demo onDone={() => setPhase('mark')} />
          <button className="ob-reel-skip" onClick={toMark}>Skip</button>
        </>
      )}

      {phase === 'inapp' && (
        <div className="ob-col" style={{ justifyContent: 'center', padding: '0 24px' }}>
          <InAppEscape ua={navigator.userAgent} onContinue={() => setPhase('gate')} />
        </div>
      )}

      {(phase === 'gate' || phase === 'waiting') && (
        <div className="ob-col" style={{ justifyContent: 'center', alignItems: 'center', padding: '0 24px', textAlign: 'center' }}>
          <div className="ob-wordmark ob-fade" style={{ animationDelay: '120ms' }} aria-label="Lock in">
            LOCK IN<span className="ob-period breathe" />
          </div>
          <p className="ob-serif ob-fade" style={{ fontSize: 'clamp(20px, 5.4vw, 28px)', marginTop: 22, color: 'var(--ob-muted)', animationDelay: '380ms' }}>
            Your rank starts today.
          </p>
          <div className="ob-fade" style={{ width: '100%', maxWidth: 360, marginTop: 'clamp(48px, 10vh, 84px)', display: 'grid', gap: 8, animationDelay: '620ms' }}>
            <button className="ob-light" onClick={() => begin(true)} disabled={phase === 'waiting'}>
              {phase === 'waiting' ? 'Loading…' : 'Begin'}
            </button>
            <button className="ob-ghost" onClick={() => begin(false)} disabled={phase === 'waiting'}>Begin without sound</button>
          </div>
          <button
            className="ob-ghost ob-fade"
            style={{ position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)', fontSize: 14, animationDelay: '900ms' }}
            onClick={onSignIn}
          >
            Already have an account? <span style={{ color: 'var(--ob-ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Sign in with Google</span>
          </button>
        </div>
      )}

      {phase === 'mark' && (
        <>
          {!landed && (
            <div
              className="ob-landing-dot"
              style={{
                transform: flight ? `translate3d(${flight.x}px, ${flight.y}px, 0) scale(${flight.s})` : undefined,
                transition: 'transform 620ms cubic-bezier(0.65, 0, 0.35, 1)',
              }}
            />
          )}
          <div className="ob-col" style={{ justifyContent: 'center', alignItems: 'center', padding: '0 24px', textAlign: 'center' }}>
            <div className="ob-wordmark" aria-label="Lock in">
              <span style={{ opacity: landed ? 1 : 0, transform: landed ? 'none' : 'scale(1.12)', filter: landed ? 'none' : 'blur(8px)', transition: 'opacity 500ms ease, transform 700ms cubic-bezier(0.34,1.56,0.64,1), filter 500ms ease' }}>LOCK IN</span>
              <span ref={period} className="ob-period" style={{ opacity: landed ? 1 : 0 }} />
            </div>
            {landed && (
              <>
                <p className="ob-serif ob-fade" style={{ fontSize: 'clamp(20px, 5.4vw, 28px)', marginTop: 22, color: 'var(--ob-muted)', animationDelay: '300ms' }}>
                  Let&apos;s set you up.
                </p>
                <div className="ob-fade" style={{ width: '100%', maxWidth: 360, marginTop: 'clamp(48px, 10vh, 84px)', animationDelay: '700ms' }}>
                  <button className="ob-primary" style={{ width: '100%' }} onClick={() => { haptic.select(); sfx.select(); onDone(); }}>
                    Set me up
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                  </button>
                  <p style={{ marginTop: 14, fontSize: 13, color: 'var(--ob-faint)' }}>Takes about a minute.</p>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default Opening;
