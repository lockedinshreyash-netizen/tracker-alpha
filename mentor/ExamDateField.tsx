import React from 'react';
import { ExamPreference } from '../types';
import { resolveExamDate } from '../constants';
import { formatDay } from './dates';
import { getISTDateString } from '../utils';

interface Props {
  exam: ExamPreference;
  examDates?: Partial<Record<ExamPreference, string>>;
  onSet: (date: string | null) => void;
  theme: 'dark' | 'light';
  compact?: boolean;
}

/**
 * The student's own exam date, with the app's placeholder as the default.
 *
 * One control, used on Review and in the Mentor, so there is exactly one way
 * to set it and one place it is stored (`AppState.examDates`). Clearing it
 * falls back to the default rather than to nothing — every countdown in the
 * app needs a date.
 */
const ExamDateField: React.FC<Props> = ({ exam, examDates, onSet, theme, compact }) => {
  const dark = theme === 'dark';
  const resolved = resolveExamDate(exam, examDates);
  const today = getISTDateString();

  return (
    <div className={`flex flex-wrap items-center gap-3 ${compact ? '' : 'mt-4'}`}>
      <label className="flex items-center gap-2">
        <span className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
          {exam} exam date
        </span>
        <input
          type="date"
          value={resolved.date}
          min={today}
          onChange={e => {
            const v = e.target.value;
            if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v > today) onSet(v);
          }}
          className={`px-3 py-1.5 rounded-md border text-xs font-ui outline-none focus:border-[#E10600] ${dark ? 'bg-[#0D0D10] border-white/[0.08] text-white [color-scheme:dark]' : 'bg-[#F2F0EC] border-[#E3E0D9] text-[#17150F]'}`}
          aria-label={`${exam} exam date`}
        />
      </label>
      {resolved.isDefault ? (
        <span className={`text-[9px] font-bold uppercase tracking-wider ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>
          App default ({formatDay(resolved.date)}) — set yours
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onSet(null)}
          className={`text-[9px] font-bold uppercase tracking-wider underline underline-offset-2 ${dark ? 'text-zinc-500 hover:text-white' : 'text-zinc-500 hover:text-black'}`}
        >
          Reset to default
        </button>
      )}
    </div>
  );
};

export default ExamDateField;
