import React from 'react';

const stats = [
  { value: '100+', label: 'ASPIRANTS TRACKING', sub: 'and growing every day' },
  { value: '5,000+', label: 'HOURS LOGGED', sub: 'by real JEE students' },
  { value: '336', label: 'DAY STREAKS', sub: 'longest active streak' },
  { value: '54+', label: 'CITIES ACROSS INDIA', sub: 'Kota to Kerala and beyond' },
];

const StatsSection = () => (
  <section style={{ position: 'relative', width: '100%', padding: '120px 24px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <p className="font-ui" style={{ fontSize: '11px', fontWeight: 700, color: '#E10600', textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center', marginBottom: '16px' }}>
        THE NUMBERS DON'T LIE
      </p>
      <h2 className="font-display" style={{ fontSize: 'clamp(28px, 4vw, 48px)', color: '#fff', textAlign: 'center', textTransform: 'uppercase', lineHeight: 1, margin: '0 0 64px' }}>
        WHILE YOU HESITATE, THEY GRIND.
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '32px' }}>
        {stats.map((s, i) => (
          <div key={i} style={{ textAlign: 'center', padding: '40px 20px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
            <p className="font-display" style={{ fontSize: '48px', color: '#fff', lineHeight: 1, margin: 0 }}>{s.value}</p>
            <p className="font-ui" style={{ fontSize: '11px', fontWeight: 800, color: '#888', textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: '12px' }}>{s.label}</p>
            <p className="font-ui" style={{ fontSize: '12px', color: '#444', marginTop: '6px' }}>{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default StatsSection;
