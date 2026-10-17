/* ── Keep it: the last thing before the first session ──
   A study tracker that lives in a browser tab is forgotten by Thursday; one on
   the home screen, the Dock or the bookmarks bar is in front of the student
   every time they open their phone or browser. Every device gets the step, in
   the form its platform allows (install/platform.ts):

     prompt           One tap here, one on the browser's own confirm sheet.
                      Live at once, without waiting for Chrome's prompt, which
                      Chrome only sends after 30 seconds on the site: a tap
                      before it holds for TAP_WAIT_MS (inside the browser's
                      gesture window) and installs the moment it lands; past
                      that it reads "Almost ready…", then "Ready. Tap Install."
                      when it arrives, and offers Continue after GIVE_UP_MS.
     ios-share /      No API exists. The same button opens the exact taps
     mac-dock /       (install/Guides.tsx), with an arrow at the real Share or
     firefox-android  File button. "I've added it" is the student's word.
     bookmark         Desktop browsers that cannot install. The control is the
                      bookmark itself: drag the chip onto the bookmarks bar, or
                      press ⌘D / Ctrl+D, which we hear and answer.
     inapp            Instagram, WhatsApp and friends: open it in the real
                      browser first.

   After it is done or declined, one more line offers a daily study block in
   the student's own calendar, the fallback that rings on any device.

   The picture is the promise: a home screen (or a bookmarks bar) with our icon
   dropping into it. */

import React, { useEffect, useRef, useState } from 'react';
import * as sfx from '../audio';
import { Eyebrow, haptic, Rise } from './kit';
import type { DayMinute } from '../types';
import type { KeepMethod } from '../install/platform';
import { bookmarkKeys, readEnv } from '../install/platform';
import { GuideSheet, InAppEscape, guideFor } from '../install/Guides';
import CalendarButtons from '../install/CalendarButtons';
import { markAsked, markKept } from '../install/keepState';
import { holdTitle } from '../ui/tabTitle';

const TAP_WAIT_MS = 4000;
const GIVE_UP_MS = 30_000;
const APP_LINK = 'https://trackeralpha.in/?open=today';

const onPhone = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

type Phase =
  /* The button, live, whether or not the prompt is here yet. */
  | 'ready'
  /* Tapped; installing, or holding the tap until the prompt arrives. */
  | 'asking'
  /* Tapped too early. Back to 'ready' the moment the prompt arrives. */
  | 'almost'
  /* Bookmark: the shortcut was pressed and the browser's box is open. */
  | 'bookmarking'
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

/* A browser window with an empty place on the bookmarks bar. */
const BookmarksBar: React.FC<{ landed: boolean }> = ({ landed }) => (
  <div className="ob-bm-window" aria-hidden="true">
    <div className="ob-bm-chrome"><i /><i /><i /><span className="ob-bm-url">trackeralpha.in</span></div>
    <div className="ob-bm-bar">
      <span className="ob-bm-ghost" style={{ width: 54 }} />
      <span className="ob-bm-ghost" style={{ width: 70 }} />
      <span className={`ob-bm-slot ${landed ? 'landed' : ''}`}>
        <span className="ob-bm-chip"><img src="/icon-192.png" alt="" width={14} height={14} draggable={false} />Tracker Alpha</span>
      </span>
      <span className="ob-bm-ghost" style={{ width: 46 }} />
    </div>
    <div className="ob-bm-page" />
  </div>
);

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" />
  </svg>
);

