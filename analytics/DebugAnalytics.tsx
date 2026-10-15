/* ── Dev-only design board: `?analytics=debug` ──
   The console's Analytics section on fixture data, with no database and no
   admin sign-in, in every state it can be in: a busy project, a brand-new one
   (live tracking began today, nothing to compare with), the "not switched on"
   start screen, a failed request, and a slow one. Either theme.

   Plus a ping inspector: the real useActivityPing, under StrictMode, with a
   recorder in place of the network — every payload the app would send, and
   when. It is the quickest answer to "what exactly leaves the device". Gated on
   import.meta.env.DEV in index.tsx and tree-shaken out of production, like
   decks/DebugDecks.tsx. Nothing here writes anywhere. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import AnalyticsAdmin from './AnalyticsAdmin';
import { fixtureAnalytics, fixtureRecentUsers } from './fixtures';
import { useActivityPing } from './useActivityPing';
import type { Ping } from './track';
import type { Analytics, Range, RecentUser } from './api';
import type { AppState, DailyLog } from '../types';
import { getISTDateString } from '../utils';

type State = 'full' | 'fresh' | 'missing' | 'error' | 'slow' | 'pings';

const STATES: Array<{ id: State; label: string }> = [
  { id: 'full', label: 'Busy project' },
  { id: 'fresh', label: 'Brand new (tracking began today)' },
  { id: 'missing', label: 'analytics.sql not run' },
  { id: 'error', label: 'Request fails' },
  { id: 'slow', label: 'Slow (3s per load)' },
  { id: 'pings', label: 'What the app sends (ping inspector)' },
];

const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

const DebugAnalytics: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [state, setState] = useState<State>('full');
  const dark = theme === 'dark';

  useEffect(() => {
    document.body.style.backgroundColor = dark ? '#0B0B0D' : '#F2F0EC';
  }, [dark]);

  /* A new loader per state so the section remounts and refetches. */
  const load = useMemo(() => async (range: Range): Promise<Analytics> => {
    await wait(state === 'slow' ? 3000 : 250);
    if (state === 'missing') throw { code: 'PGRST202', message: 'Could not find the function public.admin_analytics(p_days) in the schema cache' };
    if (state === 'error') throw { message: 'Failed to fetch' };
    return fixtureAnalytics(range, state === 'fresh' ? 'fresh' : 'full');
  }, [state]);

  const loadUsers = useMemo(() => async (before: string | null): Promise<RecentUser[]> => {
    await wait(state === 'slow' ? 3000 : 250);
    if (state === 'missing') throw { code: 'PGRST202', message: 'Could not find the function public.admin_recent_users(p_before, p_limit) in the schema cache' };
    if (state === 'error') throw { message: 'Failed to fetch' };
    return fixtureRecentUsers(before, state === 'fresh' ? 'fresh' : 'full');
  }, [state]);

  return (
    <div className={`min-h-screen font-ui ${dark ? 'text-white' : 'text-zinc-900'}`}>
      <div className={`sticky top-0 z-30 border-b px-4 md:px-8 py-3 flex flex-wrap items-center gap-3 ${dark ? 'bg-[#0B0B0D]/90 border-white/[0.06]' : 'bg-[#F2F0EC]/90 border-zinc-200'} backdrop-blur`}>
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-zinc-500">Analytics · design board</span>
        <select
          value={state}
          onChange={e => setState(e.target.value as State)}
          className={`text-[12px] rounded-md border px-2 py-1.5 ${dark ? 'bg-[#111114] border-white/[0.1]' : 'bg-white border-zinc-200'}`}
        >
          {STATES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          className={`text-[12px] rounded-md border px-3 py-1.5 ${dark ? 'border-white/[0.1]' : 'border-zinc-200'}`}
        >
          {dark ? 'Light' : 'Dark'}
        </button>
      </div>
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8">
        {state === 'pings'
          ? <React.StrictMode><PingInspector dark={dark} /></React.StrictMode>
          : <AnalyticsAdmin key={state} theme={theme} load={load} loadUsers={loadUsers} />}
      </div>
    </div>
  );
};

