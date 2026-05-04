import React, { useState, useEffect } from 'react';

const JEE_MAINS_2027 = new Date('2027-04-01T00:00:00+05:30').getTime();

const HeroSection = ({ onCtaClick }: { onCtaClick: () => void }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const diffMs = Math.max(0, JEE_MAINS_2027 - now);
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Ambient blurred gradient orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-18%', left: '50%', transform: 'translateX(-50%)', width: '900px', height: '600px', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(225,6,0,0.12) 0%, rgba(225,6,0,0.04) 40%, transparent 70%)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', right: '-8%', width: '600px', height: '500px', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(255,140,50,0.06) 0%, transparent 70%)', filter: 'blur(100px)' }} />
        <div style={{ position: 'absolute', bottom: '5%', left: '-5%', width: '500px', height: '450px', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(80,60,200,0.06) 0%, transparent 70%)', filter: 'blur(90px)' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.03, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '200px', mixBlendMode: 'soft-light' as any }} />
      </div>

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 24px', maxWidth: '900px', width: '100%' }}>
        <h1
          className="font-display"
          style={{ fontSize: 'clamp(36px, 7vw, 80px)', color: '#ffffff', textTransform: 'uppercase', lineHeight: 0.95, letterSpacing: '-0.01em', margin: 0 }}
        >
          YOUR COMPETITION IS<br />LOGGING HOURS RIGHT NOW.
        </h1>

        <p className="font-ui" style={{ fontSize: 'clamp(14px, 1.8vw, 18px)', color: '#555555', marginTop: '28px', lineHeight: 1.5, maxWidth: '540px' }}>
          Free JEE study tracker. No fluff. Just hours, subjects, and your streak.
        </p>

        {/* Countdown */}
        <div style={{ marginTop: '48px', display: 'flex', alignItems: 'baseline', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            { value: String(days), label: 'DAYS' },
            { value: pad(hours), label: 'HRS' },
            { value: pad(minutes), label: 'MIN' },
            { value: pad(seconds), label: 'SEC' },
          ].map((item, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px', marginLeft: i > 0 ? '10px' : 0 }}>
              <span className="font-display" style={{ fontSize: 'clamp(32px, 5vw, 48px)', fontVariantNumeric: 'tabular-nums', color: '#555555', lineHeight: 1 }}>{item.value}</span>
              <span className="font-ui" style={{ fontSize: 'clamp(10px, 1.2vw, 13px)', fontWeight: 700, color: '#333333', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{item.label}</span>
            </span>
          ))}
        </div>
        <p className="font-ui" style={{ fontSize: '11px', fontWeight: 700, color: '#333333', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '12px' }}>
          UNTIL JEE MAINS 2027
        </p>

        <button
          id="landing-cta-hero"
          onClick={onCtaClick}
          className="font-ui"
          style={{ marginTop: '52px', padding: '18px 56px', background: '#E10600', color: '#fff', fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', border: 'none', borderRadius: '2px', cursor: 'pointer', transition: 'background 200ms ease' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#c00500')}
          onMouseLeave={e => (e.currentTarget.style.background = '#E10600')}
        >
          START TRACKING FREE
        </button>

        <p className="font-ui" style={{ fontSize: '13px', color: '#555555', marginTop: '24px' }}>
          100+ aspirants already tracking
        </p>

        {/* Scroll indicator */}
        <div style={{ marginTop: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', opacity: 0.3 }}>
          <span className="font-ui" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#555' }}>Scroll</span>
          <div style={{ width: '1px', height: '32px', background: 'linear-gradient(to bottom, #555, transparent)' }} />
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
