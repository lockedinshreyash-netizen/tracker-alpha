/* ── The group board ──
   Today / week / month / all time, from one RPC over `study_days`. Ranked on
   time the app measured — the Race's rule, for the Race's reason — and the
   footnote says so, because a student who typed in four hours and sees zero
   will otherwise conclude the board is broken.

   Members who keep their hours private are still on it, at the bottom,
   without a number. Dropping them would make the board lie about who is in
   the group; ranking them at zero would make it lie about them. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { addDays, getISTDateString, weekdayOf } from '../utils';
import { UserChip } from '../profile/Avatar';
import { useProfiles } from '../profile/profileCache';
import { LeaderboardEntry, MyGroup, fetchLeaderboard, humanError } from './api';
import { Eyebrow, RoleBadge, Segmented, btn, formatHours, tokens } from './ui';

type Period = 'today' | 'week' | 'month' | 'all';

/* Weeks are Mon–Sun app-wide (share/stats.ts's weekStart). Restated here in
   two lines rather than imported, so the share renderer stays in its own lazy
   chunk. */
const rangeOf = (period: Period): [string | null, string | null] => {
  const today = getISTDateString();
  switch (period) {
    case 'today': return [today, today];
    case 'week': return [addDays(today, -((weekdayOf(today) + 6) % 7)), today];
    case 'month': return [`${today.slice(0, 7)}-01`, today];
    case 'all': return [null, null];
  }
};

const PERIOD_LABEL: Record<Period, string> = { today: 'today', week: 'this week', month: 'this month', all: 'all time' };
const REFRESH_MS = 60_000;

interface Props {
  group: MyGroup;
  userId: string;
  onOpenProfile: (userId: string) => void;
  onGoTo: (section: 'members' | 'progress') => void;
  theme: 'dark' | 'light';
}

