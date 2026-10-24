/* ── The kits rack ──
   Kits are boxes, and in a shop boxes stand in piles on a shelf. So the kits
   are one rack: a single plank, as long as the row of piles on it, carried
   sideways inside StoreRow the way a pack rack slides. One pile per kit, the
   same box three high, facing you (KitFront). A tag clipped to the plank's
   edge under each pile carries its price, the way a price strip does, with
   the name and what is inside under the shelf.

   The piles stand ON the plank: its top surface runs back under them, their
   feet are set a little in from its front edge with a soft shade where they
   meet it, and only the front edge is in front of them. Boxes in a pile sit
   square on one another, each a hair off true, the lower ones a little
   further into shadow, and only the top one shows its lid. Pointed at, the
   top box lifts a little. Geometry is inline: CDN Tailwind cannot compile
   computed values. */

import React from 'react';
import { tokens } from '../../ui/kit';
import { Icon } from '../../decks/ui';
import { KitFront, frontSize } from './KitFront';
import { kitTag } from './KitCard';
import { kitLine, type Kit } from '../types';

const PILE = 3;
/** Each box in a pile is set down a hair differently, in px per 100px of box. */
const NUDGE = [-1.4, 1.1, 0];
/** The plank: the top surface seen from a little above, then its front edge. */
const DEPTH = 22;
const EDGE = 16;
/** How far in from the front edge a pile's feet stand. */
const SET_BACK = 7;

export const shelfStyle = (dark: boolean): React.CSSProperties => ({
  background: dark
    ? 'linear-gradient(180deg, #1c1c21 0%, #17171b 100%)'
    : 'linear-gradient(180deg, #f6f4ef 0%, #ece9e2 100%)',
  boxShadow: dark ? 'inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 60px rgba(0,0,0,0.35)' : 'inset 0 1px 0 rgba(255,255,255,0.9), inset 0 0 50px rgba(0,0,0,0.04)',
});

const Pile = ({ kit, dark, w, onOpen }: { kit: Kit; dark: boolean; w: number; onOpen: () => void }) => {
  const { h, top } = frontSize(w);
  const tag = kitTag(kit);
  return (
    <button
      onClick={onOpen}
      className="kit-stand group relative block outline-none"
      style={{ width: w, height: PILE * h + top }}
      aria-label={`${kit.title}: ${kitLine(kit.items)}. ${tag}.`}
    >
      {/* Where the pile meets the plank. */}
      <span aria-hidden className="absolute pointer-events-none" style={{ left: -w * 0.04, right: -w * 0.04, bottom: -5, height: 12, borderRadius: '50%', background: `radial-gradient(50% 50% at 50% 50%, rgba(0,0,0,${dark ? 0.6 : 0.28}), transparent 75%)` }} />
      {Array.from({ length: PILE }, (_, i) => {
        const isTop = i === PILE - 1;
        return (
          <span
            key={i}
            className={`absolute left-0 block ${isTop ? 'kit-top' : ''}`}
            style={{
              bottom: i * h,
              transform: `translateX(${(NUDGE[i] * w) / 100}px)`,
              // Further down the pile, further into shade.
              filter: isTop ? undefined : `brightness(${dark ? 0.8 + i * 0.08 : 0.93 + i * 0.03})`,
            }}
          >
            <KitFront kit={kit} w={w} lid={isTop} />
          </span>
        );
      })}
    </button>
  );
};

/* One column per pile, each carrying its own stretch of plank, so the
   plank is one piece from end to end and slides with the boxes. */
const PAD = 22;
const HEADROOM = 30;

const Plank = ({ dark }: { dark: boolean }) => (
  <>
    {/* The plank's top surface, running back under the piles. */}
    <div aria-hidden style={{
      height: DEPTH,
      background: dark ? 'linear-gradient(180deg, #212126 0%, #2f2f35 100%)' : 'linear-gradient(180deg, #d9d5cc 0%, #f4f2ed 100%)',
      boxShadow: dark ? 'inset 0 6px 10px -6px rgba(0,0,0,0.8)' : 'inset 0 6px 10px -6px rgba(0,0,0,0.18)',
    }} />
    {/* Its front edge, and the shade it throws on the wall below. */}
    <div aria-hidden style={{
      height: EDGE,
      background: dark ? 'linear-gradient(180deg, #33333a 0%, #1d1d22 100%)' : 'linear-gradient(180deg, #ffffff 0%, #e2ded6 100%)',
      boxShadow: dark ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 24px -14px rgba(0,0,0,0.9)' : 'inset 0 1px 0 #fff, 0 16px 22px -14px rgba(0,0,0,0.3)',
    }} />
  </>
);

interface Props {
  kits: Kit[];
  dark: boolean;
  /** Each box's width. */
  w: number;
  onOpen: (k: Kit) => void;
  /** What an empty rack says (the store's filter can leave nothing to show). */
  empty?: { title: string; line: string };
}

/** How far one press of ‹ › should move the kits rack. */
export const kitColumn = (w: number) => w + 2 * PAD;

/** The rack's contents, for StoreRow: the piles on one plank, end to end. */
export const KitShelf = ({ kits, dark, w, onOpen, empty = { title: 'Kits are coming.', line: 'The first boxes are being packed.' } }: Props) => {
  const t = tokens(dark);
  const { h, top } = frontSize(w);
  const area = PILE * h + top + HEADROOM;
  const stand = (child: React.ReactNode) => (
    <div className="relative flex justify-center items-end" style={{ height: area, zIndex: 1, marginBottom: -(DEPTH - SET_BACK) }}>{child}</div>
  );
  return (
    <>
      {/* Plank before the first pile. */}
      <div className="shrink-0" style={{ width: 12 }}>{stand(null)}<Plank dark={dark} /></div>
      {kits.map((k, i) => (
        <div key={k.id} className="mk-rise shrink-0" style={{ width: kitColumn(w), animationDelay: `${i * 50}ms` }}>
          {stand(<Pile kit={k} dark={dark} w={w} onOpen={() => onOpen(k)} />)}
          <Plank dark={dark} />
          {/* A price tag on the shelf edge, the name under the shelf. */}
          <div className="flex flex-col items-center text-center px-2 pb-8">
            <span
              className={`relative inline-flex items-center gap-1.5 h-7 px-3 rounded-b-[4px] text-[11px] font-bold uppercase tracking-[0.08em] shadow-sm ${k.inLibrary ? '' : dark ? 'bg-[#f4f4f2] text-zinc-900' : 'bg-zinc-900 text-white'}`}
              style={{ marginTop: -EDGE + 2, ...(k.inLibrary ? { background: dark ? '#123524' : '#dcfce7', color: dark ? '#34C77B' : '#15803d' } : {}) }}
            >
              {k.inLibrary && Icon.check}{kitTag(k)}
            </span>
            <p className={`font-display text-[19px] leading-tight mt-3 ${t.heading}`}>{k.title}</p>
            <p className={`text-[12px] mt-1 ${t.muted}`}>{kitLine(k.items)}</p>
          </div>
        </div>
      ))}
      {/* The rest of the plank, to the end of the wall. */}
      <div className="flex-1" style={{ minWidth: 12 }}>
        {stand(kits.length === 0 ? (
          <div className="self-center text-center px-6">
            <p className={`font-display text-[22px] ${t.heading}`}>{empty.title}</p>
            <p className={`text-[14px] mt-2 ${t.muted}`}>{empty.line}</p>
          </div>
        ) : null)}
        <Plank dark={dark} />
      </div>
    </>
  );
};
