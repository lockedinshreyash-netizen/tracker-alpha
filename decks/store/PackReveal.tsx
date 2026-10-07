/* ── What is inside ──
   Three real cards from the pack (`pack_preview`), filled in, sitting in the
   package behind its front. The opening lifts them out of the torn top and
   fans them. A visual reveal, not a study session: no blanks to guess, the
   answers already there. That is the point: this knowledge is yours now.

   Kept deliberately cheap: plain text, no KaTeX, no images. These cards are
   on screen for under a second. */

import React from 'react';
import { renderAllAnswers } from '../cloze';
import { toPlain } from '../html';
import { deckAccent } from '../theme';
import type { PackGeometry } from './geometry';
import type { Pack, PreviewCard } from '../types';

/** A card's text with every blank filled, as one plain line. */
export const filledText = (c: Pick<PreviewCard, 'kind' | 'front' | 'back'>): string => {
  const front = toPlain(c.kind === 'cloze' ? renderAllAnswers(c.front) : c.front);
  const text = c.kind === 'basic' && c.back ? `${front} — ${toPlain(c.back)}` : front;
  return text.length > 90 ? `${text.slice(0, 88)}…` : text;
};

export interface RevealCard { text: string; subject: Pack['subject'] }

/** Three cards to show: the preview, else the deck names. */
export const revealCards = (pack: Pick<Pack, 'decks' | 'subject'>, preview: PreviewCard[] | null): RevealCard[] => {
  const subjectOf = (deckId: string) => pack.decks.find(d => d.id === deckId)?.subject ?? pack.subject;
  const fromPreview = (preview ?? []).map(c => ({ text: filledText(c), subject: subjectOf(c.deckId) })).filter(c => c.text);
  const fromDecks = pack.decks.map(d => ({ text: d.title, subject: d.subject ?? pack.subject }));
  const all = [...fromPreview, ...fromDecks];
  while (all.length && all.length < 3) all.push(all[all.length % Math.max(1, all.length)]);
  return all.slice(0, 3);
};

export const PackReveal: React.FC<{
  cards: RevealCard[];
  g: PackGeometry;
  refs: React.MutableRefObject<(HTMLDivElement | null)[]>;
}> = ({ cards, g, refs }) => {
  const k = g.w / 198;
  const w = g.w * 0.8;
  const h = (g.h - g.perf) * 0.74;
  return (
    <>
      {cards.map((c, i) => (
        <div
          key={i}
          ref={el => { refs.current[i] = el; }}
          className="absolute font-ui flex flex-col"
          style={{
            left: (g.w - w) / 2, top: g.perf + 6 * k, width: w, height: h,
            transformOrigin: '50% 100%',
            borderRadius: 12 * k,
            background: '#FFFFFF',
            boxShadow: '0 0 0 1px rgba(24,24,27,0.07), 0 10px 24px -14px rgba(0,0,0,0.5)',
            padding: `${11 * k}px ${12 * k}px`,
            zIndex: i === 1 ? 2 : 1,
          }}
        >
          <span className="flex items-center justify-between">
            <span style={{ width: 16 * k, height: 3 * k, borderRadius: 2, background: deckAccent(c.subject ?? null, false) }} />
            <span className="font-accent italic" style={{ fontSize: 12 * k, color: '#a1a1aa', lineHeight: 1 }}>α</span>
          </span>
          <span className="flex-1 flex items-center justify-center text-center" style={{ color: '#09090b', fontWeight: 800, fontSize: (c.text.length > 40 ? 11 : c.text.length > 18 ? 13.5 : 17) * k, lineHeight: 1.2 }}>
            {c.text}
          </span>
        </div>
      ))}
    </>
  );
};
