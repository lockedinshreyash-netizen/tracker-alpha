import React from 'react';
import { ScheduleBlock, ScheduleState, TimerState } from '../types';
import { getISTDateString } from '../utils';
import { subjectStyle } from './colors';
import { currentBlock, formatClock, formatSpan, materializeDay, nextBlock, nowMinute } from './schedule';

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

  const c = subjectStyle(block.subject);
  const mins = live ? blockEndIn(block, minute) : block.start - minute;

  return (
    <section
      className={`p-4 md:p-5 rounded-xl border flex items-center gap-4 ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-[#E3E0D9]'}`}
    >
      <span className={`w-1 h-10 rounded-full shrink-0 ${c.dot}`} />
      <div className="min-w-0 flex-1">
        <p className={`font-ui text-[9px] uppercase tracking-[0.2em] ${dark ? 'text-white/35' : 'text-black/40'}`}>
          {live ? `ON THE PLAN NOW · ${formatSpan(mins)} LEFT` : `NEXT UP IN ${formatSpan(mins)}`}
        </p>
        <p className={`font-ui text-sm font-bold uppercase tracking-wide truncate mt-0.5 ${dark ? 'text-white' : 'text-[#17150F]'}`}>
          {block.subject}{block.chapter ? ` · ${block.chapter}` : ''}
        </p>
        <p className={`font-ui text-[10px] tabular-nums ${dark ? 'text-white/35' : 'text-black/40'}`}>
          {formatClock(block.start)}–{formatClock(block.start + block.durationMins)}
        </p>
      </div>
      <button
        onClick={() => onStartBlock(block)}
        className="shrink-0 px-4 py-2.5 rounded-md bg-[#E10600] text-white font-ui text-[10px] font-bold uppercase tracking-[0.15em]"
      >
        ENGAGE
      </button>
      <button
        onClick={onOpenPlan}
        className={`shrink-0 font-ui text-[10px] uppercase tracking-wider ${dark ? 'text-white/35 hover:text-white' : 'text-black/35 hover:text-black'}`}
      >
        PLAN
      </button>
    </section>
  );
};

const blockEndIn = (b: ScheduleBlock, minute: number) => b.start + b.durationMins - minute;

export default NextUpStrip;
