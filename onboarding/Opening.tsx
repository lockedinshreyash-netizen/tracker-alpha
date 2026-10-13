/* ── The opening: gate → film → wordmark ──
   One component, because the three share one <video>. It is mounted under
   the gate from the first frame with preload="auto", so the film buffers
   while the student reads two lines and decides about sound; by the time they
   tap, it is usually ready. If it is not, the gate waits a moment and then
   moves on without it. The film never blocks the app.

   The film (onboarding/arena.ts) ends on one red light at the exact centre of
   the frame. The app puts its own red dot on that spot, cuts the video, and
   flies the dot into the full stop of LOCK IN. The red light was "you"; the
   full stop is too. */

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as sfx from '../audio';
import { BEATS } from './arena';
import { haptic, shouldPlayFilm } from './kit';

type Phase = 'gate' | 'waiting' | 'film' | 'mark';

/* Where the dot is going, measured once the wordmark has laid out. */
interface Flight { x: number; y: number; s: number }

const READY_TIMEOUT_MS = 2600;

const clockNow = (): string =>
  new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
    .format(new Date())
    .replace(/\s?(am|pm)$/i, (_m, p: string) => ` ${p.toLowerCase()}`);

const LINES: Array<{ at: number; until: number; text: (clock: string) => string; you?: boolean }> = [
  { at: BEATS.time, until: BEATS.someone - 0.15, text: c => `It's ${c}.` },
  { at: BEATS.someone, until: BEATS.lakhs - 0.15, text: () => 'Somewhere, someone just opened a book.' },
  { at: BEATS.lakhs, until: BEATS.you - 0.12, text: () => 'Lakhs of them. All after your seat.' },
  { at: BEATS.you, until: BEATS.out + 0.5, text: () => 'This one is you.', you: true },
];

const filmSrc = (): string =>
  typeof window !== 'undefined' && window.innerHeight >= window.innerWidth
    ? '/onboarding/arena-portrait.mp4'
    : '/onboarding/arena-landscape.mp4';

interface Props {
  onDone: () => void;
  onSignIn: () => void;
}

const Opening: React.FC<Props> = ({ onDone, onSignIn }) => {
  const [phase, setPhase] = useState<Phase>('gate');
  const [line, setLine] = useState(-1);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [landed, setLanded] = useState(false);
  const [film] = useState(shouldPlayFilm);
  const [src] = useState(filmSrc);
  const [clock] = useState(clockNow);
  const video = useRef<HTMLVideoElement>(null);
  const period = useRef<HTMLSpanElement>(null);
  const scored = useRef(false);

  // The score and the stings, downloading while the gate is read.
  useEffect(() => { sfx.prefetch(['arena', 'wordmark', 'hold', 'commit', 'plan-reveal']); }, []);

  // Free the decoder and the buffer the moment the film is not needed.
  useEffect(() => () => {
    const v = video.current;
    if (!v) return;
    v.pause();
    v.removeAttribute('src');
    v.load();
  }, []);

  const toMark = () => {
    const v = video.current;
    if (v) v.pause();
    setLine(-1);
    setPhase('mark');
  };

  const begin = (withSound: boolean) => {
    // This tap is the gesture that unlocks audio and haptics at all.
    sfx.setSoundEnabled(withSound);
    haptic.select();
    const v = video.current;
    if (!film || !v) { toMark(); return; }
    // The picture can play once enough of it has arrived; the score once it
    // is decoded. Wait for both, briefly: a film without its music is fine,
    // a gate that never opens is not.
    const pictureReady = v.readyState >= 3
      ? Promise.resolve(true)
      : new Promise<boolean>(resolve => {
        const timer = window.setTimeout(() => { v.removeEventListener('canplay', ok); resolve(false); }, READY_TIMEOUT_MS);
        function ok() { window.clearTimeout(timer); resolve(true); }
        v.addEventListener('canplay', ok, { once: true });
      });
    const scoreReady = withSound ? sfx.ready('arena', 1500) : Promise.resolve(false);
    if (v.readyState < 3) setPhase('waiting');
    void Promise.all([pictureReady, scoreReady]).then(([ok]) => {
      if (!ok) { toMark(); return; }
      setPhase('film');
      v.currentTime = 0;
      void v.play().catch(toMark);
    });
  };

  /* Words follow the video's own clock, not a timer started beside it: a
     stalled frame holds the words with it. requestVideoFrameCallback where it
     exists (Chromium, Safari 15.4+), animation frames elsewhere. */
  useEffect(() => {
    if (phase !== 'film') return;
    const v = video.current as (HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number; cancelVideoFrameCallback?: (id: number) => void }) | null;
    if (!v) return;
    let id = 0;
    let rvfc = false;
    const tick = () => {
      const t = v.currentTime;
      const idx = LINES.findIndex(l => t >= l.at && t < l.until);
      setLine(prev => (prev === idx ? prev : idx));
      if (t >= BEATS.end - 0.06 || v.ended) { toMark(); return; }
      if (v.requestVideoFrameCallback) { rvfc = true; id = v.requestVideoFrameCallback(tick); } else id = requestAnimationFrame(tick);
    };
    const onPlaying = () => {
      if (scored.current) return;
      scored.current = true;
      sfx.play('arena', { late: 400 });
    };
    v.addEventListener('playing', onPlaying);
    v.addEventListener('ended', toMark);
    tick();
    return () => {
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('ended', toMark);
      if (rvfc) v.cancelVideoFrameCallback?.(id); else cancelAnimationFrame(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // A haptic on "This one is you", where the red light turns.
  useEffect(() => {
    if (line >= 0 && LINES[line].you) haptic.heavy();
  }, [line]);

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

  const skipFilm = () => {
    sfx.stopAll();
    toMark();
  };

  return (
    <div className="ob-scene center" style={{ padding: 0 }} onClick={phase === 'film' ? skipFilm : undefined}>
      {film && (
        <video
          ref={video}
          className="ob-film"
          src={src}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          aria-hidden="true"
          /* Fades in, but cuts out: the film's last frame is the red light at
             the centre, and the app's own dot takes over on that exact spot.
             A fade would show both dots for half a second. */
          style={{ opacity: phase === 'film' ? 1 : 0, transition: phase === 'film' ? 'opacity 500ms ease' : 'none' }}
        />
      )}

      {phase === 'film' && (
        <>
          <div className="ob-film-words" aria-live="polite">
            {line >= 0 && (
              <p key={line} className={`ob-film-line ${LINES[line].you ? 'you' : ''}`}>
                {LINES[line].text(clock)}
              </p>
            )}
          </div>
          <button className="ob-film-skip" onClick={e => { e.stopPropagation(); skipFilm(); }}>Skip</button>
        </>
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
            Already have an account? <span style={{ color: 'var(--ob-ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Sign in</span>
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
                  Let&apos;s build your plan.
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
