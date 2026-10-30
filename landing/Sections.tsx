/* ── Everything below the first screen ──
   Each section says one thing, in a few words, with one object to look at:
   three lines about the product (each with a live number) and the rest of the
   tools in a grid, the crowd (the live race and the groups), the card, the
   three ways in, the countdown, a short FAQ, and the door again. An H2 per
   section and an H3 per item keep the heading tree whole for search engines.
   Copy comes from content.ts; what changes per exam comes from the Variant. */

import React, { useEffect, useState } from 'react';
import { examById, type ExamId } from '../content/exams';
import {
  CROWD, PILLARS, ROOT, SITE, TOOLS, VARIANTS, Variant, WAYS, YEARS, examName, examShort, examTarget, faqFor,
} from './content';
import { Arrow, Seal, daysLeft, useNow } from './Hero';
import { landingNow } from './clock';

const pad = (n: number) => String(n).padStart(2, '0');

export const Nav: React.FC<{ onCta: () => void; onInvite: () => void }> = ({ onCta, onInvite }) => (
  <nav className="lp-nav" aria-label="Main">
    <a className="lp-wordmark-sm" href="/" aria-label="Tracker Alpha, home">Tracker Alpha</a>
    <div className="lp-nav-end">
      <button type="button" className="lp-nav-link" onClick={onInvite}>Sign in</button>
      <button type="button" className="lp-nav-btn" onClick={onCta}>Request access</button>
    </div>
  </nav>
);

/* A session clock that runs from the moment the page mounts: the same
   1:24:36 on the server, on hydration and for every visitor, then ticking. */
const LiveClock: React.FC = () => {
  const [secs, setSecs] = useState(5076);
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => setSecs(5076 + Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);
  return <>{Math.floor(secs / 3600)}:{pad(Math.floor((secs % 3600) / 60))}:{pad(secs % 60)}</>;
};

const PillarArt: React.FC<{ id: string }> = ({ id }) => {
  if (id === 'timer') {
    return (
      <div className="lp-art">
        <span className="lp-live"><i />Physics</span>
        <b className="lp-num"><LiveClock /></b>
      </div>
    );
  }
  if (id === 'syllabus') {
    return (
      <div className="lp-art">
        <span className="lp-live lp-live-quiet">Chemistry</span>
        <b className="lp-num">62%</b>
        <span className="lp-bar"><i /></span>
      </div>
    );
  }
  return (
    <div className="lp-art">
      <span className="lp-live lp-live-quiet">Streak</span>
      <b className="lp-num">Day 23</b>
      <span className="lp-days" aria-hidden="true">{[0, 1, 2, 3, 4, 5, 6].map(i => <i key={i} className={i === 6 ? 'today' : ''} />)}</span>
    </div>
  );
};

export const Inside: React.FC = () => (
  <section id="inside" className="lp-sec lp-inside" aria-labelledby="lp-inside-h">
    <h2 id="lp-inside-h" className="lp-sr">What is inside Tracker Alpha</h2>
    {PILLARS.map((p, i) => (
      <article key={p.id} className="lp-pillar rv">
        <span className="lp-pillar-n" aria-hidden="true">0{i + 1}</span>
        <div className="lp-pillar-words">
          <h3>{p.line}</h3>
          <p>{p.small}</p>
        </div>
        <PillarArt id={p.id} />
      </article>
    ))}
  </section>
);

export const Tools: React.FC = () => (
  <section className="lp-sec lp-tools" aria-labelledby="lp-tools-h">
    <h2 id="lp-tools-h" className="lp-h2 rv">And the rest<em>.</em></h2>
    <ul className="lp-tools-grid">
      {TOOLS.map((t, i) => (
        <li key={t.title} className="rv">
          <span aria-hidden="true">{pad(i + 4)}</span>
          <h3>{t.title}</h3>
          <p>{t.small}</p>
        </li>
      ))}
    </ul>
  </section>
);

/* The race, drawn: illustrative rows, never a claim about real people or
   real numbers. "You" is the viewer, one place off the top. */
const RACE = [
  { n: 1, i: 'A', name: 'Aarav', h: '7h 12m' },
  { n: 2, i: 'Y', name: 'You', h: '6h 58m', me: true },
  { n: 3, i: 'D', name: 'Diya', h: '6h 41m' },
  { n: 4, i: 'K', name: 'Kabir', h: '6h 05m' },
];

export const Crowd: React.FC = () => (
  <section className="lp-sec lp-crowd" aria-labelledby="lp-crowd-h">
    <h2 id="lp-crowd-h" className="lp-h2 rv">{CROWD.title}</h2>
    <div className="lp-crowd-grid">
      <ol className="lp-crowd-lines">
        {CROWD.lines.map(l => (
          <li key={l.big} className="rv">
            <h3>{l.big}</h3>
            <p>{l.small}</p>
          </li>
        ))}
      </ol>
      <div className="lp-race rv" aria-hidden="true">
        <div className="lp-race-top">
          <span className="lp-live"><i />Today’s race</span>
          <span className="lp-race-reset">Resets at 4 AM</span>
        </div>
        {RACE.map(r => (
          <div key={r.n} className={`lp-race-row${r.me ? ' me' : ''}`}>
            <span className="lp-race-n">{r.n}</span>
            <span className="lp-race-av">{r.i}</span>
            <span className="lp-race-name">{r.name}</span>
            <b>{r.h}</b>
          </div>
        ))}
        <p className="lp-race-gap">14 minutes behind first.</p>
      </div>
    </div>
  </section>
);

