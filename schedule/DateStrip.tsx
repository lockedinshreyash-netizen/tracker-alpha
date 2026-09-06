import React from 'react';
import { addDays } from '../utils';
import { formatSpan } from './schedule';

interface Props {
  date: string;
  today: string;
  plannedMins: number;
  theme: 'dark' | 'light';
  onChange: (date: string) => void;
}

/* Noon anchor when turning a date string into a Date for labelling — the same
   dodge getLast7DaysStats uses, so a timezone can never shift the weekday. */
const label = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', opts).format(new Date(date + 'T12:00:00'));

const DateStrip: React.FC<Props> = ({ date, today, plannedMins, theme, onChange }) => {
  const dark = theme === 'dark';
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 3));

  return (
    <div>
      <div className="flex items-end justify-between mb-4 gap-4">
        <div>
          <h2 className={`font-display text-2xl md:text-3xl uppercase ${dark ? 'text-white' : 'text-[#17150F]'}`}>
            {date === today ? 'TODAY' : label(date, { weekday: 'long' })}
          </h2>
          <p className={`font-ui text-[11px] mt-1 ${dark ? 'text-white/40' : 'text-black/45'}`}>
            {label(date, { day: 'numeric', month: 'long' })} · {plannedMins > 0 ? `${formatSpan(plannedMins)} PLANNED` : 'NOTHING SCHEDULED'}
          </p>
        </div>
        {date !== today && (
          <button
            onClick={() => onChange(today)}
            className={`shrink-0 font-ui text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md border ${
              dark ? 'border-white/[0.1] text-white/60 hover:text-white' : 'border-[#E3E0D9] text-black/50 hover:text-black'
            }`}
          >
            BACK TO TODAY
          </button>
        )}
      </div>

      <div className="flex items-stretch gap-1.5">
        <button
          onClick={() => onChange(addDays(date, -1))}
          aria-label="Previous day"
          className={`px-2.5 rounded-md border font-ui text-xs ${dark ? 'border-white/[0.06] text-white/40 hover:text-white' : 'border-[#E3E0D9] text-black/40 hover:text-black'}`}
        >‹</button>

        <div className="flex-1 grid grid-cols-7 gap-1.5">
          {days.map(d => {
            const on = d === date;
            const isToday = d === today;
            return (
              <button
                key={d}
                onClick={() => onChange(d)}
                className={`py-2 rounded-md border text-center transition-colors ${
                  on ? 'bg-[#E10600] border-[#E10600] text-white'
                    : dark ? 'border-white/[0.06] text-white/50 hover:text-white/90' : 'border-[#E3E0D9] text-black/50 hover:text-black/90'
                }`}
              >
                <div className="font-ui text-[9px] uppercase tracking-wider opacity-70">{label(d, { weekday: 'short' })}</div>
                <div className="font-ui text-sm font-bold tabular-nums">{d.slice(8)}</div>
                {isToday && !on && <div className="mx-auto mt-0.5 w-1 h-1 rounded-full bg-[#E10600]" />}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onChange(addDays(date, 1))}
          aria-label="Next day"
          className={`px-2.5 rounded-md border font-ui text-xs ${dark ? 'border-white/[0.06] text-white/40 hover:text-white' : 'border-[#E3E0D9] text-black/40 hover:text-black'}`}
        >›</button>
      </div>
    </div>
  );
};

export default DateStrip;
