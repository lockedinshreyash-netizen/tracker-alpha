import React from 'react';

const features = [
  {
    icon: '⏱',
    title: 'LIVE SESSION TIMER',
    desc: 'Every second counts. Track exactly how long you study each subject — no rounding, no guessing. Your competitors are timing themselves. Are you?',
    tag: 'MOST USED',
  },
  {
    icon: '🔥',
    title: 'STREAK SYSTEM',
    desc: "Miss a day and it resets to zero. 73% of our top users haven't broken their streak in over 30 days. One skip and you're behind all of them.",
    tag: 'ADDICTIVE',
  },
  {
    icon: '📊',
    title: 'SUBJECT BREAKDOWN',
    desc: "See exactly where your hours go — Physics, Chemistry, Maths. Most students don't realize they're neglecting one subject until it's too late.",
    tag: 'EYE-OPENING',
  },
  {
    icon: '📋',
    title: 'SYLLABUS TRACKER',
    desc: 'Mark chapters as in-progress, completed, or revision-pending. Students who track their syllabus finish 2x faster. The rest panic in March.',
    tag: 'ESSENTIAL',
  },
  {
    icon: '🔒',
    title: 'LOCK-IN MODE',
    desc: 'Forces fullscreen. Detects tab switches. Logs distractions. Every breach is recorded. The students using this are building monk-level discipline.',
    tag: 'HARDCORE',
  },
  {
    icon: '☁️',
    title: 'CLOUD SYNC',
    desc: 'Phone, laptop, tablet — your data follows you everywhere. Switch devices mid-session. Never lose a single hour of logged progress.',
    tag: 'SEAMLESS',
  },
];

const FeaturesSection = () => (
  <section style={{ position: 'relative', width: '100%', padding: '120px 24px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
    {/* Subtle red glow behind section */}
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '800px', height: '600px', borderRadius: '50%', background: 'radial-gradient(ellipse at center, rgba(225,6,0,0.04) 0%, transparent 60%)', filter: 'blur(100px)', pointerEvents: 'none' }} />

    <div style={{ maxWidth: '1000px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
      <p className="font-ui" style={{ fontSize: '11px', fontWeight: 700, color: '#E10600', textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center', marginBottom: '16px' }}>
        WHAT YOU GET
      </p>
      <h2 className="font-display" style={{ fontSize: 'clamp(28px, 4vw, 48px)', color: '#fff', textAlign: 'center', textTransform: 'uppercase', lineHeight: 1, margin: '0 0 20px' }}>
        EVERY TOOL THEY'RE USING.<br />YOU'RE NOT.
      </h2>
      <p className="font-ui" style={{ fontSize: '15px', color: '#555', textAlign: 'center', marginBottom: '64px', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
        Built by JEE aspirants who got tired of spreadsheets. Everything you need. Nothing you don't.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        {features.map((f, i) => (
          <div
            key={i}
            style={{
              padding: '32px 28px',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.02)',
              transition: 'border-color 200ms ease, background 200ms ease',
              cursor: 'default',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(225,6,0,0.2)'; e.currentTarget.style.background = 'rgba(225,6,0,0.03)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <span style={{ fontSize: '24px' }}>{f.icon}</span>
              <span className="font-ui" style={{ fontSize: '9px', fontWeight: 800, color: '#E10600', textTransform: 'uppercase', letterSpacing: '0.12em', padding: '3px 8px', border: '1px solid rgba(225,6,0,0.2)', borderRadius: '2px' }}>{f.tag}</span>
            </div>
            <h3 className="font-ui" style={{ fontSize: '14px', fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 10px' }}>{f.title}</h3>
            <p className="font-ui" style={{ fontSize: '13px', color: '#666', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default FeaturesSection;
