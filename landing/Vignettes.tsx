/* ── The product, drawn small ──
   Each feature tile shows a slice of the real app instead of a stock photo or
   a stale screenshot: built from HTML and CSS in the app's own colours, so it
   is sharp on any screen, costs no image download, and stays in step with the
   design. Everything here is decorative (aria-hidden) and pure — no clocks, no
   randomness — so the build-time render and the browser's first render match. */

import React from 'react';
import type { Exam } from './content';

const SUB = {
  Physics: { c: '#4A90E2', bg: '#E8F0FA', fg: '#1D4E8F' },
  Chemistry: { c: '#34C77B', bg: '#E4F5EC', fg: '#1B6B45' },
  Maths: { c: '#9B59E2', bg: '#F1EAFA', fg: '#5B2E8F' },
  Biology: { c: '#E29B29', bg: '#FBF0DF', fg: '#8A5B12' },
  General: { c: '#71717A', bg: '#ECEAE5', fg: '#57534E' },
};

type Vars = React.CSSProperties & Record<`--${string}`, string>;

export const Check: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Cross: React.FC<{ size?: number }> = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M4.5 4.5l7 7m0-7l-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/* ── Study timer ── */
export const TimerVis: React.FC = () => {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="v-timer" aria-hidden="true">
      <div className="v-ring">
        <svg viewBox="0 0 168 168">
          <defs>
            <linearGradient id="lp-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff5a4d" />
              <stop offset="1" stopColor="#e10600" />
            </linearGradient>
          </defs>
          <circle cx="84" cy="84" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle cx="84" cy="84" r={r} fill="none" stroke="url(#lp-ring)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * 0.72} ${c}`} />
        </svg>
        <div className="v-ring-c">
          <b>47:12</b>
          <span>PHYSICS</span>
        </div>
      </div>
      <div className="v-chips">
        <div className="v-chip"><span>Mode</span><b>Stopwatch</b></div>
        <div className="v-chip"><span>Today so far</span><b>5h 12m</b></div>
        <div className="v-chip">
          <span>Focus</span>
          <span className="v-pomo"><i className="on" /><i className="on" /><i className="on" /><i className="on" /><i /></span>
        </div>
        <div className="v-chip">
          <span>Pomodoro 50 / 10</span>
          <span className="v-pomo"><i className="on" /><i className="on" /><i className="on" /><i /></span>
        </div>
      </div>
    </div>
  );
};

