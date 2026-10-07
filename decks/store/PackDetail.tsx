/* ── A pack, up close ──
   Tapping a pack does not take it. It lifts on its hook, and this panel opens
   right under the rack, its caret pointing up at the pack. The pack stays
   where it hangs, so the panel is about that object, not a page about it.

   What it answers: what is this, how much is in it, which exam, what do the
   cards look like (three real ones, answers shown), and what does it cost.
   Then one button. Free packs say ADD TO ALPHA, paid ones their price, Pro
   ones that Pro includes them. The button waits on the server; the opening
   starts only once it has said yes. */

import React, { useEffect } from 'react';
import { tokens } from '../../ui/kit';
import { CardFace } from '../CardFace';
import { ALL_BLANKS } from '../cloze';
import { deckAccent } from '../theme';
import { Icon } from '../ui';
import { actionFor } from './checkout';
import { packNumber } from './PackCard';
import { rackName } from './racks';
import type { Pack, PreviewCard } from '../types';


export const PackDetail: React.FC<{
  pack: Pack;
  preview: PreviewCard[] | null | 'error';
  dark: boolean;
  busy: boolean;
  error: string | null;
  caretRef: React.Ref<HTMLDivElement>;
  onClose: () => void;
  onAcquire: () => void;
}> = ({ pack, preview, dark, busy, error, caretRef, onClose, onAcquire }) => {
  const t = tokens(dark);
  const cards = pack.decks.reduce((n, d) => n + d.cards, 0);
  const accent = deckAccent(pack.subject ?? pack.decks.find(d => d.subject)?.subject ?? null, dark);
  const action = actionFor(pack);
  const surface = dark ? '#111114' : '#ffffff';
  const edge = dark ? 'rgba(255,255,255,0.08)' : '#e4e4e7';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  return (
    <div className="pk-detail relative mt-5 font-ui" role="region" aria-label={`${pack.title} details`}>
      {/* The caret, pointing up at the pack on its hook. PackCategory moves it with the rack. */}
      <div ref={caretRef} aria-hidden className="absolute -top-[9px] left-0 w-4 h-4 rotate-45" style={{ background: surface, borderLeft: `1px solid ${edge}`, borderTop: `1px solid ${edge}` }} />
      <div className={`relative rounded-2xl border p-6 md:p-8 ${t.card}`}>
        <button onClick={onClose} disabled={busy} aria-label="Close" className={`absolute right-4 top-4 w-9 h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-30 ${dark ? 'text-zinc-500 hover:text-white hover:bg-white/[0.06]' : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>

        <div className="grid md:grid-cols-[minmax(0,1fr)_340px] gap-8 md:gap-10">
          <div className="min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-[0.12em] flex items-center gap-2 ${t.faint}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
              {packNumber(pack.packNo)}{pack.subject ? ` · ${rackName(pack.subject)}` : ''}
            </p>
            <h3 className={`font-display uppercase text-[28px] md:text-[36px] leading-[0.98] mt-3 pr-10 ${t.heading}`}>{pack.title}</h3>
            {pack.description && <p className={`font-accent italic text-[17px] md:text-[19px] leading-snug mt-4 max-w-[520px] ${t.body}`}>“{pack.description}”</p>}

            <dl className={`grid grid-cols-3 gap-4 mt-7 pt-5 border-t ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
              <div><dt className={`text-[10px] font-bold uppercase tracking-[0.1em] ${t.faint}`}>Cards</dt><dd className={`num-stat text-[22px] mt-1 ${t.heading}`}>{cards.toLocaleString()}</dd></div>
              <div><dt className={`text-[10px] font-bold uppercase tracking-[0.1em] ${t.faint}`}>Decks</dt><dd className={`num-stat text-[22px] mt-1 ${t.heading}`}>{pack.decks.length}</dd></div>
              <div className="min-w-0"><dt className={`text-[10px] font-bold uppercase tracking-[0.1em] ${t.faint}`}>Exam</dt><dd className={`text-[13px] font-bold uppercase tracking-[0.06em] leading-snug mt-2 ${t.heading}`}>{pack.examLine ?? 'All exams'}</dd></div>
            </dl>

            {pack.decks.length > 0 && (
              <div className="mt-6">
                <p className={`text-[10px] font-bold uppercase tracking-[0.1em] ${t.faint}`}>Topics</p>
                <div className="flex flex-wrap gap-1.5 mt-2.5">
                  {pack.decks.map(d => (
                    <span key={d.id} className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-semibold ${dark ? 'bg-white/[0.04] text-zinc-300 ring-1 ring-inset ring-white/[0.06]' : 'bg-zinc-50 text-zinc-700 ring-1 ring-inset ring-zinc-100'}`}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: deckAccent(d.subject, dark) }} />
                      {d.title}
                      <span className={`tabular-nums ${t.faint}`}>{d.cards}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0 flex flex-col">
            <p className={`text-[10px] font-bold uppercase tracking-[0.1em] ${t.faint}`}>A look inside</p>
            <div className="mt-2.5 space-y-2">
              {preview === null ? (
                [0, 1].map(i => <div key={i} className={`h-[74px] rounded-xl ${dark ? 'bg-white/[0.03]' : 'bg-zinc-50'}`} />)
              ) : preview === 'error' || preview.length === 0 ? (
                <p className={`text-[13px] py-3 ${t.muted}`}>{pack.decks.map(d => d.title).join(' · ') || 'Cards are being added.'}</p>
              ) : (
                preview.slice(0, 3).map((c, i) => (
                  <div key={i} className={`rounded-xl px-4 py-3.5 text-center ${dark ? 'bg-white/[0.03] ring-1 ring-inset ring-white/[0.05]' : 'bg-zinc-50 ring-1 ring-inset ring-zinc-100'}`}>
                    <CardFace kind={c.kind} front={c.front} back={c.back} ord={ALL_BLANKS} revealed deckId={c.deckId} dark={dark} accent={deckAccent(pack.decks.find(d => d.id === c.deckId)?.subject ?? pack.subject, dark)} size="small" />
                  </div>
                ))
              )}
            </div>

            <div className="flex-1 min-h-6" />
            <div className={`mt-6 pt-5 border-t ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
              <div className="flex items-baseline justify-between gap-3">
                <span className={`text-[10px] font-bold uppercase tracking-[0.1em] ${t.faint}`}>{pack.unlocked ? 'Yours to add' : 'Price'}</span>
                <span className={`${action.price.startsWith('₹') ? 'num-stat text-[24px]' : 'text-[12px] font-bold uppercase tracking-[0.1em]'} ${t.heading}`}>{action.price}</span>
              </div>
              <button
                onClick={onAcquire}
                disabled={busy}
                className="mt-4 w-full h-14 rounded-full bg-[#E10600] text-white text-[14px] font-bold uppercase tracking-[0.1em] shadow-[0_10px_30px_-10px_rgba(225,6,0,0.7)] transition-all hover:bg-[#c90500] active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none inline-flex items-center justify-center gap-2.5"
              >
                {busy ? (pack.unlocked ? 'Adding…' : 'Opening checkout…') : <>{action.label} {Icon.arrow}</>}
              </button>
              <p className={`text-[12px] mt-3 min-h-[18px] text-center ${error ? 'text-rose-500' : t.faint}`} aria-live="polite">
                {error ?? (pack.unlocked ? 'It goes straight into My Alpha.' : '')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
