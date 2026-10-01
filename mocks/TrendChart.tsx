/* ── The trend ──
   One line per exam and scope, never one line through everything: a Main
   mock and an Advanced mock are different instruments, and so are a full
   paper and a one-chapter test — joining them draws a zig-zag that describes
   the papers rather than the student. Colour is the exam; the marker's shape
   is the scope (full ● / part ○ / chapter ◆). Full papers get the strong
   line, part tests a lighter one, and chapter tests no line at all: two
   chapter tests on unrelated chapters are not a trend.

   Evenly spaced by mock, not by date — the question is "am I getting better
   from one paper to the next", and two mocks on one Sunday would otherwise sit
   on top of each other. Dates ride the axis and the tooltip.

   Hand-rolled SVG, measured to its container so text renders at 1:1. */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MockExam, Subject } from '../types';
import { EXAMS, SCOPES, examColor, totals } from './model';
import { TakenMock, formatDate, slope } from './insights';
import { ExamBadge, ScopeBadge, ScopeGlyph, deltaTone, pct, signedPct, subjectDot, tokens } from './ui';

export type Metric = 'score' | 'accuracy' | 'percentile';

export const METRIC_LABEL: Record<Metric, string> = {
  score: 'Score',
  accuracy: 'Accuracy',
  percentile: 'Percentile',
};

const valueOf = (t: TakenMock, m: Metric): number | null =>
  m === 'score' ? t.pct : m === 'accuracy' ? t.accuracy : t.percentile;

/* Monotone cubic (Fritsch–Carlson): smooth, and never overshoots a point, so
   the curve cannot invent a peak the student never scored. */
