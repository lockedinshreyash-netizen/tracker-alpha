/* ── A hook ──
   A peg hook belongs to the rail, not to the pack. It is drawn in two halves
   so the pack can sit between them:

   - `back`: the mount plate on the rail, and the rod running forward to the
     pack. Seen from just above, "forward" is downward on screen. It paints
     under the pack, so it shows above the pack and through the slot.
   - `front`: the rod coming out of the slot toward you and ending in a
     ball tip, with the tip's small shadow on the pack. It paints over it.

   So the rod visibly goes through the pack: rail → hook → pack. When the
   front pack has been taken, the next one hangs further back on the same rod
   (higher, seen from above). `reach` extends the front half back to it, so
   the empty stretch of rod in front of it shows. */

import React from 'react';
import { RAIL_H, RAIL_Y, metal } from './PackRail';

interface Props { x: number; pivotY: number; dark: boolean; scale: number }

const rod = (dark: boolean) => {
  const m = metal(dark);
  return `linear-gradient(90deg, ${m.lo} 0%, ${m.hi} 42%, ${m.mid} 62%, ${m.lo} 100%)`;
};

export const HookBack: React.FC<Props> = ({ x, pivotY, dark, scale }) => {
  const m = metal(dark);
  const w = 4 * scale;
  return (
    <div aria-hidden className="absolute pointer-events-none" style={{ left: 0, top: 0 }}>
      {/* The rod's shadow on the wall: cast down and to the right. */}
      <div className="absolute" style={{ left: x + 4, top: RAIL_Y + RAIL_H, width: 3, height: pivotY - RAIL_Y - RAIL_H + 10, background: m.shadow, filter: 'blur(2.5px)', opacity: 0.55, borderRadius: 2 }} />
      <div className="absolute" style={{ left: x - w / 2, top: RAIL_Y + RAIL_H - 4, width: w, height: pivotY - RAIL_Y - RAIL_H + 7, background: rod(dark), borderRadius: w }} />
      {/* The mount plate, clamped over the rail. */}
      <div className="absolute" style={{
        left: x - 8 * scale, top: RAIL_Y - 4, width: 16 * scale, height: RAIL_H + 9, borderRadius: 3,
        background: `linear-gradient(180deg, ${m.hi}, ${m.mid} 50%, ${m.lo})`,
        boxShadow: `inset 0 1px 0 ${m.edge}, 0 3px 6px -2px ${m.shadow}`,
      }} />
      <div className="absolute rounded-full" style={{ left: x - 2, top: RAIL_Y + RAIL_H / 2 - 1, width: 4, height: 4, background: m.lo, boxShadow: `inset 0 1px 0 rgba(0,0,0,0.4), 0 1px 0 ${m.edge}` }} />
    </div>
  );
};

export const HookFront: React.FC<Props & { bare?: boolean; reach?: number }> = ({ x, pivotY, dark, scale, bare = false, reach = 0 }) => {
  const m = metal(dark);
  const w = 5 * scale;
  const len = 15 * scale;
  const tip = 9 * scale;
  return (
    <div aria-hidden className="absolute pointer-events-none" style={{ left: 0, top: 0 }}>
      {/* The tip's shadow — on the pack, or on the wall when the hook is bare. */}
      <div className="absolute rounded-full" style={{ left: x - tip * 0.6 + 2, top: pivotY + len + tip * 0.4, width: tip * 1.3, height: tip * 0.55, background: m.shadow, filter: 'blur(3px)', opacity: bare ? 0.45 : 0.6 }} />
      <div className="absolute" style={{ left: x - w / 2, top: pivotY - reach - w * 0.4, width: w, height: len + reach, background: rod(dark), borderRadius: w }} />
      <div className="absolute rounded-full" style={{
        left: x - tip / 2, top: pivotY + len - tip * 0.55, width: tip, height: tip,
        background: `radial-gradient(circle at 34% 30%, ${m.hi} 0%, ${m.mid} 45%, ${m.lo} 100%)`,
        boxShadow: `0 1px 1.5px ${m.shadow}`,
      }} />
    </div>
  );
};
