/* ── Access, as the server answers it ──
   Thin wrappers over supabase/access.sql. Every answer is the server's: the
   client never decides who is a member, it only decides what to draw.

   `missing` means the SQL has not been run on this project. The Gate stays
   shut (useAccess fails closed), so run access.sql before deploying. */

import { supabase } from '../supabaseClient';

export type AccessSource = 'founding' | 'invite' | 'waitlist' | 'pass' | 'admin';

/** A member's public face: the profile card plus the member number. */
export interface MemberFace {
  name?: string | null;
  avatar_type?: 'alpha' | 'upload' | null;
  avatar_id?: string | null;
  avatar_url?: string | null;
  member_no?: number | null;
  founding?: boolean | null;
}

export interface MemberInfo {
  source: AccessSource;
  memberNo: number | null;
  grantedAt: string | null;
  invitedBy: MemberFace | null;
  invite: { code: string; redeemedAt: string | null; redeemedBy: MemberFace | null } | null;
}

export type AccessAnswer =
  | { status: 'member'; member: MemberInfo }
  | { status: 'waitlist'; position: number; wantsPass: boolean }
  | { status: 'none' }
  | { status: 'missing' }
  | { status: 'error' };

export type PreviewStatus = 'ok' | 'invalid' | 'used' | 'self' | 'member' | 'throttled' | 'missing' | 'error';
export type RedeemStatus = 'joined' | 'invalid' | 'used' | 'self' | 'member' | 'throttled' | 'missing' | 'error';

const isMissing = (code?: string) =>
  code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST205';

/* eslint-disable @typescript-eslint/no-explicit-any */
const toAnswer = (d: any): AccessAnswer => {
  if (d?.status === 'member') {
    return {
      status: 'member',
      member: {
        source: d.source,
        memberNo: typeof d.member_no === 'number' ? d.member_no : null,
        grantedAt: d.granted_at ?? null,
        invitedBy: d.invited_by ?? null,
        invite: d.invite
          ? { code: String(d.invite.code), redeemedAt: d.invite.redeemed_at ?? null, redeemedBy: d.invite.redeemed_by ?? null }
          : null,
      },
    };
  }
  if (d?.status === 'waitlist') {
    return { status: 'waitlist', position: Number(d.position) || 1, wantsPass: !!d.wants_pass };
  }
  if (d?.status === 'none') return { status: 'none' };
  return { status: 'error' };
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const call = async (fn: string, args?: Record<string, unknown>): Promise<AccessAnswer> => {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) return isMissing(error.code) ? { status: 'missing' } : { status: 'error' };
    return toAnswer(data);
  } catch {
    return { status: 'error' };
  }
};

export const fetchAccess = (): Promise<AccessAnswer> => call('my_access');

export interface WaitlistApplication {
  exam: 'JEE' | 'NEET';
  class: 11 | 12 | 13;
  goal_hours?: number | null;
  why?: string | null;
  wants_pass: boolean;
  /** The earliest day this device shows Alpha in use, for a guest from before (device.ts). */
  device_since?: string | null;
}

export const joinWaitlist = (app: WaitlistApplication): Promise<AccessAnswer> =>
  call('join_waitlist', { p: app });

export const previewAccessInvite = async (code: string): Promise<{ status: PreviewStatus; inviter?: MemberFace }> => {
  try {
    const { data, error } = await supabase.rpc('preview_access_invite', { p_code: code });
    if (error) return { status: isMissing(error.code) ? 'missing' : 'error' };
    return { status: data?.status ?? 'error', inviter: data?.inviter ?? undefined };
  } catch {
    return { status: 'error' };
  }
};

export const redeemAccessInvite = async (code: string): Promise<{ status: RedeemStatus; inviter?: MemberFace }> => {
  try {
    const { data, error } = await supabase.rpc('redeem_access_invite', { p_code: code });
    if (error) return { status: isMissing(error.code) ? 'missing' : 'error' };
    return { status: data?.status ?? 'error', inviter: data?.inviter ?? undefined };
  } catch {
    return { status: 'error' };
  }
};

/* ── Staff (admin/AccessAdmin.tsx) ── */

export interface AccessOverview {
  cutover: string;
  by_source: Partial<Record<AccessSource, number>>;
  device_claims: number;
  founding_unnumbered: number;
  invites_redeemed: number;
  invites_open: number;
  waiting: number;
  waiting_wants_pass: number;
  waiting_used_before?: number;
  admitted_from_waitlist: number;
}

export interface WaitlistRow {
  user_id: string;
  place: number;
  name: string | null;
  exam: 'JEE' | 'NEET' | null;
  class: number | null;
  goal_hours: number | null;
  why: string | null;
  wants_pass: boolean;
  device_since?: string | null;
  joined_at: string;
}

const staff = async <T,>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (isMissing(error.code)) throw new Error('missing');
    throw new Error(error.message);
  }
  return data as T;
};

export const accessOverview = () => staff<AccessOverview>('admin_access_overview');
export const fetchWaitlist = (after: number | null, limit = 50) =>
  staff<WaitlistRow[]>('admin_waitlist', { p_limit: limit, p_after: after });
export const admitUsers = (ids: string[]) => staff<number>('admin_admit', { p_users: ids });
export const admitNext = (count: number) => staff<number>('admin_admit_next', { p_count: count });
export const grantAccessByEmail = (email: string) =>
  staff<{ status: 'granted' | 'already' | 'no_account' }>('admin_grant_access', { p_email: email });
