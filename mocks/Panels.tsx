/* ── The analytics panels ──
   Views over mocks/insights.ts. Each panel answers one question and only
   draws what was logged: a panel with nothing behind it explains how to fill
   it instead of drawing an empty axis. */

import React, { useState } from 'react';
import { TIER_LABELS, TIER_STYLES } from '../content';
import { MockMistake } from '../types';
import { MISTAKES, MISTAKE_COLORS, MISTAKE_ORDER } from './model';
import { Insight, Leak, MistakeMix, Summary, SubjectTrend, Tone, formatDate, leakName } from './insights';
import { Card, Eyebrow, deltaTone, pct, signedPct, subjectDot, tokens } from './ui';

/* ── Stat tiles ── */

export const StatRow: React.FC<{ s: Summary; dark: boolean; today: string }> = ({ s, dark, today }) => {
  const t = tokens(dark);
  const tiles: { label: string; value: string; sub?: React.ReactNode }[] = [
    {
      label: 'Last mock',
      value: pct(s.last?.pct ?? null),
      sub: s.lastDelta !== null
        ? <span className={`font-bold ${deltaTone(s.lastDelta, dark)}`}>{signedPct(s.lastDelta)} vs your average</span>
        : s.last ? formatDate(s.last.test.date, today) : 'No mocks yet',
    },
    {
      label: 'Average',
      value: pct(s.avg),
      sub: s.trend !== null
        ? <span className={`font-bold ${deltaTone(s.trend, dark)}`}>{signedPct(s.trend)}% per mock</span>
        : `${s.count} ${s.count === 1 ? 'mock' : 'mocks'}`,
    },
    {
      label: 'Best',
      value: pct(s.best?.pct ?? null),
      sub: s.best ? <span className="truncate block">{s.best.test.name}</span> : '—',
    },
    s.percentile !== null
      ? { label: 'Percentile', value: s.percentile.toFixed(1), sub: 'Average of last 5' }
      : { label: 'Accuracy', value: pct(s.accuracy), sub: s.accuracy !== null ? 'Right ÷ attempted, last 5' : 'Add question counts to see it' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tiles.map((tile, i) => (
        <Card key={tile.label} dark={dark} delay={60 + i * 40} as="div" className="p-5">
          <Eyebrow dark={dark}>{tile.label}</Eyebrow>
          <p className={`num-hero text-[34px] md:text-[40px] mt-3 ${t.heading}`}>{tile.value}</p>
          <div className={`text-[11px] font-ui mt-2 min-h-[16px] ${t.muted}`}>{tile.sub}</div>
        </Card>
      ))}
    </div>
  );
};

/* ── Insights ── */

