/* ── Is this person in ──
   Mounted at App root, above every early return, keyed on the user's id (never
   the user object: supabase-js re-emits it on every resume). Same stance as
   admin/useAdmin.ts: this decides what is DRAWN. The busy tables refuse a
   non-member's writes on their own (supabase/access.sql §6).

   - Signed out: the Gate asks them to sign in. There is no guest mode once
     the doors are closed, on any device.
   - Signed in: `my_access()`. The last answer is cached per account so a
     member never sees the Gate flash on a cold start, and a member who is
     offline stays in.
   - It fails CLOSED: no SQL on the project, or an error with nothing cached,
     and the Gate says it couldn't check, with a retry (`unknown`). A member
     with a cached answer is never shut out by a bad connection.
   - A device used before the doors closed claims nothing: the Gate offers it
     the "you used Alpha before" application (device.ts), and staff decide. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAccess, type AccessAnswer, type MemberInfo } from './api';
import { accessLive } from './cutover';

export type AccessView =
  | { kind: 'open' }
  | { kind: 'checking' }
  /** Couldn't ask the server (offline, an error, or no SQL), and nothing cached. */
  | { kind: 'unknown' }
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

const signedOutView = (): AccessView => (!accessLive() ? { kind: 'open' } : { kind: 'locked' });

export interface Access {
  view: AccessView;
  /** True while the Gate must stand in front of the app. */
  gated: boolean;
  /** Ask the server again. */
  refresh: () => void;
  /** Take an answer the Gate already has (redeem, join), without asking again. */
  settle: (a: AccessAnswer) => void;
}

export const useAccess = (userId: string | null): Access => {
  const [view, setView] = useState<AccessView>(() => {
    if (!userId) return signedOutView();
    const c = readCache(userId);
    return c ? toView(c) : { kind: 'checking' };
  });
  const lastAsk = useRef(0);

  const settle = useCallback((a: AccessAnswer) => {
    if (!userId) return;
    if (a.status === 'member' || a.status === 'waitlist' || a.status === 'none') {
      writeCache(userId, a);
      setView(toView(a));
    } else {
      // Missing SQL or an error: keep what we knew, else stay shut.
      setView(v => (v.kind === 'checking' || v.kind === 'unknown' ? { kind: 'unknown' } : v));
    }
  }, [userId]);

  const ask = useCallback(async () => {
    if (!userId) return;
    lastAsk.current = Date.now();
    settle(await fetchAccess());
  }, [userId, settle]);

  useEffect(() => {
    if (!userId) { setView(signedOutView()); return; }
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
      if (accessLive()) { setView(signedOutView()); window.clearInterval(t); }
    }, 60_000);
    return () => window.clearInterval(t);
  }, [userId]);

  const live = accessLive();
  const gated = live && (view.kind === 'locked' || view.kind === 'none' || view.kind === 'waitlist' || view.kind === 'checking' || view.kind === 'unknown');

  return { view, gated, refresh: () => { void ask(); }, settle };
};
