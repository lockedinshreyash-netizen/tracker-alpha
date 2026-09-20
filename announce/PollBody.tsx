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

const CheckGlyph: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * A poll, inside the announcement modal.
 *
 * ── The distinction this component is built on ──
 *
 * "Has answered" and "can see the tally" are TWO different states, and the
 * first version treated them as one: the answered view was gated on the poll
 * being `live`, so voting in a PRIVATE poll changed nothing on screen at all.
 * The vote was recorded, the row was in the database, and the student was
 * looking at exactly the same four buttons they had just pressed. A write with
 * no acknowledgement is indistinguishable from a broken button, and the
 * rational response is to press it again.
 *
 * So there are three views per option, and only the last is about visibility:
 *   1. not answered      → a button
 *   2. answered          → a locked row, the choice marked "Yours"
 *   3. answered AND live AND the tally has arrived → a bar
 *
 * Every poll therefore confirms. Only a live one explains.
 *
 * Results are still revealed AFTER voting, not before — a running tally shown
 * to somebody who has not answered is the bandwagon effect, and it makes the
 * answer worth less than not asking. Anyone who would rather look than answer
 * can press "See results" on a live poll, because refusing that would be
 * pretending the tally is secret when it is not.
 */
const PollBody: React.FC<Props> = ({ announcement, userId, theme, onVoted }) => {
  const dark = theme === 'dark';
  const live = announcement.poll_visibility === 'live';

  const [chosen, setChosen] = useState<string | null>(null);
  const [tally, setTally] = useState<PollTally[] | null>(null);
  /* The option currently being written, so the row the finger is on can say so
     on its own rather than every row greying out together. */
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [peeking, setPeeking] = useState(false);
  /* Re-opens the buttons after an answer, for a mis-tap. The database supports
     it — one row per (poll, user), so changing your mind is an UPDATE of the
     row you already own — and a poll you cannot correct on a phone is a poll
     whose first accidental tap is final. */
  const [changing, setChanging] = useState(false);

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
         already answered — the vote is what mattered and it landed. The
         answered view below does not depend on this having succeeded. */
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

  const answered = chosen !== null;
  /* Bars need three things: a live poll, a reason to show them, and numbers to
     draw. Without the last one the old code drew every option at 0% and called
     it a result — a chart that contradicts the vote just cast. */
  const showBars = live && (answered || peeking) && tally !== null;
  /* The locked, answered-but-no-chart view. Also covers a live poll whose tally
     has not landed yet or was refused. */
  const showLocked = answered && !changing && !showBars;

  useEffect(() => {
    if (!showBars) return;
    const tick = () => { if (document.visibilityState === 'visible') void loadTally(); };
    const id = window.setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [showBars, loadTally]);

  const vote = async (optionId: string) => {
    if (!userId || pending) return;
    /* Marked before the request, so the tap is acknowledged on the row that was
       pressed in the same frame rather than after a round trip. On a phone that
       gap is the whole difference between "submitted" and "broken". */
    setPending(optionId);
    setError(null);

    const ok = await castVote(announcement.id, userId, optionId);

    if (!alive.current) return;
    setPending(null);
    if (!ok) {
      setError('Could not record that. Check your connection and try again.');
      return;
    }
    setChosen(optionId);
    setChanging(false);
    onVoted();
    void loadTally();
  };

  const total = tally?.reduce((n, t) => n + t.votes, 0) ?? 0;
  const muted = dark ? 'text-zinc-500' : 'text-zinc-500';
  const rowBase = 'w-full text-left px-3.5 py-2.5 rounded-lg border text-[12.5px] font-ui';

  if (!userId) {
    return <p className={`text-[12px] font-ui ${muted}`}>Sign in to vote.</p>;
  }

  return (
    <div className="space-y-2">
      {announcement.options.map(option => {
        const row = tally?.find(t => t.optionId === option.id);
        const votes = row?.votes ?? 0;
        const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
        const mine = chosen === option.id;
        const saving = pending === option.id;

        /* ── 3. Answered, live, numbers in hand ── */
        if (showBars) {
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

        /* ── 2. Answered, no chart to show ──
           The confirmation a private poll never had. Not a button: it is the
           record of a decision already taken, and something that still looks
           pressable invites the second press. */
        if (showLocked) {
          return (
            <div
              key={option.id}
              className={`${rowBase} flex items-center gap-2 ${mine
                ? 'border-[#E10600]/45 ' + (dark ? 'bg-[#E10600]/[0.10] text-white' : 'bg-[#E10600]/[0.06] text-[#17150F]')
                : (dark ? 'border-white/[0.06] text-zinc-600' : 'border-[#E3E0D9] text-[#A8A396]')}`}
            >
              <span className="flex-1 min-w-0 truncate">{option.label}</span>
              {mine && (
                <span className="flex items-center gap-1.5 text-[#E10600] flex-shrink-0">
                  <CheckGlyph />
                  <span className="text-[9px] font-bold uppercase tracking-[0.08em]">Yours</span>
                </span>
              )}
            </div>
          );
        }

        /* ── 1. Not answered yet ── */
        return (
          <button
            key={option.id}
            onClick={() => vote(option.id)}
            disabled={pending !== null}
            aria-pressed={mine}
            className={`${rowBase} flex items-center gap-2 transition-all active:scale-97 disabled:cursor-default ${mine
              ? 'border-[#E10600]/45 ' + (dark ? 'bg-[#E10600]/[0.10] text-white' : 'bg-[#E10600]/[0.06] text-[#17150F]')
              : dark
                ? 'bg-[#0D0D10] border-white/[0.08] text-zinc-200 hover:border-white/[0.18]'
                : 'bg-[#F7F6F3] border-[#E3E0D9] text-[#17150F] hover:border-[#D6D1C5]'} ${pending && !saving ? 'opacity-40' : ''}`}
          >
            <span className="flex-1 min-w-0 truncate">{option.label}</span>
            {saving && (
              <span className={`text-[9px] font-bold uppercase tracking-[0.08em] flex-shrink-0 ${muted}`}>
                Saving…
              </span>
            )}
            {!saving && mine && (
              <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#E10600] flex-shrink-0">
                Current
              </span>
            )}
          </button>
        );
      })}

      {error && <p className="text-[11px] font-bold font-ui text-[#E10600]">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <p className={`text-[10px] font-ui ${muted}`}>
          {showBars
            ? `${total} ${total === 1 ? 'vote' : 'votes'} · updating live`
            : changing
              ? 'Pick a different answer.'
              : answered
                ? <><span className="font-bold text-[#E10600]">Answer recorded.</span>{live ? ' Loading results…' : ' Results are private — only the LOCK IN team sees them.'}</>
                : live
                  ? 'Results are shown once you answer.'
                  : 'Results are private — only the LOCK IN team sees them.'}
        </p>

        {/* Peek, before answering, on a live poll only. */}
        {live && !answered && !peeking && (
          <button
            onClick={() => { setPeeking(true); void loadTally(); }}
            className={`ml-auto text-[10px] font-bold uppercase tracking-[0.08em] font-ui transition-colors ${muted} hover:text-[#E10600]`}
          >
            See results
          </button>
        )}

        {/* Recovering a mis-tap. Only once there is something to change. */}
        {answered && !changing && (
          <button
            onClick={() => setChanging(true)}
            className={`ml-auto text-[10px] font-bold uppercase tracking-[0.08em] font-ui transition-colors ${muted} hover:text-[#E10600]`}
          >
            Change
          </button>
        )}
        {changing && (
          <button
            onClick={() => setChanging(false)}
            className={`ml-auto text-[10px] font-bold uppercase tracking-[0.08em] font-ui transition-colors ${muted} hover:text-[#E10600]`}
          >
            Keep mine
          </button>
        )}
      </div>
    </div>
  );
};

export default PollBody;
