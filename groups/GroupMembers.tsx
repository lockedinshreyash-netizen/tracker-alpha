/* ── Members, invites, settings ──
   Every control here is drawn only for somebody the database would let use
   it, and every one of them is re-checked there anyway: an admin sees Remove
   on members and not on the owner because remove_member() would refuse the
   owner, not because this file decided so. The drawing mirrors the rules in
   supabase/groups.sql §5 — it does not define them. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserChip } from '../profile/Avatar';
import { useProfiles } from '../profile/profileCache';
import {
  GroupBan,
  GroupInvite,
  GroupMember,
  JoinRequest,
  MyGroup,
  createInvite,
  deleteGroup,
  fetchBans,
  fetchInvites,
  fetchJoinRequests,
  fetchMembers,
  formatInviteCode,
  humanError,
  inviteLink,
  leaveGroup,
  removeMember,
  respondJoinRequest,
  revokeInvite,
  setMemberRole,
  transferOwnership,
  unbanMember,
} from './api';
import { GroupsState } from './useGroups';
import { EditGroupSheet } from './GroupSheets';
import { Eyebrow, RoleBadge, Segmented, btn, tokens } from './ui';

interface Props {
  group: MyGroup;
  userId: string;
  groups: GroupsState;
  onLeft: () => void;
  onOpenProfile: (userId: string) => void;
  theme: 'dark' | 'light';
}

type Expiry = '24' | '168' | '720' | 'never';
type Uses = 'any' | '1' | '10' | '50';

const expiresLabel = (iso: string | null): string => {
  if (!iso) return 'Never expires';
  const ms = new Date(iso).getTime() - Date.now();
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return 'Expires within the hour';
  if (hours < 48) return `Expires in ${hours}h`;
  return `Expires in ${Math.round(hours / 24)} days`;
};

const TASK_BADGE: Record<string, string> = { summary: 'Task count', tasks: 'Tasks' };

/* The admin's side of the same refusals INVITE_STATUS_COPY words for the joiner. */
const APPROVAL_COPY: Record<string, string> = {
  banned: 'They’re banned from this group. Unban them first.',
  full: 'This group is full — 500 members.',
  limit: 'They’re already in 30 groups.',
};

