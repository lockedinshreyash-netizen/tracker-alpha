/* ── Being told you were removed ──

   Mounted at App root, not in a tab, because a removal can arrive while you
   are anywhere — and the notice belongs in front of you wherever that is.

   Three ways a notice arrives, all feeding the same queue:
     · a fetch when the session starts (the app was closed when it happened)
     · Realtime, for a screen already open — RLS means each subscriber is sent
       their own notices and nothing else (supabase/moderation.sql §4)
     · a throttled re-check when the tab comes back to the front, in case the
       socket dropped while it was hidden

   Each new notice also goes through notify/deliver once: a hidden tab gets a
   system notification, a visible one gets nothing extra because the modal is
   already the message. And each triggers its side effect once — the race is
   turned off for a leaderboard removal, the group list re-read for a group
   one — so the app stops publishing to a board that will refuse it and stops
   showing a group you are no longer in. Both happen on arrival, not on "Got
   it": the removal already happened, whether or not it has been read. */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { deliver } from '../notify/deliver';
import {
  ModerationNotice,
  ackNotice,
  fetchUnreadNotices,
  humanError,
  isLeaderboardNotice,
  noticeNotification,
} from './api';

const REFRESH_EVERY_MS = 60_000;

export interface ModerationNoticesApi {
  /** The notice on screen, oldest unread first. */
  current: ModerationNotice | null;
  /** How many are waiting, including the current one. */
  total: number;
  saving: boolean;
  error: string | null;
  acknowledge: () => void;
}

interface Options {
  user: User | null;
  /* False until the initial cloud pull has landed. That pull replaces
     AppState wholesale, so turning the race off before it would be undone by
     it — the same gate useReminders waits on. */
  ready: boolean;
  onLeaderboardRemoved: () => void;
  onGroupRemoved: () => void;
}

export const useModerationNotices = ({ user, ready, onLeaderboardRemoved, onGroupRemoved }: Options): ModerationNoticesApi => {
  const [queue, setQueue] = useState<ModerationNotice[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Ids whose side effect and delivery have already run this session. */
  const handledRef = useRef<Set<string>>(new Set());
  const lastFetchRef = useRef(0);
  const runRef = useRef(0);

  /* Callbacks through refs, so the subscription is not torn down every time
     App re-renders with a fresh closure. */
  const onBoardRef = useRef(onLeaderboardRemoved);
  onBoardRef.current = onLeaderboardRemoved;
  const onGroupRef = useRef(onGroupRemoved);
  onGroupRef.current = onGroupRemoved;

  const absorb = useCallback((incoming: ModerationNotice[]) => {
    const fresh = incoming.filter(n => !handledRef.current.has(n.id));
    fresh.forEach(n => {
      handledRef.current.add(n.id);
      void deliver({ channel: 'moderation', copy: noticeNotification(n), key: `moderation:${n.id}`, toast: false });
    });
    if (fresh.some(isLeaderboardNotice)) onBoardRef.current();
    if (fresh.some(n => !isLeaderboardNotice(n))) onGroupRef.current();

    setQueue(prev => {
      const byId = new Map<string, ModerationNotice>(prev.map(n => [n.id, n]));
      incoming.forEach(n => byId.set(n.id, n));
      const next = Array.from(byId.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
      // Nothing new: the same array, so a quiet poll cannot re-render App.
      return next.length === prev.length && next.every((n, i) => n.id === prev[i].id) ? prev : next;
    });
  }, []);

  const refresh = useCallback(async (force = false) => {
    if (!user) return;
    const now = Date.now();
    if (!force && now - lastFetchRef.current < REFRESH_EVERY_MS) return;
    lastFetchRef.current = now;
    const run = ++runRef.current;
    const rows = await fetchUnreadNotices();
    if (run !== runRef.current) return;
    absorb(rows);
  }, [user, absorb]);

  // Session start, and a different account signing in.
  useEffect(() => {
    setQueue([]);
    setError(null);
    handledRef.current = new Set();
    lastFetchRef.current = 0;
    runRef.current++;
    if (user && ready) void refresh(true);
  }, [user, ready, refresh]);

  // Coming back to the tab.
  useEffect(() => {
    if (!user || !ready) return;
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, ready, refresh]);

  // Live, for a screen already open.
  useEffect(() => {
    if (!user || !ready) return;
    const channel = supabase
      .channel(`moderation_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'moderation_notices', filter: `user_id=eq.${user.id}` },
        payload => {
          const n = payload.new as ModerationNotice & { read_at?: string | null };
          if (!n?.id || n.read_at) return;
          absorb([{ id: n.id, kind: n.kind, context: n.context, reason: n.reason, by_staff: n.by_staff, created_at: n.created_at }]);
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user, ready, absorb]);

  const current = queue[0] ?? null;

  const acknowledge = useCallback(() => {
    if (!current || saving) return;
    setSaving(true);
    setError(null);
    ackNotice(current.id)
      .then(() => setQueue(prev => prev.filter(n => n.id !== current.id)))
      .catch(e => setError(humanError(e)))
      .finally(() => setSaving(false));
  }, [current, saving]);

  return { current, total: queue.length, saving, error, acknowledge };
};