/* ── The ping inspector ── */

const DEBUG_USER = { id: 'debug-user-0000' } as unknown as User;

const setVisibility = (v: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
  document.dispatchEvent(new Event('visibilitychange'));
};

const PingInspector: React.FC<{ dark: boolean }> = ({ dark }) => {
  const today = getISTDateString();
  const [logs, setLogs] = useState<DailyLog[]>(() => [
    { id: 'l1', date: today, subject: 'Physics', hours: 1.5, quality: 4, distractions: 0, source: 'timer' },
    { id: 'l2', date: today, subject: 'Maths', hours: 0.75, quality: 3, distractions: 1, source: 'manual' },
  ]);
  const [sent, setSent] = useState<Array<{ at: string; ping: Ping }>>([]);

  const getState = useCallback(() => ({
    currentClass: 12, examPreference: 'JEE', logs, progress: [], tasks: [], dailyGoalHours: 8,
    timerMode: 'pomodoro', theme: 'dark', leaderboard: { enabled: true }, rewards: { unlocked: { d30: today } },
    schedule: { blocks: [], rules: [{}], overrides: [] }, mocks: { tests: [{ result: {} }, {}], errors: [{}], topics: {} },
    reminders: { push: false },
  } as unknown as AppState), [logs, today]);

  const transport = useCallback(async (ping: Ping) => {
    setSent(prev => [{ at: new Date().toLocaleTimeString('en-IN'), ping }, ...prev]);
    await new Promise(r => setTimeout(r, 300));
    return 'ok' as const;
  }, []);

  useActivityPing({ user: DEBUG_USER, ready: true, logs, getState, transport });

  const comeBack = () => {
    setVisibility('hidden');
    // Leave for 31 minutes: backdate the visit ledger the hide just wrote.
    localStorage.setItem(`analytics_visit_v1:${DEBUG_USER.id}`, JSON.stringify({ day: today, at: Date.now() - 31 * 60_000 }));
    setVisibility('visible');
  };
  const quickPeek = () => { setVisibility('hidden'); setVisibility('visible'); };

  const btnCls = `text-[12px] rounded-md border px-3 py-1.5 ${dark ? 'border-white/[0.1] hover:bg-white/[0.04]' : 'border-zinc-200 hover:bg-zinc-50'}`;
  return (
    <div className="space-y-4">
      <p className={`text-[13px] ${dark ? 'text-zinc-400' : 'text-zinc-600'}`}>
        The real hook, under StrictMode, with a recorder instead of the network. A fresh load should send exactly one visit.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnCls} onClick={() => setLogs(l => [...l, { id: `l${l.length + 1}`, date: today, subject: 'Chemistry', hours: 25 / 60, quality: 4, distractions: 0, source: 'pomodoro' }])}>Log a 25-min block</button>
        <button type="button" className={btnCls} onClick={() => setLogs(l => l.slice(0, -1))}>Delete the last log</button>
        <button type="button" className={btnCls} onClick={quickPeek}>Switch tabs and straight back</button>
        <button type="button" className={btnCls} onClick={comeBack}>Come back after 31 minutes</button>
        <button type="button" className={btnCls} onClick={() => setSent([])}>Clear</button>
      </div>
      <p data-testid="ping-count" className="text-[12px] text-zinc-500">{sent.length} sent · {sent.filter(x => x.ping.open).length} visits</p>
      <ol className="space-y-2">
        {sent.map((x, i) => (
          <li key={sent.length - i} className={`rounded-lg border p-3 ${dark ? 'border-white/[0.08] bg-[#111114]' : 'border-zinc-200 bg-white'}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-zinc-500">{x.at} · {x.ping.open ? 'visit' : 'totals'}</p>
            <pre className={`mt-2 text-[11px] leading-snug overflow-x-auto ${dark ? 'text-zinc-300' : 'text-zinc-700'}`}>{JSON.stringify(x.ping, null, 2)}</pre>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default DebugAnalytics;
