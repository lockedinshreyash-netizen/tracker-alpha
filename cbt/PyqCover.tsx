/* ── The cover for NTA papers ──
   What a student sees in the Question bank before their first real paper:
   what this is, one button that starts the next real shift straight away,
   a CBT screen built by hand, and three reasons. Every number comes from the
   bank itself and every line must stay true of the app (the teen-copy rule:
   short, plain, blunt). Seen once: starting a paper, or "Look around first",
   puts the home in its place for good. */

import React from 'react';
import { subjectDot } from '../mocks/ui';
import { NTA_CREDIT } from './generate';
import './pyq.css';

interface Props {
  dark: boolean;
  questions: number;
  shifts: number;
  /** Share of questions filed under a chapter, 0–100. */
  tagged: number;
  /** "4 Apr 2026 · Shift 2": the paper the button starts. */
  nextLabel: string | null;
  busy: boolean;
  onStart: () => void;
  onBrowse: () => void;
}

/** A subject's dot as a soft glow, for the light behind the pictures. */
export const glowVars = (dark: boolean): React.CSSProperties => {
  const a = dark ? '55' : '40';
  return {
    ['--g1' as string]: `${subjectDot('Physics')}${a}`,
    ['--g2' as string]: `${subjectDot('Chemistry')}${a}`,
    ['--g3' as string]: `${subjectDot('Maths')}${a}`,
  };
};

// The palette in the picture: answered, not answered, marked, the current one (Q7), not visited.
const PALETTE = 'aaanaacmaana........';

export default function PyqCover({ dark, questions, shifts, tagged, nextLabel, busy, onStart, onBrowse }: Props) {
  return (
    <div className="pq pq-cover" data-dark={dark || undefined} style={glowVars(dark)}>
      <section className="pq-hero">
        <span className="pq-new"><i />New in Alpha</span>
        <h1 className="pq-title">Real papers<span className="pq-stop">.</span></h1>
        <p className="pq-lede">JEE Main, exactly as NTA set it.</p>
        <p className="pq-line">
          {shifts} real shifts. {questions.toLocaleString('en-IN')} questions. NTA’s own question papers and answer keys. Sit one tonight.
        </p>
        <div className="pq-cta">
          <button type="button" className="pq-btn pq-btn-lg" onClick={onStart} disabled={busy || !nextLabel}>
            {busy ? 'Getting it ready…' : 'Sit your first paper'}
          </button>
          {nextLabel && <span className="pq-fine">{nextLabel} · 75 questions · 3 hours</span>}
          <button type="button" className="pq-link" onClick={onBrowse}>Look around first</button>
        </div>
      </section>

      <section className="pq-stage" aria-hidden="true">
        <div className="pq-glow" />
        <div className="pq-screen">
          <div className="pq-bar">
            <b>JEE Main</b><span>2 Apr 2026 · Shift 1</span>
            <span className="pq-clock">2:41:07</span>
          </div>
          <div className="pq-tabs"><span>Maths</span><span className="on">Physics</span><span>Chemistry</span></div>
          <div className="pq-body">
            <div className="pq-q">
              <p className="pq-qno">Question 7 · Section A</p>
              <div className="pq-plate">
                A block of mass 2 kg slides down a smooth incline of angle 30°. The acceleration of the block is (take <i>g</i> = 9.8 m s<sup>−2</sup>)
              </div>
              <div className="pq-opts">
                {['4.9 m s⁻²', '9.8 m s⁻²', '2.45 m s⁻²', '19.6 m s⁻²'].map((o, i) => (
                  <div key={o} className={`pq-opt${i === 0 ? ' on' : ''}`}>
                    <em /><div className="pq-plate">({i + 1}) {o}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="pq-pal">
              <p>Physics · Section A</p>
              <div className="pq-grid">
                {Array.from({ length: 20 }, (_, i) => {
                  const s = PALETTE[i];
                  return <b key={i} className={s === '.' ? '' : s}>{i + 1}</b>;
                })}
              </div>
            </div>
          </div>
          <div className="pq-foot">
            <span style={{ background: '#22a565' }}>SAVE &amp; NEXT</span>
            <span style={{ background: '#7c4ddb' }}>MARK FOR REVIEW</span>
          </div>
        </div>
        <div className="pq-float one"><i style={{ background: '#22a565' }}>+4</i><div>Right<small>Laws of Motion</small></div></div>
        <div className="pq-float two"><i style={{ background: subjectDot('Physics') }}>✎</i><div>Into your notebook<small>Every wrong answer, by chapter</small></div></div>
      </section>

      <section className="pq-reasons" aria-label="Why sit them here">
        <div className="pq-reason">
          <span className="pq-num">{shifts}</span>
          <h2>NTA’s own papers.</h2>
          <p>Every question and every answer key comes straight from NTA. Nothing retyped. Nothing guessed.</p>
        </div>
        <div className="pq-reason">
          <span className="pq-num">+4 −1</span>
          <h2>NTA’s rules.</h2>
          <p>An answer counts only when you save it. The clock never stops. Answers show the moment you submit.</p>
        </div>
        <div className="pq-reason">
          <span className="pq-num">{Math.floor(tagged)}%</span>
          <h2>Mistakes go somewhere.</h2>
          <p>Nearly every question is filed under its chapter, so a wrong answer goes straight into your error notebook.</p>
        </div>
      </section>

      <p className="pq-credit">{NTA_CREDIT}</p>
    </div>
  );
}
