/* ── Invite people ──
   A sheet, opened from the group header (or straight after creating a group,
   whose first job is people). One primary action — create a link — with the
   defaults most groups want (a week, unlimited uses); expiry and use limits
   are there for anyone who needs them, behind "Link options", instead of two
   rows of choices everyone has to read past.

   Drawn only for somebody allowed to invite, and every call is re-checked by
   create_invite()/revoke_invite() server-side anyway. */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useProfiles } from '../profile/profileCache';
import { GroupInvite, MyGroup, createInvite, fetchInvites, formatInviteCode, humanError, inviteLink, revokeInvite } from './api';
import { GroupsState } from './useGroups';
import { Eyebrow, Segmented, Sheet, btn, tokens } from './ui';

type Expiry = '24' | '168' | '720' | 'never';
type Uses = 'any' | '1' | '10' | '50';

const EXPIRY_LABEL: Record<Expiry, string> = { '24': '1 day', '168': '7 days', '720': '30 days', never: 'never' };

const expiresLabel = (iso: string | null): string => {
  if (!iso) return 'Never expires';
  const ms = new Date(iso).getTime() - Date.now();
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return 'Expires within the hour';
  if (hours < 48) return `Expires in ${hours}h`;
  return `Expires in ${Math.round(hours / 24)} days`;
};

interface Props {
  group: MyGroup;
  userId: string;
  groups: GroupsState;
  onClose: () => void;
  theme: 'dark' | 'light';
}

