import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useProfiles } from '../profile/profileCache';
import { Eyebrow, RoleBadge, tokens } from '../groups/ui';
import {
  StaffMember,
  fetchStaffGroupMembers,
  humanError,
  staffHideInGroups,
  staffRemoveGroupMember,
  staffUnhideInGroups,
} from './api';
import RemoveForm from './RemoveForm';
import HideForm, { formatUntil } from './HideForm';

interface Props {
  groupId: string;
  /** The signed-in staff member — never offered an action on their own row. */
  selfId: string | null;
  dark: boolean;
  /** After a removal or a hide: the member count, or a hide list, behind this has changed. */
  onChanged: () => void;
}

/** Which form is open, on which row. */
type Acting = { userId: string; mode: 'remove' | 'hide' } | null;

/**
 * Staff's view of a group's roster — any group, public or private. Shown in a
 * public group's Explore sheet, and under a group found from Console →
 * Moderation.
 *
 * Names, roles and hides only. What the group shares among its members
 * (hours, tasks, chat) is not staff's to read, and staff_group_members() does
 * not return it; this list exists to take one person out or hide them, not to
 * look around.
 *
 * Unhide here lifts this group's hide only. A member hidden in every group is
 * marked so, and that hide is lifted from the console, where it was set.
 */
const StaffGroupMembers: React.FC<Props> = ({ groupId, selfId, dark, onChanged }) => {
  const t = tokens(dark);
  const [members, setMembers] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<Acting>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setMembers(await fetchStaffGroupMembers(groupId));
      setError(null);
    } catch (e) {
      setError(humanError(e));
      setMembers(prev => prev ?? []);
    }
  }, [groupId]);

  useEffect(() => { void load(); }, [load]);

  const ids = useMemo(() => (members ?? []).map(m => m.user_id), [members]);
  const profiles = useProfiles(ids);
  const nameOf = (id: string) => profiles[id]?.display_name ?? 'Member';

  const unhide = async (userId: string) => {
    setBusy(userId);
    setError(null);
    try {
      await staffUnhideInGroups(userId, groupId);
      await load();
      onChanged();
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  };

  const action = 'text-[10px] font-black uppercase tracking-[0.1em] font-ui';

  return (
    <div>
      <Eyebrow dark={dark} className="mb-3">Members · staff only</Eyebrow>
      {error && <p className="text-[11px] font-ui text-[#E10600] mb-2">{error}</p>}
      {members === null ? (
        <p className={`text-[11px] font-ui ${t.muted}`}>Loading…</p>
      ) : !members.length ? (
        !error && <p className={`text-[11px] font-ui ${t.muted}`}>Nobody is in this group.</p>
      ) : (
        <ul className={`divide-y ${dark ? 'divide-white/[0.06]' : 'divide-zinc-100'}`}>
          {members.map(m => (
            <li key={m.user_id} className="py-2.5">
              <div className="flex items-center gap-2">
                <span className={`truncate text-[13px] font-bold font-ui ${t.heading}`}>{nameOf(m.user_id)}</span>
                <RoleBadge role={m.role} dark={dark} />
                <span className="flex-1" />
                {m.user_id !== selfId && acting?.userId !== m.user_id && (
                  <span className="flex items-center gap-4 shrink-0">
                    {m.hidden_until ? (
                      <button onClick={() => void unhide(m.user_id)} disabled={busy === m.user_id} className={`${action} ${t.muted} hover:text-current disabled:opacity-50`}>
                        Unhide
                      </button>
                    ) : (
                      <button onClick={() => setActing({ userId: m.user_id, mode: 'hide' })} className={`${action} ${t.muted} hover:text-current`}>
                        Hide…
                      </button>
                    )}
                    <button onClick={() => setActing({ userId: m.user_id, mode: 'remove' })} className={`${action} text-[#E10600]`}>
                      Remove…
                    </button>
                  </span>
                )}
              </div>
              {(m.hidden_until || m.hidden_everywhere_until) && (
                <p className={`text-[11px] font-ui mt-1 ${t.muted}`}>
                  {m.hidden_until && `Hidden here until ${formatUntil(m.hidden_until)}`}
                  {m.hidden_until && m.hidden_everywhere_until && ' · '}
                  {m.hidden_everywhere_until && `Hidden in every group until ${formatUntil(m.hidden_everywhere_until)} (lift it in Console → Moderation)`}
                </p>
              )}
              {acting?.userId === m.user_id && acting.mode === 'hide' && (
                <HideForm
                  name={nameOf(m.user_id)}
                  means="Everyone else in this group won’t see their messages, hours or tasks until the time runs out."
                  dark={dark}
                  onCancel={() => setActing(null)}
                  onConfirm={async (until, note) => {
                    try {
                      await staffHideInGroups(m.user_id, groupId, until, note);
                    } catch (e) {
                      throw new Error(humanError(e));
                    }
                    setActing(null);
                    await load();
                    onChanged();
                  }}
                />
              )}
              {acting?.userId === m.user_id && acting.mode === 'remove' && (
                <RemoveForm
                  name={nameOf(m.user_id)}
                  from="group"
                  banMeans="They can’t join this group again unless its admins lift the ban."
                  dark={dark}
                  onCancel={() => setActing(null)}
                  onConfirm={async (reason, ban) => {
                    try {
                      await staffRemoveGroupMember(groupId, m.user_id, ban, reason);
                    } catch (e) {
                      throw new Error(humanError(e));
                    }
                    setActing(null);
                    await load();
                    onChanged();
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default StaffGroupMembers;