const GroupMembers: React.FC<Props> = ({ group, userId, groups, onLeft, onOpenProfile, theme }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const isOwner = group.role === 'owner';
  const isAdmin = group.role === 'owner' || group.role === 'admin';
  const canInvite = isAdmin || group.invite_policy === 'members';

  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [bans, setBans] = useState<GroupBan[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [managing, setManaging] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [expiry, setExpiry] = useState<Expiry>('168');
  const [uses, setUses] = useState<Uses>('any');
  const [fresh, setFresh] = useState<GroupInvite | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [m, inv, b, rq] = await Promise.all([
        fetchMembers(group.id),
        canInvite ? fetchInvites(group.id) : Promise.resolve([]),
        isAdmin ? fetchBans(group.id) : Promise.resolve([]),
        // Requests exist only for a public group that asks; anything else has none to fetch.
        isAdmin && group.join_policy === 'request' ? fetchJoinRequests(group.id) : Promise.resolve([]),
      ]);
      setMembers(m);
      setInvites(inv);
      setBans(b);
      setRequests(rq);
      setError(null);
    } catch (e) {
      setError(humanError(e));
      setMembers(prev => prev ?? []);
    }
  }, [group.id, group.join_policy, canInvite, isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const profileIds = useMemo(
    () => [...(members ?? []).map(m => m.user_id), ...bans.map(b => b.user_id), ...requests.map(r => r.user_id)],
    [members, bans, requests]
  );
  const profiles = useProfiles(profileIds);
  const nameOf = (id: string) => profiles[id]?.display_name ?? (id === userId ? 'You' : 'Member');

  /** Runs one action, then re-reads everything it could have changed. Leaving
      and deleting skip the member re-read: this caller is no longer allowed it. */
  const act = async (key: string, fn: () => Promise<void>, after?: () => void, stayed = true) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      after?.();
      await Promise.all([stayed ? load() : Promise.resolve(), groups.refresh()]);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  };

  const mint = () => act('invite', async () => {
    const created = await createInvite(
      group.id,
      expiry === 'never' ? null : Number(expiry),
      uses === 'any' ? null : Number(uses)
    );
    setFresh(created);
  });

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(c => (c === key ? null : c)), 1800);
    } catch {
      window.prompt('Copy this:', text);
    }
  };

  /* navigator.share with text only — no files, so every browser that has it
     can take it; desktop browsers without it get the copy button alone. */
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const share = (inv: GroupInvite) => {
    void navigator.share({
      title: group.name,
      text: `Join ${group.name} on Tracker Alpha. Code: ${formatInviteCode(inv.code)}`,
      url: inviteLink(inv.code),
    }).catch(() => { /* dismissed */ });
  };

  const canManage = (m: GroupMember): boolean => {
    if (m.user_id === userId) return false;
    if (isOwner) return true;
    return group.role === 'admin' && m.role === 'member';
  };

  const section = `rounded-xl border overflow-hidden ${t.card}`;
  const small = `text-[10px] font-black uppercase tracking-[0.1em] font-ui`;

  return (
    <div className="space-y-5">
      {error && <p className={`text-[11px] font-ui px-4 py-3 rounded-lg border ${t.inset} text-[#E10600]`}>{error}</p>}

      {/* ── Requests to join ── first, because somebody is waiting on them. */}
      {isAdmin && requests.length > 0 && (
        <section className={section}>
          <div className="px-5 md:px-6 pt-5 pb-3">
            <Eyebrow dark={dark}>{requests.length} {requests.length === 1 ? 'request' : 'requests'} to join</Eyebrow>
          </div>
          <ul className="pb-2">
            {requests.map(r => {
              const shares = [r.share_hours && 'hours', r.share_tasks !== 'private' && TASK_BADGE[r.share_tasks]?.toLowerCase()]
                .filter(Boolean).join(' · ');
              const answer = (approve: boolean) => void act(`req-${r.user_id}`, async () => {
                const result = await respondJoinRequest(group.id, r.user_id, approve);
                // Approval re-checks bans and limits; say which one stopped it.
                if (result.status !== 'approved' && result.status !== 'declined' && result.status !== 'gone') {
                  setError(APPROVAL_COPY[result.status] ?? 'Couldn’t add them.');
                }
              });
              return (
                <li key={r.user_id} className="px-5 md:px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <UserChip
                        userId={r.user_id}
                        name={nameOf(r.user_id)}
                        profile={profiles[r.user_id]}
                        onOpen={onOpenProfile}
                        theme={theme}
                        size={30}
                        nameClassName={`truncate text-[13px] font-bold font-ui ${t.heading}`}
                      />
                      <p className={`text-[10px] font-ui mt-1 ${t.muted}`}>
                        Will share: {shares || 'nothing'}
                      </p>
                    </div>
                    <button onClick={() => answer(false)} disabled={busy === `req-${r.user_id}`} className={`${small} ${t.muted} hover:text-[#E10600]`}>
                      Decline
                    </button>
                    <button onClick={() => answer(true)} disabled={busy === `req-${r.user_id}`} className={`px-4 py-2 ${btn} ${t.primary}`}>
                      Approve
                    </button>
                  </div>
                  {r.message && (
                    <p className={`mt-2 ml-10 text-[12px] font-ui italic leading-relaxed ${t.body}`}>“{r.message}”</p>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Invite ── */}
      {canInvite && (
        <section className={`p-6 md:p-8 rounded-xl border ${t.card}`}>
          <Eyebrow dark={dark}>Invite people</Eyebrow>

          {fresh ? (
            <div className="mt-4">
              <p className={`text-[11px] font-ui ${t.muted}`}>Send them the link, or read out the code.</p>
              <p className={`font-display text-3xl md:text-4xl tracking-[0.08em] mt-3 ${t.heading}`}>{formatInviteCode(fresh.code)}</p>
              <p className={`text-[11px] font-ui mt-2 break-all ${t.muted}`}>{inviteLink(fresh.code)}</p>
              <div className="flex flex-wrap gap-2 mt-5">
                <button onClick={() => void copy(inviteLink(fresh.code), 'fresh')} className={`px-6 py-3 ${btn} ${t.primary}`}>
                  {copied === 'fresh' ? 'Copied' : 'Copy link'}
                </button>
                {canShare && <button onClick={() => share(fresh)} className={`px-6 py-3 ${btn} ${t.ghost}`}>Share</button>}
                <button onClick={() => setFresh(null)} className={`px-4 py-3 ${small} ${t.muted}`}>Done</button>
              </div>
              <p className={`text-[10px] font-ui mt-4 ${t.muted}`}>
                {expiresLabel(fresh.expires_at)} · {fresh.max_uses ? `${fresh.max_uses} ${fresh.max_uses === 1 ? 'use' : 'uses'}` : 'Unlimited uses'}
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className={`text-[9px] font-black uppercase tracking-[0.14em] mb-2 font-ui ${t.muted}`}>Expires</p>
                <Segmented<Expiry>
                  value={expiry}
                  onChange={setExpiry}
                  options={[
                    { value: '24', label: '1 day' },
                    { value: '168', label: '7 days' },
                    ...(isAdmin ? [{ value: '720' as Expiry, label: '30 days' }, { value: 'never' as Expiry, label: 'Never' }] : []),
                  ]}
                  dark={dark}
                  label="Invite expiry"
                  size="sm"
                />
              </div>
              <div>
                <p className={`text-[9px] font-black uppercase tracking-[0.14em] mb-2 font-ui ${t.muted}`}>Uses</p>
                <Segmented<Uses>
                  value={uses}
                  onChange={setUses}
                  options={[
                    { value: 'any', label: 'Unlimited' },
                    { value: '1', label: '1' },
                    { value: '10', label: '10' },
                    { value: '50', label: '50' },
                  ]}
                  dark={dark}
                  label="Invite uses"
                  size="sm"
                />
              </div>
              <button onClick={() => void mint()} disabled={busy === 'invite'} className={`w-full py-4 ${btn} ${busy === 'invite' ? t.disabled : t.primary}`}>
                {busy === 'invite' ? 'Creating…' : 'Create invite link'}
              </button>
            </div>
          )}

          {invites.length > 0 && (
            <div className={`mt-6 pt-5 border-t ${t.rule}`}>
              <p className={`text-[9px] font-black uppercase tracking-[0.14em] mb-3 font-ui ${t.muted}`}>
                {isAdmin ? 'Live invites' : 'Your live invites'}
              </p>
              <ul className="space-y-2">
                {invites.map(inv => (
                  <li key={inv.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${t.inset}`}>
                    <div className="min-w-0 flex-1">
                      <p className={`font-data text-[12px] tracking-[0.12em] ${t.heading}`}>{formatInviteCode(inv.code)}</p>
                      <p className={`text-[10px] font-ui mt-0.5 ${t.muted}`}>
                        {inv.uses}{inv.max_uses ? `/${inv.max_uses}` : ''} used · {expiresLabel(inv.expires_at)}
                        {isAdmin && inv.created_by && inv.created_by !== userId && <> · by {nameOf(inv.created_by)}</>}
                      </p>
                    </div>
                    <button onClick={() => void copy(inviteLink(inv.code), inv.id)} className={`${small} ${t.muted} hover:text-[#E10600]`}>
                      {copied === inv.id ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Revoke this invite? Anyone holding the link won’t be able to use it.')) {
                          void act(`revoke-${inv.id}`, () => revokeInvite(inv.id), () => { if (fresh?.id === inv.id) setFresh(null); });
                        }
                      }}
                      disabled={busy === `revoke-${inv.id}`}
                      className={`${small} text-[#E10600]`}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ── Roster ── */}
      <section className={section}>
        <div className="px-5 md:px-6 pt-5 pb-3">
          <Eyebrow dark={dark}>{group.member_count} {group.member_count === 1 ? 'member' : 'members'}</Eyebrow>
        </div>
        {members === null ? (
          <div className="px-5 md:px-6 pb-5 space-y-2" aria-busy="true">
            {[0, 1, 2].map(i => <div key={i} className={`h-11 rounded-lg animate-pulse ${dark ? 'bg-white/[0.03]' : 'bg-[#F2F0EC]'}`} />)}
          </div>
        ) : (
          <ul className="pb-2">
            {members.map(m => {
              const open = managing === m.user_id;
              return (
                <li key={m.user_id} className="px-5 md:px-6 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <UserChip
                        userId={m.user_id}
                        name={m.user_id === userId ? `${nameOf(m.user_id)} (you)` : nameOf(m.user_id)}
                        profile={profiles[m.user_id]}
                        onOpen={onOpenProfile}
                        theme={theme}
                        size={30}
                        nameClassName={`truncate text-[13px] font-bold font-ui ${t.heading}`}
                      />
                      <RoleBadge role={m.role} dark={dark} />
                    </div>
                    <div className={`hidden sm:flex items-center gap-1.5 text-[9px] font-ui ${t.muted}`}>
                      {m.share_hours && <span className={`px-1.5 py-0.5 rounded border ${t.rule}`}>Hours</span>}
                      {TASK_BADGE[m.share_tasks] && <span className={`px-1.5 py-0.5 rounded border ${t.rule}`}>{TASK_BADGE[m.share_tasks]}</span>}
                    </div>
                    {canManage(m) && (
                      <button
                        onClick={() => setManaging(open ? null : m.user_id)}
                        aria-expanded={open}
                        aria-label={`Manage ${nameOf(m.user_id)}`}
                        className={`px-2 py-1 rounded-md ${t.muted} ${t.hover}`}
                      >
                        ⋯
                      </button>
                    )}
                  </div>
                  {open && (
                    <div className={`mt-2 ml-10 flex flex-wrap gap-x-5 gap-y-2`}>
                      {isOwner && m.role === 'member' && (
                        <button onClick={() => void act(`role-${m.user_id}`, () => setMemberRole(group.id, m.user_id, 'admin'), () => setManaging(null))} className={`${small} ${t.body} hover:text-[#E10600]`}>
                          Make admin
                        </button>
                      )}
                      {isOwner && m.role === 'admin' && (
                        <button onClick={() => void act(`role-${m.user_id}`, () => setMemberRole(group.id, m.user_id, 'member'), () => setManaging(null))} className={`${small} ${t.body} hover:text-[#E10600]`}>
                          Remove admin
                        </button>
                      )}
                      {isOwner && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Make ${nameOf(m.user_id)} the owner? You’ll become an admin, and only they can undo this.`)) {
                              void act(`own-${m.user_id}`, () => transferOwnership(group.id, m.user_id), () => setManaging(null));
                            }
                          }}
                          className={`${small} ${t.body} hover:text-[#E10600]`}
                        >
                          Transfer ownership
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove ${nameOf(m.user_id)}? They can rejoin with a new invite.`)) {
                            void act(`rm-${m.user_id}`, () => removeMember(group.id, m.user_id, false), () => setManaging(null));
                          }
                        }}
                        className={`${small} text-[#E10600]`}
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove and ban ${nameOf(m.user_id)}? No invite will let them back in until an admin unbans them.`)) {
                            void act(`ban-${m.user_id}`, () => removeMember(group.id, m.user_id, true), () => setManaging(null));
                          }
                        }}
                        className={`${small} text-[#E10600]`}
                      >
                        Remove & ban
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Bans ── */}
      {isAdmin && bans.length > 0 && (
        <section className={section}>
          <div className="px-5 md:px-6 pt-5 pb-3"><Eyebrow dark={dark}>Banned</Eyebrow></div>
          <ul className="pb-2">
            {bans.map(b => (
              <li key={b.user_id} className="px-5 md:px-6 py-2.5 flex items-center gap-3">
                <span className={`flex-1 truncate text-[13px] font-ui ${t.muted}`}>{nameOf(b.user_id)}</span>
                <button onClick={() => void act(`unban-${b.user_id}`, () => unbanMember(group.id, b.user_id))} className={`${small} ${t.body} hover:text-[#E10600]`}>
                  Unban
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Settings & leaving ── */}
      <section className={`p-6 md:p-8 rounded-xl border ${t.card} space-y-4`}>
        <Eyebrow dark={dark}>Group</Eyebrow>
        {isAdmin && (
          <button onClick={() => setEditing(true)} className={`w-full py-3.5 ${btn} ${t.ghost}`}>Edit name, icon & invite rules</button>
        )}
        <button
          onClick={() => {
            const note = isOwner
              ? group.member_count > 1
                ? 'Leave this group? Ownership passes to the longest-standing admin, or member if there are no admins.'
                : 'Leave this group? You’re the only member, so the group and its chat will be deleted.'
              : 'Leave this group? Your hours and tasks stop being visible to it immediately.';
            if (window.confirm(note)) void act('leave', () => leaveGroup(group.id), onLeft, false);
          }}
          disabled={busy === 'leave'}
          className={`w-full py-3.5 ${btn} ${t.ghost}`}
        >
          Leave group
        </button>
        {isOwner && (
          <button
            onClick={() => {
              const typed = window.prompt(`This deletes ${group.name}, its chat and every invite, for everyone. Type the group name to confirm.`);
              if (typed !== null && typed.trim().toLowerCase() === group.name.trim().toLowerCase()) {
                void act('delete', () => deleteGroup(group.id), onLeft, false);
              }
            }}
            disabled={busy === 'delete'}
            className={`w-full py-3.5 ${btn} border border-[#E10600]/40 text-[#E10600] hover:bg-[#E10600]/[0.06]`}
          >
            Delete group
          </button>
        )}
      </section>

      {editing && (
        <EditGroupSheet
          group={group}
          theme={theme}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); void groups.refresh(); }}
        />
      )}
    </div>
  );
};

export default GroupMembers;
