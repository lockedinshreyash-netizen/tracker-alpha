/* ── Mocks' own pieces ──
   Badges and glyphs that only mean something on the Mocks tab. The general
   vocabulary (cards, chips, sheets, buttons) lives in ui/kit.tsx and is
   re-exported here so the tab's imports stay where they were. */

import React from 'react';
import { MockExam, MockScope, Subject } from '../types';
import { SUBJECT_COLORS } from '../schedule/colors';
import { SCOPES, examColor, paperShort } from './model';

export * from '../ui/kit';

export const subjectDot = (subject: Subject) => (SUBJECT_COLORS[subject] ?? SUBJECT_COLORS.General).dot;

/** `paperName` replaces the label for an "Other" paper the student named. */
export const ExamBadge: React.FC<{ exam: MockExam; paperName?: string; dark: boolean; size?: 'sm' | 'md' }> = ({ exam, paperName, dark, size = 'sm' }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border font-ui font-bold max-w-[160px] ${size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'} ${dark ? 'border-white/[0.08] text-zinc-300' : 'border-zinc-200 text-zinc-700'}`}>
    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: examColor(exam, dark) }} />
    <span className="truncate">{paperShort({ exam, paperName })}</span>
  </span>
);

/** The marker shape a scope is drawn with in every chart — repeated on the badge so it is learnable. */
export const ScopeGlyph: React.FC<{ scope: MockScope; color: string; size?: number; surface: string }> = ({ scope, color, size = 10, surface }) => {
  const r = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="shrink-0">
      {scope === 'full' && <circle cx={r} cy={r} r={r - 0.5} fill={color} />}
      {scope === 'part' && <circle cx={r} cy={r} r={r - 1.5} fill={surface} stroke={color} strokeWidth={2} />}
      {scope === 'chapter' && <rect x={r - r * 0.7} y={r - r * 0.7} width={r * 1.4} height={r * 1.4} fill={color} transform={`rotate(45 ${r} ${r})`} />}
    </svg>
  );
};

export const ScopeBadge: React.FC<{ scope: MockScope; dark: boolean; size?: 'sm' | 'md' }> = ({ scope, dark, size = 'sm' }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full border font-ui font-bold ${size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'} ${dark ? 'border-white/[0.08] text-zinc-400' : 'border-zinc-200 text-zinc-600'}`}>
    <ScopeGlyph scope={scope} color={dark ? '#a1a1aa' : '#71717a'} size={8} surface={dark ? '#111114' : '#ffffff'} />
    {SCOPES[scope].short}
  </span>
);

