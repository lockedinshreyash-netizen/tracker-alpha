import React from 'react';
import { ExperimentState } from '../insight/observe';
import { MIN_DAYS } from '../insight/confidence';

interface Props {
  experiment: ExperimentState;
  theme: 'dark' | 'light';
  onEnter: () => void;
}

/**
 * The door, on Today. Not the room.
 *
 * Today answers "what do I need to do today", and a longitudinal chart there
 * answers a question nobody asked while a timer is waiting to be started. So
 * this is one line of invitation, and — once the study is running — the day
 * count, because a number that visibly ticks over is the reason to push the
 * door open tomorrow.
 *
 * If anything here ever wants a second row, it belongs on the other side.
 */
const ObservatoryStrip: React.FC<Props> = ({ experiment, theme, onEnter }) => {
  const dark = theme === 'dark';
  const started = experiment.status !== 'unstarted';
  const toGo = Math.max(0, MIN_DAYS - experiment.studyDays);

  return (
    <button
      onClick={onEnter}
      className={`obs ${dark ? 'obs-dark' : ''} w-full text-left group`}
      style={{ borderRadius: 'var(--o-radius)' }}
    >
      <div
        className="flex items-center gap-5 px-6 md:px-8 py-6"
        style={{
          background: 'var(--o-card)',
          border: '1px solid var(--o-line)',
          borderRadius: 'var(--o-radius)',
          boxShadow: 'var(--o-shadow)',
          transition: 'transform 140ms ease',
        }}
      >
        {/* A ring, not a diagram. Once the study is running it shows how close
            the evidence is to being testable; before that it is simply the
            mark of the room. */}
        <Ring
          progress={started ? Math.min(1, experiment.studyDays / MIN_DAYS) : 0}
          value={started ? experiment.dayNumber.toString() : ''}
        />

        <div className="min-w-0 flex-1">
          <p className="o-label mb-1.5">Observatory</p>
          {started ? (
            <>
              <p className="o-title" style={{ fontSize: 17 }}>
                Day {experiment.dayNumber} of your experiment
              </p>
              <p className="o-body mt-1" style={{ fontSize: 13.5 }}>
                {experiment.sessions === 0
                  ? 'Nothing recorded yet'
                  : toGo > 0
                    ? `${experiment.sessions} sessions · ${toGo} more study ${toGo === 1 ? 'day' : 'days'} to a pattern`
                    : `${experiment.sessions} sessions recorded`}
              </p>
            </>
          ) : (
            <>
              <p className="o-title" style={{ fontSize: 17 }}>Study the way you study</p>
              <p className="o-body mt-1" style={{ fontSize: 13.5 }}>
                Find out when you actually work best
              </p>
            </>
          )}
        </div>

        <span
          className="shrink-0 flex items-center justify-center group-hover:opacity-70 transition-opacity"
          style={{
            width: 34, height: 34, borderRadius: 999,
            background: 'var(--o-sunk)', color: 'var(--o-ink-2)',
          }}
          aria-hidden="true"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </div>
    </button>
  );
};

/** A soft progress ring with the day number inside. */
const Ring: React.FC<{ progress: number; value: string }> = ({ progress, value }) => {
  const r = 22;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: 54, height: 54 }}>
      <svg viewBox="0 0 54 54" className="w-full h-full" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={27} cy={27} r={r} fill="none" stroke="var(--o-sunk)" strokeWidth={4} />
        {progress > 0 && (
          <circle
            cx={27} cy={27} r={r} fill="none"
            stroke="var(--o-accent)" strokeWidth={4} strokeLinecap="round"
            strokeDasharray={circ}
            className="o-ring"
            style={{ strokeDashoffset: circ, ['--o-trace-to' as string]: `${circ * (1 - progress)}` }}
          />
        )}
      </svg>
      {value && (
        <span
          className="absolute inset-0 flex items-center justify-center o-num"
          style={{ fontSize: 17 }}
        >
          {value}
        </span>
      )}
      {!value && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--o-accent)' }} />
        </span>
      )}
    </div>
  );
};

export default ObservatoryStrip;
