/* ── Create, edit, join ──
   Three short forms. Create and Edit share one body because a group's
   settings are the same fields whether it is new or not; only Create asks
   about your own hours, because only Create is also you joining. */

import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  InvitePolicy,
  MAX_GROUP_DESCRIPTION,
  MAX_GROUP_NAME,
  MyGroup,
  createGroup,
  formatInviteCode,
  humanError,
  isCompleteCode,
  normalizeInviteCode,
  updateGroup,
  validateGroupName,
} from './api';
import { GROUP_ICONS, Segmented, Sheet, Switch, btn, tokens } from './ui';
import InvitePanel from './InvitePanel';

interface Fields {
  name: string;
  description: string;
  icon: string | null;
  invitePolicy: InvitePolicy;
}

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
          placeholder="ALLEN KATRAJ — JEE 2027"
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
          placeholder="Batch B2. Minimum 6 hours or you explain yourself."
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = validateGroupName(fields.name);

  const submit = async () => {
    if (!name || saving) return;
    setSaving(true);
    setError(null);
    try {
      const id = await createGroup({ ...fields, name, description: fields.description.trim(), shareHours });
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
      <div className={`pt-5 border-t ${t.rule} flex items-start justify-between gap-4`}>
        <div>
          <p className={`text-[12px] font-bold font-ui ${t.heading}`}>Show my study hours to this group</p>
          <p className={`text-[11px] font-ui mt-1 ${t.muted}`}>Your totals only. Change it any time.</p>
        </div>
        <Switch on={shareHours} onToggle={setShareHours} label="Show my study hours to this group" dark={dark} />
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = validateGroupName(fields.name);

  const submit = async () => {
    if (!name || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateGroup(group.id, { ...fields, name, description: fields.description.trim() });
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
