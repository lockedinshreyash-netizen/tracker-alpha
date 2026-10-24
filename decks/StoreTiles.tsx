/* ── Sheets and kits on your shelf ──
   My Alpha draws what you took from the store as what it is: a sheet as a
   small page, a kit as a small box. Same tile proportions and the same rise
   as DeckTile and AlphaLibraryItem, so a shelf of mixed things still reads as
   one row. Presentational, like Library. */

import React from 'react';
import { tokens } from '../ui/kit';
import { Icon } from './ui';
import { deckAccent } from './theme';
import { SheetPaper } from '../store/sheets/SheetPaper';
import { KitBox } from '../store/kits/KitBox';
import { kitLine, sheetLine, type Kit, type Sheet } from '../store/types';

const Shell = ({ dark, delay, label, onOpen, children }: { dark: boolean; delay: number; label: string; onOpen: () => void; children: React.ReactNode }) => {
  const t = tokens(dark);
  return (
    <div className="mk-rise relative" style={{ animationDelay: `${delay}ms` }}>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
        aria-label={label}
        className={`dk-tile relative h-full rounded-2xl border p-5 md:p-6 cursor-pointer overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-[#E10600] ${t.card}`}
      >
        {children}
      </div>
    </div>
  );
};

const OpenPill = ({ dark }: { dark: boolean }) => (
  <span className={`inline-flex items-center gap-1.5 h-9 pl-4 pr-3 rounded-full text-[12px] font-bold uppercase tracking-[0.08em] ${dark ? 'bg-white text-black' : 'bg-zinc-900 text-white'}`}>
    Open {Icon.arrow}
  </span>
);

export const SheetTile = ({ sheet, dark, delay = 0, onOpen }: { sheet: Sheet; dark: boolean; delay?: number; onOpen: () => void }) => {
  const t = tokens(dark);
  const accent = deckAccent(sheet.subject, dark);
  return (
    <Shell dark={dark} delay={delay} label={`${sheet.title}: formula sheet, ${sheetLine(sheet)}`} onOpen={onOpen}>
      <div aria-hidden className="absolute inset-x-0 top-0 h-24 pointer-events-none" style={{ background: `linear-gradient(180deg, ${accent}${dark ? '14' : '0f'}, transparent)` }} />
      <div className="relative flex gap-4">
        <div className="shrink-0 -mb-10 rotate-[-3deg] origin-bottom-left" aria-hidden>
          <SheetPaper sheet={sheet} entries={null} width={74} lines={4} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>Formula sheet</p>
          <h3 className={`font-display text-[20px] leading-[1.15] mt-2 line-clamp-2 ${t.heading}`}>{sheet.title}</h3>
          <p className={`text-[12px] mt-2 ${t.muted}`}>{sheetLine(sheet)}</p>
        </div>
      </div>
      <div className="relative flex justify-end mt-6"><OpenPill dark={dark} /></div>
    </Shell>
  );
};

export const KitTile = ({ kit, dark, delay = 0, onOpen }: { kit: Kit; dark: boolean; delay?: number; onOpen: () => void }) => {
  const t = tokens(dark);
  const live = kit.items.filter(i => i.status !== 'draft');
  return (
    <Shell dark={dark} delay={delay} label={`${kit.title}: kit, ${kitLine(live)}`} onOpen={onOpen}>
      <div className="relative flex items-center gap-2">
        <div className="shrink-0 -my-4 -ml-3" aria-hidden><KitBox kit={kit} size={92} /></div>
        <div className="min-w-0 flex-1">
          <p className={`text-[10px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>Kit</p>
          <h3 className={`font-display text-[20px] leading-[1.15] mt-2 line-clamp-2 ${t.heading}`}>{kit.title}</h3>
          <p className={`text-[12px] mt-2 ${t.muted}`}>{kitLine(live)}</p>
        </div>
      </div>
      <div className="relative flex justify-end mt-4"><OpenPill dark={dark} /></div>
    </Shell>
  );
};
