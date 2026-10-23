/* ── The Notes cover ──
   What a student sees on the Notes tab until they turn it on: what Notes is,
   and why it beats the notebook they already use. Built like a product page:
   a hero with one button, a product shot of a real page with the pieces only
   Alpha has floating off it, a bento of reasons, and the button again.

   Every picture is hand-built HTML and SVG in the app's own colours (the
   landing page's rule): no screenshots to go stale, nothing to download.
   Every claim is true of the app today. Nothing is said about other apps
   except what they are for; their prices and features change, and a cover
   that is wrong about a rival is a cover nobody trusts. Copy is short and
   plain (the teen-copy rule). */

import React from 'react';
import { SUBJECT_COLORS } from '../schedule/colors';
import { STATUS_HEX } from './status';
import './cover.css';

interface Props {
  signedIn: boolean;
  onEnable: () => void;
}

const PHY = SUBJECT_COLORS.Physics.dot;
const CHE = SUBJECT_COLORS.Chemistry.dot;

/* Gm₁m₂ / r², set by hand so the cover never loads KaTeX. */
const Gravity = () => (
  <span className="nc-math">
    <i>F</i>&nbsp;=&nbsp;
    <span className="nc-frac">
      <span><i>G</i>&thinsp;<i>m</i><sub>1</sub><i>m</i><sub>2</sub></span>
      <span><i>r</i><sup>2</sup></span>
    </span>
  </span>
);

