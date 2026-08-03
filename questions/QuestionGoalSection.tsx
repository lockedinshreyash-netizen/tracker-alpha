import React, { useState } from 'react';
import { QuestionTrackingState, QSubject } from '../types';
import { getISTDateString } from '../utils';
import { computeEffectiveGoals, getISTWeekBounds, isGoalMidWeek } from './utils';

interface Props {
  questionTracking: QuestionTrackingState;
  onUpdateTracking: (update: Partial<QuestionTrackingState>) => void;
  theme: 'dark' | 'light';
  coreSubjects: QSubject[];
}

const QuestionGoalSection: React.FC<Props> = ({ questionTracking, onUpdateTracking, theme, coreSubjects }) => {
  const { weeklyGoalTotal, weeklyGoalBySubject, goalStartDate } = questionTracking;
  const [isEditing, setIsEditing] = useState(false);
  const [totalInput, setTotalInput] = useState(weeklyGoalTotal?.toString() || '');
  
  const initialInputs: Record<string, string> = {};
  coreSubjects.forEach(s => {
    initialInputs[s] = (weeklyGoalBySubject as any)[s]?.toString() || '';
  });
  const [subjectInputs, setSubjectInputs] = useState<Record<string, string>>(initialInputs);

  const dark = theme === 'dark';
  const goals = computeEffectiveGoals(questionTracking);
  const hasGoal = goals.activeSubjects.length > 0;
  const midWeek = isGoalMidWeek(goalStartDate);

  const syncInputsFromState = () => {
    setTotalInput(weeklyGoalTotal?.toString() || '');
    const newInputs: Record<string, string> = {};
    coreSubjects.forEach(s => {
      newInputs[s] = (weeklyGoalBySubject as any)[s]?.toString() || '';
    });
    setSubjectInputs(newInputs);
  };

  const handleSave = () => {
    const total = totalInput.trim() ? parseInt(totalInput) : null;
    
    const parsedSubjectGoals: Record<string, number | null> = {};
    coreSubjects.forEach(s => {
      const val = subjectInputs[s]?.trim();
      parsedSubjectGoals[s] = val ? parseInt(val) : null;
    });

    const isNewGoal = !hasGoal;

    onUpdateTracking({
      weeklyGoalTotal: total && total > 0 ? total : null,
      weeklyGoalBySubject: parsedSubjectGoals,
      goalStartDate: isNewGoal ? getISTDateString() : goalStartDate,
    });
    setIsEditing(false);
  };

  const handleResetProgress = () => {
    if (!window.confirm('RESET THIS WEEK\'S PROGRESS? Goal will be kept. Historical logs remain for analytics.')) return;
    const { start, end } = getISTWeekBounds();
    const filteredLogs = questionTracking.dailyQuestionsLog.filter(
      l => l.date < start || l.date > end
    );
    onUpdateTracking({ dailyQuestionsLog: filteredLogs });
  };

  const handleDeleteGoal = () => {
    if (!window.confirm('DELETE GOAL? All targets and tracking will stop.')) return;
    onUpdateTracking({
      weeklyGoalTotal: null,
      weeklyGoalBySubject: {},
      weakSubject: null,
      goalStartDate: null,
    });
    setTotalInput('');
    const emptyInputs: Record<string, string> = {};
    coreSubjects.forEach(s => emptyInputs[s] = '');
    setSubjectInputs(emptyInputs);
    setIsEditing(false);
  };

  const inputClass = `w-full p-3 rounded-lg border text-sm font-bold uppercase focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors ${dark
    ? 'bg-[#0D0D10] border-white/[0.06] text-white placeholder-zinc-700'
    : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-300'
    }`;

  const labelClass = `text-[10px] uppercase font-black tracking-[0.06em] ${dark ? 'text-zinc-500' : 'text-zinc-400'}`;

  // --- DISPLAY MODE (goal is set, not editing) ---
  if (hasGoal && !isEditing) {
    return (
      <section className={`p-8 md:p-10 rounded-2xl border transition-all ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={`text-[10px] font-medium uppercase tracking-[0.06em] ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Weekly Goal
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => { syncInputsFromState(); setIsEditing(true); }}
              className={`text-[9px] font-medium uppercase tracking-[0.06em] px-4 py-2 rounded border transition-all ${dark ? 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12] hover:text-zinc-300' : 'border-zinc-200 text-zinc-400 hover:border-zinc-400'}`}
            >
              Edit
            </button>
            <button
              onClick={handleResetProgress}
              className={`text-[9px] font-medium uppercase tracking-[0.06em] px-4 py-2 rounded border transition-all ${dark ? 'border-white/[0.06] text-zinc-500 hover:border-yellow-600 hover:text-yellow-500' : 'border-zinc-200 text-zinc-400 hover:border-yellow-500 hover:text-yellow-600'}`}
            >
              Reset
            </button>
            <button
              onClick={handleDeleteGoal}
              className="text-[9px] font-medium uppercase tracking-[0.06em] px-4 py-2 rounded border border-red-900/40 text-red-500/70 hover:bg-red-900/10 hover:text-red-500 transition-all"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Goal Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {goals.totalGoal !== null && (
            <div className={`p-4 rounded-xl border ${dark ? 'bg-[#0D0D10] border-white/[0.04]' : 'bg-zinc-50 border-zinc-100'}`}>
              <p className={`text-[8px] font-medium uppercase tracking-[0.06em] mb-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>Total</p>
              <p className="text-xl num-stat">{goals.totalGoal}</p>
            </div>
          )}
          {coreSubjects.map(s => {
            const subjectGoal = (goals as any)[s];
            if (subjectGoal === null || subjectGoal === undefined) return null;
            return (
              <div key={s} className={`p-4 rounded-xl border ${dark ? 'bg-[#0D0D10] border-white/[0.04]' : 'bg-zinc-50 border-zinc-100'}`}>
                <p className={`text-[8px] font-medium uppercase tracking-[0.06em] mb-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>{s.substring(0, 4)}</p>
                <p className="text-xl num-stat">{subjectGoal}</p>
              </div>
            );
          })}
        </div>

        {/* Mid-week note */}
        {midWeek && (
          <p className={`text-[9px] font-bold uppercase tracking-wider mt-4 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
            ● Goal started mid-week — targets adjusted for remaining days only
          </p>
        )}
      </section>
    );
  }

  // --- EDIT / CREATE MODE ---
  return (
    <section className={`p-8 md:p-10 rounded-2xl border transition-all ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <h3 className={`text-[10px] font-medium uppercase tracking-[0.06em] mb-6 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
        {hasGoal ? 'Edit Weekly Goal' : 'Set Weekly Goal'}
      </h3>

      <div className="space-y-5">
        {/* Total goal */}
        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Total Questions (optional)</label>
          <input
            type="number"
            min="1"
            placeholder="e.g. 700"
            value={totalInput}
            onChange={e => setTotalInput(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Subject goals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {coreSubjects.map(s => (
            <div key={s} className="flex flex-col gap-1.5">
              <label className={labelClass}>{s} (optional)</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 250"
                value={subjectInputs[s] || ''}
                onChange={e => setSubjectInputs(prev => ({ ...prev, [s]: e.target.value }))}
                className={inputClass}
              />
            </div>
          ))}
        </div>

        <p className={`text-[9px] font-bold uppercase tracking-wider ${dark ? 'text-zinc-700' : 'text-zinc-300'}`}>
          Set total, subject goals, or both. Subject goals are prioritized when mixed.
        </p>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            className="flex-1 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white rounded-lg hover:bg-red-700 transition-all active:scale-95"
          >
            {hasGoal ? 'Update Goal' : 'Set Goal'}
          </button>
          {isEditing && (
            <button
              onClick={() => setIsEditing(false)}
              className={`px-8 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] rounded-lg border transition-all ${dark ? 'border-zinc-800 text-zinc-500 hover:text-zinc-300' : 'border-zinc-200 text-zinc-400'}`}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </section>
  );
};

export default QuestionGoalSection;
