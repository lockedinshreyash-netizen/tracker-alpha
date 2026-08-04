import React, { useState, useEffect } from 'react';
import { QSubject, QuestionTrackingState } from '../types';
import { getTodayProgress, computeDailyTargets, computeEffectiveGoals } from './utils';

interface Props {
  questionTracking: QuestionTrackingState;
  onLogQuestions: (subject: QSubject, count: number) => void;
  theme: 'dark' | 'light';
  coreSubjects: QSubject[];
}

const TodayQuestionsSection: React.FC<Props> = ({ questionTracking, onLogQuestions, theme, coreSubjects }) => {
  const [selectedSubject, setSelectedSubject] = useState<QSubject>('physics');
  const [manualInput, setManualInput] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [animatedTotal, setAnimatedTotal] = useState(0);

  const todayProgress = getTodayProgress(questionTracking.dailyQuestionsLog);
  const targets = computeDailyTargets(questionTracking, coreSubjects);
  const goals = computeEffectiveGoals(questionTracking, coreSubjects);
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

  const subjects: { key: QSubject; label: string }[] = coreSubjects.map(s => ({
    key: s,
    label: s.substring(0, 4).toUpperCase()
  }));

  const dark = theme === 'dark';

  return (
    <section className={`p-8 md:p-12 rounded-xl border relative overflow-hidden transition-all ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      {/* Toast */}
      {toast && (
        <div className="absolute top-4 right-4 z-30 px-4 py-2 rounded-md bg-[#E10600] text-white text-[10px] font-medium uppercase tracking-[0.06em] animate-slide-up">
          {toast}
        </div>
      )}

      {/* Large Counter */}
      <div className="text-center mb-8">
        <p className={`text-[10px] font-semibold uppercase tracking-[0.2em] mb-4 font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          Questions Solved Today
        </p>
        <p className="text-8xl md:text-9xl tracking-tighter leading-none tabular-nums num-hero">
          {animatedTotal}
        </p>
      </div>

      {/* Target / Completed / Remaining row */}
      {hasGoal && targets.total > 0 && (
        <div className={`grid grid-cols-3 gap-3 mb-8 p-4 rounded-lg border ${dark ? 'bg-[#0D0D10] border-white/[0.04]' : 'bg-zinc-50 border-zinc-100'}`}>
          <div className="text-center">
            <p className="text-lg md:text-xl num-stat text-[#E10600]">{targets.total}</p>
            <p className={`text-[8px] font-medium uppercase tracking-[0.06em] mt-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>🎯 Target</p>
          </div>
          <div className="text-center">
            <p className="text-lg md:text-xl num-stat">{todayProgress.total}</p>
            <p className={`text-[8px] font-medium uppercase tracking-[0.06em] mt-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>✅ Done</p>
          </div>
          <div className="text-center">
            <p className={`text-lg md:text-xl num-stat ${remaining > 0 ? (dark ? 'text-yellow-500' : 'text-yellow-600') : 'text-green-500'}`}>{remaining}</p>
            <p className={`text-[8px] font-medium uppercase tracking-[0.06em] mt-1 ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>{remaining > 0 ? '⏳ Left' : '🎉 Done!'}</p>
          </div>
        </div>
      )}

      {/* Subject Selector */}
      <div className="flex justify-center gap-2 mb-5">
        {subjects.map(s => (
          <button
            key={s.key}
            onClick={() => setSelectedSubject(s.key)}
            className={`px-6 md:px-8 py-3 text-[10px] font-medium uppercase tracking-[0.08em] border rounded-md transition-all ${selectedSubject === s.key
              ? 'bg-[#E10600] border-[#E10600] text-white'
              : (dark ? 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12]' : 'border-zinc-200 text-zinc-400 hover:border-zinc-300')
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
            className={`px-8 md:px-10 py-3.5 text-[11px] font-bold border rounded-md transition-all active:scale-95 tracking-[0.06em] ${dark
              ? 'bg-[#0D0D10] border-white/[0.06] text-white hover:border-white/[0.12]'
              : 'bg-zinc-50 border-zinc-200 text-black hover:border-zinc-300'
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
          className={`flex-1 text-xs p-3 focus:outline-none focus:ring-1 focus:ring-white/20 font-bold uppercase border rounded-md transition-colors text-center ${dark
            ? 'bg-[#0D0D10] border-white/[0.06] text-white placeholder-zinc-700'
            : 'bg-zinc-50 border-zinc-200 text-black placeholder-zinc-300'
            }`}
        />
        <button
          onClick={handleManualSubmit}
          className="px-8 py-3.5 text-[10px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white rounded-md hover:bg-red-700 transition-all active:scale-95"
        >
          Add
        </button>
      </div>
    </section>
  );
};

export default TodayQuestionsSection;
