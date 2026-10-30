/* ── Your membership, and your pass to gift ──
   The card, who vouched for you, and your one Access Pass to gift (the same
   lifetime access the ₹2,500 Pass buys) to one friend. Opened from quick
   settings and the Profile tab, and once on its own after the doors close
   (`intro`), as the founding-member moment. Always black, like the Gate.

   Founding members are told, loud and before anything else in that moment,
   that they never pay: everything they use today stays free for them for
   life, and Alpha Pro, if it comes, is optional. The doors closing must not
   read as a bill arriving.

   One gift, final: there is no "make another" and no revoke, because the
   database will not hold a second one (access_invites.owner_id is unique).
   Sending is phone first: WhatsApp straight away (wa.me), any other app
   through the OS sheet, or the link copied. The code is on the voucher so it
   can be read out loud. */

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './access.css';
import CardArt, { memberNo, tierOf } from './CardArt';
import { GiftPass } from './GiftPass';
import type { MemberInfo } from './api';
import { inviteLink, PASS_PRICE_LABEL } from './cutover';
import { giftMessage, whatsappLink } from './gift';
import * as sfx from '../audio';

/* What a founding member keeps. Every line must stay true: change it only
   when the promise itself changes (and public/terms says the same). */
const FoundingPromise = () => (
  <div className="ax-promise">
    <span className="ax-promise-k">Founding member promise</span>
    <p className="ax-promise-t">You never pay for this.</p>
    <ul>
      <li><span><b>Everything you use today stays free.</b> For life.</span></li>
      <li><span>No card. No trial. Nothing to cancel.</span></li>
      <li><span><b>Alpha Pro may come later.</b> It's optional. Skip it and nothing you have changes.</span></li>
    </ul>
  </div>
);

const WhatsAppMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.8-1.2.2-.6.2-1.1.1-1.2l-.4-.3Z" />
  </svg>
);

interface Props {
  member: MemberInfo;
  name: string | null;
  /** The once-only founding moment rather than the card opened by hand. */
  intro?: boolean;
  /** The Diwali theme is live: the gift wears the season. */
  diwali?: boolean;
  /** Their stream, so the gift is for "a JEE friend" or "a NEET friend". */
  exam?: 'JEE' | 'NEET';
  onClose: () => void;
}

const MemberSheet = ({ member, name, intro = false, diwali = false, exam = 'JEE', onClose }: Props) => {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const inv = member.invite;
  const used = !!inv?.redeemedAt;
  const link = inv ? inviteLink(inv.code) : '';
  const message = giftMessage(diwali);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${message}\n\n${link}`);
      setCopied(true);
      sfx.select();
      window.setTimeout(() => setCopied(false), 1800);
    } catch { /* the code is on the pass to read out */ }
  };

  /* Not async before share(): an await spends the tap that share needs. */
  const share = () => {
    if (canShare) {
      navigator.share({ title: `An Alpha Access Pass for you, worth ${PASS_PRICE_LABEL}`, text: message, url: link }).catch(() => { /* closed */ });
    } else {
      void copy();
    }
  };

  const founding = member.source === 'founding';
  const giver = name?.trim() || null;
  const giftTitle = used
    ? <>You gifted a pass<i>.</i></>
    : diwali
      ? <>This Diwali, gift one {exam} friend an Access Pass<i>.</i></>
      : <>Gift one {exam} friend an Access Pass<i>.</i></>;
  /* The founding moment leads with the promise; the gift comes second. */
  const promiseFirst = intro && founding;
  const kicker = intro
    ? (founding ? `Founding member No. ${memberNo(member.memberNo)}` : "You're in")
    : `Member No. ${memberNo(member.memberNo)} · ${tierOf(member.source)}`;

  const gift = inv && (
    <>
      {promiseFirst && <p className="ax-kicker" style={{ marginTop: 44 }}>Your pass to gift</p>}
      {promiseFirst
        ? <h2 className="ax-h2">{giftTitle}</h2>
        : <h1 className="ax-h1" style={{ fontSize: 'clamp(38px, 7vw, 64px)' }}>{giftTitle}</h1>}
      {!used ? (
        <>
          <p className="ax-serif">Lifetime access, worth {PASS_PRICE_LABEL}. On you.</p>
          <p className="ax-lead">
            An Access Pass costs {PASS_PRICE_LABEL}. You can gift one to a friend, and it costs you nothing. It works once.
          </p>
          <div className="ax-send" style={{ maxWidth: 440 }}>
            <a className="ax-btn ax-btn-wa ax-btn-wide" href={whatsappLink(message, link)} target="_blank" rel="noopener noreferrer" onClick={() => sfx.select()}>
              <WhatsAppMark /> Send on WhatsApp
            </a>
            <div className="ax-send-row">
              {canShare && <button className="ax-btn ax-btn-ghost" onClick={share}>Other apps</button>}
              <button className="ax-btn ax-btn-ghost" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
            </div>
            <p className="ax-note">One pass. One friend. Pick someone who'll actually show up.</p>
          </div>
        </>
      ) : (
        <p className="ax-serif">
          {inv.redeemedBy?.name ? `${inv.redeemedBy.name} claimed it.` : 'Your friend claimed it.'} That's Alpha for life, from you.
        </p>
      )}
    </>
  );

  return createPortal(
    <div className="ax" role="dialog" aria-modal="true" aria-label="Your membership" style={{ zIndex: 330 }}>
      <div className="ax-wrap">
        <div className="ax-top">
          <span>Tracker Alpha</span>
          <button onClick={onClose}>{intro ? 'Later' : 'Close'}</button>
        </div>
        <div className="ax-hero ax-hero-gift">
          <div className="ax-rise">
            <p className="ax-kicker">{kicker}</p>
            {promiseFirst && (
              <>
                <h1 className="ax-h1" style={{ fontSize: 'clamp(38px, 7vw, 64px)' }}>You're a founding member<i>.</i></h1>
                <p className="ax-serif">Alpha is invite-only now. You were here first, so you're in for good.</p>
                <FoundingPromise />
              </>
            )}
            {gift}
            {!inv && (
              <>
                {!promiseFirst && <h1 className="ax-h1" style={{ fontSize: 'clamp(38px, 7vw, 64px)' }}>Member No. {memberNo(member.memberNo)}<i>.</i></h1>}
                <p className="ax-serif">
                  {member.invitedBy?.name ? `Invited by ${member.invitedBy.name}.` : founding ? 'Here before the doors closed.' : 'Members only.'}
                </p>
              </>
            )}
            {founding && !promiseFirst && <FoundingPromise />}

            {intro && (
              <div style={{ marginTop: 28 }}>
                <button className="ax-btn ax-btn-white" onClick={onClose}>Got it</button>
              </div>
            )}
          </div>
          <div className="ax-giftstage ax-rise" style={{ animationDelay: '120ms' }}>
            {inv
              ? <GiftPass id="ax-sheet" from={giver} fromNo={member.memberNo} code={inv.code} claimedBy={used ? (inv.redeemedBy?.name ?? '') : null} diwali={diwali} />
              : <CardArt no={member.memberNo} name={name} tier={tierOf(member.source)} />}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MemberSheet;
