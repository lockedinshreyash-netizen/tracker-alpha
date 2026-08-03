
import React from 'react';
import HeroSection from './landing/HeroSection';
import StatsSection from './landing/StatsSection';
import FeaturesSection from './landing/FeaturesSection';
import FinalCtaSection from './landing/FinalCtaSection';

const LandingPage = ({ onCtaClick }: { onCtaClick: () => void }) => {
  const handleCta = () => {
    localStorage.setItem('hasVisited', 'true');
    onCtaClick();
  };

  return (
    <div
      style={{
        width: '100%',
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#ffffff',
        overflowX: 'hidden',
      }}
    >
      {/* Top-left wordmark — fixed */}
      <div
        className="logo-text"
        style={{
          position: 'fixed',
          top: '28px',
          left: '32px',
          fontSize: '20px',
          color: '#ffffff',
          letterSpacing: '0.04em',
          zIndex: 100,
          mixBlendMode: 'difference',
        }}
      >
        LOCK IN
      </div>

      <HeroSection onCtaClick={handleCta} />
      <StatsSection />
      <FeaturesSection />
      <FinalCtaSection onCtaClick={handleCta} />

      {/* Minimal footer */}
      <footer style={{ padding: '40px 24px', borderTop: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
        <p className="font-ui" style={{ fontSize: '11px', color: '#333', margin: 0 }}>
          TRACKER ALPHA · LOCK IN HQ · BUILT FOR JEE 2027
        </p>
      </footer>
    </div>
  );
};

export default LandingPage;
