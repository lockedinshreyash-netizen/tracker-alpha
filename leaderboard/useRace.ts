/* ── The engine, wired up ──
   One hook, mounted once at the top of the app rather than inside the Ranks
   tab, because the race does not stop when the user looks at something else:
   places change while they are on the Today tab, and the notification about it
   has to fire from wherever they are.

   What it owns:
     · polling the board, at a rate that follows the user's attention
     · publishing this device's row, including whether a session is running
     · folding each observation into the day's record (raceDay.ts)
     · deciding whether anything that fell out is worth saying (notify.ts)

   Everything it produces is derived state — no component recomputes a gap. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { AppState } from '../types';
import { getISTDateString } from '../utils';
import { servedMs } from '../today/pomodoro';
import { ActivitySignal, LeaderboardRow, fetchBoard, hoursToday, isRanked, publishEntry } from './api';
import { RaceState, buildRaceState, minutesOf } from './engine';
import { RaceDay, RaceEvent, advanceRaceDay, loadRaceDay, priorityOf, saveRaceDay } from './raceDay';
import { RaceStatus, raceStatus } from './messages';
import {
  Announcement,
  PermissionState,
  loadNotifyMemory,
  notificationPermission,
  requestNotificationPermission,
  saveNotifyMemory,
  selectAnnouncement,
  sendSystemNotification,
} from './notify';

/* Poll rates. Watching the board is the fastest, because the user is staring
   at numbers they expect to move. A backgrounded tab still polls — that is the
   case the notifications exist for — just slowly. */
const POLL_WATCHING_MS = 25_000;
const POLL_VISIBLE_MS = 60_000;
const POLL_HIDDEN_MS = 120_000;

/** Floor between two writes of this device's row, however often it polls. */
const PUBLISH_MIN_GAP_MS = 55_000;

/** Only these events interrupt with an on-screen announcement. */
const TOAST_PRIORITY = 70;
const TOAST_MS = 9_000;

/** How many race control cards sit above the board. */
const FEED_SIZE = 3;

export interface RaceView {
  race: RaceState;
  status: RaceStatus;
  day: RaceDay;
  /** Most recent events, newest first — the race control cards. */
  feed: RaceEvent[];
  /** A single event worth interrupting for, until dismissed. */
  toast: RaceEvent | null;
  dismissToast: () => void;
  loading: boolean;
  error: string | null;
  /** The board is missing its activity columns — see fetchBoard. */
  degraded: boolean;
  lastFetchedAt: number | null;
  refresh: () => void;
  notifications: {
    permission: PermissionState;
    enabled: boolean;
    /** Asks the browser, then turns the preference on if it was granted. */
    enable: () => Promise<void>;
    disable: () => void;
  };
}

interface Options {
  user: User | null;
  state: AppState;
  /** True while the user is actually looking at the board. */
  watching: boolean;
  onNotificationsChange: (enabled: boolean) => void;
}

/** What this device is doing right now, from the two timers. */
const readActivity = (state: AppState, now: number) => {
  const { timer, pomodoro } = state;

  const stopwatchMs = timer.isRunning
    ? now - (timer.startTime ?? now) + timer.accumulatedMs
    : timer.accumulatedMs;

  const workRunning = pomodoro.isRunning && pomodoro.phase === 'work';
  /* Time served in the block so far — which is not "now minus a start time"
     once a block can be paused and resumed. Rendered back into an instant for
     `activeSince`, which is what the board's "on the clock since" reads. */
  const blockMs = workRunning ? servedMs(pomodoro, now) : 0;
  const phaseStarted = workRunning ? now - blockMs : null;

  /* Nothing is pending on a rating any more: a finished block is written to
     the logs the moment it ends, so it reaches the board by the ordinary
     path. Only the block still running is unpublished. */

  return {
    /* Published to the board. Work only: a break is not a session, and a rival
       shown as "on the clock" while making tea is a lie the board can't afford. */
    onTheClock: timer.isRunning || workRunning,
    /* Used to suppress notifications. Any running phase counts — a break is
       still part of the block the user is in the middle of. */
    busy: timer.isRunning || pomodoro.isRunning,
    activeSince: timer.isRunning ? timer.startTime : workRunning ? phaseStarted : null,
    pendingMinutes: Math.floor((stopwatchMs + blockMs) / 60_000),
  };
};

