/* ── When an announcement is allowed to appear ──

   The rule at the top of notify/channels.ts is about interruptions the app
   invents for itself, and it does not bend here: this is a human being writing
   one message to every user, on purpose, and it is shown on the way into Today
   rather than fired at a lock screen. It is the one thing in the product that
   speaks without the user having authored it, which is exactly why it is worth
   keeping narrow — it appears on one tab, it appears once, and acknowledging it
   is the end of it.

   Everything about this hook is written so that the SECOND opening of Today is
   quiet. The acknowledgement is a row keyed to the user, so it survives a
   reload, a reinstall and a second device; the modal is opened at most once per
   announcement per session even if the write never lands.

   No realtime subscription. `user_profiles` has one because a stale AppState on
   a second device is actively wrong; an announcement arriving four minutes late
   is not. The reliable path — a check on the way into Today, and another when
   the tab is brought back to the foreground — is the one that has to work, so
   it is the only one there is. supabase/admin.sql §8 says how to add the other
   if it is ever wanted. */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Announcement, acknowledge, fetchUnread } from './api';

/* A foregrounded tab re-checks, but not more often than this. Somebody
   alt-tabbing between the app and their notes would otherwise issue two
   queries a second. */
const REFRESH_EVERY_MS = 60_000;

export interface AnnouncementsApi {
  /** Unread and live, oldest first. Empty for a signed-out user. */
  queue: Announcement[];
  /** The one being shown, or null when the queue is empty or set aside. */
  current: Announcement | null;
  /** True while an acknowledgement is in flight. */
  saving: boolean;
  /** Set when the last acknowledgement failed. Already human-readable. */
  error: string | null;
  /** Acknowledge the current one and move to the next. */
  acknowledgeCurrent: () => void;
  /** Acknowledge everything in the queue at once. */
  acknowledgeAll: () => void;
  /* Close without acknowledging. The line on Today stays and reopens it, and
     the next arrival on Today opens the modal again — closing is not reading. */
  setAside: () => void;
  /** Reopen after setting aside. */
  reopen: () => void;
  /** Whether the modal should be on screen right now. */
  open: boolean;
}

export const useAnnouncements = (
  user: User | null,
  /** True only on the tab announcements belong to. */
  onToday: boolean,
): AnnouncementsApi => {
  const [queue, setQueue] = useState<Announcement[]>([]);
  const [aside, setAsideFlag] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastFetch = useRef(0);
  /* Guards against a fetch that resolves after the user has signed out, or
     after a newer fetch has already landed. */
  const runId = useRef(0);

  const refresh = useCallback(async (force = false) => {
    if (!user) return;
    const now = Date.now();
    if (!force && now - lastFetch.current < REFRESH_EVERY_MS) return;
    lastFetch.current = now;

    const mine = ++runId.current;
    const rows = await fetchUnread(user.id);
    if (runId.current !== mine) return;

    setQueue(prev => {
      /* Nothing new: return the SAME array so a poll on a quiet tab cannot
         re-render the tree. Same no-op contract rewards/engine.ts settles on. */
      if (prev.length === rows.length && prev.every((a, i) => a.id === rows[i].id)) return prev;
      return rows;
    });
  }, [user]);

  /* ── The only place a fetch is started ──
     One effect covering both triggers rather than two, because two would each
     fire on mount and issue the same query twice. Nothing is fetched until
     Today is the tab that would show it: the queue exists to be consumed
     there, and an account sitting on the Plan grid has no use for it.

     Signing out empties the queue in the same pass, rather than leaving
     another account's notice on screen while a fetch decides. */
  useEffect(() => {
    if (!user) {
      setQueue([]);
      setAsideFlag(false);
      setError(null);
      lastFetch.current = 0;
      return;
    }
    if (!onToday) return;

    /* Arriving on Today clears a set-aside, so the modal opens again on the
       next genuine visit. Setting one aside silences it for as long as you are
       standing on the tab — that is what the line is for — but it is not a
       dismissal, and an unread notice has to be in front of somebody the next
       time they walk in or "published" meant nothing. */
    setAsideFlag(false);

    /* Forced: arriving on Today, or arriving as a different user, is somebody
       asking to see what is there. The throttle is for the passive triggers
       below. */
    refresh(true);
  }, [user, onToday, refresh]);

  /* And the app left open on Today all evening: a notice published at eight
     should not wait until tomorrow. Throttled, and only while Today is the
     tab that would show it. */
  useEffect(() => {
    if (!user || !onToday) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [user, onToday, refresh]);

  const commit = useCallback(async (ids: string[]) => {
    if (!user || !ids.length || saving) return;
    setSaving(true);
    setError(null);

    const ok = await acknowledge(user.id, ids);

    setSaving(false);
    if (!ok) {
      /* Deliberately not the database's words. The student gets something they
         can act on; the console gets nothing, because there is nothing here
         worth logging that the network tab does not already show. */
      setError('Could not save that. Check your connection and try again.');
      return;
    }
    const done = new Set(ids);
    setQueue(prev => prev.filter(a => !done.has(a.id)));
  }, [user, saving]);

  const current = !aside && queue.length ? queue[0] : null;

  return {
    queue,
    current,
    saving,
    error,
    acknowledgeCurrent: () => { if (queue[0]) commit([queue[0].id]); },
    acknowledgeAll: () => commit(queue.map(a => a.id)),
    setAside: () => { setAsideFlag(true); setError(null); },
    reopen: () => { setAsideFlag(false); setError(null); },
    open: current !== null,
  };
};
