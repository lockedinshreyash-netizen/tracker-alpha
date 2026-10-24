/* ── The store editors' form pieces ──
   Shared by the sheet editor, the kit editor and the formula import, in the
   pack editor's manner (decks/PackSheet.tsx): a selected option is ink on the
   page, never the action red, and a subject choice wears its own colour. */

import React from 'react';
import { deckAccent } from '../../decks/theme';
import type { DeckSubject, PackAccess } from '../../decks/types';

export const SUBJECTS: DeckSubject[] = ['Physics', 'Chemistry', 'Maths', 'Biology'];

export const inputCls = (dark: boolean) => `w-full rounded-xl px-4 outline-none font-ui ${dark
  ? 'bg-white/[0.03] text-white ring-1 ring-inset ring-white/[0.08] focus:ring-white/[0.25] placeholder:text-zinc-700'
  : 'bg-white text-zinc-900 ring-1 ring-inset ring-zinc-200 focus:ring-zinc-400 placeholder:text-zinc-300'}`;
export const labelCls = (dark: boolean) => `block text-[10px] font-bold uppercase tracking-[0.08em] font-ui mb-2.5 ${dark ? 'text-zinc-500' : 'text-zinc-400'}`;
export const optional = <span className="normal-case tracking-normal font-semibold opacity-70">· optional</span>;
export const choice = (on: boolean, dark: boolean) => `text-left rounded-xl px-3.5 py-3 transition-all ${on
  ? (dark ? 'bg-white/[0.06] ring-2 ring-white' : 'bg-white ring-2 ring-zinc-900')
  : dark ? 'ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.03]' : 'ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50'}`;

export const ArrowUp = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 15 6-6 6 6" /></svg>;
export const ArrowDown = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>;
export const Cross = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>;

export const IconBtn = ({ dark, label, disabled, onClick, children }: { dark: boolean; label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-25 disabled:pointer-events-none ${dark ? 'text-zinc-400 hover:text-white hover:bg-white/[0.06]' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'}`}
  >
    {children}
  </button>
);

export const SubjectPick = ({ dark, value, onChange, noneLabel = 'None', label = 'Subject' }: {
  dark: boolean; value: DeckSubject | null; onChange: (s: DeckSubject | null) => void; noneLabel?: string; label?: string;
}) => (
  <div role="radiogroup" aria-label={label}>
    <p className={labelCls(dark)}>{label}</p>
    <div className="flex flex-wrap gap-2">
      {[...SUBJECTS, null].map(s => {
        const on = value === s;
        const c = s ? deckAccent(s, dark) : dark ? '#e4e4e7' : '#27272a';
        return (
          <button key={s ?? 'none'} type="button" role="radio" aria-checked={on} onClick={() => onChange(s)}
            className={`h-10 pl-3 pr-4 rounded-full flex items-center gap-2 text-[13px] font-semibold transition-all ${on ? '' : dark ? 'text-zinc-400 ring-1 ring-inset ring-white/[0.08] hover:text-zinc-200' : 'text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:text-zinc-900'}`}
            style={on ? { background: `${c}22`, boxShadow: `inset 0 0 0 1.5px ${c}`, color: dark ? '#fff' : '#18181b' } : undefined}>
            <span className="w-2 h-2 rounded-full" style={{ background: c }} />
            {s ?? noneLabel}
          </button>
        );
      })}
    </div>
  </div>
);

/** Free / paid (with its price) / Alpha Pro. Payments are not live, and it says so. */
export const AccessPick = ({ dark, access, onAccess, price, onPrice, noun }: {
  dark: boolean; access: PackAccess; onAccess: (a: PackAccess) => void; price: string; onPrice: (p: string) => void; noun: string;
}) => {
  const heading = dark ? 'text-white' : 'text-zinc-900';
  const faint = dark ? 'text-zinc-600' : 'text-zinc-400';
  return (
    <div role="radiogroup" aria-label="How do students get it?">
      <p className={labelCls(dark)}>How do students get it?</p>
      <div className="grid grid-cols-3 gap-2">
        {([
          { v: 'free', t: 'Free', l: 'Anyone can add it.' },
          { v: 'paid', t: 'Paid', l: 'A one-time price.' },
          { v: 'pro', t: 'Alpha Pro', l: 'Included with Pro.' },
        ] as const).map(o => (
          <button key={o.v} type="button" role="radio" aria-checked={access === o.v} onClick={() => onAccess(o.v)} className={choice(access === o.v, dark)}>
            <span className={`block text-[14px] font-bold ${heading}`}>{o.t}</span>
            <span className="block text-[12px] mt-0.5 text-zinc-500">{o.l}</span>
          </button>
        ))}
      </div>
      {access === 'paid' && (
        <div className="mt-3 flex items-center gap-3 mk-sheet">
          <label className={`flex items-center h-11 w-[140px] shrink-0 rounded-xl px-4 ${dark ? 'bg-white/[0.03] ring-1 ring-inset ring-white/[0.08]' : 'bg-white ring-1 ring-inset ring-zinc-200'}`}>
            <span className={`text-[16px] font-bold ${faint}`}>₹</span>
            <input inputMode="numeric" value={price} onChange={e => onPrice(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))} aria-label="Price in rupees" className={`bg-transparent outline-none text-[16px] font-bold w-full ml-1.5 ${heading}`} />
          </label>
          <p className="text-[12px] text-zinc-500 leading-snug">Payments aren't live yet. Until they are, nobody can take a paid {noun}.</p>
        </div>
      )}
      {access === 'pro' && <p className="text-[12px] text-zinc-500 mt-3">Alpha Pro isn't live yet. Pro {noun}s open for members once it is.</p>}
    </div>
  );
};

/** Two or three options as one control. */
export function Segment<T extends string>({ dark, value, onChange, options }: { dark: boolean; value: T; onChange: (v: T) => void; options: [NoInfer<T>, string, boolean][] }) {
  return (
    <div className={`inline-flex flex-wrap p-1 rounded-xl ${dark ? 'bg-white/[0.04]' : 'bg-zinc-100'}`}>
      {options.map(([v, label, disabled]) => (
        <button
          key={v}
          type="button"
          disabled={disabled}
          onClick={() => onChange(v)}
          className={`h-9 px-4 rounded-lg text-[13px] font-semibold transition-all disabled:opacity-35 ${value === v ? (dark ? 'bg-[#1c1c21] text-white shadow-sm' : 'bg-white text-zinc-900 shadow-sm') : 'text-zinc-500'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
