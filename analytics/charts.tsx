/* ── The console's charts ──
   Hand-drawn SVG: the app ships no chart library, and these five shapes are
   all the dashboard needs. Every one is measured to its container, answers
   hover and arrow keys with the same tooltip, and has a table twin in
   `ChartCard` — a tooltip is never the only way to read a number.

   Colours were run through the dataviz palette validator against the
   console's own card surfaces (#ffffff light, #111114 dark): the three line
   slots and the four growth slots pass in both modes; aqua sits under 3:1 on
   white, which is why every chart here keeps a legend and a table. The
   accent #E10600 is in none of them — it belongs to actions. */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Eyebrow, tokens } from '../ui/kit';

/* ── Colour ── */

export const chartColors = (dark: boolean) => ({
  blue: dark ? '#3987e5' : '#2a78d6',
  orange: dark ? '#d95926' : '#eb6834',
  aqua: dark ? '#199e70' : '#1baf7a',
  violet: dark ? '#9085e9' : '#4a3aa7',
  /* The lighter of two ordinal blue steps (validated --ordinal), for the part of a total that is not the point. */
  blueSoft: dark ? '#184f95' : '#86b6ef',
  ink: dark ? '#ffffff' : '#18181b',
  ink2: dark ? '#a1a1aa' : '#52525b',
  muted: dark ? '#71717a' : '#a1a1aa',
  grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(24,24,27,0.07)',
  baseline: dark ? 'rgba(255,255,255,0.16)' : 'rgba(24,24,27,0.18)',
  surface: dark ? '#111114' : '#ffffff',
});

/** One hue, light → dark on paper and dim → bright on ink, receding to the card at zero. */
const heatAlpha = (t: number, fade = 1): number => (t <= 0 ? 0 : (0.1 + 0.9 * Math.min(1, t)) * fade);
/** `fade` < 1 washes the fill out for a figure that is still provisional. */
export const heat = (t: number, dark: boolean, fade = 1): string =>
  dark ? `rgba(57,135,229,${heatAlpha(t, fade).toFixed(3)})` : `rgba(42,120,214,${heatAlpha(t, fade).toFixed(3)})`;

