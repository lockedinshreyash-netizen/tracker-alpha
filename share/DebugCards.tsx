/**
 * Dev-only contact sheet: every card, every format, every edge case, on one
 * page.
 *
 * The cards are the product here — "it renders" is not the bar, and the only
 * way to hold a composition against the reference is to see all of them at
 * once and keep adjusting. Reached at `?share=debug`, mounted only under
 * `import.meta.env.DEV`, and never imported by the app itself.
 */

import React, { useEffect, useRef, useState } from 'react';
import { DailyLog, DailyQuestionsLog, Task } from '../types';
import { getISTDateString } from '../utils';
import { ALL_FORMATS } from './render/format';
import { renderCard } from './render';
import { buildCard, StatsInput } from './stats';
import { CardFormat, CardPeriod } from './types';

const PERIODS: CardPeriod[] = ['daily', 'weekly', 'monthly'];

/* Today, as the app sees it — the in-progress fixtures anchor here so the
   clamping to lived days is exercised rather than assumed. */
const TODAY = getISTDateString();
/* A Sunday in a month that has fully happened, so the "complete" fixtures show
   a whole week of bars and a whole month of dots. */
const DONE = '2026-08-30';

const log = (date: string, hours: number, i: number): DailyLog => ({
  id: `${date}-${i}`, date, subject: 'Physics', hours, quality: 4, distractions: 0, source: 'timer',
});

const pad = (n: number) => String(n).padStart(2, '0');
const daysOf = (ym: string, n: number) => Array.from({ length: n }, (_, i) => `${ym}-${pad(i + 1)}`);

/** A plausible history: a strong August over a weaker July, and a live September. */
const history = (): DailyLog[] => {
  const out: DailyLog[] = [];
  const shape = [4.2, 6.1, 3.1, 5.0, 6.4, 3.8, 5.1];
  const month = (ym: string, n: number, scale: number, skip: number) =>
    daysOf(ym, n).forEach((d, i) => {
      if (i % skip === skip - 1) return; // a few days off, so the grid has a shape
      const hours = shape[i % 7] * scale;
      out.push(log(d, hours * 0.6, 1));
      out.push(log(d, hours * 0.4, 2));
    });
  month('2026-07', 31, 0.72, 4);
  month('2026-08', 31, 1.45, 9);
  month('2026-09', 7, 1.3, 6);
  return out;
};

const tasksOn = (n: number, dates: string[]): Task[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `t${i}`, text: `task ${i}`, completed: true, completedAt: dates[i % dates.length],
  }));

const questionsOn = (dates: string[]): DailyQuestionsLog[] =>
  dates.map(date => ({ date, counts: { physics: 9, chemistry: 8, math: 6 } }));

const AUG = daysOf('2026-08', 31);
const SEP = daysOf('2026-09', 7);

const FIXTURES: { name: string; input: StatsInput; anchor: string }[] = [
  {
    name: 'complete — a month that has fully happened',
    anchor: DONE,
    input: {
      logs: history(),
      tasks: tasksOn(184, AUG),
      dailyQuestionsLog: questionsOn([...AUG, ...SEP]),
      dailyGoalHours: 8,
    },
  },
  {
    name: 'in progress — this week and this month, so far',
    anchor: TODAY,
    input: {
      logs: history(),
      tasks: tasksOn(40, SEP),
      dailyQuestionsLog: questionsOn([...AUG, ...SEP]),
      dailyGoalHours: 8,
    },
  },
  {
    name: 'zero — nothing logged, ever',
    anchor: TODAY,
    input: { logs: [], tasks: [], dailyQuestionsLog: [], dailyGoalHours: 8 },
  },
  {
    name: 'first period — no comparison, no tasks, no questions',
    anchor: TODAY,
    input: {
      logs: [log(TODAY, 4.62, 1), log(TODAY, 2.0, 2)],
      tasks: [], dailyQuestionsLog: [], dailyGoalHours: 8,
    },
  },
  {
    name: 'legacy tasks (undated) — falls through to questions',
    anchor: DONE,
    input: {
      logs: history(),
      tasks: [{ id: 'x', text: 'old', completed: true }],
      dailyQuestionsLog: questionsOn(AUG),
      dailyGoalHours: 8,
    },
  },
  {
    name: 'extreme — long durations, five-figure counts',
    anchor: DONE,
    input: {
      logs: AUG.flatMap((d, i) => [log(d, 23.5, i), log(d, 0.4, i + 100)]),
      tasks: tasksOn(400, AUG),
      dailyQuestionsLog: AUG.map(date => ({ date, counts: { physics: 900, math: 800 } })),
      dailyGoalHours: 8,
    },
  },
  {
    name: 'february — 28 dots',
    anchor: '2026-02-28',
    input: {
      logs: daysOf('2026-02', 28).map((d, i) => log(d, i % 4 === 0 ? 0.5 : 9, i)),
      tasks: [], dailyQuestionsLog: [], dailyGoalHours: 8,
    },
  },
];

const Card: React.FC<{ input: StatsInput; period: CardPeriod; format: CardFormat; anchor: string }> =
  ({ input, period, format, anchor }) => {
    const host = useRef<HTMLDivElement>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
      let alive = true;
      renderCard(buildCard(period, input, anchor), format)
        .then(({ canvas }) => {
          if (!alive || !host.current) return;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          host.current.replaceChildren(canvas);
        })
        .catch(e => alive && setErr(String(e)));
      return () => { alive = false; };
    }, [input, period, format, anchor]);

    return (
      <div style={{ width: format === '9:16' ? 220 : 300 }}>
        <div style={{ font: '600 10px ui-monospace, monospace', color: '#888', marginBottom: 6, letterSpacing: '.08em' }}>
          {period.toUpperCase()} · {format}
        </div>
        <div ref={host} style={{ background: '#222', minHeight: 40 }} />
        {err && <pre style={{ color: '#f55', fontSize: 10 }}>{err}</pre>}
      </div>
    );
  };

const DebugCards: React.FC = () => (
  <div style={{ padding: 32, background: '#18181B', minHeight: '100vh', fontFamily: 'ui-monospace, monospace' }}>
    <h1 style={{ color: '#fff', fontSize: 14, letterSpacing: '.12em', marginBottom: 4 }}>SHARE CARD CONTACT SHEET</h1>
    <p style={{ color: '#71717A', fontSize: 11, marginBottom: 32 }}>today {TODAY} · dev only</p>
    {FIXTURES.map(f => (
      <section key={f.name} style={{ marginBottom: 48 }}>
        <h2 style={{ color: '#A1A1AA', fontSize: 11, letterSpacing: '.1em', marginBottom: 12 }}>
          {f.name.toUpperCase()}
        </h2>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {PERIODS.flatMap(p => ALL_FORMATS.map(fmt => (
            <Card key={`${p}${fmt}`} input={f.input} period={p} format={fmt} anchor={f.anchor} />
          )))}
        </div>
      </section>
    ))}
  </div>
);

export default DebugCards;
