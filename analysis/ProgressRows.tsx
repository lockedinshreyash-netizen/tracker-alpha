import React from 'react';
import { Gate } from '../insight/observe';

/**
 * What the study still needs, as three filling bars.
 *
 * "Alpha needs four more study days before this comparison can be tested" is a
 * true sentence a student reads once and forgets. The same fact as a bar at
 * four sixths is understood instantly — and, more to the point, is understood
 * *again* tomorrow when the bar has visibly moved. A number that advances is
 * the difference between waiting and progress.
 *
 * Every figure is a real count against a real threshold. Nothing here is a
 * percentage invented to make a bar look fuller, and a full bar means the
 * threshold is met, not that a level was reached.
 */
const ProgressRows: React.FC<{ gates: Gate[] }> = ({ gates }) => (
  <div className="flex flex-col gap-6">
    {gates.map((g, i) => {
      const done = g.have >= g.need;
      const pct = Math.min(1, g.need > 0 ? g.have / g.need : 0);
      return (
        <div key={g.label} className="o-in" style={{ animationDelay: `${120 + i * 80}ms` }}>
          <div className="flex items-baseline justify-between gap-4 mb-2.5">
            <span style={{ fontSize: 15, fontWeight: 600 }}>{g.label}</span>
            <span className="o-num shrink-0" style={{ fontSize: 15, color: done ? 'var(--o-accent)' : 'var(--o-ink-2)' }}>
              {g.have}
              <span style={{ color: 'var(--o-ink-3)', fontWeight: 600 }}> / {g.need}</span>
            </span>
          </div>
          <div className="o-track" style={{ height: 10 }}>
            <div
              className="o-fill o-bar-x"
              style={{
                width: `${pct * 100}%`,
                background: done ? 'var(--o-accent)' : 'var(--o-bar)',
                animationDelay: `${180 + i * 80}ms`,
              }}
            />
          </div>
        </div>
      );
    })}
  </div>
);

export default ProgressRows;
