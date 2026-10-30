/* ── trackeralpha.in, for first-time visitors ──
   Rendered to static HTML at build time (landing/prerender.tsx) so search
   engines and AI crawlers — most of which never run JavaScript — read the
   whole page, then hydrated in place by index.tsx. That contract shapes the
   code: the first render must be pure (no window, no storage, no clock except
   landingNow()), and anything that moves on arrival is CSS.

   A members' club, told in very few words: the door (hero), the film (a
   poster until it is tapped; landing/Showcase.tsx), what is inside, the
   crowd, the card, the three ways in, the countdown, a short FAQ, the door
   again. Copy lives in landing/content.ts (the film's own in Showcase.tsx).

   One page per exam. The build renders this once for "/" and once per
   VARIANTS entry (/bitsat-study-tracker/ …), each into its own copy of
   index.html with `data-lp-variant` on #root. The browser hydrates whichever
   it was served by reading that attribute back: the same value the build
   rendered with, so the first render matches.

   The CTA hands App the exam's stream and, when the page is an exam's own page
   or the visitor switched the countdown's year, that exam and year, so
   onboarding opens on BITSAT 2028 rather than asking again.

   Two entries, two handlers: "Request access" (`start`) and "I have an
   invite" / "Sign in" (`invite`). Both lead to the same place today; the
   Gate (access/) decides what happens after. */

import React, { useState } from 'react';
import './landing/landing.css';
import type { Exam, Variant } from './landing/content';
import { ROOT, VARIANTS } from './landing/content';
import { examById, prefOf, type ExamId } from './content/exams';
import { Hero } from './landing/Hero';
import { Showcase } from './landing/Showcase';
import { Card, Clock, Crowd, Faq, Final, Footer, Inside, Nav, Tools, Ways } from './landing/Sections';

/** The page this document was built as. The build passes it; the browser reads it off #root. */
const servedVariant = (): Variant => {
  if (typeof document === 'undefined') return ROOT;
  const id = document.getElementById('root')?.dataset.lpVariant;
  return VARIANTS.find(v => v.id === id) ?? ROOT;
};

/** What the landing page knew about the visitor's exam: the exam, and the year only if they picked one. */
export interface LandingTarget { primary: ExamId; year?: number }

interface Props {
  onCtaClick: (exam: Exam, target?: LandingTarget) => void;
  variant?: Variant;
}

const LandingPage = ({ onCtaClick, variant: given }: Props) => {
  const [variant] = useState<Variant>(() => given ?? servedVariant());
  const [exam, setExam] = useState<ExamId>(variant.exams[0]);
  // Null until the visitor switches it: the default year is onboarding's to work out from their class.
  const [year, setYear] = useState<number | null>(null);

  const start = () => {
    try { localStorage.setItem('hasVisited', 'true'); } catch { /* private mode: they will see this page again */ }
    const target = variant !== ROOT || year !== null ? { primary: exam, ...(year !== null ? { year } : {}) } : undefined;
    onCtaClick(prefOf(examById(exam).streams[0]), target);
  };
  const invite = start;

  return (
    <div className="lp" id="top">
      <Nav onCta={start} onInvite={invite} />
      <main>
        <Hero variant={variant} onCta={start} onInvite={invite} />
        <Showcase />
        <Inside />
        <Tools />
        <Crowd />
        <Card />
        <Ways onCta={start} onInvite={invite} />
        <Clock variant={variant} exam={exam} onExam={setExam} year={year} onYear={setYear} />
        <Faq variant={variant} />
        <Final onCta={start} onInvite={invite} />
      </main>
      <Footer variant={variant} />
    </div>
  );
};

export default LandingPage;
