import React from 'react';
import { INK, INK_FAINT, INK_MUTED, MICRO_LABEL, PAGE_X, RULE, TYPE } from './tokens';

const features = [
  {
    title: 'Live session timer',
    desc: 'Every second counts. Track exactly how long you study each subject — no rounding, no guessing. Your competitors are timing themselves. Are you?',
  },
  {
    title: 'Streak system',
    desc: "Miss a day and it resets to zero. Our top users haven't broken their streak in over 30 days. One skip and you're behind all of them.",
  },
  {
    title: 'Subject breakdown',
    desc: "See exactly where your hours go — Physics, Chemistry, Maths. Most students don't realize they're neglecting one subject until it's too late.",
  },
  {
    title: 'Syllabus tracker',
    desc: 'Mark chapters as in-progress, completed, or revision-pending. Know what is left before March decides it for you.',
  },
  {
    title: 'Lock-in mode',
    desc: 'Forces fullscreen. Detects tab switches. Logs distractions. Every breach is recorded. This is the one people are scared of.',
  },
  {
    title: 'Cloud sync',
    desc: 'Phone, laptop, tablet — your data follows you everywhere. Switch devices mid-session. Never lose a single hour of logged progress.',
  },
];

const FeaturesSection = () => (
  <section style={{ paddingLeft: PAGE_X, paddingRight: PAGE_X, paddingTop: 'clamp(88px, 14vh, 168px)', paddingBottom: 'clamp(64px, 10vh, 120px)' }}>
    {/* Section head — label left, headline hanging off the same axis */}
    <p className="font-data" style={{ ...MICRO_LABEL, color: INK_FAINT, marginBottom: 'clamp(24px, 4vh, 44px)' }}>
      [ What you get ]
    </p>

    <h2
      className="font-display"
      style={{
        fontSize: TYPE.displayM,
        lineHeight: 0.98,
        letterSpacing: '-0.03em',
        color: INK,
        margin: 0,
        maxWidth: '18ch',
        textTransform: 'uppercase',
      }}
    >
      Every tool they're using.{' '}
      <span className="font-accent" style={{ textTransform: 'none', letterSpacing: '-0.01em' }}>
        You're not.
      </span>
    </h2>

    {/* Index list — hairline rows, not a card grid */}
    <div style={{ marginTop: 'clamp(48px, 8vh, 88px)', borderTop: `1px solid ${RULE}` }}>
      {features.map((f, i) => (
        <div
          key={f.title}
          className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-8 group"
          style={{ borderBottom: `1px solid ${RULE}`, paddingTop: '26px', paddingBottom: '26px' }}
        >
          <span
            className="font-data md:col-span-1"
            style={{ ...MICRO_LABEL, color: INK_FAINT, paddingTop: '4px' }}
          >
            {String(i + 1).padStart(2, '0')}
          </span>

          <h3
            className="font-ui md:col-span-4"
            style={{
              fontSize: 'clamp(17px, 1.7vw, 21px)',
              fontWeight: 800,
              letterSpacing: '-0.015em',
              color: INK,
              margin: 0,
            }}
          >
            {f.title}
          </h3>

          <p
            className="font-ui md:col-span-7"
            style={{ fontSize: TYPE.body, color: INK_MUTED, lineHeight: 1.55, margin: 0, maxWidth: '58ch' }}
          >
            {f.desc}
          </p>
        </div>
      ))}
    </div>
  </section>
);

export default FeaturesSection;
