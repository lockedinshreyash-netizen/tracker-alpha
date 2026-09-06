import React from 'react';
import { addDays } from '../utils';
import { formatSpan } from './schedule';

interface Props {
  date: string;
  today: string;
  /** Planned study on this day. Sleep and meals are not a target. */
  studyMins: number;
  theme: 'dark' | 'light';
  onChange: (date: string) => void;
}

/* Noon anchor when turning a date string into a Date for labelling — the same
   dodge getLast7DaysStats uses, so a timezone can never shift the weekday. */
const label = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', opts).format(new Date(date + 'T12:00:00'));

const DateStrip: React.FC<Props> = ({ date, today, studyMins, theme, onChange }) => {
  const dark = theme === 'dark';
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 3));

  return (
    <section>
      <div className="flex items-end justify-between mb-5 gap-4">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-[0.06em] mb-1.5 font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            {date === today ? 'Today' : label(date, { weekday: 'long' })}
          </p>
          <h2 className={`text-2xl md:text-3xl num-stat tracking-tight ${dark ? 'text-white' : 'text-zinc-900'}`}>
            {label(date, { day: 'numeric', month: 'long' })}
          </h2>
          <p className={`text-[10px] font-medium uppercase tracking-[0.06em] mt-1.5 font-ui ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
            {studyMins > 0 ? `${formatSpan(studyMins)} of study planned` : 'No study planned'}
          </p>
        </div>
        {date !== today && (
          <button
            onClick={() => onChange(today)}
            className={`shrink-0 px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.06em] border rounded-md transition-all active:scale-95 font-ui ${
              dark ? 'border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-800'
                   : 'border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
            }`}
          >
            Back to today
          </button>
        )}
      </div>

      <div className="flex items-stretch gap-1.5">
        <button
          onClick={() => onChange(addDays(date, -1))}
          aria-label="Previous day"
          className={`px-3 rounded-md border text-sm transition-all ${
            dark ? 'border-white/[0.06] text-zinc-500 hover:text-white' : 'border-zinc-200 text-zinc-400 hover:text-zinc-900'
          }`}
        >‹</button>

        <div className="flex-1 grid grid-cols-7 gap-1.5">
          {days.map(d => {
            const on = d === date;
            const isToday = d === today;
            return (
              <button
                key={d}
                onClick={() => onChange(d)}
                className={`py-2.5 rounded-md border text-center transition-all active:scale-95 ${
                  on
                    ? 'bg-[#E10600] border-[#E10600] text-white'
                    : dark ? 'border-white/[0.06] text-zinc-500 hover:text-white hover:border-white/20'
                           : 'border-zinc-200 text-zinc-500 hover:text-zinc-900 hover:border-zinc-300'
                }`}
              >
                <div className="text-[9px] font-medium uppercase tracking-[0.06em] opacity-70 font-ui">
                  {label(d, { weekday: 'short' })}
                </div>
                <div className="text-sm num-stat tabular-nums mt-0.5">{Number(d.slice(8))}</div>
                {isToday && !on && <div className="mx-auto mt-1 w-1 h-1 rounded-full bg-[#E10600]" />}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onChange(addDays(date, 1))}
          aria-label="Next day"
          className={`px-3 rounded-md border text-sm transition-all ${
            dark ? 'border-white/[0.06] text-zinc-500 hover:text-white' : 'border-zinc-200 text-zinc-400 hover:text-zinc-900'
          }`}
        >›</button>
      </div>
    </section>
  );
};

export default DateStrip;
