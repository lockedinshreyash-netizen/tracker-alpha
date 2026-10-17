/* ── Guided paths, where no install API exists ──
   iPhone and iPad (Share → Add to Home Screen), Safari on a Mac (File → Add
   to Dock), Firefox on Android (menu → Add app to Home screen), and the way
   out of an in-app browser. No page can do any of these for the student, so
   the next best thing is the exact taps, each with the glyph they are hunting
   for, and an arrow at the real place that button lives on their screen.

   Rendered through a portal to <body> with its own stylesheet (guides.css):
   the onboarding scene is a transformed ancestor, and a fixed sheet inside it
   would be positioned against the scene instead of the screen. Used by the
   onboarding keep step and by KeepBanner. */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './guides.css';
import type { KeepMethod } from './platform';
import { chromeIntentUrl, inAppName, isAndroidUA } from './platform';

/* ── Glyphs: the icons the student is looking for on their own screen ── */

export const ShareGlyph: React.FC = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v13" /><path d="m8 7 4-4 4 4" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
  </svg>
);
export const PlusSquareGlyph: React.FC = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8.5v7M8.5 12h7" />
  </svg>
);
const DotsGlyph: React.FC = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="5" cy="12" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="19" cy="12" r="1.9" />
  </svg>
);
const KebabGlyph: React.FC = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="12" cy="5" r="1.9" /><circle cx="12" cy="12" r="1.9" /><circle cx="12" cy="19" r="1.9" />
  </svg>
);
const MenuBarGlyph: React.FC = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18M7 6.5h3" />
  </svg>
);
const DockGlyph: React.FC = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="14" width="18" height="6" rx="2.5" /><rect x="6" y="6" width="5" height="5" rx="1.4" /><rect x="13" y="6" width="5" height="5" rx="1.4" />
  </svg>
);
const CheckGlyph: React.FC = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const CompassGlyph: React.FC = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" />
  </svg>
);

/* ── Which taps, on which screen ── */

export type ArrowAt = 'bottom-center' | 'bottom-right' | 'top-right' | 'top-left';

export interface Step { glyph: React.ReactNode; label: string; tail?: string }

export interface Guide {
  eyebrow: string;
  title: string;
  steps: Step[];
  arrow?: ArrowAt;
  note?: string;
}

/* Safari 26 folded Share into the ••• menu at the bottom right. The OS
   version in the UA is frozen at 18_x from iOS 26 on, so Safari's own version
   is the reliable signal. */
const safariMajor = (ua: string): number => Number(ua.match(/Version\/(\d+)/)?.[1] ?? 0);
const isIPad = (ua: string): boolean => /iPad/i.test(ua) || (/Macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);

export const guideFor = (method: KeepMethod, ua: string): Guide | null => {
  if (method === 'ios-share') {
    if (/CriOS/i.test(ua)) {
      return {
        eyebrow: 'Three taps',
        title: 'Add Alpha to your home screen',
        steps: [
          { glyph: <ShareGlyph />, label: 'Share', tail: 'at the top right, next to the address' },
          { glyph: <PlusSquareGlyph />, label: 'Add to Home Screen' },
          { glyph: <CheckGlyph />, label: 'Add', tail: 'at the top right' },
        ],
        arrow: 'top-right',
      };
    }
    if (isIPad(ua)) {
      return {
        eyebrow: 'Three taps',
        title: 'Add Alpha to your home screen',
        steps: [
          { glyph: <ShareGlyph />, label: 'Share', tail: 'at the top right of Safari' },
          { glyph: <PlusSquareGlyph />, label: 'Add to Home Screen' },
          { glyph: <CheckGlyph />, label: 'Add' },
        ],
        arrow: 'top-right',
      };
    }
    if (safariMajor(ua) >= 26) {
      return {
        eyebrow: 'Four taps',
        title: 'Add Alpha to your home screen',
        steps: [
          { glyph: <DotsGlyph />, label: '•••', tail: 'at the bottom right' },
          { glyph: <ShareGlyph />, label: 'Share' },
          { glyph: <PlusSquareGlyph />, label: 'Add to Home Screen', tail: '(scroll down if you don’t see it)' },
          { glyph: <CheckGlyph />, label: 'Add' },
        ],
        arrow: 'bottom-right',
      };
    }
    return {
      eyebrow: 'Three taps',
      title: 'Add Alpha to your home screen',
      steps: [
        { glyph: <ShareGlyph />, label: 'Share', tail: 'at the bottom of the screen' },
        { glyph: <PlusSquareGlyph />, label: 'Add to Home Screen', tail: '(scroll down if you don’t see it)' },
        { glyph: <CheckGlyph />, label: 'Add', tail: 'at the top right' },
      ],
      arrow: 'bottom-center',
    };
  }
  if (method === 'mac-dock') {
    return {
      eyebrow: 'Three clicks',
      title: 'Add Alpha to your Dock',
      steps: [
        { glyph: <MenuBarGlyph />, label: 'File', tail: 'in the menu bar at the top' },
        { glyph: <DockGlyph />, label: 'Add to Dock…' },
        { glyph: <CheckGlyph />, label: 'Add' },
      ],
      arrow: 'top-left',
      note: 'It opens like an app, in its own window, straight from your Dock.',
    };
  }
  if (method === 'firefox-android') {
    return {
      eyebrow: 'Two taps',
      title: 'Add Alpha to your home screen',
      steps: [
        { glyph: <KebabGlyph />, label: '⋮', tail: 'Firefox’s menu' },
        { glyph: <PlusSquareGlyph />, label: 'Add app to Home screen', tail: '(then Add)' },
      ],
    };
  }
  return null;
};

