/* ── Console → Analytics ──
   Who is using the app, how often, how much they study, whether they come
   back, and which parts of it they use — from one `admin_analytics()` call.

   Aggregates, with one exception: `admin_analytics()` returns counts and sums
   only. The Latest sign-ups list (RecentUsers.tsx) is the one part that names
   students, and it asks its own admin-only function for that. Every
   definition lives in supabase/analytics.sql §6; the copy here says the same
   thing in fewer words.

   Loaded lazily from AdminTab, so none of it reaches a student's bundle. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Segmented, btn, deltaTone, tokens } from '../ui/kit';
import { humanError } from '../feedback/api';
import { Analytics, Range, RecentUser, fetchAnalytics, isAnalyticsMissing } from './api';
import RecentUsers from './RecentUsers';
import {
  ChartCard, CohortGrid, ColumnChart, HBars, Legend, LineChart, SplitBar,
  chartColors, compact, fmt, longDate, shortDate, yearDate,
} from './charts';

interface Props {
  theme: 'dark' | 'light';
  /** The design board's fixtures; the real console always asks the database. */
  load?: (range: Range) => Promise<Analytics>;
  loadUsers?: (before: string | null) => Promise<RecentUser[]>;
}

const RANGES: Array<{ value: `${Range}`; label: string }> = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '180', label: '6 months' },
  { value: '365', label: '1 year' },
];

/* Per device, like the Mocks filters: a viewing preference, not data. */
const RANGE_KEY = 'console_analytics_range_v1';
const readRange = (): Range => {
  try {
    const v = Number(localStorage.getItem(RANGE_KEY));
    if (v === 30 || v === 90 || v === 180 || v === 365) return v;
  } catch { /* default below */ }
  return 90;
};

const ratio = (a: number, b: number): number | null => (b > 0 ? a / b : null);
const pctText = (x: number | null, digits = 0): string =>
  x === null ? '—' : `${(x * 100).toFixed(digits)}%`;

/** Change against the period before, or null when there is nothing honest to compare with. */
const change = (cur: number, prev: number): number | null => (prev > 0 ? (cur - prev) / prev : null);

