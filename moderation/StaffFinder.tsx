import React, { useEffect, useRef, useState } from 'react';
import { ProfileSummary } from '../profile/profileApi';
import { GroupIcon, Segmented, tokens } from '../groups/ui';
import { StaffGroup, humanError, searchPeople, searchStaffGroups } from './api';
import PersonPanel from './PersonPanel';
import StaffGroupMembers from './StaffGroupMembers';

interface Props {
  adminId: string;
  dark: boolean;
  /** After any hide or removal, so the console's lists below catch up. */
  onChanged: () => void;
}

type Mode = 'people' | 'groups';

/** Long enough that typing a name is one request, not one per letter. */
const DEBOUNCE_MS = 300;

/**
 * Find someone, or a group, and act on them wherever they are.
 *
 * People: everywhere one person can be seen — the race and every group they
 * are in, private ones included (PersonPanel). Groups: any group by name,
 * private ones included — a report usually names the group and nothing else
 * — opening onto its roster (StaffGroupMembers).
 */
const StaffFinder: React.FC<Props> = ({ adminId, dark, onChanged }) => {
  const t = tokens(dark);
  const [mode, setMode] = useState<Mode>('people');
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<ProfileSummary[]>([]);
  const [groups, setGroups] = useState<StaffGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  /** Drops a slow answer to a query that has since changed. */
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    const mine = ++seq.current;
    setOpen(null);
    if (q.length < 2) {
      setPeople([]);
      setGroups([]);
      setSearching(false);
      setError(null);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        if (mode === 'people') {
          const rows = await searchPeople(q);
          if (mine === seq.current) setPeople(rows);
        } else {
          const rows = await searchStaffGroups(q);
          if (mine === seq.current) setGroups(rows);
        }
        if (mine === seq.current) setError(null);
      } catch (e) {
        if (mine === seq.current) setError(humanError(e));
      } finally {
        if (mine === seq.current) setSearching(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, mode]);

  const results = mode === 'people' ? people : groups;
  const searched = query.trim().length >= 2 && !searching;

  const resultRow = (id: string, body: React.ReactNode) => (
    <button
      onClick={() => setOpen(prev => (prev === id ? null : id))}
      aria-expanded={open === id}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${t.hover}`}
    >
      {body}
      <span className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${t.muted}`}>{open === id ? 'Close' : 'Open'}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="sm:w-56 shrink-0">
          <Segmented
            value={mode}
            options={[{ value: 'people', label: 'People' }, { value: 'groups', label: 'Groups' }]}
            onChange={setMode}
            dark={dark}
            label="Search for"
          />
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={mode === 'people' ? 'Name or @handle' : 'Group name — private groups too'}
          aria-label={mode === 'people' ? 'Search people' : 'Search groups'}
          className={t.input}
        />
      </div>

      {error && <p className="text-[11px] font-ui text-[#E10600]">{error}</p>}
      {searching && <p className={`text-[11px] font-ui ${t.muted}`}>Searching…</p>}
      {searched && !error && !results.length && (
        <p className={`text-[11px] font-ui ${t.muted}`}>{mode === 'people' ? 'Nobody by that name.' : 'No group by that name.'}</p>
      )}

      {mode === 'people' && people.length > 0 && (
        <ul className="space-y-1">
          {people.map(p => (
            <li key={p.user_id}>
              {resultRow(p.user_id, (
                <span className="flex-1 min-w-0">
                  <span className={`block truncate text-[13px] font-bold font-ui ${t.heading}`}>{p.display_name}</span>
                  <span className={`block truncate text-[11px] font-ui ${t.muted}`}>@{p.handle}{p.user_id === adminId ? ' · you' : ''}</span>
                </span>
              ))}
              {open === p.user_id && <PersonPanel person={p} selfId={adminId} dark={dark} onChanged={onChanged} />}
            </li>
          ))}
        </ul>
      )}

      {mode === 'groups' && groups.length > 0 && (
        <ul className="space-y-1">
          {groups.map(g => (
            <li key={g.id}>
              {resultRow(g.id, (
                <>
                  <GroupIcon icon={g.icon} name={g.name} size={32} dark={dark} />
                  <span className="flex-1 min-w-0">
                    <span className={`block truncate text-[13px] font-bold font-ui ${t.heading}`}>{g.name}</span>
                    <span className={`block text-[11px] font-ui ${t.muted}`}>
                      {g.visibility === 'discoverable' ? 'Public' : 'Private'} · {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
                    </span>
                  </span>
                </>
              ))}
              {open === g.id && (
                <div className={`mt-3 p-4 md:p-5 rounded-lg border ${t.inset}`}>
                  <StaffGroupMembers groupId={g.id} selfId={adminId} dark={dark} onChanged={onChanged} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default StaffFinder;
