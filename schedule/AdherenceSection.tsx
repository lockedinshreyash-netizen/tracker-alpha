import React from 'react';
import { DailyLog, DayMinute, ScheduleBlock } from '../types';
import { blockStyle, blockTitle } from './colors';
import { computeAdherence, formatClock, formatSpan } from './schedule';

interface Props {
  blocks: ScheduleBlock[];
  logs: DailyLog[];
  date: string;
  /** Where "now" is on this day, or null once the day is over. */
  minute: DayMinute | null;
  theme: 'dark' | 'light';
}

/**
 * Plan against reality.
 *
 * Self-hiding when no study was planned — a verdict on a day you never planned
 * to study is not accountability, it's noise. Sleep and meals are excluded
 * upstream by `countsAsStudy`; you do not get graded on dinner.
 */
const AdherenceSection: React.FC<Props> = ({ blocks, logs, date, minute, theme }) => {
  const dark = theme === 'dark';
  const a = computeAdherence(blocks, logs, date, minute);
  if (a.plannedMins === 0) return null;

  const live = minute !== null;
  const pct = Math.round(a.adherence * 100);

  const verdict = live
    ? `${formatSpan(a.honouredMins)} done of ${formatSpan(a.plannedMins)} planned. The day isn't over.`
    : pct >= 100 ? 'Plan held. All of it. Do it again tomorrow.'
    : pct >= 70 ? `You planned ${formatSpan(a.plannedMins)}. You did ${formatSpan(a.honouredMins)}. Close isn't done.`
    : pct > 0 ? `You planned ${formatSpan(a.plannedMins)}. You did ${formatSpan(a.honouredMins)}. The plan wasn't the problem.`
    : 'You planned the day and then didn’t show up.';

  const verdictFor = (b: ScheduleBlock) => {
    const o = a.perBlock[b.id];
    if (!o || o.minutes <= 0) return a.pending.some(p => p.id === b.id) ? 'Ahead' : 'Skipped';
    if (o.minutes >= b.durationMins * 0.9) return 'Kept';
    return 'Partial';
  };

  const tone: Record<string, string> = {
    Kept: dark ? 'text-green-400' : 'text-green-600',
    Partial: dark ? 'text-amber-400' : 'text-amber-600',
    Skipped: 'text-[#E10600]',
    Ahead: dark ? 'text-zinc-600' : 'text-zinc-400',
  };

  return (
    <section className={`p-8 md:p-10 rounded-xl border transition-all ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <h3 className={`text-[10px] font-bold uppercase tracking-[0.06em] mb-6 font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
        {live ? 'On the clock' : 'Plan vs actual'}
      </h3>

      <div className="flex justify-between items-end mb-3">
        <p className={`text-2xl md:text-3xl num-stat tracking-tight ${dark ? 'text-white' : 'text-zinc-900'}`}>
          {formatSpan(a.honouredMins)}
          <span className={`text-sm ml-2 font-bold font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            / {formatSpan(a.plannedMins)} planned
          </span>
        </p>
        <p className="text-xl num-stat text-[#E10600]">{pct}%</p>
      </div>

      <div className={`w-full h-3 rounded-full overflow-hidden ${dark ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
        <div className="h-full rounded-full bg-[#E10600] transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
      </div>

      <p className={`text-[10px] font-medium uppercase tracking-[0.06em] mt-4 font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
        {verdict}
      </p>

      <div className="mt-8 space-y-1">
        {blocks.filter(b => a.perBlock[b.id]).map(b => {
          const v = verdictFor(b);
          const c = blockStyle(b);
          const o = a.perBlock[b.id];
          return (
            <div key={b.id} className="flex items-center gap-3 py-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
              <span className={`text-[10px] shrink-0 tabular-nums font-ui w-[68px] ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                {formatClock(b.start)}
              </span>
              <span className={`text-xs truncate flex-1 font-ui ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                {blockTitle(b)}{b.chapter ? ` · ${b.chapter}` : ''}
              </span>
              <span className={`text-[10px] tabular-nums shrink-0 font-ui ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                {formatSpan(Math.min(o.minutes, b.durationMins))}/{formatSpan(b.durationMins)}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-[0.06em] shrink-0 w-16 text-right font-ui ${tone[v]}`}>
                {v}{o.attributed && v !== 'Skipped' && v !== 'Ahead' ? ' ✓' : ''}
              </span>
            </div>
          );
        })}
      </div>

      {a.offPlanMins > 0 && (
        <p className={`text-[10px] font-medium uppercase tracking-[0.06em] mt-6 font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {formatSpan(a.offPlanMins)} off-plan — studied, but not against anything you scheduled.
        </p>
      )}

      {/* Say what this actually knows. A log carries hours and a subject and no
          start time, so only a session launched from a block is measured
          against it; everything else here is an allocation. */}
      <p className={`text-[10px] mt-5 leading-relaxed font-ui ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
        {a.hasInferred
          ? 'A ✓ means the clock was started on that block. The rest is matched by subject and hours, earliest block first — a log carries no start time. Hit Engage and it stops being a guess.'
          : 'Every block here was measured — the clock was started on it.'}
      </p>
    </section>
  );
};

export default AdherenceSection;
