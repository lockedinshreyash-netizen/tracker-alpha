/* ── Groups data ──
   Talks to the tables and functions in supabase/groups.sql. Almost every call
   here is an RPC rather than a table write, because almost nothing in that
   schema is writable directly — membership, roles, invites and bans change
   only through functions that check the caller's role in the same transaction
   as the write. The two direct writes are the ones whose rule really is "your
   own row": posting a message (groups/chatApi.ts) and publishing your own
   study data (groups/publish.ts).

   Nothing here is a security boundary. A hostile client calling any of these
   with any arguments gets exactly what the database's policies allow. */

import { supabase } from '../supabaseClient';

export type GroupRole = 'owner' | 'admin' | 'member';
export type TaskShareLevel = 'private' | 'summary' | 'tasks';
export type InvitePolicy = 'admins' | 'members';

/** One row of my_groups(): the group, my membership, and the counts the list shows. */
export interface MyGroup {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  visibility: 'private' | 'discoverable';
  invite_policy: InvitePolicy;
  created_at: string;
  role: GroupRole;
  share_hours: boolean;
  share_tasks: TaskShareLevel;
  joined_at: string;
  member_count: number;
  /** Others' live messages past my read marker, capped at 100 by the server. */
  unread: number;
  last_message_at: string | null;
}

export interface GroupMember {
  user_id: string;
  role: GroupRole;
  joined_at: string;
  share_hours: boolean;
  share_tasks: TaskShareLevel;
}

export interface LeaderboardEntry {
  user_id: string;
  role: GroupRole;
  shares_hours: boolean;
  /** Null when this member keeps hours private (never for yourself). */
  hours: number | null;
  tracked_hours: number | null;
  days_active: number | null;
}

export interface SharedTask {
  text: string;
  done: boolean;
  subject?: string;
}

export interface TaskProgressEntry {
  user_id: string;
  share_tasks: TaskShareLevel;
  /** The study day this snapshot was published for. */
  date: string;
  done: number;
  total: number;
  /** Only at the 'tasks' level. */
  tasks: SharedTask[] | null;
  updated_at: string;
}

export interface GroupInvite {
  id: string;
  group_id: string;
  code: string;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  revoked_at: string | null;
}

export interface GroupBan {
  user_id: string;
  banned_at: string;
}

export type InviteStatus =
  | 'ok' | 'member' | 'joined'
  | 'invalid' | 'revoked' | 'expired' | 'exhausted' | 'banned' | 'full' | 'limit' | 'throttled';

export interface InvitePreview {
  status: InviteStatus;
  group_id?: string;
  group?: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    member_count: number;
  };
}

/* ── Limits ── mirror the CHECK constraints, so bad input fails here first. */
export const MIN_GROUP_NAME = 2;
export const MAX_GROUP_NAME = 48;
export const MAX_GROUP_DESCRIPTION = 280;

export const validateGroupName = (raw: string): string | null => {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < MIN_GROUP_NAME) return null;
  return name.slice(0, MAX_GROUP_NAME);
};

/* ── Invite codes ──
   Twelve characters of Crockford base32. Normalized exactly the way the
   server's normalize_invite_code() does it, so a code read aloud as "oh" or
   typed in lowercase with the dashes still resolves. */
const CODE_ALPHABET = /[^0-9A-HJKMNP-TV-Z]/g;

export const normalizeInviteCode = (raw: string): string =>
  raw.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(CODE_ALPHABET, '');

export const isCompleteCode = (raw: string): boolean => normalizeInviteCode(raw).length === 12;

/** ABCD-EFGH-JKMN — how a code is shown and read out. */
export const formatInviteCode = (code: string): string =>
  normalizeInviteCode(code).replace(/(.{4})(?=.)/g, '$1-');

/* A query parameter on the root rather than a /join/:code path: there is no
   router and no server rewrite in this deployment, and the root is the one
   URL guaranteed to serve the app. */
export const inviteLink = (code: string): string =>
  `${window.location.origin}/?join=${normalizeInviteCode(code)}`;

/* ── Errors ── */

/** Anything in words that don't require reading Postgres. Same stance as feedback/api.ts. */
export const humanError = (error: unknown): string => {
  const e = error as { code?: string; message?: string; hint?: string } | null;
  const code = e?.code ?? '';
  const message = e?.message ?? '';
  const hint = e?.hint ?? '';

  if (code === '42P01' || code === 'PGRST202' || code === 'PGRST205'
    || /could not find the (table|function)|does not exist/i.test(message)) {
    return 'GROUPS AREN’T SET UP YET — RUN supabase/groups.sql.';
  }
  if (hint === 'rate_limited' || /slow down/i.test(message)) return 'Slow down — too many messages at once.';
  if (hint === 'group_limit') return 'You’re in 30 groups already. Leave one first.';
  if (hint === 'owned_limit') return 'You own 10 groups already.';
  if (hint === 'invite_limit') return 'Too many live invites. Revoke one first.';
  if (code === '42501' || /row-level security|not authorized|not authenticated/i.test(message)) {
    return 'You don’t have permission to do that.';
  }
  if (code === '23514' || /violates check constraint/i.test(message)) return 'That doesn’t fit — check the length.';
  if (/failed to fetch|network|timeout|load failed/i.test(message)) return 'No connection. Check your network and try again.';
  return 'Something went wrong. Try again in a moment.';
};

export const isSetupMissing = (error: unknown): boolean =>
  humanError(error).startsWith('GROUPS AREN’T SET UP');

