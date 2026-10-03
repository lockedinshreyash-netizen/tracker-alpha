import React, { useCallback, useEffect, useState } from 'react';
import { ProfileSummary } from '../profile/profileApi';
import { GroupIcon, RoleBadge, tokens } from '../groups/ui';
import { getISTDateString } from '../utils';
import RemoveForm from './RemoveForm';
import HideForm, { formatUntil } from './HideForm';
import {
  GroupHide,
  LeaderboardHide,
  StaffUserGroup,
  fetchGroupHides,
  fetchLeaderboardBans,
  fetchLeaderboardHides,
  fetchRaceToday,
  fetchStaffUserGroups,
  humanError,
  staffHideFromLeaderboard,
  staffHideInGroups,
  staffRemoveFromLeaderboard,
  staffRemoveGroupMember,
  staffUnhideInGroups,
  staffUnhideLeaderboard,
} from './api';

interface Props {
  person: ProfileSummary;
  /** The signed-in staff member. Nothing is offered on their own panel. */
  selfId: string;
  dark: boolean;
  /** After anything changes: the console's hide and ban lists are stale. */
  onChanged: () => void;
}

/** Where a form is open: the whole app, the race, or one group. */
type Target = 'everywhere' | 'race' | string;
type Acting = { target: Target; mode: 'remove' | 'hide' } | null;

interface Place {
  raceHours: number | null;
  raceHide: LeaderboardHide | null;
  raceBanned: boolean;
  groups: StaffUserGroup[];
  /** Running group hides for this person, by group id; '' is the every-group one. */
  groupHides: Record<string, GroupHide>;
}

const EVERYWHERE = '';

/**
 * One person, everywhere they can be seen: the Ranks race and every group
 * they are in, private ones included. Each place gets its own Hide and
 * Remove, and "Hide everywhere" covers the race and every group at once —
 * including groups they join while it runs.
 *
 * What a private group says among its members stays out of view. This panel
 * knows the group's name, the person's role in it and nothing else.
 */