const luminance = ([r, g, b]: number[]): number => {
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/** White or ink, whichever reads better on that cell once it is composited on the card. */
export const heatInk = (t: number, dark: boolean, fade = 1): string => {
  const a = heatAlpha(t, fade);
  const hue = dark ? [57, 135, 229] : [42, 120, 214];
  const card = dark ? [17, 17, 20] : [255, 255, 255];
  const L = luminance(hue.map((h, i) => h * a + card[i] * (1 - a)));
  const onWhite = 1.05 / (L + 0.05);
  const onInk = (L + 0.05) / (luminance([24, 24, 27]) + 0.05);
  return onWhite >= onInk ? '#ffffff' : '#18181b';
};

/* ── Numbers and dates ── */

export const fmt = (n: number | null | undefined, digits = 0): string =>
  n === null || n === undefined || !Number.isFinite(n)
    ? '—'
    : n.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export const compact = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '')}K`;
  return `${Math.round(n * 10) / 10}`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** '2026-10-11' → '11 Oct'. Study-day strings, so no time zone is involved. */
export const shortDate = (day: string): string => {
  const [, m, d] = day.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};
/** '2026-10-11' → '11 Oct ’26', for axes that span more than one October. */
export const yearDate = (day: string): string => `${shortDate(day)} ’${day.slice(2, 4)}`;
export const longDate = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
};

/** Round tick steps (1, 2, 2.5, 5 × 10ⁿ) covering 0..max in about four steps. */
export const niceTicks = (max: number, count = 4): number[] => {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag;
  const top = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = 0; v <= top + step / 1e6; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
};

/* ── Layout plumbing ── */

const useWidth = (): [React.RefObject<HTMLDivElement>, number] => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(entries => {
      const w = Math.round(entries[0].contentRect.width);
      setWidth(prev => (prev === w ? prev : w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
};

/** Which x index the pointer or the arrow keys are on. */
const useCursor = (count: number) => {
  const [index, setIndex] = useState<number | null>(null);
  useEffect(() => { setIndex(null); }, [count]);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setIndex(i => {
        const base = i ?? (e.key === 'ArrowLeft' ? count : -1);
        return Math.max(0, Math.min(count - 1, base + (e.key === 'ArrowLeft' ? -1 : 1)));
      });
    } else if (e.key === 'Escape') {
      setIndex(null);
    }
  };
  return { index, setIndex, onKey };
};

export interface TipRow {
  label: string;
  value: string;
  color?: string;
  /** 'line' keys a line series; anything else is a rect. */
  kind?: 'line' | 'rect';
}

/** Values lead, labels follow; keyed by a short stroke, never a filled box. */
const Tooltip: React.FC<{ dark: boolean; x: number; width: number; title: string; rows: TipRow[]; top?: number }> = ({ dark, x, width, title, rows, top = 4 }) => {
  const W = 176;
  const left = x + 14 + W > width ? Math.max(0, x - 14 - W) : x + 14;
  return (
    <div
      role="status"
      className={`pointer-events-none absolute z-10 rounded-lg border px-3 py-2.5 font-ui shadow-lg ${dark ? 'bg-[#1a1a1f] border-white/[0.08]' : 'bg-white border-zinc-200'}`}
      style={{ left, top, width: W }}
    >
      <p className={`text-[10px] font-bold uppercase tracking-[0.06em] ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>{title}</p>
      <div className="mt-1.5 space-y-1">
        {rows.map(r => (
          <div key={r.label} className="flex items-center gap-2">
            {r.color && <span aria-hidden className="shrink-0 rounded-full" style={{ width: 10, height: 3, background: r.color }} />}
            <span className={`text-[13px] font-bold tabular-nums ${dark ? 'text-white' : 'text-zinc-900'}`}>{r.value}</span>
            <span className={`text-[11px] truncate ${dark ? 'text-zinc-500' : 'text-zinc-500'}`}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const Legend: React.FC<{ dark: boolean; items: Array<{ label: string; color: string; kind?: 'line' | 'rect' }> }> = ({ dark, items }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
    {items.map(i => (
      <span key={i.label} className={`inline-flex items-center gap-1.5 text-[11px] font-ui ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
        <span
          aria-hidden
          className={i.kind === 'line' ? 'rounded-full' : 'rounded-[2px]'}
          style={i.kind === 'line' ? { width: 12, height: 2, background: i.color } : { width: 9, height: 9, background: i.color }}
        />
        {i.label}
      </span>
    ))}
  </div>
);

/* ── Card with a table twin ── */

export interface TableView {
  head: string[];
  rows: Array<Array<string | number>>;
}

export const ChartCard: React.FC<{
  dark: boolean;
  title: string;
  sub?: React.ReactNode;
  legend?: React.ReactNode;
  table?: TableView;
  className?: string;
  delay?: number;
  children: React.ReactNode;
}> = ({ dark, title, sub, legend, table, className = '', delay = 0, children }) => {
  const [showTable, setShowTable] = useState(false);
  const t = tokens(dark);
  return (
    <section className={`mk-rise rounded-xl border p-5 md:p-6 min-w-0 ${t.card} ${className}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow dark={dark}>{title}</Eyebrow>
          {sub && <div className={`text-[12px] font-ui mt-1 ${t.muted}`}>{sub}</div>}
        </div>
        {table && (
          <button
            type="button"
            onClick={() => setShowTable(v => !v)}
            aria-pressed={showTable}
            className={`shrink-0 px-2.5 py-1 rounded-md border text-[10px] font-bold uppercase tracking-[0.06em] font-ui transition-colors ${dark
              ? 'border-white/[0.08] text-zinc-500 hover:text-zinc-200'
              : 'border-zinc-200 text-zinc-500 hover:text-zinc-900'}`}
          >
            {showTable ? 'Chart' : 'Table'}
          </button>
        )}
      </div>
      {legend && !showTable && <div className="mt-3">{legend}</div>}
      <div className="mt-4">
        {showTable && table ? <DataTable dark={dark} table={table} /> : children}
      </div>
    </section>
  );
};

const DataTable: React.FC<{ dark: boolean; table: TableView }> = ({ dark, table }) => (
  <div className={`max-h-[320px] overflow-auto rounded-lg border ${dark ? 'border-white/[0.06]' : 'border-zinc-100'}`}>
    <table className="w-full text-[12px] font-ui">
      <thead className={`sticky top-0 ${dark ? 'bg-[#16161a]' : 'bg-zinc-50'}`}>
        <tr>
          {table.head.map((h, i) => (
            <th key={h} className={`px-3 py-2 font-bold text-[10px] uppercase tracking-[0.06em] ${i === 0 ? 'text-left' : 'text-right'} ${dark ? 'text-zinc-500' : 'text-zinc-500'}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {table.rows.map((r, ri) => (
          <tr key={ri} className={`border-t ${dark ? 'border-white/[0.04]' : 'border-zinc-100'}`}>
            {r.map((c, ci) => (
              <td key={ci} className={`px-3 py-1.5 tabular-nums ${ci === 0 ? 'text-left' : 'text-right'} ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

/* ── Shared axis maths ── */

const PAD_T = 10;
const PAD_B = 24;

const xTicks = (count: number, width: number): number[] => {
  const want = Math.max(2, Math.min(7, Math.floor(width / 90)));
  if (count <= want) return Array.from({ length: count }, (_, i) => i);
  const out: number[] = [];
  for (let k = 0; k < want; k++) out.push(Math.round((k * (count - 1)) / (want - 1)));
  return [...new Set(out)];
};

const YAxis: React.FC<{ ticks: number[]; y: (v: number) => number; x0: number; x1: number; c: ReturnType<typeof chartColors>; format: (v: number) => string }> = ({ ticks, y, x0, x1, c, format }) => (
  <g>
    {ticks.map(t => (
      <g key={t}>
        <line x1={x0} x2={x1} y1={y(t)} y2={y(t)} stroke={t === 0 ? c.baseline : c.grid} strokeWidth={1} shapeRendering="crispEdges" />
        <text x={x0 - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill={c.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {format(t)}
        </text>
      </g>
    ))}
  </g>
);

/* ── Lines ── */

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

export const LineChart: React.FC<{
  dark: boolean;
  labels: string[];
  series: LineSeries[];
  height?: number;
  format?: (v: number) => string;
  /** Index of a reference rule, e.g. the day live tracking began. */
  marker?: { index: number; label: string } | null;
  ariaLabel: string;
  area?: boolean;
}> = ({ dark, labels, series, height = 240, format = compact, marker, ariaLabel, area }) => {
  const [ref, width] = useWidth();
  const c = chartColors(dark);
  const n = labels.length;
  const { index, setIndex, onKey } = useCursor(n);
  const PAD_L = 40;
  const endLabels = series.length > 1 && series.length <= 3;
  const PAD_R = endLabels ? 52 : 14;

  const max = Math.max(1, ...series.flatMap(s => s.values));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const plotW = Math.max(1, width - PAD_L - PAD_R);
  const plotH = height - PAD_T - PAD_B;
  const x = (i: number) => PAD_L + (n <= 1 ? plotW / 2 : (i * plotW) / (n - 1));
  const y = (v: number) => PAD_T + plotH - (v / top) * plotH;

  /* End labels only when they will not collide; otherwise the legend carries identity. */
  const ends = endLabels
    ? series.map(s => ({ s, y: y(s.values[n - 1] ?? 0) })).sort((a, b) => a.y - b.y)
    : [];
  const endsFit = ends.every((e, i) => i === 0 || e.y - ends[i - 1].y >= 13);

  const move = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const px = e.clientX - r.left;
    setIndex(Math.max(0, Math.min(n - 1, Math.round(((px - PAD_L) / plotW) * (n - 1)))));
  };

  return (
    <div ref={ref} className="relative outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 rounded-md" tabIndex={0} onKeyDown={onKey} onBlur={() => setIndex(null)} aria-label={ariaLabel} role="img">
      {width > 0 && (
        <svg width={width} height={height} className="block font-ui" onPointerMove={move} onPointerLeave={() => setIndex(null)}>
          <YAxis ticks={ticks} y={y} x0={PAD_L} x1={PAD_L + plotW} c={c} format={format} />
          {xTicks(n, plotW).map(i => (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={10} fill={c.muted}>
              {labels[i]}
            </text>
          ))}
          {marker && marker.index > 0 && marker.index < n && (
            <g>
              <line x1={x(marker.index)} x2={x(marker.index)} y1={PAD_T} y2={PAD_T + plotH} stroke={c.muted} strokeWidth={1} shapeRendering="crispEdges" />
              {/* Flipped to the left of the rule when it would run into the end labels. */}
              {x(marker.index) + 90 > PAD_L + plotW
                ? <text x={x(marker.index) - 5} y={PAD_T + 9} textAnchor="end" fontSize={10} fill={c.muted}>{marker.label}</text>
                : <text x={x(marker.index) + 5} y={PAD_T + 9} fontSize={10} fill={c.muted}>{marker.label}</text>}
            </g>
          )}
          {area && series.length === 1 && n > 1 && (
            <path
              d={`M${x(0)},${y(0)} ${series[0].values.map((v, i) => `L${x(i)},${y(v)}`).join(' ')} L${x(n - 1)},${y(0)} Z`}
              fill={series[0].color}
              opacity={0.1}
            />
          )}
          {series.map(s => (
            <path
              key={s.key}
              d={s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {series.map(s => n > 0 && (
            <circle key={`${s.key}-end`} cx={x(n - 1)} cy={y(s.values[n - 1] ?? 0)} r={4} fill={s.color} stroke={c.surface} strokeWidth={2} />
          ))}
          {endsFit && ends.map(e => (
            <text key={`${e.s.key}-lbl`} x={x(n - 1) + 9} y={e.y} dy="0.32em" fontSize={11} fontWeight={700} fill={c.ink2}>
              {e.s.label}
            </text>
          ))}
          {index !== null && (
            <g>
              <line x1={x(index)} x2={x(index)} y1={PAD_T} y2={PAD_T + plotH} stroke={c.ink2} strokeWidth={1} opacity={0.5} shapeRendering="crispEdges" />
              {series.map(s => (
                <circle key={`${s.key}-hi`} cx={x(index)} cy={y(s.values[index] ?? 0)} r={4} fill={s.color} stroke={c.surface} strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      )}
      {index !== null && width > 0 && (
        <Tooltip
          dark={dark}
          x={x(index)}
          width={width}
          title={labels[index]}
          rows={series.map(s => ({ label: s.label, value: format === compact ? fmt(s.values[index]) : format(s.values[index] ?? 0), color: s.color, kind: 'line' }))}
        />
      )}
    </div>
  );
};

/* ── Columns: plain, stacked, or with one series below the baseline ── */

export interface ColumnSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
  /** Drawn under the baseline (losses). */
  below?: boolean;
}

const roundedUp = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
const roundedDown = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x},${y} V${y + h - r} Q${x},${y + h} ${x + r},${y + h} H${x + w - r} Q${x + w},${y + h} ${x + w},${y + h - r} V${y} Z`;

export const ColumnChart: React.FC<{
  dark: boolean;
  labels: string[];
  series: ColumnSeries[];
  height?: number;
  format?: (v: number) => string;
  ariaLabel: string;
  /** Extra tooltip lines per index (e.g. students, sessions). */
  extra?: (i: number) => TipRow[];
  /** Tooltip title per index, when it should say more than the axis label. */
  title?: (i: number) => string;
  /** Indices drawn faded — a period still being written. */
  partial?: (i: number) => boolean;
}> = ({ dark, labels, series, height = 220, format = compact, ariaLabel, extra, title, partial }) => {
  const [ref, width] = useWidth();
  const c = chartColors(dark);
  const n = labels.length;
  const { index, setIndex, onKey } = useCursor(n);
  const PAD_L = 40;
  const PAD_R = 8;

  const up = series.filter(s => !s.below);
  const down = series.filter(s => s.below);
  const upTotals = labels.map((_, i) => up.reduce((t, s) => t + (s.values[i] ?? 0), 0));
  const downTotals = labels.map((_, i) => down.reduce((t, s) => t + (s.values[i] ?? 0), 0));
  const maxUp = Math.max(0, ...upTotals);
  const maxDown = Math.max(0, ...downTotals);

  const plotW = Math.max(1, width - PAD_L - PAD_R);
  const plotH = height - PAD_T - PAD_B;
  const ticksUp = niceTicks(Math.max(maxUp, 1));
  /* One step above and below the line, so the two halves read on the same scale. */
  const stepUp = ticksUp[1] - ticksUp[0];
  const ticksDown: number[] = [];
  for (let v = stepUp; maxDown > 0 && v < maxDown + stepUp; v += stepUp) ticksDown.push(v);
  const topV = ticksUp[ticksUp.length - 1];
  const botV = ticksDown.length ? ticksDown[ticksDown.length - 1] : 0;
  const span = topV + botV;
  const y = (v: number) => PAD_T + ((topV - v) / span) * plotH;
  const allTicks = [...ticksUp, ...ticksDown.map(t => -t)];

  const band = plotW / Math.max(1, n);
  const barW = Math.max(1, Math.min(24, band * (band > 6 ? 0.72 : 1) - (band > 4 ? 2 : 0)));
  const bx = (i: number) => PAD_L + i * band + (band - barW) / 2;

  const move = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    setIndex(Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left - PAD_L) / band))));
  };

  const stack = (list: ColumnSeries[], i: number, dir: 1 | -1) => {
    let acc = 0;
    const segs: React.ReactNode[] = [];
    const visible = list.filter(s => (s.values[i] ?? 0) > 0);
    visible.forEach((s, k) => {
      const v = s.values[i] ?? 0;
      const y0 = y(dir * acc);
      const y1 = y(dir * (acc + v));
      acc += v;
      const last = k === visible.length - 1;
      const gap = !last && Math.abs(y1 - y0) > 3 ? 2 : 0;
      const h = Math.max(0.5, Math.abs(y1 - y0) - gap);
      const r = last ? Math.min(4, barW / 2, h) : 0;
      const d = dir === 1
        ? roundedUp(bx(i), y1 + (last ? 0 : gap), barW, h, r)
        : roundedDown(bx(i), y0, barW, h, r);
      segs.push(<path key={s.key} d={d} fill={s.color} />);
    });
    return segs;
  };

  return (
    <div ref={ref} className="relative outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 rounded-md" tabIndex={0} onKeyDown={onKey} onBlur={() => setIndex(null)} aria-label={ariaLabel} role="img">
      {width > 0 && (
        <svg width={width} height={height} className="block font-ui" onPointerMove={move} onPointerLeave={() => setIndex(null)}>
          <YAxis ticks={allTicks} y={y} x0={PAD_L} x1={PAD_L + plotW} c={c} format={v => format(Math.abs(v))} />
          {labels.map((_, i) => (
            <g key={i} opacity={(index !== null && index !== i ? 0.55 : 1) * (partial?.(i) ? 0.5 : 1)}>
              {stack(up, i, 1)}
              {stack(down, i, -1)}
            </g>
          ))}
          {xTicks(n, plotW).map(i => (
            <text key={i} x={bx(i) + barW / 2} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={10} fill={c.muted}>
              {labels[i]}
            </text>
          ))}
        </svg>
      )}
      {index !== null && width > 0 && (
        <Tooltip
          dark={dark}
          x={bx(index) + barW / 2}
          width={width}
          title={title ? title(index) : labels[index]}
          rows={[
            ...series.map(s => ({ label: s.label, value: format === compact ? fmt(s.values[index]) : format(s.values[index] ?? 0), color: s.color })),
            ...(extra ? extra(index) : []),
          ]}
        />
      )}
    </div>
  );
};

/* ── Horizontal bars, labelled at both ends ── */

export interface HBarRow {
  label: string;
  value: number;
  /** What the bar is a share of; omitted bars scale to the largest row. */
  of?: number;
  display?: string;
  hint?: string;
}

export const HBars: React.FC<{ dark: boolean; rows: HBarRow[]; color: string; labelWidth?: number }> = ({ dark, rows, color, labelWidth = 120 }) => {
  const max = Math.max(1, ...rows.map(r => r.of ?? r.value));
  const t = tokens(dark);
  return (
    <ul className="space-y-2.5 font-ui">
      {rows.map(r => {
        const frac = Math.max(0, Math.min(1, r.value / (r.of ?? max)));
        return (
          <li key={r.label} className="flex items-center gap-3" title={r.hint}>
            <span className={`shrink-0 text-[12px] truncate ${t.body}`} style={{ width: labelWidth }}>{r.label}</span>
            <span className={`relative flex-1 h-[14px] rounded-r-[4px] ${dark ? 'bg-white/[0.03]' : 'bg-zinc-50'}`}>
              <span
                className="absolute inset-y-0 left-0 rounded-r-[4px] mk-grow-x origin-left"
                style={{ width: `${frac * 100}%`, background: color, minWidth: r.value > 0 ? 2 : 0 }}
              />
            </span>
            <span className={`shrink-0 w-[92px] text-right text-[12px] font-bold tabular-nums ${t.heading}`}>{r.display ?? fmt(r.value)}</span>
          </li>
        );
      })}
    </ul>
  );
};

/* ── A whole split into at most three parts ── */

export const SplitBar: React.FC<{
  dark: boolean;
  label: string;
  parts: Array<{ label: string; value: number; color: string }>;
}> = ({ dark, label, parts }) => {
  const total = parts.reduce((t, p) => t + p.value, 0);
  const t = tokens(dark);
  const live = parts.filter(p => p.value > 0);
  return (
    <div className="font-ui">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`text-[12px] font-bold ${t.heading}`}>{label}</span>
        <span className={`text-[11px] ${t.faint}`}>{fmt(total)} reporting</span>
      </div>
      <div className={`mt-2 flex h-[12px] rounded-[4px] overflow-hidden ${dark ? 'bg-white/[0.04]' : 'bg-zinc-100'}`}>
        {total > 0 && live.map((p, i) => (
          <span
            key={p.label}
            title={`${p.label}: ${fmt(p.value)}`}
            style={{ width: `${(p.value / total) * 100}%`, background: p.color, marginLeft: i === 0 ? 0 : 2 }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {parts.map(p => (
          <span key={p.label} className={`inline-flex items-center gap-1.5 text-[11px] ${t.muted}`}>
            <span aria-hidden className="rounded-[2px]" style={{ width: 8, height: 8, background: p.color }} />
            <span className={`font-bold tabular-nums ${t.heading}`}>{total ? `${Math.round((p.value / total) * 100)}%` : '—'}</span>
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
};

/* ── Cohort grid ── */

export const CohortGrid: React.FC<{
  dark: boolean;
  cohorts: Array<{ week: string; size: number; active: number[] }>;
  today: string;
  weeks?: number;
}> = ({ dark, cohorts, today, weeks = 12 }) => {
  const t = tokens(dark);
  const todayV = Date.parse(`${today}T00:00:00Z`);
  /* A cell is final once its LAST member (signed up on the Sunday) has lived the whole week. */
  const complete = (week: string, k: number) =>
    Date.parse(`${week}T00:00:00Z`) + (6 + 7 * k + 6) * 86_400_000 <= todayV;
  const rows = useMemo(() => [...cohorts].reverse(), [cohorts]);
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full border-separate font-ui" style={{ borderSpacing: 2 }}>
        <thead>
          <tr>
            <th className={`text-left text-[10px] font-bold uppercase tracking-[0.06em] pr-2 ${t.faint}`}>Signed up</th>
            <th className={`text-right text-[10px] font-bold uppercase tracking-[0.06em] pr-2 ${t.faint}`}>People</th>
            {Array.from({ length: weeks }, (_, k) => (
              <th key={k} className={`text-center text-[10px] font-bold ${t.faint}`} style={{ minWidth: 38 }}>W{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(c => (
            <tr key={c.week}>
              <td className={`text-[12px] pr-2 whitespace-nowrap ${t.body}`}>{shortDate(c.week)}</td>
              <td className={`text-[12px] text-right pr-2 tabular-nums ${t.muted}`}>{fmt(c.size)}</td>
              {Array.from({ length: weeks }, (_, k) => {
                const v = c.active[k];
                if (v === undefined) return <td key={k} />;
                const share = c.size ? v / c.size : 0;
                const done = complete(c.week, k);
                return (
                  <td
                    key={k}
                    title={`${shortDate(c.week)} cohort, week ${k}: ${fmt(v)} of ${fmt(c.size)}${done ? '' : ' (week still running)'}`}
                    className="text-center text-[11px] font-bold tabular-nums rounded-[4px] h-[26px]"
                    style={{
                      background: heat(share, dark, done ? 1 : 0.45),
                      color: heatInk(share, dark, done ? 1 : 0.45),
                      outline: done ? undefined : `1px dashed ${dark ? 'rgba(255,255,255,0.25)' : 'rgba(24,24,27,0.25)'}`,
                      outlineOffset: -1,
                    }}
                  >
                    {Math.round(share * 100)}%
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