const GroupBoard: React.FC<Props> = ({ group, userId, onOpenProfile, onGoTo, theme }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const [period, setPeriod] = useState<Period>('today');
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: Period) => {
    const [from, to] = rangeOf(p);
    try {
      const data = await fetchLeaderboard(group.id, from, to);
      setRows(data);
      setError(null);
    } catch (e) {
      setError(humanError(e));
    }
  }, [group.id]);

  useEffect(() => {
    setRows(null);
    void load(period);
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(period);
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [period, load]);

  const profiles = useProfiles(useMemo(() => (rows ?? []).map(r => r.user_id), [rows]));
  const nameOf = (id: string) => profiles[id]?.display_name ?? (id === userId ? 'You' : 'Member');

  const ranked = useMemo(() => {
    const sharing = (rows ?? []).filter(r => r.shares_hours);
    sharing.sort((a, b) => (b.tracked_hours ?? 0) - (a.tracked_hours ?? 0) || a.user_id.localeCompare(b.user_id));
    // Standard competition ranking: equal hours share a place.
    let place = 0;
    return sharing.map((r, i) => {
      if (i === 0 || (r.tracked_hours ?? 0) !== (sharing[i - 1].tracked_hours ?? 0)) place = i + 1;
      return { ...r, place };
    });
  }, [rows]);

  const me = rows?.find(r => r.user_id === userId) ?? null;
  const hidden = (rows ?? []).filter(r => !r.shares_hours && r.user_id !== userId);
  const leader = ranked[0]?.tracked_hours ?? 0;
  const total = ranked.reduce((s, r) => s + (r.tracked_hours ?? 0), 0);
  const active = ranked.filter(r => (r.tracked_hours ?? 0) > 0).length;
  const myPlace = ranked.find(r => r.user_id === userId)?.place ?? null;

  return (
    <div className="space-y-5">
      <div className="md:max-w-sm">
      <Segmented
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'today', label: 'Today' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
          { value: 'all', label: 'All time' },
        ]}
        dark={dark}
        label="Leaderboard period"
        size="sm"
      />
      </div>

      {/* ── Overview ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: rows ? formatHours(total) : '—' },
          { label: period === 'today' ? 'Studied' : 'Showed up', value: rows ? `${active}/${group.member_count}` : '—' },
          { label: 'Your place', value: myPlace ? `#${myPlace}` : me && !me.shares_hours ? 'Hidden' : '—' },
        ].map(s => (
          <div key={s.label} className={`p-3.5 md:p-5 rounded-xl border min-w-0 ${t.card}`}>
            <Eyebrow dark={dark} className="truncate">{s.label}</Eyebrow>
            <p className={`num-stat text-xl md:text-3xl mt-2 leading-none whitespace-nowrap ${t.heading}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {error && <p className={`text-[11px] font-ui px-4 py-3 rounded-lg border ${t.inset} ${t.muted}`}>{error}</p>}

      <section className={`rounded-xl border overflow-hidden ${t.card}`}>
        <div className={`px-5 md:px-6 pt-5 pb-3 flex items-center justify-between`}>
          <Eyebrow dark={dark}>Leaderboard · {PERIOD_LABEL[period]}</Eyebrow>
        </div>

        {rows === null ? (
          <div className="px-5 md:px-6 pb-5 space-y-2" aria-busy="true">
            {[0, 1, 2].map(i => <div key={i} className={`h-12 rounded-lg animate-pulse ${dark ? 'bg-white/[0.03]' : 'bg-[#F2F0EC]'}`} />)}
          </div>
        ) : (
          <ol className="pb-2">
            {ranked.map(r => {
              const isMe = r.user_id === userId;
              const hrs = r.tracked_hours ?? 0;
              const pct = leader > 0 ? Math.max(2, (hrs / leader) * 100) : 0;
              return (
                <li
                  key={r.user_id}
                  className={`relative flex items-center gap-3 px-5 md:px-6 py-3 ${isMe ? (dark ? 'bg-[#E10600]/[0.06]' : 'bg-[#E10600]/[0.04]') : ''}`}
                >
                  <span className={`w-7 text-right font-display text-lg leading-none tabular-nums ${r.place === 1 && hrs > 0 ? 'text-[#E10600]' : t.muted}`}>
                    {r.place}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserChip
                        userId={r.user_id}
                        name={isMe ? `${nameOf(r.user_id)} (you)` : nameOf(r.user_id)}
                        profile={profiles[r.user_id]}
                        onOpen={onOpenProfile}
                        theme={theme}
                        size={26}
                        nameClassName={`truncate text-[13px] font-bold font-ui ${isMe ? 'text-[#E10600]' : t.heading}`}
                      />
                      <RoleBadge role={r.role} dark={dark} />
                    </div>
                    <div className={`mt-2 h-1 rounded-full overflow-hidden ${dark ? 'bg-white/[0.04]' : 'bg-[#F2F0EC]'}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${isMe ? 'bg-[#E10600]' : dark ? 'bg-zinc-500' : 'bg-[#8A8577]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className={`num-stat text-lg md:text-xl tabular-nums ${hrs > 0 ? t.heading : t.faint}`}>{formatHours(hrs)}</span>
                </li>
              );
            })}

            {/* Me, hidden: I still see my own number, and exactly why nobody else does. */}
            {me && !me.shares_hours && (
              <li className={`flex items-center gap-3 px-5 md:px-6 py-3 border-t ${t.rule}`}>
                <span className={`w-7 text-right text-[10px] ${t.faint}`}>—</span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] font-bold font-ui ${t.heading}`}>{nameOf(userId)} (you)</p>
                  <p className={`text-[10px] font-ui mt-0.5 ${t.muted}`}>
                    Only you see this.{' '}
                    <button onClick={() => onGoTo('progress')} className="text-[#E10600] font-bold">Share your hours</button>
                  </p>
                </div>
                <span className={`num-stat text-lg tabular-nums ${t.muted}`}>{formatHours(me.tracked_hours ?? 0)}</span>
              </li>
            )}

            {hidden.length > 0 && (
              <li className={`px-5 md:px-6 py-3 border-t ${t.rule}`}>
                <p className={`text-[11px] font-ui ${t.muted}`}>
                  {hidden.length === 1 ? '1 member keeps' : `${hidden.length} members keep`} their hours hidden:{' '}
                  {hidden.map(h => nameOf(h.user_id)).join(', ')}
                </p>
              </li>
            )}
          </ol>
        )}

        {rows !== null && group.member_count <= 1 && (
          <div className={`mx-5 md:mx-6 mb-5 p-5 rounded-lg border ${t.inset}`}>
            <p className={`text-[12px] font-ui ${t.body}`}>It’s just you. A leaderboard of one is a diary.</p>
            <button onClick={() => onGoTo('members')} className={`mt-4 px-6 py-3 ${btn} ${t.primary}`}>Invite people</button>
          </div>
        )}

        <p className={`px-5 md:px-6 py-4 border-t text-[10px] font-ui leading-relaxed ${t.rule} ${t.muted}`}>
          Ranked on time the app measured — stopwatch sessions and focus blocks. Hours you type in yourself still
          count for your own stats, just not here.
        </p>
      </section>
    </div>
  );
};

export default GroupBoard;
