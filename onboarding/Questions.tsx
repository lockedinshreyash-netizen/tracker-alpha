/* ── The questions ──
   Five screens, each asking one thing and showing what the answer does.
   Single choices advance themselves a beat after the tap (the tile has to be
   seen to light up first); the two with a number to set have a button. */

import React, { useEffect, useRef, useState } from 'react';
import * as sfx from '../audio';
import { SUBJECT_COLORS, ACTIVITY_BASE } from '../schedule/colors';
import { DAY_MINUTES } from '../schedule/schedule';
import type { DayMinute, ExamPreference, PomodoroSettings, TimerMode } from '../types';
import { Eyebrow, Glass, haptic, Rise, Tile, TimeButton } from './kit';
import { type Answers, daysLeft, examLabel, formatHours, freeMinutes, freeWindows } from './plan';

export const ADVANCE_MS = 420;

interface Q {
  a: Answers;
  set: (patch: Partial<Answers>) => void;
  next: () => void;
}

const useAutoAdvance = (next: () => void) => {
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  return () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(next, ADVANCE_MS);
  };
};

const choose = () => { sfx.select(); haptic.select(); };

const Head: React.FC<{ n: number; label: string; title: string; lead?: React.ReactNode }> = ({ n, label, title, lead }) => (
  <>
    <Eyebrow n={n}>{label}</Eyebrow>
    <h1 className="ob-h1"><Rise text={title} delay={80} /></h1>
    {lead && <p className="ob-lead ob-fade" style={{ animationDelay: '320ms' }}>{lead}</p>}
  </>
);

/* ── 1 · Exam ── */

export const QExam: React.FC<Q> = ({ a, set, next }) => {
  const advance = useAutoAdvance(next);
  const pick = (exam: ExamPreference) => { choose(); set({ exam }); advance(); };
  const dot = (s: keyof typeof SUBJECT_COLORS) => SUBJECT_COLORS[s].dot;
  return (
    <div className="ob-col">
      <Head n={1} label="The exam" title="Choose your *exam.*" />
      <div className="ob-choices">
        <Tile selected={a.exam === 'JEE'} onClick={() => pick('JEE')} title="JEE" sub="Main and Advanced · Physics, Chemistry, Maths" dots={[dot('Physics'), dot('Chemistry'), dot('Maths')]} delay={260} />
        <Tile selected={a.exam === 'NEET'} onClick={() => pick('NEET')} title="NEET" sub="UG · Physics, Chemistry, Biology" dots={[dot('Physics'), dot('Chemistry'), dot('Biology')]} delay={340} />
      </div>
    </div>
  );
};

/* ── 2 · Class ── */

export const QClass: React.FC<Q> = ({ a, set, next }) => {
  const advance = useAutoAdvance(next);
  const pick = (cls: 11 | 12) => { choose(); set({ cls }); advance(); };
  return (
    <div className="ob-col">
      <Head n={2} label="Your class" title="Which class are you in?" />
      <div className="ob-choices">
        <Tile selected={a.cls === 11} onClick={() => pick(11)} title="Class 11" sub="The Class 11 syllabus comes first." delay={260} />
        <Tile selected={a.cls === 12} onClick={() => pick(12)} title="Class 12" sub="Taking a drop year? Pick this one." delay={340} />
      </div>
    </div>
  );
};

/* ── 3 · The day ── */

const Icon: React.FC<{ d: string; color: string }> = ({ d, color }) => (
  <span className="ob-row-icon" style={{ background: `${color}26`, color }}>
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
  </span>
);
const SUN = 'M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z';
const MOON = 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z';
const BOOK = 'M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2V5zM4 19a2 2 0 012-2h12';
const CAP = 'M2 9l10-5 10 5-10 5L2 9zM6 11v5c3 2 9 2 12 0v-5';

