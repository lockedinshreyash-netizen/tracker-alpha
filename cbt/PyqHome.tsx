/* ── NTA papers: the home ──
   What the Question bank is once the cover has been seen. One thing first:
   the paper to sit next (or the one to finish). Then three ways to build
   your own, every real shift with your score on the ones you've sat, and
   your recent papers. Zero logic beyond formatting: BankView decides what
   is next and what each tap does, like the other zero-logic containers. */

import React from 'react';
import { subjectDot } from '../mocks/ui';
import { BankQuestion, CbtPaper, CbtSubject, PaperMode, modeOf } from './types';
import { NTA_CREDIT, RealShift, realShifts, shiftLabel } from './generate';
import { glowVars } from './PyqCover';
import './pyq.css';

export interface ShiftCard extends RealShift {
  /** "2 Apr" */
  day: string;
  shift: number;
  /** Your sitting of this shift, if you have one (the latest). */
  sat: CbtPaper | null;
}

/** The paper id a sitting was built from, when it is a real shift. */
export const shiftOf = (p: CbtPaper): string | null => (p.blueprint.spec.kind === 'shift' ? p.blueprint.spec.paper : null);

/** Every real shift, newest first, each with your latest sitting of it. */
export const shiftCards = (index: BankQuestion[], papers: CbtPaper[]): ShiftCard[] =>
  realShifts(index).map(s => {
    const label = shiftLabel(s.paper);
    // Only a mock sitting counts as having sat the paper; practice is practice.
    const sat = papers.filter(p => shiftOf(p) === s.paper && modeOf(p) === 'mock').sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0] ?? null;
    return { ...s, label, day: label.split(' · ')[0].replace(/ \d{4}$/, ''), shift: Number(s.paper.slice(-1)), sat };
  });

type BuildKind = 'full' | 'subject' | 'chapters';

interface Props {
  dark: boolean;
  loading?: boolean;
  questions: number;
  shifts: ShiftCard[];
  /** The newest shift not yet sat. */
  next: ShiftCard | null;
  /** An unfinished sitting, which outranks everything. */
  resume: CbtPaper | null;
  history: CbtPaper[];
  /** Submitted papers whose review was never saved to Mocks. */
  reviewDue: Set<string>;
  /** The paper or shift being opened or built, so its button can say so. */
  busy: string | null;
  now: number;
  onShift: (card: ShiftCard, mode?: PaperMode) => void;
  onOpen: (paper: CbtPaper) => void;
  onBuild: (kind: BuildKind) => void;
}

const SUBJECTS: CbtSubject[] = ['Maths', 'Physics', 'Chemistry'];