const TONE_ICON: Record<Tone, { path: React.ReactNode; light: string; dark: string; label: string }> = {
  up: { path: <path d="M4 14l5-5 4 4 7-7M15 6h5v5" />, light: 'text-emerald-600 bg-emerald-50', dark: 'text-emerald-400 bg-emerald-400/10', label: 'Good' },
  down: { path: <path d="M4 8l5 5 4-4 7 7M15 18h5v-5" />, light: 'text-rose-600 bg-rose-50', dark: 'text-rose-400 bg-rose-400/10', label: 'Problem' },
  warn: { path: <><path d="M12 8v5" /><circle cx="12" cy="16.5" r="0.6" fill="currentColor" /><path d="M10.3 3.9 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></>, light: 'text-amber-600 bg-amber-50', dark: 'text-amber-400 bg-amber-400/10', label: 'Heads up' },
  info: { path: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><circle cx="12" cy="8" r="0.6" fill="currentColor" /></>, light: 'text-sky-600 bg-sky-50', dark: 'text-sky-400 bg-sky-400/10', label: 'Note' },
};

export const InsightList: React.FC<{ insights: Insight[]; dark: boolean; delay?: number }> = ({ insights, dark, delay = 0 }) => {
  const t = tokens(dark);
  const [all, setAll] = useState(false);
  const shown = all ? insights : insights.slice(0, 4);
  return (
    <Card dark={dark} delay={delay} className="p-6 md:p-8">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow dark={dark}>What your mocks say</Eyebrow>
        <span className={`text-[11px] font-ui ${t.faint}`}>Updated with every result</span>
      </div>
      {!insights.length ? (
        <p className={`text-sm font-ui mt-5 ${t.muted}`}>Two or three results in, this starts reading your mocks for you — trends, leaks, what to fix first.</p>
      ) : (
        <ul className="mt-5 space-y-1">
          {shown.map((ins, i) => {
            const icon = TONE_ICON[ins.tone];
            return (
              <li key={ins.id} className={`mk-rise flex gap-4 p-3 -mx-3 rounded-lg ${t.hover} transition-colors`} style={{ animationDelay: `${delay + 80 + i * 50}ms` }}>
                <span className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${dark ? icon.dark : icon.light}`} aria-label={icon.label} role="img">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">{icon.path}</svg>
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className={`text-[15px] font-ui font-bold leading-snug ${t.heading}`}>{ins.title}</p>
                  <p className={`text-[13px] font-ui leading-relaxed mt-0.5 ${t.muted}`}>{ins.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {insights.length > 4 && (
        <button onClick={() => setAll(a => !a)} className={`mt-3 text-[11px] font-ui font-bold uppercase tracking-[0.1em] ${t.muted} hover:text-[#E10600]`}>
          {all ? 'Show less' : `${insights.length - 4} more`}
        </button>
      )}
    </Card>
  );
};

/* ── Subjects, as small multiples ──
   One sparkline per subject on a shared 0–100 scale, rather than three lines
   tangled on one chart: the comparison that matters is each subject against
   itself over time, and side by side the gaps between them still read. */

const Spark: React.FC<{ points: number[]; color: string; dark: boolean }> = ({ points, color, dark }) => {
  const w = 132, h = 40, pad = 4;
  if (!points.length) return <div style={{ height: h }} />;
  const x = (i: number) => (points.length === 1 ? w / 2 : pad + (i / (points.length - 1)) * (w - pad * 2));
  const y = (v: number) => pad + (h - pad * 2) * (1 - Math.max(0, Math.min(100, v)) / 100);
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('');
  const last = points.length - 1;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1={0} x2={w} y1={y(50)} y2={y(50)} stroke={dark ? 'rgba(255,255,255,0.06)' : 'rgba(24,24,27,0.07)'} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {points.length > 1 && <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" className="mk-draw" pathLength={1} style={{ ['--mk-len' as string]: 1 } as React.CSSProperties} />}
      <circle cx={x(last)} cy={y(points[last])} r={3.5} fill={color} stroke={dark ? '#111114' : '#fff'} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

export const SubjectTrends: React.FC<{ trends: SubjectTrend[]; dark: boolean; delay?: number }> = ({ trends, dark, delay = 0 }) => {
  const t = tokens(dark);
  const ranked = trends.filter(s => s.avg !== null);
  const weakest = ranked.length > 1 ? [...ranked].sort((a, b) => (a.avg as number) - (b.avg as number))[0].subject : null;
  return (
    <Card dark={dark} delay={delay} className="p-6 md:p-8">
      <Eyebrow dark={dark}>By subject</Eyebrow>
      <div className="mt-5 space-y-5">
        {trends.map(s => (
          <div key={s.subject} className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-x-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: subjectDot(s.subject) }} />
                <span className={`text-[13px] font-ui font-bold ${t.heading}`}>{s.subject}</span>
              </div>
              {weakest === s.subject && (
                <span className={`inline-block mt-1 ml-4 text-[9px] font-ui font-black uppercase tracking-[0.1em] px-1.5 py-0.5 rounded ${dark ? 'bg-rose-400/10 text-rose-400' : 'bg-rose-50 text-rose-600'}`}>Weakest</span>
              )}
            </div>
            <div className="text-right order-3">
              <span className={`num-stat text-[22px] ${t.heading}`}>{pct(s.avg)}</span>
              <p className={`text-[10px] font-ui font-bold ${s.delta !== null ? deltaTone(s.delta, dark) : t.faint}`}>
                {s.delta !== null ? `${signedPct(s.delta)} recently` : s.points.length ? `${s.points.length} logged` : 'No scores'}
              </p>
            </div>
            <div className="order-2 min-w-0">
              <Spark points={s.points.map(p => p.pct)} color={subjectDot(s.subject)} dark={dark} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

/* ── Mistake anatomy ── */

export const MistakeAnatomy: React.FC<{ mix: MistakeMix; dark: boolean; today: string; delay?: number }> = ({ mix, dark, today, delay = 0 }) => {
  const t = tokens(dark);
  const [hover, setHover] = useState<number | null>(null);
  const color = (k: MockMistake) => MISTAKE_COLORS[k][dark ? 'dark' : 'light'];
  const maxRow = Math.max(1, ...mix.perTest.map(r => r.sum));
  const hovered = hover !== null ? mix.perTest[hover] : null;
  return (
    <Card dark={dark} delay={delay} className="p-6 md:p-8">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow dark={dark}>Where the marks went</Eyebrow>
        {mix.sum > 0 && <span className={`text-[11px] font-ui ${t.muted}`}>Last {mix.perTest.length} mocks</span>}
      </div>
      {!mix.sum ? (
        <p className={`text-sm font-ui mt-5 ${t.muted}`}>When you log a result, count the questions you lost — silly, concept, time, not studied. This shows which one is costing you the most.</p>
      ) : (
        <>
          {/* Composition first: the one bar that answers "what kind of mistake am I". */}
          <div className="flex h-3 rounded-full overflow-hidden gap-[2px] mt-5 mk-grow-x" style={{ animationDelay: `${delay + 100}ms` }}>
            {MISTAKE_ORDER.filter(k => mix.totals[k]).map(k => (
              <div key={k} style={{ flex: mix.totals[k], background: color(k) }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-4">
            {MISTAKE_ORDER.map(k => (
              <div key={k} className="flex items-start gap-2">
                <span className="w-2.5 h-2.5 rounded-sm mt-1 shrink-0" style={{ background: color(k) }} />
                <div className="min-w-0">
                  <p className={`text-[12px] font-ui font-bold ${t.heading}`}>
                    {MISTAKES[k].label} <span className={`font-normal ${t.muted}`}>· {mix.totals[k]}q</span>
                  </p>
                  <p className={`text-[11px] font-ui ${t.muted}`}>≈ {mix.marks[k]} marks · {Math.round((mix.totals[k] / mix.sum) * 100)}%</p>
                </div>
              </div>
            ))}
          </div>

          {mix.perTest.length > 1 && (
            <div className="mt-6 space-y-2" onPointerLeave={() => setHover(null)}>
              {mix.perTest.map((row, i) => (
                <div key={row.test.id} className="flex items-center gap-3 cursor-default" onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)}>
                  <span className={`w-14 shrink-0 text-[10px] font-ui tabular-nums ${hover === i ? t.heading : t.muted}`}>{formatDate(row.test.date, today)}</span>
                  <div className="flex-1 h-2.5">
                    <div className="flex h-full gap-[2px] mk-grow-x" style={{ width: `${(row.sum / maxRow) * 100}%`, animationDelay: `${delay + 150 + i * 40}ms` }}>
                      {MISTAKE_ORDER.filter(k => row.counts[k]).map((k, j, arr) => (
                        <div
                          key={k}
                          style={{ flex: row.counts[k], background: color(k), opacity: hover === null || hover === i ? 1 : 0.35 }}
                          className={`h-full transition-opacity ${j === 0 ? 'rounded-l-sm' : ''} ${j === arr.length - 1 ? 'rounded-r-[4px]' : ''}`}
                        />
                      ))}
                    </div>
                  </div>
                  <span className={`w-7 text-right text-[10px] font-ui font-bold tabular-nums ${t.body}`}>{row.sum}</span>
                </div>
              ))}
              <p className={`text-[11px] font-ui pt-1 min-h-[16px] ${t.muted}`} aria-live="polite">
                {hovered
                  ? `${hovered.test.name}: ${MISTAKE_ORDER.filter(k => hovered.counts[k]).map(k => `${hovered.counts[k]} ${MISTAKES[k].label.toLowerCase()}`).join(' · ')}`
                  : 'Questions lost per mock. Point at a row for the split.'}
              </p>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

/* ── Where marks leak ── */

export const LeakBoard: React.FC<{ leaks: Leak[]; fixed: Leak[]; dark: boolean; today: string; delay?: number }> = ({ leaks, fixed, dark, today, delay = 0 }) => {
  const t = tokens(dark);
  const maxScore = Math.max(0.01, ...leaks.map(l => l.score));
  return (
    <Card dark={dark} delay={delay} className="p-6 md:p-8">
      <div className="flex items-baseline justify-between gap-3">
        <Eyebrow dark={dark}>Weak spots</Eyebrow>
        <span className={`text-[11px] font-ui ${t.faint}`}>Recent mocks count more</span>
      </div>
      {!leaks.length && !fixed.length ? (
        <p className={`text-sm font-ui mt-5 ${t.muted}`}>After each mock, mark chapters and topics as strong, okay or weak. The ones that keep coming back weak show up here, heaviest chapters first.</p>
      ) : (
        <>
          {leaks.length > 0 && (
            <ol className="mt-5 space-y-3.5">
              {leaks.map((l, i) => (
                <li key={l.key} className="mk-rise" style={{ animationDelay: `${delay + 60 + i * 40}ms` }}>
                  <div className="flex items-center gap-3">
                    <span className={`w-5 text-[11px] font-ui font-black tabular-nums ${t.faint}`}>{i + 1}</span>
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: subjectDot(l.subject) }} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] font-ui font-bold truncate ${t.heading}`}>{leakName(l)}</p>
                      <p className={`text-[11px] font-ui truncate ${t.muted}`}>
                        {l.topic ? `${l.chapter} · ` : `${l.subject} · `}weak in {l.weak} of {l.weak + l.okay + l.strong} · last {formatDate(l.lastDate, today)}
                      </p>
                    </div>
                    {l.tier && (l.tier === 'critical' || l.tier === 'high') && (
                      <span className={`hidden sm:inline-flex shrink-0 text-[9px] font-ui font-black tracking-[0.08em] px-1.5 py-0.5 rounded border ${TIER_STYLES[l.tier].chip}`}>{TIER_LABELS[l.tier]}</span>
                    )}
                  </div>
                  <div className={`ml-8 mt-1.5 h-1 rounded-full overflow-hidden ${dark ? 'bg-white/[0.05]' : 'bg-zinc-100'}`}>
                    <div className="h-full rounded-full mk-grow-x" style={{ width: `${(l.score / maxScore) * 100}%`, background: dark ? '#fb7185' : '#e11d48', animationDelay: `${delay + 120 + i * 40}ms` }} />
                  </div>
                </li>
              ))}
            </ol>
          )}
          {fixed.length > 0 && (
            <div className={`mt-6 pt-5 border-t ${t.rule}`}>
              <Eyebrow dark={dark}>Fixed</Eyebrow>
              <div className="flex flex-wrap gap-2 mt-3">
                {fixed.slice(0, 6).map(l => (
                  <span key={l.key} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-ui font-semibold ${dark ? 'bg-emerald-400/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
                    {leakName(l)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

