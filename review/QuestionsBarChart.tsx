import React, { useState } from 'react';
import { DailyQuestionsLog } from '../types';
import { getWeeklyQuestionTotals } from '../questions/utils';

interface Props {
  dailyQuestionsLog: DailyQuestionsLog[];
  theme: 'dark' | 'light';
}

const QuestionsBarChart: React.FC<Props> = ({ dailyQuestionsLog, theme }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const weeks = getWeeklyQuestionTotals(dailyQuestionsLog, 4);
  const maxTotal = Math.max(1, ...weeks.map(w => w.total));

  const dark = theme === 'dark';

  // Don't render if no question data at all
  const hasData = weeks.some(w => w.total > 0);
  if (!hasData) return null;

  return (
    <div className={`p-6 md:p-8 rounded-2xl border ${dark ? 'bg-[#141417] border-[#1F1F23]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <h3 className={`text-[10px] md:text-xs font-black uppercase tracking-widest mb-6 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
        Weekly Questions
      </h3>

      <div className="flex items-end justify-between h-40 gap-3 md:gap-4">
        {weeks.map((w, i) => {
          const heightPct = Math.min(100, (w.total / maxTotal) * 100);
          const isHovered = hoveredIdx === i;

          return (
            <div
              key={i}
              className="flex flex-col items-center flex-1 gap-2 h-full relative"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Tooltip */}
              {isHovered && (
                <div className={`absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg text-center whitespace-nowrap z-10 pointer-events-none ${dark ? 'bg-zinc-900 border border-zinc-800' : 'bg-white border border-zinc-200 shadow-md'}`}>
                  <p className="text-[10px] font-black text-[#E10600] uppercase">{w.label}</p>
                  <p className={`text-xs font-black ${dark ? 'text-white' : 'text-black'}`}>{w.total} questions</p>
                </div>
              )}

              <div className="flex items-end h-full w-full">
                <div
                  className="w-full rounded-t-md transition-all duration-700 bg-[#E10600]"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className={`text-[9px] md:text-[10px] font-black uppercase ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                {w.label.replace('Week ', 'W')}
              </span>
              <span className={`text-[9px] font-black ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                {w.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QuestionsBarChart;
