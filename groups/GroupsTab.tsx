/* ── Groups ──
   The social layer, and deliberately a thin one: a group is a board you are
   ranked on, a room you can talk in, and a place to be held to what you said
   you would do today. It is not a feed. The loop it exists to add is
   TRACK → STUDY → SEE FRIENDS → COMPETE → RETURN, and every screen here should
   send people back to the timer rather than keep them scrolling.

   Layout rule: one row of tabs per screen, and content before controls. The
   list has My groups / Explore and one "New group" button; a group has
   Board / Chat / Members and nothing stacked under it. Everything that is a
   setting rather than something to look at — inviting, what you share, editing,
   leaving — is a sheet opened from the two buttons in the group's header, so it
   is one tap away without being on the page.

   A zero-logic container in the same sense as questions/QuestionsTab.tsx: it
   holds which group, which section and which sheet are open, and passes
   narrow slices down. It never sees AppState. Which group was open last is a
   per-device convenience in localStorage — in AppState it would fire a
   Supabase upsert of the whole blob every time somebody switched groups. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { Task } from '../types';
import { MyGroup } from './api';
import { GroupsState } from './useGroups';
import { Eyebrow, GroupIcon, Segmented, btn, tokens } from './ui';
import InvitePanel from './InvitePanel';
import { CreateGroupSheet, EditGroupSheet, JoinCodeSheet } from './GroupSheets';
import GroupBoard from './GroupBoard';
import GroupChat from './GroupChat';
import GroupPeople from './GroupPeople';
import InviteSheet from './InviteSheet';
import GroupSettingsSheet from './GroupSettingsSheet';
import ExploreGroups from './ExploreGroups';
import { sharingSummary } from './SharingFields';

type Section = 'board' | 'chat' | 'members';
/* Two lists, one tab: the groups you are in, and the ones you could be. */
type View = 'mine' | 'explore';
/* At most one sheet over a group at a time. */
type GroupSheet = 'invite' | 'settings' | 'edit' | null;

const LAST_GROUP_KEY = 'groups_last_open_v1';
const readLast = (): string | null => { try { return localStorage.getItem(LAST_GROUP_KEY); } catch { return null; } };
const writeLast = (id: string | null) => {
  try { if (id) localStorage.setItem(LAST_GROUP_KEY, id); else localStorage.removeItem(LAST_GROUP_KEY); } catch { /* per-device only */ }
};

interface Props {
  user: User | null;
  groups: GroupsState;
  tasks: Task[];
  pendingInvite: string | null;
  onInviteHandled: () => void;
  onOpenAuth: () => void;
  onOpenProfile: (userId: string) => void;
  /* App staff — draws the takedown button on public groups. Not a permission;
     delete_group() re-checks is_admin() server-side. */
  isStaff: boolean;
  theme: 'dark' | 'light';
}

/* 16px stroke icons for the group header's two buttons, drawn like the rail's. */
const iconProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

