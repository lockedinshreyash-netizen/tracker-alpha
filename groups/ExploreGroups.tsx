/* ── Explore ──
   Every group its owner chose to make public, biggest first, searchable by
   name. The listing shows exactly what the owner agreed to make public —
   name, icon, description, size — and nothing a membership would reveal:
   no hours, no member names, no chat. That boundary is the database's
   (explore_groups, and every members-only function refusing non-members),
   not this screen's.

   Joining from here asks the same sharing question an invite does, through
   the same component, so walking in through Explore is never a quieter way
   of agreeing to share something. */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  EXPLORE_PAGE,
  ExploreGroup,
  INVITE_STATUS_COPY,
  MAX_REQUEST_MESSAGE,
  TaskShareLevel,
  cancelJoinRequest,
  deleteGroup,
  exploreGroups,
  humanError,
  joinPublicGroup,
  requestToJoin,
} from './api';
import { Eyebrow, GroupIcon, Sheet, btn, tokens } from './ui';
import SharingFields from './SharingFields';
import StaffGroupMembers from '../moderation/StaffGroupMembers';

interface Props {
  onOpenGroup: (groupId: string) => void;
  /** After a successful join: refresh the list of my groups, then open it. */
  onJoined: (groupId: string) => void;
  /** App staff may take down a public group. Server-enforced; this only draws the button. */
  isStaff: boolean;
  /** The signed-in user, so staff are never offered a Remove on their own row. */
  userId: string | null;
  theme: 'dark' | 'light';
}

const SEARCH_DEBOUNCE_MS = 300;

const joinLabel = (g: ExploreGroup): string => {
  if (g.my_status === 'member') return 'Open';
  if (g.my_status === 'requested') return 'Requested';
  if (g.my_status === 'banned') return 'Can’t join';
  return g.join_policy === 'open' ? 'Join' : 'Request';
};

