/* ── A kit in My Alpha ──
   Where a kit lives once it is yours. The box at the top, then what is in
   it, each drawn as itself, with one action: Open if it is on your shelf,
   Add if it is not (something an administrator put in the kit after you took
   it: it is already unlocked for you, by the kit). Packs open their pack
   page, sheets the reader, decks the deck.

   Presentational: DecksTab owns the data and the actions. */

import React from 'react';
import { tokens } from '../ui/kit';
import { Icon, MoreMenu } from './ui';
import { KitBox, kitNumber } from '../store/kits/KitBox';
import { tableStyle } from '../store/kits/KitCard';
import { KitItemThumb, itemLine } from '../store/kits/KitItemThumb';
import { kitLine, type Kit, type KitItem } from '../store/types';

interface Props {
  kit: Kit;
  dark: boolean;
  reduced: boolean;
  /** Is this item on the caller's shelf? */
  onShelf: (item: KitItem) => boolean;
  onBack: () => void;
  onOpenItem: (item: KitItem) => void;
  onAddItem: (item: KitItem) => Promise<void>;
  onRemove: () => void;
}

const KitView = ({ kit, dark, reduced, onShelf, onBack, onOpenItem, onAddItem, onRemove }: Props) => {
  const t = tokens(dark);
  const [adding, setAdding] = React.useState<string | null>(null);
  const live = kit.items.filter(i => i.status !== 'draft');

  return (
    <div className="font-ui">
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className={`mk-rise -ml-1 inline-flex items-center gap-1.5 h-8 px-2 rounded-full text-[13px] font-semibold transition-opacity hover:opacity-70 ${t.muted}`}>
          {Icon.back} Decks
        </button>
        <MoreMenu dark={dark} quiet label="Kit actions" items={[{ label: 'Remove from My Alpha', icon: Icon.trash, onSelect: onRemove, danger: true }]} />
      </div>

      <section className={`mk-rise mt-5 rounded-2xl border overflow-hidden ${dark ? 'border-white/[0.06]' : 'border-zinc-200/80'}`} style={tableStyle(dark)}>
        <div className="grid sm:grid-cols-[auto_minmax(0,1fr)] items-center gap-4 sm:gap-10 p-6 md:p-9">
          <div className="flex justify-center"><KitBox kit={kit} size={190} interactive reduced={reduced} /></div>
          <div className="min-w-0 text-center sm:text-left">
            <p className={`text-[10px] font-bold uppercase tracking-[0.12em] ${t.faint}`}>{kitNumber(kit.kitNo)}{kit.subject ? ` · ${kit.subject}` : ''} · In My Alpha</p>
            <h1 className={`font-display text-[34px] md:text-[42px] leading-[1] mt-3 ${t.heading}`}>{kit.title}</h1>
            {kit.tagline && <p className={`font-accent text-[19px] mt-2.5 ${t.body}`}>{kit.tagline}</p>}
            <p className={`text-[13px] mt-3 ${t.muted}`}>{kitLine(live)}</p>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <h2 className={`font-display text-[22px] mb-5 ${t.heading}`}>In this kit</h2>
        {live.length === 0 ? (
          <p className={`rounded-xl border px-6 py-10 text-center text-[14px] ${t.card} ${t.muted}`}>Nothing in this kit yet. What Alpha adds will show up here.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {live.map((item, i) => {
              const mine = onShelf(item);
              const key = `${item.kind}:${item.id}`;
              return (
                <li key={key} className={`mk-rise flex items-center gap-4 rounded-xl border p-3 pr-4 ${t.card}`} style={{ animationDelay: `${i * 40}ms` }}>
                  <div className={`shrink-0 w-[92px] h-[108px] rounded-lg border flex items-center justify-center overflow-hidden ${t.inset}`}>
                    <KitItemThumb item={item} dark={dark} size={86} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-[15px] font-bold leading-snug line-clamp-2 ${t.heading}`}>{item.title}</p>
                    <p className={`text-[12px] mt-1 ${t.muted}`}>{itemLine(item)}</p>
                  </div>
                  {mine ? (
                    <button onClick={() => onOpenItem(item)} className="shrink-0 inline-flex items-center gap-1.5 h-9 pl-4 pr-3 rounded-full bg-[#E10600] text-white text-[12px] font-bold uppercase tracking-[0.08em] transition-transform active:scale-95">
                      Open {Icon.arrow}
                    </button>
                  ) : (
                    <button
                      disabled={adding === key}
                      onClick={async () => { setAdding(key); try { await onAddItem(item); } finally { setAdding(null); } }}
                      className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12px] font-bold uppercase tracking-[0.08em] transition-all active:scale-95 disabled:opacity-50 ${dark ? 'bg-white/[0.08] text-white hover:bg-white/[0.12]' : 'bg-zinc-900 text-white hover:bg-zinc-800'}`}
                    >
                      {adding === key ? 'Adding…' : <>{Icon.plus} Add</>}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default KitView;
