/* ── Moderation data ──
   Talks to supabase/moderation.sql, plus remove_member in groups.sql.

   Two audiences. The removed person reads their own notices and marks them
   read — nothing else. Staff call the staff_* functions, every one of which
   re-checks is_admin() in the database; nothing here is a security boundary.

   Group admins removing someone from their own group go through
   groups/api.ts's removeMember, which now carries the reason too. */

import { supabase } from '../supabaseClient';
import { DAY_START_HOUR, getISTDateString } from '../utils';

/** Mirrors the CHECK constraint on moderation_notices.reason. */
export const MAX_REASON = 500;

export type NoticeKind = 'group_removed' | 'group_banned' | 'leaderboard_removed' | 'leaderboard_banned';

export interface ModerationNotice {
  id: string;
  kind: NoticeKind;
  /** The group's name when it happened. Null for the race. */
  context: string | null;
  reason: string | null;
  by_staff: boolean;
  created_at: string;
}

export const isLeaderboardNotice = (n: ModerationNotice): boolean =>
  n.kind === 'leaderboard_removed' || n.kind === 'leaderboard_banned';

export interface NoticeCopy {
  eyebrow: string;
  title: string;
  /** Who, without naming anyone. */
  who: string;
  /** What happens next. */
  next: string;
}

/**
 * What the notice says. Never names the person who did it — "an admin of X"
 * or "Tracker Alpha", nothing more (see supabase/moderation.sql's header).
 */
export const noticeCopy = (n: ModerationNotice): NoticeCopy => {
  const group = n.context ?? 'a group';
  switch (n.kind) {
    case 'group_removed':
      return {
        eyebrow: 'Removed from group',
        title: group,
        who: n.by_staff ? `Tracker Alpha removed you from ${group}.` : `An admin of ${group} removed you.`,
        next: 'You can join again if someone sends you a new invite.',
      };
    case 'group_banned':
      return {
        eyebrow: 'Banned from group',
        title: group,
        who: n.by_staff ? `Tracker Alpha removed you from ${group}.` : `An admin of ${group} removed you.`,
        next: 'You can’t join this group again unless an admin lifts the ban.',
      };
    case 'leaderboard_removed':
      return {
        eyebrow: 'Removed from the race',
        title: 'Ranks',
        who: 'Tracker Alpha took you off today’s leaderboard.',
        next: 'You can join the race again from the Ranks tab.',
      };
    case 'leaderboard_banned':
      return {
        eyebrow: 'Banned from the race',
        title: 'Ranks',
        who: 'Tracker Alpha banned you from the leaderboard.',
        next: 'You can’t join the race or its chat until the ban is lifted.',
      };
  }
};

/** One line for a system notification, when the tab is hidden. */
export const noticeNotification = (n: ModerationNotice): { title: string; body: string } => {
  const c = noticeCopy(n);
  return { title: c.eyebrow, body: n.reason ? `${c.who} Reason: ${n.reason}` : c.who };
};

/** Turns a Postgres/PostgREST error into something a person can read. */
export const humanError = (error: unknown): string => {
  const e = error as { code?: string; message?: string } | null;
  const code = e?.code ?? '';
  const message = e?.message ?? '';
  if (code === '42P01' || code === 'PGRST202' || code === 'PGRST205'
    || /could not find the (table|function)|does not exist/i.test(message)) {
    return 'MODERATION ISN’T SET UP YET — RUN supabase/moderation.sql.';
  }
  if (code === '42501' || /row-level security|not authorized/i.test(message)) return 'You don’t have permission to do that.';
  if (/failed to fetch|network|timeout|load failed/i.test(message)) return 'No connection. Check your network and try again.';
  return 'Something went wrong. Try again in a moment.';
};

const rpc = async <T>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
};

/** Trimmed, or left out entirely — so an empty reason is never sent as a value. */
export const reasonArg = (reason: string): { p_reason?: string } => {
  const r = reason.trim().slice(0, MAX_REASON);
  return r ? { p_reason: r } : {};
};

/* ── The removed person ── */

/**
 * Unread notices, oldest first. Never throws: before moderation.sql is run the
 * table does not exist, and that must not surface anywhere in the app.
 */
