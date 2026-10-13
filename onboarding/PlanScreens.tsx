/* ── Building the plan, and showing it ──
   Building is a short piece of theatre over real work: every line names a
   real number (the chapter count, the hours, the days), and the plan it
   announces is the one the reveal draws and the Plan tab will hold. */

import React, { useEffect, useState } from 'react';
import * as sfx from '../audio';
import { ACTIVITY_BASE, SUBJECT_COLORS } from '../schedule/colors';
import { formatClock, formatRange } from '../schedule/schedule';
import type { Subject } from '../types';
import { Eyebrow, Glass, haptic, Rise } from './kit';
import { type Answers, chapterCount, daysLeft, examLabel, formatHours, type Plan, type StartHere } from './plan';

/* ── Building ── */

const STEP_MS = 640;

export const Building: React.FC<{ a: Answers; plannable: boolean; first: StartHere | null; onDone: () => void }> = ({ a, plannable, first, onDone }) => {
  const lines = [
    `Loading the ${examLabel(a.exam)} syllabus · ${chapterCount(a.exam)} chapters`,
    first ? `Ranking chapters · ${first.chapter} first` : 'Ranking chapters by weightage',
    plannable ? `Fitting ${a.hours}h into your day` : `Setting your target · ${a.hours}h a day`,
    `Starting your countdown · ${daysLeft(a.exam)} days`,
  ];
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (done >= lines.length) {
      const t = window.setTimeout(onDone, 520);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      // Each line lands a step higher: progress you can hear.
      sfx.play('tap', { semitones: [0, 2, 4, 7][done] ?? 7 });
      haptic.tick();
      setDone(d => d + 1);
    }, done === 0 ? 700 : STEP_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const C = 2 * Math.PI * 54;
  return (
    <div className="ob-col" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div className="ob-orb ob-fade">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
          <circle cx="60" cy="60" r="54" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - done / lines.length)}
            style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.32,0.72,0,1)' }} />
        </svg>
        <span className="ob-orb-core" />
      </div>
      <h1 className="ob-h1" style={{ marginTop: 30, fontSize: 'clamp(28px, 7.4vw, 40px)' }}><Rise text="Building your *plan.*" /></h1>
      <div className="ob-build" aria-live="polite">
        {lines.map((l, i) => (
          <div key={i} className="ob-build-row" data-state={i < done ? 'done' : i === done ? 'now' : 'todo'}>
            <span className="ob-build-mark">
              {i < done && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
            </span>
            <span>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Reveal ── */

const PX_PER_MIN = 0.4;

const blockColors = (kind: string, subject?: Subject) => {
  if (subject) {
    const s = SUBJECT_COLORS[subject];
    return { bg: `${s.dot}2e`, border: `${s.dot}80`, text: s.text, dot: s.dot };
  }
  const c = ACTIVITY_BASE[kind as keyof typeof ACTIVITY_BASE] ?? '#868E96';
  return { bg: `${c}24`, border: `${c}66`, text: '#d6dcff', dot: c };
};

/** A school day, top to bottom: when you wake, every block, when you sleep. */
const DayTimeline: React.FC<{ a: Answers; plan: Plan }> = ({ a, plan }) => {
  const end = a.sleep > a.wake ? a.sleep : 1440;
  const blocks = plan.rules
    .filter(r => r.kind !== 'sleep')
    .filter(r => r.days.includes(1))
    .sort((x, y) => x.start - y.start);
  const height = Math.max(240, (end - a.wake) * PX_PER_MIN);
  const top = (m: number) => (m - a.wake) * PX_PER_MIN;
  return (
    <Glass className="ob-timeline" radius={22}>
      <div style={{ position: 'relative', height }}>
        <span className="ob-tl-time" style={{ top: -6 }}>{formatClock(a.wake)}</span>
        <span style={{ position: 'absolute', top: -4, left: 0, right: 0, height: 1, background: 'rgba(250,176,5,0.5)' }} />
        <span style={{ position: 'absolute', top: -14, right: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#FAB005' }}>WAKE</span>
        {blocks.map((b, i) => {
          const c = blockColors(b.kind, b.subject);
          const h = Math.max(26, b.durationMins * PX_PER_MIN - 3);
          return (
            <div
              key={i}
              className="ob-tl-row"
              style={{ position: 'absolute', left: 0, right: 0, top: top(b.start), height: h, animationDelay: `${180 + i * 90}ms` }}
            >
              <span className="ob-tl-time">{formatClock(b.start)}</span>
              <div className="ob-tl-block" style={{ background: c.bg, boxShadow: `inset 0 0 0 1px ${c.border}`, color: c.text }}>
                <b>{b.subject ?? b.label ?? 'Block'}{b.chapter ? <span style={{ fontWeight: 600, opacity: 0.8 }}> · {b.chapter}</span> : null}</b>
                {h > 40 && <span>{formatRange(b.start, b.durationMins)}</span>}
              </div>
            </div>
          );
        })}
        <span className="ob-tl-time" style={{ top: height - 6 }}>{formatClock(end % 1440)}</span>
        <span style={{ position: 'absolute', top: height + 2, left: 0, right: 0, height: 1, background: `${ACTIVITY_BASE.sleep}99` }} />
        <span style={{ position: 'absolute', top: height + 6, right: 0, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: '#a78bfa' }}>SLEEP</span>
      </div>
    </Glass>
  );
};

export const Reveal: React.FC<{ a: Answers; plan: Plan | null; first: StartHere | null; onNext: () => void }> = ({ a, plan, first, onNext }) => {
  useEffect(() => {
    sfx.play('plan-reveal', { late: 800 });
    haptic.select();
  }, []);
  const days = daysLeft(a.exam);
  const short = plan && plan.studyMins < plan.goalMins;
  return (
    <div className="ob-col">
      <Eyebrow>Your plan</Eyebrow>
      <h1 className="ob-h1"><Rise text={plan ? "Here's your *day.*" : "You're *set.*"} delay={80} /></h1>
      <p className="ob-lead ob-fade" style={{ animationDelay: '260ms' }}>
        {plan
          ? <>{formatHours(plan.studyMins)} of study on a school day, around everything else.{short ? ' Sundays have room for the rest.' : ''}</>
          : <>Your plan from before is safe. Here&apos;s what changes.</>}
      </p>

      {plan && <div className="ob-fade" style={{ animationDelay: '320ms' }}><DayTimeline a={a} plan={plan} /></div>}

      <div className="ob-stats">
        {[
          [`${a.hours}h`, 'a day'],
          [days.toLocaleString('en-IN'), 'days left'],
          [(a.hours * days).toLocaleString('en-IN'), 'hours'],
        ].map(([v, l], i) => (
          <div key={l} className="ob-fade" style={{ animationDelay: `${420 + i * 70}ms` }}>
            <Glass className="ob-stat" radius={18}><b>{v}</b><span>{l}</span></Glass>
          </div>
        ))}
      </div>

      {first && (
        <div className="ob-fade" style={{ animationDelay: '640ms' }}>
          <Glass className="ob-start" radius={20}>
            <span style={{ width: 10, height: 10, borderRadius: 99, background: SUBJECT_COLORS[first.subject].dot, boxShadow: `0 0 12px ${SUBJECT_COLORS[first.subject].dot}`, flexShrink: 0 }} />
            <span style={{ minWidth: 0 }}>
              <span className="ob-start-tag" style={{ display: 'block' }}>Start here · {first.label}</span>
              <span className="ob-start-ch" style={{ display: 'block' }}>{first.chapter}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--ob-faint)', marginTop: 3 }}>{first.subject}, Class {a.cls}. The chapter worth the most marks you haven&apos;t finished.</span>
            </span>
          </Glass>
        </div>
      )}

      <div className="ob-actions">
        <button className="ob-primary" onClick={() => { sfx.select(); haptic.select(); onNext(); }}>Make it official</button>
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--ob-faint)' }}>Change anything later in Plan.</p>
      </div>
    </div>
  );
};
