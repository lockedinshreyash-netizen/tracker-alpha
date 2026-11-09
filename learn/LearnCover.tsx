/* ── The Learn cover ──
   What a student sees on the Learn tab until they turn it on: a product page
   for both shelves, lectures and books. In order: the promise and the button,
   a real shelf with both kinds of object on it, what each shelf is (drawn as
   the screens themselves), where a highlight goes, why it beats a folder of
   PDFs and a YouTube tab, how to start, and the button again.

   Every picture is hand-built HTML and SVG in the app's own parts (CdCase,
   books/Cover), never a screenshot, and every line must stay true of the app
   as it is. Short, plain, blunt: the teen-copy rule. #E10600 is spent on the
   full stops and the buttons; the yellow is the highlight's own colour.

   Turning it on writes one dated decision to AppState and nothing else; the
   library is opened, and its key fetched, only on the screen after this. */

import React from 'react';
import CdCase, { type Finish } from './CdCase';
import { Cover } from '../books/Cover';
import type { CoverArt, LearnSubject } from './model';
import type { BookKind, BookSubject } from '../books/model';
import './cover.css';

interface Props {
  dark: boolean;
  signedIn: boolean;
  onEnable: () => void;
}

type Item =
  | { kind: 'case'; code: string; title: string; subject: LearnSubject; art: CoverArt; chapter: string; size: number; done?: boolean }
  | { kind: 'book'; id: string; title: string; type: BookKind; subject: BookSubject; design: string; kicker: string; width: number; progress?: number };

const SHELF: Item[] = [
  { kind: 'case', code: 'PHY-014', title: 'Rotational Motion', subject: 'Physics', art: 'rings', chapter: 'Class 11', size: 150 },
  { kind: 'book', id: 'cv-phy', title: 'Physics Part 1', type: 'book', subject: 'Physics', design: 'orbit-classic', kicker: 'Class 11 · NCERT', width: 120, progress: 0.42 },
  { kind: 'case', code: 'CHE-009', title: 'Chemical Bonding', subject: 'Chemistry', art: 'hex', chapter: 'Class 11', size: 132, done: true },
  { kind: 'book', id: 'cv-org', title: 'Organic Chemistry', type: 'module', subject: 'Chemistry', design: 'hex-band', kicker: 'Module 3', width: 112 },
  { kind: 'case', code: 'MAT-008', title: 'Integrals', subject: 'Maths', art: 'curve', chapter: 'Class 12', size: 150 },
  { kind: 'book', id: 'cv-dpp', title: 'DPP 07', type: 'dpp', subject: 'Maths', design: 'grid-classic', kicker: 'Integrals', width: 96 },
  { kind: 'case', code: 'BIO-021', title: 'Human Physiology', subject: 'Biology', art: 'orbit', chapter: 'Class 11', size: 132 },
  { kind: 'book', id: 'cv-bio', title: 'Biology', type: 'book', subject: 'Biology', design: 'helix-classic', kicker: 'Class 12 · NCERT', width: 112, progress: 0.18 },
];

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

/* A small inclined-plane figure, for the snip: the sort of thing a DPP is full of. */
const Incline = ({ ink }: { ink: string }) => (
  <svg viewBox="0 0 120 64" aria-hidden="true" className="lcv-incline">
    <path d="M8 56h104L8 14z" fill="none" stroke={ink} strokeWidth="1.4" strokeLinejoin="round" />
    <rect x="42" y="22" width="18" height="12" transform="rotate(22 51 28)" fill="none" stroke={ink} strokeWidth="1.4" />
    <path d="M24 56a16 16 0 0 0-2-8" fill="none" stroke={ink} strokeWidth="1" />
    <text x="27" y="52" fontSize="8" fill={ink} fontFamily="Georgia, serif" fontStyle="italic">θ</text>
  </svg>
);

