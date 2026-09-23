/* ── Profile cache ──
   A module-level Map, not a Context — the same call notify/toastBus.ts makes:
   most of what reads this (a leaderboard row, a chat bubble) is deep inside a
   list, and a Context whose value changed per fetch would re-render every
   consumer under whatever owns it. This only has to answer one question
   cheaply — "have we already fetched this user's card art" — so a plain
   cache plus a hook that fills it on demand is enough.

   The point is avoiding N requests for N rows: fetchProfilesByIds is called
   once per *new* set of ids a component asks for, never once per id. */

import { useEffect, useRef, useState } from 'react';
import { ProfileSummary, fetchProfilesByIds } from './profileApi';

const cache = new Map<string, ProfileSummary>();
const inFlight = new Map<string, Promise<void>>();

export const getCachedProfile = (userId: string): ProfileSummary | undefined => cache.get(userId);

/** After a successful edit, so the editor's own card and any already-mounted list reflect it without a refetch. */
export const setCachedProfile = (profile: ProfileSummary): void => {
  cache.set(profile.user_id, profile);
};

const fetchMissing = async (ids: string[]): Promise<void> => {
  const missing = ids.filter(id => !cache.has(id) && !inFlight.has(id));
  if (!missing.length) return;

  const promise = fetchProfilesByIds(missing)
    .then(rows => {
      rows.forEach(p => cache.set(p.user_id, p));
    })
    .catch(() => {
      // A missing avatar/name falls back to the identity-less default in
      // <Avatar>/<UserChip> — this is decoration, never worth surfacing an error for.
    })
    .finally(() => {
      missing.forEach(id => inFlight.delete(id));
    });

  missing.forEach(id => inFlight.set(id, promise));
  await promise;
};

/** Batched profile lookup for a list of user ids. Re-fetches only ids this cache hasn't already resolved. */
export const useProfiles = (userIds: string[]): Record<string, ProfileSummary | undefined> => {
  const [, setTick] = useState(0);
  const key = userIds.join(',');
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    void fetchMissing(key.split(',')).then(() => {
      if (!cancelled && keyRef.current === key) setTick(t => t + 1);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const out: Record<string, ProfileSummary | undefined> = {};
  userIds.forEach(id => { out[id] = cache.get(id); });
  return out;
};
