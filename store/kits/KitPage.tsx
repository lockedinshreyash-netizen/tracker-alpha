/* ── A kit, up close ──
   The page a box opens to in the store. The box itself, large, on the table
   and turning toward the pointer; beside it what it is, its price and one
   button. Under that, "What's in the box": every item as the object it is
   (KitItemThumb), so a student sees exactly what they are taking.

   An administrator is warned when a free kit holds something that is sold on
   its own: owning a kit unlocks everything inside it, so that item becomes
   free to anyone who takes the kit. */

import React from 'react';
import { tokens } from '../../ui/kit';
import { deckAccent } from '../../decks/theme';
import { Icon } from '../../decks/ui';
import { actionFor } from '../checkout';
import { KitBox, kitNumber } from './KitBox';
import { tableStyle } from './KitCard';
import { KitItemThumb, itemLine } from './KitItemThumb';
import { kitLine, type Kit } from '../types';

interface Props {
  kit: Kit;
  dark: boolean;
  reduced: boolean;
  busy: boolean;
  error: string | null;
  /** Shown to administrators only: e.g. a free kit holding paid items. */
  warning?: string | null;
  onBack: () => void;
  onAcquire: () => void;
  onOpenOwned: () => void;
  boxRef?: React.Ref<HTMLDivElement>;
  flying?: boolean;
}

export const KitPage = ({ kit, dark, reduced, busy, error, warning, onBack, onAcquire, onOpenOwned, boxRef, flying }: Props) => {
  const t = tokens(dark);
  const action = actionFor({ kind: 'kit', ...kit });
  const accent = deckAccent(kit.subject, dark);

  return (
    <div className="font-ui">
      <button onClick={onBack} disabled={busy} className={`mk-rise -ml-1 inline-flex items-center gap-1.5 h-8 px-2 rounded-full text-[13px] font-semibold transition-opacity hover:opacity-70 disabled:opacity-40 ${t.muted}`}>
        {Icon.back} Kits
      </button>

      <section className={`mk-rise mt-5 rounded-2xl border overflow-hidden ${dark ? 'border-white/[0.06]' : 'border-zinc-200/80'}`} style={{ ...tableStyle(dark), animationDelay: '40ms' }}>
        <div className="grid md:grid-cols-[auto_minmax(0,1fr)] items-center gap-6 md:gap-12 p-6 md:p-10">
          <div ref={boxRef} className="flex justify-center" style={{ visibility: flying ? 'hidden' : undefined }}>
            <KitBox kit={kit} size={Math.min(300, typeof window === 'undefined' ? 300 : window.innerWidth * 0.62)} interactive reduced={reduced} />
          </div>
          <div className="min-w-0">
            <p className={`text-[10px] font-bold uppercase tracking-[0.12em] flex items-center gap-2 ${t.faint}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
              {kitNumber(kit.kitNo)}{kit.subject ? ` · ${kit.subject}` : ''}{kit.examLine ? ` · ${kit.examLine}` : ''}{kit.status === 'draft' ? ' · Draft' : ''}
            </p>
            <h2 className={`font-display text-[36px] md:text-[48px] leading-[0.98] mt-3 ${t.heading}`}>{kit.title}</h2>
            {kit.tagline && <p className={`font-accent text-[20px] md:text-[22px] mt-3 ${t.body}`}>{kit.tagline}</p>}
            {kit.description && <p className={`text-[15px] leading-relaxed mt-4 max-w-[520px] ${t.muted}`}>{kit.description}</p>}
            <p className={`text-[13px] font-semibold mt-4 ${t.body}`}>{kitLine(kit.items)}</p>

            <div className="mt-7 max-w-[360px]">
              {kit.inLibrary ? (
                <button onClick={onOpenOwned} className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-full text-[13px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white shadow-[0_8px_22px_-8px_rgba(225,6,0,0.75)] transition-transform active:scale-[0.98]">
                  Open in My Alpha {Icon.arrow}
                </button>
              ) : (
                <>
                  <p className={`text-[12px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>{action.price}</p>
                  <button
                    onClick={onAcquire}
                    disabled={busy || kit.items.length === 0}
                    className="mt-2 w-full inline-flex items-center justify-center gap-2 h-12 rounded-full text-[13px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white shadow-[0_8px_22px_-8px_rgba(225,6,0,0.75)] transition-transform active:scale-[0.98] disabled:opacity-60"
                  >
                    {busy ? 'Opening…' : action.label}
                  </button>
                </>
              )}
              {error && <p className="text-[13px] text-rose-500 mt-3">{error}</p>}
              {warning && (
                <p className={`text-[12px] mt-3 rounded-lg border px-3 py-2.5 ${dark ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{warning}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-4 mb-5">
          <h3 className={`font-display text-[22px] ${t.heading}`}>What's in the box</h3>
          <span className={`text-[13px] ${t.muted}`}>Everything here is yours when you take the kit.</span>
        </div>
        {kit.items.length === 0 ? (
          <p className={`rounded-xl border px-6 py-10 text-center text-[14px] ${t.card} ${t.muted}`}>Nothing in this box yet.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {kit.items.map((item, i) => (
              <div key={`${item.kind}:${item.id}`} className={`mk-rise rounded-xl border overflow-hidden ${t.card}`} style={{ animationDelay: `${120 + i * 40}ms` }}>
                <div className={`flex items-center justify-center py-6 border-b ${t.inset}`} style={{ height: 196 }}>
                  <KitItemThumb item={item} dark={dark} size={150} />
                </div>
                <div className="p-4">
                  <p className={`text-[14px] font-bold leading-snug line-clamp-2 ${t.heading}`}>{item.title}</p>
                  <p className={`text-[12px] mt-1 ${t.muted}`}>{itemLine(item)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
