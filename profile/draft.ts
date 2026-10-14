/* ── The profile picked before there is an account ──
   Onboarding builds a profile (a name and an Alpha Avatar) before the student
   has signed in, and signing in is a round trip through Google that reloads
   the page. So the choice waits here, on this device, and is written to the
   student's `profiles` row the first time a signed-in session finds it.

   It is applied only to an account made just now. A draft left by a guest on
   a shared laptop must never rename somebody else's established profile the
   day they sign in on it, and a student signing back in to an old account
   from a new phone keeps the profile they already have. An existing account
   just drops the draft. */

import type { Profile } from './profileApi';

const KEY = 'alpha_profile_draft_v1';

/** How recent a profile's `created_at` must be to count as "made just now". */
const NEW_ACCOUNT_MS = 30 * 60_000;

export interface ProfileDraft {
  name: string;
  avatarId: string;
}

export const readProfileDraft = (): ProfileDraft | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<ProfileDraft>;
    if (typeof d.name !== 'string' || typeof d.avatarId !== 'string') return null;
    return { name: d.name, avatarId: d.avatarId };
  } catch {
    return null;
  }
};

export const saveProfileDraft = (d: ProfileDraft) => {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* private mode: the choice is lost, the account is not */ }
};

export const clearProfileDraft = () => {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
};

export const isNewAccount = (p: Profile, now = Date.now()): boolean => {
  const created = Date.parse(p.created_at);
  return Number.isFinite(created) && now - created < NEW_ACCOUNT_MS;
};
