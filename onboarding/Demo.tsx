/* ── The opening demo ──
   What the app does, shown rather than told, in three beats of about three
   seconds each: plan the day, start the clock, keep the streak. It replaced a
   film of a city at night that looked good and said nothing about the app.

   Everything is drawn in the app's own subject and activity colours, from
   HTML and CSS: no video to download, nothing to go stale. One clock drives
   it (animation frames, paused while the tab is hidden), and every sound and
   every visual change reads that clock, so they cannot drift apart. The day
   shown is the kind of day a student actually has: a block before school,
   school, one long evening block, and revision at night. */

import React, { useEffect, useRef, useState } from 'react';
import * as sfx from '../audio';
import { ACTIVITY_BASE, SUBJECT_COLORS } from '../schedule/colors';
import { haptic, Rise } from './kit';

/** Beat lengths, ms. */
const BEATS = [3300, 3500, 3200] as const;
export const DEMO_MS = BEATS.reduce((a, b) => a + b, 0);
const STARTS = BEATS.map((_, i) => BEATS.slice(0, i).reduce((a, b) => a + b, 0));

const CAPTIONS = ['Plan your *day.*', 'Start the *clock.*', 'Keep the *streak.*'];

const ease = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

/* ── Beat 1 · the day ── */

const GENERAL = '#A1A1AA';
const DAY: Array<{ time: string; title: string; sub: string; color: string; text: string; tall?: boolean }> = [
  { time: '6:00 AM', title: 'Physics', sub: 'Rotational Motion · 6:00 – 7:30 AM', color: SUBJECT_COLORS.Physics.dot, text: SUBJECT_COLORS.Physics.text },
  { time: '8:00 AM', title: 'School', sub: '8:00 AM – 2:00 PM', color: ACTIVITY_BASE.class, text: '#B7C4FF', tall: true },
  { time: '4:00 PM', title: 'Chemistry', sub: 'Chemical Bonding · 4:00 – 6:00 PM', color: SUBJECT_COLORS.Chemistry.dot, text: SUBJECT_COLORS.Chemistry.text, tall: true },
  { time: '9:00 PM', title: 'Revision', sub: 'Error notebook · 9:00 – 10:00 PM', color: GENERAL, text: '#E4E4E7' },
];
/** When each block drops in, ms into the beat. */
const DROPS = [380, 820, 1260, 1700];

const PlanBeat: React.FC<{ t: number }> = ({ t }) => (
  <div className="ob-demo-card">
    <div className="ob-demo-head">
      <span>Today</span>
      <b>5h 30m study</b>
    </div>
    <div className="ob-demo-day">
      {DAY.map((b, i) => {
        const k = ease((t - DROPS[i]) / 420);
        return (
          <div key={b.title} className="ob-demo-row" style={{ opacity: k, transform: `translate3d(0, ${(1 - k) * -14}px, 0)` }}>
            <span className="ob-demo-time">{b.time}</span>
            <div
              className="ob-demo-block"
              style={{ background: `${b.color}24`, boxShadow: `inset 3px 0 0 ${b.color}, inset 0 0 0 1px ${b.color}55`, minHeight: b.tall ? 58 : 46 }}
            >
              <b style={{ color: b.text }}>{b.title}</b>
              <span>{b.sub}</span>
            </div>
          </div>
        );
      })}
      {/* The now-line: the one place the accent appears, as in the Plan tab. */}
      <div className="ob-demo-now" style={{ top: '58%', opacity: ease((t - 2200) / 400) }}><span>NOW</span></div>
    </div>
  </div>
);

/* ── Beat 2 · the clock ── */

const TARGET_S = 2 * 3600;
const RUN_FROM = 350;
const RUN_MS = 2300;

const clock = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

