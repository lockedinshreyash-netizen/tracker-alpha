import React from 'react';
import { QuestionTrackingState, QSubject } from '../types';
import { computeEffectiveGoals } from './utils';

interface Props {
  questionTracking: QuestionTrackingState;
  onUpdateTracking: (update: Partial<QuestionTrackingState>) => void;
  theme: 'dark' | 'light';
  coreSubjects: QSubject[];
}

const WeakSubjectSection: React.FC<Props> = ({ questionTracking, onUpdateTracking, theme, coreSubjects }) => {
  const goals = computeEffectiveGoals(questionTracking);
  if (goals.activeSubjects.length === 0) return null;

  const dark = theme === 'dark';
  const current = questionTracking.weakSubject;

  const options: { key: QSubject | null; label: string }[] = [
    { key: null, label: 'None' },
    ...coreSubjects.map(s => ({ key: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))
  ];

  const handleSelect = (key: QSubject | null) => {
    onUpdateTracking({ weakSubject: key });
  };

  return (
    <section className={`p-8 md:p-10 rounded-2xl border transition-all ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <h3 className={`text-[10px] font-medium uppercase tracking-[0.06em] mb-1 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
        Focus Boost (optional)
      </h3>
      <p className={`text-[9px] font-bold uppercase tracking-wider mb-5 ${dark ? 'text-zinc-700' : 'text-zinc-300'}`}>
        Allocate 1.4× weight to your weak subject
      </p>

      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt.label}
            onClick={() => handleSelect(opt.key)}
            className={`px-5 md:px-8 py-3 text-[10px] font-medium uppercase tracking-[0.08em] border rounded-lg transition-all active:scale-95 ${current === opt.key
              ? 'bg-[#E10600] border-[#E10600] text-white'
              : (dark
                ? 'border-white/[0.06] text-zinc-500 hover:border-white/[0.12]'
                : 'border-zinc-200 text-zinc-400 hover:border-zinc-300')
              }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  );
};

export default WeakSubjectSection;
