/* ── Look inside ──
   The 24-second film of the app (film/src/showcase, built by `npm run
   showcase` in film/), right under the door, so a visitor can see what is in
   the club before asking to join it.

   A facade, like announce/VideoBody.tsx. The pre-rendered HTML is the poster
   and a play button and nothing else: no <video>, so not one byte of the mp4
   is fetched by anyone who does not ask for it. The tap mounts the real
   player with its controls and starts it.

   Hydration contract (see LandingPage.tsx): the first render is the poster on
   the server and in the browser alike, decided by state that starts false.
   Nothing here reads window or storage in render. */

import React, { useCallback, useState } from 'react';

/* Everything the page and the machines say about the film. The length and
   the date are the film's own (film/src/showcase/timeline.ts: 720 frames at
   30 fps); change them when the film changes. */
export const FILM = {
  src: '/showcase/showcase.mp4',
  poster: '/showcase/poster.jpg',
  captions: '/showcase/captions.vtt',
  seconds: 24,
  made: '2026-10-30T00:00:00+05:30',
  name: 'Look inside Tracker Alpha',
  description: 'A 24-second look inside Tracker Alpha: the study timer, the day plan, the syllabus, mock tests, flashcards, notes and the daily streak. The numbers are a demo account’s.',
};

const COPY = {
  label: 'The film',
  title: 'Look',
  em: 'inside.',
  small: 'The whole app in 24 seconds.',
  play: `Play the film, ${FILM.seconds} seconds`,
};

const time = `0:${String(FILM.seconds).padStart(2, '0')}`;

export const Showcase: React.FC = () => {
  const [playing, setPlaying] = useState(false);

  /* The tap is the gesture that allows sound. If the browser still refuses
     (some in-app browsers do), the controls are right there. */
  const start = useCallback((v: HTMLVideoElement | null) => {
    if (v) v.play().catch(() => { /* the controls stay; one more tap plays it */ });
  }, []);

  return (
    <section id="look" className="lp-sec lp-look" aria-labelledby="lp-look-h">
      <div className="lp-look-head rv">
        <p className="lp-label">{COPY.label}</p>
        <h2 id="lp-look-h" className="lp-h2">{COPY.title} <em>{COPY.em}</em></h2>
        <p className="lp-look-small">{COPY.small}</p>
      </div>
      <div className="lp-look-frame rv">
        {playing ? (
          <video
            ref={start}
            className="lp-look-media"
            src={FILM.src}
            poster={FILM.poster}
            controls
            playsInline
            autoPlay
            preload="none"
            width={1920}
            height={1080}
          >
            <track kind="captions" src={FILM.captions} srcLang="en" label="English" />
          </video>
        ) : (
          <button type="button" className="lp-look-poster" onClick={() => setPlaying(true)} aria-label={COPY.play}>
            <img className="lp-look-media" src={FILM.poster} alt="" width={1920} height={1080} loading="lazy" decoding="async" />
            <span className="lp-look-play" aria-hidden="true">
              <svg width="26" height="26" viewBox="0 0 24 24"><path d="M8 5.2v13.6L19 12z" fill="currentColor" /></svg>
            </span>
            <span className="lp-look-time" aria-hidden="true">{time}</span>
          </button>
        )}
      </div>
    </section>
  );
};
