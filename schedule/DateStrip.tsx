import React from 'react';
import { addDays } from '../utils';

interface Props {
  date: string;
  today: string;
  theme: 'dark' | 'light';
  onChange: (date: string) => void;
  /** Step by whole days. Separate from onChange so two quick taps on the
      arrows advance two days — computing the next date from the rendered one
      makes both taps in a frame resolve to the same day. */
  onStep: (delta: number) => void;
}

/* Noon anchor when turning a date string into a Date for labelling — the same
   dodge getLast7DaysStats uses, so a timezone can never shift the weekday. */
const label = (date: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', opts).format(new Date(date + 'T12:00:00'));

const DateStrip: React.FC<Props> = ({ date, today, theme, onChange, onStep }) => {
  const dark = theme === 'dark';
  const days = Array.from({ length: 7 }, (_, i) => addDays(date, i - 3));

  return (
    /* The day's name and planned study now live in the tab's page header;
       this is only the week you move through. */
    <section className="mk-rise" style={{ animationDelay: '60ms' }}>
      <div className="flex items-stretch gap-1.5">
        <button
          onClick={() => onStep(-1)}
          aria-label="Previous day"
          className={`px-3 rounded-xl border text-base transition-all active:scale-95 ${
            dark ? 'bg-[#111114] border-white/[0.06] text-zinc-500 hover:text-white' : 'bg-white border-zinc-100 shadow-sm text-zinc-400 hover:text-zinc-900'
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
                aria-current={on ? 'date' : undefined}
                className={`py-2.5 rounded-xl border text-center transition-all active:scale-95 ${
                  on
                    ? dark ? 'bg-white border-white text-black' : 'bg-zinc-900 border-zinc-900 text-white shadow-sm'
                    : dark ? 'bg-[#111114] border-white/[0.06] text-zinc-500 hover:text-white hover:border-white/20'
                           : 'bg-white border-zinc-100 shadow-sm text-zinc-500 hover:text-zinc-900 hover:border-zinc-300'
                }`}
              >
                <div className="text-[10px] font-semibold font-ui opacity-70">
                  {label(d, { weekday: 'short' })}
                </div>
                <div className="text-[17px] num-stat tabular-nums mt-0.5">{Number(d.slice(8))}</div>
                <div className={`mx-auto mt-1 w-1 h-1 rounded-full ${isToday ? 'bg-[#E10600]' : 'bg-transparent'}`} />
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onStep(1)}
          aria-label="Next day"
          className={`px-3 rounded-xl border text-base transition-all active:scale-95 ${
            dark ? 'bg-[#111114] border-white/[0.06] text-zinc-500 hover:text-white' : 'bg-white border-zinc-100 shadow-sm text-zinc-400 hover:text-zinc-900'
          }`}
        >›</button>
      </div>
    </section>
  );
};

export default DateStrip;
