/* ── The first screen ──
   A members' club door, not a product page: near-black, bone-white serif, one
   red wax seal, five words of headline. The reader is a teenager on a phone,
   so the screen says one thing ("not everyone gets in"), what it is and for
   which exam (the line under the H1, which carries the search phrase), and
   two ways forward. The exam chips under it are links to each exam's own page.

   Everything that moves on load is CSS, so the page arrives the same way
   before and after the bundle hydrates it. No window or storage reads in
   render, no useId (see CLAUDE.md, Landing page). */

import React, { useEffect, useState } from 'react';
import { EXAM_ROW, ROOT, Variant, heroLine } from './content';
import { landingNow } from './clock';

export const Arrow: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4 10h11m-4.5-5L15 10l-4.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** One clock for the countdowns. Starts at the build time (see clock.ts), then the real time. */
export const useNow = (): number => {
  const [now, setNow] = useState(landingNow);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
};

export const daysLeft = (target: number, now: number) => Math.max(0, Math.floor((target - now) / 86_400_000));

/* The wax seal's edge: a circle with a slow wobble, computed once at module
   load from a fixed formula, so the server and the browser draw the same path. */
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

/** The seal: the one place the brand red lives on this page. The α is pressed in. */
export const Seal: React.FC<{ size?: number; className?: string; gid?: string }> = ({ size = 112, className, gid = 'lp-wax' }) => (
  <svg className={`lp-seal${className ? ` ${className}` : ''}`} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
    <defs>
      <radialGradient id={gid} cx="38%" cy="32%" r="75%">
        <stop offset="0" stopColor="#e2261b" />
        <stop offset="0.55" stopColor="#a90d07" />
        <stop offset="1" stopColor="#5c0603" />
      </radialGradient>
    </defs>
    <path d={SEAL_PATH} fill={`url(#${gid})`} />
    <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="1.6" />
    <circle cx="50" cy="50" r="34" fill="none" stroke="rgba(255,190,170,0.22)" strokeWidth="0.8" transform="translate(-0.7 -0.7)" />
    <text x="50.9" y="64.9" textAnchor="middle" className="lp-seal-a lp-seal-hi">α</text>
    <text x="50" y="64" textAnchor="middle" className="lp-seal-a">α</text>
  </svg>
);

export const Hero: React.FC<{ variant: Variant; onCta: () => void; onInvite: () => void }> = ({ variant, onCta, onInvite }) => (
  <header className="lp-hero">
    <div className="lp-hero-in">
      <Seal className="in-1" />
      <p className="lp-label in-2">Members only</p>
      <h1 className="lp-h1">
        <span className="in-2">Not everyone</span>{' '}
        <span className="in-3">gets in.</span>
        <small className="in-4">{heroLine(variant)}</small>
      </h1>
      <div className="lp-actions in-5">
        <button id="landing-cta-hero" type="button" className="lp-btn" onClick={onCta}>
          Request access <Arrow />
        </button>
        <button id="landing-invite-hero" type="button" className="lp-link" onClick={onInvite}>
          I have an invite
        </button>
      </div>
      <nav className="lp-exams in-5" aria-label="Pick your exam">
        {EXAM_ROW.map(x => (
          <a key={x.path} href={x.path} aria-current={variant !== ROOT && variant.path === x.path ? 'page' : undefined}>{x.label}</a>
        ))}
      </nav>
    </div>
    <a className="lp-scroll in-5" href="#inside" aria-label="See what's inside">
      <span />
    </a>
  </header>
);