export const InstallStep: React.FC<{
  method: KeepMethod;
  /** The browser has handed over a working install prompt. */
  available: boolean;
  onInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  onNext: () => void;
  goalHours: number;
  studyMinute: DayMinute;
}> = ({ method, available, onInstall, onNext, goalHours, studyMinute }) => {
  const [phase, setPhase] = useState<Phase>('ready');
  /* Set once the prompt has turned up after an early tap: "tap again". */
  const [nowReady, setNowReady] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const phone = useRef(onPhone()).current;
  const env = useRef(readEnv()).current;
  const keys = bookmarkKeys(env);
  const where = method === 'mac-dock' ? 'Dock' : method === 'bookmark' ? 'bookmarks bar' : phone ? 'home screen' : 'desktop';
  const firing = useRef(false);
  const tappedAt = useRef(0);
  const guide = guideFor(method, env.ua);

  /* This is the first ask. KeepBanner waits its three days from here. */
  useEffect(() => { markAsked(); }, []);

  const finish = (via: 'install' | 'bookmark' | 'guide') => {
    markKept(via);
    haptic.heavy();
    sfx.play('target-hit');
    setPhase('done');
  };

  const fire = async () => {
    if (firing.current) return;
    firing.current = true;
    const outcome = await onInstall();
    firing.current = false;
    if (outcome === 'accepted') finish('install');
    else if (outcome === 'dismissed') setPhase('declined');
    else setPhase('almost');
  };

  /* A tap holds until the prompt arrives, as long as the gesture still counts. */
  useEffect(() => {
    if (method !== 'prompt' || phase !== 'asking' || firing.current) return;
    if (available) { void fire(); return; }
    const left = Math.max(0, TAP_WAIT_MS - (Date.now() - tappedAt.current));
    const t = window.setTimeout(() => setPhase('almost'), left);
    return () => window.clearTimeout(t);
  }, [phase, available, method]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Too early: back to the button as soon as the prompt lands, or give up. */
  useEffect(() => {
    if (phase !== 'almost') return;
    if (available) { setNowReady(true); setPhase('ready'); return; }
    const t = window.setTimeout(() => setPhase('unavailable'), GIVE_UP_MS);
    return () => window.clearTimeout(t);
  }, [phase, available]);

  /* ── Bookmark: a short title for the bookmark, and the shortcut, heard ──
     The bookmark takes the page title, and the app's is a search-result
     sentence. While this step is up it is just "Tracker Alpha". */
  useEffect(() => {
    if (method !== 'bookmark') return;
    const release = holdTitle();
    document.title = 'Tracker Alpha';
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'd') {
        /* Not prevented: the browser's own bookmark box is the whole point. */
        setPhase(p => (p === 'ready' ? 'bookmarking' : p));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); release(); };
  }, [method]);

  const install = () => {
    if (phase !== 'ready') return;
    haptic.select();
    sfx.select();
    if (method !== 'prompt') { setGuideOpen(true); return; }
    tappedAt.current = Date.now();
    setNowReady(false);
    setPhase('asking');
    /* Straight from the tap when the prompt is here: the gesture is freshest. */
    if (available) void fire();
  };

  const done = phase === 'done';
  const after = done || phase === 'declined' || phase === 'unavailable';

  if (method === 'inapp') {
    return (
      <div className="ob-col" style={{ justifyContent: 'center' }}>
        <InAppEscape ua={env.ua} onContinue={onNext} />
      </div>
    );
  }

  const lead = done
    ? `Tracker Alpha is on your ${where}. Open it from there tomorrow.`
    : method === 'bookmark'
      ? 'Pin it to your bookmarks bar so it’s one click away every time you open your browser, and you don’t forget it by tomorrow.'
      : `${method === 'mac-dock' ? 'Put it in your Dock' : `Install it on your ${phone ? 'phone' : 'computer'}`} so you actually use it every day, and don’t forget it by tomorrow.`;

  const buttonLabel = method === 'ios-share' ? 'Add to Home Screen'
    : method === 'mac-dock' ? 'Add to Dock'
      : phase === 'asking' ? 'Installing…' : phase === 'almost' ? 'Almost ready…' : 'Install app';

  return (
    <div className="ob-col">
      <Eyebrow>One last thing</Eyebrow>
      <h1 className="ob-h1">
        <Rise text={done ? 'Done. *It’s yours.*' : 'Don’t lose it *in a tab.*'} delay={80} />
      </h1>
      <p className="ob-lead ob-fade" style={{ animationDelay: '260ms' }}>{lead}</p>

      <div className="ob-fade" style={{ animationDelay: '340ms' }}>
        {method === 'bookmark' ? <BookmarksBar landed={done} /> : <HomeScreen landed={done} />}
      </div>

      {!after && method !== 'bookmark' && (
        <ul className="ob-ins-why ob-fade" style={{ animationDelay: '420ms' }}>
          <li><i><Check /></i>Opens in one tap, like any app</li>
          <li><i><Check /></i>Full screen. No browser, no tabs.</li>
          <li><i><Check /></i>Free. Takes {method === 'prompt' ? 'two seconds' : 'ten seconds'}.</li>
        </ul>
      )}

      {/* ── Bookmark: the chip is the control ── */}
      {!after && method === 'bookmark' && (
        <div className="ob-bm-do ob-fade" style={{ animationDelay: '420ms' }}>
          {phase === 'bookmarking' ? (
            <p className="ob-bm-hint" aria-live="polite">
              In the box that opened, pick <b>Bookmarks bar</b>, then <b>Done</b>. Don’t see the bar? Press <kbd>{keys.bar}</kbd>.
            </p>
          ) : (
            <>
              <a
                className="ob-bm-drag"
                href={APP_LINK}
                draggable
                onClick={e => e.preventDefault()}
                onDragEnd={e => { if (e.dataTransfer.dropEffect !== 'none') finish('bookmark'); }}
                title="Drag me to your bookmarks bar"
              >
                <img src="/icon-192.png" alt="" width={18} height={18} draggable={false} />
                Tracker Alpha
              </a>
              <p className="ob-bm-hint">Drag this up onto your bookmarks bar.</p>
              <p className="ob-bm-or">or press <kbd>{keys.mod}</kbd> <kbd>D</kbd></p>
            </>
          )}
        </div>
      )}

      <div className="ob-actions">
        {after ? (
          <>
            {!done && (
              <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--ob-faint)', margin: 0 }}>
                {phase === 'declined'
                  ? 'No problem. Install it any time from the settings gear.'
                  : 'Your browser isn’t offering it right now. Install it later from the settings gear.'}
              </p>
            )}
            <div className="ob-cal-wrap">
              <p className="ob-cal-label">One more: a daily study block in your calendar</p>
              <CalendarButtons variant="ob" goalHours={goalHours} studyMinute={studyMinute} />
            </div>
            <button className="ob-primary" onClick={() => { sfx.select(); onNext(); }}>
              {done ? <><Check /> Continue</> : 'Continue'}
            </button>
          </>
        ) : method === 'bookmark' ? (
          <>
            <button className="ob-primary" onClick={() => finish('bookmark')}>
              <Check /> {phase === 'bookmarking' ? 'Done, it’s bookmarked' : 'I’ve bookmarked it'}
            </button>
            <button className="ob-ghost ob-ins-later" onClick={() => { sfx.select(); setPhase('declined'); }}>Not now</button>
          </>
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
              <DownloadIcon />
              {buttonLabel}
            </button>
            <button className="ob-ghost ob-ins-later" onClick={() => { sfx.select(); setPhase('declined'); }}>Not now</button>
          </>
        )}
      </div>

      {guideOpen && guide && (
        <GuideSheet
          guide={guide}
          onClose={() => setGuideOpen(false)}
          onDone={() => { setGuideOpen(false); finish('guide'); }}
        />
      )}
    </div>
  );
};
