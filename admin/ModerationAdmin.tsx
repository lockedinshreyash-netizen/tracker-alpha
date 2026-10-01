import React, { useCallback, useEffect, useState } from 'react';
import { LeaderboardRow, fetchBoard } from '../leaderboard/api';
import { getISTDateString } from '../utils';
import RemoveForm from '../moderation/RemoveForm';
import HideForm, { formatUntil } from '../moderation/HideForm';
import {
  LeaderboardBan,
  LeaderboardHide,
  fetchLeaderboardBans,
  fetchLeaderboardHides,
  humanError,
  staffHideFromLeaderboard,
  staffRemoveFromLeaderboard,
  staffUnbanLeaderboard,
  staffUnhideLeaderboard,
} from '../moderation/api';

interface Props {
  adminId: string;
  theme: 'dark' | 'light';
}

/** Which form is open, on which row. */
type Acting = { userId: string; mode: 'remove' | 'hide' } | null;

/**
 * Taking someone off the race, and letting them back on.
 *
 * Two different tools. Remove tells the person, with your reason, and turns
 * their race off. Hide tells nobody: for a set time the person drops out of
 * everyone else's board and race chat while their own screen stays exactly
 * as it was. A hidden racer is therefore missing from "Today's race" below —
 * staff read the board through the same policies as everyone — and is listed
 * under "Hidden" instead.
 *
 * Groups are not moderated from here. A public group's roster is reached from
 * its own Explore sheet, beside the takedown button already there, and a
 * private group is its own admins' to run — staff cannot see inside one.
 */
