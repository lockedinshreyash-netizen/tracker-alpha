/* ── trackeralpha.in, for first-time visitors ──
   Rendered to static HTML at build time (landing/prerender.tsx) so search
   engines and AI crawlers — most of which never run JavaScript — read the
   whole page, then hydrated in place by index.tsx. That contract shapes the
   code: the first render must be pure (no window, no storage, no clock except
   landingNow()), and anything that moves on arrival is CSS.

   Order is the argument: the promise (hero), the problem (you are guessing),
   the tools, how to start, the price, the comparison, the questions, the
   close. Copy lives in landing/content.ts. */

import React, { useState } from 'react';
import './landing/landing.css';
import type { Exam } from './landing/content';
import { Hero } from './landing/Hero';
import { Compare, Faq, Features, Final, Footer, Manifesto, Nav, Price, Ribbon, Steps } from './landing/Sections';

const LandingPage = ({ onCtaClick }: { onCtaClick: () => void }) => {
  const [exam, setExam] = useState<Exam>('JEE');

  const start = () => {
    try { localStorage.setItem('hasVisited', 'true'); } catch { /* private mode: they will see this page again */ }
    onCtaClick();
  };

  return (
    <div className="lp" id="top">
      <Nav onCta={start} />
      <main>
        <Hero exam={exam} onExam={setExam} onCta={start} />
        <Ribbon />
        <Manifesto />
        <Features exam={exam} />
        <Steps onCta={start} />
        <Price onCta={start} />
        <Compare />
        <Faq />
        <Final exam={exam} onCta={start} />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