const TimerBeat: React.FC<{ t: number }> = ({ t }) => {
  const p = ease((t - RUN_FROM) / RUN_MS);
  const secs = p * TARGET_S;
  const logged = t >= RUN_FROM + RUN_MS + 120;
  const R = 74;
  const C = 2 * Math.PI * R;
  const chem = SUBJECT_COLORS.Chemistry;
  return (
    <div className="ob-demo-card ob-demo-timer">
      <span className="ob-demo-subject" style={{ color: chem.text, background: `${chem.dot}22`, boxShadow: `inset 0 0 0 1px ${chem.dot}55` }}>
        <i style={{ background: chem.dot }} />Chemistry · Chemical Bonding
      </span>
      <div className="ob-demo-ring">
        <svg viewBox="0 0 168 168" aria-hidden="true">
          <circle cx="84" cy="84" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
          <circle cx="84" cy="84" r={R} fill="none" stroke="#E10600" strokeWidth="7" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - p)} transform="rotate(-90 84 84)" />
        </svg>
        <b className="num-timer">{clock(secs)}</b>
      </div>
      <span className="ob-demo-logged" data-on={logged}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        Logged · 2h
      </span>
    </div>
  );
};

/* ── Beat 3 · the streak ── */

const ROLL_AT = 900;
const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const StreakBeat: React.FC<{ t: number }> = ({ t }) => {
  const rolled = t >= ROLL_AT;
  return (
    <div className="ob-demo-card ob-demo-streak">
      <div className="ob-demo-count">
        <span className="ob-demo-roll" style={{ transform: rolled ? 'translate3d(0, -50%, 0)' : 'none' }}>
          <b>6</b><b>7</b>
        </span>
      </div>
      <span className="ob-demo-label">day streak</span>
      <div className="ob-demo-week">
        {WEEK.map((d, i) => {
          const today = i === 6;
          const on = today ? rolled : true;
          return (
            <span key={i} data-on={on} data-today={today}>
              <i />
              {d}
            </span>
          );
        })}
      </div>
      <span className="ob-demo-next" style={{ opacity: ease((t - ROLL_AT - 500) / 400) }}>Wallpaper pack unlocks at 30 days</span>
    </div>
  );
};

/* ── The reel ── */

/** Sounds, ms from the start of the demo. */
const CUES: Array<{ at: number; play: () => void }> = [
  ...DROPS.map((d, i) => ({ at: STARTS[0] + d, play: () => { sfx.play('tap', { semitones: [0, 2, 4, 7][i], late: 200 }); haptic.tick(); } })),
  { at: STARTS[1] + RUN_FROM - 60, play: () => { sfx.play('session-start', { late: 300 }); haptic.select(); } },
  { at: STARTS[1] + RUN_FROM + RUN_MS + 120, play: () => { sfx.play('logged-3', { late: 300 }); haptic.select(); } },
  { at: STARTS[2] + ROLL_AT, play: () => { sfx.play('streak-2', { late: 300 }); haptic.heavy(); } },
];

/** The demo's sounds, fetched while the gate is read. */
export const DEMO_SOUNDS = ['tap', 'session-start', 'logged-3', 'streak-2'] as const;

const Demo: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const [ms, setMs] = useState(0);
  const fired = useRef(0);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    const tick = (now: number) => {
      // A frame gap longer than a tenth of a second is a hidden tab or a
      // stall, not time the student watched: the reel waits for them.
      elapsed += Math.min(100, now - last);
      last = now;
      while (fired.current < CUES.length && CUES[fired.current].at <= elapsed) {
        CUES[fired.current].play();
        fired.current++;
      }
      setMs(elapsed);
      if (elapsed >= DEMO_MS) { doneRef.current(); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const beat = ms < STARTS[1] ? 0 : ms < STARTS[2] ? 1 : 2;
  const t = ms - STARTS[beat];
  // Each beat fades out over its last 260ms, so the next one arrives clean.
  const out = ease((t - (BEATS[beat] - 260)) / 260);

  return (
    <div className="ob-demo">
      <div className="ob-demo-bars" aria-hidden="true">
        {BEATS.map((len, i) => (
          <span key={i}><i style={{ transform: `scaleX(${i < beat ? 1 : i > beat ? 0 : Math.min(1, t / len)})` }} /></span>
        ))}
      </div>
      <div key={beat} className="ob-demo-beat" style={{ opacity: 1 - out }}>
        <h1 className="ob-h1 ob-demo-caption"><Rise text={CAPTIONS[beat]} /></h1>
        {beat === 0 && <PlanBeat t={t} />}
        {beat === 1 && <TimerBeat t={t} />}
        {beat === 2 && <StreakBeat t={t} />}
      </div>
    </div>
  );
};

export default Demo;
