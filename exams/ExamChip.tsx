/* ── An exam, as a chip ──
   The exam's colour and its short name, with the year when one is given:
   "● BITSAT ’28". Shown wherever a student is named (Ranks, race chat,
   Groups, profiles) so you can see at a glance who is writing what.

   The name is always printed: colour is never the only cue. The colour is a
   tint and a dot, and the text stays in ink (text never wears the series
   colour). An outlined exam (one that shares a hue, content/exams.ts) is drawn
   as an outline with a hollow dot, so it differs by shape too. */

import React from 'react';
import { EXAM_COLORS, examById, type ExamId } from '../content/exams';

interface Props {
  exam: ExamId;
  year?: number | null;
  dark: boolean;
  /** xs for a name in a list or a chat bubble, sm for a profile. */
  size?: 'xs' | 'sm';
  className?: string;
}

export const ExamChip = ({ exam, year, dark, size = 'xs', className = '' }: Props) => {
  const c = EXAM_COLORS[exam];
  if (!c) return null;
  const hue = dark ? c.dark : c.light;
  const label = `${examById(exam).short}${year ? ` ’${String(year).slice(-2)}` : ''}`;
  const xs = size === 'xs';
  return (
    <span
      className={`inline-flex items-center shrink-0 rounded-full font-ui font-bold whitespace-nowrap ${xs ? 'gap-1 h-[18px] px-1.5 text-[10px]' : 'gap-1.5 h-6 px-2.5 text-[11px]'} ${dark ? 'text-zinc-100' : 'text-zinc-800'} ${className}`}
      style={c.outline
        ? { boxShadow: `inset 0 0 0 1.25px ${hue}` }
        : { background: `${hue}${dark ? '33' : '24'}` }}
      title={`${examById(exam).name}${year ? ` ${year}` : ''}`}
    >
      <span
        aria-hidden
        className="rounded-full"
        style={{ width: xs ? 6 : 7, height: xs ? 6 : 7, ...(c.outline ? { boxShadow: `inset 0 0 0 1.5px ${hue}` } : { background: hue }) }}
      />
      {label}
    </span>
  );
};
