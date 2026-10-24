/* ── A sheet, up close ──
   The page a sheet opens to in the store. On the left the page itself,
   larger: its first eight formulas printed clearly, then the rest of the page
   out of focus and a count of what else is on it. On the right what it is,
   which sections it holds, and one button.

   The button waits on the server; the "into your folder" motion plays only
   once it has said yes (SheetTake). */

import React, { useRef } from 'react';
import { tokens } from '../../ui/kit';
import { deckAccent } from '../../decks/theme';
import { Icon } from '../../decks/ui';
import { actionFor } from '../checkout';
import { useWidth } from '../useWidth';
import { SheetPaper, sheetNumber, PAPER } from './SheetPaper';
import type { FormulaEntry } from './Formula';
import { sheetLine, type Sheet } from '../types';

interface Props {
  sheet: Sheet;
  preview: FormulaEntry[] | null | 'error';
  dark: boolean;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onAcquire: () => void;
  onOpenOwned: () => void;
  paperRef?: React.Ref<HTMLDivElement>;
  /** Hidden while the page is flying into the folder. */
  flying?: boolean;
}

export const SheetDetail = ({ sheet, preview, dark, busy, error, onBack, onAcquire, onOpenOwned, paperRef, flying }: Props) => {
  const t = tokens(dark);
  const box = useRef<HTMLDivElement>(null);
  const width = Math.min(460, useWidth(box) || 0);
  const entries = Array.isArray(preview) ? preview : null;
  const more = Math.max(0, sheet.entries - (entries?.length ?? 0));
  const action = actionFor({ kind: 'sheet', ...sheet });
  const accent = deckAccent(sheet.subject, dark);

  return (
    <div className="font-ui">
      <button onClick={onBack} disabled={busy} className={`mk-rise -ml-1 inline-flex items-center gap-1.5 h-8 px-2 rounded-full text-[13px] font-semibold transition-opacity hover:opacity-70 disabled:opacity-40 ${t.muted}`}>
        {Icon.back} Sheets
      </button>

      <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,380px)] gap-10 md:gap-12 mt-6 items-start">
        <div ref={box} className="mk-rise min-w-0 flex justify-center md:justify-start" style={{ animationDelay: '40ms' }}>
          {width > 0 && (
            <div style={{ visibility: flying ? 'hidden' : undefined }}>
              <SheetPaper sheet={sheet} entries={preview === 'error' ? [] : entries} width={width} lines={8} fade={false} fit paperRef={paperRef}>
                {/* The rest of the page, out of focus: there, but not yours yet. */}
                {more > 0 && (
                  <div className="relative" style={{ paddingBottom: '1.8em' }}>
                    <div aria-hidden style={{ filter: 'blur(4px)', opacity: 0.7 }}>
                      {[62, 48, 70, 40, 56].map((w, i) => (
                        <div key={i} className="flex items-center justify-between gap-[1em]" style={{ padding: '0.8em 0', borderBottom: `1px solid ${PAPER.rule}` }}>
                          <span style={{ height: '0.6em', width: `${w * 0.5}%`, borderRadius: 4, background: 'rgba(20,20,22,0.12)' }} />
                          <span style={{ height: '0.75em', width: `${w * 0.45}%`, borderRadius: 4, background: 'rgba(20,20,22,0.2)' }} />
                        </div>
                      ))}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="font-ui font-bold" style={{ fontSize: '0.95em', padding: '0.55em 1.1em', borderRadius: 999, background: PAPER.ink, color: '#fff' }}>
                        +{more.toLocaleString()} more {more === 1 ? 'formula' : 'formulas'}
                      </span>
                    </div>
                  </div>
                )}
                {more === 0 && <div style={{ height: '1.8em' }} />}
              </SheetPaper>
            </div>
          )}
        </div>

        <aside className="mk-rise md:sticky md:top-24" style={{ animationDelay: '90ms' }}>
          <p className={`text-[10px] font-bold uppercase tracking-[0.12em] flex items-center gap-2 ${t.faint}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
            {sheetNumber(sheet.sheetNo)}{sheet.subject ? ` · ${sheet.subject}` : ''}{sheet.status === 'draft' ? ' · Draft' : ''}
          </p>
          <h2 className={`font-display text-[32px] md:text-[38px] leading-[1.02] mt-3 ${t.heading}`}>{sheet.title}</h2>
          {sheet.description && <p className={`text-[15px] leading-relaxed mt-3 ${t.body}`}>{sheet.description}</p>}
          <p className={`text-[13px] mt-3 ${t.muted}`}>{sheetLine(sheet)}{sheet.examLine ? ` · ${sheet.examLine}` : ''}</p>

          {sheet.decks.length > 0 && (
            <ul className={`mt-6 rounded-xl border divide-y ${t.inset} ${dark ? 'divide-white/[0.05]' : 'divide-zinc-100'}`}>
              {sheet.decks.map(d => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className={`flex items-center gap-2 min-w-0 text-[13px] font-semibold ${t.body}`}>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: deckAccent(d.subject, dark) }} />
                    <span className="truncate">{d.title}</span>
                  </span>
                  <span className={`num-stat text-[13px] ${t.faint}`}>{d.entries}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-7">
            {sheet.inLibrary ? (
              <button onClick={onOpenOwned} className="w-full inline-flex items-center justify-center gap-2 h-12 rounded-full text-[13px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white shadow-[0_8px_22px_-8px_rgba(225,6,0,0.75)] transition-transform active:scale-[0.98]">
                Open in My Alpha {Icon.arrow}
              </button>
            ) : (
              <>
                <p className={`text-[12px] font-bold uppercase tracking-[0.08em] ${t.faint}`}>{action.price}</p>
                <button
                  onClick={onAcquire}
                  disabled={busy}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 h-12 rounded-full text-[13px] font-bold uppercase tracking-[0.08em] bg-[#E10600] text-white shadow-[0_8px_22px_-8px_rgba(225,6,0,0.75)] transition-transform active:scale-[0.98] disabled:opacity-60"
                >
                  {busy ? 'Adding…' : action.label}
                </button>
              </>
            )}
            {error && <p className="text-[13px] text-rose-500 mt-3">{error}</p>}
            <p className={`text-[12px] mt-4 ${t.faint}`}>Read it in Decks, on any device you sign in on. Sheets are on screen only, so they don't print.</p>
          </div>
        </aside>
      </div>
    </div>
  );
};
