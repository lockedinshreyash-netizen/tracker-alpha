/* ── Tasks: what you share, and what they share ──
   The privacy controls live at the top of this section, not in a settings
   page, because this is where their consequences are visible. Under them is
   a literal preview — your own row, drawn by the same MemberTaskRow as
   everyone else's, from your real board via the same function that publishes
   it (taskSnapshot) — so "what do they see" is answered by showing it, not
   by a sentence describing it.

   Settings are per group. A student can show their task list to three
   friends and only a count to a 200-person coaching batch, and the database
   enforces that split (group_task_progress), not this screen. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Task } from '../types';
import { getISTDateString } from '../utils';
import { UserChip } from '../profile/Avatar';
import { useProfiles } from '../profile/profileCache';
import { MyGroup, SharedTask, TaskProgressEntry, TaskShareLevel, fetchTaskProgress, humanError, setSharing } from './api';
import { ProfileSummary } from '../profile/profileApi';
import { taskSnapshot } from './publish';
import { GroupsState } from './useGroups';
import { Eyebrow, tokens } from './ui';
import SharingFields from './SharingFields';

interface Props {
  group: MyGroup;
  userId: string;
  tasks: Task[];
  groups: GroupsState;
  onOpenProfile: (userId: string) => void;
  theme: 'dark' | 'light';
}

const REFRESH_MS = 60_000;

const GroupProgress: React.FC<Props> = ({ group, userId, tasks, groups, onOpenProfile, theme }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const [rows, setRows] = useState<TaskProgressEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await fetchTaskProgress(group.id));
      setError(null);
    } catch (e) {
      setError(humanError(e));
      setRows(prev => prev ?? []);
    }
  }, [group.id]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const others = useMemo(() => (rows ?? []).filter(r => r.user_id !== userId), [rows, userId]);
  const profiles = useProfiles(useMemo(() => [userId, ...others.map(r => r.user_id)], [userId, others]));
  const today = getISTDateString();

  const mine = useMemo(() => taskSnapshot(tasks, today, group.share_tasks), [tasks, today, group.share_tasks]);

  const save = async (shareHours: boolean, shareTasks: TaskShareLevel) => {
    const before = { share_hours: group.share_hours, share_tasks: group.share_tasks };
    groups.patch(group.id, { share_hours: shareHours, share_tasks: shareTasks });
    setSaving(true);
    setSaveError(null);
    try {
      await setSharing(group.id, shareHours, shareTasks);
      // The publisher (useGroups) reacts to the new level on its own.
    } catch (e) {
      groups.patch(group.id, before);
      setSaveError(humanError(e));
    } finally {
      setSaving(false);
    }
  };

  const privateCount = Math.max(0, group.member_count - others.length - 1);
  const alone = group.member_count <= 1;
  const me = profiles[userId];
  const myName = me?.display_name ?? 'You';

  return (
    <div className="space-y-5">
      {/* ── Your sharing with this group ── */}
      <section className={`p-6 md:p-8 rounded-xl border ${t.card}`} aria-labelledby="sharing-heading">
        <Eyebrow dark={dark}><span id="sharing-heading">What other members of {group.name} can see</span></Eyebrow>

        <div className="mt-5">
          <SharingFields
            shareHours={group.share_hours}
            shareTasks={group.share_tasks}
            onChange={(h, tk) => void save(h, tk)}
            dark={dark}
            disabled={saving}
          />
        </div>
        {saveError && <p className="text-[11px] font-ui text-[#E10600] mt-3">{saveError}</p>}

        {/* The preview IS a member row — the same component the list below
            draws for everyone else — so it cannot say something different
            from what the others are actually shown. */}
        <div className={`mt-6 rounded-lg border ${t.inset}`}>
          <p className={`px-4 pt-3 text-[9px] font-black uppercase tracking-[0.12em] font-ui ${t.muted}`}>
            Preview · how you appear to other members
          </p>
          <div className="px-4 pb-4 pt-2">
            {group.share_tasks === 'private' ? (
              <>
                <UserChip
                  userId={userId}
                  name={myName}
                  profile={me}
                  onOpen={onOpenProfile}
                  theme={theme}
                  size={26}
                  nameClassName={`truncate text-[13px] font-bold font-ui ${t.heading}`}
                />
                <p className={`text-[12px] font-ui mt-2 ${t.muted}`}>Your tasks don’t appear here at all.</p>
              </>
            ) : (
              <MemberTaskRow
                userId={userId}
                name={myName}
                profile={me}
                current
                done={mine.done}
                total={mine.total}
                tasks={mine.tasks}
                expanded
                onToggle={null}
                onOpenProfile={onOpenProfile}
                theme={theme}
              />
            )}
            <p className={`text-[11px] font-ui mt-3 ${t.muted}`}>
              Study hours: {group.share_hours ? 'shown on the leaderboard' : 'hidden'}.
            </p>
          </div>
        </div>
      </section>

      {/* ── Theirs ── */}
      <section className={`rounded-xl border overflow-hidden ${t.card}`}>
        <div className="px-5 md:px-6 pt-5 pb-3">
          <Eyebrow dark={dark}>Other members’ tasks today</Eyebrow>
        </div>

        {error && <p className={`px-5 md:px-6 pb-3 text-[11px] font-ui ${t.muted}`}>{error}</p>}

        {rows === null ? (
          <div className="px-5 md:px-6 pb-5 space-y-2" aria-busy="true">
            {[0, 1].map(i => <div key={i} className={`h-12 rounded-lg animate-pulse ${dark ? 'bg-white/[0.03]' : 'bg-[#F2F0EC]'}`} />)}
          </div>
        ) : others.length === 0 ? (
          <p className={`px-5 md:px-6 pb-6 text-[12px] font-ui leading-relaxed ${t.muted}`}>
            {alone
              ? 'You’re the only member so far. Once people join, anyone who chooses to show their tasks appears here.'
              : 'No one else in this group shows their tasks yet.'}
          </p>
        ) : (
          <ul className="pb-2">
            {others
              .slice()
              .sort((a, b) => Number(b.date === today) - Number(a.date === today) || b.done - a.done)
              .map(r => (
                <li key={r.user_id} className="px-5 md:px-6 py-3">
                  <MemberTaskRow
                    userId={r.user_id}
                    name={profiles[r.user_id]?.display_name ?? 'Member'}
                    profile={profiles[r.user_id]}
                    current={r.date === today}
                    done={r.done}
                    total={r.total}
                    tasks={r.share_tasks === 'tasks' ? r.tasks : null}
                    expanded={expanded === r.user_id}
                    onToggle={() => setExpanded(expanded === r.user_id ? null : r.user_id)}
                    onOpenProfile={onOpenProfile}
                    theme={theme}
                  />
                </li>
              ))}
          </ul>
        )}

        {rows !== null && privateCount > 0 && (
          <p className={`px-5 md:px-6 py-4 border-t text-[11px] font-ui ${t.rule} ${t.muted}`}>
            {privateCount === 1 ? '1 member keeps' : `${privateCount} members keep`} their tasks hidden.
          </p>
        )}
      </section>
    </div>
  );
};

