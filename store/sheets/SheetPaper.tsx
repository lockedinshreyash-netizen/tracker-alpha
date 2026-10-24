/* ── A formula sheet, as an object ──
   The store's product shot: a portrait A4 page (1 : √2), printed with its
   real first formulas and fading out down the page, the way a sheet looks
   when the bottom of it is still in the folder.

   It is paper in either theme, like a white pack is white on a black wall:
   the object does not change colour with the room. The subject colour
   appears once, as the edge down its left side. Everything is sized from
   the width, in em, so one component serves a 120px miniature in a kit and
   a 460px page in the detail view.

   Never printed: `.sh-paper` hides itself in print (index.css). */

import React from 'react';
import { deckAccent } from '../../decks/theme';
import { Formula, type FormulaEntry } from './Formula';
import type { Sheet } from '../types';

export const PAPER = {
  ink: '#141416',
  muted: '#6b6b74',
  rule: 'rgba(20,20,22,0.1)',
  face: '#fbfaf6',
};

/** "SHEET 004". A sheet not yet saved has no number. */
export const sheetNumber = (n: number) => (n > 0 ? `SHEET ${String(n).padStart(3, '0')}` : 'NEW SHEET');

interface Props {
  sheet: Pick<Sheet, 'title' | 'sheetNo' | 'subject' | 'examLine'>;
  /** The first formulas. Null while loading: ruled lines stand in. */
  entries: FormulaEntry[] | null;
  width: number;
  /** How many entries to print before the fade. */
  lines?: number;
  /** Fade the lower part of the page (the store). The detail view draws its own. */
  fade?: boolean;
  /** Grow with the content instead of keeping the A4 shape (the detail view's long page). */
  fit?: boolean;
  /** Printed after the entries: the detail view's blurred tail. */
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  paperRef?: React.Ref<HTMLDivElement>;
}

export const SheetPaper = ({ sheet, entries, width, lines = 6, fade = true, fit = false, className = '', style, paperRef, children }: Props) => {
  const k = width / 300;
  const accent = deckAccent(sheet.subject, false);
  return (
    <div
      ref={paperRef}
      className={`sh-paper relative overflow-hidden select-none ${className}`}
      style={{
        width,
        ...(fit ? { minHeight: Math.round(width * Math.SQRT2) } : { height: Math.round(width * Math.SQRT2) }),
        fontSize: 12 * k,
        background: `linear-gradient(170deg, #ffffff 0%, ${PAPER.face} 45%, #f3f1ea 100%)`,
        borderRadius: Math.max(2, 3 * k),
        boxShadow: `0 ${1 * k}px 0 rgba(255,255,255,0.7) inset, 0 ${18 * k}px ${36 * k}px -${14 * k}px rgba(0,0,0,0.45), 0 ${2 * k}px ${5 * k}px rgba(0,0,0,0.12)`,
        ['--sh-ink' as string]: PAPER.ink,
        ['--sh-muted' as string]: PAPER.muted,
        ['--sh-rule' as string]: PAPER.rule,
        ['--sh-accent' as string]: accent,
        ...style,
      }}
    >
      {/* The subject's edge. */}
      <div aria-hidden className="absolute left-0 top-0 bottom-0" style={{ width: '0.34em', background: accent }} />

      <div style={{ padding: '1.5em 1.45em 0 1.85em', color: PAPER.ink }}>
        <div className="flex items-center justify-between gap-[1em] font-ui font-bold uppercase" style={{ fontSize: '0.6em', letterSpacing: '0.16em', color: PAPER.muted }}>
          <span className="flex items-center gap-[0.6em]">
            <span className="font-accent italic normal-case tracking-normal" style={{ fontSize: '1.5em', color: PAPER.ink, lineHeight: 1 }}>α</span>
            {sheetNumber(sheet.sheetNo)}
          </span>
          <span className="truncate">{sheet.examLine ?? sheet.subject ?? 'Alpha'}</span>
        </div>
        <h3 className="font-display" style={{ fontSize: '1.9em', lineHeight: 1.02, marginTop: '0.55em', letterSpacing: '-0.01em', color: PAPER.ink, overflowWrap: 'anywhere' }}>
          {sheet.title}
        </h3>
        <div aria-hidden className="relative" style={{ marginTop: '0.9em', height: 1, background: PAPER.rule }}>
          <span className="absolute left-0 -top-px" style={{ width: '2.6em', height: 2, background: accent }} />
        </div>

        <div style={{ marginTop: '0.4em' }}>
          {entries === null
            ? Array.from({ length: lines }, (_, i) => (
                <div key={i} className="flex items-center justify-between gap-[1em]" style={{ padding: '0.75em 0', borderBottom: `1px solid ${PAPER.rule}` }}>
                  <span style={{ height: '0.55em', width: `${30 + ((i * 17) % 25)}%`, borderRadius: 4, background: 'rgba(20,20,22,0.08)' }} />
                  <span style={{ height: '0.7em', width: `${22 + ((i * 13) % 20)}%`, borderRadius: 4, background: 'rgba(20,20,22,0.14)' }} />
                </div>
              ))
            : entries.slice(0, lines).map((e, i) => (
                <div key={i} style={{ padding: '0.55em 0', borderBottom: `1px solid ${PAPER.rule}` }}>
                  <Formula entry={e} images={fit} className="sh-tight" />
                </div>
              ))}
        </div>
        {children}
      </div>

      {fade && (
        <div aria-hidden className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ height: '58%', background: `linear-gradient(180deg, rgba(251,250,246,0) 0%, rgba(248,247,242,0.86) 55%, #f3f1ea 100%)` }} />
      )}
    </div>
  );
};
