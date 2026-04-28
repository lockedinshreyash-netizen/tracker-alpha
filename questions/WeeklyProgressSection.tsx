import React from 'react';
import { QuestionTrackingState } from '../types';
import { computeWeeklyProgress, computeEffectiveGoals } from './utils';

interface Props {
  questionTracking: QuestionTrackingState;
  theme: 'dark' | 'light';
}

const WeeklyProgressSection: React.FC<Props> = ({ questionTracking, theme }) => {
  const goals = computeEffectiveGoals(questionTracking);
  const progress = computeWeeklyProgress(questionTracking.dailyQuestionsLog);

  // Determine effective total goal
  const totalGoal = goals.totalGoal ||
    ((goals.physics || 0) + (goals.chemistry || 0) + (goals.math || 0));

  if (goals.activeSubjects.length === 0 || totalGoal <= 0) return null;

  const remaining = Math.max(0, totalGoal - progress.totalCompleted);
  const percent = Math.min(100, Math.round((progress.totalCompleted / totalGoal) * 100));

  const dark = theme === 'dark';

  return (
    <section className={`p-6 md:p-8 rounded-2xl border transition-all ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-6 font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
        Weekly Progress
      </h3>

      {/* Progress text */}
      <div className="flex justify-between items-end mb-3">
        <p className="text-2xl md:text-3xl font-black italic tracking-tighter">
          {progress.totalCompleted}
          <span className={`text-sm not-italic ml-2 font-bold font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            / {totalGoal} questions
          </span>
        </p>
        <p className="text-xl num-stat text-[#E10600]">{percent}%</p>
      </div>

      {/* Animated gradient progress bar */}
      <div className={`w-full h-3 rounded-full overflow-hidden ${dark ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
        <div
          className="h-full rounded-full bg-[#E10600] transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Remaining */}
      <p className={`text-[10px] font-black uppercase tracking-widest mt-4 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
        {remaining > 0
          ? `${remaining} questions remaining this week`
          : '🎯 Weekly goal reached!'
        }
      </p>

    </section>
  );
};

export default WeeklyProgressSection;
