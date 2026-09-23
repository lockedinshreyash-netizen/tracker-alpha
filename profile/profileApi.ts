/* ── Profile data ──
   Talks to `profiles` (see supabase/profiles.sql) plus one read against
   `leaderboard_entries` for the one stat a profile shows. RLS does the real
   enforcement, same as every other table in this app: reads are open to
   signed-in users, writes are restricted to `auth.uid() = user_id`, and row
   creation goes through the `ensure_profile()` RPC exclusively — there is no
   client insert path at all. */

import { supabase } from '../supabaseClient';
import { MAX_NAME, MIN_NAME } from '../leaderboard/api';

export type AvatarType = 'upload' | 'alpha';

export interface Profile {
  user_id: string;
  handle: string;
  display_name: string;
  bio: string | null;
  avatar_type: AvatarType;
  avatar_id: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

/** Just enough to draw an avatar + name — what leaderboard rows and chat bubbles need. */
export type ProfileSummary = Pick<
  Profile,
  'user_id' | 'handle' | 'display_name' | 'avatar_type' | 'avatar_id' | 'avatar_url'
>;

const COLUMNS = 'user_id, handle, display_name, bio, avatar_type, avatar_id, avatar_url, created_at, updated_at';
const SUMMARY_COLUMNS = 'user_id, handle, display_name, avatar_type, avatar_id, avatar_url';

export const MAX_BIO = 140;
export { MIN_NAME, MAX_NAME };

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const UPLOAD_MIME: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Mirrors display_name_length. Same bounds as a Race display name — see leaderboard/api.ts. */
export const validateDisplayName = (raw: string): string | null => {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < MIN_NAME || name.length > MAX_NAME) return null;
  return name;
};

/** Mirrors bio_length. Plain text only — trimmed, length-capped, nothing else stripped or escaped here (React never interprets it as markup). */
export const validateBio = (raw: string): string | null => {
  const bio = raw.trim();
  if (!bio) return '';
  if (bio.length > MAX_BIO) return null;
  return bio;
};

export const humanError = (error: unknown): string => {
  const e = error as { code?: string; message?: string } | null;
  const code = e?.code ?? '';
  const message = e?.message ?? '';

  if (code === '42501' || /row-level security|not authorized/i.test(message)) {
    return "You don't have permission to do that.";
  }
  if (code === '42P01' || code === 'PGRST202' || code === 'PGRST205'
    || /does not exist|could not find the (table|function)/i.test(message)) {
    return 'Profiles aren’t set up yet — run supabase/profiles.sql.';
  }
  if (code === '23514' || /violates check constraint/i.test(message)) {
    return "That doesn't look right — check the length of what you wrote.";
  }
  if (/failed to fetch|network|timeout/i.test(message)) {
    return 'No connection. Check your network and try again.';
  }
  return 'Something went wrong. Try again in a moment.';
};

/**
 * This user's profile, creating it on first call. Safe to call every
 * session — see supabase/profiles.sql's ensure_profile() for why it both
 * creates new profiles and backfills accounts that predate this table.
 */
export const ensureProfile = async (): Promise<Profile> => {
  const { data, error } = await supabase.rpc('ensure_profile');
  if (error) throw error;
  return data as Profile;
};

export const fetchProfileByHandle = async (handle: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(COLUMNS)
    .eq('handle', handle)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
};

export const fetchProfileByUserId = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select(COLUMNS)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
};

/** Batched lookup for a list of user ids — one request for an entire leaderboard or chat thread, not one per row. */
export const fetchProfilesByIds = async (userIds: string[]): Promise<ProfileSummary[]> => {
  if (!userIds.length) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select(SUMMARY_COLUMNS)
    .in('user_id', userIds);
  if (error) throw error;
  return (data ?? []) as ProfileSummary[];
};

/** Hours the app has measured for this user, all-time — see profiles.sql's profile_total_hours(). */
export const fetchTotalHours = async (userId: string): Promise<number> => {
  const { data, error } = await supabase.rpc('profile_total_hours', { p_user_id: userId });
  if (error) throw error;
  return Number(data) || 0;
};

export interface ProfileEdits {
  display_name: string;
  bio: string;
  avatar_type: AvatarType;
  avatar_id: string | null;
  avatar_url: string | null;
}

/** Writes only the caller's own row — enforced by the update policy's `auth.uid() = user_id`, not by this function. */
export const updateProfile = async (userId: string, edits: ProfileEdits): Promise<Profile> => {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: edits.display_name,
      bio: edits.bio || null,
      avatar_type: edits.avatar_type,
      avatar_id: edits.avatar_type === 'alpha' ? edits.avatar_id : null,
      avatar_url: edits.avatar_type === 'upload' ? edits.avatar_url : null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as Profile;
};

/** The first thing wrong with a chosen file, or null if it's fine to upload. */
export const validateAvatarFile = (file: File): string | null => {
  if (!UPLOAD_MIME.has(file.type)) return 'Use a JPG, PNG or WEBP image.';
  if (file.size > MAX_UPLOAD_BYTES) return 'That image is too large — under 5MB, please.';
  return null;
};

const AVATAR_BOX = 512;

/**
 * Downscales/compresses in the browser before anything reaches the network —
 * an avatar only ever renders at leaderboard-row/chat-bubble size, so a
 * multi-MB phone photo would otherwise be shipped to every viewer just to be
 * squeezed into a 32px circle. Canvas 2D, no dependency, the same technique
 * share/ already uses for card rendering.
 */
const resizeForAvatar = (file: File): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;

      const canvas = document.createElement('canvas');
      canvas.width = AVATAR_BOX;
      canvas.height = AVATAR_BOX;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas unavailable')); return; }
      ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_BOX, AVATAR_BOX);
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('encode failed'))),
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image failed to load')); };
    img.src = url;
  });

/**
 * Uploads a new avatar photo and returns its public URL. Old files in this
 * user's folder are removed first — the storage write policy scopes every
 * path to `<user_id>/...`, so a stale one otherwise sits there forever,
 * unreferenced, for as long as the account exists.
 */
export const uploadAvatar = async (userId: string, file: File): Promise<string> => {
  const blob = await resizeForAvatar(file);
  const path = `${userId}/avatar-${Date.now()}.jpg`;

  const { data: existing } = await supabase.storage.from('avatars').list(userId);
  if (existing?.length) {
    await supabase.storage.from('avatars').remove(existing.map(f => `${userId}/${f.name}`));
  }

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
};
