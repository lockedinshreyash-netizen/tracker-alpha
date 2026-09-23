/* ── Profile controller ──
   Mounted once at App root, next to useRace/usePomodoro/useReminders — the
   same reasoning applies: a profile has to be openable from wherever the user
   currently is (a leaderboard row on Ranks, a chat bubble on the same tab),
   so the "which profile is open" state can't live inside any one tab.

   Owns three small things:
     · ensure_profile(), once per signed-in session — creates a new profile or
       silently returns the existing one; see supabase/profiles.sql.
     · the compact modal's open/closed user id.
     · a dependency-free /u/:handle route. This app has no router (see
       CLAUDE.md) and doesn't need one just for this — pushState plus a
       popstate listener is the whole thing. */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Profile, ensureProfile } from './profileApi';
import { setCachedProfile } from './profileCache';

const HANDLE_RE = /^\/u\/([a-z0-9]{6,16})\/?$/;

const parseHandle = (pathname: string): string | null => {
  const m = pathname.match(HANDLE_RE);
  return m ? m[1] : null;
};

export interface ProfileController {
  /** This device's own profile, once ensure_profile() has resolved. */
  ownProfile: Profile | null;
  /** Non-null when the URL is /u/:handle. */
  routeHandle: string | null;
  /** Non-null when the compact modal should show this user. */
  openProfileUserId: string | null;
  editing: boolean;
  openProfile: (userId: string) => void;
  closeProfile: () => void;
  /** Modal -> full page: pushes /u/:handle and closes the modal. */
  viewFullProfile: (handle: string) => void;
  /** Leaves the profile route, back to the ordinary tabbed app. */
  goHome: () => void;
  openEditProfile: () => void;
  closeEditProfile: () => void;
  onSaved: (p: Profile) => void;
}

export const useProfileController = (user: User | null): ProfileController => {
  const [ownProfile, setOwnProfile] = useState<Profile | null>(null);
  const [routeHandle, setRouteHandle] = useState<string | null>(() => parseHandle(window.location.pathname));
  const [openProfileUserId, setOpenProfileUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const ensuredForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) { setOwnProfile(null); ensuredForRef.current = null; return; }
    if (ensuredForRef.current === user.id) return;
    ensuredForRef.current = user.id;
    void ensureProfile()
      .then(p => { setOwnProfile(p); setCachedProfile(p); })
      .catch(() => { ensuredForRef.current = null; });
  }, [user]);

  useEffect(() => {
    const onPop = () => setRouteHandle(parseHandle(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openProfile = useCallback((userId: string) => setOpenProfileUserId(userId), []);
  const closeProfile = useCallback(() => setOpenProfileUserId(null), []);

  const viewFullProfile = useCallback((handle: string) => {
    setOpenProfileUserId(null);
    window.history.pushState({}, '', `/u/${handle}`);
    setRouteHandle(handle);
  }, []);

  const goHome = useCallback(() => {
    if (!parseHandle(window.location.pathname)) return;
    window.history.pushState({}, '', '/');
    setRouteHandle(null);
  }, []);

  const openEditProfile = useCallback(() => setEditing(true), []);
  const closeEditProfile = useCallback(() => setEditing(false), []);

  const onSaved = useCallback((p: Profile) => {
    setOwnProfile(p);
    setEditing(false);
  }, []);

  return {
    ownProfile,
    routeHandle,
    openProfileUserId,
    editing,
    openProfile,
    closeProfile,
    viewFullProfile,
    goHome,
    openEditProfile,
    closeEditProfile,
    onSaved,
  };
};
