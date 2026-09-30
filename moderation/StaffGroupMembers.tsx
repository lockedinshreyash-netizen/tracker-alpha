import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useProfiles } from '../profile/profileCache';
import { Eyebrow, RoleBadge, tokens } from '../groups/ui';
import { StaffMember, fetchStaffGroupMembers, humanError, staffRemoveGroupMember } from './api';
import RemoveForm from './RemoveForm';

interface Props {
  groupId: string;
  /** The signed-in staff member — never offered a Remove on their own row. */
  selfId: string | null;
  dark: boolean;
  /** After a removal: the member count on the card behind this has changed. */
  onChanged: () => void;
}

/**
 * Staff's view of a PUBLIC group's roster, inside its Explore sheet — next to
 * the takedown button that already lives there.
 *
 * Names and roles only. What the group shares among its members (hours, tasks,
 * chat) is not staff's to read, and staff_group_members() does not return it;
 * this list exists to take one person out, not to look around.
 */
const StaffGroupMembers: React.FC<Props> = ({ groupId, selfId, dark, onChanged }) => {
  const t = tokens(dark);
  const [members, setMembers] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

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

  return (
    <div>
      <Eyebrow dark={dark} className="mb-3">Members · staff only</Eyebrow>
      {error && <p className="text-[11px] font-ui text-[#E10600] mb-2">{error}</p>}
      {members === null ? (
        <p className={`text-[11px] font-ui ${t.muted}`}>Loading…</p>
      ) : !members.length ? (
        !error && <p className={`text-[11px] font-ui ${t.muted}`}>Nobody is in this group.</p>
      ) : (
        <ul className={`divide-y ${dark ? 'divide-white/[0.06]' : 'divide-[#E3E0D9]'}`}>
          {members.map(m => (
            <li key={m.user_id} className="py-2.5">
              <div className="flex items-center gap-2">
                <span className={`truncate text-[13px] font-bold font-ui ${t.heading}`}>{nameOf(m.user_id)}</span>
                <RoleBadge role={m.role} dark={dark} />
                <span className="flex-1" />
                {m.user_id !== selfId && removing !== m.user_id && (
                  <button
                    onClick={() => setRemoving(m.user_id)}
                    className="text-[10px] font-black uppercase tracking-[0.1em] font-ui text-[#E10600]"
                  >
                    Remove…
                  </button>
                )}
              </div>
              {removing === m.user_id && (
                <RemoveForm
                  name={nameOf(m.user_id)}
                  from="group"
                  banMeans="They can’t join this group again unless its admins lift the ban."
                  dark={dark}
                  onCancel={() => setRemoving(null)}
                  onConfirm={async (reason, ban) => {
                    try {
                      await staffRemoveGroupMember(groupId, m.user_id, ban, reason);
                    } catch (e) {
                      throw new Error(humanError(e));
                    }
                    setRemoving(null);
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
