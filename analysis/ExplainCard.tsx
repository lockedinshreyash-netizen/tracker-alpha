import React from 'react';
import { AiInsight, AiPrefs, SleepLog } from '../types';
import { ExperimentState } from '../insight/observe';
import { AI_AVAILABLE, EXPLAIN_MESSAGE, useExplain } from './useExplain';

interface Props {
  experiment: ExperimentState;
  sleepLogs: SleepLog[];
  ai: AiPrefs;
  signedIn: boolean;
  /** Enough recorded that a written note would say something. */
  worth: boolean;
  onToggle: (enabled: boolean) => void;
  onCached: (hash: string, insight: AiInsight) => void;
}

/**
 * The optional written note.
 *
 * Last on the page, and deliberately the least important thing on it. Alpha
 * computes every figure above this card; all this does is put a few of them
 * into sentences. A student who never turns it on loses nothing — which is
 * why it sits at the bottom rather than the top, and why it is a button rather
 * than something that runs on its own.
 *
 * It is also a **button, never a box**. There is nowhere to type. The moment
 * there is somewhere to type this is a chatbot, the cost model collapses, and
 * Alpha stops being a tracker.
 */
const ExplainCard: React.FC<Props> = ({
  experiment, sleepLogs, ai, signedIn, worth, onToggle, onCached,
}) => {
  const { insight, loading, error, explain } = useExplain({
    experiment,
    sleepLogs,
    cache: ai.cache,
    signedIn,
    onCached,
  });

  /* Not deployed in this build — render nothing at all rather than a control
     that cannot work. */
  if (!AI_AVAILABLE) return null;

  if (!ai.enabled) {
    return (
      <section className="o-card o-in" style={{ animationDelay: '580ms' }}>
        <p className="o-label mb-3">Optional</p>
        <h2 className="o-title mb-1.5">Get this written up for you</h2>
        <p className="o-body mb-7" style={{ maxWidth: '52ch' }}>
          Turns the numbers on this page into a few plain sentences. Alpha works out
          everything above on its own — this only puts it into words, when you ask it to.
        </p>

        <div
          className="mb-7"
          style={{ background: 'var(--o-sunk)', borderRadius: 16, padding: '18px 20px' }}
        >
          <p className="o-label mb-3">What gets sent</p>
          <p className="o-body" style={{ fontSize: 14 }}>
            Only the totals and averages you can already see — hours, session counts,
            focus ratings, how close your evidence is.{' '}
            <strong style={{ color: 'var(--o-ink)' }}>
              Never your logs, your notes, your subjects, your name, or any dates.
            </strong>{' '}
            Nothing is sent until you tap the button, and you can turn this off and
            delete everything it wrote at any time.
          </p>
        </div>

        <button onClick={() => onToggle(true)} className="o-btn">Turn this on</button>
      </section>
    );
  }

  return (
    <section className="o-card o-in" style={{ animationDelay: '580ms' }}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <p className="o-label">In words</p>
        <button onClick={() => onToggle(false)} className="o-chip" style={{ cursor: 'pointer' }}>
          Turn off
        </button>
      </div>

      {insight ? (
        <>
          <h2
            className="o-title mb-5"
            style={{ fontSize: 'clamp(1.2rem, 4vw, 1.6rem)', lineHeight: 1.3 }}
          >
            {insight.headline}
          </h2>
          {insight.paragraphs.map((p, i) => (
            <p key={i} className="o-body mb-4" style={{ fontSize: 15.5, maxWidth: '54ch' }}>{p}</p>
          ))}
          {insight.caveat && (
            <p
              className="o-body mt-6"
              style={{ fontSize: 13.5, color: 'var(--o-ink-3)', maxWidth: '52ch' }}
            >
              {insight.caveat}
            </p>
          )}
          <p className="o-body mt-7" style={{ fontSize: 12.5, color: 'var(--o-ink-3)' }}>
            Written by Claude from the figures above. Alpha calculated them; it only
            phrased them.
          </p>
        </>
      ) : (
        <>
          <h2 className="o-title mb-1.5">
            {worth ? 'Ready when you are' : 'Not enough recorded yet'}
          </h2>
          <p className="o-body mb-7" style={{ maxWidth: '52ch' }}>
            {worth
              ? 'One tap turns the figures above into a few sentences. A week that has not changed is free to reopen.'
              : 'A few more timed sessions and there will be something worth writing about. Nothing is sent in the meantime.'}
          </p>
          <button
            onClick={explain}
            disabled={loading || !worth}
            className="o-btn"
            style={{ opacity: loading || !worth ? 0.45 : 1 }}
          >
            {loading ? 'Writing…' : 'Explain my week'}
          </button>
        </>
      )}

      {error && (
        <p className="o-body mt-5" style={{ fontSize: 13.5, color: 'var(--o-ink-2)' }}>
          {EXPLAIN_MESSAGE[error]}
        </p>
      )}
    </section>
  );
};

export default ExplainCard;
