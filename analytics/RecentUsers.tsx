/* ── Console → Analytics → Latest sign-ups ──
   The newest accounts, by name: profile (name, handle, bio, avatar), when
   they joined, and the numbers the analytics tables already keep about them.
   The only part of the console that names a student, so it asks its own
   admin-only function (`admin_recent_users`, analytics.sql §6b) rather than
   riding the aggregate payload, and it loads on its own: a project that has
   not re-run analytics.sql still gets the rest of the dashboard.

   A list, not a wide table, so it reads on a phone. Older accounts page in
   with "Show more", keyed on the oldest join time already on screen. */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { btn, tokens } from '../ui/kit';
import { humanError } from '../feedback/api';
import { Avatar } from '../profile/Avatar';
import { RECENT_PAGE, RecentUser, fetchRecentUsers, isAnalyticsMissing } from './api';
import { ChartCard, fmt, shortDate } from './charts';

interface Props {
  theme: 'dark' | 'light';
  delay?: number;
  /** The design board's fixtures; the real console always asks the database. */
  load?: (before: string | null) => Promise<RecentUser[]>;
}

const PLATFORM: Record<NonNullable<RecentUser['platform']>, string> = {
  ios: 'iPhone', android: 'Android', desktop: 'Laptop', other: 'Other device',
};

const ago = (iso: string, now: number): string => {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: days > 300 ? '2-digit' : undefined });
};

const stamp = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

const RecentUsers: React.FC<Props> = ({ theme, delay = 0, load = fetchRecentUsers }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const [rows, setRows] = useState<RecentUser[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [more, setMore] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  /* A page that lands after a refresh started belongs to the old list. */
  const gen = useRef(0);

  const fetchPage = useCallback((before: string | null) => {
    const g = before === null ? ++gen.current : gen.current;
    setBusy(true);
    setError(null);
    load(before)
      .then(page => {
        if (g !== gen.current) return;
        setMissing(false);
        setNow(Date.now());
        setRows(prev => {
          if (before === null) return page;
          const seen = new Set(prev.map(r => r.user_id));
          return [...prev, ...page.filter(r => !seen.has(r.user_id))];
        });
        setMore(page.length === RECENT_PAGE);
      })
      .catch(e => {
        if (g !== gen.current) return;
        if (isAnalyticsMissing(e)) setMissing(true);
        else setError(humanError(e));
      })
      .finally(() => { if (g === gen.current) setBusy(false); });
  }, [load]);

  useEffect(() => { fetchPage(null); }, [fetchPage]);

  const refreshBtn = (
    <button type="button" onClick={() => fetchPage(null)} disabled={busy} className={`${btn} px-3 py-2 ${t.ghost}`}>
      {busy && rows.length === 0 ? 'Loading…' : 'Refresh'}
    </button>
  );

  return (
    <ChartCard
      dark={dark}
      delay={delay}
      title="Latest sign-ups"
      sub={<>Newest accounts first, with their profile and how much they have used the app. Only admins can see this.</>}
    >
      {missing ? (
        <p className={`text-[12px] font-ui ${t.body}`}>
          Re-run <code className={`px-1.5 py-0.5 rounded ${dark ? 'bg-white/[0.06]' : 'bg-zinc-100'}`}>supabase/analytics.sql</code> to switch this list on.
        </p>
      ) : (
        <>
          {error && (
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <p className="text-[12px] font-bold font-ui text-[#E10600]">{error}</p>
              {refreshBtn}
            </div>
          )}

          {rows.length === 0 && !error && (
            <p className={`text-[12px] font-ui ${t.muted}`}>{busy ? 'Finding the newest accounts…' : 'No accounts yet.'}</p>
          )}

          {rows.length > 0 && (
            <ul className={`max-h-[560px] overflow-y-auto divide-y rounded-lg border ${t.rule} ${dark ? 'divide-white/[0.05]' : 'divide-zinc-100'}`}>
              {rows.map(u => <Row key={u.user_id} u={u} dark={dark} now={now} />)}
            </ul>
          )}

          {rows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
              <p className={`text-[11px] font-ui ${t.muted}`}>{fmt(rows.length)} shown</p>
              <div className="flex items-center gap-2">
                {!error && refreshBtn}
                {more && (
                  <button
                    type="button"
                    onClick={() => fetchPage(rows[rows.length - 1].joined_at)}
                    disabled={busy}
                    className={`${btn} px-3 py-2 ${t.ghost}`}
                  >
                    {busy ? 'Loading…' : 'Show more'}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </ChartCard>
  );
};

const Row: React.FC<{ u: RecentUser; dark: boolean; now: number }> = ({ u, dark, now }) => {
  const t = tokens(dark);
  const profile = u.handle && u.display_name && u.avatar_type
    ? { user_id: u.user_id, handle: u.handle, display_name: u.display_name, avatar_type: u.avatar_type, avatar_id: u.avatar_id, avatar_url: u.avatar_url }
    : null;

  const facts: string[] = [];
  if (u.exam) facts.push(u.class_level ? `${u.exam} · Class ${u.class_level}` : u.exam);
  else if (u.class_level) facts.push(`Class ${u.class_level}`);
  if (u.goal_hours !== null && u.goal_hours > 0) facts.push(`${fmt(u.goal_hours, 1)}h goal`);
  if (u.platform) facts.push(u.installed ? `${PLATFORM[u.platform]} · installed` : PLATFORM[u.platform]);

  const usage: string[] = [];
  if (u.days_active > 0) {
    usage.push(`${fmt(u.days_active)} ${u.days_active === 1 ? 'day' : 'days'} active`);
    usage.push(`${fmt(u.hours, u.hours < 100 ? 1 : 0)}h studied`);
    if (u.streak) usage.push(`${fmt(u.streak)}-day streak`);
    if (u.last_active) usage.push(`last seen ${shortDate(u.last_active)}`);
  } else {
    usage.push('Not seen in the app yet');
  }

  return (
    <li className="flex items-start gap-3 px-4 py-3.5 min-w-0">
      <Avatar profile={profile} name={u.display_name ?? '?'} size={38} className="shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate font-ui text-[14px]">
            {u.display_name
              ? <span className={`font-bold ${t.heading}`}>{u.display_name}</span>
              : <span className={`italic ${t.muted}`}>No profile yet</span>}
            {u.handle && <span className={`ml-2 text-[12px] ${t.faint}`}>@{u.handle}</span>}
          </p>
          <time dateTime={u.joined_at} title={`Joined ${stamp(u.joined_at)}`} className={`shrink-0 text-[11px] font-ui tabular-nums ${t.muted}`}>
            {ago(u.joined_at, now)}
          </time>
        </div>
        {u.bio
          ? <p className={`mt-1 text-[12px] font-ui leading-relaxed break-words ${t.body}`}>&ldquo;{u.bio}&rdquo;</p>
          : <p className={`mt-1 text-[12px] font-ui ${t.faint}`}>No bio</p>}
        <p className={`mt-1.5 text-[11px] font-ui ${t.muted}`}>
          {[...facts, ...usage].join(' · ')}
        </p>
      </div>
    </li>
  );
};

export default RecentUsers;
