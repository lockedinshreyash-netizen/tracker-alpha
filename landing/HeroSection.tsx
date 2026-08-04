import React, { useState, useEffect } from 'react';
import { JEE_2027_DATE, NEET_2027_DATE } from '../constants';
import { ExamPreference } from '../types';
import { ACCENT, INK, INK_FAINT, INK_MUTED, MICRO_LABEL, PAGE_X, PAPER, RULE, TYPE } from './tokens';

interface Props {
  onCtaClick: () => void;
  examPref: ExamPreference;
  onExamPrefChange: (p: ExamPreference) => void;
}

const HeroSection: React.FC<Props> = ({ onCtaClick, examPref, onExamPrefChange }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const targetDate = examPref === 'NEET' ? NEET_2027_DATE : JEE_2027_DATE;
  const diffMs = Math.max(0, targetDate.getTime() - now);
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');

  const examLabel = examPref === 'NEET' ? 'NEET 2027' : 'JEE MAINS 2027';

  return (
    <section
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingLeft: PAGE_X, paddingRight: PAGE_X }}
    >
      {/* ── Top bar: wordmark + exam switch ── */}
      <div className="flex items-center justify-between gap-6 pt-7 pb-2">
        <span className="logo-text" style={{ fontSize: '15px', color: INK, letterSpacing: '0.06em' }}>
          LOCK IN
        </span>

        <div className="flex items-center" style={{ border: `1px solid ${RULE}`, borderRadius: '999px', padding: '3px' }}>
          {(['JEE', 'NEET'] as const).map(e => (
            <button
              key={e}
              type="button"
              onClick={() => onExamPrefChange(e)}
              className="font-data"
              style={{
                ...MICRO_LABEL,
                padding: '6px 16px',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                background: examPref === e ? INK : 'transparent',
                color: examPref === e ? PAPER : INK_MUTED,
                transition: 'background 180ms ease, color 180ms ease',
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* ── Headline — left axis, tight leading, deliberately large ── */}
      <div style={{ marginTop: 'clamp(56px, 11vh, 132px)' }}>
        <p className="font-data" style={{ ...MICRO_LABEL, color: INK_FAINT, marginBottom: 'clamp(20px, 3vh, 34px)' }}>
          [ FREE {examPref} TRACKER — NO FLUFF ]
        </p>
        <h1
          className="font-display"
          style={{
            fontSize: TYPE.displayL,
            lineHeight: 0.94,
            letterSpacing: '-0.035em',
            color: INK,
            margin: 0,
            maxWidth: '15ch',
            textTransform: 'uppercase',
          }}
        >
          Your competition is logging hours{' '}
          <span className="font-accent" style={{ textTransform: 'none', letterSpacing: '-0.01em' }}>
            right now.
          </span>
        </h1>
      </div>

      {/* ── Rule ── */}
      <div style={{ height: '1px', background: RULE, marginTop: 'clamp(44px, 7vh, 84px)' }} />

      {/* ── Bottom: the countdown as graphic element, copy + CTA opposite ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-end flex-1 pt-8 md:pt-10 pb-14">
        {/* Countdown */}
        <div>
          <div className="flex items-baseline gap-3" style={{ whiteSpace: 'nowrap' }}>
            <span
              className="font-display"
              style={{
                fontSize: TYPE.displayXL,
                lineHeight: 0.8,
                letterSpacing: '-0.05em',
                color: INK,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {days}
            </span>
            <span className="font-data" style={{ ...MICRO_LABEL, color: ACCENT }}>
              Days
            </span>
          </div>
          <p className="font-data" style={{ ...MICRO_LABEL, color: INK_MUTED, marginTop: '18px' }}>
            Until {examLabel}
          </p>
          <p
            className="font-data"
            style={{ fontSize: '12px', color: INK_FAINT, marginTop: '6px', fontVariantNumeric: 'tabular-nums' }}
          >
            {pad(hours)}:{pad(minutes)}:{pad(seconds)} left today
          </p>
        </div>

        {/* Copy + CTA */}
        <div className="md:pb-2">
          <p className="font-ui" style={{ fontSize: TYPE.body, color: INK_MUTED, lineHeight: 1.55, maxWidth: '34ch', margin: 0 }}>
            Track every hour, every subject, every chapter. See exactly where you stand — not where you think you stand.
          </p>

          <div className="flex flex-wrap items-center gap-5 mt-8">
            <button
              id="landing-cta-hero"
              onClick={onCtaClick}
              className="font-data"
              style={{
                ...MICRO_LABEL,
                padding: '17px 40px',
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
            <span className="font-data" style={{ fontSize: '12px', color: INK_FAINT }}>
              1,500+ aspirants tracking
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
