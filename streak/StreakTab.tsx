import React from 'react';
import { DailyLog, DailyQuestionsLog, QSubject, RewardsState, Subject } from '../types';
import { getLast7DaysStats } from '../utils';
import QuestionsBarChart from '../review/QuestionsBarChart';
import QuestionsHeatmap from '../review/QuestionsHeatmap';
import MonthlyHeatmap from './MonthlyHeatmap';
import RewardsVault from '../rewards/RewardsVault';
import { nextReward } from '../rewards/engine';
import ShareButton from '../share/ShareButton';
import { Card, Eyebrow, PageHeader, tokens } from '../ui/kit';

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
  /** Opens the share sheet on the weekly card — this tab is about the run. */
  onShare: () => void;
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
  onShare,
}) => {
  const days = getLast7DaysStats(logs, activeSubjects);
  const maxHours = Math.max(1, ...days.map(d => d.hours || 0)); // avoid divide‑by‑zero
  const next = nextReward(rewards, streak, verifiedStreak);

  const dark = theme === 'dark';
  const t = tokens(dark);
  const weekTotal = days.reduce((a, d) => a + (d.hours || 0), 0);
  const hitDays = days.filter(d => d.hours >= dailyGoalHours).length;
  // Headroom over the taller of the best day and the goal, so neither touches the top.
  const scaleMax = Math.max(maxHours, dailyGoalHours) * 1.12;
  const goalPct = (dailyGoalHours / scaleMax) * 100;

  return (
    <div className="space-y-6">
      <PageHeader
        dark={dark}
        title="Streak"
        subtitle={streak > 0 ? `${streak} ${streak === 1 ? 'day' : 'days'} in a row. Don’t be the one who breaks it.` : 'Log a session today to start a run.'}
        right={<ShareButton onClick={onShare} theme={theme} />}
      />

      <Card dark={dark} delay={60} className="relative overflow-hidden">
        {streak > 0 && (
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(90% 100% at 0% 0%, rgba(225,6,0,${dark ? '0.16' : '0.08'}), transparent 60%)` }} />
        )}
        <div className="relative p-6 md:p-10 grid md:grid-cols-[1fr_auto] gap-8 items-end">
          <div>
            <Eyebrow dark={dark}>Current streak</Eyebrow>
            <div className="flex items-baseline gap-3 mt-3">
              <span className={`num-hero text-[112px] md:text-[152px] leading-[0.85] ${t.heading}`}>{streak}</span>
              <span className={`font-display text-[22px] ${t.muted}`}>{streak === 1 ? 'day' : 'days'}</span>
            </div>
            <p className={`font-accent text-[17px] mt-3 ${t.muted}`}>of undivided focus.</p>
          </div>
          <div className="md:w-[260px] space-y-3">
            {/* What the next day of this is actually worth. */}
            {next && (
              <div className={`rounded-xl border p-4 ${t.inset}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className={`text-[12px] font-ui font-bold truncate ${t.heading}`}>Next: {next.def.title}</span>
                  <span className="text-[11px] font-ui font-bold text-[#E10600] tabular-nums shrink-0">{next.daysLeft} to go</span>
                </div>
                <div className={`h-1.5 rounded-full overflow-hidden mt-3 ${dark ? 'bg-white/[0.06]' : 'bg-zinc-200/70'}`}>
                  <div className="h-full rounded-full bg-[#E10600] transition-all duration-700" style={{ width: `${next.percent}%` }} />
                </div>
              </div>
            )}
            <div className={`rounded-xl border p-4 flex items-center justify-between ${t.inset}`}>
              <div>
                <p className={`text-[12px] font-ui font-bold ${t.heading}`}>Timed streak</p>
                <p className={`text-[11px] font-ui ${t.muted}`}>Days the app clocked you</p>
              </div>
              <span className={`num-stat text-[24px] ${t.heading}`}>{verifiedStreak}</span>
            </div>
          </div>
        </div>
      </Card>

      <RewardsVault
        rewards={rewards}
        streak={streak}
        verifiedStreak={verifiedStreak}
        theme={theme}
        onSelectWallpaper={onSelectWallpaper}
        onOpenBook={onOpenBook}
        onClaimHamper={onClaimHamper}
      />

      {/* 7-day focus hours: one series in ink, the goal as one labelled hairline. */}
      <Card dark={dark} delay={120} className="p-6 md:p-8">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow dark={dark}>Last 7 days</Eyebrow>
          <span className={`text-[11px] font-ui ${t.muted}`}>{weekTotal.toFixed(1)}h · goal hit {hitDays} of 7</span>
        </div>
        {/* One plotting box for bars and goal line, so the line sits exactly where the bars are measured. */}
        {/* The bars are red, so the goal line is ink — a red line over red bars disappears where it matters. */}
        <div className="relative h-44 mt-8">
          <div className={`absolute left-0 right-0 border-t z-10 ${dark ? 'border-white/40' : 'border-zinc-900/40'}`} style={{ bottom: `${goalPct}%` }}>
            <span className={`absolute right-0 -top-[17px] text-[10px] font-ui font-bold px-1 rounded ${dark ? 'bg-[#111114] text-zinc-300' : 'bg-white text-zinc-700'}`}>{dailyGoalHours}h goal</span>
          </div>
          <div className={`absolute inset-x-0 bottom-0 border-t ${t.rule}`} />
          <div className="absolute inset-0 flex gap-1.5 md:gap-2.5">
            {days.map((d, i) => {
              const heightPct = Math.min(100, (d.hours / scaleMax) * 100);
              const hit = d.hours >= dailyGoalHours;
              return (
                <div key={i} className="relative flex-1 flex justify-center">
                  {/* Full width of the day's column. A day that cleared the goal is solid; one that fell short is the same red, lighter. */}
                  <div
                    className={`absolute bottom-0 inset-x-0 rounded-t-md bg-[#E10600] transition-all duration-700 ${hit ? '' : 'opacity-60'}`}
                    style={{ height: `${d.hours ? Math.max(2, heightPct) : 0}%` }}
                  />
                  {d.hours > 0 && (
                    <span className={`absolute text-[10px] font-ui font-bold tabular-nums ${t.body}`} style={{ bottom: `calc(${heightPct}% + 4px)` }}>
                      {d.hours.toFixed(1)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex gap-1.5 md:gap-2.5 mt-2">
          {days.map((d, i) => (
            <span key={i} className={`flex-1 text-center text-[10px] font-ui font-semibold ${t.muted}`}>{d.date}</span>
          ))}
        </div>
      </Card>

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