/* ── Calls ── every one throws the raw error; callers pass it to humanError. */

const rpc = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

export const fetchMyGroups = (): Promise<MyGroup[]> =>
  rpc<MyGroup[] | null>('my_groups').then(rows => rows ?? []);

export const createGroup = (input: {
  name: string;
  description: string;
  icon: string | null;
  invitePolicy: InvitePolicy;
  shareHours: boolean;
}): Promise<string> =>
  rpc<string>('create_group', {
    p_name: input.name,
    p_description: input.description,
    p_icon: input.icon,
    p_invite_policy: input.invitePolicy,
    p_share_hours: input.shareHours,
  });

export const updateGroup = (groupId: string, input: {
  name: string;
  description: string;
  icon: string | null;
  invitePolicy: InvitePolicy;
}): Promise<void> =>
  rpc<void>('update_group', {
    p_group: groupId,
    p_name: input.name,
    p_description: input.description,
    p_icon: input.icon,
    p_invite_policy: input.invitePolicy,
  });

export const deleteGroup = (groupId: string): Promise<void> => rpc('delete_group', { p_group: groupId });
export const leaveGroup = (groupId: string): Promise<void> => rpc('leave_group', { p_group: groupId });

export const fetchMembers = (groupId: string): Promise<GroupMember[]> =>
  rpc<GroupMember[] | null>('group_members_list', { p_group: groupId }).then(rows => rows ?? []);

export const removeMember = (groupId: string, userId: string, ban: boolean): Promise<void> =>
  rpc('remove_member', { p_group: groupId, p_user: userId, p_ban: ban });

export const unbanMember = (groupId: string, userId: string): Promise<void> =>
  rpc('unban_member', { p_group: groupId, p_user: userId });

export const setMemberRole = (groupId: string, userId: string, role: 'admin' | 'member'): Promise<void> =>
  rpc('set_member_role', { p_group: groupId, p_user: userId, p_role: role });

export const transferOwnership = (groupId: string, userId: string): Promise<void> =>
  rpc('transfer_ownership', { p_group: groupId, p_user: userId });

export const setSharing = (groupId: string, shareHours: boolean, shareTasks: TaskShareLevel): Promise<void> =>
  rpc('set_group_sharing', { p_group: groupId, p_share_hours: shareHours, p_share_tasks: shareTasks });

export const markRead = (groupId: string, lastId: number): Promise<void> =>
  rpc('mark_group_read', { p_group: groupId, p_last_id: lastId });

export const fetchLeaderboard = (groupId: string, from: string | null, to: string | null): Promise<LeaderboardEntry[]> =>
  rpc<LeaderboardEntry[] | null>('group_leaderboard', { p_group: groupId, p_from: from, p_to: to }).then(rows =>
    (rows ?? []).map(r => ({
      ...r,
      // numeric arrives as a string from PostgREST.
      hours: r.hours === null ? null : Number(r.hours),
      tracked_hours: r.tracked_hours === null ? null : Number(r.tracked_hours),
    }))
  );

export const fetchTaskProgress = (groupId: string): Promise<TaskProgressEntry[]> =>
  rpc<TaskProgressEntry[] | null>('group_task_progress', { p_group: groupId }).then(rows => rows ?? []);

/* ── Invites ── */

export const createInvite = (groupId: string, expiresHours: number | null, maxUses: number | null): Promise<GroupInvite> =>
  rpc<GroupInvite>('create_invite', { p_group: groupId, p_expires_hours: expiresHours, p_max_uses: maxUses });

export const revokeInvite = (inviteId: string): Promise<void> => rpc('revoke_invite', { p_invite: inviteId });

/** Live invites this caller may see — all of them for an admin, their own for a member (RLS decides). */
export const fetchInvites = async (groupId: string): Promise<GroupInvite[]> => {
  const { data, error } = await supabase
    .from('group_invites')
    .select('id, group_id, code, created_by, created_at, expires_at, max_uses, uses, revoked_at')
    .eq('group_id', groupId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const now = Date.now();
  return ((data ?? []) as GroupInvite[]).filter(inv =>
    (!inv.expires_at || new Date(inv.expires_at).getTime() > now)
    && (inv.max_uses === null || inv.uses < inv.max_uses)
  );
};

export const fetchBans = async (groupId: string): Promise<GroupBan[]> => {
  const { data, error } = await supabase
    .from('group_bans')
    .select('user_id, banned_at')
    .eq('group_id', groupId)
    .order('banned_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as GroupBan[];
};

export const previewInvite = (code: string): Promise<InvitePreview> =>
  rpc<InvitePreview>('preview_invite', { p_code: normalizeInviteCode(code) });

export const redeemInvite = (code: string, shareHours: boolean): Promise<InvitePreview> =>
  rpc<InvitePreview>('redeem_invite', { p_code: normalizeInviteCode(code), p_share_hours: shareHours });

/** What each refusal means, in the app's voice. */
export const INVITE_STATUS_COPY: Partial<Record<InviteStatus, string>> = {
  invalid: 'That code doesn’t exist. Check it and try again.',
  revoked: 'This invite was revoked. Ask for a new one.',
  expired: 'This invite has expired. Ask for a new one.',
  exhausted: 'This invite has been used up. Ask for a new one.',
  banned: 'You can’t join this group.',
  full: 'This group is full.',
  limit: 'You’re in 30 groups already. Leave one first.',
  throttled: 'Too many wrong codes. Wait 15 minutes and try again.',
};
