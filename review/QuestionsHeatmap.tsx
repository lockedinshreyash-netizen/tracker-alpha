import React, { useState, useEffect } from 'react';
import { DailyQuestionsLog } from '../types';

interface Props {
  dailyQuestionsLog: DailyQuestionsLog[];
  theme: 'dark' | 'light';
}

const QuestionsHeatmap: React.FC<Props> = ({ dailyQuestionsLog, theme }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    const handleClick = () => setSelectedDay(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const dark = theme === 'dark';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Mon=0

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: startOffset }, (_, i) => i);

  const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); };
  const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); };
  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  // Don't render if no data
  const hasData = dailyQuestionsLog.length > 0;
  if (!hasData) return null;

  const getDayTotal = (dateStr: string): number => {
    const log = dailyQuestionsLog.find(l => l.date === dateStr);
    if (!log) return 0;
    return log.physicsCount + log.chemistryCount + log.mathCount;
  };

  const maxQ = Math.max(1, ...dailyQuestionsLog.map(l => l.physicsCount + l.chemistryCount + l.mathCount));

  const getDayColor = (total: number): string => {
    if (total === 0) return dark ? 'bg-[#1F1F23] border border-[#2A2A2E]' : 'bg-zinc-50 border border-zinc-200';
    const pct = (total / maxQ) * 100;
    if (pct < 25) return dark ? 'bg-red-900/20' : 'bg-red-100';
    if (pct < 50) return dark ? 'bg-red-900/40' : 'bg-red-200';
    if (pct < 75) return 'bg-[#E10600]/60';
    return 'bg-[#E10600]';
  };

  return (
    <div className={`p-6 md:p-8 rounded-2xl border ${dark ? 'bg-[#141417] border-[#1F1F23]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className={`text-[10px] md:text-xs font-black uppercase tracking-widest ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          Questions Heatmap
        </h3>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="text-zinc-500 hover:text-[#E10600] transition-colors p-1">&lt;</button>
          <span className="text-xs md:text-sm font-black uppercase w-32 text-center">{monthName} {year}</span>
          <button onClick={nextMonth} className="text-zinc-500 hover:text-[#E10600] transition-colors p-1">&gt;</button>
        </div>
      </div>

      <div className="flex flex-col items-center">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-[3px] md:gap-1 mb-1 w-fit">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[8px] md:text-[10px] font-black text-zinc-600 uppercase w-6 md:w-8">
              {d}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-[3px] md:gap-1 w-fit">
          {blanks.map(b => (
            <div key={`blank-${b}`} className="w-6 h-6 md:w-8 md:h-8 rounded-sm opacity-0" />
          ))}
          {daysArray.map(day => {
            const fMonth = String(month + 1).padStart(2, '0');
            const fDay = String(day).padStart(2, '0');
            const dateStr = `${year}-${fMonth}-${fDay}`;
            const total = getDayTotal(dateStr);
            const log = dailyQuestionsLog.find(l => l.date === dateStr);
            const isSelected = selectedDay === dateStr;

            return (
              <div
                key={day}
                className="relative group cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setSelectedDay(isSelected ? null : dateStr); }}
              >
                <div className={`w-6 h-6 md:w-8 md:h-8 rounded-sm md:rounded-md transition-all duration-300 ${getDayColor(total)} ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-black' : ''}`} />

                {/* Tooltip */}
                <div className={`absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-44 p-3 rounded-xl border shadow-xl transition-opacity duration-200 z-[90] pointer-events-none ${isSelected ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'} ${dark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-white border-zinc-200 text-black'}`}>
                  <p className="text-[10px] font-black uppercase text-[#E10600] mb-2">{dateStr}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className={`font-bold ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>Total:</span>
                      <span className="font-black">{total}</span>
                    </div>
                    {log && (
                      <>
                        <div className="flex justify-between">
                          <span className={`font-bold ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>Phy:</span>
                          <span className="font-black">{log.physicsCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={`font-bold ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>Chem:</span>
                          <span className="font-black">{log.chemistryCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={`font-bold ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>Math:</span>
                          <span className="font-black">{log.mathCount}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default QuestionsHeatmap;
