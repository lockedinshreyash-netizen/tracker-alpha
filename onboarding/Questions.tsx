/* ── The questions ──
   Five screens, each asking one thing and showing what the answer does:
   stream, exams, class, year, hours. Single choices advance themselves a beat
   after the tap (the tile has to be seen to light up first); the exams (a set)
   and the hours (a number) have a button. */

import React, { useEffect, useRef, useState } from 'react';
import * as sfx from '../audio';
import { SUBJECT_COLORS } from '../schedule/colors';
import type { ExamPreference } from '../types';
import { Eyebrow, haptic, Rise, Tile } from './kit';
import { type Answers, daysLeft, examLabel } from './answers';
import { MAX_ALSO, STREAM_LABEL, defaultExam, defaultYear, examById, examsIn, prefOf, seasonYear, streamOf, yearChoices, type ExamId, type Stream } from '../content/exams';

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

/* ── 1 · Stream ── */

export const QExam: React.FC<Q> = ({ a, set, next }) => {
  const advance = useAutoAdvance(next);
  const pick = (stream: Stream) => {
    choose();
    // A new stream starts its exams again from its national exam; the same one keeps them.
    set(streamOf(a.exam) === stream ? { exam: prefOf(stream) } : { exam: prefOf(stream), exams: [defaultExam(stream)] });
    advance();
  };
  const dot = (s: keyof typeof SUBJECT_COLORS) => SUBJECT_COLORS[s].dot;
  const on = streamOf(a.exam);
  return (
    <div className="ob-col">
      <Head n={1} label="Your goal" title="What are you *aiming for?*" />
      <div className="ob-choices">
        <Tile selected={on === 'PCM'} onClick={() => pick('PCM')} title={STREAM_LABEL.PCM.title} sub="JEE, BITSAT, state CETs · Physics, Chemistry, Maths" dots={[dot('Physics'), dot('Chemistry'), dot('Maths')]} delay={160} />
        <Tile selected={on === 'PCB'} onClick={() => pick('PCB')} title={STREAM_LABEL.PCB.title} sub="NEET and state CETs · Physics, Chemistry, Biology" dots={[dot('Physics'), dot('Chemistry'), dot('Biology')]} delay={220} />
      </div>
    </div>
  );
};

/* ── 2 · Exams ──
   A set, main exam first: the first you tap is the main one (the countdown
   follows it). JEE Advanced brings JEE Main along. */

export const QExams: React.FC<Q> = ({ a, set, next }) => {
  const list = examsIn(streamOf(a.exam));
  const toggle = (id: ExamId) => {
    choose();
    const cur = a.exams;
    if (cur.includes(id)) {
      if (cur.length === 1 || cur.some(x => x !== id && examById(x).requires === id)) return;
      set({ exams: cur.filter(x => x !== id) });
      return;
    }
    if (cur.length >= MAX_ALSO + 1) return;
    const need = examById(id).requires;
    set({ exams: need && !cur.includes(need) ? [...cur, need, id] : [...cur, id] });
  };
  const n = a.exams.length;
  return (
    <div className="ob-col">
      <Head n={2} label="Your exams" title="Which exams are *you writing?*" lead="Pick every one. The first is your main exam." />
      <div className="ob-choices ob-exams">
        {list.map((e, i) => (
          <Tile
            key={e.id}
            selected={a.exams.includes(e.id)}
            onClick={() => toggle(e.id)}
            title={e.name}
            sub={a.exams[0] === e.id ? 'Main exam' : e.requires ? `Needs ${examById(e.requires).name}` : e.body}
            delay={140 + i * 40}
          />
        ))}
      </div>
      <div className="ob-actions">
        <button className="ob-primary" onClick={() => { sfx.select(); haptic.select(); next(); }}>
          {n === 1 ? `Continue with ${examById(a.exams[0]).name}` : `Continue with ${n} exams`}
        </button>
      </div>
    </div>
  );
};

/* ── 3 · Class ── */

export const QClass: React.FC<Q> = ({ a, set, next }) => {
  const advance = useAutoAdvance(next);
  // The year is its own question: the class never changes it.
  const pick = (cls: 11 | 12) => { choose(); set({ cls }); advance(); };
  return (
    <div className="ob-col">
      <Head n={3} label="Your class" title="Which class are you in?" />
      <div className="ob-choices">
        <Tile selected={a.cls === 11} onClick={() => pick(11)} title="Class 11" sub="The Class 11 syllabus comes first." delay={160} />
        <Tile selected={a.cls === 12} onClick={() => pick(12)} title="Class 12" sub="Taking a drop year? Pick this one." delay={220} />
      </div>
    </div>
  );
};

/* ── 4 · Year ── */

export const QYear: React.FC<Q> = ({ a, set, next }) => {
  const advance = useAutoAdvance(next);
  const pick = (year: number) => { choose(); set({ year, yearPicked: true }); advance(); };
  const usual = defaultYear(a.cls);
  const season = seasonYear();
  const sub = (y: number) =>
    y === season ? 'Most students pick this' : y === usual ? `Usual for Class ${a.cls}` : undefined;
  return (
    <div className="ob-col">
      <Head n={4} label="Your year" title="When do you *write it?*" />
      <div className="ob-choices">
        {yearChoices().map((y, i) => (
          <Tile key={y} selected={a.year === y} onClick={() => pick(y)} title={String(y)} sub={sub(y)} delay={160 + i * 50} />
        ))}
      </div>
      <div className="ob-actions">
        <button className="ob-primary" onClick={() => { sfx.select(); haptic.select(); set({ yearPicked: true }); next(); }}>
          Continue with {a.year}
        </button>
      </div>
    </div>
  );
};

/* ── 3 · Hours ── */

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

export const QHours: React.FC<Q> = ({ a, set, next }) => {
  const [, label, bg] = tierOf(a.hours);
  const days = daysLeft(a.exams[0], a.year);
  return (
    <div className="ob-col">
      <Head n={5} label="Your target" title="How many hours *a day?*" />
      <div className="ob-hours">
        <div className="ob-hours-num" aria-live="polite">
          <span key={a.hours} className="ob-fade" style={{ animationDuration: '260ms' }}>{a.hours}</span>
          <small>h</small>
        </div>
        <span className="ob-hours-tier" style={{ background: bg }}>{label}</span>
        <Ruler value={a.hours} onChange={h => set({ hours: h })} />
        <p className="ob-total">
          {a.hours}h a day is <b>{(a.hours * days).toLocaleString('en-IN')} hours</b><br />before {examLabel(a.exams[0])}.
        </p>
      </div>
      <div className="ob-actions">
        <button className="ob-primary" onClick={() => { sfx.select(); haptic.select(); next(); }}>Set {a.hours} hours</button>
      </div>
    </div>
  );
};