const ExploreGroups: React.FC<Props> = ({ onOpenGroup, onJoined, isStaff, userId, theme }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<ExploreGroup[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ExploreGroup | null>(null);
  /* A slow response for an old search must not overwrite a newer one. */
  const seqRef = useRef(0);

  const load = useCallback(async (q: string) => {
    const seq = ++seqRef.current;
    try {
      const page = await exploreGroups(q);
      if (seq !== seqRef.current) return;
      setRows(page);
      setHasMore(page.length === EXPLORE_PAGE);
      setError(null);
    } catch (e) {
      if (seq !== seqRef.current) return;
      setError(humanError(e));
      setRows(prev => prev ?? []);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(query), query ? SEARCH_DEBOUNCE_MS : 0);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  const loadMore = async () => {
    if (!rows || loadingMore) return;
    setLoadingMore(true);
    const seq = seqRef.current;
    try {
      const page = await exploreGroups(query, rows.length);
      if (seq !== seqRef.current) return;
      // Ordering can shift between pages as groups grow; de-duplicate by id.
      setRows(prev => {
        const seen = new Set((prev ?? []).map(r => r.id));
        return [...(prev ?? []), ...page.filter(r => !seen.has(r.id))];
      });
      setHasMore(page.length === EXPLORE_PAGE);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setLoadingMore(false);
    }
  };

  const patchRow = (id: string, changes: Partial<ExploreGroup>) =>
    setRows(prev => prev?.map(r => (r.id === id ? { ...r, ...changes } : r)) ?? prev);

  return (
    <div className="space-y-4">
      <div className="relative">
        <label htmlFor="explore-search" className="sr-only">Search public groups</label>
        <input
          id="explore-search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search public groups"
          autoComplete="off"
          className={`${t.input} pl-10`}
        />
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${t.faint}`} aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" />
        </svg>
      </div>

      {error && (
        <p className={`text-[11px] font-ui px-4 py-3 rounded-lg border ${t.inset} text-[#E10600]`}>{error}</p>
      )}

      {rows === null ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading groups">
          {[0, 1, 2].map(i => <div key={i} className={`h-[76px] rounded-xl border animate-pulse ${t.card}`} />)}
        </div>
      ) : rows.length === 0 ? (
        !error && (
          <section className={`p-8 rounded-xl border ${t.card}`}>
            <Eyebrow dark={dark}>{query ? 'No matches' : 'Nothing public yet'}</Eyebrow>
            <p className={`text-sm font-ui mt-3 leading-relaxed ${t.body}`}>
              {query
                ? `No public group called anything like “${query.trim()}”.`
                : 'No one has opened a group to the public yet. Make yours public and be the first on this list.'}
            </p>
          </section>
        )
      ) : (
        <ul className="space-y-3">
          {rows.map(g => (
            <li key={g.id}>
              <button
                onClick={() => (g.my_status === 'member' ? onOpenGroup(g.id) : setSelected(g))}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all card-interactive ${t.card}`}
              >
                <GroupIcon icon={g.icon} name={g.name} size={44} dark={dark} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold font-ui truncate ${t.heading}`}>{g.name}</p>
                  <p className={`text-[10px] font-ui mt-0.5 truncate ${t.muted}`}>
                    {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
                    {' · '}{g.join_policy === 'open' ? 'anyone can join' : 'by request'}
                    {g.description && <> · {g.description}</>}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 text-[9px] font-black uppercase tracking-[0.12em] font-ui px-2.5 py-1.5 rounded-md ${
                    g.my_status === 'member' ? `${t.ghost}`
                      : g.my_status ? `${t.inset} ${t.muted} border`
                      : 'bg-[#E10600]/10 text-[#E10600]'
                  }`}
                >
                  {joinLabel(g)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <button onClick={() => void loadMore()} disabled={loadingMore} className={`w-full py-3.5 ${btn} ${t.ghost}`}>
          {loadingMore ? 'Loading…' : 'Show more'}
        </button>
      )}

      {selected && (
        <PublicGroupSheet
          group={selected}
          isStaff={isStaff}
          userId={userId}
          theme={theme}
          onClose={() => setSelected(null)}
          onJoined={id => { setSelected(null); onJoined(id); }}
          onRequested={() => { patchRow(selected.id, { my_status: 'requested' }); setSelected(null); }}
          onCancelled={() => { patchRow(selected.id, { my_status: null }); setSelected(null); }}
          onRemoved={() => { setRows(prev => prev?.filter(r => r.id !== selected.id) ?? prev); setSelected(null); }}
          onMembersChanged={() => void load(query)}
        />
      )}
    </div>
  );
};

const PublicGroupSheet: React.FC<{
  group: ExploreGroup;
  isStaff: boolean;
  userId: string | null;
  theme: 'dark' | 'light';
  onClose: () => void;
  onJoined: (groupId: string) => void;
  onRequested: () => void;
  onCancelled: () => void;
  onRemoved: () => void;
  onMembersChanged: () => void;
}> = ({ group: g, isStaff, userId, theme, onClose, onJoined, onRequested, onCancelled, onRemoved, onMembersChanged }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const [shareHours, setShareHours] = useState(true);
  const [shareTasks, setShareTasks] = useState<TaskShareLevel>('private');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = g.join_policy === 'open';

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(false);
    }
  };

  const join = () => act(async () => {
    const result = open
      ? await joinPublicGroup(g.id, shareHours, shareTasks)
      : await requestToJoin(g.id, message, shareHours, shareTasks);
    if ((result.status === 'joined' || result.status === 'member') && result.group_id) onJoined(result.group_id);
    else if (result.status === 'requested') onRequested();
    else setError(INVITE_STATUS_COPY[result.status] ?? 'That didn’t work. Try again.');
  });

  const footer = g.my_status === 'banned' ? null : g.my_status === 'requested' ? (
    <button onClick={() => void act(async () => { await cancelJoinRequest(g.id); onCancelled(); })} disabled={busy} className={`w-full py-4 ${btn} ${t.ghost}`}>
      {busy ? 'Cancelling…' : 'Cancel request'}
    </button>
  ) : (
    <button onClick={() => void join()} disabled={busy} className={`w-full py-4 ${btn} ${busy ? t.disabled : t.primary}`}>
      {busy ? (open ? 'Joining…' : 'Sending…') : open ? 'Join group' : 'Request to join'}
    </button>
  );

  return (
    <Sheet
      title={open ? 'Join group' : 'Request to join'}
      onClose={onClose}
      dark={dark}
      footer={(footer || error) && (
        <>
          {error && <p className="text-[11px] font-ui text-[#E10600] mb-3">{error}</p>}
          {footer}
        </>
      )}
    >
      <div className="flex items-center gap-4">
        <GroupIcon icon={g.icon} name={g.name} size={52} dark={dark} />
        <div className="min-w-0">
          <p className={`text-lg font-black uppercase tracking-tight font-ui truncate ${t.heading}`}>{g.name}</p>
          <p className={`text-[11px] font-ui ${t.muted}`}>
            {g.member_count} {g.member_count === 1 ? 'member' : 'members'} · {open ? 'anyone can join' : 'an admin approves requests'}
          </p>
        </div>
      </div>
      {g.description && <p className={`text-[12px] font-ui leading-relaxed ${t.muted}`}>{g.description}</p>}

      {g.my_status === 'banned' ? (
        <p className={`text-sm font-ui ${t.body}`}>{INVITE_STATUS_COPY.banned}</p>
      ) : g.my_status === 'requested' ? (
        <p className={`text-sm font-ui ${t.body}`}>Your request is with the group’s admins. You’ll find the group under My groups once they let you in.</p>
      ) : (
        <>
          {!open && (
            <div>
              <label htmlFor="request-message" className={`block text-[9px] font-black uppercase tracking-[0.14em] mb-2 font-ui ${t.muted}`}>
                Note to the admins <span className="normal-case tracking-normal font-medium">(optional)</span>
              </label>
              <textarea
                id="request-message"
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={MAX_REQUEST_MESSAGE}
                rows={2}
                placeholder="e.g. Same coaching batch, Physics section"
                className={`${t.input} resize-none`}
              />
            </div>
          )}
          <div className={`pt-5 border-t ${t.rule}`}>
            <Eyebrow dark={dark} className="mb-4">What other members will see · you can change this later</Eyebrow>
            <SharingFields
              shareHours={shareHours}
              shareTasks={shareTasks}
              onChange={(h, tk) => { setShareHours(h); setShareTasks(tk); }}
              dark={dark}
              disabled={busy}
            />
          </div>
        </>
      )}

      {isStaff && (
        <div className={`pt-5 border-t ${t.rule}`}>
          <StaffGroupMembers groupId={g.id} selfId={userId} dark={dark} onChanged={onMembersChanged} />
        </div>
      )}

      {isStaff && (
        <div className={`pt-5 border-t ${t.rule}`}>
          <button
            onClick={() => {
              if (window.confirm(`Take down “${g.name}” for everyone? Its members, chat and invites are deleted. This can’t be undone.`)) {
                void act(async () => { await deleteGroup(g.id); onRemoved(); });
              }
            }}
            disabled={busy}
            className={`w-full py-3 ${btn} border border-[#E10600]/40 text-[#E10600] hover:bg-[#E10600]/[0.06]`}
          >
            Remove group (staff)
          </button>
        </div>
      )}
    </Sheet>
  );
};

export default ExploreGroups;
