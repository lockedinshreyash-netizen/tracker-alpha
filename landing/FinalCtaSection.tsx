import React, { useState, useEffect } from 'react';

const JEE_MAINS_2027 = new Date('2027-01-01T00:00:00+05:30').getTime();

const FinalCtaSection = ({ onCtaClick }: { onCtaClick: () => void }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const days = Math.floor(Math.max(0, JEE_MAINS_2027 - now) / 86400000);

  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        padding: '140px 24px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        overflow: 'hidden',
      }}
    >
      {/* Intense red glow */}
      <div style={{ position: 'absolute', top: '40%', left: '50%', transform: 'translate(-50%,-50%)', width: '700px', height: '500px', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(225,6,0,0.08) 0%, transparent 60%)', filter: 'blur(80px)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 2 }}>
        <p className="font-ui" style={{ fontSize: '13px', fontWeight: 700, color: '#E10600', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '24px' }}>
          {days} DAYS LEFT
        </p>

        <h2 className="font-display" style={{ fontSize: 'clamp(32px, 5vw, 56px)', color: '#fff', textTransform: 'uppercase', lineHeight: 1, margin: '0 0 24px' }}>
          EVERY DAY YOU DON'T TRACK<br />IS A DAY YOU FALL BEHIND.
        </h2>

        <p className="font-ui" style={{ fontSize: '15px', color: '#555', lineHeight: 1.6, marginBottom: '48px', maxWidth: '480px', marginLeft: 'auto', marginRight: 'auto' }}>
          The toppers aren't smarter — they're more consistent. They track every hour. They know exactly where they stand. They don't guess. They don't hope. They <span style={{ color: '#fff', fontWeight: 700 }}>lock in</span>.
        </p>

        <button
          id="landing-cta-final"
          onClick={onCtaClick}
          className="font-ui"
          style={{ padding: '20px 64px', background: '#E10600', color: '#fff', fontSize: '15px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', border: 'none', borderRadius: '2px', cursor: 'pointer', transition: 'background 200ms ease' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#c00500')}
          onMouseLeave={e => (e.currentTarget.style.background = '#E10600')}
        >
          START TRACKING FREE
        </button>

        <p className="font-ui" style={{ fontSize: '12px', color: '#444', marginTop: '20px' }}>
          Free forever · No credit card · Takes 10 seconds
        </p>

        <div style={{ marginTop: '80px', padding: '32px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
          <p className="font-ui" style={{ fontSize: '13px', color: '#666', lineHeight: 1.7, margin: 0, fontStyle: 'italic' }}>
            "I used to think I was studying for 6 hours daily. Using tracker alpha made me realise it was only 3-4 hours. It's a wakeup call."
          </p>
          <p className="font-ui" style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '16px' }}>
            — Abhiraj, JEE 2027 ASPIRANT
          </p>
        </div>
      </div>
    </section>
  );
};

export default FinalCtaSection;
