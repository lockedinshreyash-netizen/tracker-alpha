import React from 'react';
import { QuestionTrackingState } from '../types';
import { computeWeeklyProgress, computeEffectiveGoals } from './utils';

interface Props {
  questionTracking: QuestionTrackingState;
  theme: 'dark' | 'light';
}

const SubjectBreakdown: React.FC<Props> = ({ questionTracking, theme }) => {
  const goals = computeEffectiveGoals(questionTracking);
  const progress = computeWeeklyProgress(questionTracking.dailyQuestionsLog);

  if (goals.activeSubjects.length === 0) return null;

  const dark = theme === 'dark';

  const subjects = [
    { key: 'physics' as const, label: 'Physics', completed: progress.physicsCompleted, goal: goals.physics },
    { key: 'chemistry' as const, label: 'Chemistry', completed: progress.chemistryCompleted, goal: goals.chemistry },
    { key: 'math' as const, label: 'Math', completed: progress.mathCompleted, goal: goals.math },
  ].filter(s => goals.activeSubjects.includes(s.key));

  return (
    <section className={`p-8 md:p-10 rounded-2xl border transition-all ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <h3 className={`text-[10px] font-medium uppercase tracking-[0.06em] mb-6 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
        Subject Breakdown
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {subjects.map(s => {
          const pct = s.goal && s.goal > 0 ? Math.min(100, Math.round((s.completed / s.goal) * 100)) : 0;
          return (
            <div
              key={s.key}
              className={`p-5 rounded-xl border transition-all ${dark ? 'bg-[#0D0D10] border-white/[0.04]' : 'bg-zinc-50 border-zinc-100'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <p className={`text-[9px] font-medium uppercase tracking-[0.06em] ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  {s.label}
                </p>
                {s.goal !== null && (
                  <p className={`text-[9px] font-black ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    {pct}%
                  </p>
                )}
              </div>

              <p className="text-2xl tracking-tighter num-stat">
                {s.completed}
                {s.goal !== null && (
                  <span className={`text-xs not-italic ml-1.5 font-black ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    / {s.goal}
                  </span>
                )}
              </p>

              {/* Mini progress bar */}
              {s.goal !== null && s.goal > 0 && (
                <div className={`w-full h-1.5 rounded-full mt-3 overflow-hidden ${dark ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
                  <div
                    className="h-full bg-[#E10600] rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default SubjectBreakdown;
