/* ── The gate ──
   What everyone who is not in the beta sees in the Mentor tab. It says what
   the Mentor is, that it is invite-only, and takes a code — typed, or carried
   in from a `/?beta=CODE` link through sign-up (mentor/invite.ts).

   Nothing here decides access. Redeeming is a server call that either adds
   this account to `mentor_beta_users` or says why not; the tab only changes
   once `mentor_status()` agrees. */

import React, { useEffect, useState } from 'react';
import { tokens, btn, Eyebrow } from '../groups/ui';
import {
  BETA_STATUS_COPY, BetaInviteStatus, formatInviteCode, inviteError, isCompleteCode,
  normalizeInviteCode, previewBetaInvite, redeemBetaInvite,
} from './invite';

interface Props {
  theme: 'dark' | 'light';
  signedIn: boolean;
  /** A code carried in from an invite link, if there is one. */
  pendingCode: string | null;
  onOpenAuth: () => void;
  /** Redeemed (or already in): re-check access and forget the pending code. */
  onJoined: () => void;
  /** A carried-in code that did not work, and the student has read why. */
  onDropPending: () => void;
}

const MentorGate: React.FC<Props> = ({ theme, signedIn, pendingCode, onOpenAuth, onJoined, onDropPending }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const [code, setCode] = useState(pendingCode ? formatInviteCode(pendingCode) : '');
  const [status, setStatus] = useState<BetaInviteStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* A link-carried code is checked as soon as there is a session to check it
     with, so the student sees "this invite is good" before pressing anything. */
  useEffect(() => {
    if (!signedIn || !pendingCode) return;
    setCode(formatInviteCode(pendingCode));
    let live = true;
    previewBetaInvite(pendingCode)
      .then(s => {
        if (!live) return;
        if (s === 'member') { onJoined(); return; }
        setStatus(s);
      })
      .catch(e => { if (live) setError(inviteError(e)); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, pendingCode]);

  const redeem = async () => {
    if (!isCompleteCode(code) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const s = await redeemBetaInvite(normalizeInviteCode(code));
      if (s === 'joined' || s === 'member') { onJoined(); return; }
      setStatus(s);
      if (pendingCode) onDropPending();
    } catch (e) {
      setError(inviteError(e));
    } finally {
      setBusy(false);
    }
  };

  const message = error ?? (status && status !== 'ok' ? BETA_STATUS_COPY[status] : null);

  return (
    <div className="space-y-6">
      <div>
        <Eyebrow dark={dark}>Mentor · closed beta</Eyebrow>
        <h2 className={`mt-1 text-3xl md:text-4xl font-display uppercase ${t.heading}`}>Invite only.</h2>
      </div>

      <section className={`rounded-xl border p-6 md:p-8 ${t.card}`}>
        <p className={`text-base font-ui leading-relaxed ${t.body}`}>
          The Mentor reads your syllabus, your hours and your board, and plans from them — your day, your roadmap, whether your pace gets you there. It is open to a small group of students while it is tested. You get in with an invite from someone already inside.
        </p>

        {pendingCode && status === 'ok' && (
          <p className="mt-5 text-sm font-bold uppercase tracking-wide font-ui text-green-500">You've been invited. One tap and you're in.</p>
        )}

        {!signedIn ? (
          <div className="mt-6 space-y-3">
            {pendingCode && (
              <p className={`text-sm font-ui ${t.body}`}>
                Your invite <span className="font-bold tracking-[0.15em]">{formatInviteCode(pendingCode)}</span> is saved on this device. Sign in or make an account, and it will be waiting here.
              </p>
            )}
            <button type="button" onClick={onOpenAuth} className={`${btn} px-6 py-3 ${t.primary}`}>
              {pendingCode ? 'Sign in to use your invite' : 'Sign in'}
            </button>
          </div>
        ) : (
          <form
            className="mt-6 flex flex-col sm:flex-row gap-3"
            onSubmit={e => { e.preventDefault(); void redeem(); }}
          >
            <input
              value={code}
              onChange={e => { setCode(formatInviteCode(e.target.value).slice(0, 14)); setStatus(null); setError(null); }}
              placeholder="XXXX-XXXX-XXXX"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-label="Invite code"
              className={`${t.input} sm:max-w-[240px] tracking-[0.2em] font-bold uppercase`}
            />
            <button
              type="submit"
              disabled={!isCompleteCode(code) || busy}
              className={`${btn} px-6 py-3 ${isCompleteCode(code) && !busy ? t.primary : t.disabled}`}
            >
              {busy ? 'Checking…' : 'Unlock the Mentor'}
            </button>
          </form>
        )}

        {message && (
          <p className={`mt-4 text-sm font-ui ${status === 'full' || status === 'throttled' ? t.muted : 'text-[#E10600]'}`} role="alert">{message}</p>
        )}
      </section>

      <p className={`text-xs font-ui ${t.muted}`}>No invite? Everything else in Tracker Alpha works exactly as before — the Mentor is an extra, not a paywall.</p>
    </div>
  );
};

export default MentorGate;
