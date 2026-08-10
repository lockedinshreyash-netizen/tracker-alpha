import React, { useMemo, useState } from 'react';
import { getISTDateString } from '../utils';
import { loadPreviousRaceDay } from './raceDay';
import { summariseRaceDay, RecapTone } from './recap';

interface Props {
  theme: 'dark' | 'light';
}

const TONE: Record<RecapTone, string> = {
  good: 'text-green-500',
  bad: 'text-[#E10600]',
  neutral: 'text-zinc-400',
};

/**
 * Yesterday's race, summarised for the person reading it.
 *
 * Renders nothing at all when there is no completed day on this device — a
 * first-time user, or someone who never got onto the board. An empty state
 * here would just be a box explaining an absence.
 *
 * Dismissible, because a recap is news: once read, it should stop taking up
 * the top of the tab for the rest of the day.
 */
const RaceRecap: React.FC<Props> = ({ theme }) => {
  const today = getISTDateString();
  const recap = useMemo(() => {
    const prev = loadPreviousRaceDay(today);
    return prev ? summariseRaceDay(prev, today) : null;
  }, [today]);

  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('race_recap_seen') === recap?.date; } catch { return false; }
  });

  if (!recap || dismissed) return null;

  const dark = theme === 'dark';

  const dismiss = () => {
    try { localStorage.setItem('race_recap_seen', recap.date); } catch { /* ignore */ }
    setDismissed(true);
  };

  return (
    <section className={`rounded-xl border overflow-hidden ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <div className={`px-6 pt-5 pb-5 ${dark ? 'bg-[#E10600]/[0.05]' : 'bg-red-50/60'}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#E10600] font-ui">
            {recap.when}’s race
          </p>
          <button
            onClick={dismiss}
            className={`text-[9px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded border transition-colors active:scale-97 shrink-0 ${dark ? 'border-white/[0.12] text-zinc-500 hover:text-zinc-300' : 'border-zinc-300 text-zinc-500 hover:text-zinc-700'}`}
          >
            Dismiss
          </button>
        </div>

        <h3 className={`text-lg md:text-xl font-black uppercase leading-tight tracking-tight mb-2 ${recap.tone === 'good' ? 'text-green-500' : recap.tone === 'bad' ? 'text-[#E10600]' : dark ? 'text-white' : 'text-black'}`}>
          {recap.headline}
        </h3>
        <p className={`text-[12px] leading-relaxed font-ui ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>
          {recap.verdict}
        </p>
      </div>

      {/* Dividers are drawn per cell rather than by a gap over a coloured
          parent. The number of stats varies, so the last row is often short,
          and a coloured parent shows through those empty cells as a stray
          block of the wrong shade. */}
      <div className="grid grid-cols-2 md:grid-cols-3">
        {recap.lines.map((line) => (
          <div
            key={line.label}
            className={`px-4 py-3.5 border-t ${dark ? 'border-white/[0.06]' : 'border-zinc-100'} border-r last:border-r-0`}
          >
            <p className="text-[8px] font-bold uppercase tracking-[0.1em] text-zinc-600 mb-1 font-ui">
              {line.label}
            </p>
            <p className={`text-sm font-black tabular-nums ${TONE[line.tone]}`}>{line.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default RaceRecap;