export const Card: React.FC = () => (
  <section className="lp-sec lp-cardsec" aria-labelledby="lp-card-h">
    <div className="lp-cardsec-in">
      <div className="lp-card-stage rv">
        <div className="lp-card" role="img" aria-label="The Tracker Alpha membership card">
          <div className="lp-card-top">
            <span className="lp-card-mark">ALPHA</span>
            <span className="lp-card-alpha" aria-hidden="true">α</span>
          </div>
          <div className="lp-card-no">No. ····</div>
          <div className="lp-card-bot">
            <div>
              <div className="lp-card-name">Your name here</div>
              <div className="lp-card-tier">Member</div>
            </div>
            <span className="lp-card-chip" aria-hidden="true" />
          </div>
          <span className="lp-card-line" aria-hidden="true" />
        </div>
      </div>
      <div className="lp-cardsec-words rv">
        <h2 id="lp-card-h">One card.<br /><em>One pass to gift.</em></h2>
        <p>Every member can gift one friend an Access Pass, worth ₹2,500. Give it to someone who studies.</p>
      </div>
    </div>
  </section>
);

export const Ways: React.FC<{ onCta: () => void; onInvite: () => void }> = ({ onCta, onInvite }) => (
  <section id="ways-in" className="lp-sec lp-ways" aria-labelledby="lp-ways-h">
    <h2 id="lp-ways-h" className="lp-h2 rv">Two ways in.</h2>
    <ol className="lp-ways-list">
      {WAYS.map((w, i) => (
        <li key={w.id} className="lp-way rv">
          <span className="lp-way-n" aria-hidden="true">{['I', 'II'][i]}</span>
          <div className="lp-way-words">
            <h3>{w.title}</h3>
            <p>{w.small}</p>
          </div>
          {w.id === 'invite' && <button type="button" className="lp-pill" onClick={onInvite}>I have one</button>}
          {w.id === 'pass' && <button type="button" className="lp-pill lp-pill-on" onClick={onCta}>Reserve</button>}
        </li>
      ))}
    </ol>
    <p className="lp-note rv">Already a member? <button type="button" onClick={onInvite}>Sign in</button></p>
  </section>
);

/* The countdown. On the page for every exam, JEE and NEET can be switched (and
   the switch goes into onboarding); on an exam's own page it is that exam.
   Both years can be picked everywhere. */
export const Clock: React.FC<{ variant: Variant; exam: ExamId; onExam: (e: ExamId) => void; year: number | null; onYear: (y: number) => void }> = ({ variant, exam, onExam, year: picked, onYear }) => {
  const now = useNow();
  const years = YEARS();
  const year = picked ?? years[0];
  return (
    <section className="lp-sec lp-clock" aria-labelledby="lp-clock-h">
      <div className="lp-toggles rv">
        {variant.exams.length > 1 && (
          <div className="lp-toggle" role="group" aria-label="Your exam">
            {variant.exams.map(x => (
              <button key={x} type="button" aria-pressed={exam === x} onClick={() => onExam(x)}>{examShort(x)}</button>
            ))}
          </div>
        )}
        <div className="lp-toggle" role="group" aria-label="Your year">
          {years.map(y => (
            <button key={y} type="button" aria-pressed={year === y} onClick={() => onYear(y)}>{y}</button>
          ))}
        </div>
      </div>
      <h2 id="lp-clock-h" className="rv">
        <b>{daysLeft(examTarget(exam, year), now)}</b>
        <span>days to {examName(exam)} {year}</span>
      </h2>
      <p className="rv">{examById(exam).usual.note} <em>Start now.</em></p>
    </section>
  );
};

export const Faq: React.FC<{ variant: Variant }> = ({ variant }) => (
  <section id="faq" className="lp-sec lp-faq-sec" aria-labelledby="lp-faq-h">
    <h2 id="lp-faq-h" className="lp-h2 rv">Questions.</h2>
    <div className="lp-faq">
      {faqFor(variant).map(f => (
        <details key={f.q}>
          <summary><h3>{f.q}</h3></summary>
          <p>{f.a}</p>
        </details>
      ))}
    </div>
  </section>
);

export const Final: React.FC<{ onCta: () => void; onInvite: () => void }> = ({ onCta, onInvite }) => (
  <section className="lp-sec lp-final" aria-labelledby="lp-final-h">
    <Seal size={84} gid="lp-wax-final" className="rv" />
    <h2 id="lp-final-h" className="rv">Ask for<br />your place.</h2>
    <div className="lp-actions rv">
      <button id="landing-cta-final" type="button" className="lp-btn" onClick={onCta}>
        Request access <Arrow />
      </button>
      <button id="landing-invite-final" type="button" className="lp-link" onClick={onInvite}>
        I have a pass
      </button>
    </div>
  </section>
);

export const Footer: React.FC<{ variant: Variant }> = ({ variant }) => {
  const year = new Date(landingNow() + 330 * 60_000).getUTCFullYear();
  return (
    <footer className="lp-foot">
      <nav className="lp-foot-links" aria-label="Study trackers by exam">
        {variant !== ROOT && <a href="/">All exams</a>}
        {VARIANTS.filter(v => v !== variant).map(v => <a key={v.path} href={v.path}>{v.label} study tracker</a>)}
      </nav>
      <nav className="lp-foot-links lp-foot-more" aria-label="More">
        <a href="/syllabus/">Syllabus guides</a>
        <a href="/jee-main-chapter-weightage/">JEE weightage</a>
        <a href="/neet-chapter-weightage/">NEET weightage</a>
        <a href="/support/">Support</a>
        <a href="/privacy/">Privacy</a>
        <a href="/delete-account/">Delete account</a>
        <a href={SITE.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>
        <a href={`mailto:${SITE.email}`}>Email</a>
      </nav>
      <p className="lp-foot-base">© {year} Tracker Alpha · Members only · Made in India</p>
    </footer>
  );
};
