/* ── Everything below the first screen ──
   One heading tree, in order: an H2 per section with the phrase that section
   should rank for, an H3 per feature, FAQ answers as plain paragraphs. Copy
   comes from content.ts; nothing here invents a sentence of its own that the
   structured data would then not know about. */

import React from 'react';
import {
  COMPARE, EXAMS, Exam, FACTS, FAQ, FEATURES, INCLUDED, RIBBON, SITE, STEPS,
} from './content';
import { Arrow, countdown, useNow } from './Hero';
import { landingNow } from './clock';
import {
  CardsVis, Check, Cross, DevicesVis, ErrorsVis, MocksVis, PlanVis, RaceVis, StatsVis, StreakVis, SyllabusVis, TimerVis,
} from './Vignettes';

export const Nav: React.FC<{ onCta: () => void }> = ({ onCta }) => (
  <nav className="lp-nav" aria-label="Main">
    <a className="lp-brand" href="#top" aria-label="Tracker Alpha, back to top">
      <img src="/apple-touch-icon.png" width={30} height={30} alt="" />
      <span>Tracker Alpha</span>
    </a>
    <div className="lp-nav-links">
      <a href="#features">Features</a>
      <a href="#how-it-works">How it works</a>
      <a href="#pricing">Pricing</a>
      <a href="#faq">FAQ</a>
    </div>
    <button type="button" className="lp-btn lp-btn-red" onClick={onCta}>Start free</button>
  </nav>
);

export const Ribbon: React.FC = () => (
  <div className="lp-ribbon lp-dark">
    <div className="lp-ribbon-track">
      <ul>{RIBBON.map(r => <li key={r}>{r}</li>)}</ul>
      <ul aria-hidden="true">{RIBBON.map(r => <li key={r}>{r}</li>)}</ul>
    </div>
  </div>
);

