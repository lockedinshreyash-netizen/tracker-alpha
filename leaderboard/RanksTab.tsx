import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { DailyLog, LeaderboardPrefs } from '../types';
import { MAX_NAME, validateName } from './api';
import { Racer, formatGap } from './engine';
import { RaceView, untimedHoursToday } from './useRace';
import RaceStatusCard from './RaceStatusCard';
import RaceControlFeed from './RaceControl';
import RaceTimeline from './RaceTimeline';

interface Props {
  user: User | null;
  logs: DailyLog[];
  prefs: LeaderboardPrefs;
  race: RaceView;
  onJoin: (displayName: string) => void;
  onLeave: () => void;
  onOpenAuth: () => void;
  theme: 'dark' | 'light';
}

/** ▲2 / ▼1 against where this entrant stood when the day was first seen. */
const Movement: React.FC<{ delta: number; dark: boolean }> = ({ delta, dark }) => {
  if (!delta) {
    return <span className={`text-[9px] font-data w-6 text-center ${dark ? 'text-zinc-700' : 'text-[#D6D1C5]'}`}>–</span>;
  }
  const up = delta > 0;
  return (
    <span
      className={`text-[9px] font-data w-6 text-center tabular-nums ${up ? 'text-[#E10600]' : dark ? 'text-zinc-500' : 'text-[#8A8577]'}`}
      title={`${up ? 'Up' : 'Down'} ${Math.abs(delta)} since you opened the board`}
    >
      {up ? '▲' : '▼'}{Math.abs(delta)}
    </span>
  );
};

