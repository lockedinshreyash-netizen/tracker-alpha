/* ── Create, edit, join ──
   Three short forms. Create and Edit share one body because a group's
   settings are the same fields whether it is new or not; only Create asks
   about your own sharing, because only Create is also you joining.

   Access — who can find the group and how people get in — is its own block,
   and in Edit it is drawn only for the owner, because the server refuses it
   from anyone else (update_group). Making a group public puts its name in
   front of every student in the app; that is the owner's call. */

import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  GroupVisibility,
  InvitePolicy,
  JoinPolicy,
  MAX_GROUP_DESCRIPTION,
  MAX_GROUP_NAME,
  MyGroup,
  createGroup,
  formatInviteCode,
  humanError,
  isCompleteCode,
  normalizeInviteCode,
  TaskShareLevel,
  setSharing,
  updateGroup,
  validateGroupName,
} from './api';
import { GROUP_ICONS, Eyebrow, Segmented, Sheet, btn, tokens } from './ui';
import SharingFields from './SharingFields';
import InvitePanel from './InvitePanel';

interface Fields {
  name: string;
  description: string;
  icon: string | null;
  invitePolicy: InvitePolicy;
}

interface Access {
  visibility: GroupVisibility;
  joinPolicy: JoinPolicy;
}

/** Private → invite only. Public → listed in Explore, and either open or by request. */
const AccessFields: React.FC<{
  value: Access;
  onChange: (v: Access) => void;
  dark: boolean;
}> = ({ value, onChange, dark }) => {
  const t = tokens(dark);
  const label = `block text-[9px] font-black uppercase tracking-[0.14em] mb-2 font-ui ${t.muted}`;
  const isPublic = value.visibility === 'discoverable';
  return (
    <div className="space-y-4">
      <div>
        <p className={label}>Who can find this group</p>
        <Segmented<GroupVisibility>
          value={value.visibility}
          onChange={v => onChange({
            visibility: v,
            // Public needs a way in; asking is the safer default.
            joinPolicy: v === 'private' ? 'invite' : value.joinPolicy === 'open' ? 'open' : 'request',
          })}
          options={[{ value: 'private', label: 'Private' }, { value: 'discoverable', label: 'Public' }]}
          dark={dark}
          label="Who can find this group"
        />
        <p className={`text-[10px] font-ui mt-2 leading-relaxed ${t.muted}`}>
          {isPublic
            ? 'Listed in Explore. Anyone signed in sees the name, icon, description and member count. Hours, tasks, members and chat stay members-only.'
            : 'Not listed anywhere. The only way in is an invite link or code.'}
        </p>
      </div>

      {isPublic && (
        <div>
          <p className={label}>Who can join</p>
          <Segmented<JoinPolicy>
            value={value.joinPolicy === 'open' ? 'open' : 'request'}
            onChange={v => onChange({ ...value, joinPolicy: v })}
            options={[{ value: 'open', label: 'Anyone' }, { value: 'request', label: 'Approve requests' }]}
            dark={dark}
            label="Who can join"
          />
          <p className={`text-[10px] font-ui mt-2 leading-relaxed ${t.muted}`}>
            {value.joinPolicy === 'open'
              ? 'Anyone can walk straight in and read the chat history. Invite links still work.'
              : 'People ask to join; you and your admins approve or decline. Invite links skip the queue.'}
          </p>
        </div>
      )}
    </div>
  );
};

