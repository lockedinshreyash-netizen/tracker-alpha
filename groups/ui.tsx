/* ── Groups' shared pieces ──
   The same card, eyebrow, input and button vocabulary the Ranks tab and the
   reminder settings already use, collected once so six files do not each
   restate a ternary on `dark`. Nothing new is invented here; if a class looks
   unfamiliar it is because it was copied from RanksTab.tsx. */

import React, { useEffect } from 'react';
import { GroupRole } from './api';

export const tokens = (dark: boolean) => ({
  card: dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm',
  inset: dark ? 'bg-white/[0.025] border-white/[0.06]' : 'bg-zinc-50 border-zinc-100',
  muted: dark ? 'text-zinc-500' : 'text-zinc-500',
  faint: dark ? 'text-zinc-600' : 'text-zinc-400',
  heading: dark ? 'text-white' : 'text-zinc-900',
  body: dark ? 'text-zinc-300' : 'text-zinc-700',
  rule: dark ? 'border-white/[0.06]' : 'border-zinc-100',
  hover: dark ? 'hover:bg-white/[0.03]' : 'hover:bg-zinc-50',
  input: `w-full px-4 py-3 rounded-lg border text-sm font-ui outline-none transition-colors focus:border-[#E10600] ${dark ? 'bg-[#0B0B0D] border-white/[0.08] text-white placeholder:text-zinc-700' : 'bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400'}`,
  primary: 'bg-[#E10600] text-white hover:bg-[#c90500] shadow-[0_6px_20px_-8px_rgba(225,6,0,0.6)]',
  secondary: dark ? 'bg-white text-black hover:bg-zinc-100' : 'bg-zinc-900 text-zinc-50 hover:bg-zinc-800',
  ghost: dark ? 'border border-white/[0.1] text-zinc-200 hover:bg-white/[0.04]' : 'border border-zinc-200 text-zinc-800 hover:bg-zinc-50',
  disabled: dark ? 'bg-zinc-900 text-zinc-700 cursor-not-allowed' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed',
});

export type Tokens = ReturnType<typeof tokens>;

/* Same button vocabulary as ui/kit.tsx. */
export const btn = 'rounded-lg font-bold uppercase tracking-[0.12em] text-[10px] font-ui transition-all active:scale-[0.97]';

export const Eyebrow: React.FC<{ children: React.ReactNode; dark: boolean; className?: string }> = ({ children, dark, className = '' }) => (
  <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'} ${className}`}>
    {children}
  </p>
);

export const Switch: React.FC<{
  on: boolean;
  onToggle: (v: boolean) => void;
  label: string;
  dark: boolean;
  disabled?: boolean;
}> = ({ on, onToggle, label, dark, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    disabled={disabled}
    onClick={() => onToggle(!on)}
    className={`w-11 h-6 rounded-full flex-shrink-0 transition-colors relative disabled:opacity-40 ${on ? 'bg-[#E10600]' : dark ? 'bg-[#27272a]' : 'bg-zinc-300'}`}
  >
    <span
      className="absolute top-0.5 left-0 w-5 h-5 rounded-full bg-white transition-transform"
      style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
    />
  </button>
);

/** A row of mutually exclusive choices. `role="radiogroup"` so it reads as one control. */
export function Segmented<T extends string>({
  value, options, onChange, dark, label, disabled, size = 'md',
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  dark: boolean;
  label: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex p-1 rounded-lg border ${dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'}`}
    >
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={`flex-1 min-w-0 ${size === 'sm' ? 'py-1.5 text-[9px]' : 'py-2 text-[10px]'} px-2 rounded-md font-black uppercase tracking-[0.1em] font-ui transition-all whitespace-nowrap disabled:opacity-40
              ${active
                ? (dark ? 'bg-white/[0.08] text-white' : 'bg-white text-zinc-900 shadow-sm')
                : (dark ? 'text-zinc-500 hover:text-zinc-300' : 'text-zinc-500 hover:text-zinc-900')}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Owner and admin wear a badge; a member is the default and wears nothing. */
export const RoleBadge: React.FC<{ role: GroupRole; dark: boolean }> = ({ role, dark }) => {
  if (role === 'member') return null;
  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui px-1.5 py-0.5 rounded flex-shrink-0 ${role === 'owner'
        ? 'bg-[#E10600]/10 text-[#E10600]'
        : dark ? 'bg-white/[0.06] text-zinc-400' : 'bg-zinc-50 text-zinc-600'}`}
    >
      {role}
    </span>
  );
};

/** The group's emoji on a tile, or its initial when it has none. */
export const GroupIcon: React.FC<{ icon: string | null; name: string; size: number; dark: boolean }> = ({ icon, name, size, dark }) => (
  <div
    className={`flex items-center justify-center rounded-xl flex-shrink-0 border ${dark ? 'bg-[#16161a] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'}`}
    style={{ width: size, height: size, fontSize: size * 0.5 }}
    aria-hidden="true"
  >
    {icon ? (
      <span className="leading-none">{icon}</span>
    ) : (
      <span className={`font-display leading-none ${dark ? 'text-white' : 'text-zinc-900'}`} style={{ fontSize: size * 0.44 }}>
        {(name.trim()[0] || '?').toUpperCase()}
      </span>
    )}
  </div>
);

/** A bottom sheet on a phone, a centred dialog on desktop. Escape and the scrim close it. */
export const Sheet: React.FC<{
  title: string;
  onClose: () => void;
  dark: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ title, onClose, dark, children, footer }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[210] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm md:px-4 md:py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        className={`w-full md:max-w-md max-h-[92vh] flex flex-col rounded-t-2xl md:rounded-xl border animate-in slide-in-from-bottom-4 fade-in duration-200 ${dark ? 'bg-[#0B0B0D] border-[#27272a]' : 'bg-white border-zinc-200'}`}
      >
        <div className={`flex items-center justify-between px-6 pt-5 pb-4 border-b ${dark ? 'border-white/[0.06]' : 'border-zinc-200'}`}>
          <h2 className={`text-sm font-bold uppercase tracking-[0.16em] font-ui ${dark ? 'text-white' : 'text-zinc-900'}`}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`p-1.5 -mr-1.5 rounded-md ${dark ? 'text-zinc-500 hover:text-white hover:bg-white/[0.04]' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 overflow-y-auto space-y-5">{children}</div>
        {footer && (
          <div className={`sticky bottom-0 px-6 py-4 border-t ${dark ? 'border-white/[0.06] bg-[#0B0B0D]' : 'border-zinc-200 bg-white'}`}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

/** "8h 14m", "42m", "0m". */
export const formatHours = (hours: number): string => {
  const mins = Math.round(hours * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
};

/** 8:31 PM, in IST — the app's clock, whatever the device's zone is. */
export const clock12 = (iso: string): string =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(iso));

/** The calendar day in IST, for chat day dividers. Midnight, not the 04:00 study day — a divider marks the date a message was sent. */
export const istDay = (iso: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(iso));

export const GROUP_ICONS = ['🔥', '⚡', '🎯', '📚', '🧪', '🧮', '🧬', '⚛️', '🏆', '🚀', '💀', '🐺'];