const monotonePath = (pts: { x: number; y: number }[]): string => {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  if (n === 2) return `M${pts[0].x},${pts[0].y}L${pts[1].x},${pts[1].y}`;
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    m.push((pts[i + 1].y - pts[i].y) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = a * a + b * b;
    if (h > 9) { const k = 3 / Math.sqrt(h); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${pts[i].x + h},${pts[i].y + h * t[i]} ${pts[i + 1].x - h},${pts[i + 1].y - h * t[i + 1]} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
};

const niceDomain = (vals: number[]): [number, number] => {
  if (!vals.length) return [0, 100];
  let lo = Math.max(0, Math.floor((Math.min(...vals) - 6) / 10) * 10);
  let hi = Math.min(100, Math.ceil((Math.max(...vals) + 6) / 10) * 10);
  if (hi - lo < 30) {
    const pad = (30 - (hi - lo)) / 2;
    lo = Math.max(0, Math.floor((lo - pad) / 10) * 10);
    hi = Math.min(100, Math.ceil((hi + pad) / 10) * 10);
  }
  return [lo, hi];
};

interface Props {
  series: TakenMock[];
  metric: Metric;
  dark: boolean;
  today: string;
  onOpen: (id: string) => void;
}

const TrendChart: React.FC<Props> = ({ series, metric, dark, today, onOpen }) => {
  const t = tokens(dark);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = width < 520 ? 220 : 270;
  const M = { top: 18, right: width < 520 ? 34 : 46, bottom: 30, left: 36 };
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;

  const points = useMemo(() => series.map((s, i) => ({ s, i, v: valueOf(s, metric) })), [series, metric]);
  const defined = points.filter(p => p.v !== null) as { s: TakenMock; i: number; v: number }[];
  const [lo, hi] = niceDomain(defined.map(p => p.v));
  const n = series.length;
  const x = (i: number) => M.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => M.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;
  const ticks: number[] = [];
  const stepTick = hi - lo > 60 ? 20 : 10;
  for (let v = lo; v <= hi + 0.001; v += stepTick) ticks.push(v);

  const exams = Array.from(new Set(defined.map(p => p.s.test.exam))) as MockExam[];
  const scopes = Array.from(new Set(defined.map(p => p.s.test.scope)));

  const lines = exams.flatMap(exam => (['full', 'part'] as const).map(scope => {
    const pts = defined.filter(p => p.s.test.exam === exam && p.s.test.scope === scope).map(p => ({ x: x(p.i), y: y(p.v), p }));
    return { exam, scope, pts, d: monotonePath(pts) };
  })).filter(l => l.pts.length > 0);
  const singleLine = lines.length === 1 ? lines[0] : null;

  // A faint least-squares line over the last six, when exactly one line is in view.
  const fit = useMemo(() => {
    if (!singleLine || singleLine.pts.length < 3) return null;
    const recent = singleLine.pts.map(pt => pt.p).slice(-6);
    const k = slope(recent.map(p => p.v));
    if (k === null) return null;
    const ym = recent.reduce((a, p) => a + p.v, 0) / recent.length;
    const xm = (recent.length - 1) / 2;
    const v0 = ym - k * xm, v1 = ym + k * (recent.length - 1 - xm);
    return { x0: x(recent[0].i), y0: y(Math.max(lo, Math.min(hi, v0))), x1: x(recent[recent.length - 1].i), y1: y(Math.max(lo, Math.min(hi, v1))), k };
  }, [singleLine, lo, hi, width]); // eslint-disable-line react-hooks/exhaustive-deps

  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(plotW / 78))));

  const pick = (clientX: number) => {
    const el = wrapRef.current;
    if (!el || !n) return;
    const rx = clientX - el.getBoundingClientRect().left;
    let best = 0, bestD = Infinity;
    points.forEach(p => { const d = Math.abs(x(p.i) - rx); if (d < bestD) { bestD = d; best = p.i; } });
    setHover(best);
  };

  if (!defined.length) {
    return (
      <div ref={wrapRef} className={`h-[220px] flex flex-col items-center justify-center text-center rounded-lg border border-dashed ${t.rule}`}>
        <p className={`text-sm font-ui font-semibold ${t.body}`}>No {METRIC_LABEL[metric].toLowerCase()} logged in this view.</p>
        <p className={`text-[12px] font-ui mt-1 ${t.muted}`}>
          {metric === 'score' ? 'Log a result to start the line.' : metric === 'accuracy' ? 'Add correct / wrong counts when you log a result.' : 'Add the percentile your test series gives you.'}
        </p>
      </div>
    );
  }

  const hp = hover !== null ? points[hover] : null;
  const prevSame = hp ? [...points.slice(0, hp.i)].reverse().find(p => p.s.test.exam === hp.s.test.exam && p.v !== null) : null;
  /* Beside the point, never over it: to its left on the right half of the
     chart, to its right on the left half. Phones are too narrow for that, so
     there it sits above or below the point instead. */
  const TIP_W = 240, TIP_H = 230;
  const narrow = width < 560;
  const tipLeft = !hp ? 0 : narrow
    ? Math.min(Math.max(x(hp.i) - TIP_W / 2, 0), width - TIP_W)
    : x(hp.i) > width / 2 ? x(hp.i) - TIP_W - 18 : x(hp.i) + 18;
  const tipTop = !hp || hp.v === null ? 0 : narrow
    ? (y(hp.v) > height / 2 ? Math.max(0, y(hp.v) - TIP_H - 14) : y(hp.v) + 14)
    : Math.min(Math.max(0, y(hp.v) - TIP_H / 2), height - TIP_H);

  return (
    <div>
      <div
        ref={wrapRef}
        className="relative select-none"
        style={{ height }}
        onPointerMove={e => pick(e.clientX)}
        onPointerDown={e => pick(e.clientX)}
        onPointerLeave={e => { if (e.pointerType === 'mouse') setHover(null); }}
        onClick={() => { if (hp) onOpen(hp.s.test.id); }}
      >
        <svg width={width} height={height} className="block overflow-visible" role="img" aria-label={`${METRIC_LABEL[metric]} across ${n} mocks`}>
          <defs>
            {exams.map(e => (
              <linearGradient key={e} id={`mk-wash-${e}-${dark ? 'd' : 'l'}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={examColor(e, dark)} stopOpacity={dark ? 0.22 : 0.16} />
                <stop offset="100%" stopColor={examColor(e, dark)} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          {ticks.map(v => (
            <g key={v}>
              <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke={t.grid} strokeWidth={1} />
              <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={10} fill={t.axis} className="font-ui tabular-nums">{v}</text>
            </g>
          ))}

          {/* Every k-th date, plus the last — skipping the k-th one that would crowd it. */}
          {points.map(p => p.i === n - 1 || (p.i % labelEvery === 0 && n - 1 - p.i >= labelEvery * 0.6) ? (
            <text key={p.i} x={x(p.i)} y={height - 8} textAnchor="middle" fontSize={10} fill={t.axis} className="font-ui">
              {formatDate(p.s.test.date, today)}
            </text>
          ) : null)}

          {singleLine && singleLine.pts.length > 1 && (
            <path
              className="mk-fade"
              d={`${singleLine.d}L${singleLine.pts[singleLine.pts.length - 1].x},${M.top + plotH}L${singleLine.pts[0].x},${M.top + plotH}Z`}
              fill={`url(#mk-wash-${singleLine.exam}-${dark ? 'd' : 'l'})`}
            />
          )}

          {fit && (
            <line x1={fit.x0} y1={fit.y0} x2={fit.x1} y2={fit.y1} stroke={t.axis} strokeOpacity={0.55} strokeWidth={1} strokeDasharray="3 4" />
          )}

          {lines.map(l => l.pts.length > 1 && (
            <path
              key={`${l.exam}-${l.scope}-${metric}`}
              className="mk-draw"
              pathLength={1}
              style={{ ['--mk-len' as string]: 1 } as React.CSSProperties}
              d={l.d}
              fill="none"
              stroke={examColor(l.exam, dark)}
              strokeOpacity={l.scope === 'full' ? 1 : 0.55}
              strokeWidth={l.scope === 'full' ? 2.25 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {hp && (
            <line x1={x(hp.i)} x2={x(hp.i)} y1={M.top} y2={M.top + plotH} stroke={dark ? 'rgba(255,255,255,0.18)' : 'rgba(24,24,27,0.15)'} strokeWidth={1} />
          )}

          {defined.map(p => {
            const c = examColor(p.s.test.exam, dark);
            const big = hover === p.i;
            const r = big ? 6 : 4.5;
            const cx = x(p.i), cy = y(p.v);
            return (
              <g key={p.s.test.id} className="mk-fade" style={{ animationDelay: `${300 + p.i * 25}ms` }}>
                {p.s.test.scope === 'full' && <circle cx={cx} cy={cy} r={r} fill={c} stroke={t.surface} strokeWidth={2} />}
                {p.s.test.scope === 'part' && <circle cx={cx} cy={cy} r={r} fill={t.surface} stroke={c} strokeWidth={2.25} />}
                {p.s.test.scope === 'chapter' && (
                  <rect x={cx - r * 0.85} y={cy - r * 0.85} width={r * 1.7} height={r * 1.7} fill={c} stroke={t.surface} strokeWidth={2} transform={`rotate(45 ${cx} ${cy})`} />
                )}
              </g>
            );
          })}

          {/* Direct labels: the latest value of each full-paper line, and nothing else. */}
          {lines.filter(l => l.scope === 'full' || lines.length === 1).slice(0, 3).map(l => {
            const last = l.pts[l.pts.length - 1];
            if (!last) return null;
            return (
              <text key={`${l.exam}-${l.scope}`} x={last.x + 9} y={last.y} dy="0.32em" fontSize={11} fontWeight={700} fill={dark ? '#e4e4e7' : '#27272a'} className="font-ui tabular-nums mk-fade" style={{ animationDelay: '700ms' }}>
                {Math.round(last.p.v)}%
              </text>
            );
          })}
        </svg>

        {hp && hp.v !== null && (
          <div
            className={`pointer-events-none absolute z-10 w-[240px] rounded-xl transition-[left,top] duration-150 border p-3.5 shadow-xl ${dark ? 'bg-[#18181c]/95 border-white/[0.08]' : 'bg-white/95 border-zinc-200'} backdrop-blur-sm`}
            style={{ left: tipLeft, top: tipTop }}
          >
            <p className={`text-[12px] font-ui font-bold truncate ${t.heading}`}>{hp.s.test.name}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <ExamBadge exam={hp.s.test.exam} dark={dark} />
              <ScopeBadge scope={hp.s.test.scope} dark={dark} />
              <span className={`text-[10px] font-ui ${t.muted}`}>{formatDate(hp.s.test.date, today)}</span>
            </div>
            <div className="flex items-baseline gap-2 mt-2.5">
              <span className={`num-hero text-[28px] ${t.heading}`}>{pct(hp.v, metric === 'percentile' ? 1 : 0)}</span>
              {prevSame && prevSame.v !== null && (
                <span className={`text-[11px] font-ui font-bold ${deltaTone(hp.v - prevSame.v, dark)}`}>{signedPct(hp.v - prevSame.v)} vs last {EXAMS[hp.s.test.exam].short}</span>
              )}
            </div>
            {metric === 'score' && (
              <p className={`text-[11px] font-ui mt-0.5 ${t.muted}`}>
                {(() => { const tt = totals(hp.s.test.result); return `${Math.round(tt.marks * 10) / 10} / ${tt.max}`; })()}
                {hp.s.percentile !== null ? ` · ${hp.s.percentile} %ile` : ''}
              </p>
            )}
            <div className="mt-2.5 space-y-1.5">
              {(Object.entries(hp.s.bySubject) as [Subject, number][]).map(([subject, v]) => (
                <div key={subject} className="flex items-center gap-2">
                  <span className={`w-16 text-[10px] font-ui truncate ${t.muted}`}>{subject}</span>
                  <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${dark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, Math.min(100, v))}%`, background: subjectDot(subject) }} />
                  </div>
                  <span className={`w-8 text-right text-[10px] font-ui font-bold tabular-nums ${t.body}`}>{Math.round(v)}%</span>
                </div>
              ))}
            </div>
            <p className={`text-[10px] font-ui mt-2.5 ${t.faint}`}>Tap to open</p>
          </div>
        )}
      </div>

      {/* Legend: always for two or more lines; the scope shapes whenever more than one scope is in view. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3">
        {exams.length > 1 && exams.map(e => (
          <span key={e} className={`inline-flex items-center gap-1.5 text-[11px] font-ui font-semibold ${t.body}`}>
            <span className="w-4 h-[3px] rounded-full" style={{ background: examColor(e, dark) }} />
            {EXAMS[e].label}
          </span>
        ))}
        {scopes.length > 1 && scopes.map(s => (
          <span key={s} className={`inline-flex items-center gap-1.5 text-[11px] font-ui ${t.muted}`}>
            <ScopeGlyph scope={s} color={dark ? '#a1a1aa' : '#71717a'} size={10} surface={t.surface} />
            {SCOPES[s].label}
          </span>
        ))}
        {fit && (
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-ui ${t.muted} ml-auto`}>
            <svg width="16" height="4" aria-hidden="true"><line x1="0" y1="2" x2="16" y2="2" stroke={t.axis} strokeDasharray="3 3" /></svg>
            Trend <b className={`${deltaTone(fit.k, dark)} font-bold`}>{signedPct(fit.k)}% / mock</b>
          </span>
        )}
      </div>

      {/* The table view, for screen readers. */}
      <table className="sr-only">
        <caption>{METRIC_LABEL[metric]} by mock</caption>
        <thead><tr><th>Mock</th><th>Date</th><th>Exam</th><th>Scope</th><th>{METRIC_LABEL[metric]}</th></tr></thead>
        <tbody>
          {points.map(p => (
            <tr key={p.s.test.id}>
              <td>{p.s.test.name}</td><td>{p.s.test.date}</td><td>{EXAMS[p.s.test.exam].label}</td><td>{SCOPES[p.s.test.scope].label}</td><td>{p.v === null ? '—' : `${Math.round(p.v)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TrendChart;
