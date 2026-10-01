/* ── Members: who is in the group, and what each of them is doing today ──
   The roster and the task progress used to be two tabs with two lists of the
   same people. They are one list now: every member once, with their Focus
   Tasks for today on the right — a count and a bar, or the tasks themselves
   when they chose to show every task — and nothing at all beyond "Tasks
   hidden" when they didn't. What each person shows is theirs to decide and the
   database's to enforce (group_task_progress); this file only draws it.

   Management lives on the row it acts on (⋯), drawn only for somebody the
   database would let use it. Requests to join come first, because somebody is
   waiting on them. Invites, sharing and group settings are not here — they
   are sheets opened from the group header, so this tab is people and nothing
   else. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Task } from '../types';
import { getISTDateString } from '../utils';
import { UserChip } from '../profile/Avatar';
import { useProfiles } from '../profile/profileCache';
import { ProfileSummary } from '../profile/profileApi';
import {
  GroupMember,
  JoinRequest,
  MyGroup,
  SharedTask,
  TaskProgressEntry,
  fetchJoinRequests,
  fetchMembers,
  fetchTaskProgress,
  humanError,
  removeMember,
  respondJoinRequest,
  setMemberRole,
  transferOwnership,
} from './api';
import { taskSnapshot } from './publish';
import { GroupsState } from './useGroups';
import { Eyebrow, RoleBadge, btn, tokens } from './ui';
import RemoveForm from '../moderation/RemoveForm';

const REFRESH_MS = 60_000;

/* The admin's side of the same refusals INVITE_STATUS_COPY words for the joiner. */
const APPROVAL_COPY: Record<string, string> = {
  banned: 'They’re banned from this group. Unban them first.',
  full: 'This group is full — 500 members.',
  limit: 'They’re already in 30 groups.',
};

/** What one member's row shows about their tasks today. */
export type TaskView =
  | { kind: 'hidden' }
  | { kind: 'stale' }
  | { kind: 'today'; done: number; total: number; tasks: SharedTask[] | null };

interface Props {
  group: MyGroup;
  userId: string;
  tasks: Task[];
  groups: GroupsState;
  onInvite: () => void;
  onOpenProfile: (userId: string) => void;
  theme: 'dark' | 'light';
}

