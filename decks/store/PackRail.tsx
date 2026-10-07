/* ── The rail ──
   One brushed-steel bar, wall brackets at its ends and every few hooks, and a
   soft shadow on the wall under it. It is part of the rack's moving layer:
   the wall behind it stays put, the rail and everything on it slides. Plain
   gradients only, painted once; the rack moves it by transform. */

import React from 'react';

/** Steel, in both rooms. */
export const metal = (dark: boolean) => (dark
  ? { hi: '#8a8a93', mid: '#4a4a52', lo: '#1d1d22', edge: 'rgba(255,255,255,0.28)', shadow: 'rgba(0,0,0,0.55)' }
  : { hi: '#ffffff', mid: '#c9c9cf', lo: '#8e8e96', edge: 'rgba(255,255,255,0.95)', shadow: 'rgba(24,24,27,0.22)' });

/** The store's wall: what every rack hangs on. Graphite in the dark, so black packs still read. */
export const wallStyle = (dark: boolean): React.CSSProperties => (dark
  // A graphite gallery wall, a step lighter than the page, so black packs read against it.
  ? { background: 'radial-gradient(120% 90% at 50% 0%, #2e2e33 0%, #242428 55%, #1f1f23 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), inset 0 28px 40px -34px rgba(0,0,0,0.75)' }
  : { background: 'linear-gradient(180deg, #ebe9e4 0%, #e3e0d9 100%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7), inset 0 28px 40px -34px rgba(24,24,27,0.25)' });

export const RAIL_Y = 8;
export const RAIL_H = 12;

export const PackRail: React.FC<{ width: number; dark: boolean; brackets: number[] }> = ({ width, dark, brackets }) => {
  const m = metal(dark);
  return (
    <div aria-hidden className="absolute left-0" style={{ top: 0, width, height: RAIL_Y + RAIL_H + 14 }}>
      {/* Brackets, behind the bar, reaching up to the wall. */}
      {brackets.map(x => (
        <div key={x} className="absolute" style={{
          left: x - 7, top: 0, width: 14, height: RAIL_Y + RAIL_H - 2, borderRadius: 3,
          background: `linear-gradient(90deg, ${m.lo}, ${m.mid} 45%, ${m.lo})`,
          boxShadow: `0 4px 8px -4px ${m.shadow}`,
        }} />
      ))}
      {/* The rail's shadow on the wall. */}
      <div className="absolute" style={{ left: 10, right: 10, top: RAIL_Y + RAIL_H - 2, height: 10, background: m.shadow, filter: 'blur(6px)', opacity: 0.7 }} />
      <div className="absolute" style={{
        left: 0, right: 0, top: RAIL_Y, height: RAIL_H, borderRadius: RAIL_H / 2,
        background: `linear-gradient(180deg, ${m.hi} 0%, ${m.mid} 38%, ${m.lo} 100%)`,
        boxShadow: `inset 0 1px 0 ${m.edge}, inset 0 -1px 0 rgba(0,0,0,0.25)`,
      }} />
      {/* End caps. */}
      {[0, width - RAIL_H].map(x => (
        <div key={x} className="absolute rounded-full" style={{
          left: x, top: RAIL_Y, width: RAIL_H, height: RAIL_H,
          background: `radial-gradient(circle at 35% 30%, ${m.hi}, ${m.lo} 75%)`,
          boxShadow: `0 1px 2px ${m.shadow}`,
        }} />
      ))}
    </div>
  );
};
