/* ── Is this person in ──
   Mounted at App root, above every early return, keyed on the user's id (never
   the user object: supabase-js re-emits it on every resume). Same stance as
   admin/useAdmin.ts: this decides what is DRAWN. The busy tables refuse a
   non-member's writes on their own (supabase/access.sql §6).

   - Signed out: before the cutover, or on a founding device, the app is open
     as it always was (`guest`); otherwise the Gate asks them to sign in.
   - Signed in: `my_access()`. The last answer is cached per account so a
     member never sees the Gate flash on a cold start, and a member who is
     offline stays in.
   - It fails OPEN: no SQL on the project, or an error with nothing cached, and
     the app behaves exactly as before invite-only. A wrongly open door costs
     one session; a wrongly shut one locks out a founding member.
   - A post-cutover account on a founding device claims founding access once
     (device.ts). */

import { useCallback, useEffect, useRef, useState } from 'react';
import { claimFoundingDevice, fetchAccess, type AccessAnswer, type MemberInfo } from './api';
import { accessLive } from './cutover';
import { foundingDay } from './device';

export type AccessView =
  | { kind: 'open' }
  | { kind: 'checking' }
  | { kind: 'guest' }
  | { kind: 'locked' }
  | { kind: 'member'; member: MemberInfo }
  | { kind: 'waitlist'; position: number; wantsPass: boolean }
  | { kind: 'none' };

type Settled = Extract<AccessAnswer, { status: 'member' | 'waitlist' | 'none' }>;

const cacheKey = (uid: string) => `alpha_access_v1:${uid}`;
const REFRESH_MS = 2 * 60 * 1000;

const readCache = (uid: string): Settled | null => {
  try {
    const raw = localStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const a = JSON.parse(raw) as Settled;
    return a && (a.status === 'member' || a.status === 'waitlist' || a.status === 'none') ? a : null;
  } catch {
    return null;
  }
};

const writeCache = (uid: string, a: Settled) => {
  try { localStorage.setItem(cacheKey(uid), JSON.stringify(a)); } catch { /* cache only */ }
};

const toView = (a: Settled): AccessView =>
  a.status === 'member' ? { kind: 'member', member: a.member }
    : a.status === 'waitlist' ? { kind: 'waitlist', position: a.position, wantsPass: a.wantsPass }
      : { kind: 'none' };

const signedOutView = (logs: ReadonlyArray<{ date: string }>): AccessView =>
  !accessLive() ? { kind: 'open' } : foundingDay(logs) ? { kind: 'guest' } : { kind: 'locked' };

export interface Access {
  view: AccessView;
  /** True while the Gate must stand in front of the app. */
  gated: boolean;
  /** Ask the server again. */
  refresh: () => void;
  /** Take an answer the Gate already has (redeem, join), without asking again. */
  settle: (a: AccessAnswer) => void;
}

export const useAccess = (userId: string | null, logs: ReadonlyArray<{ date: string }>): Access => {
  const logsRef = useRef(logs);
  logsRef.current = logs;

  const [view, setView] = useState<AccessView>(() => {
    if (!userId) return signedOutView(logs);
    const c = readCache(userId);
    return c ? toView(c) : { kind: 'checking' };
  });
  const lastAsk = useRef(0);
  const claimed = useRef<string | null>(null);

  const settle = useCallback((a: AccessAnswer) => {
    if (!userId) return;
    if (a.status === 'member' || a.status === 'waitlist' || a.status === 'none') {
      writeCache(userId, a);
      setView(toView(a));
    } else {
      // Missing SQL or an error: keep what we knew, else fail open.
      setView(v => (v.kind === 'checking' ? { kind: 'open' } : v));
    }
  }, [userId]);

  const ask = useCallback(async () => {
    if (!userId) return;
    lastAsk.current = Date.now();
    let a = await fetchAccess();
    if (a.status === 'none' && claimed.current !== userId) {
      const day = foundingDay(logsRef.current);
      if (day) {
        claimed.current = userId;
        const c = await claimFoundingDevice(day);
        if (c.status === 'member') a = c;
      }
    }
    settle(a);
  }, [userId, settle]);

  useEffect(() => {
    if (!userId) { setView(signedOutView(logsRef.current)); return; }
    const c = readCache(userId);
    setView(c ? toView(c) : { kind: 'checking' });
    void ask();
  }, [userId, ask]);

  /* Waiting people come back to see if they were let in; members' cards pick
     up "Accepted by …". Throttled, on return to the foreground only. */
  useEffect(() => {
    if (!userId) return;
    const onShow = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastAsk.current > REFRESH_MS) void ask();
    };
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [userId, ask]);

  /* The cutover can pass with the tab open. A signed-out visitor's view is
     re-read once a minute until then; nothing runs after it. */
  useEffect(() => {
    if (userId || accessLive()) return;
    const t = window.setInterval(() => {
      if (accessLive()) { setView(signedOutView(logsRef.current)); window.clearInterval(t); }
    }, 60_000);
    return () => window.clearInterval(t);
  }, [userId]);

  const live = accessLive();
  const gated = live && (view.kind === 'locked' || view.kind === 'none' || view.kind === 'waitlist' || view.kind === 'checking');

  return { view, gated, refresh: () => { void ask(); }, settle };
};
