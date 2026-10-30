/* ── Your membership ──
   The card, who vouched for you, and your one invite. Opened from quick
   settings and the Profile tab, and once on its own after the doors close
   (`intro`), as the founding-member moment: "You're No. 0412. You get one
   invite." Always black, like the Gate: it is the same card.

   One invite, final: there is no "make another" and no revoke, because the
   database will not hold a second one (access_invites.owner_id is unique).
   Sharing goes through the OS sheet (navigator.share) with a copy fallback;
   the code itself is shown so it can be read out loud. */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './access.css';
import CardArt, { memberNo, tierOf } from './CardArt';
import type { MemberInfo } from './api';
import { formatAccessCode, inviteLink } from './cutover';
import * as sfx from '../audio';

interface Props {
  member: MemberInfo;
  name: string | null;
  /** The once-only founding moment rather than the card opened by hand. */
  intro?: boolean;
  onClose: () => void;
}

const MemberSheet = ({ member, name, intro = false, onClose }: Props) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const inv = member.invite;
  const used = !!inv?.redeemedAt;
  const link = inv ? inviteLink(inv.code) : '';
  const shareText = `Alpha is invite-only. I get one invite. It's yours.`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      sfx.select();
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* the code is on screen to read out */ }
  };

  /* Not async before share(): an await spends the tap that share needs. */
  const share = () => {
    if (typeof navigator.share === 'function') {
      navigator.share({ title: 'Tracker Alpha invite', text: shareText, url: link }).catch(() => { /* closed */ });
    } else {
      void copy();
    }
  };

  const founding = member.source === 'founding';
  const title = intro
    ? (founding ? <>You're a founding member<i>.</i></> : <>You're in<i>.</i></>)
    : <>Member No. {memberNo(member.memberNo)}<i>.</i></>;
  const serif = intro
    ? (founding ? 'You were here before the doors closed.' : 'Now show up every day.')
    : member.invitedBy?.name ? `Invited by ${member.invitedBy.name}.` : founding ? 'Here before the doors closed.' : 'Members only.';

  return createPortal(
    <div className="ax" role="dialog" aria-modal="true" aria-label="Your membership" style={{ zIndex: 330 }}>
      <div className="ax-wrap">
        <div className="ax-top">
          <span>Tracker Alpha</span>
          <button onClick={onClose}>{intro ? 'Later' : 'Close'}</button>
        </div>
        <div className="ax-hero">
          <div className="ax-rise">
            <p className="ax-kicker">{intro ? 'Alpha is invite-only now' : tierOf(member.source)}</p>
            <h1 className="ax-h1" style={{ fontSize: 'clamp(40px, 8vw, 72px)' }}>{title}</h1>
            <p className="ax-serif">{serif}</p>
            {intro && (
              <p className="ax-lead">
                New people need an invite to get in. You're No. {memberNo(member.memberNo)}, and you get one invite. Give it to someone who actually studies.
              </p>
            )}

            {inv && (
              <div style={{ marginTop: 30, maxWidth: 440 }}>
                <span className="ax-label">Your invite</span>
                {used ? (
                  <p className="ax-note" style={{ marginTop: 0, color: '#d4d4d8', fontSize: 15 }}>
                    Used{inv.redeemedBy?.name ? ` by ${inv.redeemedBy.name}` : ''}. You vouched for them.
                  </p>
                ) : (
                  <>
                    <div className="ax-input ax-code" style={{ display: 'flex', alignItems: 'center', userSelect: 'all' }} aria-label="Invite code">
                      {formatAccessCode(inv.code)}
                    </div>
                    <div className="ax-row" style={{ marginTop: 10 }}>
                      <button className="ax-btn ax-btn-red" style={{ flex: 1 }} onClick={share}>Send invite</button>
                      <button className="ax-btn ax-btn-ghost" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
                    </div>
                    <p className="ax-note">One invite. One person. Once it's used, it's gone.</p>
                  </>
                )}
              </div>
            )}

            {intro && (
              <div style={{ marginTop: 22 }}>
                <button className="ax-btn ax-btn-white" onClick={onClose}>Got it</button>
              </div>
            )}
          </div>
          <div className="ax-cardstage ax-rise" style={{ animationDelay: '120ms' }}>
            <CardArt no={member.memberNo} name={name} tier={tierOf(member.source)} />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MemberSheet;
