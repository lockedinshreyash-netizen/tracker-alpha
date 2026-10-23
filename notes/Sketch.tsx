/* A format's shape, drawn in hairlines: how the page will be laid out, with
   no words in it. Shared by the empty notebook and the chooser on a new
   page. Strokes are currentColor, so the tile's hover colours it. */

import React from 'react';
import type { SketchRow } from './templates';

const ROW_H: Record<SketchRow, number> = { h: 10, p: 11, list: 13, todo: 11, eq: 11, table: 15, box: 14, toggle: 9 };

export function Sketch({ rows }: { rows: SketchRow[] }) {
  let y = 2;
  const parts: React.ReactNode[] = [];
  rows.forEach((r, i) => {
    const k = `${r}${i}`;
    if (r === 'h') parts.push(<rect key={k} x="0" y={y + 2} width="44" height="3.4" rx="1.7" fill="currentColor" stroke="none" />);
    if (r === 'p') parts.push(
      <g key={k} opacity="0.55"><line x1="0" y1={y + 2} x2="112" y2={y + 2} /><line x1="0" y1={y + 7} x2="76" y2={y + 7} /></g>,
    );
    if (r === 'list') parts.push(
      <g key={k} opacity="0.55">
        {[0, 4.5, 9].map(d => (<React.Fragment key={d}><circle cx="1.4" cy={y + 2 + d} r="1.1" fill="currentColor" stroke="none" /><line x1="6" y1={y + 2 + d} x2={d === 4.5 ? 70 : 92} y2={y + 2 + d} /></React.Fragment>))}
      </g>,
    );
    if (r === 'todo') parts.push(
      <g key={k} opacity="0.6">
        {[0, 5].map(d => (<React.Fragment key={d}><circle cx="1.9" cy={y + 2.5 + d} r="1.9" fill="none" /><line x1="7" y1={y + 2.5 + d} x2={d ? 60 : 84} y2={y + 2.5 + d} /></React.Fragment>))}
      </g>,
    );
    if (r === 'eq') parts.push(<line key={k} x1="38" y1={y + 4.5} x2="82" y2={y + 4.5} strokeWidth="1.8" />);
    if (r === 'table') parts.push(
      <g key={k}>
        <line x1="0" y1={y + 2} x2="120" y2={y + 2} strokeWidth="1.4" />
        <g opacity="0.45"><line x1="0" y1={y + 7} x2="120" y2={y + 7} /><line x1="0" y1={y + 12} x2="120" y2={y + 12} /></g>
      </g>,
    );
    if (r === 'box') parts.push(
      <g key={k}>
        <rect x="0" y={y} width="120" height="11" rx="3" fill="currentColor" stroke="none" opacity="0.12" />
        <line x1="5" y1={y + 5.5} x2="80" y2={y + 5.5} opacity="0.6" />
      </g>,
    );
    if (r === 'toggle') parts.push(
      <g key={k} opacity="0.65"><path d={`M1 ${y + 1.5} l2.5 2 -2.5 2`} fill="none" /><line x1="7" y1={y + 3.5} x2="54" y2={y + 3.5} /></g>,
    );
    y += ROW_H[r];
  });
  return (
    <svg className="nt-format-art" viewBox={`0 0 120 ${Math.max(y, 40)}`} preserveAspectRatio="xMinYMid meet" stroke="currentColor" strokeWidth="1" strokeLinecap="round" aria-hidden="true">
      {parts}
    </svg>
  );
}