/** The whole day as one bar: sleep, school, coaching, and what is left for study. */
const DayBar: React.FC<{ a: Answers }> = ({ a }) => {
  const pct = (m: number) => `${(m / DAY_MINUTES) * 100}%`;
  const segs: Array<{ s: number; e: number; c: string; key: string }> = [];
  if (a.sleep > a.wake) {
    segs.push({ s: a.sleep, e: DAY_MINUTES, c: ACTIVITY_BASE.sleep, key: 'sleep-night' });
    segs.push({ s: 0, e: a.wake, c: ACTIVITY_BASE.sleep, key: 'sleep-morning' });
  } else {
    segs.push({ s: a.sleep, e: a.wake, c: ACTIVITY_BASE.sleep, key: 'sleep' });
  }
  if (a.school.on) segs.push({ s: a.school.start, e: a.school.end, c: ACTIVITY_BASE.class, key: 'school' });
  if (a.coaching.on) segs.push({ s: a.coaching.start, e: a.coaching.end, c: '#7C93FF', key: 'coaching' });
  const free = freeWindows(a);
  return (
    <>
      <div className="ob-daybar" aria-hidden="true">
        {free.map(([s, e], i) => (
          <i key={`free-${i}`} style={{ left: pct(s), width: pct(e - s), background: 'linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0.14))', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)' }} />
        ))}
        {segs.map(g => (
          <i key={g.key} style={{ left: pct(g.s), width: pct(Math.max(0, g.e - g.s)), background: `${g.c}cc` }} />
        ))}
      </div>
      <div className="ob-daybar-axis" aria-hidden="true">
        <span>4 AM</span><span>10 AM</span><span>4 PM</span><span>10 PM</span><span>4 AM</span>
      </div>
    </>
  );
};

/* Module level, not inside QDay: defined in render it would be a new component
   type on every change, remounting each row (and redrawing its glass) per tap. */
const Row: React.FC<{ icon: React.ReactNode; label: string; sub: string; children: React.ReactNode; delay: number }> = ({ icon, label, sub, children, delay }) => (
  <div className="ob-fade" style={{ animationDelay: `${delay}ms` }}>
    <Glass className="ob-row" radius={20}>
      {icon}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="ob-row-label" style={{ display: 'block' }}>{label}</span>
        <span className="ob-row-sub" style={{ display: 'block' }}>{sub}</span>
      </span>
      {children}
    </Glass>
  </div>
);

export const QDay: React.FC<Q> = ({ a, set, next }) => {
  const free = freeMinutes(a);
  const busy = (key: 'school' | 'coaching', label: string, d: string, color: string, delay: number) => {
    const b = a[key];
    return (
      <Row icon={<Icon d={d} color={color} />} label={label} sub={b.on ? 'Mon to Sat' : 'Not on my day'} delay={delay}>
        {b.on && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <TimeButton label={`${label} starts`} value={b.start} onChange={m => set({ [key]: { ...b, start: m, end: Math.max(b.end, m + 30) } } as Partial<Answers>)} />
            <span style={{ color: 'var(--ob-faint)' }}>–</span>
            <TimeButton label={`${label} ends`} value={b.end} onChange={m => set({ [key]: { ...b, end: Math.max(m, b.start + 30) } } as Partial<Answers>)} />
          </span>
        )}
        <button
          type="button"
          className="ob-toggle"
          role="switch"
          aria-checked={b.on}
          aria-label={label}
          onClick={() => { choose(); set({ [key]: { ...b, on: !b.on } } as Partial<Answers>); }}
        />
      </Row>
    );
  };
  return (
    <div className="ob-col">
      <Head n={3} label="Your day" title="Map your *day.*" lead="We fit your study around everything else." />
      <DayBar a={a} />
      <div className="ob-free ob-fade" style={{ animationDelay: '260ms' }}>
        <b>{formatHours(free)}</b>
        <span>free on a school day</span>
      </div>
      <div className="ob-rows">
        <Row icon={<Icon d={SUN} color="#FAB005" />} label="Wake up" sub="Most days" delay={300}>
          <TimeButton label="Wake up" value={a.wake} onChange={(m: DayMinute) => set({ wake: m })} />
        </Row>
        {busy('school', 'School', CAP, ACTIVITY_BASE.class, 360)}
        {busy('coaching', 'Coaching', BOOK, '#7C93FF', 420)}
        <Row icon={<Icon d={MOON} color={ACTIVITY_BASE.sleep} />} label="Sleep" sub="Lights out" delay={480}>
          <TimeButton label="Sleep" value={a.sleep} onChange={(m: DayMinute) => set({ sleep: m })} />
        </Row>
      </div>
      <div className="ob-actions">
        <button className="ob-primary" onClick={() => { sfx.select(); haptic.select(); next(); }}>Continue</button>
      </div>
    </div>
  );
};

/* ── 4 · Hours ── */

const TIERS: Array<[number, string, string]> = [
  [3, 'Warming up', 'rgba(255,255,255,0.08)'],
  [5, 'Building', 'rgba(74,144,226,0.22)'],
  [7, 'Serious', 'rgba(52,199,123,0.22)'],
  [9, 'Locked in', 'rgba(250,176,5,0.24)'],
  [99, 'Beast mode', 'rgba(225,6,0,0.32)'],
];
const tierOf = (h: number) => TIERS.find(([max]) => h <= max)!;

