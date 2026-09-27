/* ── My groups, and keeping what they can see current ──
   Mounted once at App root, next to useRace, for the same reason: the
   publisher has to run while the user is on Today — that is where the hours
   and the ticked-off tasks happen — not only while the Groups tab is open.
   The list itself is cheap (one RPC) and is fetched on sign-in, on arrival at
   the Groups tab, on a slow poll while that tab is open, and when a hidden
   tab comes back. It carries the unread counts the sidebar badge shows.

   Nothing here touches AppState. Groups are server state; a Supabase upsert
   of the whole blob every time somebody opened a group would be absurd. */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { DailyLog, Task } from '../types';
import { getISTDateString } from '../utils';
import { MyGroup, fetchMyGroups, humanError, isSetupMissing } from './api';
import { hasLedger, publishStudyDays, publishTaskShare, widestLevel, withdrawAll } from './publish';

const POLL_WATCHING_MS = 60_000;
/* Hidden-tab returns and focus flicks re-fetch, but not more often than this. */
const MIN_REFRESH_GAP_MS = 15_000;
/* Coalesces a burst of log/task edits (a voice command, a sync landing) into one publish. */
const PUBLISH_DEBOUNCE_MS = 2_500;

export interface GroupsState {
  /** Null until the first fetch for this user has answered. */
  groups: MyGroup[] | null;
  loading: boolean;
  error: string | null;
  /** supabase/groups.sql has not been run on this project. */
  setupMissing: boolean;
  refresh: () => Promise<void>;
  /** Local-only patch after an action whose result is already known (read, sharing change). */
  patch: (groupId: string, changes: Partial<MyGroup>) => void;
  totalUnread: number;
}

interface Options {
  user: User | null;
  logs: DailyLog[];
  tasks: Task[];
  /** True while the Groups tab is on screen. */
  watching: boolean;
  /** The initial cloud pull has landed — publishing before it would send a fresh device's empty state. */
  ready: boolean;
}

export const useGroups = ({ user, logs, tasks, watching, ready }: Options): GroupsState => {
  const [groups, setGroups] = useState<MyGroup[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupMissing, setSetupMissing] = useState(false);
  const lastFetchRef = useRef(0);
  const userId = user?.id ?? null;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const refresh = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    lastFetchRef.current = Date.now();
    setLoading(true);
    try {
      const rows = await fetchMyGroups();
      if (userIdRef.current !== uid) return;
      setGroups(rows);
      setError(null);
      setSetupMissing(false);
    } catch (e) {
      if (userIdRef.current !== uid) return;
      setError(humanError(e));
      setSetupMissing(isSetupMissing(e));
      // Keep whatever list we had: a failed refresh is not an empty list.
      setGroups(prev => prev ?? []);
    } finally {
      if (userIdRef.current === uid) setLoading(false);
    }
  }, []);

  // Sign-in, sign-out, account switch.
  useEffect(() => {
    setGroups(null);
    setError(null);
    setSetupMissing(false);
    if (userId) void refresh();
  }, [userId, refresh]);

  // Arriving at the tab, and a slow poll while it stays open.
  useEffect(() => {
    if (!userId || !watching) return;
    if (Date.now() - lastFetchRef.current > MIN_REFRESH_GAP_MS) void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_WATCHING_MS);
    return () => window.clearInterval(id);
  }, [userId, watching, refresh]);

  // A tab brought back to the front.
  useEffect(() => {
    if (!userId) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetchRef.current > MIN_REFRESH_GAP_MS) {
        void refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, refresh]);

  const patch = useCallback((groupId: string, changes: Partial<MyGroup>) => {
    setGroups(prev => prev?.map(g => (g.id === groupId ? { ...g, ...changes } : g)) ?? prev);
  }, []);

  /* ── Publishing ──
     Keyed on the membership facts that change what has to be sent (in any
     group at all; the widest task level anywhere) plus the data itself. The
     first run per user sends everything, which is the self-heal for a lost
     ledger or a row somebody deleted by hand. */
  const inAnyGroup = groups !== null && groups.length > 0;
  const taskLevel = groups ? widestLevel(groups.map(g => g.share_tasks)) : 'private';
  const fullDoneForRef = useRef<string | null>(null);
  const publishedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || !ready || groups === null || setupMissing) return;

    if (!inAnyGroup) {
      /* Left the last group — here or on another device: nobody can read
         these rows any more, so they go. The ledger is what says this device
         ever put any there, so a user who never joined a group pays nothing. */
      if (publishedForRef.current === userId || hasLedger(userId)) {
        publishedForRef.current = null;
        fullDoneForRef.current = null;
        void withdrawAll(userId);
      }
      return;
    }

    const timer = window.setTimeout(() => {
      const full = fullDoneForRef.current !== userId;
      const today = getISTDateString();
      void Promise.all([
        publishStudyDays(userId, logs, full),
        publishTaskShare(userId, tasks, today, taskLevel, full),
      ]).then(([a, b]) => {
        if (a && b && userIdRef.current === userId) fullDoneForRef.current = userId;
      });
      publishedForRef.current = userId;
    }, PUBLISH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [userId, ready, groups === null, setupMissing, inAnyGroup, taskLevel, logs, tasks]);

  /* The task snapshot is "today", and today rolls over at 04:00 without any
     task changing. Re-publish when a returning tab finds the day has moved;
     publishTaskShare's own signature check makes every other wake a no-op. */
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  useEffect(() => {
    if (!userId || !ready || !inAnyGroup) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void publishTaskShare(userId, tasksRef.current, getISTDateString(), taskLevel, false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [userId, ready, inAnyGroup, taskLevel]);

  const totalUnread = groups?.reduce((sum, g) => sum + (g.unread || 0), 0) ?? 0;

  return { groups, loading, error, setupMissing, refresh, patch, totalUnread };
};
