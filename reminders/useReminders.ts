/* ── The reminder engine ──
   Mounted once at the top of App.tsx, beside usePomodoro, for the reason that
   hook's own doc comment gives: an engine living inside a tab component stops
   existing the moment the user opens another tab, and nothing is left watching
   the clock. A deadline has to be able to fire while the user is on Streak, on
   Ranks, or on no tab they are looking at.

   Everything is derived from the wall clock. Nothing counts down, so a
   throttled tab, a slept laptop or a reload changes how often the scan runs and
   nothing else — the answer only ever depends on `now`. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ReminderPrefs, ScheduleBlock, Task } from '../types';
import { getISTDateString } from '../utils';
import { deliver } from '../notify/deliver';
import {
  BLOCK_LEAD_MINS, MAX_BURST, PendingFire, blockCopy, blockFireKey, burstCopy, fireCopy, scanDue,
} from './reminders';
import { blockTitle, countsAsStudy } from '../schedule/colors';
import { istInstant } from '../utils';

/* Long, because this interval would otherwise run for the entire life of the
   app. A deadline resolves to the minute; twelve wake-ups a minute buys nothing
   and costs a timer on a phone that is trying to sleep. usePomodoro can afford
   5s because a phase is a bounded event; this is ambient. */
const SAFETY_INTERVAL_MS = 30_000;

/* setTimeout is clamped to about 24 days, and a deadline can be further out
   than that. Anything beyond this horizon is left to the safety interval and to
   the next time the app is opened. */
const MAX_TIMEOUT_MS = 6 * 3_600_000;

/* How close a deadline has to be before the safety interval is worth running. */
const IMMINENT_MS = 60 * 60_000;

interface Options {
  tasks: Task[];
  prefs: ReminderPrefs;
  /** Today's materialized plan, for the block channel. */
  blocks: ScheduleBlock[];
  /** Live state, so a fire never acts on a stale render. */
  read: () => { tasks: Task[]; prefs: ReminderPrefs; blocks: ScheduleBlock[] };
  /** One atomic write per fire: the task's remindedKey. */
  commit: (taskId: string, remindedKey: string) => void;
  /* False until the initial cloud pull lands. A pull replaces `tasks`
     wholesale, so a remindedKey written before then is thrown away and the
     reminder fires a second time — the one duplicate the user must never see.
     An overdue reminder waiting a few seconds longer is not going anywhere. */
  ready: boolean;
  /** A session is running. Gate 1: focus is the product. */
  busy: boolean;
}