export const fetchUnreadNotices = async (): Promise<ModerationNotice[]> => {
  try {
    const { data, error } = await supabase
      .from('moderation_notices')
      .select('id, kind, context, reason, by_staff, created_at')
      .is('read_at', null)
      .order('created_at', { ascending: true })
      .limit(20);
    if (error) return [];
    return (data as ModerationNotice[]) ?? [];
  } catch {
    return [];
  }
};

export const ackNotice = (id: string): Promise<void> => rpc('ack_moderation_notice', { p_notice: id });

/**
 * Asked before joining the race again. Clears a plain removal; a ban answers
 * 'banned'. A project without moderation.sql has nothing to clear, so a
 * missing function is 'ok'.
 */
export const rejoinLeaderboard = async (): Promise<'ok' | 'banned'> => {
  try {
    const status = await rpc<string>('rejoin_leaderboard');
    return status === 'banned' ? 'banned' : 'ok';
  } catch (e) {
    if (humanError(e).startsWith('MODERATION ISN’T SET UP')) return 'ok';
    throw e;
  }
};

/* ── Staff ── */

export interface StaffMember {
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export const fetchStaffGroupMembers = (groupId: string): Promise<StaffMember[]> =>
  rpc<StaffMember[] | null>('staff_group_members', { p_group: groupId }).then(rows => rows ?? []);

export const staffRemoveGroupMember = (groupId: string, userId: string, ban: boolean, reason: string): Promise<void> =>
  rpc('staff_remove_group_member', { p_group: groupId, p_user: userId, p_ban: ban, ...reasonArg(reason) });

export const staffRemoveFromLeaderboard = (userId: string, date: string, ban: boolean, reason: string): Promise<void> =>
  rpc('staff_remove_from_leaderboard', { p_user: userId, p_date: date, p_ban: ban, ...reasonArg(reason) });

export interface LeaderboardBan {
  user_id: string;
  display_name: string | null;
  reason: string | null;
  blocked_at: string;
}

export const fetchLeaderboardBans = async (): Promise<LeaderboardBan[]> => {
  const { data, error } = await supabase
    .from('leaderboard_blocks')
    .select('user_id, display_name, reason, blocked_at')
    .eq('banned', true)
    .order('blocked_at', { ascending: false });
  if (error) throw error;
  return (data as LeaderboardBan[]) ?? [];
};

export const staffUnbanLeaderboard = (userId: string): Promise<void> =>
  rpc('staff_unban_leaderboard', { p_user: userId });

/* ── Staff: hiding a racer ──
   Silent and timed (supabase/moderation.sql §3b). The person is never told
   and their own screen does not change; everybody else's board and race chat
   simply leave them out until `hidden_until`. */

/** Hides may run at most this long — mirrors the CHECK constraint. */
export const MAX_HIDE_DAYS = 30;

export interface LeaderboardHide {
  user_id: string;
  display_name: string | null;
  note: string | null;
  hidden_until: string;
}

/**
 * The next 04:00 IST — the instant today's race ends and tomorrow's starts.
 * IST has no daylight saving, so a fixed +05:30 offset is exact.
 */
export const nextRollover = (now: Date = new Date()): Date => {
  const studyDay = getISTDateString(now);
  const start = Date.parse(`${studyDay}T${String(DAY_START_HOUR).padStart(2, '0')}:00:00+05:30`);
  return new Date(start + 86_400_000);
};

export const staffHideFromLeaderboard = (userId: string, until: Date, note: string): Promise<void> =>
  rpc('staff_hide_from_leaderboard', {
    p_user: userId,
    p_from: getISTDateString(),
    p_until: until.toISOString(),
    ...(note.trim() ? { p_note: note.trim().slice(0, MAX_REASON) } : {}),
  });

export const staffUnhideLeaderboard = (userId: string): Promise<void> =>
  rpc('staff_unhide_leaderboard', { p_user: userId });

/** Hides still running. Lapsed rows stay in the table but no longer do anything. */
export const fetchLeaderboardHides = async (): Promise<LeaderboardHide[]> => {
  const { data, error } = await supabase
    .from('leaderboard_hides')
    .select('user_id, display_name, note, hidden_until')
    .gt('hidden_until', new Date().toISOString())
    .order('hidden_until', { ascending: true });
  if (error) throw error;
  return (data as LeaderboardHide[]) ?? [];
};
