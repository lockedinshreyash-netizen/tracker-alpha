import React from 'react';
import { DailyLog, DailyQuestionsLog, QSubject, RewardsState, Subject } from '../types';
import { getLast7DaysStats } from '../utils';
import QuestionsBarChart from '../review/QuestionsBarChart';
import QuestionsHeatmap from '../review/QuestionsHeatmap';
import MonthlyHeatmap from './MonthlyHeatmap';
import RewardsVault from '../rewards/RewardsVault';
import { nextReward } from '../rewards/engine';

interface Props {
  streak: number;
  /** Streak counting only app-timed days — what the paid rewards run on. */
  verifiedStreak: number;
  logs: DailyLog[];
  dailyGoalHours: number;
  theme: 'dark' | 'light';
  dailyQuestionsLog?: DailyQuestionsLog[];
  coreSubjects: QSubject[];
  activeSubjects: Subject[];
  rewards: RewardsState;
  onSelectWallpaper: (id: string | null) => void;
  onOpenBook: () => void;
  onClaimHamper: () => void;
}

const StreakTab: React.FC<Props> = ({
  streak,
  verifiedStreak,
  logs,
  dailyGoalHours,
  theme,
  dailyQuestionsLog,
  coreSubjects,
  activeSubjects,
  rewards,
  onSelectWallpaper,
  onOpenBook,
  onClaimHamper,
}) => {
  const days = getLast7DaysStats(logs, activeSubjects);
  const maxHours = Math.max(1, ...days.map(d => d.hours || 0)); // avoid divide‑by‑zero
  const next = nextReward(rewards, streak, verifiedStreak);

  return (
    <div className="space-y-14 animate-in fade-in duration-500">
      {/* Current streak card */}
      <div className={`text-center py-16 md:py-24 rounded-xl border ${theme === 'dark' ? 'border-white/[0.06] bg-[#111114]' : 'border-zinc-200 bg-zinc-50'}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500 mb-6 font-ui">
          Current Streak
        </p>
        <h2 className={`text-[120px] md:text-[160px] tracking-tighter num-hero ${theme === 'dark' ? 'text-white' : 'text-black'}`}>
          {streak}
        </h2>
        <div className="accent-line mt-4 mb-6" />
        <p className="text-sm font-medium tracking-wide text-zinc-600 mt-2 font-ui">
          days of undivided focus
        </p>

        {/* What the next day of this is actually worth. */}
        {next && (
          <div className="mt-10 max-w-xs mx-auto px-6">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-zinc-600 font-ui">
                Next: {next.def.title}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#E10600] tabular-nums font-ui">
                {next.daysLeft} to go
              </span>
            </div>
            <div className={`h-1 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/[0.06]' : 'bg-zinc-200'}`}>
              <div className="h-full bg-[#E10600] transition-all duration-700" style={{ width: `${next.percent}%` }} />
            </div>
          </div>
        )}
      </div>

      <RewardsVault
        rewards={rewards}
        streak={streak}
        verifiedStreak={verifiedStreak}
        theme={theme}
        onSelectWallpaper={onSelectWallpaper}
        onOpenBook={onOpenBook}
        onClaimHamper={onClaimHamper}
      />

      {/* 7‑day focus hours graph */}
      <div
        className={`p-8 md:p-10 rounded-xl border ${theme === 'dark' ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'
          }`}
      >
        <h3 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500 mb-6 font-ui">
          PAST 7 DAYS ACTIVITY
        </h3>
        <div className="flex items-end justify-between h-40 gap-2 md:gap-3">
          {days.map((d, i) => {
            const heightPct = Math.min(100, (d.hours / maxHours) * 100);
            return (
              <div key={i} className="flex flex-col items-center flex-1 gap-1 md:gap-2 h-full">
                <div className="flex items-end h-full w-full">
                  <div
                    className="w-full rounded-t-md transition-all duration-700 bg-[#E10600]"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
                <span className="text-[9px] md:text-[10px] font-black uppercase text-zinc-500">
                  {d.date}
                </span>
                <span className="text-[9px] font-black text-zinc-400">
                  {d.hours.toFixed(1)}h
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <MonthlyHeatmap logs={logs} dailyGoalHours={dailyGoalHours} theme={theme} />

      {/* Question Analytics */}
      {dailyQuestionsLog && dailyQuestionsLog.length > 0 && (
        <>
          <QuestionsBarChart dailyQuestionsLog={dailyQuestionsLog} theme={theme} />
          <QuestionsHeatmap dailyQuestionsLog={dailyQuestionsLog} theme={theme} coreSubjects={coreSubjects} />
        </>
      )}
    </div>
  );
};

export default StreakTab;
