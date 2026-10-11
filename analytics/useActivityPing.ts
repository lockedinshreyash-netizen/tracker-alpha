/* ── Telling the server this account was here today ──
   Mounted once at App root, beside useReminders and useGroups, for their
   reason: a visit happens on whatever tab the app opens on, and hours are
   logged on Today, so a hook inside the console would only ever count admins.

   Three triggers, and nothing else:
     - arriving (load, or back after a 30-minute gap or past 04:00) — a visit,
       carrying the usage facts;
     - today's logs changing — the day's totals, a few seconds later;
     - the tab hiding — whatever was waiting goes now.

   It never touches AppState, so it never fires a sync of the blob. It waits
   for the initial cloud pull (`ready`): a fresh device would otherwise report
   its empty defaults as somebody's day. If analytics.sql has not been run it
   gives up for the session after one try — the app works without any of this. */

import { useCallback, useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import type { AppState, DailyLog } from '../types';
import {
  Ping, claimVisit, daysSignature, platformPing, recentDays, sendPing, touchVisit, usageFacts,
} from './track';

/* Coalesces a burst of log edits (a voice command, a sync landing) into one write. */
const DEBOUNCE_MS = 4_000;

interface Options {
  user: User | null;
  /** The initial cloud pull has landed. */
  ready: boolean;
  logs: DailyLog[];
  /** Read lazily, on a visit only — the facts are not worth a dependency on all of state. */
  getState: () => AppState;
  /** The design board's recorder; the app always talks to the database. */
  transport?: (ping: Ping) => Promise<'ok' | 'missing' | 'failed'>;
}

export const useActivityPing = ({ user, ready, logs, getState, transport = sendPing }: Options): void => {
  const userId = user?.id ?? null;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const logsRef = useRef(logs);
  logsRef.current = logs;
  const getStateRef = useRef(getState);
  getStateRef.current = getState;
  const transportRef = useRef(transport);
  transportRef.current = transport;
  const lastUserRef = useRef<string | null>(null);

  const disabledRef = useRef(false);
  const sentSigRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);
  /* What to send once the request in flight returns. A visit is never downgraded to a data ping. */
  const queuedRef = useRef<boolean | null>(null);
  const failedRef = useRef<boolean | null>(null);
  const timerRef = useRef<number | null>(null);

  const send = useCallback(async (open: boolean): Promise<void> => {
    const uid = userIdRef.current;
    if (!uid || disabledRef.current) return;
    /* A data ping with nothing new in it is not sent — whatever path asked for
       it (a timer, a queue, StrictMode running an effect twice). */
    if (!open && daysSignature(recentDays(logsRef.current)) === sentSigRef.current) return;
    if (inFlightRef.current) {
      queuedRef.current = (queuedRef.current ?? false) || open;
      return;
    }
    inFlightRef.current = true;
    const days = recentDays(logsRef.current);
    /* Claimed on dispatch, not on success, so the log effect running in the
       same commit does not schedule a second copy of this one. */
    sentSigRef.current = daysSignature(days);
    const ping: Ping = {
      open,
      ...platformPing(),
      days,
      ...(open ? { facts: usageFacts(getStateRef.current()) } : {}),
    };
    try {
      const result = await transportRef.current(ping);
      if (result === 'missing') disabledRef.current = true;
      if (userIdRef.current === uid) {
        if (result === 'ok') {
          failedRef.current = null;
        } else if (result === 'failed') {
          sentSigRef.current = null;
          failedRef.current = (failedRef.current ?? false) || open;
        }
      }
    } catch {
      sentSigRef.current = null;
      failedRef.current = (failedRef.current ?? false) || open;
    } finally {
      inFlightRef.current = false;
      const next = queuedRef.current;
      queuedRef.current = null;
      if (next !== null && userIdRef.current === uid) void send(next);
    }
  }, []);

  const cancelTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Arriving: sign-in, account switch, or a load once the cloud pull is in.
  useEffect(() => {
    if (lastUserRef.current !== userId) {
      lastUserRef.current = userId;
      sentSigRef.current = null;
      failedRef.current = null;
      queuedRef.current = null;
      cancelTimer();
    }
    if (!userId || !ready) return;
    void send(claimVisit(userId));
  }, [userId, ready, send]);

  // Today's logs changed.
  useEffect(() => {
    if (!userId || !ready || disabledRef.current) return;
    touchVisit(userId);
    if (daysSignature(recentDays(logs)) === sentSigRef.current) return;
    cancelTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void send(false);
    }, DEBOUNCE_MS);
    return cancelTimer;
  }, [logs, userId, ready, send]);

  // Leaving and coming back.
  useEffect(() => {
    if (!userId || !ready) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        touchVisit(userId);
        if (timerRef.current !== null) {
          cancelTimer();
          void send(false);
        }
      } else if (claimVisit(userId)) {
        void send(true);
      }
    };
    const onOnline = () => {
      const pending = failedRef.current;
      if (pending !== null) void send(pending);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [userId, ready, send]);
};
