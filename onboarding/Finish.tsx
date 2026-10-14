/* ── The last screen ──
   First session gets them studying before onboarding is over: the best
   orientation to a study tracker is a running clock. */

import React, { useState } from 'react';
import * as sfx from '../audio';
import { getCoreSubjects } from '../constants';
import { SUBJECT_COLORS } from '../schedule/colors';
import type { Subject } from '../types';
import LiquidGlass from '../ui/LiquidGlass';
import { Eyebrow, haptic, Rise } from './kit';
import type { Answers, StartHere } from './answers';

export const FirstSession: React.FC<{ a: Answers; first: StartHere | null; onStart: (s: Subject) => void; onLater: () => void }> = ({ a, first, onStart, onLater }) => {
  const subjects = getCoreSubjects(a.exam);
  const [pick, setPick] = useState<Subject>(first?.subject ?? subjects[0]);
  return (
    <div className="ob-col">
      <Eyebrow>Day one</Eyebrow>
      <h1 className="ob-h1"><Rise text="First session. *Right now.*" delay={80} /></h1>
      <p className="ob-lead ob-fade" style={{ animationDelay: '280ms' }}>
        Pick a subject. The clock starts when you tap.
      </p>
      <div className="ob-subjects">
        {subjects.map((s, i) => {
          const c = SUBJECT_COLORS[s];
          const on = pick === s;
          return (
            <div key={s} className="ob-fade" style={{ animationDelay: `${360 + i * 70}ms`, gridColumn: subjects.length === 3 && i === 2 ? 'span 2' : undefined }}>
              <LiquidGlass
                as="button"
                dark
                radius={20}
                variant="panel"
                bezel={14}
                strength={14}
                className="ob-subject ob-tile"
                aria-pressed={on}
                onClick={() => { setPick(s); sfx.select(); haptic.select(); }}
                style={{ minHeight: 84 }}
              >
                <span className="ob-tile-ring" style={on ? { boxShadow: `inset 0 0 0 1.5px ${c.dot}, 0 0 24px -6px ${c.dot}` } : undefined} />
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i style={{ width: 9, height: 9, borderRadius: 99, background: c.dot, boxShadow: `0 0 10px ${c.dot}`, display: 'block' }} />
                  <b>{s}</b>
                </span>
                {first?.subject === s
                  ? <span style={{ color: '#ff6a5f' }}>Start here · {first.chapter}</span>
                  : <span style={{ color: 'var(--ob-faint)' }}>Class {a.cls}</span>}
              </LiquidGlass>
            </div>
          );
        })}
      </div>
      <div className="ob-actions">
        <button className="ob-primary" onClick={() => { haptic.heavy(); onStart(pick); }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5L7 4.5z" /></svg>
          Start {pick}
        </button>
        <button className="ob-ghost" onClick={() => { sfx.select(); onLater(); }}>I&apos;ll start later</button>
      </div>
    </div>
  );
};
