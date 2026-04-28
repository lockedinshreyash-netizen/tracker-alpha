import React from 'react';
import { QuestionTrackingState } from '../types';
import { computeDailyTargets, computeEffectiveGoals, computeFeedback, HIGH_TARGET_THRESHOLD } from './utils';

interface Props {
  questionTracking: QuestionTrackingState;
  theme: 'dark' | 'light';
}

const TodayTargetSection: React.FC<Props> = ({ questionTracking, theme }) => {
  const goals = computeEffectiveGoals(questionTracking);
  const targets = computeDailyTargets(questionTracking);
  const feedback = computeFeedback(questionTracking);

  if (goals.activeSubjects.length === 0) return null;

  const dark = theme === 'dark';
  const highLoad = targets.total > HIGH_TARGET_THRESHOLD;

  const feedbackColors = {
    behind: { text: 'text-red-400', bg: dark ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50 border-red-200', dot: 'bg-red-500' },
    ahead: { text: 'text-green-400', bg: dark ? 'bg-green-900/10 border-green-900/30' : 'bg-green-50 border-green-200', dot: 'bg-green-500' },
    on_track: { text: dark ? 'text-zinc-400' : 'text-zinc-500', bg: dark ? 'bg-[#0B0B0D] border-zinc-900' : 'bg-zinc-50 border-zinc-100', dot: 'bg-zinc-500' },
  };

  return (
    <>
      {/* Today's Target */}
      <section className={`p-8 md:p-10 rounded-2xl border transition-all ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
        <h3 className={`text-[10px] font-medium uppercase tracking-[0.06em] mb-6 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          To stay on track today
        </h3>

        {/* Total target */}
        <div className="text-center mb-6">
          <p className="text-5xl md:text-6xl tracking-tighter leading-none text-[#E10600] num-hero">
            {targets.total}
          </p>
          <p className={`text-[10px] font-medium uppercase tracking-[0.06em] mt-2 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Questions Today
          </p>
        </div>

        {/* Subject breakdown */}
        <div className="flex justify-center gap-3 md:gap-4">
          {targets.physics !== null && (
            <div className={`flex-1 max-w-[140px] p-4 rounded-xl border text-center ${dark ? 'bg-[#0D0D10] border-white/[0.04]' : 'bg-zinc-50 border-zinc-100'}`}>
              <p className={`text-[8px] font-medium uppercase tracking-[0.06em] mb-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>Phy</p>
              <p className="text-lg num-stat">{targets.physics}</p>
            </div>
          )}
          {targets.chemistry !== null && (
            <div className={`flex-1 max-w-[140px] p-4 rounded-xl border text-center ${dark ? 'bg-[#0D0D10] border-white/[0.04]' : 'bg-zinc-50 border-zinc-100'}`}>
              <p className={`text-[8px] font-medium uppercase tracking-[0.06em] mb-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>Chem</p>
              <p className="text-lg num-stat">{targets.chemistry}</p>
            </div>
          )}
          {targets.math !== null && (
            <div className={`flex-1 max-w-[140px] p-4 rounded-xl border text-center ${dark ? 'bg-[#0D0D10] border-white/[0.04]' : 'bg-zinc-50 border-zinc-100'}`}>
              <p className={`text-[8px] font-medium uppercase tracking-[0.06em] mb-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>Math</p>
              <p className="text-lg num-stat">{targets.math}</p>
            </div>
          )}
        </div>

        {/* High load warning */}
        {highLoad && (
          <p className="text-[9px] font-bold uppercase tracking-wider text-yellow-500 mt-4 text-center">
            ⚠ High daily load. Consider adjusting your goal.
          </p>
        )}
      </section>

      {/* Adaptive Feedback */}
      {feedback && (
        <section className={`p-5 md:p-6 rounded-2xl border transition-all ${feedbackColors[feedback.status].bg}`}>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${feedbackColors[feedback.status].dot}`} />
            <p className={`text-[11px] font-bold uppercase tracking-tight ${feedbackColors[feedback.status].text}`}>
              {feedback.message}
            </p>
          </div>
        </section>
      )}
    </>
  );
};

export default TodayTargetSection;