const Delta: React.FC<{ dark: boolean; value: number | null; vs: string }> = ({ dark, value, vs }) => {
  if (value === null) return <span>No earlier period to compare</span>;
  const pct = value * 100;
  const arrow = pct > 0.5 ? '▲' : pct < -0.5 ? '▼' : '■';
  return (
    <span>
      <span className={`font-bold ${deltaTone(pct, dark)}`}>{arrow} {Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%</span> vs {vs}
    </span>
  );
};

const Kpi: React.FC<{ dark: boolean; label: string; value: React.ReactNode; sub?: React.ReactNode; delay?: number; hint?: string }> = ({ dark, label, value, sub, delay = 0, hint }) => {
  const t = tokens(dark);
  return (
    <div className={`mk-rise rounded-xl border p-4 md:p-5 min-w-0 ${t.card}`} style={{ animationDelay: `${delay}ms` }} title={hint}>
      <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>{label}</p>
      <p className={`num-hero text-[28px] md:text-[34px] mt-2.5 leading-none truncate ${t.heading}`}>{value}</p>
      {sub !== undefined && <div className={`text-[11px] font-ui mt-2 leading-snug ${t.muted}`}>{sub}</div>}
    </div>
  );
};

const AnalyticsAdmin: React.FC<Props> = ({ theme, load = fetchAnalytics, loadUsers }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const c = chartColors(dark);

  const [range, setRange] = useState<Range>(readRange);
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    let live = true;
    setLoading(true);
    load(range)
      .then(d => { if (live) { setData(d); setError(null); setMissing(false); } })
      .catch(e => {
        if (!live) return;
        if (isAnalyticsMissing(e)) setMissing(true);
        else setError(humanError(e));
      })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [load, range]);

  useEffect(refresh, [refresh]);

  const pickRange = (v: `${Range}`) => {
    const r = Number(v) as Range;
    setRange(r);
    try { localStorage.setItem(RANGE_KEY, String(r)); } catch { /* per-session then */ }
  };

  const view = useMemo(() => (data ? derive(data) : null), [data]);

  /* ── Not set up: one instruction, not a broken dashboard. ── */
  if (missing) {
    return (
      <section className={`mk-rise rounded-xl border p-8 md:p-10 font-ui ${t.card}`}>
        <p className={`text-[10px] font-bold uppercase tracking-[0.06em] ${t.faint}`}>Analytics</p>
        <h3 className={`font-display text-[28px] md:text-[34px] leading-[1.05] mt-3 ${t.heading}`}>Not switched on yet.</h3>
        <p className={`text-[13px] mt-3 max-w-[560px] ${t.body}`}>
          Run <code className={`px-1.5 py-0.5 rounded ${dark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>supabase/analytics.sql</code> in
          the Supabase SQL editor. It builds history from data you already have, so the charts start full, not empty.
        </p>
        <button type="button" onClick={refresh} className={`${btn} mt-6 px-5 py-3 ${t.ghost}`}>Check again</button>
      </section>
    );
  }

  const controls = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className={`text-[12px] font-ui ${t.muted}`}>
        {data
          ? <>Study day <span className={`font-bold ${t.heading}`}>{longDate(data.today)}</span> · updated {new Date(data.generated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</>
          : loading ? 'Counting…' : 'Nothing loaded yet.'}
      </p>
      <div className="flex items-center gap-2">
        <Segmented<`${Range}`> value={String(range) as `${Range}`} options={RANGES} onChange={pickRange} dark={dark} label="Date range" />
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh"
          title="Refresh"
          className={`${btn} h-[34px] w-[34px] ${t.ghost}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
            <path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>
    </div>
  );

  if (!data || !view) {
    return (
      <div className="space-y-4">
        {controls}
        <section className={`rounded-xl border p-8 font-ui ${t.card}`}>
          {error
            ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12px] font-bold text-[#E10600]">{error}</p>
                <button type="button" onClick={refresh} className={`${btn} px-4 py-2.5 ${t.ghost}`}>Try again</button>
              </div>
            )
            : <p className={`text-[12px] ${t.muted}`}>Counting everyone…</p>}
        </section>
      </div>
    );
  }

  const d = data;
  const v = view;
  /* From the data, not the control: mid-refetch the old figures are still on screen. */
  const rangeLabel = RANGES.find(r => Number(r.value) === d.days)?.label ?? `${d.days} days`;
  const features = d.features;
  const hasFeature = (k: keyof Analytics['features']) => features[k] !== undefined;

  return (
    <div className={`space-y-4 transition-opacity ${loading ? 'opacity-60' : ''}`} aria-busy={loading}>
      {controls}
      {error && <p className="text-[12px] font-bold font-ui text-[#E10600]">{error} Showing the last figures that loaded.</p>}

      {v.reconstructedNote && (
        <p className={`mk-rise rounded-xl border px-4 py-3 text-[12px] font-ui leading-relaxed ${t.inset} ${t.body}`}>
          {v.reconstructedNote}
        </p>
      )}

      {/* ── People ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Kpi dark={dark} delay={0} label="Daily active" value={fmt(d.active.dau)} sub={<>Today so far · yesterday {fmt(d.active.dau_prev)}</>} hint="Accounts that opened the app today (study day from 4 AM IST)." />
        <Kpi dark={dark} delay={30} label="Weekly active" value={fmt(d.active.wau)} sub={<Delta dark={dark} value={change(d.active.wau, d.active.wau_prev)} vs="last week" />} hint="Accounts active on any of the last 7 days." />
        <Kpi dark={dark} delay={60} label="Monthly active" value={fmt(d.active.mau)} sub={<Delta dark={dark} value={change(d.active.mau, d.active.mau_prev)} vs="30 days before" />} hint="Accounts active on any of the last 30 days." />
        <Kpi dark={dark} delay={90} label="Stickiness" value={pctText(v.stickiness)} sub={<>Avg daily ÷ monthly · {v.daysPerMau === null ? '—' : fmt(v.daysPerMau, 1)} days a month each</>} hint="Average daily actives over the last 30 full days, divided by everyone active in those days." />
        <Kpi dark={dark} delay={120} label="Accounts" value={fmt(d.accounts.total)} sub={<>+{fmt(d.accounts.new_7)} this week · {fmt(d.accounts.new_today)} today</>} />
        <Kpi dark={dark} delay={150} label={`New · ${rangeLabel}`} value={fmt(d.accounts.new_range)} sub={<Delta dark={dark} value={change(d.accounts.new_range, d.accounts.new_prev_range)} vs="the period before" />} />
      </div>

      {/* ── Study ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Kpi dark={dark} delay={180} label="Hours today" value={hoursText(d.study.hours_today)} sub={<>{fmt(d.study.studiers_today)} students have logged study</>} />
        <Kpi dark={dark} delay={210} label="Hours · last 7 days" value={hoursText(d.study.hours_7)} sub={<Delta dark={dark} value={change(d.study.hours_7, d.study.hours_prev_7)} vs="the week before" />} />
        <Kpi dark={dark} delay={240} label="Per student, per day" value={v.hoursPerStudyDay === null ? '—' : `${fmt(v.hoursPerStudyDay, 1)}h`} sub={<>On days they studied · {fmt(d.study.studiers_7)} studied this week</>} />
        <Kpi dark={dark} delay={270} label="Timed, not typed" value={pctText(v.trackedShare)} sub={<>Of this week's hours came from the stopwatch or Pomodoro</>} />
      </div>

      {/* ── Who just arrived ── */}
      <RecentUsers theme={theme} delay={300} load={loadUsers} />

      {/* ── Active users ── */}
      <ChartCard
        dark={dark}
        delay={300}
        title="Active users"
        sub={<>Each day: people active that day, in the 7 days up to it, and in the 30 days up to it.</>}
        legend={<Legend dark={dark} items={[
          { label: 'Daily', color: c.blue, kind: 'line' },
          { label: 'Weekly', color: c.orange, kind: 'line' },
          { label: 'Monthly', color: c.aqua, kind: 'line' },
        ]} />}
        table={{
          head: ['Day', 'Daily', 'Weekly', 'Monthly', 'Reported live'],
          rows: [...d.series].reverse().map(s => [shortDate(s.day), fmt(s.dau), fmt(s.wau), fmt(s.mau), fmt(s.live)]),
        }}
      >
        <LineChart
          dark={dark}
          ariaLabel="Daily, weekly and monthly active users by day"
          labels={v.labels}
          series={[
            { key: 'dau', label: 'Daily', color: c.blue, values: d.series.map(s => s.dau) },
            { key: 'wau', label: 'Weekly', color: c.orange, values: d.series.map(s => s.wau) },
            { key: 'mau', label: 'Monthly', color: c.aqua, values: d.series.map(s => s.mau) },
          ]}
          marker={v.trackingIndex !== null ? { index: v.trackingIndex, label: 'Live tracking' } : null}
          height={260}
        />
      </ChartCard>

      {/* ── Accounts ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard
          dark={dark}
          delay={330}
          title="New accounts"
          sub={<>{fmt(d.accounts.new_range)} in the last {rangeLabel} · best day {v.bestSignup ? `${fmt(v.bestSignup.signups)} on ${shortDate(v.bestSignup.day)}` : '—'}</>}
          table={{ head: ['Day', 'New accounts'], rows: [...d.series].reverse().map(s => [shortDate(s.day), fmt(s.signups)]) }}
        >
          <ColumnChart
            dark={dark}
            ariaLabel="New accounts per day"
            labels={v.labels}
            series={[{ key: 'signups', label: 'New accounts', color: c.blue, values: d.series.map(s => s.signups) }]}
            title={i => longDate(d.series[i].day)}
          />
        </ChartCard>
        <ChartCard
          dark={dark}
          delay={360}
          title="All accounts"
          sub={<>{fmt(d.accounts.total)} in all · {pctText(ratio(d.accounts.confirmed, d.accounts.total))} confirmed their email · {pctText(ratio(d.accounts.synced, d.accounts.total))} signed in on a device</>}
          table={{ head: ['Day', 'Accounts'], rows: [...d.series].reverse().map(s => [shortDate(s.day), fmt(s.accounts)]) }}
        >
          <LineChart
            dark={dark}
            area
            ariaLabel="Total accounts by day"
            labels={v.labels}
            series={[{ key: 'accounts', label: 'Accounts', color: c.blue, values: d.series.map(s => s.accounts) }]}
            height={220}
          />
        </ChartCard>
      </div>

      {/* ── Hours ── */}
      <ChartCard
        dark={dark}
        delay={390}
        title="Hours studied"
        sub={<>Every hour logged in the app, each day. {hoursText(v.rangeHours)} in this range.</>}
        legend={<Legend dark={dark} items={[
          { label: 'Timed (stopwatch, Pomodoro)', color: c.blue },
          { label: 'Typed in', color: c.blueSoft },
        ]} />}
        table={{
          head: ['Day', 'Hours', 'Timed', 'Students', 'Sessions'],
          rows: [...d.series].reverse().map(s => [shortDate(s.day), fmt(s.hours, 1), fmt(s.tracked, 1), fmt(s.studiers), fmt(s.sessions)]),
        }}
      >
        <ColumnChart
          dark={dark}
          ariaLabel="Hours studied per day, timed and typed in"
          labels={v.labels}
          format={h => compact(h)}
          series={[
            { key: 'tracked', label: 'Timed', color: c.blue, values: d.series.map(s => round1(s.tracked)) },
            { key: 'manual', label: 'Typed in', color: c.blueSoft, values: d.series.map(s => round1(Math.max(0, s.hours - s.tracked))) },
          ]}
          title={i => longDate(d.series[i].day)}
          extra={i => [
            { label: 'students studied', value: fmt(d.series[i].studiers) },
            { label: 'sessions', value: fmt(d.series[i].sessions) },
          ]}
          height={240}
        />
      </ChartCard>

      {/* ── Growth and frequency ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard
          dark={dark}
          delay={420}
          title="Week by week"
          sub={v.lastFullWeek
            ? <>Last full week: +{fmt(v.lastFullWeek.new + v.lastFullWeek.resurrected)} came in, −{fmt(v.lastFullWeek.churned)} went quiet{v.quickRatio !== null ? <> · quick ratio {fmt(v.quickRatio, 2)}</> : null}</>
            : 'Not enough weeks yet.'}
          legend={<Legend dark={dark} items={[
            { label: 'Stayed', color: c.blue },
            { label: 'New', color: c.aqua },
            { label: 'Came back', color: c.violet },
            { label: 'Went quiet', color: c.orange },
          ]} />}
          table={{
            head: ['Week of', 'Stayed', 'New', 'Came back', 'Went quiet'],
            rows: [...d.growth].reverse().map(g => [shortDate(g.week), fmt(g.retained), fmt(g.new), fmt(g.resurrected), fmt(g.churned)]),
          }}
        >
          <ColumnChart
            dark={dark}
            ariaLabel="Weekly active users split into stayed, new and came back, with those who went quiet below the line"
            labels={d.growth.map(g => shortDate(g.week))}
            series={[
              { key: 'retained', label: 'Stayed', color: c.blue, values: d.growth.map(g => g.retained) },
              { key: 'new', label: 'New', color: c.aqua, values: d.growth.map(g => g.new) },
              { key: 'resurrected', label: 'Came back', color: c.violet, values: d.growth.map(g => g.resurrected) },
              { key: 'churned', label: 'Went quiet', color: c.orange, values: d.growth.map(g => g.churned), below: true },
            ]}
            title={i => (d.growth[i].week === d.week_now ? `Week of ${shortDate(d.growth[i].week)} · so far` : `Week of ${shortDate(d.growth[i].week)}`)}
            partial={i => d.growth[i].week === d.week_now}
            height={240}
          />
        </ChartCard>
        <ChartCard
          dark={dark}
          delay={450}
          title="How often they show up"
          sub={<>Of {fmt(d.active.mau)} monthly actives, {fmt(v.regulars)} ({pctText(ratio(v.regulars, d.active.mau))}) came on 10 or more of the last 30 days.</>}
          table={{ head: ['Days active (of 30)', 'People'], rows: v.frequency.map((n, i) => [String(i + 1), fmt(n)]) }}
        >
          <ColumnChart
            dark={dark}
            ariaLabel="Monthly active users by how many of the last 30 days they were active"
            labels={v.frequency.map((_, i) => `${i + 1}`)}
            series={[{ key: 'people', label: 'people', color: c.blue, values: v.frequency }]}
            title={i => `Active on ${i + 1} of 30 days`}
            height={240}
          />
        </ChartCard>
      </div>

      {/* ── Retention ── */}
      <ChartCard
        dark={dark}
        delay={480}
        title="Do they come back?"
        sub={<>Confirmed accounts only. Each row is a sign-up week; each cell is the share active that many weeks after signing up.</>}
        table={{
          head: ['Signed up', 'People', ...Array.from({ length: 12 }, (_, k) => `W${k}`)],
          rows: [...d.cohorts].reverse().map(co => [shortDate(co.week), fmt(co.size), ...Array.from({ length: 12 }, (_, k) => (co.active[k] === undefined ? '' : `${co.size ? Math.round((co.active[k] / co.size) * 100) : 0}%`))]),
        }}
      >
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[1, 7, 30].map(n => {
            const r = d.retention.find(x => x.n === n);
            return (
              <div key={n} className={`rounded-lg border px-4 py-3 ${t.inset}`}>
                <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${t.faint}`}>Day {n}</p>
                <p className={`num-stat text-[24px] mt-1.5 leading-none ${t.heading}`}>{r ? pctText(ratio(r.retained, r.eligible)) : '—'}</p>
                <p className={`text-[11px] font-ui mt-1.5 ${t.muted}`}>{r ? `${fmt(r.retained)} of ${fmt(r.eligible)} came back on day ${n}` : 'Nobody old enough yet'}</p>
              </div>
            );
          })}
        </div>
        {d.cohorts.length
          ? <CohortGrid dark={dark} cohorts={d.cohorts} today={d.today} />
          : <p className={`text-[12px] font-ui ${t.muted}`}>No sign-ups in the last 12 weeks.</p>}
        <p className={`text-[11px] font-ui mt-3 ${t.faint}`}>Pale, outlined cells are weeks still running.</p>
      </ChartCard>

      {/* ── Activation and streaks ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard
          dark={dark}
          delay={510}
          title="From sign-up to habit"
          sub={<>Accounts made in the last {rangeLabel}. Each step includes the one above.</>}
          table={{ head: ['Step', 'People', 'Share'], rows: v.funnel.map(f => [f.label, fmt(f.value), pctText(ratio(f.value, d.funnel.signed_up))]) }}
        >
          <HBars
            dark={dark}
            color={c.blue}
            labelWidth={138}
            rows={v.funnel.map(f => ({
              label: f.label,
              value: f.value,
              of: Math.max(1, d.funnel.signed_up),
              display: `${fmt(f.value)} · ${pctText(ratio(f.value, d.funnel.signed_up))}`,
              hint: f.hint,
            }))}
          />
        </ChartCard>
        <ChartCard
          dark={dark}
          delay={540}
          title="Streaks"
          sub={<>Streak on their last visit, for the {fmt(d.setup.reporting)} students seen in the last 30 days.</>}
          table={{ head: ['Streak', 'Students', 'Share'], rows: v.streaks.map(s => [s.label, fmt(s.value), pctText(ratio(s.value, d.setup.reporting))]) }}
        >
          <HBars
            dark={dark}
            color={c.blue}
            labelWidth={110}
            rows={v.streaks.map(s => ({
              label: s.label,
              value: s.value,
              of: Math.max(1, d.setup.reporting),
              display: `${fmt(s.value)} · ${pctText(ratio(s.value, d.setup.reporting))}`,
            }))}
          />
        </ChartCard>
      </div>

      {/* ── Who and what ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard
          dark={dark}
          delay={570}
          title="Who they are"
          sub={<>Students seen in the last 30 days, as their app was set up on their last visit.</>}
          table={{ head: ['Group', 'Students', 'Share'], rows: v.who.map(w => [w.label, fmt(w.value), pctText(ratio(w.value, w.of))]) }}
        >
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-5">
            <SplitBar dark={dark} label="Exam" parts={[
              { label: 'JEE', value: d.setup.exam.JEE, color: c.blue },
              { label: 'NEET', value: d.setup.exam.NEET, color: c.orange },
            ]} />
            <SplitBar dark={dark} label="Class" parts={[
              { label: 'Class 11', value: d.setup.class['11'], color: c.blue },
              { label: 'Class 12', value: d.setup.class['12'], color: c.orange },
            ]} />
            <SplitBar dark={dark} label="Device" parts={[
              { label: 'Android', value: d.devices.platforms.android ?? 0, color: c.blue },
              { label: 'iPhone / iPad', value: d.devices.platforms.ios ?? 0, color: c.orange },
              { label: 'Computer', value: (d.devices.platforms.desktop ?? 0) + (d.devices.platforms.other ?? 0), color: c.aqua },
            ]} />
            <SplitBar dark={dark} label="Installed app" parts={[
              { label: 'Installed', value: d.devices.installed, color: c.blue },
              { label: 'Browser only', value: Math.max(0, d.devices.reporting - d.devices.installed), color: c.orange },
            ]} />
            <SplitBar dark={dark} label="Timer" parts={[
              { label: 'Stopwatch', value: d.setup.timer.stopwatch, color: c.blue },
              { label: 'Pomodoro', value: d.setup.timer.pomodoro, color: c.orange },
            ]} />
            <SplitBar dark={dark} label="Theme" parts={[
              { label: 'Dark', value: d.setup.theme.dark, color: c.blue },
              { label: 'Light', value: d.setup.theme.light, color: c.orange },
            ]} />
          </div>
          <div className={`mt-5 pt-4 border-t grid grid-cols-2 gap-3 ${t.rule}`}>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${t.faint}`}>Average daily goal</p>
              <p className={`num-stat text-[22px] mt-1 ${t.heading}`}>{d.setup.goal_avg === null ? '—' : `${fmt(d.setup.goal_avg, 1)}h`}</p>
            </div>
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${t.faint}`}>Chapters done, average</p>
              <p className={`num-stat text-[22px] mt-1 ${t.heading}`}>{d.setup.chapters_done_avg === null ? '—' : fmt(d.setup.chapters_done_avg, 1)}</p>
            </div>
          </div>
        </ChartCard>
        <ChartCard
          dark={dark}
          delay={600}
          title="What they use"
          sub={<>Share of the {fmt(d.setup.reporting)} students seen in the last 30 days who have used each part.</>}
          table={{ head: ['Feature', 'Students', 'Share'], rows: v.adoption.map(a => [a.label, fmt(a.value), pctText(ratio(a.value, d.setup.reporting))]) }}
        >
          <HBars
            dark={dark}
            color={c.blue}
            labelWidth={138}
            rows={v.adoption.map(a => ({
              label: a.label,
              value: a.value,
              of: Math.max(1, d.setup.reporting),
              display: `${pctText(ratio(a.value, d.setup.reporting))} · ${fmt(a.value)}`,
              hint: a.hint,
            }))}
          />
        </ChartCard>
      </div>

      {/* ── Keeping Alpha close ── */}
      {d.keep && d.keep.length > 0 && (
        <ChartCard
          dark={dark}
          delay={615}
          title="Kept close vs came back"
          sub="Students seen in the last 30 days, by how their device can keep Alpha: installed, a guided home-screen add, a bookmark, a calendar block. Days active out of the last 30."
          table={{
            head: ['Device', 'Students', 'Kept it', 'Days · kept', 'Days · not'],
            rows: d.keep.map(k => [KEEP_LABEL[k.method] ?? k.method, fmt(k.users), pctText(ratio(k.kept, k.users)), k.days_kept === null ? '—' : fmt(k.days_kept, 1), k.days_not === null ? '—' : fmt(k.days_not, 1)]),
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {d.keep.map(k => (
              <Mini
                key={k.method}
                dark={dark}
                label={KEEP_LABEL[k.method] ?? k.method}
                value={k.days_kept === null ? '—' : `${fmt(k.days_kept, 1)} vs ${k.days_not === null ? '—' : fmt(k.days_not, 1)}`}
                sub={`${fmt(k.users)} students · ${pctText(ratio(k.kept, k.users))} kept it · days active, kept vs not`}
              />
            ))}
          </div>
        </ChartCard>
      )}

      {/* ── Community and content ── */}
      {Object.keys(features).length > 0 && (
        <ChartCard dark={dark} delay={630} title="Groups, Race, Decks and the inbox" sub="Straight from each feature's own tables.">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {hasFeature('group_members') && <Mini dark={dark} label="In a group" value={fmt(features.group_members)} sub={`${fmt(features.groups)} groups`} />}
            {hasFeature('group_messages_7') && <Mini dark={dark} label="Group messages · 7d" value={fmt(features.group_messages_7)} sub={`${fmt(features.groups_active_7)} groups talking`} />}
            {hasFeature('race_today') && <Mini dark={dark} label="In today's race" value={fmt(features.race_today)} sub={`${fmt(features.race_30)} raced in 30 days`} />}
            {hasFeature('reviews_7') && <Mini dark={dark} label="Card reviews · 7d" value={fmt(features.reviews_7)} sub={`${fmt(features.reviews_today)} today`} />}
            {hasFeature('reviewers_7') && <Mini dark={dark} label="Reviewing cards · 7d" value={fmt(features.reviewers_7)} sub={`${fmt(features.reviewers_30)} in 30 days · ${fmt(features.deck_students)} have decks`} />}
            {hasFeature('push_users') && <Mini dark={dark} label="Push turned on" value={fmt(features.push_users)} sub="Accounts with a device subscribed" />}
            {hasFeature('profiles') && <Mini dark={dark} label="Profiles" value={fmt(features.profiles)} sub="Public identity cards" />}
            {hasFeature('feedback_open') && <Mini dark={dark} label="Open feedback" value={fmt(features.feedback_open)} sub={`${fmt(features.feedback_7)} new this week`} />}
            {features.announcement && <Mini dark={dark} label="Latest notice read by" value={fmt(features.announcement.reads)} sub={`“${features.announcement.title}” · ${pctText(ratio(features.announcement.reads, d.active.mau))} of monthly actives`} />}
            {hasFeature('ai_users_month') && <Mini dark={dark} label="AI notes this month" value={fmt(features.ai_users_month)} sub="Accounts that used them" />}
          </div>
        </ChartCard>
      )}
    </div>
  );
};

const Mini: React.FC<{ dark: boolean; label: string; value: string; sub?: string }> = ({ dark, label, value, sub }) => {
  const t = tokens(dark);
  return (
    <div className={`rounded-lg border px-4 py-3 min-w-0 ${t.inset}`}>
      <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui truncate ${t.faint}`}>{label}</p>
      <p className={`num-stat text-[22px] mt-1.5 leading-none ${t.heading}`}>{value}</p>
      {sub && <p className={`text-[11px] font-ui mt-1.5 line-clamp-2 ${t.muted}`} title={sub}>{sub}</p>}
    </div>
  );
};

const round1 = (n: number) => Math.round(n * 10) / 10;

const KEEP_LABEL: Record<string, string> = {
  prompt: 'One-tap install',
  'ios-share': 'iPhone / iPad',
  'mac-dock': 'Safari on Mac',
  'firefox-android': 'Firefox Android',
  bookmark: 'Bookmark (desktop)',
  inapp: 'In-app browser',
  none: 'Already installed',
  unknown: 'Older app version',
};
const hoursText = (h: number): string => `${fmt(h, h < 100 ? 1 : 0)}h`;

/** Everything the screen says that is not a field read straight off the payload. */
const derive = (d: Analytics) => {
  /* Past about four months the same day-and-month can appear twice on one axis. */
  const labels = d.series.map(s => (d.days > 120 ? yearDate(s.day) : shortDate(s.day)));
  const trackingIndex = d.tracking_since ? d.series.findIndex(s => s.day >= (d.tracking_since as string)) : null;

  let reconstructedNote: string | null = null;
  if (!d.tracking_since) {
    reconstructedNote = 'No device has reported in yet, so every figure so far is rebuilt from study logs, card reviews, chats and sign-ins. Live counts start as people open the new version of the app.';
  } else if (d.tracking_since > d.start) {
    reconstructedNote = `Live tracking started on ${longDate(d.tracking_since)}. Days before that are rebuilt from study logs, card reviews, chats and sign-ins, so they miss people who opened the app without doing any of those.`;
  }

  const lastFull = d.growth.filter(g => g.week !== d.week_now).at(-1) ?? null;
  const frequency = Array.from({ length: 30 }, (_, i) => d.frequency.find(f => f.days === i + 1)?.users ?? 0);

  const f = d.funnel;
  const funnel = [
    { label: 'Signed up', value: f.signed_up, hint: 'Accounts created.' },
    { label: 'Confirmed email', value: f.confirmed, hint: 'Clicked the confirmation link.' },
    { label: 'Signed in', value: f.signed_in, hint: 'Signed in and synced on a device at least once.' },
    { label: 'Logged study', value: f.studied, hint: 'Logged at least one study session.' },
    { label: 'Came back', value: f.returned, hint: 'Active on 2 or more days.' },
    { label: '7+ days', value: f.habit, hint: 'Active on 7 or more days.' },
  ];

  const s = d.setup.streaks;
  const streaks = [
    { label: 'No streak', value: s['0'] },
    { label: '1–2 days', value: s['1-2'] },
    { label: '3–6 days', value: s['3-6'] },
    { label: '7–29 days', value: s['7-29'] },
    { label: '30+ days', value: s['30+'] },
  ];

  const a = d.setup.adoption;
  const adoption = [
    { label: 'Task board', value: a.tasks, hint: 'Has at least one task.' },
    { label: 'Syllabus', value: a.syllabus, hint: 'Has started at least one chapter.' },
    { label: 'Plan', value: a.plan, hint: 'Has a block or a repeating block on the Plan tab.' },
    { label: 'Mocks', value: a.mocks, hint: 'Has logged a mock result.' },
    { label: 'Error notebook', value: a.errors, hint: 'Has saved at least one wrong answer.' },
    { label: 'Pomodoro', value: a.pomodoro, hint: 'Timer set to Pomodoro.' },
    { label: 'Ranks race', value: a.race, hint: 'Racing on the leaderboard.' },
    { label: 'Rewards', value: a.rewards, hint: 'Has unlocked a streak reward.' },
    { label: 'Closed-app reminders', value: a.reminders, hint: 'Push reminders switched on.' },
    ...(a.nudges !== undefined ? [{ label: 'Daily nudges', value: a.nudges, hint: 'Opted into the daily study nudges.' }] : []),
    ...(a.kept !== undefined ? [{ label: 'Kept Alpha close', value: a.kept, hint: 'Installed, bookmarked or added to their calendar on their last device.' }] : []),
  ].sort((x, y) => y.value - x.value);

  const st = d.setup;
  const dv = d.devices;
  const examN = st.exam.JEE + st.exam.NEET;
  const classN = st.class['11'] + st.class['12'];
  const platN = Object.values(dv.platforms).reduce((n, x) => n + (x ?? 0), 0);
  const timerN = st.timer.stopwatch + st.timer.pomodoro;
  const themeN = st.theme.dark + st.theme.light;
  const who = [
    { label: 'Exam: JEE', value: st.exam.JEE, of: examN },
    { label: 'Exam: NEET', value: st.exam.NEET, of: examN },
    { label: 'Class 11', value: st.class['11'], of: classN },
    { label: 'Class 12', value: st.class['12'], of: classN },
    { label: 'Android', value: dv.platforms.android ?? 0, of: platN },
    { label: 'iPhone / iPad', value: dv.platforms.ios ?? 0, of: platN },
    { label: 'Computer', value: (dv.platforms.desktop ?? 0) + (dv.platforms.other ?? 0), of: platN },
    { label: 'Installed app', value: dv.installed, of: dv.reporting },
    { label: 'Stopwatch', value: st.timer.stopwatch, of: timerN },
    { label: 'Pomodoro', value: st.timer.pomodoro, of: timerN },
    { label: 'Dark theme', value: st.theme.dark, of: themeN },
    { label: 'Light theme', value: st.theme.light, of: themeN },
  ];

  const best = d.series.reduce<typeof d.series[number] | null>((b, r) => (r.signups > (b?.signups ?? 0) ? r : b), null);

  return {
    labels,
    trackingIndex: trackingIndex !== null && trackingIndex > 0 ? trackingIndex : null,
    reconstructedNote,
    stickiness: ratio(d.active.user_days_30 / 30, d.active.mau_complete),
    daysPerMau: ratio(d.active.days_per_mau, d.active.mau),
    hoursPerStudyDay: ratio(d.study.hours_7, d.study.student_days_7),
    trackedShare: ratio(d.study.tracked_7, d.study.hours_7),
    rangeHours: d.series.reduce((n, r) => n + r.hours, 0),
    bestSignup: best,
    lastFullWeek: lastFull,
    quickRatio: lastFull && lastFull.churned > 0 ? (lastFull.new + lastFull.resurrected) / lastFull.churned : null,
    frequency,
    regulars: frequency.slice(9).reduce((n, x) => n + x, 0),
    funnel,
    streaks,
    adoption,
    who,
  };
};

export default AnalyticsAdmin;
