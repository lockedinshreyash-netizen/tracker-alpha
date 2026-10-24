/* ── A kit box, front on ──
   How a box looks standing on a shop shelf at eye level: its front, square
   to you, with a thin strip of the lid's top showing above it, narrowing a
   little toward the back. The same box KitBox draws in 3D, in the same
   finishes (SKIN), flattened to the one view a shelf is seen from, so boxes
   pile exactly on top of one another and stand on the plank.

   The lid covers the top of the front down to a fine seam; on it, ALPHA and
   the kit number. On the box below the seam, the kit's name in heavy type and
   one thin line of the subject's colour. Everything is sized from `w`. */

import React from 'react';
import { deckAccent } from '../../decks/theme';
import { SKIN, kitNumber } from './KitBox';
import type { Kit } from '../types';

/** The front's height, and the visible strip of lid above it, for a box `w` wide. */
export const frontSize = (w: number) => ({ h: Math.round(w * 0.36), top: Math.round(w * 0.075) });

interface Props {
  kit: Pick<Kit, 'title' | 'kitNo' | 'subject' | 'finish'>;
  w: number;
  /** Draw the strip of lid top (only the top box of a pile shows its top). */
  lid?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const KitFront = ({ kit, w, lid = true, className = '', style }: Props) => {
  const s = SKIN[kit.finish === 'black' ? 'black' : 'white'];
  const { h, top } = frontSize(w);
  const band = Math.round(h * 0.4);      // the lid's front, down to the seam
  const over = Math.max(1, Math.round(w * 0.006)); // the lid overhangs the base by a hair
  const inset = Math.round(w * 0.05);    // the back edge of the top, further away
  const accent = deckAccent(kit.subject, kit.finish === 'black');
  const title = kit.title.toUpperCase();
  const longest = Math.max(...title.split(/\s+/).map(x => x.length), 1);
  const fs = Math.min(w * 0.072, (w * 0.82) / Math.max(title.length * 0.62, longest * 0.66));

  return (
    <div className={`relative select-none ${className}`} style={{ width: w, height: h + (lid ? top : 0), ...style }} aria-hidden>
      {lid && (
        <div className="absolute left-0 right-0 top-0" style={{ height: top + 1, background: s.lidTop, clipPath: `polygon(${inset}px 0, ${w - inset}px 0, ${w}px 100%, 0 100%)` }} />
      )}
      {/* The lid's front, to the seam. */}
      <div
        className="absolute left-0 right-0 flex items-center justify-between font-ui font-bold uppercase"
        style={{
          top: lid ? top : 0, height: band, padding: `0 ${w * 0.05}px`, background: s.lidFront,
          boxShadow: `inset 0 1px 0 ${s.edge}, 0 1px 0 ${s.seam}`, fontSize: Math.max(6, w * 0.03), letterSpacing: '0.24em', color: s.muted,
        }}
      >
        <span className="flex items-center" style={{ gap: w * 0.015 }}>
          <span className="font-accent italic normal-case tracking-normal" style={{ fontSize: '1.6em', color: s.ink, lineHeight: 1 }}>α</span>
          Alpha
        </span>
        <span>{kitNumber(kit.kitNo)}</span>
      </div>
      {/* The box under the lid: its name. */}
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{
          top: (lid ? top : 0) + band, left: over, right: over, height: h - band, background: s.front,
          boxShadow: `inset 0 ${Math.max(3, h * 0.08)}px ${Math.max(3, h * 0.08)}px -${Math.max(3, h * 0.08)}px ${s.seam}, inset 0 -1px 0 rgba(0,0,0,0.12)`,
        }}
      >
        <span className="font-display" style={{ fontSize: fs, lineHeight: 1, color: s.ink, letterSpacing: '-0.005em', whiteSpace: 'nowrap' }}>{title}</span>
        <span style={{ width: w * 0.12, height: Math.max(1.5, w * 0.007), background: accent, marginTop: h * 0.08, borderRadius: 2 }} />
      </div>
    </div>
  );
};
