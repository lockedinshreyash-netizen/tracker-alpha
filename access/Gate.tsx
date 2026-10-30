/* ── The Gate ──
   What a person without access sees instead of the app, once the doors are
   closed (access/cutover.ts). Always black, whatever the theme: it is the
   door to a members-only room.

   Two ways in, both an Access Pass: one gifted by a member (their one invite,
   sent as a link or read out as a code), or one bought (₹2,500 once; payments
   are not live yet, so it opens as a reservation and says so). A device that used
   Alpha before the doors closed gets a third: "I used Alpha before", which
   staff answer from the console. All of them need Google, because access
   belongs to an account. A choice made before signing in is remembered across
   the round trip (sessionStorage), so the person comes back to the panel they
   picked rather than the start.

   A gift link (`/gift/CODE` → `/?invite=CODE`, access/invite.ts) opens on
   "Rahul sent you an Access Pass", read before sign-in, with what Alpha is
   and what the pass gets them underneath (GiftAbout), and is redeemed the
   moment they are signed in. The envelope opens only after the server said
   yes. A signed-out founding member who lands on the door is told, before
   any price, that they never pay for what they use today.

   Copy: short and plain (most readers are 16), blunt like the rest of Alpha,
   and true. No seat counts, no waitlist sizes, no promise of when.

   Hidden in the Play app: the Pass (Google Play's payment rules). */

import { useEffect, useRef, useState } from 'react';
import './access.css';
import CardArt, { memberNo } from './CardArt';
import { GiftEnvelope, GiftReveal } from './GiftPass';
import GiftAbout from './GiftAbout';
import {
  fetchAccess, joinWaitlist, previewAccessInvite, redeemAccessInvite,
  type AccessAnswer, type MemberFace, type PreviewStatus, type RedeemStatus,
} from './api';
import { formatAccessCode, normalizeAccessCode, PASS_PRICE_LABEL } from './cutover';
import { clearAccessInvite, holdAccessInvite } from './invite';
import type { AccessView } from './useAccess';
import * as sfx from '../audio';

type Way = 'invite' | 'pass' | 'back';
const INTENT_KEY = 'alpha_gate_intent_v1';

const readIntent = (): Way | null => {
  try {
    const v = sessionStorage.getItem(INTENT_KEY);
    return v === 'invite' || v === 'pass' || v === 'back' ? v : v === 'waitlist' ? 'pass' : null;
  } catch { return null; }
};
const writeIntent = (w: Way | null) => {
  try { w ? sessionStorage.setItem(INTENT_KEY, w) : sessionStorage.removeItem(INTENT_KEY); } catch { /* fine */ }
};

const CODE_MESSAGE: Partial<Record<PreviewStatus | RedeemStatus, string>> = {
  invalid: "That code doesn't work. Check it and try again.",
  used: 'That pass was already claimed. Each member gifts one.',
  self: "That's your own pass to gift. Send it to a friend.",
  throttled: 'Too many wrong codes. Wait 15 minutes.',
  error: "Couldn't check that. Try again.",
  missing: "Passes aren't open yet.",
};

export interface GateDefaults {
  exam: 'JEE' | 'NEET';
  currentClass: 11 | 12;
}

interface Props {
  view: AccessView;
  signedIn: boolean;
  pendingCode: string | null;
  defaults: GateDefaults;
  playApp: boolean;
  /** The Diwali theme is live: the gift wears the season. */
  diwali: boolean;
  /** The earliest day this device shows Alpha in use (device.ts), or null. */
  deviceSince: string | null;
  onSignIn: () => Promise<string | null>;
  onSignOut: () => void;
  onSettle: (a: AccessAnswer) => void;
  onRetry: () => void;
}

const GoogleG = () => (
  <svg className="ax-g" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z" />
  </svg>
);

