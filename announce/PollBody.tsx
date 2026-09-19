import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Announcement, PollTally, castVote, myVote, pollResults } from './api';

interface Props {
  announcement: Announcement;
  userId: string | null;
  theme: 'dark' | 'light';
  /** Told once a vote lands, so the footer can change what it offers. */
  onVoted: () => void;
}

/* How often a live tally refreshes while somebody is looking at it.
   Deliberately a poll rather than a Realtime subscription: results are an
   AGGREGATE over a table whose rows no client may select, so Realtime — which
   applies row-level security to what it broadcasts — has nothing it is allowed
   to send. Five seconds is indistinguishable from live to a human reading a bar
   chart, costs one tiny RPC, and stops the moment the tab is hidden. */
const REFRESH_MS = 5_000;

/**
 * A poll, inside the announcement modal.
 *
 * Results are revealed AFTER voting, not before, even on a live poll. Showing a
 * running tally to somebody who has not answered yet is the bandwagon effect
 * with extra steps, and it makes the result worth less than not asking. Anyone
 * who would rather look than answer can still press "See results" — on a live
 * poll that is a legitimate thing to want, and refusing it would be pretending
 * the tally is secret when it is not.
 */
const PollBody: React.FC<Props> = ({ announcement, userId, theme, onVoted }) => {
  const dark = theme === 'dark';
  const live = announcement.poll_visibility === 'live';

  const [chosen, setChosen] = useState<string | null>(null);
  const [tally, setTally] = useState<PollTally[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peeking, setPeeking] = useState(false);

  /* Guards a refresh that resolves after the modal has moved to the next
     announcement in the queue. */
  /* Set on mount, not just cleared on unmount. React StrictMode mounts, tears
     down and remounts every effect in development — the teardown flips this to
     false and a `useRef(true)` initialiser never runs again, so without the
     assignment here every async result is discarded as stale and the component
     hangs in its busy state. The same thing happens in production on any real
     remount. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  const loadTally = useCallback(async () => {
    if (!live) return;
    try {
      const rows = await pollResults(announcement.id);
      if (alive.current) setTally(rows);
    } catch {
      /* A refused or failed tally is not worth an error on a poll the user has
         already answered — the vote is what mattered and it landed. */
    }
  }, [announcement.id, live]);

  /* What this user already picked, if anything. Their own row is the only one
     row-level security will hand back. */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    myVote(announcement.id, userId).then(v => {
      if (cancelled || !alive.current) return;
      if (v) { setChosen(v); void loadTally(); }
    });
    return () => { cancelled = true; };
  }, [announcement.id, userId, loadTally]);

  /* The live half of "live". Only while results are actually on screen, and
     never while the tab is hidden — a background interval hitting the database
     every five seconds for a chart nobody is looking at is just a bill. */
  const showing = live && (chosen !== null || peeking);
  useEffect(() => {
    if (!showing) return;
    const tick = () => { if (document.visibilityState === 'visible') void loadTally(); };
    const id = window.setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [showing, loadTally]);

  const vote = async (optionId: string) => {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);

    const ok = await castVote(announcement.id, userId, optionId);

    if (!alive.current) return;
    setBusy(false);
    if (!ok) {
      setError('Could not record that. Check your connection and try again.');
      return;
    }
    setChosen(optionId);
    onVoted();
    void loadTally();
  };

  const total = tally?.reduce((n, t) => n + t.votes, 0) ?? 0;
  const muted = dark ? 'text-zinc-500' : 'text-zinc-500';

  if (!userId) {
    return (
      <p className={`text-[12px] font-ui ${muted}`}>Sign in to vote.</p>
    );
  }

  return (
    <div className="space-y-2">
      {announcement.options.map(option => {
        const row = tally?.find(t => t.optionId === option.id);
        const votes = row?.votes ?? 0;
        /* Zero total renders as zero width rather than NaN. */
        const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
        const mine = chosen === option.id;

        /* Before a vote these are buttons; after one they are bars. Same order,
           same labels, same position on screen — the row the user pressed is
           the row that fills, which is the whole point of not re-laying it
           out. */
        if (showing) {
          return (
            <div
              key={option.id}
              className={`relative overflow-hidden rounded-lg border px-3.5 py-2.5 ${dark ? 'border-white/[0.08]' : 'border-[#E3E0D9]'}`}
            >
              <div
                className="absolute inset-y-0 left-0 transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  background: mine ? 'rgba(225,6,0,0.22)' : dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                }}
                aria-hidden="true"
              />
              <div className="relative flex items-center gap-2">
                <span className={`flex-1 min-w-0 text-[12.5px] font-ui truncate ${mine ? 'font-bold' : ''} ${dark ? 'text-zinc-200' : 'text-[#17150F]'}`}>
                  {option.label}
                  {mine && <span className="ml-2 text-[9px] font-bold uppercase tracking-[0.08em] text-[#E10600]">Yours</span>}
                </span>
                <span className={`text-[11px] font-bold font-ui tabular-nums ${muted}`}>{pct}%</span>
              </div>
            </div>
          );
        }

        return (
          <button
            key={option.id}
            onClick={() => vote(option.id)}
            disabled={busy}
            className={`w-full text-left px-3.5 py-2.5 rounded-lg border text-[12.5px] font-ui transition-all active:scale-97 disabled:opacity-50 ${dark
              ? 'bg-[#0D0D10] border-white/[0.08] text-zinc-200 hover:border-white/[0.18]'
              : 'bg-[#F7F6F3] border-[#E3E0D9] text-[#17150F] hover:border-[#D6D1C5]'}`}
          >
            {option.label}
          </button>
        );
      })}

      {error && <p className="text-[11px] font-bold font-ui text-[#E10600]">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <p className={`text-[10px] font-ui ${muted}`}>
          {showing
            ? `${total} ${total === 1 ? 'vote' : 'votes'}${live ? ' · updating live' : ''}`
            : live
              ? 'Results are shown once you answer.'
              : 'Results are private — only the LOCK IN team sees them.'}
        </p>

        {/* Only on a live poll, and only before answering. A private poll has
            nothing to peek at, and after voting the results are already up. */}
        {live && !showing && (
          <button
            onClick={() => { setPeeking(true); void loadTally(); }}
            className={`ml-auto text-[10px] font-bold uppercase tracking-[0.08em] font-ui transition-colors ${muted} hover:text-[#E10600]`}
          >
            See results
          </button>
        )}
      </div>
    </div>
  );
};

export default PollBody;
