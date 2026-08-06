import React, { useState } from 'react';
import { RaceDay } from './raceDay';
import { clockLabel, describeEvent } from './messages';
import { formatGap } from './engine';

/* ── Today's race, as a story ──
   The standings say where things ended up. This says how they got there —
   which is the part worth coming back for, and the part a bare leaderboard
   throws away every time it re-sorts.

   Read in the order it happened, oldest first, because that is how a day is
   told. Only what this device saw: the board keeps totals, not history. */

interface Props {
  day: RaceDay;
  theme: 'dark' | 'light';
}

const COLLAPSED = 6;

const RaceTimeline: React.FC<Props> = ({ day, theme }) => {
  const [expanded, setExpanded] = useState(false);
  const dark = theme === 'dark';
  const muted = dark ? 'text-zinc-500' : 'text-[#8A8577]';
  const card = dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-[#E3E0D9]';

  const all = day.timeline;
  const shown = expanded ? all : all.slice(-COLLAPSED);

  return (
    <section className={`rounded-xl border p-6 md:p-8 ${card}`}>
      <div className="flex items-baseline justify-between gap-4">
        <h3 className={`text-[9px] font-black uppercase tracking-[0.18em] font-ui ${muted}`}>
          Today’s race
        </h3>
        {all.length > COLLAPSED && (
          <button
            onClick={() => setExpanded(v => !v)}
            className={`text-[9px] font-bold uppercase tracking-[0.1em] font-ui hover:text-[#E10600] transition-colors ${muted}`}
          >
            {expanded ? 'Show less' : `All ${all.length}`}
          </button>
        )}
      </div>

      {!all.length ? (
        <p className={`text-[11px] font-ui mt-5 leading-relaxed ${muted}`}>
          Nothing has happened yet. The race starts moving the moment someone finishes a session —
          including you.
        </p>
      ) : (
        <ol className="mt-6 space-y-0">
          {shown.map((event, i) => {
            const copy = describeEvent(event);
            const last = i === shown.length - 1;
            return (
              <li key={event.id} className="flex gap-4">
                {/* Rail: a dot per moment, joined by a line that stops at the last one. */}
                <div className="flex flex-col items-center flex-shrink-0 pt-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${copy.good ? (dark ? 'bg-zinc-600' : 'bg-[#B5AFA0]') : 'bg-[#E10600]'}`} />
                  {!last && <span className={`w-px flex-1 ${dark ? 'bg-white/[0.08]' : 'bg-[#E3E0D9]'}`} />}
                </div>
                <div className={`min-w-0 flex-1 ${last ? '' : 'pb-5'}`}>
                  <span className={`text-[10px] font-data tabular-nums ${dark ? 'text-zinc-600' : 'text-[#B5AFA0]'}`}>
                    {clockLabel(event.at)}
                  </span>
                  <p className={`text-[12px] font-bold font-ui leading-snug mt-0.5 ${dark ? 'text-white' : 'text-[#17150F]'}`}>
                    <span className="mr-1.5" aria-hidden="true">{copy.icon}</span>
                    {copy.headline}
                  </p>
                  {copy.line && (
                    <p className={`text-[11px] font-ui mt-0.5 ${muted}`}>{copy.line}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {/* The day's shape in four numbers, for anyone who wants the summary
          rather than the story. Only shown once there is something to sum up. */}
      {day.seeded && (day.overtakes > 0 || day.timesPassed > 0 || day.biggestLeadMin > 0 || day.msInFirst > 0) && (
        <dl className={`grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t ${dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]'}`}>
          {[
            ['Best position', day.bestPosition ? `#${day.bestPosition}` : '—'],
            ['Biggest lead', day.biggestLeadMin ? formatGap(day.biggestLeadMin) : '—'],
            ['Biggest comeback', day.biggestComeback ? `${day.biggestComeback} ${day.biggestComeback === 1 ? 'place' : 'places'}` : '—'],
            ['Lead changes', String(day.leadChanges)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className={`text-[8px] font-bold uppercase tracking-[0.12em] font-ui ${muted}`}>{label}</dt>
              <dd className={`text-sm num-stat mt-1 ${dark ? 'text-white' : 'text-[#17150F]'}`}>{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
};

export default RaceTimeline;
