import React, { useState } from 'react';
import HeroSection from './landing/HeroSection';
import StatsSection from './landing/StatsSection';
import FeaturesSection from './landing/FeaturesSection';
import FinalCtaSection from './landing/FinalCtaSection';
import { ExamPreference } from './types';
import { INK, INK_DEEP, MICRO_LABEL, PAGE_X, PAPER, RULE_DARK } from './landing/tokens';

const LandingPage = ({ onCtaClick }: { onCtaClick: () => void }) => {
  const [examPref, setExamPref] = useState<ExamPreference>('JEE');

  const handleCta = () => {
    localStorage.setItem('hasVisited', 'true');
    onCtaClick();
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: PAPER, color: INK, overflowX: 'hidden' }}>
      <HeroSection onCtaClick={handleCta} examPref={examPref} onExamPrefChange={setExamPref} />
      <FeaturesSection />
      <StatsSection />
      <FinalCtaSection onCtaClick={handleCta} examPref={examPref} />

      {/* Footer sits on the same dark ground as the final CTA — one continuous close */}
      <footer
        style={{
          background: INK_DEEP,
          paddingLeft: PAGE_X,
          paddingRight: PAGE_X,
          paddingBottom: '44px',
        }}
      >
        <div style={{ borderTop: `1px solid ${RULE_DARK}`, paddingTop: '28px' }}>
          <p className="font-data" style={{ ...MICRO_LABEL, color: 'rgba(242,240,236,0.32)', margin: 0 }}>
            Tracker Alpha · Lock In HQ · Built for JEE 2027
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
