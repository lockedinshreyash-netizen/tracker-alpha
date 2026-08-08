import React, { useMemo } from 'react';
import { AppState, ExamPreference, Subject } from '../types';
import { buildRecommendations, Recommendation } from './recommend';

interface Props {
  state: AppState;
  exam: ExamPreference;
  activeSubjects: Subject[];
  theme: 'dark' | 'light';
  /** Loads the recommendation into the timer and starts it. */
  onEngage: (rec: Recommendation) => void;
  onDismiss: (rec: Recommendation) => void;
}

const ACTION_LABEL: Record<Recommendation['action'], string> = {
  revise: 'Revise',
  finish: 'Finish',
  start: 'Start',
  drill: 'Drill',
};

/**
 * The "I don't know what to study" card. One instruction, its reason, and the
 * two runners-up so it never reads as a black box.
 */
const CoachCard: React.FC<Props> = ({ state, exam, activeSubjects, theme, onEngage, onDismiss }) => {
  const recs = useMemo(
    () => buildRecommendations({ state, exam, activeSubjects }),
    [state, exam, activeSubjects],
  );

  if (!recs.length) return null;
  const [top, ...rest] = recs;
  const dark = theme === 'dark';

  return (
    <div className={`mb-6 rounded-xl border overflow-hidden ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
      <div className={`px-6 pt-5 pb-5 ${dark ? 'bg-[#E10600]/[0.05]' : 'bg-red-50/60'}`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#E10600] font-ui">
            No idea what to do?
          </p>
          <span className={`text-[9px] font-bold uppercase tracking-[0.08em] px-2 py-1 rounded border tabular-nums ${dark ? 'border-white/[0.12] text-zinc-400' : 'border-zinc-300 text-zinc-500'}`}>
            {top.minutes} min · {ACTION_LABEL[top.action]}
          </span>
        </div>

        <h3 className={`text-lg md:text-xl font-black uppercase leading-tight tracking-tight mb-2 ${dark ? 'text-white' : 'text-black'}`}>
          {top.headline}
        </h3>
        <p className={`text-[12px] leading-relaxed font-ui mb-3 ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>
          {top.method}
        </p>
        <p className="text-[10px] text-zinc-500 font-ui uppercase tracking-[0.04em]">{top.reason}</p>

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => onEngage(top)}
            className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md bg-[#E10600] text-white hover:bg-[#c40500] transition-colors active:scale-97"
          >
            Engage
          </button>
          <button
            onClick={() => onDismiss(top)}
            className={`px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] rounded-md border transition-colors active:scale-97 ${dark ? 'border-white/[0.12] text-zinc-500 hover:text-zinc-300' : 'border-zinc-300 text-zinc-500 hover:text-zinc-700'}`}
          >
            Not now
          </button>
        </div>
      </div>

      {rest.length > 0 && (
        <div className={`px-6 py-3 border-t ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600 mb-2 font-ui">Or</p>
          <div className="space-y-1.5">
            {rest.map((r) => (
              <button
                key={r.id}
                onClick={() => onEngage(r)}
                className="w-full text-left flex items-center justify-between gap-3 group"
              >
                <span className={`text-[11px] font-ui truncate ${dark ? 'text-zinc-400 group-hover:text-zinc-200' : 'text-zinc-600 group-hover:text-black'}`}>
                  {r.headline}
                </span>
                <span className="text-[9px] text-zinc-600 shrink-0 tabular-nums font-ui">{r.minutes} min</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachCard;
