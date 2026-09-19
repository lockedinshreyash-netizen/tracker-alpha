import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PollTally, pollResults } from '../announce/api';
import { humanError } from '../feedback/api';

interface Props {
  announcementId: string;
  /** A live poll refreshes itself here too, exactly as it does for students. */
  live: boolean;
  theme: 'dark' | 'light';
}

const REFRESH_MS = 5_000;

/**
 * The tally, in the console.
 *
 * Administrators see this for every poll, private or live — that is what
 * "private" means: the result is for staff and nobody else. What no one sees,
 * here or anywhere, is an individual vote. `poll_results` returns counts, the
 * votes table refuses a SELECT to every client including this one, and there is
 * deliberately no endpoint that would join a person to an answer.
 */
const PollResults: React.FC<Props> = ({ announcementId, live, theme }) => {
  const dark = theme === 'dark';
  const [rows, setRows] = useState<PollTally[] | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  const load = useCallback(async () => {
    try {
      const data = await pollResults(announcementId);
      if (alive.current) { setRows(data); setError(null); }
    } catch (e) {
      if (alive.current) { setRows([]); setError(humanError(e)); }
    }
  }, [announcementId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!live) return;
    const tick = () => { if (document.visibilityState === 'visible') void load(); };
    const id = window.setInterval(tick, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [live, load]);

  const total = rows?.reduce((n, r) => n + r.votes, 0) ?? 0;
  const muted = dark ? 'text-zinc-500' : 'text-zinc-400';
  const top = rows?.length ? Math.max(...rows.map(r => r.votes)) : 0;

  return (
    <div className={`mt-3 pt-3 border-t ${dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]'}`}>
      {error && <p className="text-[11px] font-bold font-ui text-[#E10600]">{error}</p>}
      {rows === null && !error && <p className={`text-[11px] font-ui ${muted}`}>Loading…</p>}

      {rows?.length === 0 && !error && (
        <p className={`text-[11px] font-ui ${muted}`}>No options on this poll.</p>
      )}

      <div className="space-y-1.5">
        {rows?.map(r => {
          const pct = total > 0 ? Math.round((r.votes / total) * 100) : 0;
          /* The leader is marked rather than re-sorted: the rows stay in the
             order the poll asked them, so a refresh cannot make the list jump
             under the cursor while somebody is reading it. */
          const leading = total > 0 && r.votes === top;
          return (
            <div
              key={r.optionId}
              className={`relative overflow-hidden rounded-md border px-3 py-2 ${dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]'}`}
            >
              <div
                className="absolute inset-y-0 left-0 transition-[width] duration-500"
                style={{
                  width: `${pct}%`,
                  background: leading ? 'rgba(225,6,0,0.18)' : dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                }}
                aria-hidden="true"
              />
              <div className="relative flex items-center gap-2">
                <span className={`flex-1 min-w-0 text-[12px] font-ui truncate ${dark ? 'text-zinc-200' : 'text-[#17150F]'}`}>
                  {r.label}
                </span>
                <span className={`text-[11px] font-ui tabular-nums ${muted}`}>
                  {r.votes} · {pct}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {rows !== null && !error && (
        <p className={`mt-2 text-[10px] font-ui ${muted}`}>
          {total} {total === 1 ? 'vote' : 'votes'}
          {live ? ' · refreshing every 5s' : ' · private to admins'}
          {' · no individual vote is recorded against a person'}
        </p>
      )}
    </div>
  );
};

export default PollResults;
