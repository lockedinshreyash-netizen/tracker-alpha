/* ── The sheets rack ──
   Every formula sheet on one ledge, in a single row as long as the sheets on
   it, carried sideways inside StoreRow the way a pack rack slides. Each page
   brings its own stretch of ledge, reaching into the gaps on both sides, and
   the row starts and ends with ledge too, so it is one piece from end to end
   and moves with the pages. */

import React from 'react';
import { tokens } from '../../ui/kit';
import { SheetCard, ledgeStyle } from './SheetCard';
import type { FormulaEntry } from './Formula';
import type { Sheet } from '../types';

const PAD = 18;

/** How far one press of ‹ › should move the sheets rack. */
export const sheetColumn = (w: number) => w + 2 * PAD;

interface Props {
  sheets: Sheet[];
  dark: boolean;
  /** Each page's width. */
  w: number;
  previewOf: (id: string) => FormulaEntry[] | null;
  onOpen: (s: Sheet) => void;
  /** What an empty rack says (the store's filter can leave nothing to show). */
  empty?: { title: string; line: string };
}

export const SheetRack = ({ sheets, dark, w, previewOf, onOpen, empty = { title: 'Formula sheets are coming.', line: 'The first sheets are being written.' } }: Props) => {
  const t = tokens(dark);
  const area = Math.round(w * Math.SQRT2) + 18;
  const ledge = <span aria-hidden className="block" style={{ ...ledgeStyle(dark), borderRadius: 0 }} />;
  return (
    <>
      <div className="shrink-0 pt-8" style={{ width: 14 }}><div style={{ height: area }} />{ledge}</div>
      {sheets.map((s, i) => (
        <div key={s.id} className="shrink-0 pt-8 pb-7" style={{ width: sheetColumn(w), paddingLeft: PAD, paddingRight: PAD }}>
          <SheetCard sheet={s} preview={previewOf(s.id)} dark={dark} width={w} delay={i * 40} bleed={PAD} onOpen={() => onOpen(s)} />
        </div>
      ))}
      <div className="flex-1 pt-8" style={{ minWidth: 14 }}>
        <div className="flex items-center justify-center text-center px-6" style={{ height: area }}>
          {sheets.length === 0 && (
            <div>
              <p className={`font-display text-[22px] ${t.heading}`}>{empty.title}</p>
              <p className={`text-[14px] mt-2 ${t.muted}`}>{empty.line}</p>
            </div>
          )}
        </div>
        {ledge}
      </div>
    </>
  );
};
