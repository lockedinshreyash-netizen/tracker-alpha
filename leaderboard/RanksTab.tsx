import React, { useCallback, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { DailyLog, LeaderboardPrefs } from '../types';
import { BoardResult, LeaderboardRow, MAX_NAME, fetchBoard, hoursToday, validateName } from './api';

interface Props {
  user: User | null;
  logs: DailyLog[];
  prefs: LeaderboardPrefs;
  onJoin: (displayName: string) => void;
  onLeave: () => void;
  onOpenAuth: () => void;
  theme: 'dark' | 'light';
}

const RanksTab: React.FC<Props> = ({ user, logs, prefs, onJoin, onLeave, onOpenAuth, theme }) => {
  const dark = theme === 'dark';
  const [board, setBoard] = useState<BoardResult>({ rows: [], error: null });
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(prefs.displayName);

  const joined = Boolean(user && prefs.enabled);

  const load = useCallback(async () => {
    if (!joined) return;
    setLoading(true);
    setBoard(await fetchBoard());
    setLoading(false);
  }, [joined]);

  useEffect(() => { void load(); }, [load]);

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
            The daily board ranks everyone who opted in, by hours studied today. Sign in to take
            your place on it.
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
            Put your name on the board
          </h2>
          <p className={`text-[11px] font-ui mt-3 leading-relaxed ${muted}`}>
            Ranked on hours logged today. Resets every midnight, IST.
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
            Join the board
          </button>

          <p className={`text-[9px] font-ui leading-relaxed mt-5 pt-5 border-t ${dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]'} ${muted}`}>
            This publishes your display name and today's hour total to other signed-in users.
            Nothing else — not your logs, subjects, tasks or email. Leave any time and your row is
            deleted.
          </p>
        </section>
      </div>
    );
  }

  /* ── On the board ── */
  const mine = board.rows.findIndex(r => r.user_id === user.id);
  const myHours = hoursToday(logs);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className={`p-6 md:p-8 rounded-xl border ${card}`}>
        <div className="flex justify-between items-end gap-4">
          <div>
            <p className={`text-[9px] font-black uppercase tracking-[0.14em] font-ui ${muted}`}>Today's board</p>
            <p className={`text-2xl md:text-3xl num-stat mt-1 ${heading}`}>
              {mine >= 0 ? `#${mine + 1}` : '—'}
              <span className={`text-xs ml-2 font-ui font-bold ${muted}`}>
                {mine >= 0 ? `of ${board.rows.length}` : 'unranked'}
              </span>
            </p>
          </div>
          <div className="text-right">
            <p className={`text-2xl md:text-3xl num-stat ${heading}`}>{myHours.toFixed(1)}h</p>
            <p className={`text-[9px] font-bold uppercase font-ui ${muted}`}>You today</p>
          </div>
        </div>
      </section>

      {board.error && (
        <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui text-center py-3 ${muted}`}>
          {board.error}
        </p>
      )}

      <section className="space-y-2">
        {loading && !board.rows.length ? (
          <p className={`text-[10px] font-black uppercase py-8 text-center italic ${muted}`}>Loading…</p>
        ) : !board.rows.length && !board.error ? (
          <p className={`text-[10px] font-black uppercase py-8 text-center italic ${muted}`}>
            Nobody has logged an hour today. Be the first.
          </p>
        ) : (
          board.rows.map((row: LeaderboardRow, i) => {
            const isMe = row.user_id === user.id;
            return (
              <div
                key={row.user_id}
                className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${isMe
                  ? 'border-[#E10600]/40 bg-[#E10600]/[0.06]'
                  : card}`}
              >
                <span className={`num-stat text-base w-10 flex-shrink-0 ${i < 3 ? 'text-[#E10600]' : muted}`}>
                  {i + 1}
                </span>
                <span className={`flex-1 min-w-0 truncate text-sm font-bold font-ui ${isMe ? 'text-[#E10600]' : heading}`}>
                  {row.display_name}{isMe && ' (you)'}
                </span>
                <span className={`num-stat text-base ${heading}`}>{Number(row.hours).toFixed(1)}h</span>
              </div>
            );
          })
        )}
      </section>

      <div className="flex items-center justify-center gap-5 pt-2">
        <button
          onClick={() => void load()}
          disabled={loading}
          className={`text-[10px] uppercase font-bold tracking-[0.08em] font-ui disabled:opacity-40 ${muted} hover:text-[#E10600] transition-colors`}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
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