const RanksTab: React.FC<Props> = ({ user, logs, prefs, race, onJoin, onLeave, onOpenAuth, theme }) => {
  const dark = theme === 'dark';
  const [name, setName] = useState(prefs.displayName);

  const card = dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-[#E3E0D9]';
  const muted = dark ? 'text-zinc-500' : 'text-[#8A8577]';
  const heading = dark ? 'text-white' : 'text-[#17150F]';

  /* ── Not signed in ── the board needs an account to write a row against. */
  if (!user) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <section className={`p-8 md:p-12 rounded-xl border text-center ${card}`}>
          <h2 className={`text-xl md:text-2xl font-black uppercase tracking-tight font-ui ${heading}`}>
            Your competition is logging hours right now
          </h2>
          <p className={`text-[11px] font-ui mt-3 max-w-md mx-auto leading-relaxed ${muted}`}>
            Every day is a fresh race: everyone starts at zero at midnight, and the board tracks who
            is ahead, who is closing, and what a single session would change. Sign in to take your
            place in it.
          </p>
          <button
            onClick={onOpenAuth}
            className={`mt-8 px-10 py-4 rounded-lg font-black uppercase tracking-[0.2em] text-[10px] font-ui transition-all active:scale-[0.98] ${dark ? 'bg-white text-black hover:bg-zinc-100' : 'bg-[#17150F] text-[#F2F0EC] hover:bg-[#2B2820]'}`}
          >
            Sign in
          </button>
        </section>
      </div>
    );
  }

  /* ── Signed in, not on the board ── nothing has been published yet. */
  if (!prefs.enabled) {
    const valid = validateName(name);
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <section className={`p-8 md:p-12 rounded-xl border ${card}`}>
          <h2 className={`text-xl md:text-2xl font-black uppercase tracking-tight font-ui ${heading}`}>
            Put your name in today’s race
          </h2>
          <p className={`text-[11px] font-ui mt-3 leading-relaxed ${muted}`}>
            Ranked on time this app measured today — stopwatch sessions and focus blocks. Hours you
            type in yourself still count for your own totals, but not here: a race everyone can type
            their way to the front of isn’t a race. Resets every midnight, IST.
          </p>

          <label className={`block text-[9px] font-black uppercase tracking-[0.14em] mt-8 mb-2 font-ui ${muted}`}>
            Display name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={MAX_NAME}
            placeholder="WHAT SHOULD WE CALL YOU?"
            className={`w-full px-4 py-3.5 rounded-lg border text-sm font-ui outline-none transition-colors focus:border-[#E10600] ${dark ? 'bg-[#0D0D10] border-white/[0.08] text-white placeholder:text-zinc-700' : 'bg-[#F2F0EC] border-[#E3E0D9] text-[#17150F] placeholder:text-[#B5AFA0]'}`}
          />

          <button
            disabled={!valid}
            onClick={() => valid && onJoin(valid)}
            className={`w-full mt-6 py-4 rounded-lg font-black uppercase tracking-[0.2em] text-[10px] font-ui transition-all active:scale-[0.98] ${valid
              ? 'bg-[#E10600] text-white hover:bg-red-700'
              : dark ? 'bg-zinc-900 text-zinc-700 cursor-not-allowed' : 'bg-[#E3E0D9] text-[#B5AFA0] cursor-not-allowed'}`}
          >
            Join the race
          </button>

          <p className={`text-[9px] font-ui leading-relaxed mt-5 pt-5 border-t ${dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]'} ${muted}`}>
            This publishes your display name, today's hour total, and whether a session is running
            right now, to other signed-in users. Nothing else — not your logs, subjects, tasks or
            email. Leave any time and your row is deleted.
          </p>
        </section>
      </div>
    );
  }

  /* ── In the race ── */
  const { entrants, position } = race.race;
  const untimed = untimedHoursToday(logs);
  const { permission, enabled: notificationsOn } = race.notifications;

  const gapToMe = (racer: Racer): string | null => {
    if (racer.isMe || position === null || !race.race.me) return null;
    const delta = racer.minutes - race.race.me.minutes;
    if (delta === 0) return 'level with you';
    return delta > 0 ? `${formatGap(delta)} ahead of you` : `${formatGap(-delta)} behind you`;
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <RaceStatusCard status={race.status} race={race.race} day={race.day} theme={theme} />

      <RaceControlFeed events={race.feed} theme={theme} />

      {race.error && (
        <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui text-center py-3 ${muted}`}>
          {race.error}
        </p>
      )}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-4 px-1 pb-1">
          <h3 className={`text-[9px] font-black uppercase tracking-[0.18em] font-ui ${muted}`}>
            Standings
          </h3>
          <span className={`text-[9px] font-ui ${muted}`}>
            {race.lastFetchedAt ? 'Live · updates on its own' : 'Loading…'}
          </span>
        </div>

        {!entrants.length ? (
          <p className={`text-[10px] font-black uppercase py-8 text-center italic ${muted}`}>
            Nobody has finished a session today. Be the first.
          </p>
        ) : (
          entrants.map(racer => {
            const opening = race.day.openingPositionById[racer.userId];
            const delta = opening === undefined ? 0 : opening - racer.position;
            const gap = gapToMe(racer);
            return (
              <div
                key={racer.userId}
                className={`flex items-center gap-3 md:gap-4 p-4 rounded-xl border transition-all ${racer.isMe
                  ? 'border-[#E10600]/40 bg-[#E10600]/[0.06]'
                  : card}`}
              >
                <span className={`num-stat text-base w-6 flex-shrink-0 text-right ${racer.position <= 3 ? 'text-[#E10600]' : muted}`}>
                  {racer.position}
                </span>
                <Movement delta={delta} dark={dark} />

                <div className="flex-1 min-w-0">
                  <p className={`truncate text-sm font-bold font-ui ${racer.isMe ? 'text-[#E10600]' : heading}`}>
                    {racer.name}{racer.isMe && ' (you)'}
                  </p>
                  <p className={`text-[10px] font-ui mt-0.5 truncate flex items-center gap-1.5 ${muted}`}>
                    {racer.studying && (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#E10600] race-live-dot flex-shrink-0" />
                        <span className="text-[#E10600] font-bold">
                          In a session{racer.sessionMinutes ? ` · ${formatGap(racer.sessionMinutes)}` : ''}
                        </span>
                        {gap && <span aria-hidden="true">·</span>}
                      </>
                    )}
                    {gap}
                    {racer.isMe && race.race.pendingMinutes > 0 && (
                      <span>{formatGap(race.race.pendingMinutes)} not banked yet</span>
                    )}
                  </p>
                </div>

                <span className={`num-stat text-base flex-shrink-0 ${heading}`}>
                  {racer.hours.toFixed(1)}h
                </span>
              </div>
            );
          })
        )}

        {race.degraded && (
          <p className={`text-[9px] font-ui leading-relaxed pt-3 ${muted}`}>
            Live session signals are off — the board is missing its race columns. Run the second
            half of supabase/leaderboard.sql to turn them on. Rankings are unaffected.
          </p>
        )}
      </section>

      {untimed > 0 && (
        <p className={`text-[10px] font-ui leading-relaxed px-1 ${muted}`}>
          {untimed.toFixed(1)}h you entered by hand today isn’t in the race. Only sessions the app
          timed count here.
        </p>
      )}

      <RaceTimeline day={race.day} theme={theme} />

      {/* ── Being told about it ──
          Off by default and asked for only here, next to the thing it is about.
          Nothing is ever sent while a session is running. */}
      <section className={`p-5 rounded-xl border ${card}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className={`text-[11px] font-bold font-ui ${heading}`}>Race alerts</p>
            <p className={`text-[10px] font-ui mt-1 leading-relaxed ${muted}`}>
              {permission === 'denied'
                ? 'Blocked in your browser settings. Nothing can be sent until you allow notifications for this site.'
                : permission === 'unsupported'
                  ? 'This browser can’t show notifications. Race control still works inside the app.'
                  : notificationsOn
                    ? 'On — only when a place changes hands or a gap closes. Never while you’re in a session.'
                    : 'Get told when someone passes you, or when first place comes within reach. Never while you’re in a session.'}
            </p>
          </div>
          {permission !== 'denied' && permission !== 'unsupported' && (
            <button
              onClick={() => (notificationsOn ? race.notifications.disable() : void race.notifications.enable())}
              className={`flex-shrink-0 px-4 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-[0.14em] font-ui transition-all active:scale-[0.98] ${notificationsOn
                ? dark ? 'bg-zinc-900 text-zinc-400 hover:text-white' : 'bg-[#F2F0EC] text-[#6B675C] hover:text-[#17150F]'
                : 'bg-[#E10600] text-white hover:bg-red-700'}`}
            >
              {notificationsOn ? 'Turn off' : 'Turn on'}
            </button>
          )}
        </div>
      </section>

      <div className="flex items-center justify-center gap-5 pt-2">
        <button
          onClick={race.refresh}
          disabled={race.loading}
          className={`text-[10px] uppercase font-bold tracking-[0.08em] font-ui disabled:opacity-40 ${muted} hover:text-[#E10600] transition-colors`}
        >
          {race.loading ? 'Refreshing…' : 'Refresh'}
        </button>
        <button
          onClick={onLeave}
          className={`text-[10px] uppercase font-bold tracking-[0.08em] font-ui ${muted} hover:text-[#E10600] transition-colors`}
        >
          Leave board
        </button>
      </div>
    </div>
  );
};

export default RanksTab;