const left = (p: CbtPaper, now: number): string => {
  if (!p.startedAt) return 'Built and waiting. The clock starts when you do.';
  if (modeOf(p) === 'practice') return 'Practice. Pick up where you stopped.';
  // The clock counts time on screen (usedMs); older papers counted wall time.
  const used = p.usedMs ?? Math.max(0, now - Date.parse(p.startedAt));
  const ms = p.blueprint.durationMins * 60_000 - used;
  if (ms <= 0) return 'Time’s up. Open it to see your score.';
  const m = Math.ceil(ms / 60_000);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} left. The clock waited while you were away.`;
};

const when = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const Icon = ({ kind }: { kind: BuildKind }) => (
  <svg width="26" height="26" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'full' && <><rect x="5" y="4" width="16" height="18" rx="3" /><path d="M9 9.5h8M9 13h8M9 16.5h5" /></>}
    {kind === 'subject' && <><circle cx="13" cy="13" r="8.5" /><path d="M13 4.5v17M4.5 13h17" opacity=".5" /></>}
    {kind === 'chapters' && <path d="M8 4h10a1 1 0 0 1 1 1v17l-6-4-6 4V5a1 1 0 0 1 1-1Z" />}
  </svg>
);

const Chevron = () => (
  <svg className="pq-chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
);

export default function PyqHome({ dark, loading, questions, shifts, next, resume, history, reviewDue, busy, now, onShift, onOpen, onBuild }: Props) {
  if (loading) {
    return (
      <div className="pq pq-home" data-dark={dark || undefined} aria-busy="true">
        <div className="pq-skel" />
        <div className="pq-tiles">{[0, 1, 2].map(i => <div key={i} className="pq-skel" style={{ height: 120, borderRadius: 18 }} />)}</div>
      </div>
    );
  }

  const years = Array.from(new Set(shifts.map(s => s.year)));
  const hero = resume ? (
    <section className="pq-next pq-rise">
      <div>
        <p className="pq-kicker"><i />Unfinished</p>
        <h2>{resume.name.replace(/^JEE Main /, '').split(' · ')[0]}</h2>
        <p>{resume.name.includes(' · ') ? `${resume.name.split(' · ').slice(1).join(' · ')}. ` : ''}{left(resume, now)}</p>
      </div>
      <button type="button" className="pq-btn pq-btn-lg" disabled={!!busy} onClick={() => onOpen(resume)}>
        {busy === resume.id ? 'Opening…' : resume.startedAt ? 'Resume' : 'Start'}
      </button>
    </section>
  ) : next ? (
    <section className="pq-next pq-rise">
      <div>
        <p className="pq-kicker"><i />Up next · Real paper</p>
        <h2>{next.label.split(' · ')[0]}</h2>
        <p>Shift {next.shift} · {next.count} questions · 3 hours. Exactly as NTA set it.</p>
        <div className="pq-dots">{SUBJECTS.map(s => <span key={s}><i style={{ background: subjectDot(s) }} />{s}</span>)}</div>
      </div>
      <div className="pq-actions">
        <button type="button" className="pq-btn pq-btn-lg" disabled={!!busy} onClick={() => onShift(next)}>
          {busy === next.paper ? 'Getting it ready…' : 'Start paper'}
        </button>
        <button type="button" className="pq-link" disabled={!!busy} onClick={() => onShift(next, 'practice')}>
          {busy === `${next.paper}:practice` ? 'Getting it ready…' : 'Practise it instead'}
        </button>
      </div>
    </section>
  ) : (
    <section className="pq-next pq-rise">
      <div>
        <p className="pq-kicker"><i />All done</p>
        <h2>Every real paper, sat.</h2>
        <p>Now build mixed papers from all {questions.toLocaleString('en-IN')} questions. No two are the same.</p>
      </div>
      <button type="button" className="pq-btn pq-btn-lg" onClick={() => onBuild('full')}>Mixed paper</button>
    </section>
  );

  return (
    <div className="pq pq-home" data-dark={dark || undefined} style={glowVars(dark)}>
      {hero}

      <section className="pq-section pq-rise" style={{ animationDelay: '60ms' }}>
        <h3>Build your own</h3>
        <div className="pq-tiles">
          <button type="button" className="pq-tile" onClick={() => onBuild('full')}>
            <Icon kind="full" /><b>Mixed paper</b><span>75 questions from every shift. 3 hours.</span>
          </button>
          <button type="button" className="pq-tile" onClick={() => onBuild('subject')}>
            <Icon kind="subject" /><b>One subject</b><span>25 questions. 1 hour.</span>
          </button>
          <button type="button" className="pq-tile" onClick={() => onBuild('chapters')}>
            <Icon kind="chapters" /><b>Chapters</b><span>Only what you’re revising.</span>
          </button>
        </div>
      </section>

      {shifts.length > 0 && (
        <section className="pq-section pq-rise" style={{ animationDelay: '120ms' }}>
          <h3>Real papers <small>{shifts.filter(s => s.sat?.submittedAt).length} of {shifts.length} sat</small></h3>
          {years.map(y => (
            <div key={y} className="pq-year">
              <p>{y}</p>
              <div className="pq-shifts">
                {shifts.filter(s => s.year === y).map(s => {
                  const done = !!s.sat?.submittedAt;
                  const live = !!s.sat && !done;
                  const sc = s.sat?.score;
                  return (
                    <button
                      key={s.paper}
                      type="button"
                      disabled={!!busy}
                      onClick={() => onShift(s)}
                      className={`pq-shift${done ? ' done' : ''}${live ? ' live' : ''}${!resume && next?.paper === s.paper ? ' next' : ''}`}
                      aria-label={`${s.label}${done && sc ? `, scored ${sc.marks} of ${sc.max}` : live ? ', unfinished' : ''}`}
                    >
                      <b>{s.day}</b>
                      <span>Shift {s.shift}</span>
                      <em>{busy === s.paper || busy === s.sat?.id ? 'Opening…' : done ? (sc ? `${sc.marks} / ${sc.max}` : 'Sat') : live ? 'Unfinished' : 'Not sat'}</em>
                      {done && sc && <span className="pq-meter"><i style={{ width: `${Math.max(2, Math.min(100, (Math.max(0, sc.marks) / sc.max) * 100))}%` }} /></span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section className="pq-section pq-rise" style={{ animationDelay: '180ms' }}>
          <h3>Your papers</h3>
          <div className="pq-list">
            {history.map(p => (
              <button key={p.id} type="button" className="pq-row" disabled={!!busy} onClick={() => onOpen(p)}>
                <div>
                  <b>{p.name}</b>
                  <small>{modeOf(p) === 'practice' ? 'Practice · ' : ''}{when(p.submittedAt ?? p.createdAt)} · {p.questionIds.length} questions</small>
                </div>
                {reviewDue.has(p.id)
                  ? <span className="pq-pill">{busy === p.id ? 'Opening…' : 'Finish review'}</span>
                  : p.score && <span className="pq-score">{p.score.marks}<small> / {p.score.max}</small></span>}
                <Chevron />
              </button>
            ))}
          </div>
        </section>
      )}

      <p className="pq-credit" style={{ marginTop: 0 }}>{NTA_CREDIT}</p>
    </div>
  );
}
