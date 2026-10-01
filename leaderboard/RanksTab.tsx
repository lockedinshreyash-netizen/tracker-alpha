import React, { useState } from 'react';
import { PageHeader, btn, tokens } from '../ui/kit';
import type { User } from '@supabase/supabase-js';
import { DailyLog, LeaderboardPrefs } from '../types';
import { MAX_NAME, validateName } from './api';
import { Racer, formatGap } from './engine';
import { RaceView, untimedHoursToday } from './useRace';
import RaceStatusCard from './RaceStatusCard';
import RaceRecap from './RaceRecap';
import RaceControlFeed from './RaceControl';
import RaceTimeline from './RaceTimeline';
import RaceChat from './RaceChat';
import { UserChip } from '../profile/Avatar';
import { useProfiles } from '../profile/profileCache';

interface Props {
  user: User | null;
  logs: DailyLog[];
  prefs: LeaderboardPrefs;
  race: RaceView;
  /** Resolves to a message when the server refused (a ban), else null. */
  onJoin: (displayName: string) => Promise<string | null>;
  onLeave: () => void;
  onOpenAuth: () => void;
  onOpenProfile: (userId: string) => void;
  theme: 'dark' | 'light';
}

/** ▲2 / ▼1 against where this entrant stood when the day was first seen. */
const Movement: React.FC<{ delta: number; dark: boolean }> = ({ delta, dark }) => {
  if (!delta) {
    return <span className={`text-[9px] font-data w-6 text-center ${dark ? 'text-zinc-700' : 'text-zinc-400'}`}>–</span>;
  }
  const up = delta > 0;
  return (
    <span
      className={`text-[9px] font-data w-6 text-center tabular-nums ${up ? 'text-[#E10600]' : dark ? 'text-zinc-500' : 'text-zinc-500'}`}
      title={`${up ? 'Up' : 'Down'} ${Math.abs(delta)} since you opened the board`}
    >
      {up ? '▲' : '▼'}{Math.abs(delta)}
    </span>
  );
};

