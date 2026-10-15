/* ── Install ──
   The last thing before the first session: put the app on the home screen.
   A study tracker that lives in a browser tab is forgotten by Thursday; one
   on the home screen is opened every time the phone is.

   Shown only where the browser gave us a real install prompt (Chrome, Edge,
   Samsung Internet; `beforeinstallprompt`, see install/useInstall.ts). There
   the button really installs: one tap here, one tap on the browser's own
   confirm sheet, and the icon is on the home screen. No browser lets a page
   skip that confirm. iOS has no install API at all, and this step is never
   offered there rather than becoming a page of Share-sheet instructions.

   The picture is the promise: a home screen, with our icon dropping into it.

   Coming back from Google lands here too (the page reloaded, so the prompt has
   to arrive again). If it has not arrived within WAIT_MS, the step steps aside
   on its own instead of showing a button that cannot work. */

import React, { useEffect, useRef, useState } from 'react';
import * as sfx from '../audio';
import { Eyebrow, haptic, Rise } from './kit';

const WAIT_MS = 2500;
const DONE_HOLD_MS = 1500;

const onPhone = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

type Phase = 'ready' | 'waiting' | 'asking' | 'done' | 'declined';

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
  const [phase, setPhase] = useState<Phase>(available ? 'ready' : 'waiting');
  const phone = useRef(onPhone()).current;
  const where = phone ? 'home screen' : 'desktop';

  /* The prompt can arrive while this is on screen (after a reload), or never. */
  useEffect(() => {
    if (phase !== 'waiting') return;
    if (available) { setPhase('ready'); return; }
    const t = window.setTimeout(onNext, WAIT_MS);
    return () => window.clearTimeout(t);
  }, [phase, available, onNext]);

  useEffect(() => {
    if (phase !== 'done') return;
    const t = window.setTimeout(onNext, DONE_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase, onNext]);

  const install = async () => {
    if (phase !== 'ready') return;
    haptic.select();
    sfx.select();
    setPhase('asking');
    const outcome = await onInstall();
    if (outcome === 'accepted') {
      haptic.heavy();
      sfx.play('target-hit');
      setPhase('done');
    } else {
      setPhase('declined');
    }
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
        {phase === 'declined' ? (
          <>
            <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ob-faint)', margin: 0 }}>
              No problem. Install it any time from the settings gear.
            </p>
            <button className="ob-primary" onClick={() => { sfx.select(); onNext(); }}>Continue</button>
          </>
        ) : done ? (
          <button className="ob-primary" onClick={onNext}>
            <Check /> Installed
          </button>
        ) : (
          <>
            <button
              className="ob-primary ob-ins-btn"
              onClick={() => { void install(); }}
              disabled={phase === 'waiting' || phase === 'asking'}
              data-ready={phase === 'ready'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" />
              </svg>
              {phase === 'waiting' ? 'Getting it ready…' : phase === 'asking' ? 'Installing…' : 'Install app'}
            </button>
            <button className="ob-ghost ob-ins-later" onClick={() => { sfx.select(); onNext(); }}>Not now</button>
          </>
        )}
      </div>
    </div>
  );
};