export const useRace = ({ user, state, watching, onNotificationsChange }: Options): RaceView => {
  const date = getISTDateString();
  const prefs = state.leaderboard;
  const joined = Boolean(user && prefs?.enabled && prefs.displayName);

  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [day, setDay] = useState<RaceDay>(() => loadRaceDay(date));
  const [feed, setFeed] = useState<RaceEvent[]>([]);
  const [toast, setToast] = useState<RaceEvent | null>(null);
  const [permission, setPermission] = useState<PermissionState>(notificationPermission);
  /* Nudges the memo so "42m on the clock" ages while nothing else changes. */
  const [, setTick] = useState(0);

  const myMinutes = useMemo(() => minutesOf(hoursToday(state.logs)), [state.logs]);
  const activity = readActivity(state, Date.now());

  /* Refs for everything the polling loop reads: it must not be torn down and
     rebuilt every time a timer ticks or an hour is logged. */
  const activityRef = useRef(activity);
  activityRef.current = activity;
  const logsRef = useRef(state.logs);
  logsRef.current = state.logs;
  const notifyMemoryRef = useRef(loadNotifyMemory(date));
  const lastPublishRef = useRef(0);
  const publishSignatureRef = useRef('');
  const advancedSignatureRef = useRef('');
  const dayRef = useRef(day);
  dayRef.current = day;

  const notificationsOn = Boolean(prefs?.notifications) && permission === 'granted';

  const race = useMemo(
    () =>
      buildRaceState(rows, {
        myUserId: user?.id ?? null,
        myMinutes,
        myName: prefs?.displayName ?? 'You',
        pendingMinutes: activity.pendingMinutes,
        iAmStudying: activity.onTheClock,
        date,
        degraded,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, myMinutes, activity.pendingMinutes, activity.onTheClock, user?.id, prefs?.displayName, date, degraded]
  );
  const raceRef = useRef(race);
  raceRef.current = race;

  const status = useMemo(() => raceStatus(race), [race]);

  /* ── Publishing ──
     Writes when something a watcher would notice changes — the total, the
     session light — and otherwise on a slow heartbeat, because `is_studying`
     is only believed while the row is fresh. */
  const publish = useCallback(
    async (force = false) => {
      if (!user || !prefs?.enabled || !prefs.displayName) return;
      const now = Date.now();
      const a = activityRef.current;
      const signature = `${hoursToday(logsRef.current)}|${a.onTheClock}`;
      const changed = signature !== publishSignatureRef.current;
      if (!force && !changed && now - lastPublishRef.current < PUBLISH_MIN_GAP_MS) return;

      publishSignatureRef.current = signature;
      lastPublishRef.current = now;
      const signal: ActivitySignal = {
        isStudying: a.onTheClock,
        activeSince: a.onTheClock ? a.activeSince : null,
      };
      await publishEntry(user.id, prefs.displayName, logsRef.current, signal);
    },
    [user, prefs?.enabled, prefs?.displayName]
  );

  const load = useCallback(async () => {
    if (!joined) return;
    setLoading(true);
    const result = await fetchBoard();
    setLoading(false);
    setError(result.error);
    setDegraded(Boolean(result.degraded));
    if (!result.error) {
      setRows(result.rows);
      setLastFetchedAt(Date.now());
    }
  }, [joined]);

  /* ── The loop ──
     A chain of timeouts rather than an interval, so a slow request can't stack
     up behind itself, and so the delay can change with where the user is
     looking without the loop being rebuilt. */
  useEffect(() => {
    if (!joined) {
      setRows([]);
      return;
    }
    let cancelled = false;
    let handle = 0;

    const delay = () =>
      document.visibilityState !== 'visible'
        ? POLL_HIDDEN_MS
        : watching
          ? POLL_WATCHING_MS
          : POLL_VISIBLE_MS;

    const cycle = async () => {
      await publish();
      await load();
      if (cancelled) return;
      handle = window.setTimeout(cycle, delay());
    };

    void cycle();

    /* Coming back to the tab, the numbers on screen are as old as the last
       hidden poll. Refresh rather than make the user wonder. */
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || cancelled) return;
      window.clearTimeout(handle);
      void cycle();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [joined, watching, publish, load]);

  /* Starting or ending a session is the one thing worth an immediate write:
     everyone else's board should light up within a poll, not within a minute. */
  useEffect(() => {
    if (!joined) return;
    void publish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, activity.onTheClock, myMinutes]);

  /* ── Folding an observation into the day ──
     Driven only by discrete changes: a fetch landing, or the user's own total
     moving. Deliberately not by the running clock — an unlogged session is not
     an event, and letting it drive the diff would emit an overtake a second
     before it was true. The signature also makes this safe to run twice, which
     StrictMode does in development. */
  useEffect(() => {
    if (!joined || !lastFetchedAt) return;
    const signature = `${lastFetchedAt}|${myMinutes}`;
    if (signature === advancedSignatureRef.current) return;
    advancedSignatureRef.current = signature;

    const now = Date.now();
    const { day: nextDay, events } = advanceRaceDay(dayRef.current, raceRef.current, now);
    dayRef.current = nextDay;
    setDay(nextDay);
    saveRaceDay(nextDay);
    if (!events.length) return;

    setFeed(prev => [...events].reverse().concat(prev).slice(0, FEED_SIZE));

    const loud = events.filter(e => priorityOf(e) >= TOAST_PRIORITY);
    if (loud.length) setToast(loud[0]);

    /* One event, one place. On screen if the user is here to read it, on the
       lock screen if they are not — never both. */
    const announcement: Announcement | null = selectAnnouncement(
      events,
      raceRef.current,
      notifyMemoryRef.current,
      activityRef.current.busy,
      now
    );
    if (!announcement) return;
    if (document.visibilityState === 'visible') {
      // The feed and the toast above have already said it.
      notifyMemoryRef.current = announcement.memory;
      saveNotifyMemory(announcement.memory);
      return;
    }
    if (!notificationsOn) return;
    if (sendSystemNotification(announcement.copy)) {
      notifyMemoryRef.current = announcement.memory;
      saveNotifyMemory(announcement.memory);
    }
  }, [joined, lastFetchedAt, myMinutes, notificationsOn]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  /* Minute-resolution copy ages on its own — "40m on the clock" must not still
     say 40 an hour later because nothing else changed. */
  useEffect(() => {
    if (!joined) return;
    const id = window.setInterval(() => setTick(t => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, [joined]);

  const enableNotifications = useCallback(async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    onNotificationsChange(result === 'granted');
  }, [onNotificationsChange]);

  const disableNotifications = useCallback(() => {
    onNotificationsChange(false);
  }, [onNotificationsChange]);

  return {
    race,
    status,
    day,
    feed,
    toast,
    dismissToast: () => setToast(null),
    loading,
    error,
    degraded,
    lastFetchedAt,
    refresh: () => {
      void publish(true);
      void load();
    },
    notifications: {
      permission,
      enabled: notificationsOn,
      enable: enableNotifications,
      disable: disableNotifications,
    },
  };
};

/** Hours logged today that the board will never count. */
export const untimedHoursToday = (logs: AppState['logs']): number => {
  const today = getISTDateString();
  return logs
    .filter(l => l.date === today && !isRanked(l))
    .reduce((sum, l) => sum + l.hours, 0);
};
