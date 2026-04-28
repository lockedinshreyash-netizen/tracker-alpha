import React, { useState, useEffect } from 'react';
import { QSubject, QuestionTrackingState } from '../types';
import { getTodayProgress, computeDailyTargets, computeEffectiveGoals } from './utils';

interface Props {
  questionTracking: QuestionTrackingState;
  onLogQuestions: (subject: QSubject, count: number) => void;
  theme: 'dark' | 'light';
}

const TodayQuestionsSection: React.FC<Props> = ({ questionTracking, onLogQuestions, theme }) => {
  const [selectedSubject, setSelectedSubject] = useState<QSubject>('physics');
  const [manualInput, setManualInput] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [animatedTotal, setAnimatedTotal] = useState(0);

  const todayProgress = getTodayProgress(questionTracking.dailyQuestionsLog);
  const targets = computeDailyTargets(questionTracking);
  const goals = computeEffectiveGoals(questionTracking);
  const hasGoal = goals.activeSubjects.length > 0;
  const remaining = Math.max(0, targets.total - todayProgress.total);

  // Animate counter
  useEffect(() => {
    const diff = todayProgress.total - animatedTotal;
    if (diff === 0) return;
    const step = diff > 0 ? 1 : -1;
    const interval = setInterval(() => {
      setAnimatedTotal(prev => {
        const next = prev + step;
        if ((step > 0 && next >= todayProgress.total) || (step < 0 && next <= todayProgress.total)) {
          clearInterval(interval);
          return todayProgress.total;
        }
        return next;
      });
    }, 30);
    return () => clearInterval(interval);
  }, [todayProgress.total]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const handleAdd = (count: number) => {
    if (count <= 0) return;
    onLogQuestions(selectedSubject, count);
    setToast(`+${count} questions added`);
  };

  const handleManualSubmit = () => {
    const val = parseInt(manualInput);
    if (!isNaN(val) && val > 0) {
      handleAdd(val);
      setManualInput('');
    }
  };

  const subjects: { key: QSubject; label: string }[] = [
    { key: 'physics', label: 'PHY' },
    { key: 'chemistry', label: 'CHEM' },
    { key: 'math', label: 'MATH' },
  ];

  const dark = theme === 'dark';

  return (
    <section className={`p-6 md:p-10 rounded-2xl border relative overflow-hidden transition-all ${dark ? 'bg-[#141417] border-[#1F1F23]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      {/* Toast */}
      {toast && (
        <div className="absolute top-4 right-4 z-30 px-4 py-2 rounded-lg bg-[#E10600] text-white text-[10px] font-black uppercase tracking-widest animate-slide-up">
          {toast}
        </div>
      )}

      {/* Large Counter */}
      <div className="text-center mb-8">
        <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-4 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          Questions Solved Today
        </p>
        <p className="text-8xl md:text-9xl font-black italic tracking-tighter leading-none tabular-nums">
          {animatedTotal}
        </p>
      </div>

      {/* Target / Completed / Remaining row */}
      {hasGoal && targets.total > 0 && (
        <div className={`grid grid-cols-3 gap-3 mb-8 p-4 rounded-xl border ${dark ? 'bg-[#0B0B0D] border-zinc-900' : 'bg-zinc-50 border-zinc-100'}`}>
          <div className="text-center">
            <p className="text-lg md:text-xl font-black italic text-[#E10600]">{targets.total}</p>
            <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>🎯 Target</p>
          </div>
          <div className="text-center">
            <p className="text-lg md:text-xl font-black italic">{todayProgress.total}</p>
            <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>✅ Done</p>
          </div>
          <div className="text-center">
            <p className={`text-lg md:text-xl font-black italic ${remaining > 0 ? (dark ? 'text-yellow-500' : 'text-yellow-600') : 'text-green-500'}`}>{remaining}</p>
            <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>{remaining > 0 ? '⏳ Left' : '🎉 Done!'}</p>
          </div>
        </div>
      )}

      {/* Subject Selector */}
      <div className="flex justify-center gap-2 mb-5">
        {subjects.map(s => (
          <button
            key={s.key}
            onClick={() => setSelectedSubject(s.key)}
            className={`px-5 md:px-6 py-2.5 text-[10px] font-black uppercase tracking-widest border rounded-lg transition-all ${selectedSubject === s.key
              ? 'bg-[#E10600] border-[#E10600] text-white shadow-lg shadow-red-900/20'
              : (dark ? 'border-[#1F1F23] text-zinc-500 hover:border-zinc-700' : 'border-zinc-200 text-zinc-400 hover:border-zinc-300')
              }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Quick Add + Manual Input */}
      <div className="flex justify-center gap-2 mb-3">
        {[1, 5, 10].map(n => (
          <button
            key={n}
            onClick={() => handleAdd(n)}
            className={`px-6 md:px-8 py-3 text-[11px] font-black border rounded-lg transition-all active:scale-95 ${dark
              ? 'bg-[#0B0B0D] border-[#2F2F33] text-white hover:border-[#E10600]'
              : 'bg-zinc-50 border-zinc-200 text-black hover:border-[#E10600]'
              }`}
          >
            +{n}
          </button>
        ))}
      </div>
      <div className="flex gap-2 max-w-xs mx-auto">
        <input
          type="number"
          min="1"
          placeholder="CUSTOM"
          value={manualInput}
          onChange={e => setManualInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
          className={`flex-1 text-xs p-3 focus:outline-none focus:ring-1 focus:ring-[#E10600] font-bold uppercase border rounded-lg transition-colors text-center ${dark
            ? 'bg-[#0B0B0D] border-[#2F2F33] text-white placeholder-zinc-700'
            : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-300'
            }`}
        />
        <button
          onClick={handleManualSubmit}
          className="px-6 py-3 text-[10px] font-black uppercase bg-[#E10600] text-white rounded-lg hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-900/20"
        >
          Add
        </button>
      </div>
    </section>
  );
};

export default TodayQuestionsSection;