const Gate = ({ view, signedIn, pendingCode, defaults, playApp, diwali, deviceSince, onSignIn, onSignOut, onSettle, onRetry }: Props) => {
  const [open, setOpen] = useState<Way | null>(() => readIntent() ?? (pendingCode ? 'invite' : null));
  const [code, setCode] = useState(pendingCode ? formatAccessCode(pendingCode) : '');
  const [codeNote, setCodeNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signInNote, setSignInNote] = useState<string | null>(null);

  // A gift link: who sent it, read before sign-in.
  const [inviter, setInviter] = useState<MemberFace | null>(null);
  const [previewed, setPreviewed] = useState(false);
  useEffect(() => {
    if (!pendingCode) { setPreviewed(true); return; }
    let live = true;
    previewAccessInvite(pendingCode).then(r => {
      if (!live) return;
      if (r.status === 'ok' && r.inviter) setInviter(r.inviter);
      else if (r.status !== 'member' && r.status !== 'error') {
        setCodeNote(CODE_MESSAGE[r.status] ?? null);
        if (r.status === 'used' || r.status === 'invalid' || r.status === 'self') clearAccessInvite();
      }
      setPreviewed(true);
    });
    return () => { live = false; };
  }, [pendingCode]);

  // You're in: the envelope opens, then the app.
  const [welcome, setWelcome] = useState<{ answer: AccessAnswer; inviter: MemberFace | null } | null>(null);
  const [revealed, setRevealed] = useState(false);

  const redeem = async (raw: string) => {
    const c = normalizeAccessCode(raw);
    if (c.length !== 12) { setCodeNote('A pass code has 12 letters and numbers.'); return; }
    setBusy(true);
    setCodeNote(null);
    const r = await redeemAccessInvite(c);
    if (r.status === 'joined' || r.status === 'member') {
      clearAccessInvite();
      writeIntent(null);
      const answer = await fetchAccess();
      setWelcome({ answer, inviter: r.inviter ?? inviter });
    } else {
      setCodeNote(CODE_MESSAGE[r.status] ?? CODE_MESSAGE.error!);
      if (r.status === 'used' || r.status === 'self') clearAccessInvite();
    }
    setBusy(false);
  };

  // Signed in with a pass waiting: open it at once.
  const autoRedeemed = useRef(false);
  useEffect(() => {
    if (!signedIn || !pendingCode || autoRedeemed.current || view.kind !== 'none') return;
    autoRedeemed.current = true;
    void redeem(pendingCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, pendingCode, view.kind]);

  const signIn = async (intent: Way | null, holdCode?: string) => {
    writeIntent(intent);
    if (holdCode) holdAccessInvite(holdCode);
    setBusy(true);
    const err = await onSignIn();
    // Resolves only if Google could not be reached.
    if (err) { setSignInNote(err); setBusy(false); }
  };

  // ── Reserving a Pass, or asking back in ──
  const [exam, setExam] = useState<'JEE' | 'NEET'>(defaults.exam);
  const [klass, setKlass] = useState<11 | 12 | 13>(defaults.currentClass);
  const [applyNote, setApplyNote] = useState<string | null>(null);

  const apply = async (kind: 'pass' | 'back') => {
    setBusy(true);
    setApplyNote(null);
    const r = await joinWaitlist({
      exam, class: klass,
      wants_pass: kind === 'pass',
      device_since: kind === 'back' ? deviceSince : null,
    });
    setBusy(false);
    if (r.status === 'waitlist' || r.status === 'member') {
      writeIntent(null);
      onSettle(r);
    } else {
      setApplyNote(r.status === 'missing' ? "That isn't open yet." : "Couldn't save that. Try again.");
    }
  };

  const toggle = (w: Way) => setOpen(o => (o === w ? null : w));

  if (view.kind === 'checking' || (pendingCode && !previewed && !signedIn)) {
    return <div className="ax" aria-busy="true" />;
  }

  // ── You're in: the gift opens ──
  if (welcome) {
    const m = welcome.answer.status === 'member' ? welcome.answer.member : null;
    const from = welcome.inviter?.name?.trim() || null;
    return (
      <div className="ax">
        <div className="ax-wrap">
          <div className="ax-top"><span>Tracker Alpha</span></div>
          <div className="ax-hero">
            <div className="ax-giftstage">
              <GiftReveal
                from={from}
                fromNo={welcome.inviter?.member_no ?? null}
                diwali={diwali}
                onDone={() => { setRevealed(true); sfx.play('target-hit'); }}
              />
            </div>
            <div className="ax-rise" style={{ visibility: revealed ? 'visible' : 'hidden' }}>
              <p className="ax-kicker">{diwali ? 'Happy Diwali' : 'Welcome in'}</p>
              <h1 className="ax-h1">You're in<i>.</i></h1>
              <p className="ax-serif">{from ? `${from}'s gift: an Access Pass, for life.` : 'Your Access Pass, for life.'}</p>
              <p className="ax-lead">
                You're member No. {memberNo(m?.memberNo)}. Nothing to pay, ever, for what's in Alpha today. You get one pass to gift too. Give it to someone who actually studies.
              </p>
              <div style={{ marginTop: 32 }}>
                <button className="ax-btn ax-btn-red" onClick={() => onSettle(welcome.answer)}>Enter Alpha</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const top = (
    <div className="ax-top">
      <span>Tracker Alpha</span>
      {signedIn
        ? <button onClick={onSignOut}>Use another account</button>
        : <button onClick={() => signIn(null)} disabled={busy}>Member? Sign in</button>}
    </div>
  );

  // ── Couldn't ask ──
  if (view.kind === 'unknown') {
    return (
      <div className="ax">
        <div className="ax-wrap">
          {top}
          <div className="ax-hero">
            <div className="ax-rise">
              <p className="ax-kicker">Members only</p>
              <h1 className="ax-h1" style={{ fontSize: 'clamp(38px, 7vw, 64px)' }}>Couldn't check your access<i>.</i></h1>
              <p className="ax-lead">Check your connection and try again.</p>
              <div style={{ marginTop: 28 }}>
                <button className="ax-btn ax-btn-white" onClick={onRetry}>Try again</button>
              </div>
            </div>
            <div className="ax-cardstage ax-rise" style={{ animationDelay: '120ms' }}>
              <CardArt no={null} name={null} tier="Members only" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting: a Pass reserved, or asked back in ──
  if (view.kind === 'waitlist') {
    return (
      <div className="ax">
        <div className="ax-wrap">
          {top}
          <div className="ax-hero">
            <div className="ax-rise">
              <p className="ax-kicker">{view.wantsPass ? 'Pass reserved' : "You're on the list"}</p>
              <p className="ax-place"><small>No.</small>{view.position.toLocaleString('en-IN')}</p>
              <p className="ax-serif">in line.</p>
              <p className="ax-lead">
                {view.wantsPass
                  ? 'Passes open soon. You hear first. When you\'re in, this page opens the app.'
                  : 'We let people back in by hand. Come back and check. When you\'re in, this page opens the app.'}
              </p>
              <div className="ax-ways">
                <WayRow n="01" t="Got a pass code?" s="A pass from a member gets you in right now." on={open === 'invite'} onClick={() => toggle('invite')} />
                {open === 'invite' && (
                  <InvitePanel code={code} setCode={setCode} note={codeNote} busy={busy} signedIn onSubmit={() => redeem(code)} />
                )}
              </div>
            </div>
            <div className="ax-cardstage ax-rise" style={{ animationDelay: '120ms' }}>
              <CardArt no={null} name={null} tier={view.wantsPass ? 'Pass reserved' : 'Waiting'} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── The door ──
  const invited = !!inviter && !codeNote;
  const from = inviter?.name?.trim() || 'A member';
  const fields = (
    <>
      <div className="ax-field">
        <span className="ax-label">Exam</span>
        <div className="ax-seg">
          {(['JEE', 'NEET'] as const).map(e => (
            <button key={e} aria-pressed={exam === e} onClick={() => setExam(e)}>{e}</button>
          ))}
        </div>
      </div>
      <div className="ax-field">
        <span className="ax-label">Class</span>
        <div className="ax-seg">
          {([[11, 'Class 11'], [12, 'Class 12'], [13, 'Dropper']] as const).map(([v, l]) => (
            <button key={v} aria-pressed={klass === v} onClick={() => setKlass(v)}>{l}</button>
          ))}
        </div>
      </div>
    </>
  );
  const google = (intent: Way, label = 'Continue with Google') => (
    <div style={{ marginTop: 16 }}>
      <button className="ax-btn ax-btn-white ax-btn-wide" disabled={busy} onClick={() => signIn(intent)}>
        <GoogleG /> {label}
      </button>
      {signInNote && <p className="ax-note bad">{signInNote}</p>}
    </div>
  );

  return (
    <div className="ax">
      <div className="ax-wrap">
        {top}
        <div className={`ax-hero${invited ? ' ax-hero-gift' : ''}`}>
          <div className="ax-rise">
            {invited ? (
              <>
                <p className="ax-kicker">{diwali ? 'A Diwali gift for you' : 'A gift for you'}</p>
                <h1 className="ax-h1" style={{ fontSize: 'clamp(40px, 7vw, 68px)' }}>{from} sent you an Access Pass<i>.</i></h1>
                <p className="ax-serif">Lifetime access to Alpha, worth {PASS_PRICE_LABEL}. On them.</p>
                <p className="ax-lead">
                  {from === 'A member' ? 'They are' : `${from} is`} {inviter!.founding ? 'a founding member' : 'a member'} (No. {memberNo(inviter!.member_no)}). Every member can gift just one pass. They picked you.
                </p>
                <div style={{ marginTop: 32, maxWidth: 380 }}>
                  {signedIn ? (
                    <button className="ax-btn ax-btn-red ax-btn-wide" disabled={busy} onClick={() => redeem(pendingCode!)}>
                      {busy ? 'Opening…' : 'Open your pass'}
                    </button>
                  ) : (
                    <button className="ax-btn ax-btn-white ax-btn-wide" disabled={busy} onClick={() => signIn('invite', pendingCode!)}>
                      <GoogleG /> Open with Google
                    </button>
                  )}
                  {codeNote && <p className="ax-note bad">{codeNote}</p>}
                  {signInNote && <p className="ax-note bad">{signInNote}</p>}
                  <p className="ax-note">Free for you. No card. It takes a minute.</p>
                </div>
              </>
            ) : (
              <>
                <p className="ax-kicker">By invitation</p>
                <h1 className="ax-h1">Invite only<i>.</i></h1>
                <p className="ax-serif">
                  {diwali
                    ? `This Diwali, every member can gift one friend an Access Pass, worth ${PASS_PRICE_LABEL}.`
                    : `Every member can gift one friend an Access Pass, worth ${PASS_PRICE_LABEL}.`}
                </p>
                <p className="ax-lead">
                  {playApp ? 'To get in, a member gifts you a pass.' : 'To get in, a member gifts you a pass, or you buy one.'}
                </p>
                {!signedIn && (
                  <div className="ax-callout">
                    <b>Already use Alpha?</b>
                    <span>You're a founding member. Sign in with the same Google account. You never pay for what you use today.</span>
                    <button className="ax-btn ax-btn-white" disabled={busy} onClick={() => signIn(null)}><GoogleG /> Sign in</button>
                  </div>
                )}
                <div className="ax-ways">
                  <WayRow n="01" t="I was gifted a pass" s="Enter the code from your friend's link." on={open === 'invite'} onClick={() => toggle('invite')} />
                  {open === 'invite' && (
                    <InvitePanel
                      code={code} setCode={setCode} note={codeNote ?? signInNote} busy={busy} signedIn={signedIn}
                      onSubmit={() => (signedIn ? redeem(code) : (normalizeAccessCode(code).length === 12
                        ? signIn('invite', normalizeAccessCode(code))
                        : setCodeNote('A pass code has 12 letters and numbers.')))}
                    />
                  )}
                  {!playApp && (
                    <>
                      <WayRow n="02" t="Buy an Access Pass" s={`${PASS_PRICE_LABEL} once. Yours for life, plus one to gift.`} tag="Opens soon" on={open === 'pass'} onClick={() => toggle('pass')} />
                      {open === 'pass' && (
                        <div className="ax-panelbox">
                          <p className="ax-note" style={{ marginTop: 0, color: '#d4d4d8' }}>
                            Passes open soon. Reserve yours and you'll hear first.
                          </p>
                          {signedIn ? (
                            <>
                              <div style={{ marginTop: 22 }}>{fields}</div>
                              <div className="ax-field">
                                <button className="ax-btn ax-btn-red ax-btn-wide" disabled={busy} onClick={() => apply('pass')}>
                                  {busy ? 'Saving…' : 'Reserve my Pass'}
                                </button>
                                {applyNote && <p className="ax-note bad">{applyNote}</p>}
                              </div>
                            </>
                          ) : google('pass')}
                        </div>
                      )}
                    </>
                  )}
                  {deviceSince && (
                    <>
                      <WayRow n={playApp ? '02' : '03'} t="I used Alpha before" s="Before it went invite-only. Tell us and we'll let you back in." on={open === 'back'} onClick={() => toggle('back')} />
                      {open === 'back' && (
                        <div className="ax-panelbox">
                          {signedIn ? (
                            <>
                              {fields}
                              <div className="ax-field">
                                <button className="ax-btn ax-btn-red ax-btn-wide" disabled={busy} onClick={() => apply('back')}>
                                  {busy ? 'Saving…' : 'Let me back in'}
                                </button>
                                {applyNote && <p className="ax-note bad">{applyNote}</p>}
                              </div>
                              <p className="ax-note">Your history is safe on this device. It syncs the moment you're in.</p>
                            </>
                          ) : (
                            <>
                              <p className="ax-note" style={{ marginTop: 0 }}>Had an account? Sign in with it and you're straight in. If not, sign in and ask.</p>
                              {google('back')}
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                {signedIn && (
                  <p className="ax-fine">
                    Already a member on another account? Use another account and sign in with that one. Founding members never pay for what they use today.
                  </p>
                )}
              </>
            )}
          </div>
          <div className="ax-cardstage ax-rise" style={{ animationDelay: '120ms' }}>
            {invited
              ? <GiftEnvelope from={inviter?.name?.trim() || null} diwali={diwali} id="ax-gate-env" />
              : <CardArt no={null} name={null} tier="Members only" />}
          </div>
        </div>
        {invited && (
          <>
            <GiftAbout exam={defaults.exam} />
            <div className="ax-about-cta">
              {signedIn ? (
                <button className="ax-btn ax-btn-red ax-btn-wide" disabled={busy} onClick={() => redeem(pendingCode!)}>
                  {busy ? 'Opening…' : 'Open your pass'}
                </button>
              ) : (
                <button className="ax-btn ax-btn-white ax-btn-wide" disabled={busy} onClick={() => signIn('invite', pendingCode!)}>
                  <GoogleG /> Open with Google
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

interface WayProps { n: string; t: string; s: string; tag?: string; on: boolean; onClick: () => void }
const WayRow = ({ n, t, s, tag, on, onClick }: WayProps) => (
  <button className="ax-way" aria-expanded={on} onClick={onClick}>
    <span className="ax-way-n">{n}</span>
    <span>
      <span className="ax-way-t">{t}</span>
      <span className="ax-way-s" style={{ display: 'block' }}>{s}</span>
    </span>
    {tag ? <span className="ax-way-tag">{tag}</span> : <span aria-hidden="true" style={{ color: '#4a4a52' }}>{on ? '−' : '+'}</span>}
  </button>
);

interface InvitePanelProps {
  code: string;
  setCode: (v: string) => void;
  note: string | null;
  busy: boolean;
  signedIn: boolean;
  onSubmit: () => void;
}
const InvitePanel = ({ code, setCode, note, busy, signedIn, onSubmit }: InvitePanelProps) => (
  <div className="ax-panelbox">
    <form className="ax-row" onSubmit={e => { e.preventDefault(); onSubmit(); }}>
      <input
        className="ax-input ax-code"
        value={code}
        onChange={e => setCode(formatAccessCode(e.target.value).slice(0, 14))}
        placeholder="XXXX-XXXX-XXXX"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        aria-label="Pass code"
      />
      <button className={`ax-btn ${signedIn ? 'ax-btn-red' : 'ax-btn-white'}`} disabled={busy} type="submit">
        {signedIn ? (busy ? '…' : 'Open') : <><GoogleG /> Go</>}
      </button>
    </form>
    {!signedIn && <p className="ax-note">You'll sign in with Google, then your pass opens.</p>}
    {note && <p className="ax-note bad">{note}</p>}
  </div>
);

export default Gate;
