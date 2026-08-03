import React, { useState, useEffect } from 'react';
import { DailyLog } from '../types';

interface Props {
  logs: DailyLog[];
  dailyGoalHours: number;
  theme: 'dark' | 'light';
}

const MonthlyHeatmap: React.FC<Props> = ({ logs, dailyGoalHours, theme }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = () => setSelectedDay(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  // Adjust so Monday is 0, Sunday is 6
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanksArray = Array.from({ length: startOffset }, (_, i) => i);

  const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); };
  const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); };

  const monthName = currentDate.toLocaleString('default', { month: 'long' });

  const getDayColor = (hours: number) => {
    if (hours === 0) return theme === 'dark' ? 'bg-[#1F1F23] border border-[#2A2A2E]' : 'bg-zinc-50 border border-zinc-200';
    const percent = (hours / dailyGoalHours) * 100;
    if (percent < 30) return theme === 'dark' ? 'bg-red-900/20' : 'bg-red-100';
    if (percent < 60) return theme === 'dark' ? 'bg-red-900/50' : 'bg-red-300';
    if (percent < 90) return 'bg-[#E10600]/70';
    return 'bg-[#E10600]';
  };

  return (
    <div className={`p-8 md:p-10 rounded-xl border ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-[10px] md:text-xs font-black uppercase tracking-[0.06em] text-zinc-500">
          Monthly Heatmap
        </h3>
        <div className="flex items-center gap-4">
          <button onClick={prevMonth} className="text-zinc-500 hover:text-[#E10600] transition-colors p-1">&lt;</button>
          <span className="text-xs md:text-sm font-black uppercase w-32 text-center">{monthName} {year}</span>
          <button onClick={nextMonth} className="text-zinc-500 hover:text-[#E10600] transition-colors p-1">&gt;</button>
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="grid grid-cols-7 gap-[3px] md:gap-1 mb-1 w-fit">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[8px] md:text-[10px] font-black text-zinc-600 uppercase w-6 md:w-8">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-[3px] md:gap-1 w-fit">
          {blanksArray.map(b => (
            <div key={`blank-${b}`} className="w-6 h-6 md:w-8 md:h-8 rounded-sm opacity-0" />
          ))}
          {daysArray.map(day => {
            const formattedMonth = String(month + 1).padStart(2, '0');
            const formattedDay = String(day).padStart(2, '0');
            const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

            const dayLogs = logs.filter(l => l.date === dateStr);
            const totalHours = dayLogs.reduce((sum, l) => sum + l.hours, 0);
            const avgQuality = dayLogs.length > 0 ? (dayLogs.reduce((sum, l) => sum + l.quality, 0) / dayLogs.length).toFixed(1) : '0';
            const sessions = dayLogs.length;
            const metGoal = totalHours >= dailyGoalHours;

            const isSelected = selectedDay === dateStr;

            return (
              <div
                key={day}
                className="relative group cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedDay(isSelected ? null : dateStr);
                }}
              >
                <div className={`w-6 h-6 md:w-8 md:h-8 rounded-sm md:rounded-md transition-all duration-300 ${getDayColor(totalHours)} ${isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-black' : ''}`} />

                {/* Tooltip */}
                <div className={`absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-48 p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white transition-opacity duration-200 z-[90] shadow-xl pointer-events-none ${isSelected ? 'opacity-100' : 'opacity-0 md:group-hover:opacity-100'}`}>
                  <p className="text-[10px] font-black uppercase text-[#E10600] mb-2">{dateStr}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-bold">Hours Base:</span>
                      <span className="font-black">{totalHours.toFixed(1)}h</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-bold">Sessions:</span>
                      <span className="font-black">{sessions}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500 font-bold">Avg Quality:</span>
                      <span className="font-black">{avgQuality}</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-zinc-800 text-center text-[9px] font-medium uppercase tracking-[0.06em]">
                      {totalHours > 0 ? (metGoal ? <span className="text-green-500">Goal Met</span> : <span className="text-yellow-500">Below Goal</span>) : <span className="text-zinc-600">No Activity</span>}
                    </div>
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

export default MonthlyHeatmap;
