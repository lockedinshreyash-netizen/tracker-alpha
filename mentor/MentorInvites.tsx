/* ── Inviting people into the beta ──
   Drawn only for accounts with invite rights (`mentor_status().can_invite`),
   and every action is re-checked by the database: create_mentor_invite
   refuses anyone without the right, and RLS returns only the caller's own
   invites. A link is a code; a code is a link — both are shown, because a
   code survives being read out loud and a link survives being forwarded. */

import React, { useCallback, useEffect, useState } from 'react';
import { tokens, btn, Eyebrow } from '../groups/ui';
import {
  BetaInvite, betaInviteLink, createBetaInvite, formatInviteCode, inviteError, isLive, listBetaInvites, revokeBetaInvite,
} from './invite';
import { formatDay } from './dates';

const USES = [1, 5] as const;

const MentorInvites: React.FC<{ theme: 'dark' | 'light' }> = ({ theme }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const [invites, setInvites] = useState<BetaInvite[] | null>(null);
  const [uses, setUses] = useState<number>(1);
  const [fresh, setFresh] = useState<BetaInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(() => {
    listBetaInvites().then(setInvites).catch(e => setError(inviteError(e)));
  }, []);
  useEffect(load, [load]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const inv = await createBetaInvite(uses, 168);
      setFresh(inv);
      load();
    } catch (e) {
      setError(inviteError(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(c => (c === what ? null : c)), 1800);
    } catch {
      setError('Copying was blocked — select the text and copy it yourself.');
    }
  };

  const share = (inv: BetaInvite) => {
    const url = betaInviteLink(inv.code);
    if (navigator.share) {
      navigator.share({ title: 'Tracker Alpha Mentor', text: `You're invited to the Tracker Alpha Mentor beta. Code: ${formatInviteCode(inv.code)}`, url })
        .catch(() => { /* dismissed the sheet */ });
    } else void copy(url, `link-${inv.id}`);
  };

  const revoke = async (id: string) => {
    try {
      await revokeBetaInvite(id);
      if (fresh?.id === id) setFresh(null);
      load();
    } catch (e) {
      setError(inviteError(e));
    }
  };

  const live = (invites ?? []).filter(isLive);
  const spent = (invites ?? []).filter(i => !isLive(i)).slice(0, 5);

  return (
    <section className={`rounded-xl border p-5 md:p-6 ${t.card}`}>
      <Eyebrow dark={dark}>Beta invites · you can bring people in</Eyebrow>
      <p className={`mt-2 text-sm font-ui ${t.body}`}>Each invite is a link and a code, good for 7 days. Only people with one get past the gate.</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Uses per invite" className={`flex p-1 rounded-lg border ${t.inset}`}>
          {USES.map(n => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={uses === n}
              onClick={() => setUses(n)}
              className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-[0.12em] font-ui ${uses === n ? t.secondary : t.muted}`}
            >{n === 1 ? 'One person' : `${n} people`}</button>
          ))}
        </div>
        <button type="button" onClick={create} disabled={busy} className={`${btn} px-5 py-2.5 ${busy ? t.disabled : t.primary}`}>
          {busy ? 'Creating…' : 'Create invite'}
        </button>
      </div>

      {fresh && (
        <div className={`mt-4 rounded-lg border p-4 ${t.inset}`}>
          <p className={`text-2xl font-bold tracking-[0.2em] font-ui ${t.heading}`}>{formatInviteCode(fresh.code)}</p>
          <p className={`mt-1 text-xs font-ui break-all ${t.muted}`}>{betaInviteLink(fresh.code)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => copy(betaInviteLink(fresh.code), 'fresh-link')} className={`${btn} px-4 py-2 ${t.ghost}`}>
              {copied === 'fresh-link' ? 'Copied' : 'Copy link'}
            </button>
            <button type="button" onClick={() => copy(formatInviteCode(fresh.code), 'fresh-code')} className={`${btn} px-4 py-2 ${t.ghost}`}>
              {copied === 'fresh-code' ? 'Copied' : 'Copy code'}
            </button>
            <button type="button" onClick={() => share(fresh)} className={`${btn} px-4 py-2 ${t.ghost}`}>Share</button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm font-ui text-[#E10600]" role="alert">{error}</p>}

      {live.length > 0 && (
        <ul className={`mt-5 divide-y border-y ${t.rule} ${dark ? 'divide-white/[0.06]' : 'divide-[#E3E0D9]'}`}>
          {live.map(i => (
            <li key={i.id} className="py-3 flex flex-wrap items-center gap-3">
              <span className={`text-sm font-bold tracking-[0.15em] font-ui ${t.heading}`}>{formatInviteCode(i.code)}</span>
              <span className={`text-[11px] font-ui ${t.muted}`}>
                {i.uses}/{i.max_uses} used{i.expires_at ? ` · until ${formatDay(i.expires_at.slice(0, 10))}` : ''}
              </span>
              <span className="ml-auto flex gap-2">
                <button type="button" onClick={() => share(i)} className={`${btn} px-3 py-1.5 ${t.ghost}`}>
                  {copied === `link-${i.id}` ? 'Copied' : 'Share'}
                </button>
                <button type="button" onClick={() => revoke(i.id)} className={`${btn} px-3 py-1.5 ${t.ghost}`}>Revoke</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {spent.length > 0 && (
        <p className={`mt-3 text-[11px] font-ui ${t.muted}`}>
          Finished: {spent.map(i => `${formatInviteCode(i.code)} (${i.revoked_at ? 'revoked' : i.uses >= i.max_uses ? 'used' : 'expired'})`).join(' · ')}
        </p>
      )}
    </section>
  );
};

export default MentorInvites;