/* ── Day planner ── */
const HOURS = [6, 9, 12, 15, 18, 21];
const hourLabel = (h: number) => (h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`);
const START = 6;
const SPAN = 17.5;
const y = (h: number) => `${2.5 + ((h - START) / SPAN) * 95}%`;
const hgt = (a: number, b: number) => `${((b - a) / SPAN) * 95}%`;

export const PlanVis: React.FC<{ exam: Exam }> = ({ exam }) => {
  const evening = exam === 'NEET'
    ? { ...SUB.Biology, t: 'Biology', s: 'Human Physiology' }
    : { ...SUB.Maths, t: 'Maths', s: 'Integration' };
  const blocks = [
    { a: 6, b: 7.5, ...SUB.Physics, t: 'Physics', s: 'Rotational Motion' },
    { a: 8, b: 13, c: '#8A84B5', bg: '#EEEDF6', fg: '#46416A', t: 'Coaching', s: '8:00 – 1:00 PM' },
    { a: 13.1, b: 13.85, c: '#E2A33C', bg: '#FBF3E2', fg: '#7A5512', t: 'Lunch', s: '' },
    { a: 14, b: 16.25, ...SUB.Chemistry, t: 'Chemistry', s: 'Chemical Equilibrium' },
    { a: 16.5, b: 17.5, c: '#2BB3A3', bg: '#E3F4F2', fg: '#145E57', t: 'Gym', s: '' },
    { a: 18, b: 20.5, ...evening },
    { a: 21, b: 22, ...SUB.General, t: 'Revise mistakes', s: 'Error notebook' },
  ];
  return (
    <div className="v-plan" aria-hidden="true">
      {HOURS.map(h => (
        <div key={h} className="v-hour" style={{ top: y(h) }}><span>{hourLabel(h)}</span></div>
      ))}
      {blocks.map(b => (
        <div
          key={b.t}
          className="v-block"
          style={{ top: y(b.a), height: hgt(b.a, b.b), '--c': b.c, '--bg': b.bg, '--fg': b.fg } as Vars}
        >
          <b>{b.t}</b>
          {b.s && b.b - b.a >= 1 && <span>{b.s}</span>}
        </div>
      ))}
      <div className="v-now" style={{ top: y(15.15) }}><span>NOW</span></div>
    </div>
  );
};

/* ── Syllabus ── */
const SEGS = ['done', 'done', 'done', 'done', 'rev', 'rev', 'prog', 'prog', '', '', '', '', '', '', ''];
export const SyllabusVis: React.FC = () => (
  <div className="v-syl" aria-hidden="true">
    <div className="v-syl-top"><span>Physics · Class 11</span><b>38%</b></div>
    <div className="v-segs">{SEGS.map((s, i) => <i key={i} className={s} />)}</div>
    {[
      ['Units and Measurements', 'Done', 'st-done'],
      ['Motion in a Plane', 'Done', 'st-done'],
      ['Laws of Motion', 'Revise', 'st-rev'],
      ['Work, Energy and Power', 'In progress', 'st-prog'],
      ['Rotational Motion', 'Not started', 'st-not'],
    ].map(([ch, st, cls]) => (
      <div key={ch} className="v-ch"><span>{ch}</span><span className={`v-st ${cls}`}>{st}</span></div>
    ))}
  </div>
);

/* ── Mock tests ── */
const SCORES = [142, 158, 151, 176, 203];
export const MocksVis: React.FC = () => {
  const W = 300;
  const px = (i: number) => 8 + (i * (W - 16)) / (SCORES.length - 1);
  const py = (s: number) => 100 - ((s - 120) / 100) * 88;
  const line = SCORES.map((s, i) => `${i ? 'L' : 'M'}${px(i)},${py(s)}`).join(' ');
  return (
    <div className="v-mock" aria-hidden="true">
      <div className="v-mock-top"><b>203<small> / 300</small></b><span>+27 since last</span></div>
      <svg viewBox={`0 0 ${W} 110`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="lp-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4A90E2" stopOpacity="0.22" />
            <stop offset="1" stopColor="#4A90E2" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[20, 55, 90].map(g => <line key={g} x1="0" x2={W} y1={g} y2={g} stroke="rgba(10,10,11,0.06)" strokeWidth="1" />)}
        <path d={`${line} L${px(SCORES.length - 1)},110 L${px(0)},110 Z`} fill="url(#lp-area)" />
        <path d={line} fill="none" stroke="#4A90E2" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {SCORES.map((s, i) => (
          <circle key={i} cx={px(i)} cy={py(s)} r={i === SCORES.length - 1 ? 5.5 : 4} fill={i === SCORES.length - 1 ? '#e10600' : '#4A90E2'} stroke="#fafaf8" strokeWidth="2" />
        ))}
      </svg>
      <div className="v-tags"><span>−24 Electrostatics</span><span>−16 Thermodynamics</span></div>
    </div>
  );
};

/* ── Error notebook ── */
export const ErrorsVis: React.FC = () => (
  <div className="v-err" aria-hidden="true">
    <div className="v-err-q">A block slides down a rough incline at constant speed. The angle is 30°. Find the coefficient of friction.</div>
    <div className="v-opts">
      <span className="v-opt"><i>A</i>1/2</span>
      <span className="v-opt bad"><i>B</i>√3/2</span>
      <span className="v-opt"><i>C</i>√3</span>
      <span className="v-opt good"><i>D</i>1/√3</span>
    </div>
    <div className="v-err-foot"><span>Why: mixed up sin and cos</span><span className="v-dots"><i className="on" /><i /></span></div>
  </div>
);

/* ── Flashcards ── */
export const CardsVis: React.FC = () => (
  <div className="v-cards" aria-hidden="true">
    <div className="v-card back2" />
    <div className="v-card back1" />
    <div className="v-card front">
      <span className="v-card-l">Chemistry · Gases</span>
      <span className="v-card-q">Ideal gas equation</span>
      <span><span className="v-slot">PV = nRT</span></span>
      <div className="v-rate">
        <span>Again<small>1m</small></span>
        <span>Hard<small>8m</small></span>
        <span className="pick">Good<small>2d</small></span>
        <span>Easy<small>5d</small></span>
      </div>
    </div>
  </div>
);

/* ── Streak ── */
const HEAT = [
  '', 'h1', '', 'h2', 'h1', '', '',
  'h1', '', 'h2', 'h1', '', 'h2', 'h3',
  'h2', 'h3', 'h1', 'h2', 'h3', 'h2', 'h1',
  'h3', 'h2', 'h3', 'h3', 'h2', 'h3', 'h2',
  'h3', 'h3', 'h2', 'h3', 'h3', 'h3', 'h3',
];
export const StreakVis: React.FC = () => (
  <div className="v-streak" aria-hidden="true">
    <div className="v-streak-n"><b>23</b><span>day streak</span></div>
    <div className="v-heat">{HEAT.map((h, i) => <i key={i} className={h} />)}</div>
    <div className="v-next"><span>Next reward</span><b>The 30 Pack · 7 days</b></div>
  </div>
);

/* ── Live race ── */
const RACE = [
  { n: 'Aarav', h: '6h 42m', w: '100%', live: true },
  { n: 'Diya', h: '6h 05m', w: '91%', live: false },
  { n: 'You', h: '5h 48m', w: '86%', live: true, me: true },
  { n: 'Kabir', h: '5h 12m', w: '78%', live: false },
  { n: 'Meera', h: '4h 37m', w: '69%', live: true },
];
export const RaceVis: React.FC = () => (
  <div className="v-race" aria-hidden="true">
    <div className="v-race-top"><span>Today · Batch 2027</span><span className="ph-badge"><i />LIVE</span></div>
    <div className="v-race-rows">
      {RACE.map((r, i) => (
        <div key={r.n} className={`v-race-row${r.me ? ' me' : ''}`} style={{ '--w': r.w } as Vars}>
          <span>{i + 1}</span>
          <span className="fl-av">{r.n[0]}</span>
          <span>{r.n}{r.live && <span className="v-live" />}</span>
          <b>{r.h}</b>
          <s />
        </div>
      ))}
    </div>
  </div>
);

/* ── Stats ── */
const WEEK: Array<[string, number[]]> = [
  ['M', [28, 22, 18]], ['T', [34, 20, 24]], ['W', [22, 30, 20]], ['T', [36, 26, 30]],
  ['F', [30, 34, 22]], ['S', [40, 30, 34]], ['S', [26, 18, 14]],
];
export const StatsVis: React.FC<{ exam: Exam }> = ({ exam }) => {
  const third = exam === 'NEET' ? SUB.Biology.c : SUB.Maths.c;
  const r = 44;
  const c = 2 * Math.PI * r;
  return (
    <div className="v-stats" aria-hidden="true">
      <div className="v-week">
        {WEEK.map(([d, parts], i) => (
          <div key={i} className="v-day">
            <i style={{ height: parts[2] * 1.2, '--c': third } as Vars} />
            <i style={{ height: parts[1] * 1.2, '--c': SUB.Chemistry.c } as Vars} />
            <i style={{ height: parts[0] * 1.2, '--c': SUB.Physics.c } as Vars} />
            <span>{d}</span>
          </div>
        ))}
      </div>
      <div className="v-score">
        <svg viewBox="0 0 104 104">
          <circle cx="52" cy="52" r={r} fill="none" stroke="rgba(10,10,11,0.07)" strokeWidth="7" />
          <circle cx="52" cy="52" r={r} fill="none" stroke="#e10600" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * 0.82} ${c}`} />
        </svg>
        <div><b>82</b><span>LOCK-IN</span></div>
      </div>
    </div>
  );
};

/* ── Devices ── */
export const DevicesVis: React.FC = () => (
  <div className="v-dev" aria-hidden="true">
    <div className="v-laptop">
      <div className="v-laptop-scr">
        <div>
          <span className="v-side"><i /><i /><i /><i /><i /></span>
          <span className="v-main"><b>05:48:12</b><i /><i /><i /></span>
        </div>
      </div>
      <div className="v-laptop-base" />
    </div>
    <div className="v-mini"><div><b>05:48</b><i /><i /><i /></div></div>
    <span className="v-sync"><i />Synced</span>
  </div>
);
