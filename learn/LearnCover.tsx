/* ── The Learn cover ──
   What a student sees on the Learn tab until they turn it on. One idea, one
   button, a shelf of real cases, three reasons. Every line must stay true of
   the app as it is: nothing here promises bookmarks, notes or the clock until
   the lecture page has them. Short, plain, blunt (the teen-copy rule).

   Turning it on writes one dated decision to AppState and nothing else; the
   library is opened, and its key fetched, only on the screen after this. */

import React from 'react';
import CdCase, { type Finish } from './CdCase';
import type { CoverArt, LearnSubject } from './model';

interface Props {
  dark: boolean;
  signedIn: boolean;
  onEnable: () => void;
}

const SHELF: { code: string; title: string; subject: LearnSubject; art: CoverArt; chapter: string; size: number; done?: boolean }[] = [
  { code: 'PHY-014', title: 'Rotational Motion', subject: 'Physics', art: 'rings', chapter: 'Class 11', size: 168 },
  { code: 'CHE-009', title: 'Chemical Bonding', subject: 'Chemistry', art: 'hex', chapter: 'Class 11', size: 148, done: true },
  { code: 'MAT-008', title: 'Integrals', subject: 'Maths', art: 'curve', chapter: 'Class 12', size: 168 },
  { code: 'PHY-015', title: 'Waves', subject: 'Physics', art: 'waves', chapter: 'Class 11', size: 136 },
  { code: 'BIO-021', title: 'Human Physiology', subject: 'Biology', art: 'orbit', chapter: 'Class 11', size: 148 },
];

export default function LearnCover({ dark, signedIn, onEnable }: Props) {
  const finish: Finish = dark ? 'ink' : 'paper';
  return (
    <div className="lc">
      <section className="lc-hero">
        <span className="lc-kicker">New in Alpha</span>
        <h1 className="lc-title">Learn<span>.</span></h1>
        <p className="lc-dek">Lectures, without the rabbit hole.</p>
        <p className="lc-line">
          Paste a YouTube lecture. It goes on your shelf, filed under its chapter, with its own number.
          No feed. No Shorts. Just the lecture.
        </p>
        <button type="button" className="lc-btn" onClick={onEnable}>Turn on Learn</button>
        {!signedIn && <span className="lc-note">You'll need to be signed in to open your shelf.</span>}
      </section>

      <div className="lc-shelf" aria-hidden="true">
        <div className="lc-shelf-row">
          {SHELF.map(c => (
            <CdCase key={c.code} code={c.code} title={c.title} subject={c.subject} art={c.art} chapter={c.chapter} size={c.size} finish={finish} done={c.done} />
          ))}
        </div>
        <div className="ln-ledge" />
      </div>

      <section className="lc-reasons" aria-label="Why Learn">
        <div className="lc-reason">
          <h2>It knows your syllabus.</h2>
          <p>Every lecture is filed under a real chapter. PHY-014 is Rotational Motion, not video number 73.</p>
        </div>
        <div className="lc-reason">
          <h2>Your shelf stays with you.</h2>
          <p>It lives on this device, locked to your account. Alpha never sees what you watch.</p>
        </div>
        <div className="lc-reason">
          <h2>One lecture at a time.</h2>
          <p>No home page and no Shorts. Shorts and playlists don't go on the shelf.</p>
        </div>
      </section>

      <p className="lc-note">
        Videos play from YouTube, under the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube Terms of Service</a>.
        YouTube sees what you play. <a href="/privacy/">Privacy</a>
      </p>
    </div>
  );
}
