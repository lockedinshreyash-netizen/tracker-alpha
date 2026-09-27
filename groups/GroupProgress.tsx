/* ── Tasks: what you share, and what they share ──
   The privacy controls live at the top of this section, not in a settings
   page, because this is where their consequences are visible. The card says
   in plain words what THIS group can see of you right now — computed from
   your real board with the same function that publishes it (taskSnapshot),
   so the preview cannot drift from what actually leaves the device.

   Settings are per group. A student can show their task list to three
   friends and only a count to a 200-person coaching batch, and the database
   enforces that split (group_task_progress), not this screen. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Task } from '../types';
import { getISTDateString } from '../utils';
import { UserChip } from '../profile/Avatar';
import { useProfiles } from '../profile/profileCache';
import { MyGroup, TaskProgressEntry, TaskShareLevel, fetchTaskProgress, humanError, setSharing } from './api';
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
  const profiles = useProfiles(useMemo(() => others.map(r => r.user_id), [others]));
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

  const seenNow = (() => {
    const parts: string[] = [];
    parts.push(group.share_hours ? 'your study hours' : 'your name, without hours');
    if (group.share_tasks === 'summary') parts.push(`“${mine.done}/${mine.total} done today”`);
    if (group.share_tasks === 'tasks') parts.push(`${mine.total} ${mine.total === 1 ? 'task' : 'tasks'} by name (${mine.done} done)`);
    return parts.join(' and ');
  })();

  const privateCount = Math.max(0, group.member_count - others.length - 1);

  return (
    <div className="space-y-5">
      {/* ── Your sharing with this group ── */}
      <section className={`p-6 md:p-8 rounded-xl border ${t.card}`} aria-labelledby="sharing-heading">
        <Eyebrow dark={dark}><span id="sharing-heading">What {group.name} sees of you</span></Eyebrow>

        <div className="mt-5">
          <SharingFields
            shareHours={group.share_hours}
            shareTasks={group.share_tasks}
            onChange={(h, tk) => void save(h, tk)}
            dark={dark}
            disabled={saving}
          />
        </div>

        <p className={`mt-6 px-4 py-3 rounded-lg border text-[11px] font-ui leading-relaxed ${t.inset} ${t.body}`}>
          <span className={`font-black uppercase tracking-[0.1em] text-[9px] ${t.muted}`}>Right now they see · </span>
          {seenNow}.
        </p>
        {saveError && <p className="text-[11px] font-ui text-[#E10600] mt-3">{saveError}</p>}
      </section>

      {/* ── Theirs ── */}
      <section className={`rounded-xl border overflow-hidden ${t.card}`}>
        <div className="px-5 md:px-6 pt-5 pb-3">
          <Eyebrow dark={dark}>Today’s progress</Eyebrow>
        </div>

        {error && <p className={`px-5 md:px-6 pb-3 text-[11px] font-ui ${t.muted}`}>{error}</p>}

        {rows === null ? (
          <div className="px-5 md:px-6 pb-5 space-y-2" aria-busy="true">
            {[0, 1].map(i => <div key={i} className={`h-12 rounded-lg animate-pulse ${dark ? 'bg-white/[0.03]' : 'bg-[#F2F0EC]'}`} />)}
          </div>
        ) : others.length === 0 ? (
          <p className={`px-5 md:px-6 pb-6 text-[12px] font-ui leading-relaxed ${t.muted}`}>
            Nobody else here shares their tasks yet. Accountability is a two-way street — sharing yours is how it starts.
          </p>
        ) : (
          <ul className="pb-2">
            {others
              .slice()
              .sort((a, b) => Number(b.date === today) - Number(a.date === today) || b.done - a.done)
              .map(r => {
                const current = r.date === today;
                const pct = current && r.total ? (r.done / r.total) * 100 : 0;
                const open = expanded === r.user_id;
                const canExpand = current && r.share_tasks === 'tasks' && !!r.tasks?.length;
                return (
                  <li key={r.user_id} className="px-5 md:px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <UserChip
                          userId={r.user_id}
                          name={profiles[r.user_id]?.display_name ?? 'Member'}
                          profile={profiles[r.user_id]}
                          onOpen={onOpenProfile}
                          theme={theme}
                          size={26}
                          nameClassName={`truncate text-[13px] font-bold font-ui ${t.heading}`}
                        />
                        <div className={`mt-2 h-1 rounded-full overflow-hidden ${dark ? 'bg-white/[0.04]' : 'bg-[#F2F0EC]'}`}>
                          <div className={`h-full rounded-full transition-all duration-700 ${dark ? 'bg-zinc-500' : 'bg-[#8A8577]'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      {current ? (
                        <span className={`num-stat text-lg tabular-nums ${t.heading}`}>{r.done}/{r.total}</span>
                      ) : (
                        <span className={`text-[10px] font-ui ${t.muted}`}>No update today</span>
                      )}
                    </div>
                    {canExpand && (
                      <button
                        onClick={() => setExpanded(open ? null : r.user_id)}
                        aria-expanded={open}
                        className={`mt-2 text-[10px] font-black uppercase tracking-[0.1em] font-ui ${t.muted} hover:text-[#E10600]`}
                      >
                        {open ? 'Hide tasks' : `Show tasks (${r.tasks!.length})`}
                      </button>
                    )}
                    {open && canExpand && (
                      <ul className={`mt-2 space-y-1.5 pl-1`}>
                        {r.tasks!.map((task, i) => (
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
                  </li>
                );
              })}
          </ul>
        )}

        {rows !== null && privateCount > 0 && (
          <p className={`px-5 md:px-6 py-4 border-t text-[11px] font-ui ${t.rule} ${t.muted}`}>
            {privateCount === 1 ? '1 member keeps' : `${privateCount} members keep`} their tasks private.
          </p>
        )}
      </section>
    </div>
  );
};

export default GroupProgress;
