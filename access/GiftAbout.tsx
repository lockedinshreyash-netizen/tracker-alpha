/* ── What a gifted pass is ──
   Under "Rahul sent you an Access Pass" on the gift page. The friend who
   opens the link has usually never heard of Alpha, so before Google asks
   them anything this says, in short lines, what Alpha is, what the pass gets
   them, what happens when they tap, and lets them watch the 24-second film
   (public/showcase/, the landing page's "Look inside." film).

   Every claim here must stay true of the app: these are features that exist
   today, and the pass really costs them nothing. */

import { useState } from 'react';
import { PASS_PRICE_LABEL } from './cutover';

const WHAT = [
  ['Every hour, timed.', 'Stopwatch, Pomodoro or a sprint. Every session is logged.'],
  ['Your syllabus, chapter by chapter.', "See what's done and what's left."],
  ['Plan the whole day.', 'Study, classes, sleep. One timeline.'],
  ['Mocks and mistakes.', 'Log scores. Retest what you got wrong.'],
  ['Flashcards that come back.', 'Each card returns right before you forget it.'],
  ['Study with friends.', 'Groups, a live race, a daily streak.'],
] as const;

const GETS = [
  ['Full Alpha, for life.', 'Everything in the app, on every device.'],
  ['Nothing to pay.', 'No card. No trial. Nothing to cancel.'],
  ['A pass of your own.', 'You get one to gift a friend too.'],
] as const;

const STEPS = ['Sign in with Google.', "Your pass opens. You're in.", 'Pick your exam. Start the clock.'] as const;

const FILM = { src: '/showcase/showcase.mp4', poster: '/showcase/poster.jpg', captions: '/showcase/captions.vtt' };

const GiftAbout = ({ exam }: { exam: 'JEE' | 'NEET' }) => {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="ax-about">
      <section className="ax-about-sec">
        <p className="ax-kicker">What is Alpha?</p>
        <h2 className="ax-h2">The study tracker you can't just sign up for<i>.</i></h2>
        <p className="ax-lead">
          Alpha is an invite-only study tracker for {exam} and other entrance exams. To get in, a member has to gift you a pass. Otherwise a pass costs {PASS_PRICE_LABEL}.
        </p>
        <div className="ax-film">
          {playing ? (
            <video className="ax-film-media" src={FILM.src} poster={FILM.poster} controls playsInline autoPlay preload="none" width={1920} height={1080}>
              <track kind="captions" src={FILM.captions} srcLang="en" label="English" />
            </video>
          ) : (
            <button type="button" className="ax-film-poster" onClick={() => setPlaying(true)} aria-label="Watch Alpha in 24 seconds">
              <img className="ax-film-media" src={FILM.poster} alt="" width={1920} height={1080} loading="lazy" decoding="async" />
              <span className="ax-film-play" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M8 5.2v13.6L19 12z" fill="currentColor" /></svg>
              </span>
              <span className="ax-film-time" aria-hidden="true">Look inside · 0:24</span>
            </button>
          )}
        </div>
        <ul className="ax-grid">
          {WHAT.map(([t, s]) => (
            <li key={t}><b>{t}</b><span>{s}</span></li>
          ))}
        </ul>
      </section>

      <section className="ax-about-sec">
        <p className="ax-kicker">What your pass gets you</p>
        <ul className="ax-grid ax-grid-3">
          {GETS.map(([t, s]) => (
            <li key={t}><b>{t}</b><span>{s}</span></li>
          ))}
        </ul>
      </section>

      <section className="ax-about-sec">
        <p className="ax-kicker">What happens when you tap</p>
        <ol className="ax-steps">
          {STEPS.map((s, i) => (
            <li key={s}><span className="ax-step-n">{i + 1}</span>{s}</li>
          ))}
        </ol>
        <p className="ax-fine">A pass works once. If someone else opens this link before you, it's theirs.</p>
      </section>
    </div>
  );
};

export default GiftAbout;
