/* ── The first screen ──
   The H1 carries the search phrase students actually type ("crack JEE 2027"),
   the first paragraph is the one-sentence definition every engine should
   learn, and the product sits beside them, live: the session clock ticks and
   the cards drift with the pointer. Everything that moves on load is CSS, so
   the page arrives the same way before and after the bundle hydrates it. */

import React, { useEffect, useRef, useState } from 'react';
import { EXAMS, Exam, SUBJECT_DOT } from './content';
import { landingNow } from './clock';

type Vars = React.CSSProperties & Record<`--${string}`, string>;

export const Arrow: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
    <path d="M4 10h11m-4.5-5L15 10l-4.5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
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

const pad = (n: number) => String(n).padStart(2, '0');

export const countdown = (target: number, now: number) => {
  const ms = Math.max(0, target - now);
  const s = Math.floor(ms / 1000);
  return { days: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
};

/* The session on the phone runs from the moment the page mounts, so it ticks
   from the same 1:24:36 on the server, on hydration and for every visitor. */
const PhoneClock: React.FC = () => {
  const [secs, setSecs] = useState(5076);
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => setSecs(5076 + Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <>{pad(Math.floor(secs / 3600))}:{pad(Math.floor((secs % 3600) / 60))}:{pad(secs % 60)}</>;
};

const Countdown: React.FC<{ exam: Exam }> = ({ exam }) => {
  const now = useNow();
  const e = EXAMS[exam];
  const t = countdown(e.target, now);
  return (
    <div className="lp-count in-5">
      <p className="lp-count-num">
        <b>{t.days}</b>
        <span>{e.unit}</span>
      </p>
      <p className="lp-count-note">{e.note} Every day you track is a day you can see.</p>
      <p className="lp-count-clock">
        <b>+ {pad(t.h)}:{pad(t.m)}:{pad(t.s)}</b>
        <br />hours : minutes : seconds
      </p>
    </div>
  );
};

const PhoneArt: React.FC<{ exam: Exam }> = ({ exam }) => {
  const third = exam === 'NEET' ? 'Biology' : 'Maths';
  const subjects: Array<[string, string, string, string]> = [
    ['Physics', SUBJECT_DOT.Physics, '82%', '2h 10m'],
    ['Chemistry', SUBJECT_DOT.Chemistry, '66%', '1h 45m'],
    [third, SUBJECT_DOT[third], '48%', '1h 17m'],
  ];
  const r = 21;
  const c = 2 * Math.PI * r;
  return (
    <div className="lp-art-stage">
      <div className="lp-phone">
        <div className="lp-screen">
          <div className="ph-status">
            <span>9:41</span>
            <span>
              <span className="ph-bars"><i style={{ height: 3 }} /><i style={{ height: 5 }} /><i style={{ height: 7 }} /><i style={{ height: 9 }} /></span>
              <span className="ph-batt"><i /></span>
            </span>
          </div>
          <div className="ph-head">
            <div>
              <div className="ph-title">Today</div>
              <div className="ph-date">Day 23 of your streak</div>
            </div>
            <div className="ph-avatar">α</div>
          </div>
          <div className="ph-session">
            <div className="ph-live">
              <span className="ph-badge"><i />SESSION LIVE</span>
              <span className="ph-chip"><i style={{ background: SUBJECT_DOT.Physics }} />Physics</span>
            </div>
            <div className="ph-time"><PhoneClock /></div>
            <div className="ph-chapter">Rotational Motion · Torque</div>
            <div className="ph-track"><i /></div>
            <div className="ph-track-meta"><span>STOPWATCH</span><span>TIMED ✓</span></div>
          </div>
          <div className="ph-goal">
            <svg width="50" height="50" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
              <circle cx="25" cy="25" r={r} fill="none" stroke="#e10600" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${c * 0.65} ${c}`} transform="rotate(-90 25 25)" />
            </svg>
            <div><b>5h 12m</b><span>of your 8h goal today</span></div>
          </div>
          <div className="ph-subjects">
            {subjects.map(([n, col, w, h]) => (
              <div key={n} className="ph-sub" style={{ '--c': col, '--w': w } as Vars}>
                <em>{n}</em><s /><b>{h}</b>
              </div>
            ))}
          </div>
          <div className="ph-tabbar"><i /><i /><i /><i /><i /></div>
        </div>
      </div>

      <div className="lp-float fl-streak">
        <div className="lp-float-in">
          <div className="fl-label">Streak</div>
          <div className="fl-big"><b>23</b><span>days</span></div>
          <div className="fl-week">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <i key={i} className={i === 6 ? 'off' : ''}>{d}</i>)}
          </div>
        </div>
      </div>
      <div className="lp-float fl-race">
        <div className="lp-float-in">
          <div className="fl-label">Today's race</div>
          <div className="fl-rows">
            <div className="fl-row"><span>2</span><span className="fl-av">D</span><span>Diya</span><b>6h 05m</b></div>
            <div className="fl-row me"><span>3</span><span className="fl-av">Y</span><span>You</span><b>5h 48m</b></div>
            <div className="fl-row"><span>4</span><span className="fl-av">K</span><span>Kabir</span><b>5h 12m</b></div>
          </div>
        </div>
      </div>
      <div className="lp-float fl-syl">
        <div className="lp-float-in">
          <div className="fl-label">Syllabus · Class 11</div>
          <div className="fl-meter"><i /></div>
          <div className="fl-sub"><span>Physics</span><b>62% done</b></div>
        </div>
      </div>
    </div>
  );
};

export const Hero: React.FC<{ exam: Exam; onExam: (e: Exam) => void; onCta: () => void }> = ({ exam, onExam, onCta }) => {
  const artRef = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  /* Pointer parallax on the floating cards: two CSS variables written in a
     frame, never React state, and only for a real mouse. */
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse' || !artRef.current) return;
    const { innerWidth: w, innerHeight: h } = window;
    const x = (e.clientX / w) * 2 - 1;
    const yy = (e.clientY / h) * 2 - 1;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      artRef.current?.style.setProperty('--px', x.toFixed(3));
      artRef.current?.style.setProperty('--py', yy.toFixed(3));
    });
  };

  return (
    <header className="lp-hero lp-dark" onPointerMove={onMove}>
      <div className="lp-wrap">
        <div className="lp-pill in-1">
          <span className="lp-pill-dot" aria-hidden="true" />
          <span>Free for</span>
          <span className="lp-seg" role="group" aria-label="Choose your exam">
            {(['JEE', 'NEET'] as const).map(x => (
              <button key={x} type="button" aria-pressed={exam === x} onClick={() => onExam(x)}>{x}</button>
            ))}
          </span>
          <span>2027 aspirants</span>
        </div>

        <h1 className="lp-h1">
          <span className="in-2">Crack {EXAMS[exam].label} 2027,</span>{' '}
          <span className="lp-serif l2 in-3">one tracked hour</span>{' '}
          <span className="lp-serif in-3">at a time<span className="lp-stop">.</span></span>
        </h1>

        <div className="lp-hero-body">
          <div className="lp-hero-copy in-4">
            <p className="lp-lead">
              <strong>Tracker Alpha</strong> is the free study tracker for JEE and NEET 2027 aspirants. Time every session,
              plan your day, finish the syllabus chapter by chapter, and see exactly where you stand.
            </p>
            <div className="lp-ctas">
              <button id="landing-cta-hero" type="button" className="lp-btn lp-btn-red" onClick={onCta}>
                Start tracking free <Arrow />
              </button>
              <a className="lp-btn lp-btn-ghost" href="#features">See what's inside</a>
            </div>
            <p className="lp-micro">₹0<i>·</i>No card<i>·</i>No ads<i>·</i>Works on any phone</p>
          </div>
          <div className="lp-hero-art in-4" ref={artRef} aria-hidden="true">
            <PhoneArt exam={exam} />
          </div>
        </div>

        <Countdown exam={exam} />
      </div>
    </header>
  );
};