export default function LearnCover({ dark, signedIn, onEnable }: Props) {
  const finish: Finish = dark ? 'ink' : 'paper';
  const ink = dark ? '#d4d4d8' : '#27272a';

  const Cta = ({ big }: { big?: boolean }) => (
    <div className="lcv-cta">
      <button type="button" className={`lcv-btn ${big ? 'is-big' : ''}`} onClick={onEnable}>
        Turn on Learn <Arrow />
      </button>
      {!signedIn && <span className="lcv-note">You'll need to be signed in to open your shelf.</span>}
    </div>
  );

  return (
    <div className="lcv">
      {/* ── 1. The promise ── */}
      <section className="lcv-hero">
        <span className="lcv-kicker"><i /> New in Alpha</span>
        <h1 className="lcv-title">Learn<span>.</span></h1>
        <p className="lcv-dek">Your lectures and your books. One shelf. No rabbit hole.</p>
        <p className="lcv-line">
          Watch YouTube lectures without the feed. Read NCERT, modules and DPPs inside Alpha.
          Everything is filed under its chapter, and everything you mark turns into something you can revise.
        </p>
        <Cta />
      </section>

      {/* ── 2. The shelf ── */}
      <div className="lcv-shelf" aria-hidden="true">
        <div className="lcv-shelf-glow" />
        <div className="lcv-shelf-row">
          {SHELF.map((it, i) => (
            <span key={i} className="lcv-item" style={{ animationDelay: `${120 + i * 70}ms` }}>
              {it.kind === 'case'
                ? <CdCase code={it.code} title={it.title} subject={it.subject} art={it.art} chapter={it.chapter} size={it.size} finish={finish} done={it.done} />
                : <Cover id={it.id} title={it.title} kind={it.type} subject={it.subject} cover={{ design: it.design, finish }} width={it.width} kicker={it.kicker} progress={it.progress} />}
            </span>
          ))}
        </div>
        <div className="ln-ledge" />
      </div>

      {/* ── 3. Two shelves ── */}
      <section className="lcv-section">
        <header className="lcv-head">
          <span className="lcv-eyebrow">Two shelves</span>
          <h2>Everything you study from, in one place.</h2>
        </header>
        <div className="lcv-two">
          <article className="lcv-panel">
            <div className="lcv-mock lcv-screen" aria-hidden="true">
              <div className="lcv-screen-bar">
                <span className="lcv-chip">PHY-014</span>
                <span className="lcv-screen-title">Rotational Motion · One Shot</span>
                <span className="lcv-pill">Start the clock</span>
              </div>
              <div className="lcv-screen-video">
                <span className="lcv-screen-glow" />
                <span className="lcv-play"><i /></span>
              </div>
              <div className="lcv-rail">
                <span className="lcv-rail-watched" style={{ left: '0%', width: '38%' }} />
                <span className="lcv-rail-watched" style={{ left: '52%', width: '12%' }} />
                <span className="lcv-rail-head" style={{ left: '38%' }} />
                {[18, 33, 61].map(x => <span key={x} className="lcv-tick" style={{ left: `${x}%` }} />)}
              </div>
            </div>
            <h3>Lectures</h3>
            <p>Paste a YouTube link. It goes on your shelf with its own number, under its chapter.</p>
            <ul className="lcv-list">
              <li>No feed. No Shorts. No comments.</li>
              <li>Picks up where you stopped.</li>
              <li>Bookmarks and notes on the timeline.</li>
            </ul>
          </article>

          <article className="lcv-panel">
            <div className="lcv-mock lcv-desk" aria-hidden="true">
              <div className="lcv-page">
                <span className="lcv-page-kicker">Chapter two</span>
                <span className="lcv-page-title">Motion in a Straight Line</span>
                <p>
                  The SI unit of force is the newton. <mark>One newton is the force that gives a mass of 1 kg an acceleration of 1 m s⁻².</mark>{' '}
                  Dimensional analysis checks whether an equation is consistent.
                </p>
                <div className="lcv-toolbar">
                  {['#F5C400', '#3FB45A', '#3D8EEB', '#E8578A'].map(c => <i key={c} style={{ background: c }} />)}
                  <b />
                  <span>Card</span><span>To notes</span><span>Mistake</span>
                </div>
                <span className="lcv-skel" style={{ width: '92%' }} />
                <span className="lcv-skel" style={{ width: '78%' }} />
                <div className="lcv-snip"><Incline ink="#3a3a40" /></div>
                <span className="lcv-skel" style={{ width: '86%' }} />
                <span className="lcv-skel" style={{ width: '94%' }} />
                <span className="lcv-skel" style={{ width: '70%' }} />
                <span className="lcv-skel" style={{ width: '88%' }} />
              </div>
            </div>
            <h3>Books</h3>
            <p>Add NCERT, your coaching modules and DPPs as PDFs. Read them inside Alpha.</p>
            <ul className="lcv-list">
              <li>Highlight, add notes, bookmark.</li>
              <li>Snip any question or figure.</li>
              <li>The files never leave your device.</li>
            </ul>
          </article>
        </div>
      </section>

      {/* ── 4. Where a highlight goes ── */}
      <section className="lcv-section">
        <header className="lcv-head">
          <span className="lcv-eyebrow">Nothing you mark is wasted</span>
          <h2>One highlight. Three places.</h2>
          <p>Reading is only half of it. Alpha turns what you mark into something you revise.</p>
        </header>
        <div className="lcv-flow">
          <div className="lcv-source">
            <span className="lcv-source-label">You highlight</span>
            <p><mark>One newton is the force that gives 1 kg an acceleration of 1 m s⁻².</mark></p>
            <span className="lcv-source-from">Physics Part 1 · p. 21</span>
          </div>
          <svg className="lcv-wires" viewBox="0 0 100 300" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 150 C 50 150, 50 50, 100 50" />
            <path d="M0 150 L 100 150" />
            <path d="M0 150 C 50 150, 50 250, 100 250" />
          </svg>
          <div className="lcv-dests">
            <div className="lcv-dest">
              <span className="lcv-dest-label">Flashcard</span>
              <p>One newton is the force that gives <span className="lcv-blank">1 kg</span> an acceleration of 1 m s⁻².</p>
              <span className="lcv-dest-foot">Tap words to hide them. Spaced repetition does the rest.</span>
            </div>
            <div className="lcv-dest">
              <span className="lcv-dest-label">Chapter notes</span>
              <blockquote>One newton is the force that gives 1 kg an acceleration of 1 m s⁻².</blockquote>
              <span className="lcv-dest-foot"><em>Physics Part 1, p. 21</em> · one tap back to the page</span>
            </div>
            <div className="lcv-dest">
              <span className="lcv-dest-label">Error notebook</span>
              <div className="lcv-dest-snip"><Incline ink={ink} /><span>Answer: <b>B</b></span></div>
              <span className="lcv-dest-foot">Snip a DPP question you got wrong. Retest it later.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Why ── */}
      <section className="lcv-section">
        <header className="lcv-head">
          <span className="lcv-eyebrow">Why it beats a PDF app and a YouTube tab</span>
          <h2>Built for one exam. Yours.</h2>
        </header>
        <div className="lcv-bento">
          <div className="lcv-tile is-wide">
            <h3>It knows your syllabus.</h3>
            <p>Add a whole NCERT book. Alpha finds where each chapter starts and files it for you.</p>
            <div className="lcv-map" aria-hidden="true">
              {[['Units & Measurements', '1–20'], ['Motion in a Straight Line', '21–40'], ['Motion in a Plane', '41–60']].map(([c, p]) => (
                <div key={c} className="lcv-map-row"><span className="lcv-dot" />{c}<b>p. {p}</b></div>
              ))}
              <span className="lcv-found">Found automatically</span>
            </div>
          </div>
          <div className="lcv-tile">
            <h3>Read your way.</h3>
            <p>Scroll down, flip page by page, or open two pages like a real book. Night mode for 1 AM.</p>
            <div className="lcv-ways" aria-hidden="true">
              <span className="lcv-way"><i /><i /></span>
              <span className="lcv-way is-flip"><i /></span>
              <span className="lcv-way is-spread"><i /><i /></span>
              <span className="lcv-tones"><i data-t="paper" /><i data-t="sepia" /><i data-t="night" /></span>
            </div>
          </div>
          <div className="lcv-tile">
            <h3>The clock is one tap away.</h3>
            <p>Start the stopwatch from a lecture or a book, on that chapter. It counts like any session.</p>
            <span className="lcv-clock" aria-hidden="true"><i /> 1:24:07</span>
          </div>
          <div className="lcv-tile is-wide">
            <h3>Private by design.</h3>
            <p>Your PDFs never leave your device. Your shelf is locked to your account. Alpha never sees what you watch or read.</p>
            <div className="lcv-locks" aria-hidden="true">
              <span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg> Locked to you</span>
              <span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></svg> Files stay on this device</span>
              <span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14" /></svg> Nothing uploaded</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. How ── */}
      <section className="lcv-section">
        <header className="lcv-head">
          <span className="lcv-eyebrow">How it works</span>
          <h2>Three steps. Then just study.</h2>
        </header>
        <ol className="lcv-steps">
          <li>
            <span className="lcv-n">1</span>
            <h3>Turn on Learn.</h3>
            <p>One tap. Your shelf is made on this device and locked to your account.</p>
          </li>
          <li>
            <span className="lcv-n">2</span>
            <h3>Add what you study from.</h3>
            <p>Paste a YouTube lecture link, or drop in a PDF. NCERT is free from ncert.nic.in.</p>
          </li>
          <li>
            <span className="lcv-n">3</span>
            <h3>Watch, read, mark.</h3>
            <p>Start the clock. Highlight what matters. Send it to a flashcard, your notes or your mistakes.</p>
          </li>
        </ol>
      </section>

      {/* ── 7. Again ── */}
      <section className="lcv-final">
        <h2>Your whole syllabus. One shelf<span>.</span></h2>
        <p>Stop switching between five apps. Lock in.</p>
        <Cta big />
      </section>

      <p className="lcv-fine">
        Videos play from YouTube, under the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>.
        YouTube sees what you play. PDFs you add are your own copies and stay on your device. <a href="/privacy/">Privacy</a>
      </p>
    </div>
  );
}