export const useReminders = ({ tasks, prefs, blocks, read, commit, ready, busy }: Options): void => {
  const readRef = useRef(read);
  const commitRef = useRef(commit);
  const readyRef = useRef(ready);
  const busyRef = useRef(busy);
  useEffect(() => { readRef.current = read; }, [read]);
  useEffect(() => { commitRef.current = commit; }, [commit]);
  useEffect(() => { readyRef.current = ready; }, [ready]);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  /* Fires are settled once each, no matter how many watchers notice. The
     timeout, the safety interval, the visibility handler and the mount pass all
     race to call this the moment a deadline comes due. Guarded per key rather
     than per task, so moving a deadline correctly re-arms it. */
  const settled = useRef(new Set<string>());

  /* Only exists to give the scheduling effect something to depend on, so a fire
     can re-arm the next timeout without the effect closing over stale state. */
  const [pass, setPass] = useState(0);

  const scan = useCallback(() => {
    if (!readyRef.current) return;
    const { tasks: liveTasks, prefs: livePrefs, blocks: liveBlocks } = readRef.current();
    if (!livePrefs.enabled) return;

    const now = Date.now();
    const result = scanDue(liveTasks, livePrefs, now);

    /* Bounded by the live task list, so it cannot grow across a long session. */
    if (settled.current.size > liveTasks.length * 2 + 16) {
      const live = new Set(liveTasks.map(t => t.id));
      for (const key of settled.current) {
        if (!live.has(key.split('@')[0])) settled.current.delete(key);
      }
    }

    /* Silently marked, never shown. The user finds out from the card, which
       reads OVERDUE — that is where a missed deadline belongs. */
    for (const stale of result.drop) {
      if (settled.current.has(stale.key)) continue;
      settled.current.add(stale.key);
      commitRef.current(stale.task.id, stale.key);
    }

    const fresh = result.fire.filter(f => !settled.current.has(f.key));
    if (fresh.length) {
      /* Marked before delivering, not after: `deliver` is async, and two
         watchers reaching this line in the same tick would both pass the filter
         above if the marking waited for the await. */
      for (const f of fresh) {
        settled.current.add(f.key);
        commitRef.current(f.task.id, f.key);
      }

      if (fresh.length > MAX_BURST) {
        void deliver({
          channel: 'reminder',
          key: fresh[0].key,
          icon: '⏳',
          copy: burstCopy(fresh),
          data: { taskId: fresh[0].task.id },
        });
      } else {
        for (const f of fresh) {
          void deliver({
            channel: 'reminder',
            key: f.key,
            icon: '⏳',
            copy: fireCopy(f, livePrefs, now),
            data: { taskId: f.task.id },
          });
        }
      }
    }

    /* ── The plan channel ──
       Derived from the day's blocks on every pass rather than stored: a block
       can be moved, deleted, or exist only as a materialized rule instance, and
       anything written down would go stale on all three.

       Suppressed while a session is running — gate 1. Telling somebody their
       next block is coming while they are inside the current one is the app
       interrupting the exact thing it exists to protect. */
    if (livePrefs.planBlocks && !busyRef.current) {
      const today = getISTDateString();
      for (const block of liveBlocks) {
        const at = istInstant(today, block.start) - BLOCK_LEAD_MINS * 60_000;
        if (at > now || now - at > 15 * 60_000) continue;
        const key = blockFireKey(block, at);
        if (settled.current.has(key)) continue;
        settled.current.add(key);
        void deliver({
          channel: 'plan',
          key,
          icon: countsAsStudy(block.kind) ? '📘' : '📍',
          copy: blockCopy(block, blockTitle(block)),
        });
      }
    }

    /* Wake the scheduling effect so it arms the next timeout against the new
       `nextAt`. Only when something actually happened — a pass that found
       nothing due leaves the existing timeout alone. */
    if (fresh.length || result.drop.length) setPass(p => p + 1);
  }, []);

  /* One timeout for the whole board, armed at the earliest pending instant —
     not one per task. Two hundred dated tasks would be two hundred timers the
     browser clamps anyway, and the earliest one waking is enough to re-scan.

     When nothing is armed there is no timeout AND no interval: a user with no
     deadlines pays nothing at all for this feature. */
  useEffect(() => {
    if (!ready || !prefs.enabled) return;

    scan();

    const now = Date.now();
    const { nextAt } = scanDue(tasks, prefs, now);
    const watchingBlocks = prefs.planBlocks && blocks.length > 0;
    if (nextAt === null && !watchingBlocks) return;

    let timeout: number | undefined;
    if (nextAt !== null) {
      timeout = window.setTimeout(scan, Math.max(0, Math.min(nextAt - now, MAX_TIMEOUT_MS)));
    }

    /* The safety interval only runs when something is actually near. A user
       whose next deadline is in December does not need a timer firing twice a
       minute until then — the timeout above (clamped to six hours) and the
       wake handlers below already cover every way that deadline can arrive.
       Arming it regardless would be an always-on cost for a feature that has
       nothing to do. */
    const near = (nextAt !== null && nextAt - now < IMMINENT_MS) || watchingBlocks;
    const interval = near ? window.setInterval(scan, SAFETY_INTERVAL_MS) : undefined;

    /* A device that slept through the timeout fires neither it nor the
       interval, so coming back has to re-scan. This is also the entire
       catch-up-on-reopen path — there is no separate code for it, only the same
       scan run against a `now` that has moved. */
    const onWake = () => { if (document.visibilityState === 'visible') scan(); };
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', scan);
    window.addEventListener('pageshow', scan);

    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      if (interval !== undefined) window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', scan);
      window.removeEventListener('pageshow', scan);
    };
  }, [ready, prefs, tasks, blocks, scan, pass]);
};