const PersonPanel: React.FC<Props> = ({ person, selfId, dark, onChanged }) => {
  const t = tokens(dark);
  const name = person.display_name;
  const isSelf = person.user_id === selfId;
  const [place, setPlace] = useState<Place | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [acting, setActing] = useState<Acting>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [raceHours, raceHides, bans, groups, groupHides] = await Promise.all([
        fetchRaceToday(person.user_id),
        fetchLeaderboardHides(),
        fetchLeaderboardBans(),
        fetchStaffUserGroups(person.user_id),
        fetchGroupHides(),
      ]);
      const mine: Record<string, GroupHide> = {};
      groupHides.filter(h => h.user_id === person.user_id).forEach(h => { mine[h.group_id ?? EVERYWHERE] = h; });
      setPlace({
        raceHours,
        raceHide: raceHides.find(h => h.user_id === person.user_id) ?? null,
        raceBanned: bans.some(b => b.user_id === person.user_id),
        groups,
        groupHides: mine,
      });
      setError(null);
    } catch (e) {
      setError(humanError(e));
    }
  }, [person.user_id]);

  useEffect(() => {
    setPlace(null);
    setActing(null);
    setNote(null);
    void load();
  }, [load]);

  /** Runs a change, then reloads this panel and tells the console. Throws a readable message. */
  const commit = async (work: () => Promise<void>, done: string) => {
    try {
      await work();
    } catch (e) {
      throw new Error(humanError(e));
    }
    setActing(null);
    setNote(done);
    await load();
    onChanged();
  };

  const unhide = async (work: () => Promise<void>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await commit(work, done);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const action = 'text-[10px] font-black uppercase tracking-[0.1em] font-ui disabled:opacity-50';
  const quiet = `${action} ${t.muted} hover:text-current`;
  const row = `py-3`;

  const everywhere = place?.groupHides[EVERYWHERE] ?? null;
  const onRace = place ? place.raceHours !== null || !!place.raceHide : false;

  /** The Hide/Unhide/Remove buttons for one place. */
  const controls = (target: Target, hidden: boolean, onUnhide: () => void, canRemove: boolean) =>
    !isSelf && acting?.target !== target && (
      <span className="flex items-center gap-4 shrink-0">
        {hidden ? (
          <button onClick={onUnhide} disabled={busy} className={quiet}>Unhide</button>
        ) : (
          <button onClick={() => { setActing({ target, mode: 'hide' }); setNote(null); }} className={quiet}>Hide…</button>
        )}
        {canRemove && (
          <button onClick={() => { setActing({ target, mode: 'remove' }); setNote(null); }} className={`${action} text-[#E10600]`}>
            Remove…
          </button>
        )}
      </span>
    );

  return (
    <div className={`mt-3 p-4 md:p-5 rounded-lg border ${t.inset}`}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className={`text-[15px] font-bold font-ui ${t.heading}`}>{name}</p>
        <p className={`text-[11px] font-ui ${t.muted}`}>@{person.handle}</p>
      </div>
      {isSelf && <p className={`text-[11px] font-ui mt-1 ${t.muted}`}>This is you. Staff can’t hide or remove themselves.</p>}
      {error && <p className="text-[11px] font-ui text-[#E10600] mt-2">{error}</p>}
      {note && <p className={`text-[11px] font-bold font-ui mt-2 ${t.muted}`}>{note}</p>}

      {!place ? (
        !error && <p className={`text-[11px] font-ui mt-3 ${t.muted}`}>Loading…</p>
      ) : (
        <>
          {/* Everywhere */}
          {!isSelf && (
            <div className={`${row} mt-2 border-b ${t.rule}`}>
              <div className="flex items-center gap-3">
                <p className={`flex-1 min-w-0 text-[12.5px] font-ui ${t.body}`}>
                  {everywhere
                    ? `Hidden in every group until ${formatUntil(everywhere.hidden_until)}`
                    : 'Race and every group'}
                </p>
                {acting?.target !== 'everywhere' && (
                  everywhere ? (
                    <button
                      onClick={() => void unhide(
                        () => staffUnhideInGroups(person.user_id, null),
                        `${name} is visible in their groups again.`,
                      )}
                      disabled={busy}
                      className={quiet}
                    >
                      Unhide groups
                    </button>
                  ) : (
                    <button onClick={() => { setActing({ target: 'everywhere', mode: 'hide' }); setNote(null); }} className={quiet}>
                      Hide everywhere…
                    </button>
                  )
                )}
              </div>
              {acting?.target === 'everywhere' && (
                <HideForm
                  name={name}
                  means="Everyone else won’t see them on the race board, in its chat, or in any of their groups (including ones they join) until the time runs out."
                  dark={dark}
                  onCancel={() => setActing(null)}
                  onConfirm={(until, staffNote) => commit(async () => {
                    await staffHideFromLeaderboard(person.user_id, until, staffNote);
                    await staffHideInGroups(person.user_id, null, until, staffNote);
                  }, `${name} is hidden everywhere until ${formatUntil(until)}.`)}
                />
              )}
            </div>
          )}

          {/* The race */}
          <div className={`${row} border-b ${t.rule}`}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className={`text-[12.5px] font-bold font-ui ${t.heading}`}>Ranks race</p>
                <p className={`text-[11px] font-ui mt-0.5 ${t.muted}`}>
                  {place.raceBanned
                    ? 'Banned — unban below'
                    : place.raceHide
                      ? `Hidden until ${formatUntil(place.raceHide.hidden_until)}`
                      : place.raceHours !== null
                        ? `On today’s board · ${place.raceHours.toFixed(1)}h`
                        : 'Not on today’s board'}
                </p>
              </div>
              {!place.raceBanned && controls(
                'race',
                !!place.raceHide,
                () => void unhide(() => staffUnhideLeaderboard(person.user_id), `${name} is visible on the board again.`),
                onRace,
              )}
            </div>
            {acting?.target === 'race' && acting.mode === 'hide' && (
              <HideForm
                name={name}
                dark={dark}
                onCancel={() => setActing(null)}
                onConfirm={(until, staffNote) => commit(
                  () => staffHideFromLeaderboard(person.user_id, until, staffNote),
                  `${name} is hidden from the race until ${formatUntil(until)}.`,
                )}
              />
            )}
            {acting?.target === 'race' && acting.mode === 'remove' && (
              <RemoveForm
                name={name}
                from="race"
                banMeans="They can’t rejoin the race or post in its chat until you unban them."
                dark={dark}
                onCancel={() => setActing(null)}
                onConfirm={(reason, ban) => commit(
                  () => staffRemoveFromLeaderboard(person.user_id, getISTDateString(), ban, reason),
                  `${name} ${ban ? 'is banned from' : 'was removed from'} the race.`,
                )}
              />
            )}
          </div>

          {/* Groups */}
          {!place.groups.length ? (
            <p className={`text-[11px] font-ui pt-3 ${t.muted}`}>Not in any group.</p>
          ) : place.groups.map(g => {
            const hide = place.groupHides[g.id];
            return (
              <div key={g.id} className={`${row} border-b last:border-b-0 ${t.rule}`}>
                <div className="flex items-center gap-3">
                  <GroupIcon icon={g.icon} name={g.name} size={32} dark={dark} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className={`truncate text-[12.5px] font-bold font-ui ${t.heading}`}>{g.name}</p>
                      <RoleBadge role={g.role} dark={dark} />
                    </div>
                    <p className={`text-[11px] font-ui mt-0.5 ${t.muted}`}>
                      {g.visibility === 'discoverable' ? 'Public' : 'Private'} · {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
                      {hide && ` · Hidden until ${formatUntil(hide.hidden_until)}`}
                    </p>
                  </div>
                  {controls(
                    g.id,
                    !!hide,
                    () => void unhide(() => staffUnhideInGroups(person.user_id, g.id), `${name} is visible in ${g.name} again.`),
                    true,
                  )}
                </div>
                {acting?.target === g.id && acting.mode === 'hide' && (
                  <HideForm
                    name={name}
                    means={`Everyone else in ${g.name} won’t see their messages, hours or tasks until the time runs out.`}
                    dark={dark}
                    onCancel={() => setActing(null)}
                    onConfirm={(until, staffNote) => commit(
                      () => staffHideInGroups(person.user_id, g.id, until, staffNote),
                      `${name} is hidden in ${g.name} until ${formatUntil(until)}.`,
                    )}
                  />
                )}
                {acting?.target === g.id && acting.mode === 'remove' && (
                  <RemoveForm
                    name={name}
                    from="group"
                    banMeans="They can’t join this group again unless its admins lift the ban."
                    dark={dark}
                    onCancel={() => setActing(null)}
                    onConfirm={(reason, ban) => commit(
                      () => staffRemoveGroupMember(g.id, person.user_id, ban, reason),
                      `${name} ${ban ? 'is banned from' : 'was removed from'} ${g.name}.`,
                    )}
                  />
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export default PersonPanel;
