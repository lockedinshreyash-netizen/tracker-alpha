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
    <section className={`p-6 md:p-8 rounded-2xl border transition-all ${dark ? 'bg-[#141417] border-[#1F1F23]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <h3 className={`text-[10px] font-black uppercase tracking-widest mb-6 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
        Weekly Progress
      </h3>

      {/* Progress text */}
      <div className="flex justify-between items-end mb-3">
        <p className="text-2xl md:text-3xl font-black italic tracking-tighter">
          {progress.totalCompleted}
          <span className={`text-sm not-italic ml-2 font-black ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            / {totalGoal} questions
          </span>
        </p>
        <p className="text-xl font-black italic text-[#E10600]">{percent}%</p>
      </div>

      {/* Animated gradient progress bar */}
      <div className={`w-full h-3 rounded-full overflow-hidden ${dark ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${percent}%`,
            background: 'linear-gradient(90deg, #E10600, #ff4d4d, #E10600)',
            backgroundSize: '200% 100%',
            animation: 'gradientShift 3s ease infinite',
          }}
        />
      </div>

      {/* Remaining */}
      <p className={`text-[10px] font-black uppercase tracking-widest mt-4 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
        {remaining > 0
          ? `${remaining} questions remaining this week`
          : '🎯 Weekly goal reached!'
        }
      </p>

      {/* Inline keyframes for gradient animation */}
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </section>
  );
};

export default WeeklyProgressSection;