const ModerationAdmin: React.FC<Props> = ({ adminId, theme }) => {
  const dark = theme === 'dark';
  const [board, setBoard] = useState<LeaderboardRow[] | null>(null);
  const [bans, setBans] = useState<LeaderboardBan[] | null>(null);
  const [hides, setHides] = useState<LeaderboardHide[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [acting, setActing] = useState<Acting>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await fetchBoard();
    setBoard(result.rows);
    if (result.error) setError(result.error);
    try {
      const [b, h] = await Promise.all([fetchLeaderboardBans(), fetchLeaderboardHides()]);
      setBans(b);
      setHides(h);
    } catch (e) {
      setBans(prev => prev ?? []);
      setHides(prev => prev ?? []);
      setError(humanError(e));
    }
  }, []);

  const unhide = async (hide: LeaderboardHide) => {
    setBusy(hide.user_id);
    setError(null);
    setNote(null);
    try {
      await staffUnhideLeaderboard(hide.user_id);
      setNote(`${hide.display_name ?? 'They'} ${hide.display_name ? 'is' : 'are'} visible on the board again.`);
      await load();
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  };

  useEffect(() => { void load(); }, [load]);

  const unban = async (ban: LeaderboardBan) => {
    setBusy(ban.user_id);
    setError(null);
    setNote(null);
    try {
      await staffUnbanLeaderboard(ban.user_id);
      setNote(`${ban.display_name ?? 'They'} can join the race again.`);
      await load();
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  };

  const card = `p-6 md:p-8 rounded-xl border ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`;
  const eyebrow = `text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`;
  const ink = dark ? 'text-white' : 'text-zinc-900';
  const muted = dark ? 'text-zinc-500' : 'text-zinc-400';
  const row = `px-4 py-3 rounded-xl border ${dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-[#F7F6F3] border-zinc-200'}`;
  const smallBtn = `shrink-0 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] rounded-md border transition-colors active:scale-97 font-ui disabled:opacity-50 ${dark ? 'border-white/[0.12] text-zinc-500 hover:text-red-500' : 'border-zinc-200 text-zinc-500 hover:text-red-500'}`;

  return (
    <div className="space-y-6">
      {error && <p className="text-[11px] font-bold font-ui text-[#E10600]">{error}</p>}
      {note && <p className={`text-[11px] font-bold font-ui ${muted}`}>{note}</p>}

      <section className={card}>
        <div className="flex items-baseline justify-between gap-4">
          <p className={eyebrow}>Today’s race</p>
          <button onClick={() => void load()} className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${muted} hover:text-[#E10600]`}>
            Refresh
          </button>
        </div>
        <p className={`text-[11px] font-ui mt-1 ${muted}`}>
          Remove takes someone off the board and tells them why. Hide takes them off everyone else’s board for a while and tells them nothing.
        </p>

        <div className="mt-5 space-y-2">
          {board === null && <p className={`text-[11px] font-ui ${muted}`}>Loading…</p>}
          {board?.length === 0 && <p className={`text-[11px] font-ui ${muted}`}>Nobody is on today’s board.</p>}
          {board?.map((r, i) => (
            <div key={r.user_id} className={row}>
              <div className="flex items-center gap-3">
                <span className={`w-5 text-right text-[11px] font-ui tabular-nums ${muted}`}>{i + 1}</span>
                <span className={`flex-1 min-w-0 text-[12.5px] font-ui truncate ${ink}`}>
                  {r.display_name}
                  {r.user_id === adminId && <span className={`ml-2 text-[10px] font-bold uppercase tracking-[0.06em] ${muted}`}>you</span>}
                </span>
                <span className={`text-[12px] font-ui tabular-nums ${ink}`}>{Number(r.hours).toFixed(1)}h</span>
                {r.user_id !== adminId && acting?.userId !== r.user_id && (
                  <>
                    <button onClick={() => { setActing({ userId: r.user_id, mode: 'hide' }); setNote(null); }} className={smallBtn}>
                      Hide…
                    </button>
                    <button onClick={() => { setActing({ userId: r.user_id, mode: 'remove' }); setNote(null); }} className={smallBtn}>
                      Remove…
                    </button>
                  </>
                )}
              </div>
              {acting?.userId === r.user_id && acting.mode === 'hide' && (
                <HideForm
                  name={r.display_name}
                  dark={dark}
                  onCancel={() => setActing(null)}
                  onConfirm={async (until, staffNote) => {
                    try {
                      await staffHideFromLeaderboard(r.user_id, until, staffNote);
                    } catch (e) {
                      throw new Error(humanError(e));
                    }
                    setActing(null);
                    setNote(`${r.display_name} is hidden until ${formatUntil(until)}.`);
                    await load();
                  }}
                />
              )}
              {acting?.userId === r.user_id && acting.mode === 'remove' && (
                <RemoveForm
                  name={r.display_name}
                  from="race"
                  banMeans="They can’t rejoin the race or post in its chat until you unban them here."
                  dark={dark}
                  onCancel={() => setActing(null)}
                  onConfirm={async (reason, ban) => {
                    try {
                      await staffRemoveFromLeaderboard(r.user_id, getISTDateString(), ban, reason);
                    } catch (e) {
                      throw new Error(humanError(e));
                    }
                    setActing(null);
                    setNote(`${r.display_name} ${ban ? 'is banned from' : 'was removed from'} the race.`);
                    await load();
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className={card}>
        <p className={eyebrow}>Hidden from the race</p>
        <p className={`text-[11px] font-ui mt-1 ${muted}`}>
          They don’t know. Each hide ends by itself at the time shown.
        </p>
        <div className="mt-5 space-y-2">
          {hides === null && <p className={`text-[11px] font-ui ${muted}`}>Loading…</p>}
          {hides?.length === 0 && <p className={`text-[11px] font-ui ${muted}`}>Nobody is hidden.</p>}
          {hides?.map(h => (
            <div key={h.user_id} className={`${row} flex items-start gap-3`}>
              <div className="flex-1 min-w-0">
                <p className={`text-[12.5px] font-ui truncate ${ink}`}>{h.display_name ?? 'Unknown racer'}</p>
                <p className={`text-[11px] font-ui mt-0.5 break-words ${muted}`}>
                  Until {formatUntil(h.hidden_until)}{h.note ? ` · ${h.note}` : ''}
                </p>
              </div>
              <button onClick={() => void unhide(h)} disabled={busy === h.user_id} className={smallBtn}>
                Unhide
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className={card}>
        <p className={eyebrow}>Banned from the race</p>
        <div className="mt-5 space-y-2">
          {bans === null && <p className={`text-[11px] font-ui ${muted}`}>Loading…</p>}
          {bans?.length === 0 && <p className={`text-[11px] font-ui ${muted}`}>Nobody is banned.</p>}
          {bans?.map(b => (
            <div key={b.user_id} className={`${row} flex items-start gap-3`}>
              <div className="flex-1 min-w-0">
                <p className={`text-[12.5px] font-ui truncate ${ink}`}>{b.display_name ?? 'Unknown racer'}</p>
                <p className={`text-[11px] font-ui mt-0.5 break-words ${muted}`}>
                  {new Date(b.blocked_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  {b.reason ? ` · ${b.reason}` : ' · No reason given'}
                </p>
              </div>
              <button onClick={() => void unban(b)} disabled={busy === b.user_id} className={smallBtn}>
                Unban
              </button>
            </div>
          ))}
        </div>
      </section>

      <p className={`text-[11px] font-ui leading-relaxed px-1 ${muted}`}>
        To remove someone from a public group, open the group from Groups → Explore. Private groups are run by their own admins.
      </p>
    </div>
  );
};

export default ModerationAdmin;
