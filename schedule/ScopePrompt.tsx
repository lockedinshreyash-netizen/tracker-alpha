import React, { useState } from 'react';
import { formatRange } from './schedule';

interface Props {
  /** What was moved — "Maths", "Coaching". */
  title: string;
  /** What the rule repeats on, spelled out: "every day", "Mon · Wed · Fri". */
  seriesLabel: string;
  /** The day being viewed, written out: "Monday 7 September". */
  dayLabel: string;
  start: number;
  durationMins: number;
  theme: 'dark' | 'light';
  /** Ticked → the rule moves; unticked → an override for this date only. */
  onConfirm: (everyDay: boolean) => void;
  onCancel: () => void;
}

/**
 * Which one did you mean.
 *
 * A repeating block on the grid is two things at once — this Tuesday, and every
 * Tuesday — and dragging it is ambiguous between them. The app used to answer
 * silently, always "this day only", so a student who built a repeating skeleton
 * and then tidied it by dragging saw a perfect today and a shredded tomorrow:
 * every block back at the time it had before the drag, overlapping everything
 * it had been dragged clear of.
 *
 * One tick box rather than two rival buttons: the question has a right answer
 * most of the time — you dragged the block a repeat puts there, so you meant
 * the repeat — and a default the user can see and undo beats making them re-read
 * two options on every nudge. It starts ticked for that reason. Unticking it is
 * the "just this once" case, which is the rarer one.
 */
const ScopePrompt: React.FC<Props> = ({
  title, seriesLabel, dayLabel, start, durationMins, theme, onConfirm, onCancel,
}) => {
  const dark = theme === 'dark';
  const [everyDay, setEveryDay] = useState(true);

  return (
    <div className="fixed inset-0 z-[130] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onCancel} />
      <div
        className={`relative w-full md:w-[400px] md:rounded-xl rounded-t-2xl border p-7 md:p-8 ${
          dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-xl'
        }`}
      >
        <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {title} repeats
        </p>
        <p className={`text-lg num-stat mt-1 tabular-nums ${dark ? 'text-white' : 'text-zinc-900'}`}>
          {formatRange(start, durationMins)}
        </p>

        <button
          role="checkbox"
          aria-checked={everyDay}
          onClick={() => setEveryDay(v => !v)}
          className={`w-full mt-6 flex items-start gap-3 p-4 rounded-lg border text-left transition-all active:scale-[0.99] ${
            everyDay
              ? 'border-[#E10600] bg-[#E10600]/[0.06]'
              : dark ? 'border-white/[0.08] hover:border-white/20' : 'border-zinc-200 hover:border-zinc-300'
          }`}
        >
          <span
            aria-hidden="true"
            className={`shrink-0 mt-[1px] w-4 h-4 rounded-[4px] border flex items-center justify-center text-[10px] leading-none transition-all ${
              everyDay
                ? 'bg-[#E10600] border-[#E10600] text-white'
                : dark ? 'border-zinc-600' : 'border-zinc-300'
            }`}
          >
            {everyDay ? '✓' : ''}
          </span>
          <span className="min-w-0">
            <span className={`block text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-white' : 'text-zinc-900'}`}>
              Move {seriesLabel}?
            </span>
            <span className={`block text-[10px] font-medium uppercase tracking-[0.06em] mt-1 font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
              {everyDay
                ? 'Every time it comes back moves with it.'
                : `Only ${dayLabel} moves. It comes back at the old time.`}
            </span>
          </span>
        </button>

        <button
          onClick={() => onConfirm(everyDay)}
          className="w-full mt-4 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white rounded-md hover:bg-red-700 transition-all active:scale-95 font-ui"
        >
          Move it
        </button>

        <button
          onClick={onCancel}
          className={`w-full mt-4 text-[10px] font-medium uppercase tracking-[0.06em] font-ui transition-colors ${
            dark ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'
          }`}
        >
          Put it back
        </button>
      </div>
    </div>
  );
};

export default ScopePrompt;
