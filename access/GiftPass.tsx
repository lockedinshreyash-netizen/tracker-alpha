/* ── The gifted pass ──
   What a member's one invite is: an Access Pass, the same lifetime access the
   ₹2,500 Pass buys, gifted to one friend. It is a pass, not a voucher: it
   does not stand for money off something, it IS the way in. Drawn as an
   object worth keeping, bone paper with a stub, a guilloché ground and the
   wax seal, so sending it feels like giving something and receiving it feels
   like being picked.

   Two forms: the pass itself (the giver's sheet, the welcome), and the sealed
   envelope it arrives in (the gift page). `GiftReveal` opens one into the
   other, and is only ever played after the server has said yes.

   `diwali` adds the season's dressing: a marigold string along the top, a lit
   diya on the stub, "A Diwali gift". The pass itself is the same all year. */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import './access.css';
import Seal from './Seal';
import { memberNo } from './CardArt';
import { formatAccessCode, PASS_PRICE_LABEL } from './cutover';
import * as sfx from '../audio';

const Diya = () => (
  <svg className="ax-diya" viewBox="0 0 44 40" aria-hidden="true">
    <defs>
      <radialGradient id="ax-diya-glow" cx="50%" cy="45%" r="50%">
        <stop offset="0" stopColor="#FFD8A0" stopOpacity="0.9" />
        <stop offset="1" stopColor="#FFB347" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="ax-diya-bowl" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#D47A33" />
        <stop offset="0.6" stopColor="#A9521C" />
        <stop offset="1" stopColor="#6E2E0C" />
      </linearGradient>
    </defs>
    <circle className="ax-diya-halo" cx="22" cy="12" r="12" fill="url(#ax-diya-glow)" />
    <path className="ax-diya-flame" d="M22 3 C25 8 26 11 22 15 C18 11 19 8 22 3 Z" fill="#FFB020" />
    <path d="M22 7 C23.4 9.5 23.6 11.2 22 13.4 C20.4 11.2 20.6 9.5 22 7 Z" fill="#FFF3C4" />
    <path d="M4 20 C4 30 12 36 22 36 C32 36 40 30 40 20 C31 22.5 13 22.5 4 20 Z" fill="url(#ax-diya-bowl)" />
    <ellipse cx="22" cy="20" rx="18" ry="2.6" fill="#2E1405" />
  </svg>
);

interface PassProps {
  /** Who gives it. Null when not known (the code typed by hand). */
  from?: string | null;
  fromNo?: number | null;
  /** Shown on the pass, set like a pass number. Omitted on the invitee's side. */
  code?: string | null;
  /** Claimed: the pass is stamped and the code is gone. */
  claimedBy?: string | null;
  diwali?: boolean;
  /** Unique per pass on a page: the seal's gradient id. */
  id: string;
}

export const GiftPass = ({ from, fromNo, code, claimedBy, diwali = false, id }: PassProps) => {
  const claimed = claimedBy !== undefined && claimedBy !== null;
  return (
    <div
      className={`ax-gift${diwali ? ' diwali' : ''}${claimed ? ' claimed' : ''}`}
      role="img"
      aria-label={`Tracker Alpha Access Pass, lifetime access, worth ${PASS_PRICE_LABEL}${from ? `, gifted by ${from}` : ''}`}
    >
      <div className="ax-gift-main">
        <div className="ax-gift-head">
          <span>Tracker Alpha</span>
          <span>Worth {PASS_PRICE_LABEL}</span>
        </div>
        <div className="ax-gift-value">
          <span className="ax-gift-worth">{diwali ? 'A Diwali gift' : 'A gift'}</span>
          <span className="ax-gift-title">Access Pass</span>
          <span className="ax-gift-life">For life · Admits one</span>
        </div>
        <div className="ax-gift-foot">
          <div className="ax-gift-from">
            <span>Gifted by</span>
            <b>{from?.trim() || 'A member'}{typeof fromNo === 'number' && <span className="ax-gift-no"> · No. {memberNo(fromNo)}</span>}</b>
          </div>
          {code && !claimed && <div className="ax-gift-code">{formatAccessCode(code)}</div>}
        </div>
      </div>
      <div className="ax-gift-stub" aria-hidden="true">
        {diwali ? <Diya /> : <span className="ax-gift-alpha">α</span>}
        <span className="ax-gift-admit">Admit one</span>
      </div>
      <Seal className="ax-gift-seal" size={58} gid={`${id}-wax`} />
      {claimed && (
        <span className="ax-gift-stamp">Claimed{claimedBy ? ` by ${claimedBy}` : ''}</span>
      )}
    </div>
  );
};

/** The sealed envelope a gift arrives in. `children` sit inside it, between
    its back and its front, which is how the pass can rise out of it. */
export const GiftEnvelope = ({ from, diwali = false, id, children }: {
  from?: string | null;
  diwali?: boolean;
  id: string;
  children?: ReactNode;
}) => (
  <div className={`ax-env${diwali ? ' diwali' : ''}`} role="img" aria-label={`A sealed Access Pass${from ? ` from ${from}` : ''}, worth ${PASS_PRICE_LABEL}`}>
    <div className="ax-env-back" />
    {children && <div className="ax-env-inner">{children}</div>}
    <div className="ax-env-front">
      <span className="ax-env-for">For you</span>
      <span className="ax-env-worth">An Access Pass · Worth {PASS_PRICE_LABEL}</span>
      {from && <span className="ax-env-from">from {from}</span>}
    </div>
    <div className="ax-env-flap" />
    <Seal className="ax-env-seal" size={64} gid={`${id}-wax`} />
  </div>
);

const reduced = () => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
};

/* The opening, about 2.4s: the seal lifts, the flap opens, the pass rises
   out, the envelope falls away. Played once, after the redeem succeeded, never
   as a promise of one. Reduced motion lands on the pass at once. */
export const GiftReveal = ({ from, fromNo, diwali = false, onDone }: {
  from?: string | null;
  fromNo?: number | null;
  diwali?: boolean;
  onDone: () => void;
}) => {
  const [phase, setPhase] = useState<'sealed' | 'opening' | 'rising' | 'open'>(() => (reduced() ? 'open' : 'sealed'));
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (phase === 'open') { done.current(); return; }
    sfx.preload(['pack-tear', 'pack-reveal']);
    const ts = [
      window.setTimeout(() => { setPhase('opening'); sfx.play('pack-tear', { late: 400 }); }, 350),
      window.setTimeout(() => { setPhase('rising'); sfx.play('pack-reveal', { late: 400 }); }, 1050),
      window.setTimeout(() => setPhase('open'), 2300),
    ];
    return () => ts.forEach(t => window.clearTimeout(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase === 'open']);

  return (
    <div className={`ax-reveal is-${phase}`}>
      <GiftEnvelope from={from} diwali={diwali} id="ax-reveal-env">
        <GiftPass from={from} fromNo={fromNo} diwali={diwali} id="ax-reveal" />
      </GiftEnvelope>
    </div>
  );
};
