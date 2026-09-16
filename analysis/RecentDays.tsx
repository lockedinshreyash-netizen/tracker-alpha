import React, { useMemo } from 'react';
import { DayRow } from '../insight/observe';
import { getISTDateString } from '../utils';

interface Props {
  rows: DayRow[];
  /** How many days to draw. Fewer on a phone. */
  max?: number;
}

const DAY_LETTER = (date: string): string =>
  new Intl.DateTimeFormat('en-GB', { weekday: 'narrow' }).format(new Date(date + 'T12:00:00'));

/**
 * The last couple of weeks, one bar per day.
 *
 * This is the card that makes the study feel like it is running: the row gets
 * longer, and the shape of the student's week — the day they always miss, the
 * weekend they always work — shows up in it before any analysis names it.
 *
 * Days with nothing recorded stay in as flat stubs rather than being dropped. A
 * gap is a fact about consistency, and a chart that quietly closed up its gaps
 * would show an unbroken fortnight to somebody who studied six days out of
 * fourteen.
 */
const RecentDays: React.FC<Props> = ({ rows, max = 14 }) => {
  const shown = useMemo(() => rows.slice(-max), [rows, max]);
  const today = getISTDateString();

  /* Nothing recorded yet — draw a worked example instead of an empty frame, so
     a student on day one can see what this becomes. Fixed and invented, drawn
     in outline, and labelled by the card. It is replaced the moment there is a
     real hour to show. */
  const empty = shown.every(r => r.minutes === 0);
  const EXAMPLE = [140, 0, 95, 180, 120, 0, 210, 160, 75, 190, 130, 0, 165, 200];
  const series = empty
    ? EXAMPLE.map((m, i) => ({ date: `x${i}`, minutes: m, empty: m === 0, buckets: [] as number[] }))
    : shown;

  const peak = useMemo(
    () => Math.max(...series.map(r => r.minutes), 60),
    [series],
  );

  if (shown.length === 0) return null;

  return (
    <div>
      <div
        className={`flex items-end gap-[5px] md:gap-2 ${empty ? 'o-ghost' : ''}`}
        style={{ height: 118 }}
        role="img"
        aria-label={
          empty
            ? 'Example chart. No days recorded yet.'
            : `Hours studied on each of the last ${shown.length} days.`
        }
      >
        {series.map((row, i) => {
          const h = row.minutes > 0 ? Math.max(8, (row.minutes / peak) * 118) : 5;
          /* Today is the highlighted bar, not the biggest one. "Your best day"
             is a trophy nobody asked for, and on a steady week every bar ties
             for it; "where you are right now" is the thing a person actually
             looks for in a row of days. */
          const isToday = !empty && row.date === today;
          return (
            <div key={row.date} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
              {/* Only today carries its figure. Fourteen numbers across the top
                  is a table pretending to be a chart. */}
              {isToday && row.minutes > 0 && h > 30 && (
                <span className="o-num mb-1.5 o-accent" style={{ fontSize: 11.5 }}>
                  {(row.minutes / 60).toFixed(1)}h
                </span>
              )}
              <div
                className={`o-bar w-full ${empty ? 'o-ghost-bar' : ''}`}
                style={{
                  height: h,
                  borderRadius: 9,
                  background: row.minutes > 0
                    ? (isToday ? 'var(--o-accent)' : 'var(--o-bar)')
                    : 'var(--o-sunk)',
                  animationDelay: `${100 + i * 40}ms`,
                }}
              />
            </div>
          );
        })}
      </div>

      <div className={`flex gap-[5px] md:gap-2 mt-3 ${empty ? 'o-ghost' : ''}`}>
        {series.map(row => (
          <div key={row.date} className="flex-1 text-center">
            <span
              className="o-label"
              style={{
                fontSize: 10.5,
                letterSpacing: 0,
                opacity: row.empty ? 0.4 : 1,
                color: row.date === today ? 'var(--o-accent)' : undefined,
              }}
            >
              {empty ? '·' : DAY_LETTER(row.date)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentDays;