export default function Cover({ signedIn, onEnable }: Props) {
  return (
    <div className="nc">
      {/* ── Hero ── */}
      <section className="nc-hero">
        <p className="nc-new"><i />New in Alpha</p>
        <h1 className="nc-title">Notes<span className="nc-stop">.</span></h1>
        <p className="nc-lede">The notebook that knows JEE.</p>
        <p className="nc-line">Chapter notes, formulas and mistakes, right next to your timer.</p>
        <button type="button" className="nc-cta" onClick={onEnable}>Turn on Notes</button>
        <p className="nc-fine">
          Free <span>·</span> Works offline <span>·</span> {signedIn ? 'Syncs across your devices' : 'Sign in to sync across devices'}
        </p>
      </section>

      {/* ── Product shot ── */}
      <section className="nc-stage" aria-hidden="true">
        <div className="nc-glow" />
        <div className="nc-sheet">
          <div className="nc-sheet-bar">
            <span className="nc-sheet-back">‹ Physics</span>
            <span className="nc-sheet-dots"><b /><b /><b /></span>
          </div>
          <div className="nc-sheet-page">
            <span className="nc-tag"><i style={{ background: PHY }} />Physics · Gravitation</span>
            <h3 className="nc-sheet-title">Gravitation</h3>
            <p className="nc-sheet-dek">Every mass pulls on every other mass.</p>
            <h4 className="nc-sheet-h">Key formula</h4>
            <div className="nc-sheet-eq"><Gravity /></div>
            <div className="nc-sheet-box"><b>Note</b>Weightlessness in orbit is free fall, not zero gravity.</div>
            <div className="nc-sheet-todo"><i />15 PYQs on orbital speed<span>On Today</span></div>
          </div>
        </div>

        <div className="nc-float nc-float-a">
          <p className="nc-float-q">@grav</p>
          <div className="nc-float-row on"><i style={{ background: STATUS_HEX.in_progress }} />Gravitation<small>In progress</small></div>
          <div className="nc-float-row"><i style={{ background: STATUS_HEX.completed }} />Gravitation PYQs<small>Page</small></div>
        </div>

        <div className="nc-float nc-float-b">
          <p className="nc-float-label">Today</p>
          <div className="nc-float-card" style={{ ['--c' as string]: PHY }}>15 PYQs on orbital speed</div>
          <div className="nc-float-card dim" style={{ ['--c' as string]: CHE }}>Revise mole concept</div>
        </div>
      </section>

      {/* ── Why ── */}
      <section className="nc-why">
        <h2 className="nc-h2">Why not Notion or Obsidian?</h2>
        <p className="nc-h2-sub">They’re built for everything. This one is built for your exam.</p>

        <div className="nc-bento">
          <article className="nc-tile wide">
            <h3>It already knows your syllabus.</h3>
            <p>Type @ and any chapter. See if it’s done, in progress or not started yet.</p>
            <div className="nc-vig nc-vig-mention">
              <div className="nc-mention">
                <p className="nc-mention-q"><span>@</span>therm<b className="nc-caret" /></p>
                {[
                  { c: PHY, name: 'Thermodynamics', sub: 'Physics · 11', s: 'in_progress' as const, label: 'In progress' },
                  { c: PHY, name: 'Thermal Properties of Matter', sub: 'Physics · 11', s: 'completed' as const, label: 'Completed' },
                  { c: CHE, name: 'Thermodynamics', sub: 'Chemistry · 11', s: 'not_started' as const, label: 'Not started' },
                ].map((r, i) => (
                  <div key={r.name + r.sub} className={`nc-mention-row${i === 0 ? ' on' : ''}`}>
                    <i style={{ background: r.c }} />
                    <span>{r.name}<em>{r.sub}</em></span>
                    <small><b style={{ background: STATUS_HEX[r.s] }} />{r.label}</small>
                  </div>
                ))}
              </div>
            </div>
          </article>

          <article className="nc-tile">
            <h3>To-dos go straight to Today.</h3>
            <p>Tick one into your plan. It lands on your board.</p>
            <div className="nc-vig nc-vig-today">
              <div className="nc-todo-line"><i /><em>10 rotation PYQs</em><span>Add to Today</span></div>
              <svg className="nc-arrow" viewBox="0 0 24 40" aria-hidden="true"><path d="M12 2v32M5 27l7 8 7-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <div className="nc-board">
                <p>Todo</p>
                <div className="nc-board-card" style={{ ['--c' as string]: PHY }}>10 rotation PYQs</div>
              </div>
            </div>
          </article>

          <article className="nc-tile">
            <h3>Maths, the way you write it.</h3>
            <p>Type $ around a formula. Chemistry works too.</p>
            <div className="nc-vig nc-vig-math">
              <div className="nc-math-pair">
                <div className="nc-src">$v = \sqrt{'{2gh}'}$</div>
                <div className="nc-out"><i>v</i>&nbsp;=&nbsp;<span className="nc-sqrt"><span>2<i>gh</i></span></span></div>
              </div>
              <div className="nc-math-pair">
                <div className="nc-src">\ce{'{H2 + O2 -> H2O}'}</div>
                <div className="nc-out nc-chem">H<sub>2</sub> + O<sub>2</sub> → H<sub>2</sub>O</div>
              </div>
            </div>
          </article>

          <article className="nc-tile">
            <h3>One app. No switching.</h3>
            <p>Your notes sit next to your timer, plan, mocks and decks.</p>
            <div className="nc-vig nc-vig-rail">
              <div className="nc-rail">
                {[
                  <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
                  <><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
                  <><path d="M5 20V10M12 20V4M19 20v-7" /></>,
                  <><rect x="7" y="3" width="13" height="16" rx="2" /><path d="M4.5 7.5v10.8A2.7 2.7 0 0 0 7.2 21h9.3" /></>,
                ].map((d, i) => (
                  <span key={i} className="nc-rail-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{d}</svg></span>
                ))}
                <span className="nc-rail-icon on">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4" /><path d="M9 12h7M9 16h4.5" /></svg>
                </span>
              </div>
            </div>
          </article>

          <article className="nc-tile">
            <h3>Works offline.</h3>
            <p>Saved on your device first. Synced to your other devices when you sign in.</p>
            <div className="nc-vig nc-vig-devices">
              <svg viewBox="0 0 220 96" aria-hidden="true">
                <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
                  <rect x="10" y="18" width="104" height="64" rx="6" />
                  <path d="M2 86h120" strokeLinecap="round" />
                  <rect x="168" y="14" width="42" height="74" rx="9" />
                </g>
                <g className="nc-lines" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                  <path d="M24 34h44" /><path d="M24 44h70" opacity="0.5" /><path d="M24 52h60" opacity="0.5" /><path d="M24 60h66" opacity="0.5" />
                  <path d="M176 30h20" /><path d="M176 39h26" opacity="0.5" /><path d="M176 47h22" opacity="0.5" />
                </g>
                <path className="nc-arc" d="M118 40 C 136 18, 150 18, 164 34" fill="none" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 4" strokeLinecap="round" />
              </svg>
            </div>
          </article>

          <article className="nc-tile full">
            <div className="nc-tile-text">
              <h3>Bring your notes with you.</h3>
              <p>Import Markdown from Obsidian or a Notion export. Headings, lists, to-dos and maths come along.</p>
            </div>
            <div className="nc-vig nc-vig-import">
              <span className="nc-files">
                <span className="nc-file">Kinematics.md</span>
                <span className="nc-file">Organic.md</span>
                <span className="nc-file">Formulas.md</span>
              </span>
              <svg className="nc-arrow side" viewBox="0 0 40 24" aria-hidden="true"><path d="M2 12h32M27 5l8 7-8 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="nc-mini-page"><b /><i /><i /><i /></span>
            </div>
          </article>
        </div>
      </section>

      {/* ── Again ── */}
      <section className="nc-end">
        <h2 className="nc-h2">Your notebook is ready<span className="nc-stop">.</span></h2>
        <button type="button" className="nc-cta" onClick={onEnable}>Turn on Notes</button>
        <p className="nc-fine">Turn it off any time. Your pages stay saved.</p>
      </section>
    </div>
  );
}