const Arrow: React.FC<{ at: ArrowAt }> = ({ at }) => (
  <div className={`kg-arrow kg-arrow-${at}`} aria-hidden="true">
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 4v15" /><path d="m6 13 6 6 6-6" />
    </svg>
  </div>
);

/** The steps, as a sheet over everything. "I've added it" is the student's word for done. */
export const GuideSheet: React.FC<{ guide: Guide; onDone: () => void; onClose: () => void }> = ({ guide, onDone, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="kg-root" role="dialog" aria-modal="true" aria-label={guide.title}>
      <div className="kg-scrim" onClick={onClose} />
      {guide.arrow && <Arrow at={guide.arrow} />}
      <div className={`kg-sheet ${guide.arrow?.startsWith('top') ? 'kg-sheet-low' : ''}`}>
        <p className="kg-eyebrow">{guide.eyebrow}</p>
        <h2 className="kg-title">{guide.title}</h2>
        <ol className="kg-steps">
          {guide.steps.map((s, i) => (
            <li key={i}>
              <span className="kg-n">{i + 1}</span>
              <span className="kg-glyph">{s.glyph}</span>
              <span className="kg-text">Tap <b>{s.label}</b>{s.tail ? <> <span>{s.tail}</span></> : null}</span>
            </li>
          ))}
        </ol>
        {guide.note && <p className="kg-note">{guide.note}</p>}
        <button type="button" className="kg-primary" onClick={onDone}>I&apos;ve added it</button>
        <button type="button" className="kg-ghost" onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body,
  );
};

/* ── Out of an in-app browser ──
   Android: an intent: link really does hand the page to Chrome. iOS: no
   link can, so the steps point at the webview's own menu, with Copy link as
   the fallback that always works. */
export const InAppEscape: React.FC<{ ua: string; onContinue?: () => void; compact?: boolean }> = ({ ua, onContinue, compact }) => {
  const [copied, setCopied] = useState(false);
  const android = isAndroidUA(ua);
  const app = inAppName(ua);
  const href = typeof location !== 'undefined' ? location.href : 'https://trackeralpha.in/';
  const copy = async () => {
    try { await navigator.clipboard.writeText(href); setCopied(true); } catch { /* the steps still work */ }
  };
  return (
    <div className={`kg-inapp ${compact ? 'kg-inapp-compact' : ''}`}>
      <p className="kg-eyebrow">You&apos;re inside {app}</p>
      <h2 className="kg-title">Open Alpha in {android ? 'Chrome' : 'Safari'}.</h2>
      <p className="kg-lead">
        {app === 'this app' ? 'This in-app browser' : `${app}’s browser`} can’t keep Alpha. Your streak and progress can get wiped, and you can’t install it from here.
      </p>
      {android ? (
        <a className="kg-primary" href={chromeIntentUrl(href)}>Open in Chrome</a>
      ) : (
        <ol className="kg-steps">
          <li><span className="kg-n">1</span><span className="kg-glyph"><DotsGlyph /></span><span className="kg-text">Tap <b>•••</b> <span>or the <CompassGlyph /> icon, usually top right</span></span></li>
          <li><span className="kg-n">2</span><span className="kg-glyph"><CompassGlyph /></span><span className="kg-text">Tap <b>Open in Safari</b> <span>(or Open in browser)</span></span></li>
        </ol>
      )}
      <button type="button" className={android ? 'kg-ghost' : 'kg-primary'} onClick={() => { void copy(); }}>
        {copied ? 'Link copied. Paste it in your browser.' : 'Copy link'}
      </button>
      {onContinue && <button type="button" className="kg-ghost" onClick={onContinue}>Continue here anyway</button>}
    </div>
  );
};
