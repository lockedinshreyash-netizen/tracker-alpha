/* ── Install ──
   The last thing before the first session: put the app on the home screen.
   A study tracker that lives in a browser tab is forgotten by Thursday; one
   on the home screen is opened every time the phone is.

   Offered on every browser that can install with one tap (Chrome, Edge,
   Samsung Internet: `useInstall().supported`) unless the app is already on
   the device. The button really installs: one tap here, one tap on the
   browser's own confirm sheet, and the icon is on the home screen. No browser
   lets a page skip that confirm. iOS has no install API at all, and this step
   is never offered there rather than becoming a page of Share-sheet
   instructions.

   It does NOT wait for Chrome's prompt before showing. Chrome sends it only
   after 30 seconds on the site, and a quick onboarding gets here sooner; when
   the step waited for it, most students never saw the step. So the button is
   live at once. Tapped before the prompt has arrived, it holds the tap for up
   to TAP_WAIT_MS (inside the browser's ~5s window for a gesture) and installs
   the moment the prompt lands; past that it says "almost ready" and comes back
   as soon as it can, and only if nothing has come in GIVE_UP_MS does it let
   the student carry on.

   The picture is the promise: a home screen, with our icon dropping into it. */

import React, { useEffect, useRef, useState } from 'react';
import * as sfx from '../audio';
import { Eyebrow, haptic, Rise } from './kit';

const TAP_WAIT_MS = 4000;
const GIVE_UP_MS = 30_000;
const DONE_HOLD_MS = 1500;

const onPhone = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

type Phase =
  /* The button, live, whether or not the prompt is here yet. */
  | 'ready'
  /* Tapped; installing, or holding the tap until the prompt arrives. */
  | 'asking'
  /* Tapped too early. Back to 'ready' the moment the prompt arrives. */
  | 'almost'
  | 'done'
  | 'declined'
  /* The browser never offered it. */
  | 'unavailable';

/* Muted, unbranded tiles: somebody's home screen, not anybody's apps. */
const TILES = [
  '#2b2b31', '#33302b', '#2a3130', '#302a33',
  '#2d2f36', null, '#2b3330', '#332c2c',
  '#2c2c33', '#35302c', '#30332c', '#2f2b35',
];

const HomeScreen: React.FC<{ landed: boolean }> = ({ landed }) => (
  <div className="ob-ins-phone" aria-hidden="true">
    <div className="ob-ins-notch" />
    <div className="ob-ins-grid">
      {TILES.map((c, i) => (
        c
          ? <span key={i} className="ob-ins-tile" style={{ background: c }} />
          : (
            <span key={i} className="ob-ins-slot">
              <span className={`ob-ins-app ${landed ? 'landed' : ''}`}>
                <img src="/icon-192.png" alt="" width={46} height={46} draggable={false} />
              </span>
              <span className="ob-ins-name">Tracker Alpha</span>
            </span>
          )
      ))}
    </div>
  </div>
);

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export const InstallStep: React.FC<{
  /** The browser has handed over a working install prompt. */
  available: boolean;
  onInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  onNext: () => void;
}> = ({ available, onInstall, onNext }) => {
  const [phase, setPhase] = useState<Phase>('ready');
  /* Set once the prompt has turned up after an early tap: "tap again". */
  const [nowReady, setNowReady] = useState(false);
  const phone = useRef(onPhone()).current;
  const where = phone ? 'home screen' : 'desktop';
  const firing = useRef(false);
  const tappedAt = useRef(0);

  const fire = async () => {
    if (firing.current) return;
    firing.current = true;
    const outcome = await onInstall();
    firing.current = false;
    if (outcome === 'accepted') {
      haptic.heavy();
      sfx.play('target-hit');
      setPhase('done');
    } else if (outcome === 'dismissed') {
      setPhase('declined');
    } else {
      setPhase('almost');
    }
  };

  /* A tap holds until the prompt arrives, as long as the gesture still counts. */
  useEffect(() => {
    if (phase !== 'asking' || firing.current) return;
    if (available) { void fire(); return; }
    const left = Math.max(0, TAP_WAIT_MS - (Date.now() - tappedAt.current));
    const t = window.setTimeout(() => setPhase('almost'), left);
    return () => window.clearTimeout(t);
  }, [phase, available]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Too early: back to the button as soon as the prompt lands, or give up. */
  useEffect(() => {
    if (phase !== 'almost') return;
    if (available) { setNowReady(true); setPhase('ready'); return; }
    const t = window.setTimeout(() => setPhase('unavailable'), GIVE_UP_MS);
    return () => window.clearTimeout(t);
  }, [phase, available]);

  useEffect(() => {
    if (phase !== 'done') return;
    const t = window.setTimeout(onNext, DONE_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase, onNext]);

  const install = () => {
    if (phase !== 'ready') return;
    haptic.select();
    sfx.select();
    tappedAt.current = Date.now();
    setNowReady(false);
    setPhase('asking');
    /* Straight from the tap when the prompt is here: the gesture is freshest. */
    if (available) void fire();
  };

  const done = phase === 'done';

  return (
    <div className="ob-col">
      <Eyebrow>One last thing</Eyebrow>
      <h1 className="ob-h1">
        <Rise text={done ? 'Done. *It’s yours.*' : 'Don’t lose it *in a tab.*'} delay={80} />
      </h1>
      <p className="ob-lead ob-fade" style={{ animationDelay: '260ms' }}>
        {done
          ? `Tracker Alpha is on your ${where}. Open it from there tomorrow.`
          : `Install it on your ${phone ? 'phone' : 'computer'} so you actually use it every day, and don’t forget it by tomorrow.`}
      </p>

      <div className="ob-fade" style={{ animationDelay: '340ms' }}>
        <HomeScreen landed={done} />
      </div>

      {!done && (
        <ul className="ob-ins-why ob-fade" style={{ animationDelay: '420ms' }}>
          <li><i><Check /></i>Opens in one tap, like any app</li>
          <li><i><Check /></i>Full screen. No browser, no tabs.</li>
          <li><i><Check /></i>Free. Takes two seconds.</li>
        </ul>
      )}

      <div className="ob-actions">
        {phase === 'declined' || phase === 'unavailable' ? (
          <>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ob-faint)', margin: 0 }}>
              {phase === 'declined'
                ? 'No problem. Install it any time from the settings gear.'
                : 'Your browser isn’t offering it right now. Install it later from the settings gear.'}
            </p>
            <button className="ob-primary" onClick={() => { sfx.select(); onNext(); }}>Continue</button>
          </>
        ) : done ? (
          <button className="ob-primary" onClick={onNext}>
            <Check /> Installed
          </button>
        ) : (
          <>
            {(phase === 'almost' || nowReady) && (
              <p style={{ textAlign: 'center', fontSize: 13, color: nowReady ? 'var(--ob-ink)' : 'var(--ob-faint)', margin: 0 }} aria-live="polite">
                {nowReady ? 'Ready. Tap Install.' : 'Your browser is getting it ready. One second.'}
              </p>
            )}
            <button
              className="ob-primary ob-ins-btn"
              onClick={install}
              disabled={phase !== 'ready'}
              data-ready={phase === 'ready'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" />
              </svg>
              {phase === 'asking' ? 'Installing…' : phase === 'almost' ? 'Almost ready…' : 'Install app'}
            </button>
            <button className="ob-ghost ob-ins-later" onClick={() => { sfx.select(); onNext(); }}>Not now</button>
          </>
        )}
      </div>
    </div>
  );
};