const GroupsTab: React.FC<Props> = ({
  user, groups, tasks, pendingInvite, onInviteHandled, onOpenAuth, onOpenProfile, isStaff, theme,
}) => {
  const dark = theme === 'dark';
  const t = tokens(dark);

  const [openId, setOpenId] = useState<string | null>(readLast);
  const [section, setSection] = useState<Section>('board');
  const [sheet, setSheet] = useState<GroupSheet>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [view, setView] = useState<View>('mine');

  const list = groups.groups;
  const open: MyGroup | null = useMemo(
    () => (openId && list ? list.find(g => g.id === openId) ?? null : null),
    [openId, list]
  );

  /* A group that is no longer in the list — left on another device, removed,
     deleted — falls back to the list rather than a blank page. Only once the
     list has actually answered, or a reload would bounce off the last group
     while the fetch is still in flight. */
  useEffect(() => {
    if (openId && list && !list.some(g => g.id === openId)) {
      setOpenId(null);
      setSheet(null);
      writeLast(null);
    }
  }, [openId, list]);

  /* An invite that just arrived outranks whichever group was open last: the
     card lives on the list, and landing somebody in last week's group instead
     of the one their friend just sent them to hides the whole reason they came. */
  useEffect(() => {
    if (pendingInvite) setOpenId(null);
  }, [pendingInvite]);

  const openGroup = useCallback((id: string, then: GroupSheet = null) => {
    setOpenId(id);
    setSection('board');
    setSheet(then);
    writeLast(id);
  }, []);

  const closeGroup = useCallback(() => {
    setOpenId(null);
    setSheet(null);
    writeLast(null);
  }, []);

  const afterJoin = useCallback(async (groupId: string) => {
    onInviteHandled();
    setJoining(false);
    setView('mine');
    await groups.refresh();
    openGroup(groupId);
  }, [groups, onInviteHandled, openGroup]);

  /* ── Signed out ── a group is people, and people need an account to be. */
  if (!user) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
        {pendingInvite && (
          <InvitePanel code={pendingInvite} user={null} onJoined={afterJoin} onDismiss={onInviteHandled} onOpenAuth={onOpenAuth} theme={theme} />
        )}
        <section className={`p-8 md:p-12 rounded-xl border text-center ${t.card}`}>
          <h2 className={`text-xl md:text-2xl font-black uppercase tracking-tight font-ui ${t.heading}`}>
            Study with people who actually show up
          </h2>
          <p className={`text-[11px] font-ui mt-3 max-w-md mx-auto leading-relaxed ${t.muted}`}>
            Your batch, your coaching class, the three friends who keep you honest. See who put the hours
            in today, talk between sessions, and let the board settle the argument. Sign in to create or
            join a group.
          </p>
          <button onClick={onOpenAuth} className={`mt-8 px-10 py-4 ${btn} ${t.secondary}`}>Sign in</button>
        </section>
      </div>
    );
  }

  /* ── One group ── */
  if (open) {
    const canInvite = open.role === 'owner' || open.role === 'admin' || open.invite_policy === 'members';
    const sections: { value: Section; label: string }[] = [
      { value: 'board', label: 'Board' },
      { value: 'chat', label: open.unread > 0 && section !== 'chat' ? `Chat · ${open.unread > 99 ? '99+' : open.unread}` : 'Chat' },
      {
        value: 'members',
        label: open.pending_requests ? `Members · ${open.pending_requests > 99 ? '99+' : open.pending_requests}` : 'Members',
      },
    ];
    const headerBtn = `h-9 inline-flex items-center gap-2 rounded-lg px-3 text-[10px] font-black uppercase tracking-[0.12em] font-ui transition-all active:scale-[0.97] ${t.ghost}`;

    return (
      <div className="animate-in fade-in duration-300 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={closeGroup}
            className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] font-ui ${t.muted} hover:text-[#E10600] transition-colors`}
          >
            <span aria-hidden="true">←</span> All groups
          </button>
          <div className="flex items-center gap-2">
            {canInvite && (
              <button onClick={() => setSheet('invite')} className={headerBtn}>
                <svg {...iconProps}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
                Invite
              </button>
            )}
            <button onClick={() => setSheet('settings')} className={`${headerBtn} w-9 justify-center px-0`} aria-label="Group settings">
              <svg {...iconProps}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
            </button>
          </div>
        </div>

        <header className="flex items-center gap-4">
          <GroupIcon icon={open.icon} name={open.name} size={52} dark={dark} />
          <div className="min-w-0 flex-1">
            <h1 className={`text-xl md:text-2xl font-black uppercase tracking-tight font-ui truncate ${t.heading}`}>{open.name}</h1>
            <p className={`text-[11px] font-ui mt-0.5 truncate ${t.muted}`}>
              <button onClick={() => setSection('members')} className="hover:text-[#E10600] transition-colors">
                {open.member_count} {open.member_count === 1 ? 'member' : 'members'}
              </button>
              {' · '}
              {open.visibility === 'discoverable'
                ? open.join_policy === 'open' ? 'Public · anyone can join' : 'Public · join by request'
                : 'Private'}
              {open.description && <span className="hidden md:inline"> · {open.description}</span>}
            </p>
          </div>
        </header>
        {open.description && (
          <p className={`md:hidden -mt-2 text-[12px] font-ui leading-relaxed ${t.muted}`}>{open.description}</p>
        )}

        {/* What this group can see of you — always stated, one tap from changing it. */}
        <button
          onClick={() => setSheet('settings')}
          className={`-mt-1 block text-left text-[12px] font-ui leading-relaxed ${t.muted} group`}
        >
          {sharingSummary(open.share_hours, open.share_tasks)}.{' '}
          <span className="font-bold text-[#E10600] group-hover:underline underline-offset-2">Change</span>
        </button>

        <Segmented value={section} options={sections} onChange={setSection} dark={dark} label="Group sections" />

        {section === 'board' && (
          <GroupBoard
            group={open}
            userId={user.id}
            onOpenProfile={onOpenProfile}
            onInvite={() => setSheet('invite')}
            onSharing={() => setSheet('settings')}
            theme={theme}
          />
        )}
        {section === 'chat' && (
          <GroupChat
            key={open.id}
            group={open}
            userId={user.id}
            onRead={id => groups.patch(id, { unread: 0 })}
            onOpenProfile={onOpenProfile}
            theme={theme}
          />
        )}
        {section === 'members' && (
          <GroupPeople
            key={open.id}
            group={open}
            userId={user.id}
            tasks={tasks}
            groups={groups}
            onInvite={() => setSheet('invite')}
            onOpenProfile={onOpenProfile}
            theme={theme}
          />
        )}

        {sheet === 'invite' && canInvite && (
          <InviteSheet group={open} userId={user.id} groups={groups} onClose={() => setSheet(null)} theme={theme} />
        )}
        {sheet === 'settings' && (
          <GroupSettingsSheet
            group={open}
            userId={user.id}
            tasks={tasks}
            groups={groups}
            onClose={() => setSheet(null)}
            onEdit={() => setSheet('edit')}
            onLeft={closeGroup}
            onOpenProfile={onOpenProfile}
            theme={theme}
          />
        )}
        {sheet === 'edit' && (
          <EditGroupSheet
            group={open}
            theme={theme}
            onClose={() => setSheet('settings')}
            onSaved={() => { setSheet(null); void groups.refresh(); }}
          />
        )}
      </div>
    );
  }

  /* ── The list ── */
  const empty = view === 'mine' && list !== null && list.length === 0 && !groups.setupMissing;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      {pendingInvite && (
        <InvitePanel code={pendingInvite} user={user} onJoined={afterJoin} onDismiss={onInviteHandled} onOpenAuth={onOpenAuth} theme={theme} />
      )}

      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow dark={dark}>Groups</Eyebrow>
          <h1 className={`text-xl md:text-2xl font-black uppercase tracking-tight font-ui mt-1 ${t.heading}`}>
            Who are you racing?
          </h1>
        </div>
        {!empty && (
          <button onClick={() => setCreating(true)} className={`flex-shrink-0 px-4 py-3 ${btn} ${t.primary}`}>
            <span aria-hidden="true">+ </span>New group
          </button>
        )}
      </div>

      <div className="md:max-w-xs">
        <Segmented<View>
          value={view}
          onChange={setView}
          options={[{ value: 'mine', label: 'My groups' }, { value: 'explore', label: 'Explore' }]}
          dark={dark}
          label="Which groups"
          size="sm"
        />
      </div>

      {view === 'explore' ? (
        <ExploreGroups onOpenGroup={id => openGroup(id)} onJoined={id => void afterJoin(id)} isStaff={isStaff} userId={user?.id ?? null} theme={theme} />
      ) : (
        <>
          {groups.error && (
            <p className={`text-[11px] font-ui px-4 py-3 rounded-lg border ${t.inset} ${groups.setupMissing ? 'text-[#E10600]' : t.muted}`}>
              {groups.error}
            </p>
          )}

          {list === null ? (
            <div className="space-y-3" aria-busy="true" aria-label="Loading groups">
              {[0, 1].map(i => (
                <div key={i} className={`h-[76px] rounded-xl border animate-pulse ${t.card}`} />
              ))}
            </div>
          ) : empty ? (
            <section className={`p-8 md:p-10 rounded-xl border ${t.card}`}>
              <Eyebrow dark={dark}>No groups yet</Eyebrow>
              <p className={`text-sm font-ui mt-3 leading-relaxed ${t.body}`}>
                Studying alone is how you convince yourself three hours was a good day. Start a group for your
                batch, send the link, and find out.
              </p>
              <ul className={`mt-5 space-y-2 text-[12px] font-ui ${t.muted}`}>
                <li>· A leaderboard for today, the week and the month</li>
                <li>· A chat that’s still there tomorrow</li>
                <li>· Task progress — only if you choose to share it</li>
              </ul>
              <div className="mt-7 flex flex-wrap gap-3">
                <button onClick={() => setCreating(true)} className={`px-6 py-3.5 ${btn} ${t.primary}`}>Create group</button>
                <button onClick={() => setJoining(true)} className={`px-6 py-3.5 ${btn} ${t.ghost}`}>Join with code</button>
              </div>
              <button onClick={() => setView('explore')} className="mt-5 text-[10px] font-black uppercase tracking-[0.12em] font-ui text-[#E10600]">
                Or find a public group →
              </button>
            </section>
          ) : (
            <>
              <ul className="space-y-3">
                {list.map(g => (
                  <li key={g.id}>
                    <button
                      onClick={() => openGroup(g.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all card-interactive ${t.card}`}
                    >
                      <GroupIcon icon={g.icon} name={g.name} size={44} dark={dark} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold font-ui truncate ${t.heading}`}>{g.name}</p>
                        <p className={`text-[10px] font-ui mt-0.5 ${t.muted}`}>
                          {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
                          {g.role !== 'member' && <> · {g.role}</>}
                          {g.visibility === 'discoverable' && <> · public</>}
                          {!g.share_hours && <> · your hours hidden</>}
                          {!!g.pending_requests && (
                            <span className="text-[#E10600]"> · {g.pending_requests} {g.pending_requests === 1 ? 'request' : 'requests'}</span>
                          )}
                        </p>
                      </div>
                      {g.unread > 0 && (
                        <span
                          className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#E10600] text-white text-[10px] font-black font-ui flex items-center justify-center"
                          aria-label={`${g.unread} unread messages`}
                        >
                          {g.unread > 99 ? '99+' : g.unread}
                        </span>
                      )}
                      <span className={`${t.faint}`} aria-hidden="true">›</span>
                    </button>
                  </li>
                ))}
              </ul>
              {list.length > 0 && (
                <p className={`text-[12px] font-ui ${t.muted}`}>
                  Got an invite code?{' '}
                  <button onClick={() => setJoining(true)} className="font-bold text-[#E10600] hover:underline underline-offset-2">
                    Join with code
                  </button>
                </p>
              )}
            </>
          )}
        </>
      )}

      {creating && (
        <CreateGroupSheet
          theme={theme}
          onClose={() => setCreating(false)}
          onCreated={async id => {
            setCreating(false);
            await groups.refresh();
            // Straight to the invite sheet — a new group's first job is people.
            openGroup(id, 'invite');
          }}
        />
      )}
      {joining && (
        <JoinCodeSheet user={user} theme={theme} onClose={() => setJoining(false)} onJoined={afterJoin} onOpenAuth={onOpenAuth} />
      )}
    </div>
  );
};

export default GroupsTab;