const MIN_H = 1;
const MAX_H = 14;
const SPACING = 44; // px per hour on the ruler

/**
 * A ruler you drag: the needle stays put and the scale slides under it,
 * snapping to whole hours with a tick you can feel.
 */
const Ruler: React.FC<{ value: number; onChange: (h: number) => void }> = ({ value, onChange }) => {
  const [drag, setDrag] = useState<number | null>(null);
  const start = useRef<{ x: number; v: number } | null>(null);
  const shown = drag ?? value;
  const offset = -(shown - MIN_H) * SPACING;

  const onDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { x: e.clientX, v: value };
    setDrag(value);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const raw = start.current.v - (e.clientX - start.current.x) / SPACING;
    const clamped = Math.min(MAX_H, Math.max(MIN_H, raw));
    setDrag(clamped);
    const snapped = Math.round(clamped);
    if (snapped !== value) { onChange(snapped); haptic.tick(); sfx.select(); }
  };
  const onUp = () => { start.current = null; setDrag(null); };

  return (
    <div
      className="ob-ruler"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      role="slider"
      tabIndex={0}
      aria-label="Hours a day"
      aria-valuemin={MIN_H}
      aria-valuemax={MAX_H}
      aria-valuenow={value}
      onKeyDown={e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); onChange(Math.min(MAX_H, value + 1)); haptic.tick(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); onChange(Math.max(MIN_H, value - 1)); haptic.tick(); }
      }}
    >
      <div className="ob-ruler-track" style={{ transform: `translate3d(${offset}px, 0, 0)`, transition: drag === null ? 'transform 420ms cubic-bezier(0.32,0.72,0,1)' : 'none' }}>
        {Array.from({ length: (MAX_H - MIN_H) * 4 + 1 }, (_, i) => {
          const h = MIN_H + i / 4;
          const major = i % 4 === 0;
          return (
            <React.Fragment key={i}>
              <span className={`ob-ruler-tick ${major ? 'major' : ''}`} style={{ left: (h - MIN_H) * SPACING, height: major ? 26 : 12 }} />
              {major && <span className="ob-ruler-label" style={{ left: (h - MIN_H) * SPACING }}>{h}</span>}
            </React.Fragment>
          );
        })}
      </div>
      <span className="ob-ruler-needle" />
    </div>
  );
};

export const QHours: React.FC<Q & { plannable: boolean }> = ({ a, set, next, plannable }) => {
  const [, label, bg] = tierOf(a.hours);
  const days = daysLeft(a.exam);
  const free = freeMinutes(a);
  const over = plannable && a.hours * 60 > free;
  return (
    <div className="ob-col">
      <Head n={4} label="Your target" title="How many hours *a day?*" />
      <div className="ob-hours">
        <div className="ob-hours-num" aria-live="polite">
          <span key={a.hours} className="ob-fade" style={{ animationDuration: '260ms' }}>{a.hours}</span>
          <small>h</small>
        </div>
        <span className="ob-hours-tier" style={{ background: bg }}>{label}</span>
        <Ruler value={a.hours} onChange={h => set({ hours: h })} />
        <p className="ob-total">
          {a.hours}h a day is <b>{(a.hours * days).toLocaleString('en-IN')} hours</b><br />before {examLabel(a.exam)}.
        </p>
        {over && <p className="ob-warn">More than your free time ({formatHours(free)}). We&apos;ll plan what fits.</p>}
      </div>
      <div className="ob-actions">
        <button className="ob-primary" onClick={() => { sfx.select(); haptic.select(); next(); }}>Set {a.hours} hours</button>
      </div>
    </div>
  );
};

/* ── 5 · Style ── */

export const QStyle: React.FC<Q & { pomodoro: PomodoroSettings }> = ({ a, set, next, pomodoro }) => {
  const advance = useAutoAdvance(next);
  const pick = (style: TimerMode) => { choose(); set({ style }); advance(); };
  return (
    <div className="ob-col">
      <Head n={5} label="Your style" title="How do you *focus* best?" />
      <div className="ob-choices">
        <Tile selected={a.style === 'stopwatch'} onClick={() => pick('stopwatch')} title="Long stretches" sub="Start the clock. Stop when you're done." delay={260} />
        <Tile selected={a.style === 'pomodoro'} onClick={() => pick('pomodoro')} title="Sprints" sub={`${pomodoro.workMinutes} minutes on, ${pomodoro.shortBreakMinutes} off. Repeat.`} delay={340} />
      </div>
    </div>
  );
};
