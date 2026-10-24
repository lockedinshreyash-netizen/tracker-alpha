/* ── Filter the store ──
   One icon at the right of the page heading. Nothing about the filter takes
   room on the page until it is asked for: a tap opens a sheet (a bottom sheet
   on a phone, a panel on a laptop) with the two questions, what kind of thing
   and which subject, and Show applies them. While a filter is on, the icon
   carries how many of the two are set, so a page with less on it never looks
   like a store with less in it.

   A chosen type is ink; a chosen subject wears its own colour, as subjects do
   everywhere (schedule/colors.ts). */

import React, { useState } from 'react';
import { Sheet, tokens } from '../ui/kit';
import { deckAccent } from '../decks/theme';
import { Icon, pill } from '../decks/ui';
import type { ExamPreference } from '../types';
import { ALL, TYPES, subjectsFor, type StoreFilter } from './filter';

const FilterIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" />
  </svg>
);

interface Props {
  value: StoreFilter;
  onChange: (f: StoreFilter) => void;
  exam: ExamPreference;
  dark: boolean;
}

export const StoreFilterButton = ({ value, onChange, exam, dark }: Props) => {
  const t = tokens(dark);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<StoreFilter>(value);
  const set = (value.type !== 'all' ? 1 : 0) + (value.subject !== 'all' ? 1 : 0);

  const option = (on: boolean, color?: string) => ({
    className: `w-full flex items-center gap-3 h-12 px-4 rounded-xl text-left text-[14px] font-semibold transition-colors ${on
      ? (color ? '' : dark ? 'bg-white text-black' : 'bg-zinc-900 text-white')
      : dark ? 'text-zinc-300 hover:bg-white/[0.04] ring-1 ring-inset ring-white/[0.07]' : 'text-zinc-700 hover:bg-zinc-50 ring-1 ring-inset ring-zinc-200'}`,
    style: on && color ? { background: `${color}22`, boxShadow: `inset 0 0 0 1.5px ${color}`, color: dark ? '#fff' : '#18181b' } : undefined,
  });
  const check = (on: boolean) => <span className="ml-auto">{on ? Icon.check : null}</span>;

  return (
    <>
      <button
        onClick={() => { setDraft(value); setOpen(true); }}
        aria-label={set ? `Filter, ${set} on` : 'Filter'}
        aria-haspopup="dialog"
        className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-95 ${dark ? 'text-zinc-200 bg-white/[0.06] hover:bg-white/[0.1] ring-1 ring-inset ring-white/[0.08]' : 'text-zinc-800 bg-white hover:bg-zinc-50 ring-1 ring-inset ring-zinc-200 shadow-sm'}`}
      >
        {FilterIcon}
        {set > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center ${dark ? 'bg-white text-black' : 'bg-zinc-900 text-white'}`}>{set}</span>
        )}
      </button>

      {open && (
        <Sheet
          dark={dark}
          onClose={() => setOpen(false)}
          label="Filter the store"
          width="md:w-[460px]"
          header={
            <div className="px-5 md:px-7 py-4 flex items-center justify-between gap-4">
              <p className={`font-display text-[20px] ${t.heading}`}>Filter</p>
              <button onClick={() => setDraft(ALL)} disabled={draft.type === 'all' && draft.subject === 'all'} className={pill.quiet(dark)}>Clear</button>
            </div>
          }
          footer={
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className={pill.quiet(dark)}>Cancel</button>
              <button onClick={() => { onChange(draft); setOpen(false); }} className={pill.red}>Show</button>
            </div>
          }
        >
          <div className="px-5 md:px-7 py-6 space-y-7 font-ui">
            <div role="radiogroup" aria-label="Type">
              <p className={`text-[10px] font-bold uppercase tracking-[0.06em] mb-3 ${t.faint}`}>Type</p>
              <div className="space-y-2">
                {TYPES.map(o => {
                  const on = draft.type === o.value;
                  return (
                    <button key={o.value} role="radio" aria-checked={on} onClick={() => setDraft(d => ({ ...d, type: o.value }))} {...option(on)}>
                      {o.label}{check(on)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div role="radiogroup" aria-label="Subject">
              <p className={`text-[10px] font-bold uppercase tracking-[0.06em] mb-3 ${t.faint}`}>Subject</p>
              <div className="space-y-2">
                <button role="radio" aria-checked={draft.subject === 'all'} onClick={() => setDraft(d => ({ ...d, subject: 'all' }))} {...option(draft.subject === 'all')}>
                  All subjects{check(draft.subject === 'all')}
                </button>
                {subjectsFor(exam).map(s => {
                  const on = draft.subject === s;
                  const c = deckAccent(s, dark);
                  return (
                    <button key={s} role="radio" aria-checked={on} onClick={() => setDraft(d => ({ ...d, subject: s }))} {...option(on, c)}>
                      <span className="w-2 h-2 rounded-full" style={{ background: c }} />{s}{check(on)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
};
