import React from 'react';
import { SleepFindings, SleepMetric, SleepSide } from '../insight/sleep';
import { fmtDuration } from './SleepEntry';

/**
 * The day after a longer night beside the day after a shorter one.
 *
 * Two figures, each drawn as a pair of bars from zero: focus on the fixed 1–5
 * scale the time-of-day finding uses, hours against the larger of the two. A
 * bar earns the accent only when its metric cleared the effect gate — a gap
 * that is still inside normal variation is drawn in the same grey on both
 * rows, and says so in words beside its heading.
 */
const SleepCompare: React.FC<{ findings: SleepFindings }> = ({ findings }) => {
  const { longer, shorter, focus, hours } = findings;
  if (!longer || !shorter || !focus || !hours) return null;

  const hoursScale = Math.max(1, longer.hours, shorter.hours);

  return (
    <div className="flex flex-col gap-7">
      <Metric
        title="Focus the day after"
        metric={focus}
        rows={[
          { side: longer, label: 'After longer nights', value: longer.focus.toFixed(1), share: longer.focus / 5 },
          { side: shorter, label: 'After shorter nights', value: shorter.focus.toFixed(1), share: shorter.focus / 5 },
        ]}
        delay={0}
      />
      <Metric
        title="Study the day after"
        metric={hours}
        rows={[
          { side: longer, label: 'After longer nights', value: `${longer.hours.toFixed(1)}h`, share: longer.hours / hoursScale },
          { side: shorter, label: 'After shorter nights', value: `${shorter.hours.toFixed(1)}h`, share: shorter.hours / hoursScale },
        ]}
        delay={180}
      />
      <p className="o-body" style={{ fontSize: 12.5, color: 'var(--o-ink-3)' }}>
        Longer nights averaged {fmtDuration(longer.sleepMins * 60_000)}, shorter ones{' '}
        {fmtDuration(shorter.sleepMins * 60_000)}, across {longer.nights + shorter.nights} nights
        followed by a timed session. This shows what came after your nights, not what caused it.
      </p>
    </div>
  );
};

interface Row {
  side: SleepSide;
  label: string;
  value: string;
  share: number;
}

const Metric: React.FC<{ title: string; metric: SleepMetric; rows: [Row, Row]; delay: number }> = ({
  title, metric, rows, delay,
}) => {
  const established = metric.confidence === 'established';
  /* Which row is ahead, from the gated difference rather than the printed
     figures, so a rounding tie can never put the accent on the wrong bar. */
  const ahead = metric.diff >= 0 ? 0 : 1;

  return (
    <div className="o-in" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-baseline justify-between gap-4 mb-3.5">
        <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
        {!established && (
          <span className="o-body shrink-0" style={{ fontSize: 13, color: 'var(--o-ink-3)' }}>
            Too close to call
          </span>
        )}
      </div>
      <div className="flex flex-col gap-4">
        {rows.map((r, i) => {
          const accent = established && i === ahead;
          return (
            <div key={r.label}>
              <div className="flex items-baseline justify-between gap-4 mb-2">
                <span style={{ fontSize: 14, fontWeight: accent ? 700 : 500 }}>{r.label}</span>
                <span className="o-num shrink-0" style={{ fontSize: 14, color: accent ? 'var(--o-accent)' : 'var(--o-ink-2)' }}>
                  {r.value}
                </span>
              </div>
              <div className="o-track" style={{ height: accent ? 12 : 9 }}>
                <div
                  className="o-fill o-bar-x"
                  style={{
                    width: `${Math.min(1, Math.max(0, r.share)) * 100}%`,
                    background: accent ? 'var(--o-accent)' : 'var(--o-bar)',
                    animationDelay: `${delay + 120 + i * 90}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * The sleep card's headline once the comparison is drawn.
 *
 * Only a metric that cleared its gate gets a sentence, and the sentence is a
 * report, never advice — "you've studied more after shorter nights" is what
 * happened, and the card under it still says Alpha will never suggest sleeping
 * less to study more.
 */
export const sleepFindingTitle = (f: SleepFindings): string => {
  const focus = f.focus?.confidence === 'established' ? Math.sign(f.focus.diff) : 0;
  const hours = f.hours?.confidence === 'established' ? Math.sign(f.hours.diff) : 0;

  if (focus === 0 && hours === 0) return 'No clear link yet between your sleep and the next day';
  if (focus === hours) {
    return focus > 0
      ? 'After longer nights, you focus better and study more'
      : "After shorter nights, you've focused better and studied more";
  }

  const phrase = (sign: number, longer: string, shorter: string) => (sign > 0 ? longer : shorter);
  const parts = [
    focus !== 0 && phrase(focus, 'you focus better after longer nights', "you've focused better after shorter nights"),
    hours !== 0 && phrase(hours, 'you study more after longer nights', "you've studied more after shorter nights"),
  ].filter(Boolean) as string[];
  const text = parts.join(', and ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export default SleepCompare;
