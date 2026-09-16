import React, { useEffect, useState } from 'react';

interface Props {
  theme: 'dark' | 'light';
  onBegin: () => void;
  onClose: () => void;
  alreadyStarted: boolean;
}

/* What the study measures. Only what is actually implemented — a promise the
   Observatory cannot currently keep would be the first lie the feature tells,
   and it would be told on the opening screen. */
const STEPS: { title: string; body: string }[] = [
  {
    title: 'Alpha watches the clock, not the day',
    body: 'Every session you time gets a real start and end. That is the whole foundation — it is how Alpha can tell a 7am hour from a 10pm one.',
  },
  {
    title: 'Patterns need evidence',
    body: 'Three good mornings is not a morning person. Alpha waits for enough sessions, across enough different days, over enough weeks, before it calls anything a pattern.',
  },
  {
    title: 'You see it building either way',
    body: 'From day one you can see your hours, your days and how close you are. Alpha tells you what it is still waiting for instead of showing you an empty screen.',
  },
];

/**
 * How the Observatory works, in three cards.
 *
 * Short on purpose. The old version was three full-screen plates of editorial
 * typography that a student would swipe past — this is the same content at the
 * length people actually read, and it can be dismissed at any point without
 * losing anything.
 *
 * The middle card is the one that matters: the promise that Alpha will not
 * claim to know something it cannot support is the basis on which anything else
 * here is worth believing, and it is made before the student agrees to start.
 */
const AnalysisIntro: React.FC<Props> = ({ theme, onBegin, onClose, alreadyStarted }) => {
  const dark = theme === 'dark';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={`obs ${dark ? 'obs-dark' : ''} fixed inset-0 z-[60] overflow-y-auto`}
      role="dialog"
      aria-modal="true"
      aria-label="How the Observatory works"
    >
      <div className="min-h-full flex items-center justify-center p-5 md:p-8">
        <div className="w-full max-w-lg py-8">

          <div className="flex items-start justify-between gap-6 mb-8">
            <div>
              <p className="o-label mb-2">Observatory</p>
              <h1 className="o-hero" style={{ fontSize: 'clamp(1.9rem, 7vw, 2.6rem)' }}>
                How this works
              </h1>
            </div>
            <button onClick={onClose} className="o-chip shrink-0" style={{ cursor: 'pointer' }}>
              Close
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {STEPS.map((s, i) => (
              <div
                key={s.title}
                className="o-card o-in"
                style={{ animationDelay: `${80 + i * 90}ms`, padding: 24 }}
              >
                <div className="flex items-start gap-4">
                  <span
                    className="o-num shrink-0 flex items-center justify-center"
                    style={{
                      width: 30, height: 30, borderRadius: 999,
                      background: 'var(--o-accent-soft)', color: 'var(--o-accent)',
                      fontSize: 14,
                    }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h2 className="o-title" style={{ fontSize: 16.5, marginBottom: 6 }}>{s.title}</h2>
                    <p className="o-body" style={{ fontSize: 14.5 }}>{s.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-4">
            <button
              onClick={alreadyStarted ? onClose : onBegin}
              className="o-btn w-full"
              style={{ padding: '17px 30px', fontSize: 15 }}
            >
              {alreadyStarted ? 'Back to the Observatory' : 'Start my experiment'}
            </button>
            {!alreadyStarted && (
              <p className="o-body text-center" style={{ fontSize: 13.5, color: 'var(--o-ink-3)' }}>
                Today becomes day one. Nothing before it is counted.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisIntro;
