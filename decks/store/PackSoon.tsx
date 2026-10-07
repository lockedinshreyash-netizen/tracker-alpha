/* ── A pack that is not out yet ──
   A reserved slot: the die-cut outline of a pack, dashed, hanging on its hook,
   and the words "Coming soon". It fills a short rack and closes a long one,
   so a rack reads as a stocked display with more on the way rather than a
   rail with three things on it.

   Only drawn on a rack with at least one published pack (PackStore). A
   subject with nothing out yet gets no rack, not a rack of promises. Not
   interactive: there is nothing to take. */

import React, { useMemo } from 'react';
import { geometry } from './geometry';

export const PackSoon: React.FC<{ w: number; h: number; dark: boolean; label: string }> = ({ w, h, dark, label }) => {
  const g = useMemo(() => geometry(w, h, 1), [w, h]);
  const k = w / 198;
  const line = dark ? 'rgba(255,255,255,0.17)' : 'rgba(24,24,27,0.2)';
  const fill = dark ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.32)';
  const ink = dark ? '#8f8f98' : '#71717a';
  const faint = dark ? '#5f5f68' : '#a1a1aa';
  return (
    <div className="relative select-none" style={{ width: w, height: h }} title={label}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="absolute inset-0" aria-hidden>
        <path d={`${g.silhouette} ${g.holePath}`} fill={fill} fillRule="evenodd" />
        <path d={g.silhouette} fill="none" stroke={line} strokeWidth={1.3} strokeDasharray={`${6 * k} ${4.5 * k}`} strokeLinecap="round" />
        <path d={g.holePath} fill="none" stroke={line} strokeWidth={1.3} />
      </svg>
      <div className="absolute inset-x-0 flex flex-col items-center text-center font-ui" style={{ top: g.perf + (h - g.perf) * 0.32 }}>
        <span className="font-accent italic rounded-full flex items-center justify-center" style={{ width: 30 * k, height: 30 * k, fontSize: 16 * k, color: ink, boxShadow: `inset 0 0 0 1.3px ${line}` }}>α</span>
        <span style={{ marginTop: 12 * k, fontSize: 10.5 * k, fontWeight: 800, letterSpacing: '0.18em', color: ink }}>COMING SOON</span>
        <span style={{ marginTop: 5 * k, fontSize: 10 * k, fontWeight: 600, color: faint, maxWidth: w * 0.75 }}>{label}</span>
      </div>
    </div>
  );
};