const GroupFields: React.FC<{
  value: Fields;
  onChange: (v: Fields) => void;
  dark: boolean;
}> = ({ value, onChange, dark }) => {
  const t = tokens(dark);
  const label = `block text-[9px] font-black uppercase tracking-[0.14em] mb-2 font-ui ${t.muted}`;
  return (
    <>
      <div>
        <label htmlFor="group-name" className={label}>Name</label>
        <input
          id="group-name"
          value={value.name}
          onChange={e => onChange({ ...value, name: e.target.value })}
          maxLength={MAX_GROUP_NAME}
          placeholder="e.g. JEE 2027 Study Group"
          autoFocus
          className={t.input}
        />
      </div>

      <div>
        <label htmlFor="group-description" className={label}>Description <span className="normal-case tracking-normal font-medium">(optional)</span></label>
        <textarea
          id="group-description"
          value={value.description}
          onChange={e => onChange({ ...value, description: e.target.value })}
          maxLength={MAX_GROUP_DESCRIPTION}
          rows={2}
          placeholder="e.g. Six hours a day, minimum. No excuses."
          className={`${t.input} resize-none`}
        />
      </div>

      <div>
        <p className={label}>Icon</p>
        <div className="grid grid-cols-7 gap-2" role="radiogroup" aria-label="Group icon">
          <button
            type="button"
            role="radio"
            aria-checked={value.icon === null}
            aria-label="No icon"
            onClick={() => onChange({ ...value, icon: null })}
            className={`aspect-square rounded-lg border text-[9px] font-black uppercase font-ui transition-all ${value.icon === null ? 'border-[#E10600] ring-1 ring-[#E10600]' : t.rule} ${t.muted}`}
          >
            Aa
          </button>
          {GROUP_ICONS.map(icon => (
            <button
              key={icon}
              type="button"
              role="radio"
              aria-checked={value.icon === icon}
              aria-label={icon}
              onClick={() => onChange({ ...value, icon })}
              className={`aspect-square rounded-lg border text-lg transition-all ${value.icon === icon ? 'border-[#E10600] ring-1 ring-[#E10600]' : t.rule}`}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={label}>Who can invite people</p>
        <Segmented
          value={value.invitePolicy}
          onChange={v => onChange({ ...value, invitePolicy: v })}
          options={[{ value: 'admins', label: 'Admins only' }, { value: 'members', label: 'Any member' }]}
          dark={dark}
          label="Who can invite people"
        />
        <p className={`text-[10px] font-ui mt-2 ${t.muted}`}>
          {value.invitePolicy === 'admins'
            ? 'Only you and the admins you appoint can create invite links.'
            : 'Anyone in the group can create a link. Member links expire within a week.'}
        </p>
      </div>
    </>
  );
};

export const CreateGroupSheet: React.FC<{
  theme: 'dark' | 'light';
  onClose: () => void;
  onCreated: (groupId: string) => void;
}> = ({ theme, onClose, onCreated }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const [fields, setFields] = useState<Fields>({ name: '', description: '', icon: '🔥', invitePolicy: 'admins' });
  const [shareHours, setShareHours] = useState(true);
  const [shareTasks, setShareTasks] = useState<TaskShareLevel>('private');
  const [access, setAccess] = useState<Access>({ visibility: 'private', joinPolicy: 'invite' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = validateGroupName(fields.name);

  const submit = async () => {
    if (!name || saving) return;
    setSaving(true);
    setError(null);
    try {
      const id = await createGroup({ ...fields, ...access, name, description: fields.description.trim(), shareHours });
      /* A second call rather than a new create_group parameter, so this works
         against the schema already deployed. If it fails the group exists with
         tasks private — the safe side — and the Tasks section shows exactly that. */
      if (shareTasks !== 'private') await setSharing(id, shareHours, shareTasks).catch(() => {});
      onCreated(id);
    } catch (e) {
      setError(humanError(e));
      setSaving(false);
    }
  };

  return (
    <Sheet
      title="New group"
      onClose={onClose}
      dark={dark}
      footer={
        <>
          {error && <p className="text-[11px] font-ui text-[#E10600] mb-3">{error}</p>}
          <button onClick={() => void submit()} disabled={!name || saving} className={`w-full py-4 ${btn} ${name && !saving ? t.primary : t.disabled}`}>
            {saving ? 'Creating…' : 'Create group'}
          </button>
        </>
      }
    >
      <GroupFields value={fields} onChange={setFields} dark={dark} />
      <div className={`pt-5 border-t ${t.rule}`}>
        <AccessFields value={access} onChange={setAccess} dark={dark} />
      </div>
      <div className={`pt-5 border-t ${t.rule}`}>
        <Eyebrow dark={dark} className="mb-4">What this group sees of you · change any time</Eyebrow>
        <SharingFields
          shareHours={shareHours}
          shareTasks={shareTasks}
          onChange={(h, tk) => { setShareHours(h); setShareTasks(tk); }}
          dark={dark}
        />
      </div>
    </Sheet>
  );
};

export const EditGroupSheet: React.FC<{
  group: MyGroup;
  theme: 'dark' | 'light';
  onClose: () => void;
  onSaved: () => void;
}> = ({ group, theme, onClose, onSaved }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const [fields, setFields] = useState<Fields>({
    name: group.name,
    description: group.description ?? '',
    icon: group.icon,
    invitePolicy: group.invite_policy,
  });
  const isOwner = group.role === 'owner';
  const [access, setAccess] = useState<Access>({
    visibility: group.visibility,
    joinPolicy: group.join_policy ?? 'invite',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = validateGroupName(fields.name);

  const submit = async () => {
    if (!name || saving) return;
    const goingPublic = access.visibility === 'discoverable' && group.visibility !== 'discoverable';
    if (goingPublic && !window.confirm('Make this group public? Its name, icon, description and member count will be listed in Explore for every student.')) return;
    setSaving(true);
    setError(null);
    try {
      await updateGroup(group.id, {
        ...fields,
        name,
        description: fields.description.trim(),
        ...(isOwner ? { access } : {}),
      });
      onSaved();
    } catch (e) {
      setError(humanError(e));
      setSaving(false);
    }
  };

  return (
    <Sheet
      title="Group settings"
      onClose={onClose}
      dark={dark}
      footer={
        <>
          {error && <p className="text-[11px] font-ui text-[#E10600] mb-3">{error}</p>}
          <button onClick={() => void submit()} disabled={!name || saving} className={`w-full py-4 ${btn} ${name && !saving ? t.primary : t.disabled}`}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <GroupFields value={fields} onChange={setFields} dark={dark} />
      <div className={`pt-5 border-t ${t.rule}`}>
        {isOwner ? (
          <AccessFields value={access} onChange={setAccess} dark={dark} />
        ) : (
          <p className={`text-[11px] font-ui leading-relaxed ${t.muted}`}>
            {group.visibility === 'discoverable'
              ? `Public · ${group.join_policy === 'open' ? 'anyone can join' : 'join by request'}.`
              : 'Private · invite only.'}{' '}
            Only the owner can change who can find and join this group.
          </p>
        )}
      </div>
    </Sheet>
  );
};

export const JoinCodeSheet: React.FC<{
  user: User;
  theme: 'dark' | 'light';
  onClose: () => void;
  onJoined: (groupId: string) => void;
  onOpenAuth: () => void;
}> = ({ user, theme, onClose, onJoined, onOpenAuth }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const [draft, setDraft] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const ready = isCompleteCode(draft);

  return (
    <Sheet title="Join a group" onClose={onClose} dark={dark}>
      {code ? (
        <>
          <InvitePanel code={code} user={user} onJoined={onJoined} onDismiss={() => setCode(null)} onOpenAuth={onOpenAuth} theme={theme} bare />
        </>
      ) : (
        <form
          onSubmit={e => { e.preventDefault(); if (ready) setCode(normalizeInviteCode(draft)); }}
          className="space-y-4"
        >
          <label htmlFor="invite-code" className={`block text-[9px] font-black uppercase tracking-[0.14em] font-ui ${t.muted}`}>
            Invite code
          </label>
          <input
            id="invite-code"
            value={draft}
            onChange={e => setDraft(formatInviteCode(e.target.value).slice(0, 14))}
            placeholder="XXXX-XXXX-XXXX"
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            className={`${t.input} text-center text-lg tracking-[0.2em] font-data`}
          />
          <p className={`text-[11px] font-ui ${t.muted}`}>
            Twelve characters from whoever runs the group. Opening their invite link works too.
          </p>
          <button type="submit" disabled={!ready} className={`w-full py-4 ${btn} ${ready ? t.primary : t.disabled}`}>
            Find group
          </button>
        </form>
      )}
    </Sheet>
  );
};