const RanksBody: React.FC<Props> = ({ user, logs, prefs, race, onJoin, onLeave, onOpenAuth, onOpenProfile, theme }) => {
  const dark = theme === 'dark';
  const [name, setName] = useState(prefs.displayName);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  /* Hooks must run unconditionally on every render of this component — the
     two early returns below (signed out / not on the board) must never sit
     between a hook and the top of the function, or leaving the board (which
     flips prefs.enabled and sends this component down the earlier branch)
     changes how many hooks got called on that render. React detects the
     mismatch and throws, which — with no error boundary above it — takes
     down the whole app to a blank screen. race.race.entrants is always a
     valid array regardless of which branch below actually renders, so this
     is safe to call up here unconditionally. */
  const profiles = useProfiles(race.race.entrants.map(r => r.userId));

  const card = dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm';
  const kit = tokens(dark);
  const muted = dark ? 'text-zinc-500' : 'text-zinc-500';
  const heading = dark ? 'text-white' : 'text-zinc-900';

  /* ── Not signed in ── the board needs an account to write a row against. */
  if (!user) {
    return (
      <div>
        <section className={`mk-rise p-8 md:p-14 rounded-xl border text-center relative overflow-hidden ${card}`}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(70% 80% at 50% 0%, rgba(225,6,0,${dark ? '0.12' : '0.06'}), transparent 70%)` }} />
          <h2 className={`relative font-display text-[28px] md:text-[36px] leading-[1.05] ${heading}`}>
            Your competition is logging hours right now.
          </h2>
          <p className={`relative text-[14px] font-ui mt-4 max-w-md mx-auto leading-relaxed ${muted}`}>
            Every day is a fresh race: everyone starts at zero at midnight, and the board tracks who
            is ahead, who is closing, and what a single session would change. Sign in to take your
            place in it.
          </p>
          <button
            onClick={onOpenAuth}
            className={`${btn} relative mt-8 px-10 py-4 ${kit.primary}`}
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
      <div>
        <section className={`mk-rise p-6 md:p-10 rounded-xl border ${card}`}>
          <h2 className={`font-display text-[26px] md:text-[32px] leading-tight ${heading}`}>
            Put your name in today’s race.
          </h2>
          <p className={`text-[14px] font-ui mt-3 leading-relaxed ${muted}`}>
            Ranked on time this app measured today — stopwatch sessions and focus blocks. Hours you
            type in yourself still count for your own totals, but not here: a race everyone can type
            their way to the front of isn’t a race. Resets every midnight, IST.
          </p>

          <label className={`block text-[10px] font-bold uppercase tracking-[0.06em] mt-8 mb-2 font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Display name
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={MAX_NAME}
            placeholder="What should we call you?"
            className={`${kit.input} !py-3.5`}
          />

          <button
            disabled={!valid || joining}
            onClick={async () => {
              if (!valid) return;
              setJoining(true);
              setJoinError(null);
              const refused = await onJoin(valid);
              setJoining(false);
              setJoinError(refused);
            }}
            className={`${btn} w-full mt-6 py-4 ${kit.primary}`}
          >
            {joining ? 'Joining…' : 'Join the race'}
          </button>
          {joinError && (
            <p className="text-[11px] font-ui text-[#E10600] mt-3">{joinError}</p>
          )}

          <p className={`text-[12px] font-ui leading-relaxed mt-6 pt-5 border-t ${dark ? 'border-white/[0.06]' : 'border-zinc-100'} ${muted}`}>
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
    <div className="space-y-6">
      <RaceStatusCard status={race.status} race={race.race} day={race.day} theme={theme} />

      <RaceControlFeed events={race.feed} theme={theme} />

      {race.error && (
        <p className={`text-[12px] font-ui text-center py-2 ${muted}`}>
          {race.error}
        </p>
      )}

      <section className={`mk-rise rounded-xl border overflow-hidden ${card}`} style={{ animationDelay: '80ms' }}>
        <div className="flex items-baseline justify-between gap-4 px-5 md:px-6 pt-5 pb-3">
          <h3 className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>
            Standings
          </h3>
          <span className={`inline-flex items-center gap-1.5 text-[11px] font-ui ${muted}`}>
            {race.lastFetchedAt && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />}
            {race.lastFetchedAt ? 'Live' : 'Loading…'}
          </span>
        </div>

        {!entrants.length ? (
          <p className={`text-[13px] font-ui py-10 text-center border-t ${dark ? 'border-white/[0.05]' : 'border-zinc-100'} ${muted}`}>
            Nobody has finished a session today. Be the first.
          </p>
        ) : (
          <div className={`border-t divide-y ${dark ? 'border-white/[0.05] divide-white/[0.05]' : 'border-zinc-100 divide-zinc-100'}`}>
          {
          entrants.map(racer => {
            const opening = race.day.openingPositionById[racer.userId];
            const delta = opening === undefined ? 0 : opening - racer.position;
            const gap = gapToMe(racer);
            return (
              <div
                key={racer.userId}
                className={`relative flex items-center gap-3 md:gap-4 px-5 md:px-6 py-3.5 transition-colors ${racer.isMe ? 'bg-[#E10600]/[0.05]' : ''}`}
              >
                {racer.isMe && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#E10600]" aria-hidden="true" />}
                <span className={`num-stat text-[17px] w-6 flex-shrink-0 text-right ${racer.position <= 3 ? heading : muted}`}>
                  {racer.position}
                </span>
                <Movement delta={delta} dark={dark} />

                <div className="flex-1 min-w-0">
                  <UserChip
                    userId={racer.userId}
                    name={`${racer.name}${racer.isMe ? ' (you)' : ''}`}
                    profile={profiles[racer.userId]}
                    onOpen={onOpenProfile}
                    theme={theme}
                    nameClassName={`truncate text-sm font-bold font-ui ${racer.isMe ? 'text-[#E10600]' : heading}`}
                  />
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

                <span className={`num-stat text-[18px] flex-shrink-0 ${heading}`}>
                  {racer.hours.toFixed(1)}<span className={`font-ui text-[11px] ml-0.5 ${muted}`}>h</span>
                </span>
              </div>
            );
          })}
          </div>
        )}

        {race.degraded && (
          <p className={`text-[11px] font-ui leading-relaxed px-5 md:px-6 py-3 border-t ${dark ? 'border-white/[0.05]' : 'border-zinc-100'} ${muted}`}>
            Live session signals are off — the board is missing its race columns. Run the second
            half of supabase/leaderboard.sql to turn them on. Rankings are unaffected.
          </p>
        )}
      </section>

      <RaceChat userId={user.id} displayName={prefs.displayName} raceDate={race.race.date} onOpenProfile={onOpenProfile} theme={theme} />

      {untimed > 0 && (
        <p className={`text-[12px] font-ui leading-relaxed px-1 ${muted}`}>
          {untimed.toFixed(1)}h you entered by hand today isn’t in the race. Only sessions the app
          timed count here.
        </p>
      )}

      <RaceTimeline day={race.day} theme={theme} />

      {/* ── Being told about it ──
          Off by default and asked for only here, next to the thing it is about.
          Nothing is ever sent while a session is running. */}
      <section className={`mk-rise p-6 rounded-xl border ${card}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className={`text-[15px] font-bold font-ui ${heading}`}>Race alerts</p>
            <p className={`text-[13px] font-ui mt-1 leading-relaxed ${muted}`}>
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
              className={`${btn} flex-shrink-0 px-5 py-3 ${notificationsOn ? kit.ghost : kit.primary}`}
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
          className={`${btn} px-4 py-2.5 ${muted} hover:text-[#E10600]`}
        >
          {race.loading ? 'Refreshing…' : 'Refresh'}
        </button>
        <button
          onClick={onLeave}
          className={`${btn} px-4 py-2.5 ${muted} hover:text-[#E10600]`}
        >
          Leave board
        </button>
      </div>
    </div>
  );
};

/**
 * The recap is deliberately OUTSIDE the auth branches.
 *
 * It reads only this device's own archived race day, and returns null when
 * there is none — so it can appear solely for someone who actually raced.
 * Hiding your own history behind a sign-in wall you are already past once,
 * having signed out, serves nobody.
 */
const RanksTab: React.FC<Props> = (props) => (
  <div className="space-y-6">
    <PageHeader
      dark={props.theme === 'dark'}
      title="Ranks"
      subtitle="Today’s race. Only time the app measured counts."
    />
    <RaceRecap theme={props.theme} />
    <RanksBody {...props} />
  </div>
);

export default RanksTab;