const GroupPeople: React.FC<Props> = ({ group, userId, tasks, groups, onInvite, onOpenProfile, theme }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const isOwner = group.role === 'owner';
  const isAdmin = group.role === 'owner' || group.role === 'admin';

  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [progress, setProgress] = useState<TaskProgressEntry[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [managing, setManaging] = useState<string | null>(null);
  /* The member whose Remove form is open. The reason typed there is shown to
     them as a notice (moderation/). */
  const [removing, setRemoving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    try {
      const [m, rq] = await Promise.all([
        fetchMembers(group.id),
        // Requests exist only for a public group that asks; anything else has none to fetch.
        isAdmin && group.join_policy === 'request' ? fetchJoinRequests(group.id) : Promise.resolve([]),
      ]);
      setMembers(m);
      setRequests(rq);
      setError(null);
    } catch (e) {
      setError(humanError(e));
      setMembers(prev => prev ?? []);
    }
  }, [group.id, group.join_policy, isAdmin]);

  /* Task progress moves through the day, so it refreshes on its own clock; the
     roster only changes when somebody acts, which re-reads it explicitly. */
  const loadProgress = useCallback(async () => {
    try {
      setProgress(await fetchTaskProgress(group.id));
    } catch {
      // The roster still stands without it; rows fall back to "No update today".
    }
  }, [group.id]);

  useEffect(() => { void loadRoster(); }, [loadRoster]);
  useEffect(() => {
    void loadProgress();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadProgress();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [loadProgress]);

  const profileIds = useMemo(
    () => [...(members ?? []).map(m => m.user_id), ...requests.map(r => r.user_id)],
    [members, requests],
  );
  const profiles = useProfiles(profileIds);
  const nameOf = (id: string) => profiles[id]?.display_name ?? (id === userId ? 'You' : 'Member');

  const today = getISTDateString();
  const mine = useMemo(() => taskSnapshot(tasks, today, group.share_tasks), [tasks, today, group.share_tasks]);
  const byUser = useMemo(() => new Map(progress.map(p => [p.user_id, p])), [progress]);

  /* Your own row shows exactly what the others see — from your board, through
     the same function that publishes it — rather than the server's copy,
     which can be a minute behind the card you just ticked. */
  const viewOf = (m: GroupMember): TaskView => {
    if (m.share_tasks === 'private') return { kind: 'hidden' };
    if (m.user_id === userId) return { kind: 'today', done: mine.done, total: mine.total, tasks: mine.tasks };
    const p = byUser.get(m.user_id);
    if (!p || p.date !== today) return { kind: 'stale' };
    return { kind: 'today', done: p.done, total: p.total, tasks: p.share_tasks === 'tasks' ? p.tasks : null };
  };

  /** Runs one action, then re-reads what it could have changed. */
  const act = async (key: string, fn: () => Promise<void>, after?: () => void) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      after?.();
      await Promise.all([loadRoster(), groups.refresh()]);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  };

  const canManage = (m: GroupMember): boolean => {
    if (m.user_id === userId) return false;
    if (isOwner) return true;
    return group.role === 'admin' && m.role === 'member';
  };

  /* You first, then the roster in the server's order: owner, admins, members,
     longest-standing first. Stable, so the list does not reshuffle while an
     admin is reaching for a row. */
  const ordered = useMemo(() => {
    const list = members ?? [];
    return [...list.filter(m => m.user_id === userId), ...list.filter(m => m.user_id !== userId)];
  }, [members, userId]);

  const small = `text-[10px] font-black uppercase tracking-[0.1em] font-ui`;
  const section = `rounded-xl border overflow-hidden ${t.card}`;

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
              const shares = [
                r.share_hours && 'their study hours',
                r.share_tasks === 'summary' && 'how many tasks they’ve done',
                r.share_tasks === 'tasks' && 'every task on their list',
              ].filter(Boolean).join(' and ');
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
                        {shares ? `Will show ${shares}` : 'Will show only their name'}
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

      {/* ── Everyone ── */}
      <section className={section}>
        <div className="px-5 md:px-6 pt-5 pb-2 flex items-baseline justify-between gap-3">
          <Eyebrow dark={dark}>{group.member_count} {group.member_count === 1 ? 'member' : 'members'}</Eyebrow>
          <span className={`text-[10px] font-ui ${t.muted}`}>Focus Tasks today</span>
        </div>

        {members === null ? (
          <div className="px-5 md:px-6 pb-5 space-y-2" aria-busy="true">
            {[0, 1, 2].map(i => <div key={i} className={`h-12 rounded-lg animate-pulse ${dark ? 'bg-white/[0.03]' : 'bg-zinc-50'}`} />)}
          </div>
        ) : (
          <ul className="pb-2">
            {ordered.map(m => {
              const isMe = m.user_id === userId;
              const open = managing === m.user_id;
              return (
                <li key={m.user_id} className={`px-5 md:px-6 py-3 ${isMe ? (dark ? 'bg-white/[0.02]' : 'bg-[#F7F5F0]') : ''}`}>
                  <PersonRow
                    userId={m.user_id}
                    name={isMe ? `${nameOf(m.user_id)} (you)` : nameOf(m.user_id)}
                    profile={profiles[m.user_id]}
                    role={m.role}
                    view={viewOf(m)}
                    expanded={expanded === m.user_id}
                    onToggle={() => setExpanded(expanded === m.user_id ? null : m.user_id)}
                    onOpenProfile={onOpenProfile}
                    theme={theme}
                    trailing={canManage(m) ? (
                      <button
                        onClick={() => { setManaging(open ? null : m.user_id); setRemoving(null); }}
                        aria-expanded={open}
                        aria-label={`Manage ${nameOf(m.user_id)}`}
                        className={`px-2 py-1 -mr-2 rounded-md ${t.muted} ${t.hover}`}
                      >
                        ⋯
                      </button>
                    ) : undefined}
                  />
                  {open && (
                    <div className="mt-3 ml-10 flex flex-wrap gap-x-5 gap-y-2">
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
                      {removing !== m.user_id && (
                        <button onClick={() => setRemoving(m.user_id)} className={`${small} text-[#E10600]`}>
                          Remove…
                        </button>
                      )}
                    </div>
                  )}
                  {open && removing === m.user_id && (
                    <div className="ml-10">
                      <RemoveForm
                        name={nameOf(m.user_id)}
                        from="group"
                        banMeans="No invite will let them back in until an admin unbans them."
                        dark={dark}
                        onCancel={() => setRemoving(null)}
                        onConfirm={async (reason, ban) => {
                          try {
                            await removeMember(group.id, m.user_id, ban, reason);
                          } catch (e) {
                            throw new Error(humanError(e));
                          }
                          setRemoving(null);
                          setManaging(null);
                          await Promise.all([loadRoster(), groups.refresh()]);
                        }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {members !== null && group.member_count <= 1 && (
          <div className={`mx-5 md:mx-6 mb-5 p-5 rounded-lg border ${t.inset}`}>
            <p className={`text-[12px] font-ui ${t.body}`}>It’s just you so far. A group of one is a diary.</p>
            <button onClick={onInvite} className={`mt-4 px-6 py-3 ${btn} ${t.primary}`}>Invite people</button>
          </div>
        )}
      </section>
    </div>
  );
};

/**
 * One member, as the group sees them: name and role, and their Focus Tasks for
 * today on the right. Used for every row of the Members list AND for the
 * "how you appear" preview in group settings, so the preview cannot say
 * something different from what the others are actually shown.
 *
 * `onToggle` null means the task list (when there is one) is always open —
 * the preview.
 */
export const PersonRow: React.FC<{
  userId: string;
  name: string;
  profile: ProfileSummary | undefined;
  role?: MyGroup['role'];
  view: TaskView;
  expanded: boolean;
  onToggle: (() => void) | null;
  onOpenProfile: (userId: string) => void;
  theme: 'dark' | 'light';
  trailing?: React.ReactNode;
}> = ({ userId, name, profile, role, view, expanded, onToggle, onOpenProfile, theme, trailing }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const today = view.kind === 'today' ? view : null;
  const list = today?.tasks ?? null;
  const hasList = !!list?.length;
  const open = hasList && (expanded || onToggle === null);
  const pct = today && today.total ? (today.done / today.total) * 100 : 0;

  return (
    <>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <UserChip
              userId={userId}
              name={name}
              profile={profile}
              onOpen={onOpenProfile}
              theme={theme}
              size={28}
              nameClassName={`truncate text-[13px] font-bold font-ui ${t.heading}`}
            />
            {role && <RoleBadge role={role} dark={dark} />}
          </div>
          {today && (
            <div className={`mt-2 ml-9 h-1 rounded-full overflow-hidden ${dark ? 'bg-white/[0.04]' : 'bg-zinc-200'}`}>
              <div className={`h-full rounded-full transition-all duration-700 ${dark ? 'bg-zinc-500' : 'bg-zinc-500'}`} style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        {today ? (
          <span className="text-right flex-shrink-0">
            <span className={`num-stat text-lg tabular-nums ${t.heading}`}>{today.done}/{today.total}</span>
            <span className={`block text-[9px] font-ui ${t.muted}`}>done today</span>
          </span>
        ) : (
          <span className={`flex-shrink-0 text-[10px] font-ui ${t.muted}`}>
            {view.kind === 'hidden' ? 'Tasks hidden' : 'No update today'}
          </span>
        )}
        {trailing}
      </div>

      {hasList && onToggle && (
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          className={`mt-2 ml-9 text-[10px] font-black uppercase tracking-[0.1em] font-ui ${t.muted} hover:text-[#E10600]`}
        >
          {expanded ? 'Hide tasks' : `See tasks (${list!.length})`}
        </button>
      )}
      {open && (
        <ul className="mt-2 ml-9 space-y-1.5">
          {list!.map((task, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className={`mt-[3px] w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center text-[8px] ${task.done ? (dark ? 'bg-zinc-600 border-zinc-600 text-white' : 'bg-zinc-500 border-zinc-400 text-white') : t.rule}`}
                aria-hidden="true"
              >
                {task.done ? '✓' : ''}
              </span>
              <span className={`text-[12px] font-ui ${task.done ? `line-through ${t.muted}` : t.body}`}>
                {task.text}
                <span className="sr-only">{task.done ? ' (done)' : ' (open)'}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {onToggle === null && today && list && !list.length && (
        <p className={`mt-2 ml-9 text-[11px] font-ui ${t.muted}`}>Nothing on your Focus Tasks list yet.</p>
      )}
    </>
  );
};

export default GroupPeople;
