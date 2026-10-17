/* ── The nudge engine, while the app is open ──
   Mounted at App root beside useReminders, for the reason that hook gives: an
   engine inside a tab stops existing when the student opens another tab.

   When a slot comes due it is said here (toast if the tab is visible, a system
   notification if it is hidden) and its key is written to `prefs.nudged`. That
   write is what withdraws the server's copy: the publisher leaves said keys
   out, and the server only sends PUSH_LAG_MS after the slot, by which time an
   open app has already reconciled the row away. Same arrangement deadlines use.

   Gate 1 holds here too: a nudge due while a session is running is marked as
   handled and never said. Telling somebody to study while they are studying is
   the app interrupting the thing it exists for. */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyLog, ReminderPrefs } from '../types';
import { deliver } from '../notify/deliver';
import { dueNudge } from './nudges';
import { nudgePlan } from './nudgeState';

const MAX_TIMEOUT_MS = 6 * 3_600_000;

interface Options {
  logs: DailyLog[];
  goalHours: number;
  prefs: ReminderPrefs;
  /** Live values, so a fire never acts on a stale render. */
  read: () => { logs: DailyLog[]; goalHours: number; prefs: ReminderPrefs };
  /** Record keys as said (or deliberately not said). One AppState write. */
  commit: (keys: string[]) => void;
  /** False until the initial cloud pull lands, so `nudged` is the synced one. */
  ready: boolean;
  busy: boolean;
}

export const useNudges = ({ logs, goalHours, prefs, read, commit, ready, busy }: Options): void => {
  const readRef = useRef(read);
  const commitRef = useRef(commit);
  const busyRef = useRef(busy);
  const readyRef = useRef(ready);
  useEffect(() => { readRef.current = read; }, [read]);
  useEffect(() => { commitRef.current = commit; }, [commit]);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => { readyRef.current = ready; }, [ready]);

  /* Keys acted on in this session, ahead of the AppState write landing. */
  const local = useRef(new Set<string>());
  const [pass, setPass] = useState(0);

  const scan = useCallback(() => {
    if (!readyRef.current) return;
    const live = readRef.current();
    if (!live.prefs.nudge) return;
    const now = Date.now();
    const handled = new Set([...(live.prefs.nudged ?? []), ...local.current]);
    const { fire, skip } = dueNudge(nudgePlan(live.logs, live.goalHours, live.prefs, now, true), handled, now);
    const keys = [...skip.map(n => n.key), ...(fire ? [fire.key] : [])];
    if (!keys.length) return;
    for (const k of keys) local.current.add(k);
    commitRef.current(keys);
    if (fire && !busyRef.current) {
      void deliver({
        channel: 'nudge',
        key: fire.key,
        icon: fire.kind === 'last' ? '🔥' : '⏱️',
        copy: fire.copy,
      });
    }
    setPass(p => p + 1);
  }, []);

  useEffect(() => {
    if (!ready || !prefs.nudge) return;
    scan();
    const now = Date.now();
    const next = nudgePlan(logs, goalHours, prefs, now).find(n => n.at > now);
    const timeout = next
      ? window.setTimeout(scan, Math.min(next.at - now + 500, MAX_TIMEOUT_MS))
      : undefined;
    const onWake = () => { if (document.visibilityState === 'visible') scan(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', scan);
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', scan);
    };
  }, [ready, prefs, logs, goalHours, scan, pass]);
};
