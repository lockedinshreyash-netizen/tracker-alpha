/* ── Group settings ──
   Everything about a group that is a setting rather than something to look
   at, in one sheet opened from the group header: what you show this group
   (first, because it is the one every member has), then — for whoever may —
   editing it, the ban list, and leaving or deleting it.

   The sharing controls keep the rule SharingFields.tsx is built on: the
   answer to "what do they see" is shown, not described. The preview under the
   switches is your own row drawn by PersonRow, the same component the Members
   list draws everyone with, from your real board via the same function that
   publishes it (taskSnapshot).

   Every control is drawn only for somebody the database would let use it, and
   re-checked there anyway (supabase/groups.sql §5). */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Task } from '../types';
import { getISTDateString } from '../utils';
import { useProfiles } from '../profile/profileCache';
import { GroupBan, MyGroup, TaskShareLevel, deleteGroup, fetchBans, humanError, leaveGroup, setSharing, unbanMember } from './api';
import { taskSnapshot } from './publish';
import { GroupsState } from './useGroups';
import { Eyebrow, Sheet, btn, tokens } from './ui';
import SharingFields from './SharingFields';
import { PersonRow } from './GroupPeople';

interface Props {
  group: MyGroup;
  userId: string;
  tasks: Task[];
  groups: GroupsState;
  onClose: () => void;
  /** Open the name/icon/access editor (admins). */
  onEdit: () => void;
  /** The caller left or deleted the group. */
  onLeft: () => void;
  onOpenProfile: (userId: string) => void;
  theme: 'dark' | 'light';
}

const GroupSettingsSheet: React.FC<Props> = ({ group, userId, tasks, groups, onClose, onEdit, onLeft, onOpenProfile, theme }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const isOwner = group.role === 'owner';
  const isAdmin = group.role === 'owner' || group.role === 'admin';

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bans, setBans] = useState<GroupBan[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const loadBans = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setBans(await fetchBans(group.id));
    } catch {
      // The rest of the sheet works without it.
    }
  }, [group.id, isAdmin]);
  useEffect(() => { void loadBans(); }, [loadBans]);

  const profiles = useProfiles(useMemo(() => [userId, ...bans.map(b => b.user_id)], [userId, bans]));
  const nameOf = (id: string) => profiles[id]?.display_name ?? (id === userId ? 'You' : 'Member');

  const today = getISTDateString();
  const mine = useMemo(() => taskSnapshot(tasks, today, group.share_tasks), [tasks, today, group.share_tasks]);

  const save = async (shareHours: boolean, shareTasks: TaskShareLevel) => {
    const before = { share_hours: group.share_hours, share_tasks: group.share_tasks };
    groups.patch(group.id, { share_hours: shareHours, share_tasks: shareTasks });
    setSaving(true);
    setError(null);
    try {
      await setSharing(group.id, shareHours, shareTasks);
      // The publisher (useGroups) reacts to the new level on its own.
    } catch (e) {
      groups.patch(group.id, before);
      setError(humanError(e));
    } finally {
      setSaving(false);
    }
  };

  const act = async (key: string, fn: () => Promise<void>, after?: () => void) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      after?.();
      await groups.refresh();
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  };

  const leave = () => {
    const note = isOwner
      ? group.member_count > 1
        ? 'Leave this group? Ownership passes to the longest-standing admin, or member if there are no admins.'
        : 'Leave this group? You’re the only member, so the group and its chat will be deleted.'
      : 'Leave this group? Your hours and tasks stop being visible to it immediately.';
    if (window.confirm(note)) void act('leave', () => leaveGroup(group.id), onLeft);
  };

  const remove = () => {
    const typed = window.prompt(`This deletes ${group.name}, its chat and every invite, for everyone. Type the group name to confirm.`);
    if (typed !== null && typed.trim().toLowerCase() === group.name.trim().toLowerCase()) {
      void act('delete', () => deleteGroup(group.id), onLeft);
    }
  };

  const row = `w-full py-3.5 ${btn}`;

  return (
    <Sheet title="Group settings" onClose={onClose} dark={dark}>
      {error && <p className="text-[11px] font-ui text-[#E10600]">{error}</p>}

      {/* ── What you show ── */}
      <div>
        <Eyebrow dark={dark} className="mb-4">What other members of {group.name} can see</Eyebrow>
        <SharingFields
          shareHours={group.share_hours}
          shareTasks={group.share_tasks}
          onChange={(h, tk) => void save(h, tk)}
          dark={dark}
          disabled={saving}
        />
        <div className={`mt-5 rounded-lg border px-4 pt-3 pb-4 ${t.inset}`}>
          <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui mb-3 ${t.muted}`}>
            Preview · how you appear to other members
          </p>
          <PersonRow
            userId={userId}
            name={nameOf(userId)}
            profile={profiles[userId]}
            view={group.share_tasks === 'private'
              ? { kind: 'hidden' }
              : { kind: 'today', done: mine.done, total: mine.total, tasks: mine.tasks }}
            expanded
            onToggle={null}
            onOpenProfile={onOpenProfile}
            theme={theme}
          />
          <p className={`text-[11px] font-ui mt-3 ${t.muted}`}>
            Study hours: {group.share_hours ? 'shown on the leaderboard' : 'hidden'}.
          </p>
        </div>
      </div>

      {/* ── The group itself ── */}
      <div className={`pt-5 border-t ${t.rule} space-y-3`}>
        <Eyebrow dark={dark}>Group</Eyebrow>
        {isAdmin && (
          <button onClick={onEdit} className={`${row} ${t.ghost}`}>Edit name, icon & invite rules</button>
        )}

        {isAdmin && bans.length > 0 && (
          <div className={`rounded-lg border ${t.inset}`}>
            <p className={`px-4 pt-3 text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${t.muted}`}>Banned</p>
            <ul className="py-1">
              {bans.map(b => (
                <li key={b.user_id} className="px-4 py-2 flex items-center gap-3">
                  <span className={`flex-1 truncate text-[13px] font-ui ${t.body}`}>{nameOf(b.user_id)}</span>
                  <button
                    onClick={() => void act(`unban-${b.user_id}`, () => unbanMember(group.id, b.user_id), () => void loadBans())}
                    disabled={busy === `unban-${b.user_id}`}
                    className={`text-[10px] font-black uppercase tracking-[0.1em] font-ui ${t.muted} hover:text-[#E10600]`}
                  >
                    Unban
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button onClick={leave} disabled={busy === 'leave'} className={`${row} ${t.ghost}`}>Leave group</button>
        {isOwner && (
          <button
            onClick={remove}
            disabled={busy === 'delete'}
            className={`${row} border border-[#E10600]/40 text-[#E10600] hover:bg-[#E10600]/[0.06]`}
          >
            Delete group
          </button>
        )}
      </div>
    </Sheet>
  );
};

export default GroupSettingsSheet;
