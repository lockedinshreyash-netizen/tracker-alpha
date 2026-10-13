/* ── The last two screens ──
   Save asks for an account only now, after the student has seen what an
   account would protect. First session gets them studying before onboarding
   is over: the best orientation to a study tracker is a running clock. */

import React, { useState } from 'react';
import * as sfx from '../audio';
import { getCoreSubjects } from '../constants';
import { SUBJECT_COLORS } from '../schedule/colors';
import type { Subject } from '../types';
import LiquidGlass from '../ui/LiquidGlass';
import { Eyebrow, Glass, haptic, Rise } from './kit';
import type { Answers, StartHere } from './plan';

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const PERKS: Array<[string, string]> = [
  ['M4 12a8 8 0 0114-5.3M20 12a8 8 0 01-14 5.3M18 3v4h-4M6 21v-4h4', 'Your phone and laptop stay in sync'],
  ['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75', 'Study groups with your friends'],
  ['M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3', 'Race other students on Ranks'],
];

export const Save: React.FC<{ onGoogle: () => void; onEmail: () => void; onLater: () => void }> = ({ onGoogle, onEmail, onLater }) => (
  <div className="ob-col">
    <Eyebrow>Back it up</Eyebrow>
    <h1 className="ob-h1"><Rise text="Don't *lose* it." delay={80} /></h1>
    <p className="ob-lead ob-fade" style={{ animationDelay: '280ms' }}>
      Your plan lives on this phone only. A free account keeps it safe.
    </p>
    <div className="ob-fade" style={{ animationDelay: '380ms', marginTop: 26 }}>
      <Glass radius={22} style={{ padding: '6px 18px' }}>
        {PERKS.map(([d, text], i) => (
          <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderTop: i ? '1px solid var(--ob-line)' : 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--ob-muted)' }}><path d={d} /></svg>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{text}</span>
          </div>
        ))}
      </Glass>
    </div>
    <div className="ob-actions">
      <button className="ob-light" onClick={() => { haptic.select(); sfx.select(); onGoogle(); }}>
        <GoogleMark /> Continue with Google
      </button>
      <button className="ob-ghost" style={{ color: 'var(--ob-ink)' }} onClick={() => { haptic.select(); onEmail(); }}>Use email instead</button>
      <button className="ob-ghost" onClick={() => { sfx.select(); onLater(); }}>Not now</button>
    </div>
  </div>
);

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
