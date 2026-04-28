import React, { useState } from 'react';
import { QuestionTrackingState, QSubject } from '../types';
import { getISTDateString } from '../utils';
import { computeEffectiveGoals, getISTWeekBounds, isGoalMidWeek } from './utils';

interface Props {
  questionTracking: QuestionTrackingState;
  onUpdateTracking: (update: Partial<QuestionTrackingState>) => void;
  theme: 'dark' | 'light';
}

const QuestionGoalSection: React.FC<Props> = ({ questionTracking, onUpdateTracking, theme }) => {
  const { weeklyGoalTotal, weeklyGoalBySubject, goalStartDate } = questionTracking;
  const [isEditing, setIsEditing] = useState(false);
  const [totalInput, setTotalInput] = useState(weeklyGoalTotal?.toString() || '');
  const [physicsInput, setPhysicsInput] = useState(weeklyGoalBySubject.physicsGoal?.toString() || '');
  const [chemistryInput, setChemistryInput] = useState(weeklyGoalBySubject.chemistryGoal?.toString() || '');
  const [mathInput, setMathInput] = useState(weeklyGoalBySubject.mathGoal?.toString() || '');

  const dark = theme === 'dark';
  const goals = computeEffectiveGoals(questionTracking);
  const hasGoal = goals.activeSubjects.length > 0;
  const midWeek = isGoalMidWeek(goalStartDate);

  const syncInputsFromState = () => {
    setTotalInput(weeklyGoalTotal?.toString() || '');
    setPhysicsInput(weeklyGoalBySubject.physicsGoal?.toString() || '');
    setChemistryInput(weeklyGoalBySubject.chemistryGoal?.toString() || '');
    setMathInput(weeklyGoalBySubject.mathGoal?.toString() || '');
  };

  const handleSave = () => {
    const total = totalInput.trim() ? parseInt(totalInput) : null;
    const physics = physicsInput.trim() ? parseInt(physicsInput) : null;
    const chemistry = chemistryInput.trim() ? parseInt(chemistryInput) : null;
    const math = mathInput.trim() ? parseInt(mathInput) : null;

    const isNewGoal = !hasGoal;

    onUpdateTracking({
      weeklyGoalTotal: total && total > 0 ? total : null,
      weeklyGoalBySubject: {
        physicsGoal: physics && physics > 0 ? physics : null,
        chemistryGoal: chemistry && chemistry > 0 ? chemistry : null,
        mathGoal: math && math > 0 ? math : null,
      },
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
      weeklyGoalBySubject: { physicsGoal: null, chemistryGoal: null, mathGoal: null },
      weakSubject: null,
      goalStartDate: null,
    });
    setTotalInput('');
    setPhysicsInput('');
    setChemistryInput('');
    setMathInput('');
    setIsEditing(false);
  };

  const inputClass = `w-full p-3 rounded-lg border text-sm font-black uppercase focus:outline-none focus:ring-1 focus:ring-[#E10600] transition-colors ${dark
    ? 'bg-[#0B0B0D] border-zinc-800 text-white placeholder-zinc-700'
    : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-300'
    }`;

  const labelClass = `text-[10px] uppercase font-black tracking-widest ${dark ? 'text-zinc-500' : 'text-zinc-400'}`;

  // --- DISPLAY MODE (goal is set, not editing) ---
  if (hasGoal && !isEditing) {
    return (
      <section className={`p-6 md:p-8 rounded-2xl border transition-all ${dark ? 'bg-[#141417] border-[#1F1F23]' : 'bg-white border-zinc-100 shadow-sm'}`}>
        <div className="flex justify-between items-center mb-6">
          <h3 className={`text-[10px] font-black uppercase tracking-widest ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Weekly Goal
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => { syncInputsFromState(); setIsEditing(true); }}
              className={`text-[9px] font-black uppercase px-3 py-1.5 rounded border transition-all ${dark ? 'border-[#1F1F23] text-zinc-500 hover:border-zinc-600 hover:text-zinc-300' : 'border-zinc-200 text-zinc-400 hover:border-zinc-400'}`}
            >
              Edit
            </button>
            <button
              onClick={handleResetProgress}
              className={`text-[9px] font-black uppercase px-3 py-1.5 rounded border transition-all ${dark ? 'border-[#1F1F23] text-zinc-500 hover:border-yellow-600 hover:text-yellow-500' : 'border-zinc-200 text-zinc-400 hover:border-yellow-500 hover:text-yellow-600'}`}
            >
              Reset
            </button>
            <button
              onClick={handleDeleteGoal}
              className="text-[9px] font-black uppercase px-3 py-1.5 rounded border border-red-900/40 text-red-500/70 hover:bg-red-900/10 hover:text-red-500 transition-all"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Goal Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {goals.totalGoal !== null && (
            <div className={`p-4 rounded-xl border ${dark ? 'bg-[#0B0B0D] border-zinc-900' : 'bg-zinc-50 border-zinc-100'}`}>
              <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>Total</p>
              <p className="text-xl font-black italic">{goals.totalGoal}</p>
            </div>
          )}
          {goals.physics !== null && (
            <div className={`p-4 rounded-xl border ${dark ? 'bg-[#0B0B0D] border-zinc-900' : 'bg-zinc-50 border-zinc-100'}`}>
              <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>Phy</p>
              <p className="text-xl font-black italic">{goals.physics}</p>
            </div>
          )}
          {goals.chemistry !== null && (
            <div className={`p-4 rounded-xl border ${dark ? 'bg-[#0B0B0D] border-zinc-900' : 'bg-zinc-50 border-zinc-100'}`}>
              <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>Chem</p>
              <p className="text-xl font-black italic">{goals.chemistry}</p>
            </div>
          )}
          {goals.math !== null && (
            <div className={`p-4 rounded-xl border ${dark ? 'bg-[#0B0B0D] border-zinc-900' : 'bg-zinc-50 border-zinc-100'}`}>
              <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>Math</p>
              <p className="text-xl font-black italic">{goals.math}</p>
            </div>
          )}
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
    <section className={`p-6 md:p-8 rounded-2xl border transition-all ${dark ? 'bg-[#141417] border-[#1F1F23]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <h3 className={`text-[10px] font-black uppercase tracking-widest mb-6 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
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
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Physics (optional)</label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 250"
              value={physicsInput}
              onChange={e => setPhysicsInput(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Chemistry (optional)</label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 200"
              value={chemistryInput}
              onChange={e => setChemistryInput(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Math (optional)</label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 250"
              value={mathInput}
              onChange={e => setMathInput(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <p className={`text-[9px] font-bold uppercase tracking-wider ${dark ? 'text-zinc-700' : 'text-zinc-300'}`}>
          Set total, subject goals, or both. Subject goals are prioritized when mixed.
        </p>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            className="flex-1 py-3 text-[10px] font-black uppercase tracking-widest bg-[#E10600] text-white rounded-lg hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-900/20"
          >
            {hasGoal ? 'Update Goal' : 'Set Goal'}
          </button>
          {isEditing && (
            <button
              onClick={() => setIsEditing(false)}
              className={`px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all ${dark ? 'border-zinc-800 text-zinc-500 hover:text-zinc-300' : 'border-zinc-200 text-zinc-400'}`}
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
