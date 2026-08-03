import React, { useState, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import { DailyLog, SyncStatus, ExamPreference } from './types';
import { calculateStreak } from './utils';

interface Props {
  currentClass: 11 | 12;
  onClassChange: (c: 11 | 12) => void;
  daysRemaining: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  installPrompt: any;
  onInstall: () => void;
  syncStatus: SyncStatus;
  user: User | null;
  onOpenAuth: () => void;
  logs: DailyLog[];
  examPreference: ExamPreference;
  targetExamDate: Date;
}

const Header: React.FC<Props> = ({
  currentClass,
  onClassChange,
  daysRemaining,
  theme,
  onToggleTheme,
  installPrompt,
  onInstall,
  syncStatus,
  user,
  onOpenAuth,
  logs,
  examPreference,
  targetExamDate
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setShowTooltip(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const syncColors = {
    local: 'text-zinc-600',
    syncing: 'text-yellow-500 animate-pulse',
    synced: 'text-green-500',
    error: 'text-red-500'
  };

  return (
    <div className="w-full">
      <div className={`pt-8 pb-5 relative z-20 ${theme === 'dark' ? 'border-b border-white/[0.04]' : 'border-b border-[#E3E0D9]'}`}>
        <div className="max-w-5xl mx-auto flex justify-between items-start mb-2 px-6">
          <div className="relative">
            <h1 className={`text-xl md:text-2xl logo-text flex items-center gap-2 ${theme === 'dark' ? 'text-white' : 'text-[#17150F]'}`}>
              LOCK IN
            </h1>
            <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
              <div className={`text-[8px] font-bold uppercase tracking-wide font-ui flex items-center gap-1.5 ${syncColors[syncStatus]}`}>
                <span className="text-[6px]">●</span>
                <span>{user ? (syncStatus === 'synced' ? 'CLOUD ACTIVE' : syncStatus.toUpperCase()) : 'OFFLINE MODE'}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!user && (
              <button
                onClick={onOpenAuth}
                className={`text-[10px] font-black uppercase px-3 py-1 rounded border transition-all ${theme === 'dark' ? 'border-zinc-700 text-zinc-400 hover:text-white' : 'border-[#E3E0D9] text-[#6B675C] hover:text-[#17150F]'}`}
              >
                SYNC
              </button>
            )}
            {installPrompt && (
              <button
                onClick={onInstall}
                className={`text-[10px] font-bold uppercase tracking-[0.08em] px-4 py-2 rounded-md border transition-all ${theme === 'dark' ? 'border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500' : 'border-[#E3E0D9] text-[#6B675C] hover:text-[#17150F] hover:border-[#D6D1C5]'}`}
              >
                INSTALL
              </button>
            )}
            <button
              onClick={onToggleTheme}
              className={`p-2 rounded-md border transition-all flex items-center justify-center ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06] text-white hover:border-white/[0.12]' : 'bg-white border-[#E3E0D9] text-[#17150F] hover:border-[#D6D1C5]'}`}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button
              onClick={() => onClassChange(currentClass === 11 ? 12 : 11)}
              className={`text-[10px] font-bold uppercase tracking-[0.08em] px-4 py-2 rounded-md border transition-colors ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06] text-white hover:border-white/[0.12]' : 'bg-white border-[#E3E0D9] text-[#17150F] hover:border-[#D6D1C5]'}`}
            >
              C-{currentClass} ▾
            </button>
          </div>
        </div>
      </div>

      {/* Burn Bar */}
      <div className="w-full relative px-6 mt-4">
        <div className="flex justify-between items-center mb-1">
          <span className={`text-[9px] md:text-[10px] font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-zinc-600' : 'text-[#8A8577]'}`}>{examPreference === 'NEET' ? 'NEET 2027' : 'JEE Mains 2027'}</span>
          <span className={`text-[9px] md:text-[10px] font-semibold uppercase tracking-wide ${theme === 'dark' ? 'text-zinc-600' : 'text-[#8A8577]'}`}>{daysRemaining} days left</span>
        </div>
      </div>
      <div
        className={`w-full h-[6px] group relative cursor-crosshair ${theme === 'dark' ? 'bg-zinc-800/50' : 'bg-[#E3E0D9]'}`}
        onClick={(e) => {
          e.stopPropagation();
          setShowTooltip(!showTooltip);
        }}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div
          className="h-full bg-[#E10600] transition-all duration-1000"
          style={{ width: `${Math.max(0, Math.min(100, (1 - (daysRemaining / Math.round((targetExamDate.getTime() - new Date('2026-01-01').getTime()) / (1000 * 60 * 60 * 24)))) * 100))}%` }}
        />
        {/* Tooltip */}
        <div className={`absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 w-64 md:w-80 p-4 bg-[#111114] border border-white/[0.08] rounded-lg shadow-xl transition-opacity duration-300 z-[90] pointer-events-none ${showTooltip ? 'opacity-100' : 'opacity-0'}`}>
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-[#E10600] mt-1 text-[8px]">●</span>
              <div>
                <span className="text-zinc-500 text-[8px] md:text-[9px] uppercase tracking-[0.06em] font-black block">Time left</span>
                <span className="text-white font-bold text-xs md:text-sm">{daysRemaining} days remaining until {examPreference === 'NEET' ? 'NEET 2027' : 'JEE Mains 2027'}</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-[#E10600] mt-1 text-[8px]">●</span>
              <div>
                <span className="text-zinc-500 text-[8px] md:text-[9px] uppercase tracking-[0.06em] font-black block">Time elapsed</span>
                <span className="text-[#E10600] font-black text-sm md:text-base block">{(Math.max(0, Math.min(100, (1 - (daysRemaining / Math.round((targetExamDate.getTime() - new Date('2026-01-01').getTime()) / (1000 * 60 * 60 * 24)))) * 100))).toFixed(1)}% of your preparation time is already gone</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-[#E10600] mt-1 text-[8px]">●</span>
              <div>
                <span className="text-zinc-500 text-[8px] md:text-[9px] uppercase tracking-[0.06em] font-black block">Projected finishing hours</span>
                <span className="text-white font-bold text-xs md:text-sm">At your current daily average you will finish with {(() => {
                  if (logs.length === 0) return '0';
                  const firstLogDate = new Date(logs[0].date).getTime();
                  const now = new Date().getTime();
                  const daysSinceFirstLog = Math.max(1, Math.ceil((now - firstLogDate) / (1000 * 60 * 60 * 24)));
                  const totalHrs = logs.reduce((sum, l) => sum + l.hours, 0);
                  const avg = totalHrs / daysSinceFirstLog;
                  return Math.round(totalHrs + (avg * daysRemaining));
                })()} total hours studied by exam day</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-[#E10600] mt-1 text-[8px]">●</span>
              <div>
                <span className="text-zinc-500 text-[8px] md:text-[9px] uppercase tracking-[0.06em] font-black block">Required pace</span>
                <span className="text-white font-bold text-xs md:text-sm">You need {(() => {
                  const totalHrs = logs.reduce((sum, l) => sum + l.hours, 0);
                  const needed = 1000 - totalHrs;
                  return needed <= 0 ? '0' : (needed / Math.max(1, daysRemaining)).toFixed(1);
                })()} hours per day from today to reach 1000 total hours by Mains</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-[#E10600] mt-1 text-[8px]">●</span>
              <div>
                <span className="text-zinc-500 text-[8px] md:text-[9px] uppercase tracking-[0.06em] font-black block">Consistency</span>
                <span className="text-white font-bold text-xs md:text-sm">Current streak: {calculateStreak(logs)} days</span>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <span className="text-[#E10600] mt-1 text-[8px]">●</span>
              <div>
                <span className="text-zinc-500 text-[8px] md:text-[9px] uppercase tracking-[0.06em] font-black block">Missed days</span>
                <span className="text-white font-bold text-xs md:text-sm">Days with zero study logged: {(() => {
                  if (logs.length === 0) return 0;
                  const firstLogDate = new Date(logs[0].date).getTime();
                  const now = new Date().getTime();
                  const totalDays = Math.max(1, Math.ceil((now - firstLogDate) / (1000 * 60 * 60 * 24)));
                  const uniqueLogDays = new Set(logs.map(l => l.date)).size;
                  return Math.max(0, totalDays - uniqueLogDays);
                })()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
