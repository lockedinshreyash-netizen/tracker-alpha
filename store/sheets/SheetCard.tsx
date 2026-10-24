/* ── A sheet on the shelf ──
   In the store, a formula sheet stands on a ledge, leaning back a little, the
   way a printed page leans on a shelf in a shop. Pointed at, it straightens
   and lifts. Under the ledge: its name, how much is on it, and its price (or
   that it is already yours).

   The ledge is one piece per sheet that runs into the gap on either side, so
   a row of sheets reads as one shelf (SheetRack). */

import React, { useEffect, useState } from 'react';
import { tokens } from '../../ui/kit';
import { Icon } from '../../decks/ui';
import { priceLabel } from '../../decks/store/PackCard';
import { SheetPaper } from './SheetPaper';
import type { FormulaEntry } from './Formula';
import { sheetLine, type Sheet } from '../types';

/** Page width on the shelf: two across on a phone, four on a laptop. */
export const useShelfWidth = (): number => {
  const pick = () => (typeof window === 'undefined' ? 200
    : window.matchMedia('(min-width: 1024px)').matches ? 200
    : window.matchMedia('(min-width: 640px)').matches ? 180 : 142);
  const [w, setW] = useState(pick);
  useEffect(() => {
    const qs = ['(min-width: 1024px)', '(min-width: 640px)'].map(q => window.matchMedia(q));
    const on = () => setW(pick());
    qs.forEach(q => q.addEventListener('change', on));
    return () => qs.forEach(q => q.removeEventListener('change', on));
  }, []);
  return w;
};

export const ledgeStyle = (dark: boolean): React.CSSProperties => ({
  height: 10,
  borderRadius: 2,
  background: dark
    ? 'linear-gradient(180deg, #3a3a40 0%, #26262b 45%, #18181c 100%)'
    : 'linear-gradient(180deg, #ffffff 0%, #e9e6df 50%, #d8d4cb 100%)',
  boxShadow: dark
    ? '0 1px 0 rgba(255,255,255,0.08) inset, 0 10px 18px -8px rgba(0,0,0,0.8)'
    : '0 1px 0 rgba(255,255,255,0.9) inset, 0 10px 18px -10px rgba(0,0,0,0.35)',
});

/** What the tag under a sheet says. */
export const sheetTag = (s: Pick<Sheet, 'inLibrary' | 'status' | 'access' | 'priceInr'>): string =>
  s.inLibrary ? 'In My Alpha' : s.status === 'draft' ? 'Draft' : s.access === 'pro' ? 'Alpha Pro' : priceLabel(s) === 'FREE' ? 'Free' : priceLabel(s);

interface Props {
  sheet: Sheet;
  preview: FormulaEntry[] | null;
  dark: boolean;
  width: number;
  delay?: number;
  onOpen: () => void;
  paperRef?: React.Ref<HTMLDivElement>;
  /** Hidden while it is flying into the folder. */
  hidden?: boolean;
  /** How far the ledge runs past the page on each side, to meet its neighbours'. */
  bleed?: number;
}

export const SheetCard = ({ sheet, preview, dark, width, delay = 0, onOpen, paperRef, hidden, bleed = 16 }: Props) => {
  const t = tokens(dark);
  const tag = sheetTag(sheet);
  return (
    <div className="mk-rise font-ui" style={{ animationDelay: `${delay}ms` }}>
      <button
        onClick={onOpen}
        className="sh-stand group relative block w-full outline-none"
        aria-label={`${sheet.title}: ${sheetLine(sheet)}. ${tag}.`}
      >
        <span className="flex justify-center items-end" style={{ height: Math.round(width * Math.SQRT2) + 18 }}>
          <span className="sh-lean block" style={{ visibility: hidden ? 'hidden' : undefined }}>
            <SheetPaper sheet={sheet} entries={preview} width={width} paperRef={paperRef} />
          </span>
        </span>
        {/* The ledge, running into the gaps so a row reads as one shelf. */}
        <span aria-hidden className="block relative" style={{ ...ledgeStyle(dark), marginLeft: -bleed, marginRight: -bleed, borderRadius: 0 }} />
      </button>
      <div className="mt-4 px-1">
        <p className={`text-[15px] font-bold leading-snug line-clamp-2 ${t.heading}`}>{sheet.title}</p>
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <span className={`text-[12px] truncate ${t.muted}`}>{sheetLine(sheet)}</span>
          <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.06em] ${sheet.inLibrary ? '' : t.heading}`} style={sheet.inLibrary ? { color: dark ? '#34C77B' : '#16a34a' } : undefined}>
            {sheet.inLibrary && Icon.check}{tag}
          </span>
        </div>
      </div>
    </div>
  );
};