export const Manifesto: React.FC = () => (
  <section className="lp-section" aria-labelledby="lp-why">
    <div className="lp-wrap">
      <p className="lp-eyebrow rv"><b>01</b> — Why track</p>
      <h2 id="lp-why" className="lp-h2 rv" style={{ marginTop: 22 }}>
        You think you studied 8 hours.{' '}
        <span className="lp-serif">Did you<span className="lp-stop">?</span></span>
      </h2>
      <div className="lp-manifesto-grid">
        <p className="lp-fill">
          A study day leaks. Five minutes on your phone. A break that runs long. A chapter you “revised” but only read.
          Without a study tracker, you are guessing.
        </p>
        <div className="lp-body-cols rv">
          <p>
            Tracker Alpha measures instead. Every session is timed to the second. Every chapter has a status. Every
            mock has a score.
          </p>
          <p>So the number you see is the number you studied. And that is the number that gets you a rank.</p>
        </div>
      </div>
      <div className="lp-facts">
        {FACTS.map(f => (
          <div key={f.label} className="lp-fact rv">
            <b>{f.value}{f.unit && <small>{f.unit}</small>}</b>
            <p>{f.label}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

const VIS: Record<string, (exam: Exam) => React.ReactNode> = {
  timer: () => <TimerVis />,
  planner: exam => <PlanVis exam={exam} />,
  syllabus: () => <SyllabusVis />,
  mocks: () => <MocksVis />,
  errors: () => <ErrorsVis />,
  flashcards: () => <CardsVis />,
  streaks: () => <StreakVis />,
  groups: () => <RaceVis />,
  stats: exam => <StatsVis exam={exam} />,
  devices: () => <DevicesVis />,
};
const DARK = new Set(['timer', 'groups']);

export const Features: React.FC<{ exam: Exam }> = ({ exam }) => (
  <section id="features" className="lp-section" aria-labelledby="lp-features" style={{ paddingTop: 0 }}>
    <div className="lp-wrap">
      <div className="lp-head">
        <p className="lp-eyebrow rv"><b>02</b> — Everything inside</p>
        <h2 id="lp-features" className="lp-h2 rv">
          Every tool for JEE and NEET prep.{' '}
          <span className="lp-serif">One free app<span className="lp-stop">.</span></span>
        </h2>
        <p className="lp-lead rv">
          Ten study tools that work together. Your timer knows your syllabus, your planner knows your day, and your
          mock scores show you what to fix next.
        </p>
      </div>
      <div className="lp-bento">
        {FEATURES.map((f, i) => (
          <article key={f.id} id={`feature-${f.id}`} className={`lp-tile t-${f.id}${DARK.has(f.id) ? ' is-dark' : ''} rv`}>
            <div>
              <span className="lp-tile-n">{String(i + 1).padStart(2, '0')}</span>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
            <div className="lp-vis">{VIS[f.id](exam)}</div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export const Steps: React.FC<{ onCta: () => void }> = ({ onCta }) => (
  <section id="how-it-works" className="lp-section" aria-labelledby="lp-how" style={{ paddingTop: 0 }}>
    <div className="lp-wrap">
      <div className="lp-head">
        <p className="lp-eyebrow rv"><b>03</b> — How it works</p>
        <h2 id="lp-how" className="lp-h2 rv">
          Start in ten seconds.{' '}
          <span className="lp-serif">No sign-up needed<span className="lp-stop">.</span></span>
        </h2>
      </div>
      <ol className="lp-steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="lp-step rv">
            <span className="lp-step-n" aria-hidden="true">{i + 1}<span>.</span></span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </li>
        ))}
      </ol>
      <div className="lp-steps-foot rv">
        <button type="button" className="lp-btn lp-btn-ink" onClick={onCta}>Open Tracker Alpha <Arrow /></button>
        <p>Start without an account. Sign in free when you want to sync your phone and laptop, join a study group or race on the leaderboard.</p>
      </div>
    </div>
  </section>
);

export const Price: React.FC<{ onCta: () => void }> = ({ onCta }) => (
  <section id="pricing" className="lp-section lp-dark lp-price" aria-labelledby="lp-price">
    <div className="lp-wrap">
      <p className="lp-eyebrow rv"><b>04</b> — Pricing</p>
      <p className="lp-zero"><span>₹</span>0</p>
      <h2 id="lp-price" className="lp-h2 rv">
        It’s free.{' '}
        <span className="lp-serif">It honestly shouldn’t be<span className="lp-stop">.</span></span>
      </h2>
      <p className="lp-lead rv">
        Every tool on this page costs nothing. No trial that runs out. No card. No ads. Just the study tracker we
        wished we had.
      </p>
      <ul className="lp-included">
        {INCLUDED.map(x => (
          <li key={x} className="rv"><Check size={18} />{x}</li>
        ))}
      </ul>
      <div className="lp-ctas">
        <button type="button" className="lp-btn lp-btn-red lp-btn-lg" onClick={onCta}>Get it free <Arrow /></button>
      </div>
      <p className="lp-micro">No card<i>·</i>No trial<i>·</i>No catch</p>
    </div>
  </section>
);

const Cell: React.FC<{ v: string }> = ({ v }) => {
  if (v === '✓') return <span className="lp-yes" role="img" aria-label="Yes"><Check size={13} /></span>;
  if (v === '✗') return <span className="lp-no" role="img" aria-label="No"><Cross size={11} /></span>;
  return <>{v}</>;
};

export const Compare: React.FC = () => (
  <section className="lp-section" aria-labelledby="lp-compare">
    <div className="lp-wrap">
      <div className="lp-head">
        <p className="lp-eyebrow rv"><b>05</b> — Compare</p>
        <h2 id="lp-compare" className="lp-h2 rv">
          A notebook can’t do this.{' '}
          <span className="lp-serif">Neither can a timer<span className="lp-stop">.</span></span>
        </h2>
        <p className="lp-lead rv">How Tracker Alpha compares with a paper study log and general focus timer apps.</p>
      </div>
      <div className="lp-compare rv">
        <table>
          <caption className="lp-sr">Tracker Alpha compared with focus timer apps and a paper notebook</caption>
          <thead>
            <tr>
              <th scope="col"><span className="lp-sr">Feature</span></th>
              {COMPARE.columns.map((c, i) => (
                <th key={c} scope="col" className={i === 0 ? 'us' : undefined}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARE.rows.map(r => (
              <tr key={r.label}>
                <th scope="row">{r.label}</th>
                {r.cells.map((v, i) => (
                  <td key={i} className={i === 0 ? 'us' : undefined}><Cell v={v} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </section>
);

export const Faq: React.FC = () => (
  <section id="faq" className="lp-section" aria-labelledby="lp-faq" style={{ paddingTop: 0 }}>
    <div className="lp-wrap lp-faq-grid">
      <div className="lp-faq-side">
        <p className="lp-eyebrow rv"><b>06</b> — FAQ</p>
        <h2 id="lp-faq" className="lp-h2 rv" style={{ marginTop: 22 }}>
          Questions,{' '}
          <span className="lp-serif">answered<span className="lp-stop">.</span></span>
        </h2>
        <p className="rv">
          Still stuck? Email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> or message{' '}
          <a href={SITE.instagram} target="_blank" rel="noopener noreferrer">@trackeralpha</a> on Instagram.
        </p>
      </div>
      <div className="lp-faq">
        {FAQ.map((f, i) => (
          <details key={f.q} open={i === 0}>
            <summary><h3>{f.q}</h3></summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
);

export const Final: React.FC<{ exam: Exam; onCta: () => void }> = ({ exam, onCta }) => {
  const now = useNow();
  const e = EXAMS[exam];
  return (
    <section className="lp-section lp-dark lp-final" aria-labelledby="lp-final">
      <div className="lp-wrap">
        <p className="lp-final-n rv">{countdown(e.target, now).days}</p>
        <span className="lp-final-u rv">{e.unit}</span>
        <h2 id="lp-final" className="lp-h2 rv">
          Start today.{' '}
          <span className="lp-serif">{e.thanks.replace(/\.$/, '')}<span className="lp-stop">.</span></span>
        </h2>
        <div className="lp-ctas rv">
          <button id="landing-cta-final" type="button" className="lp-btn lp-btn-red lp-btn-lg" onClick={onCta}>
            Start tracking free <Arrow />
          </button>
        </div>
        <p className="lp-micro rv">Free<i>·</i>No card<i>·</i>Ready in 10 seconds</p>
      </div>
    </section>
  );
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* The build date, not today: "updated" has to mean when the page last changed. In IST. */
const builtOn = (): { day: string; year: number; iso: string } => {
  const d = new Date(landingNow() + 330 * 60_000);
  return {
    day: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
    year: d.getUTCFullYear(),
    iso: d.toISOString().slice(0, 10),
  };
};

export const Footer: React.FC = () => {
  const built = builtOn();
  return (
    <footer className="lp-dark">
      <div className="lp-wrap lp-foot">
        <div className="lp-foot-grid">
          <div className="lp-foot-brand">
            <span className="lp-brand">
              <img src="/apple-touch-icon.png" width={30} height={30} alt="" loading="lazy" />
              <span>Tracker Alpha</span>
            </span>
            <p>The free study tracker for JEE Main, JEE Advanced and NEET UG 2027. Made in India, for aspirants who want to see their real hours.</p>
          </div>
          <div className="lp-foot-cols">
            <div>
              <p className="lp-foot-h">Study tools</p>
              <ul>
                <li><a href="#feature-timer">Study timer</a></li>
                <li><a href="#feature-planner">Study planner</a></li>
                <li><a href="#feature-syllabus">Syllabus tracker</a></li>
                <li><a href="#feature-mocks">Mock test tracker</a></li>
                <li><a href="#feature-flashcards">Flashcards</a></li>
                <li><a href="#feature-groups">Study groups</a></li>
              </ul>
            </div>
            <div>
              <p className="lp-foot-h">Free guides</p>
              <ul>
                <li><a href="/jee-main-syllabus/">JEE Main 2027 syllabus</a></li>
                <li><a href="/jee-main-chapter-weightage/">JEE Main chapter weightage</a></li>
                <li><a href="/neet-syllabus/">NEET 2027 syllabus</a></li>
                <li><a href="/neet-chapter-weightage/">NEET chapter weightage</a></li>
                <li><a href="/syllabus/">All syllabus guides</a></li>
              </ul>
            </div>
            <div>
              <p className="lp-foot-h">Contact</p>
              <ul>
                <li><a href={SITE.instagram} target="_blank" rel="noopener noreferrer">Instagram</a></li>
                <li><a href={`mailto:${SITE.email}`}>Email us</a></li>
                <li><a href="#faq">FAQ</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="lp-foot-base">
          <span>© {built.year} Tracker Alpha</span>
          <span>Updated <time dateTime={built.iso}>{built.day}</time></span>
        </div>
        <p className="lp-wordmark" aria-hidden="true">Lock in.</p>
      </div>
    </footer>
  );
};
