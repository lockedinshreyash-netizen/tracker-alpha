import React from 'react';
import { ScheduleBlock, ScheduleState, TimerState } from '../types';
import { getISTDateString } from '../utils';
import { blockStyle, blockTitle, countsAsStudy } from './colors';
import { currentBlock, formatRange, formatSpan, materializeDay, nextBlock, nowMinute } from './schedule';

interface Props {
  schedule: ScheduleState;
  timer: TimerState;
  theme: 'dark' | 'light';
  onStartBlock: (block: ScheduleBlock) => void;
  onOpenPlan: () => void;
}

/**
 * What the plan says you should be doing, on the tab where the clock lives.
 *
 * Self-hiding when there is nothing planned or a session is already running —
 * mid-session the last thing anyone needs is a second opinion, which is the
 * same rule CoachCard follows.
 */
const NextUpStrip: React.FC<Props> = ({ schedule, timer, theme, onStartBlock, onOpenPlan }) => {
  const dark = theme === 'dark';
  if (timer.isRunning) return null;

  const today = getISTDateString();
  const minute = nowMinute();
  const blocks = materializeDay(schedule, today);
  if (blocks.length === 0) return null;

  const live = currentBlock(blocks, minute);
  const block = live || nextBlock(blocks, minute);
  if (!block) return null;

  const c = blockStyle(block);
  const mins = live ? block.start + block.durationMins - minute : block.start - minute;
  /* Engage only makes sense for work. You do not start a stopwatch on sleep. */
  const engageable = countsAsStudy(block.kind);

  return (
    <section className={`p-5 md:p-6 rounded-xl border flex items-center gap-4 transition-all ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <span className={`w-1 h-11 rounded-full shrink-0 ${c.dot}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {live ? `On the plan now · ${formatSpan(mins)} left` : `Next up in ${formatSpan(mins)}`}
        </p>
        <p className={`text-base num-stat truncate mt-1 ${dark ? 'text-white' : 'text-zinc-900'}`}>
          {blockTitle(block)}{block.chapter ? ` · ${block.chapter}` : ''}
        </p>
        <p className={`text-[10px] tabular-nums font-ui mt-0.5 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
          {formatRange(block.start, block.durationMins)}
        </p>
      </div>
      {engageable && (
        <button
          onClick={() => onStartBlock(block)}
          className="shrink-0 px-6 md:px-8 py-3 text-[10px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white rounded-md hover:bg-red-700 transition-all active:scale-95 font-ui"
        >
          Engage
        </button>
      )}
      <button
        onClick={onOpenPlan}
        className={`shrink-0 text-[10px] font-medium uppercase tracking-[0.06em] font-ui transition-colors ${dark ? 'text-zinc-500 hover:text-white' : 'text-zinc-400 hover:text-zinc-900'}`}
      >
        Plan
      </button>
    </section>
  );
};

export default NextUpStrip;