const InviteSheet: React.FC<Props> = ({ group, userId, groups, onClose, theme }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const isAdmin = group.role === 'owner' || group.role === 'admin';

  const [invites, setInvites] = useState<GroupInvite[] | null>(null);
  const [fresh, setFresh] = useState<GroupInvite | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [expiry, setExpiry] = useState<Expiry>('168');
  const [uses, setUses] = useState<Uses>('any');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setInvites(await fetchInvites(group.id));
    } catch (e) {
      setError(humanError(e));
      setInvites(prev => prev ?? []);
    }
  }, [group.id]);

  useEffect(() => { void load(); }, [load]);

  const creators = useMemo(() => (invites ?? []).map(i => i.created_by).filter((id): id is string => !!id), [invites]);
  const profiles = useProfiles(creators);

  const mint = async () => {
    setBusy('invite');
    setError(null);
    try {
      const created = await createInvite(
        group.id,
        expiry === 'never' ? null : Number(expiry),
        uses === 'any' ? null : Number(uses),
      );
      setFresh(created);
      setShowOptions(false);
      await Promise.all([load(), groups.refresh()]);
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (inv: GroupInvite) => {
    if (!window.confirm('Revoke this invite? Anyone holding the link won’t be able to use it.')) return;
    setBusy(`revoke-${inv.id}`);
    setError(null);
    try {
      await revokeInvite(inv.id);
      if (fresh?.id === inv.id) setFresh(null);
      await load();
    } catch (e) {
      setError(humanError(e));
    } finally {
      setBusy(null);
    }
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(c => (c === key ? null : c)), 1800);
    } catch {
      window.prompt('Copy this:', text);
    }
  };

  /* navigator.share with text only — no files, so every browser that has it
     can take it; desktop browsers without it get the copy button alone. */
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const share = (inv: GroupInvite) => {
    void navigator.share({
      title: group.name,
      text: `Join ${group.name} on Tracker Alpha. Code: ${formatInviteCode(inv.code)}`,
      url: inviteLink(inv.code),
    }).catch(() => { /* dismissed */ });
  };

  const small = `text-[10px] font-black uppercase tracking-[0.1em] font-ui`;
  const others = (invites ?? []).filter(i => i.id !== fresh?.id);

  return (
    <Sheet title="Invite people" onClose={onClose} dark={dark}>
      {error && <p className="text-[11px] font-ui text-[#E10600]">{error}</p>}

      {fresh ? (
        <div>
          <p className={`text-[11px] font-ui ${t.muted}`}>Send them the link, or read out the code.</p>
          <p className={`font-display text-3xl tracking-[0.08em] mt-3 ${t.heading}`}>{formatInviteCode(fresh.code)}</p>
          <p className={`text-[11px] font-ui mt-2 break-all ${t.muted}`}>{inviteLink(fresh.code)}</p>
          <div className="flex flex-wrap gap-2 mt-5">
            <button onClick={() => void copy(inviteLink(fresh.code), 'fresh')} className={`flex-1 px-6 py-3 ${btn} ${t.primary}`}>
              {copied === 'fresh' ? 'Copied' : 'Copy link'}
            </button>
            {canShare && <button onClick={() => share(fresh)} className={`px-6 py-3 ${btn} ${t.ghost}`}>Share</button>}
          </div>
          <p className={`text-[10px] font-ui mt-4 ${t.muted}`}>
            {expiresLabel(fresh.expires_at)} · {fresh.max_uses ? `${fresh.max_uses} ${fresh.max_uses === 1 ? 'use' : 'uses'}` : 'Unlimited uses'}
          </p>
        </div>
      ) : (
        <div>
          <p className={`text-[12px] font-ui leading-relaxed ${t.body}`}>
            Anyone with the link or code can join {group.name}. You choose what you share; they choose what they share.
          </p>
          <button
            onClick={() => void mint()}
            disabled={busy === 'invite'}
            className={`w-full mt-5 py-4 ${btn} ${busy === 'invite' ? t.disabled : t.primary}`}
          >
            {busy === 'invite' ? 'Creating…' : 'Create invite link'}
          </button>
          <button
            onClick={() => setShowOptions(v => !v)}
            aria-expanded={showOptions}
            className={`mt-3 ${small} ${t.muted} hover:text-[#E10600]`}
          >
            {expiry === 'never' ? 'Never expires' : `Expires in ${EXPIRY_LABEL[expiry]}`} · {uses === 'any' ? 'unlimited uses' : `${uses} ${uses === '1' ? 'use' : 'uses'}`} · {showOptions ? 'Done' : 'Change'}
          </button>

          {showOptions && (
            <div className="mt-4 space-y-4">
              <div>
                <p className={`text-[9px] font-black uppercase tracking-[0.14em] mb-2 font-ui ${t.muted}`}>Expires</p>
                <Segmented<Expiry>
                  value={expiry}
                  onChange={setExpiry}
                  options={[
                    { value: '24', label: '1 day' },
                    { value: '168', label: '7 days' },
                    ...(isAdmin ? [{ value: '720' as Expiry, label: '30 days' }, { value: 'never' as Expiry, label: 'Never' }] : []),
                  ]}
                  dark={dark}
                  label="Invite expiry"
                  size="sm"
                />
              </div>
              <div>
                <p className={`text-[9px] font-black uppercase tracking-[0.14em] mb-2 font-ui ${t.muted}`}>Uses</p>
                <Segmented<Uses>
                  value={uses}
                  onChange={setUses}
                  options={[
                    { value: 'any', label: 'Unlimited' },
                    { value: '1', label: '1' },
                    { value: '10', label: '10' },
                    { value: '50', label: '50' },
                  ]}
                  dark={dark}
                  label="Invite uses"
                  size="sm"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {fresh && (
        <button onClick={() => setFresh(null)} className={`${small} ${t.muted} hover:text-[#E10600]`}>
          Create another link
        </button>
      )}

      {others.length > 0 && (
        <div className={`pt-5 border-t ${t.rule}`}>
          <Eyebrow dark={dark} className="mb-3">{isAdmin ? 'Live invites' : 'Your live invites'}</Eyebrow>
          <ul className="space-y-2">
            {others.map(inv => (
              <li key={inv.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${t.inset}`}>
                <div className="min-w-0 flex-1">
                  <p className={`font-data text-[12px] tracking-[0.12em] ${t.heading}`}>{formatInviteCode(inv.code)}</p>
                  <p className={`text-[10px] font-ui mt-0.5 ${t.muted}`}>
                    {inv.uses}{inv.max_uses ? `/${inv.max_uses}` : ''} used · {expiresLabel(inv.expires_at)}
                    {isAdmin && inv.created_by && inv.created_by !== userId && (
                      <> · by {profiles[inv.created_by]?.display_name ?? 'a member'}</>
                    )}
                  </p>
                </div>
                <button onClick={() => void copy(inviteLink(inv.code), inv.id)} className={`${small} ${t.muted} hover:text-[#E10600]`}>
                  {copied === inv.id ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={() => void revoke(inv)}
                  disabled={busy === `revoke-${inv.id}`}
                  className={`${small} text-[#E10600]`}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
};

export default InviteSheet;
