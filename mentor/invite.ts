/* ── Mentor beta invites ──
   The Groups invite system, pointed at the beta: same 12-character codes,
   same normalisation, same throttle on the server, and the same
   carry-through-sign-up link handling (groups/invite.ts). Only the link's key
   differs — `/?beta=CODE` — so a Mentor invite can never be mistaken for a
   group one, or the other way round. */

import { supabase } from '../supabaseClient';
import { pendingInviteSlot } from '../groups/invite';
import { normalizeInviteCode } from '../groups/api';

export { formatInviteCode, isCompleteCode, normalizeInviteCode } from '../groups/api';

const slot = pendingInviteSlot('beta', 'mentor_pending_invite_v1');
export const takePendingBetaInvite = slot.take;
export const clearPendingBetaInvite = slot.clear;

export const betaInviteLink = (code: string): string =>
  `${window.location.origin}/?beta=${normalizeInviteCode(code)}`;

export type BetaInviteStatus =
  | 'ok' | 'joined' | 'member'
  | 'invalid' | 'revoked' | 'expired' | 'exhausted' | 'full' | 'throttled';

export const BETA_STATUS_COPY: Record<BetaInviteStatus, string> = {
  ok: 'This invite is good.',
  joined: "You're in.",
  member: "You're already in the beta.",
  invalid: "That code doesn't exist. Check it and try again.",
  revoked: 'That invite was cancelled by the person who sent it.',
  expired: 'That invite has expired. Ask for a fresh one.',
  exhausted: 'That invite has already been used.',
  full: 'The beta is full right now. Hold on to the invite and try again later.',
  throttled: 'Too many wrong codes. Wait 15 minutes and try again.',
};

export interface BetaInvite {
  id: string;
  code: string;
  created_at: string;
  expires_at: string | null;
  max_uses: number;
  uses: number;
  revoked_at: string | null;
}

/** Status, never a thrown error for an ordinary "no" — the server returns those as values. */
export const previewBetaInvite = async (code: string): Promise<BetaInviteStatus> => {
  const { data, error } = await supabase.rpc('preview_mentor_invite', { p_code: code });
  if (error) throw error;
  return (data?.status ?? 'invalid') as BetaInviteStatus;
};

export const redeemBetaInvite = async (code: string): Promise<BetaInviteStatus> => {
  const { data, error } = await supabase.rpc('redeem_mentor_invite', { p_code: code });
  if (error) throw error;
  return (data?.status ?? 'invalid') as BetaInviteStatus;
};

export const createBetaInvite = async (maxUses: number, expiresHours: number): Promise<BetaInvite> => {
  const { data, error } = await supabase.rpc('create_mentor_invite', { p_max_uses: maxUses, p_expires_hours: expiresHours });
  if (error) throw error;
  return data as BetaInvite;
};

export const revokeBetaInvite = async (id: string): Promise<void> => {
  const { error } = await supabase.rpc('revoke_mentor_invite', { p_invite: id });
  if (error) throw error;
};

/** The caller's own invites — RLS returns nobody else's. */
export const listBetaInvites = async (): Promise<BetaInvite[]> => {
  const { data, error } = await supabase
    .from('mentor_invites')
    .select('id, code, created_at, expires_at, max_uses, uses, revoked_at')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as BetaInvite[];
};

/** A live invite can still let someone in. */
export const isLive = (i: BetaInvite): boolean =>
  !i.revoked_at && i.uses < i.max_uses && (!i.expires_at || Date.parse(i.expires_at) > Date.now());

export const inviteError = (error: unknown): string => {
  const e = error as { code?: string; message?: string; hint?: string } | null;
  const message = e?.message ?? '';
  if (e?.code === 'PGRST202' || e?.code === 'PGRST205' || e?.code === '42P01' || /could not find|does not exist/i.test(message)) {
    return "The beta isn't set up yet — run supabase/mentor.sql.";
  }
  if (e?.hint === 'invite_limit') return 'You have 20 live invites already. Revoke one first.';
  if (e?.code === '42501' || /not authorized|not authenticated/i.test(message)) return "You don't have permission to do that.";
  if (/failed to fetch|network|timeout|load failed/i.test(message)) return 'No connection. Check your network and try again.';
  return 'Something went wrong. Try again in a moment.';
};