/** One member's tasks as the group sees them: a count and bar, and — only
    when they show every task — the list itself. `onToggle` null means always
    open (the preview). */
const MemberTaskRow: React.FC<{
  userId: string;
  name: string;
  profile: ProfileSummary | undefined;
  current: boolean;
  done: number;
  total: number;
  tasks: SharedTask[] | null;
  expanded: boolean;
  onToggle: (() => void) | null;
  onOpenProfile: (userId: string) => void;
  theme: 'dark' | 'light';
}> = ({ userId, name, profile, current, done, total, tasks, expanded, onToggle, onOpenProfile, theme }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const pct = current && total ? (done / total) * 100 : 0;
  const hasList = current && !!tasks?.length;
  const open = hasList && (expanded || onToggle === null);
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <UserChip
            userId={userId}
            name={name}
            profile={profile}
            onOpen={onOpenProfile}
            theme={theme}
            size={26}
            nameClassName={`truncate text-[13px] font-bold font-ui ${t.heading}`}
          />
          <div className={`mt-2 h-1 rounded-full overflow-hidden ${dark ? 'bg-white/[0.04]' : 'bg-[#E3E0D9]'}`}>
            <div className={`h-full rounded-full transition-all duration-700 ${dark ? 'bg-zinc-500' : 'bg-[#8A8577]'}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
        {current ? (
          <span className="text-right">
            <span className={`num-stat text-lg tabular-nums ${t.heading}`}>{done}/{total}</span>
            <span className={`block text-[9px] font-ui ${t.muted}`}>done today</span>
          </span>
        ) : (
          <span className={`text-[10px] font-ui ${t.muted}`}>Hasn’t opened the app today</span>
        )}
      </div>
      {hasList && onToggle && (
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          className={`mt-2 text-[10px] font-black uppercase tracking-[0.1em] font-ui ${t.muted} hover:text-[#E10600]`}
        >
          {expanded ? 'Hide their tasks' : `See their tasks (${tasks!.length})`}
        </button>
      )}
      {current && !tasks && total > 0 && onToggle && (
        <p className={`mt-2 text-[10px] font-ui ${t.muted}`}>Shows a count only</p>
      )}
      {open && (
        <ul className="mt-2 space-y-1.5 pl-1">
          {tasks!.map((task, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className={`mt-[3px] w-3 h-3 rounded-sm border flex-shrink-0 flex items-center justify-center text-[8px] ${task.done ? (dark ? 'bg-zinc-600 border-zinc-600 text-white' : 'bg-[#8A8577] border-[#8A8577] text-white') : t.rule}`}
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
      {open === false && current && onToggle === null && tasks && !tasks.length && (
        <p className={`mt-2 text-[11px] font-ui ${t.muted}`}>Nothing on your Focus Tasks list yet.</p>
      )}
    </>
  );
};

export default GroupProgress;
