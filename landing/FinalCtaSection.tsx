import React, { useState, useEffect } from 'react';
import { JEE_2027_DATE, NEET_2027_DATE } from '../constants';
import { ExamPreference } from '../types';
import { ACCENT, INK_DEEP, MICRO_LABEL, PAGE_X, PAPER, RULE_DARK, TYPE } from './tokens';

interface Props {
  onCtaClick: () => void;
  examPref: ExamPreference;
}

const FinalCtaSection: React.FC<Props> = ({ onCtaClick, examPref }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const targetDate = examPref === 'NEET' ? NEET_2027_DATE : JEE_2027_DATE;
  const days = Math.floor(Math.max(0, targetDate.getTime() - now) / 86400000);

  return (
    <section
      style={{
        background: INK_DEEP,
        color: PAPER,
        paddingLeft: PAGE_X,
        paddingRight: PAGE_X,
        paddingTop: 'clamp(96px, 16vh, 190px)',
        paddingBottom: 'clamp(80px, 12vh, 150px)',
      }}
    >
      <p className="font-data" style={{ ...MICRO_LABEL, color: ACCENT, marginBottom: 'clamp(28px, 4vh, 48px)' }}>
        [ {days} days remain ]
      </p>

      <h2
        className="font-display"
        style={{
          fontSize: TYPE.displayL,
          lineHeight: 0.94,
          letterSpacing: '-0.035em',
          color: PAPER,
          margin: 0,
          maxWidth: '14ch',
          textTransform: 'uppercase',
        }}
      >
        Every day you don't track is a day you{' '}
        <span className="font-accent" style={{ textTransform: 'none', letterSpacing: '-0.01em' }}>
          fall behind.
        </span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-8 items-end" style={{ marginTop: 'clamp(52px, 8vh, 92px)' }}>
        <div className="md:col-span-7">
          <p
            className="font-ui"
            style={{ fontSize: TYPE.body, color: 'rgba(242,240,236,0.62)', lineHeight: 1.6, margin: 0, maxWidth: '46ch' }}
          >
            The toppers aren't smarter — they're more consistent. They track every hour. They know exactly where they
            stand. They don't guess. They don't hope. They{' '}
            <span style={{ color: PAPER, fontWeight: 700 }}>lock in</span>.
          </p>

          <div className="flex flex-wrap items-center gap-5 mt-9">
            <button
              id="landing-cta-final"
              onClick={onCtaClick}
              className="font-data"
              style={{
                ...MICRO_LABEL,
                padding: '18px 44px',
                background: ACCENT,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '2px',
                cursor: 'pointer',
                transition: 'background 180ms ease',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#B80500')}
              onMouseLeave={e => (e.currentTarget.style.background = ACCENT)}
            >
              Start tracking free
            </button>
            <span className="font-data" style={{ fontSize: '12px', color: 'rgba(242,240,236,0.38)' }}>
              Free forever · No card · 10 seconds
            </span>
          </div>
        </div>

        {/* Pull quote — the serif does the emotional work here */}
        <figure className="md:col-span-5" style={{ margin: 0, borderTop: `1px solid ${RULE_DARK}`, paddingTop: '24px' }}>
          <blockquote
            className="font-accent"
            style={{ fontSize: 'clamp(17px, 1.7vw, 21px)', lineHeight: 1.5, color: PAPER, margin: 0 }}
          >
            "I thought I was studying 6 hours a day. It was 3. That was the wakeup call."
          </blockquote>
          <figcaption className="font-data" style={{ ...MICRO_LABEL, color: 'rgba(242,240,236,0.38)', marginTop: '18px' }}>
            Abhiraj — JEE 2027 aspirant
          </figcaption>
        </figure>
      </div>
    </section>
  );
};

export default FinalCtaSection;
