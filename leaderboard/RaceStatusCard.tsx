import React from 'react';
import { RaceState, formatGap } from './engine';
import { RaceStatus, StatusTone, ordinal } from './messages';
import { RaceDay } from './raceDay';

/* ── The card that answers "what is happening in today's race?" ──
   Deliberately the first thing on the tab, above the standings: a list of
   names and numbers is something to decode, and this is the decoding. The copy
   comes from messages.ts; this file only decides how loudly to say it. */

interface Props {
  status: RaceStatus;
  race: RaceState;
  day: RaceDay;
  theme: 'dark' | 'light';
}

/* Tone drives emphasis, never a new colour: the design system has one accent,
   and a leaderboard that invented a green and an amber would stop looking like
   the rest of the app. Threat and live sit inside a red bloom; everything else
   is an ordinary card. */
const toneClass = (tone: StatusTone, dark: boolean): string => {
  const base = dark ? 'bg-[#111114]' : 'bg-white';
  switch (tone) {
    case 'threat':
    case 'live':
      return `${base} border-[#E10600]/40 race-alert`;
    case 'lead':
      return `${base} border-[#E10600]/20 race-crown`;
    default:
      return `${base} ${dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]'}`;
  }
};

/** One figure and its label. The strip under the headline. */
const Metric: React.FC<{ label: string; value: string; sub?: string; dark: boolean; accent?: boolean }> = ({
  label, value, sub, dark, accent,
}) => (
  <div className={`px-3 py-3 md:px-4 rounded-lg border ${dark ? 'bg-[#0D0D10] border-white/[0.04]' : 'bg-[#F2F0EC] border-[#E3E0D9]'}`}>
    <p className={`text-[8px] md:text-[9px] font-bold uppercase tracking-[0.12em] font-ui ${dark ? 'text-zinc-500' : 'text-[#8A8577]'}`}>
      {label}
    </p>
    <p className={`text-base md:text-xl num-stat mt-1.5 ${accent ? 'text-[#E10600]' : dark ? 'text-white' : 'text-[#17150F]'}`}>
      {value}
    </p>
    {sub && (
      <p className={`text-[9px] font-ui mt-0.5 truncate ${dark ? 'text-zinc-600' : 'text-[#B5AFA0]'}`}>{sub}</p>
    )}
  </div>
);

const RaceStatusCard: React.FC<Props> = ({ status, race, day, theme }) => {
  const dark = theme === 'dark';
  const muted = dark ? 'text-zinc-500' : 'text-[#8A8577]';
  const heading = dark ? 'text-white' : 'text-[#17150F]';

  /* Second metric changes with the situation: someone leading cares about the
     size of their cushion, everyone else cares about the climb. */
  const gapMetric = race.isLeading
    ? { label: 'Lead over second', value: race.lead !== null && race.runnerUp ? formatGap(race.lead) : '—', sub: race.runnerUp?.name }
    : race.gapToAhead !== null
      ? { label: `Gap to ${ordinal((race.position ?? 2) - 1)}`, value: formatGap(race.gapToAhead), sub: race.ahead?.name }
      : { label: 'Gap to first', value: race.gapToLeader !== null ? formatGap(race.gapToLeader) : '—', sub: race.leader?.name };

  const minutesInFirst = Math.round(day.msInFirst / 60_000);

  return (
    <section className={`rounded-xl border overflow-hidden transition-all ${toneClass(status.tone, dark)}`}>
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <p className={`text-[9px] font-black uppercase tracking-[0.18em] font-ui ${muted}`}>
            Race control · Today
          </p>
          {race.studyingNow > 0 && (
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] race-live-dot" />
              <span className={`text-[9px] font-bold uppercase tracking-[0.1em] font-ui ${muted}`}>
                {race.studyingNow} in a session
              </span>
            </span>
          )}
        </div>

        <div className="flex items-start gap-4 mt-5">
          <span className="text-2xl md:text-3xl leading-none select-none" aria-hidden="true">{status.icon}</span>
          <div className="min-w-0">
            <h2 className={`text-xl md:text-3xl font-display leading-[1.1] ${heading}`}>
              {status.headline}
            </h2>
            <p className={`text-[12px] md:text-sm font-ui mt-2.5 leading-relaxed ${dark ? 'text-zinc-400' : 'text-[#6B675C]'}`}>
              {status.line}
            </p>
            {status.cta && (
              <p className="text-[10px] font-black uppercase tracking-[0.14em] font-ui mt-4 text-[#E10600]">
                {status.cta}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-2 md:grid-cols-4 gap-2 p-3 md:p-4 border-t ${dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]'}`}>
        <Metric
          dark={dark}
          label="Position"
          value={race.position ? ordinal(race.position) : '—'}
          sub={`of ${race.fieldSize}`}
          accent={race.position === 1}
        />
        <Metric dark={dark} label={gapMetric.label} value={gapMetric.value} sub={gapMetric.sub} />
        <Metric
          dark={dark}
          label="Places gained"
          value={String(day.overtakes)}
          sub={day.timesPassed ? `${day.timesPassed} lost` : 'none lost'}
          accent={day.overtakes > 0}
        />
        <Metric
          dark={dark}
          label="Time in first"
          value={minutesInFirst >= 1 ? formatGap(minutesInFirst) : '—'}
          sub={race.isLeading ? 'holding it' : day.msInFirst > 0 ? 'earlier today' : 'not yet'}
        />
      </div>
    </section>
  );
};

export default RaceStatusCard;
