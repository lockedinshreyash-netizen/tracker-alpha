import React from 'react';
import { DailyLog, DayMinute, ScheduleBlock } from '../types';
import { subjectStyle } from './colors';
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
 * Self-hiding when there was no plan — a verdict on a day you never planned
 * is not accountability, it's noise.
 */
const AdherenceSection: React.FC<Props> = ({ blocks, logs, date, minute, theme }) => {
  const dark = theme === 'dark';
  const a = computeAdherence(blocks, logs, date, minute);
  if (a.plannedMins === 0) return null;

  const live = minute !== null;
  const pct = Math.round(a.adherence * 100);
  const card = `p-8 md:p-10 rounded-xl border ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-[#E3E0D9]'}`;

  const verdict = live
    ? `${formatSpan(a.honouredMins)} DONE OF ${formatSpan(a.plannedMins)} PLANNED. THE DAY ISN'T OVER.`
    : pct >= 100 ? 'PLAN HELD. ALL OF IT. DO IT AGAIN TOMORROW.'
    : pct >= 70 ? `YOU PLANNED ${formatSpan(a.plannedMins)}. YOU DID ${formatSpan(a.honouredMins)}. CLOSE ISN'T DONE.`
    : pct > 0 ? `YOU PLANNED ${formatSpan(a.plannedMins)}. YOU DID ${formatSpan(a.honouredMins)}. THE PLAN WASN'T THE PROBLEM.`
    : 'YOU PLANNED THE DAY AND THEN DIDN’T SHOW UP.';

  const verdictFor = (b: ScheduleBlock) => {
    const o = a.perBlock[b.id];
    if (!o || o.minutes <= 0) return a.pending.some(p => p.id === b.id) ? 'AHEAD' : 'SKIPPED';
    if (o.minutes >= b.durationMins * 0.9) return 'KEPT';
    return 'PARTIAL';
  };

  const tone: Record<string, string> = {
    KEPT: dark ? 'text-[#7FD8A8]' : 'text-[#1B6B45]',
    PARTIAL: dark ? 'text-[#EFB960]' : 'text-[#8A5B12]',
    SKIPPED: 'text-[#E10600]',
    AHEAD: dark ? 'text-white/35' : 'text-black/35',
  };

  return (
    <section className={card}>
      <h3 className={`font-display text-lg uppercase ${dark ? 'text-white' : 'text-[#17150F]'}`}>
        {live ? 'ON THE CLOCK' : 'PLAN VS ACTUAL'}
      </h3>

      <div className="flex items-baseline gap-3 mt-6">
        <span className={`num-hero text-5xl md:text-6xl ${pct >= 70 ? dark ? 'text-white' : 'text-[#17150F]' : 'text-[#E10600]'}`}>
          {pct}%
        </span>
        <span className={`font-ui text-[11px] uppercase tracking-[0.18em] ${dark ? 'text-white/35' : 'text-black/40'}`}>
          ADHERENCE
        </span>
      </div>

      <div className={`h-1.5 rounded-full mt-4 overflow-hidden ${dark ? 'bg-white/[0.06]' : 'bg-black/[0.06]'}`}>
        <div className="h-full bg-[#E10600] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <p className={`font-ui text-sm mt-5 font-bold uppercase tracking-wide ${dark ? 'text-white/70' : 'text-black/70'}`}>
        {verdict}
      </p>

      <div className="mt-8 space-y-1.5">
        {blocks.filter(b => a.perBlock[b.id]).map(b => {
          const v = verdictFor(b);
          const c = subjectStyle(b.subject);
          const o = a.perBlock[b.id];
          return (
            <div key={b.id} className="flex items-center gap-3 py-1.5">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.dot}`} />
              <span className={`font-ui text-xs shrink-0 tabular-nums ${dark ? 'text-white/35' : 'text-black/40'}`}>
                {formatClock(b.start)}
              </span>
              <span className={`font-ui text-xs truncate flex-1 ${dark ? 'text-white/70' : 'text-black/70'}`}>
                {b.subject}{b.chapter ? ` · ${b.chapter}` : ''}
              </span>
              <span className={`font-ui text-[10px] tabular-nums shrink-0 ${dark ? 'text-white/30' : 'text-black/35'}`}>
                {formatSpan(Math.min(o.minutes, b.durationMins))}/{formatSpan(b.durationMins)}
              </span>
              <span className={`font-ui text-[10px] font-bold uppercase tracking-wider shrink-0 w-14 text-right ${tone[v]}`}>
                {v}{o.attributed && v !== 'SKIPPED' && v !== 'AHEAD' ? ' ✓' : ''}
              </span>
            </div>
          );
        })}
      </div>

      {a.offPlanMins > 0 && (
        <p className={`font-ui text-[11px] mt-6 uppercase tracking-wider ${dark ? 'text-white/40' : 'text-black/45'}`}>
          {formatSpan(a.offPlanMins)} OFF-PLAN — STUDIED, BUT NOT AGAINST ANYTHING YOU SCHEDULED.
        </p>
      )}

      {/* Say what this actually knows. A log carries hours and a subject and no
          start time, so only a session launched from a block is measured
          against it; everything else here is an allocation. */}
      <p className={`font-ui text-[10px] mt-6 leading-relaxed ${dark ? 'text-white/25' : 'text-black/30'}`}>
        {a.hasInferred
          ? 'A ✓ MEANS THE CLOCK WAS STARTED ON THAT BLOCK. THE REST IS MATCHED BY SUBJECT AND HOURS, EARLIEST BLOCK FIRST — A LOG CARRIES NO START TIME. HIT ENGAGE AND IT STOPS BEING A GUESS.'
          : 'EVERY BLOCK HERE WAS MEASURED — THE CLOCK WAS STARTED ON IT.'}
      </p>
    </section>
  );
};

export default AdherenceSection;
