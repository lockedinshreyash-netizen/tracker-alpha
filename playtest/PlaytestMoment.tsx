/* ── "Help Alpha get on the Play Store" ──
   A one-time moment, deliberately not an announcement. Google lets a new app
   onto the Play Store only after enough people have been opted in to a
   closed test for 14 days, and the people most likely to do that are the
   students already using Alpha. So this asks them, once, as a favour and as a
   part in building the thing, not as a notice they can skim past.

   Built on the onboarding's stage (onboarding.css, kit.tsx) so it arrives as
   an event: full screen, the city out of focus, the app's own icon in the
   middle. Lazy, like onboarding; nobody who has seen it downloads it again.

   Shown once per device (`playtest_v1`), never on an iPhone (there is no
   Android app to test there) and never inside the Play app (anyone there
   already joined). App holds it behind onboarding, a running session and
   every other full-screen moment. Remove it, and this folder, once Alpha is
   in production. */

import React, { useEffect, useState } from 'react';
import '../onboarding/onboarding.css';
import * as sfx from '../audio';
import { Eyebrow, Glass, haptic, Rise, Stage } from '../onboarding/kit';
import { PLAYTEST_SEEN_KEY, PLAYTEST_URL } from './gate';

const markSeen = () => {
  try { localStorage.setItem(PLAYTEST_SEEN_KEY, '1'); } catch { /* shown once this session anyway */ }
};

const STEPS = [
  { n: 1, text: <>Tap <b>Join the test</b> below.</> },
  { n: 2, text: <>On Google&apos;s page, tap <b>Become a tester</b>.</> },
  { n: 3, text: <>Stay in for <b>14 days</b>. That&apos;s it.</> },
];

const PlaytestMoment: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [joined, setJoined] = useState(false);

  // Counted as seen the moment it is on screen: one time means one time,
  // whatever button they press or whether they just close the app.
  useEffect(() => {
    markSeen();
    sfx.play('plan-reveal', { late: 800 });
  }, []);

  const join = () => {
    haptic.heavy();
    sfx.play('commit');
    // A real link opened by the tap itself, so no popup blocker stands in the way.
    window.open(PLAYTEST_URL, '_blank', 'noopener,noreferrer');
    setJoined(true);
  };

  return (
    <div className="ob" role="dialog" aria-modal="true" aria-label="Help Tracker Alpha get on the Play Store">
      <Stage dim={joined ? 0.35 : 0.55} />
      <div key={joined ? 'thanks' : 'ask'} className="ob-scene enter">
        <div className="ob-col">
          {/* The app itself, as it will look on a phone's home screen. */}
          <div className="ob-fade" style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 8 }}>
            <img
              src="/icon-192.png"
              alt=""
              width={64}
              height={64}
              style={{ width: 64, height: 64, borderRadius: 16, boxShadow: '0 0 0 1px rgba(255,255,255,0.12), 0 12px 40px -6px rgba(225,6,0,0.55)' }}
            />
            <div>
              <p style={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }}>Tracker Alpha</p>
              <p style={{ fontSize: 12, color: 'var(--ob-faint)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="11" height="12" viewBox="0 0 24 26" aria-hidden="true"><path fill="#34A853" d="M1 1.5l12.6 11.5L1 24.5c-.6-.3-1-1-1-1.8V3.3c0-.8.4-1.5 1-1.8z" /><path fill="#FBBC05" d="M18 9l-4.4 4L18 17l4.6-2.6c1.3-.8 1.3-2 0-2.8L18 9z" /><path fill="#4285F4" d="M1 24.5L13.6 13 18 17 3.1 25.4c-.8.5-1.6.4-2.1-.9z" /><path fill="#EA4335" d="M1 1.5c.5-.4 1.3-.5 2.1 0L18 9l-4.4 4L1 1.5z" /></svg>
                {joined ? 'Closed test · you are in' : 'Coming to Google Play'}
              </p>
            </div>
          </div>

          {!joined ? (
            <>
              <div style={{ marginTop: 34 }}><Eyebrow>A favour · 30 seconds</Eyebrow></div>
              <h1 className="ob-h1"><Rise text="Help Alpha get on the *Play Store.*" delay={100} /></h1>
              <p className="ob-lead ob-fade" style={{ animationDelay: '420ms', maxWidth: '34ch' }}>
                Google only lets a new app in after real students test it. We need you to be one of them.
              </p>

              <div className="ob-fade" style={{ marginTop: 26, animationDelay: '560ms' }}>
                <Glass radius={22} style={{ padding: '4px 18px' }}>
                  {STEPS.map((s, i) => (
                    <div key={s.n} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '15px 0', borderTop: i ? '1px solid var(--ob-line)' : 'none' }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: 99, flexShrink: 0, display: 'grid', placeItems: 'center',
                        fontSize: 12, fontWeight: 800, background: i === 0 ? 'var(--ob-red)' : 'rgba(255,255,255,0.1)', color: '#fff',
                      }}>{s.n}</span>
                      <span style={{ fontSize: 15, lineHeight: 1.4, color: 'var(--ob-muted)' }}>{s.text}</span>
                    </div>
                  ))}
                </Glass>
              </div>

              <div className="ob-actions">
                <button className="ob-primary" onClick={join}>
                  Join the test
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>
                </button>
                <button className="ob-ghost" onClick={() => { sfx.select(); onClose(); }}>Not now</button>
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ob-faint)', lineHeight: 1.5 }}>
                  Free. Needs the Google account on your Android phone.<br />Nothing changes in the app you use now.
                </p>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginTop: 34 }}><Eyebrow>You&apos;re in</Eyebrow></div>
              <h1 className="ob-h1"><Rise text="You just helped *build Alpha.*" delay={100} /></h1>
              <p className="ob-lead ob-fade" style={{ animationDelay: '420ms', maxWidth: '34ch' }}>
                When Alpha goes live on the Play Store, you were one of the first. Thank you.
              </p>
              <p className="ob-fade" style={{ marginTop: 18, fontSize: 14, color: 'var(--ob-faint)', lineHeight: 1.5, animationDelay: '560ms' }}>
                Didn&apos;t see Google&apos;s page?{' '}
                <a href={PLAYTEST_URL} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--ob-ink)', textDecoration: 'underline', textUnderlineOffset: 3 }}>Open it again</a>
                {' '}and tap <b style={{ color: 'var(--ob-muted)' }}>Become a tester</b>.
              </p>
              <div className="ob-actions">
                <button className="ob-light" onClick={() => { sfx.select(); onClose(); }}>Back to studying</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlaytestMoment;
