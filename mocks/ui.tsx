/* ── Mocks' shared pieces ──
   The card, eyebrow, chip and sheet vocabulary of the Mocks tab, collected
   once. Card styling is the house style the Plan tab took from the old Questions
   tab: `bg-[#111114] border-white/[0.06]` dark, `bg-white border-zinc-100
   shadow-sm` light, eyebrows in small caps, muted text on the zinc scale.
   Every colour that carries data (an exam, a subject) is an inline style —
   CDN Tailwind compiles `bg-[${hex}]` to nothing. */

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MockExam, MockScope, Subject } from '../types';
import { SUBJECT_COLORS } from '../schedule/colors';
import { SCOPES, examColor, paperShort } from './model';

export const tokens = (dark: boolean) => ({
  card: dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm',
  inset: dark ? 'bg-white/[0.025] border-white/[0.06]' : 'bg-zinc-50 border-zinc-100',
  heading: dark ? 'text-white' : 'text-zinc-900',
  body: dark ? 'text-zinc-300' : 'text-zinc-700',
  muted: dark ? 'text-zinc-500' : 'text-zinc-500',
  faint: dark ? 'text-zinc-600' : 'text-zinc-400',
  rule: dark ? 'border-white/[0.06]' : 'border-zinc-100',
  hover: dark ? 'hover:bg-white/[0.03]' : 'hover:bg-zinc-50',
  input: `w-full px-3.5 py-2.5 rounded-lg border text-sm font-ui outline-none transition-colors focus:border-[#E10600] ${
    dark ? 'bg-[#0B0B0D] border-white/[0.08] text-white placeholder:text-zinc-700' : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'
  }`,
  primary: 'bg-[#E10600] text-white hover:bg-[#c90500] shadow-[0_6px_20px_-8px_rgba(225,6,0,0.6)]',
  ghost: dark ? 'border border-white/[0.1] text-zinc-200 hover:bg-white/[0.04]' : 'border border-zinc-200 text-zinc-800 hover:bg-zinc-50',
  grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(24,24,27,0.07)',
  axis: dark ? '#71717a' : '#a1a1aa',
  surface: dark ? '#111114' : '#ffffff',
});
export type Tokens = ReturnType<typeof tokens>;

export const btn = 'inline-flex items-center justify-center gap-2 rounded-lg font-bold uppercase tracking-[0.12em] text-[10px] font-ui transition-all active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none';

export const Eyebrow: React.FC<{ children: React.ReactNode; dark: boolean; className?: string }> = ({ children, dark, className = '' }) => (
  <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'} ${className}`}>{children}</p>
);

export const Card: React.FC<{
  dark: boolean;
  className?: string;
  children: React.ReactNode;
  delay?: number;
  as?: 'section' | 'div';
}> = ({ dark, className = '', children, delay = 0, as = 'section' }) => {
  const Tag = as;
  return (
    <Tag className={`mk-rise rounded-xl border ${tokens(dark).card} ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </Tag>
  );
};

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

/** A toggle chip. Selected chips can wear a colour of their own (an exam, a subject). */
export const Chip: React.FC<{
  on: boolean;
  onClick: () => void;
  dark: boolean;
  children: React.ReactNode;
  color?: string;
  title?: string;
  className?: string;
  disabled?: boolean;
}> = ({ on, onClick, dark, children, color, title, className = '', disabled }) => {
  const style = on && color ? { borderColor: color, background: `${color}1f`, color: dark ? '#fff' : '#18181b' } : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      aria-pressed={on}
      style={style}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-ui font-semibold transition-all active:scale-[0.96] disabled:opacity-40 ${
        on && !color
          ? dark ? 'bg-white text-black border-white' : 'bg-zinc-900 text-white border-zinc-900'
          : on ? '' : dark ? 'border-white/[0.08] text-zinc-400 hover:text-zinc-200 hover:border-white/[0.16]' : 'border-zinc-200 text-zinc-600 hover:text-zinc-900 hover:border-zinc-300'
      } ${className}`}
    >
      {children}
    </button>
  );
};

/** Mutually exclusive options as one control. */
export function Segmented<T extends string>({
  value, options, onChange, dark, label, full,
}: {
  value: T;
  options: { value: T; label: React.ReactNode; hint?: string }[];
  onChange: (v: T) => void;
  dark: boolean;
  label: string;
  full?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`${full ? 'flex' : 'inline-flex'} p-1 rounded-lg border ${dark ? 'bg-[#0B0B0D] border-white/[0.06]' : 'bg-zinc-100/70 border-zinc-100'}`}>
      {options.map(o => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={`${full ? 'flex-1' : ''} px-3 py-1.5 rounded-md text-[12px] font-ui font-bold transition-all flex items-center justify-center gap-1.5 ${
              on ? dark ? 'bg-[#1c1c21] text-white shadow-sm' : 'bg-white text-zinc-900 shadow-sm' : dark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Rendered into document.body, not in place. <main> is `relative z-20`, a
 * stacking context of its own, so anything fixed inside it — however high its
 * z-index — still paints under the z-50 rail and the phone's top bar.
 */
export const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined' ? <>{children}</> : createPortal(children, document.body);

/**
 * Bottom sheet on a phone, centred panel on desktop — the BlockEditor shell.
 * Escape closes; the body behind it does not scroll.
 */
export const Sheet: React.FC<{
  dark: boolean;
  onClose: () => void;
  label: string;
  width?: string;
  header: React.ReactNode;
  footer: React.ReactNode;
  children: React.ReactNode;
}> = ({ dark, onClose, label, width = 'md:w-[560px]', header, footer, children }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <Overlay>
    <div className={`fixed inset-0 z-[120] flex items-end md:items-center justify-center font-ui`} role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] mk-fade" onClick={onClose} />
      <div className={`mk-sheet relative w-full ${width} md:rounded-2xl rounded-t-2xl border max-h-[92vh] flex flex-col overflow-hidden ${dark ? 'bg-[#111114] border-white/[0.08]' : 'bg-white border-zinc-100 shadow-2xl'}`}>
        <div className={`shrink-0 border-b ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>{header}</div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        <div className={`shrink-0 border-t px-5 md:px-7 py-4 ${dark ? 'border-white/[0.06] bg-[#111114]' : 'border-zinc-100 bg-white'}`}>{footer}</div>
      </div>
    </div>
    </Overlay>
  );
};

export const Field: React.FC<{ label: string; dark: boolean; hint?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ label, dark, hint, children, className = '' }) => (
  <div className={className}>
    <div className="flex items-baseline justify-between gap-3 mb-2">
      <Eyebrow dark={dark}>{label}</Eyebrow>
      {hint && <span className={`text-[11px] font-ui ${dark ? 'text-zinc-600' : 'text-zinc-400'}`}>{hint}</span>}
    </div>
    {children}
  </div>
);

export const pct = (x: number | null | undefined, digits = 0): string =>
  x === null || x === undefined ? '—' : `${(Math.round(x * 10 ** digits) / 10 ** digits).toFixed(digits)}%`;

export const signedPct = (x: number, digits = 1): string =>
  `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 10 ** digits) / 10 ** digits).toFixed(digits)}`;

/** Up is good here, always — a score, an accuracy, a percentile. */
export const deltaTone = (x: number, dark: boolean) =>
  x > 0.05 ? (dark ? 'text-emerald-400' : 'text-emerald-600') : x < -0.05 ? (dark ? 'text-rose-400' : 'text-rose-600') : dark ? 'text-zinc-500' : 'text-zinc-400';
