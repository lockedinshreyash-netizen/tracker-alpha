/* ── The Gate ──
   What a person without access sees instead of the app, from the cutover on
   (access/cutover.ts). Always black, whatever the theme: it is the door to a
   members-only room.

   Three ways in, in this order: an invite (a member gave you a code), the
   Priority Pass (₹2,500 once; payments not live yet, so it says so and
   points at the line), and the waitlist (apply, get a place). All three need
   Google, because access belongs to an account. A choice made before signing
   in is remembered across the round trip (sessionStorage), so the person
   comes back to the panel they picked rather than the start.

   An invite link (`/?invite=CODE`, access/invite.ts) opens on "Rahul invited
   you", read before sign-in, and is redeemed the moment they are signed in.

   Copy: short and plain (most readers are 16), blunt like the rest of Alpha,
   and true. No seat counts, no waitlist sizes, no promise of when.

   Hidden in the Play app: the Pass (Google Play's payment rules). */

import { useEffect, useRef, useState } from 'react';
import './access.css';
import CardArt, { memberNo, tierOf } from './CardArt';
import {
  fetchAccess, joinWaitlist, previewAccessInvite, redeemAccessInvite,
  type AccessAnswer, type MemberFace, type PreviewStatus, type RedeemStatus,
} from './api';
import { formatAccessCode, normalizeAccessCode, PASS_PRICE_LABEL } from './cutover';
import { clearAccessInvite, holdAccessInvite } from './invite';
import type { AccessView } from './useAccess';
import * as sfx from '../audio';

type Way = 'invite' | 'pass' | 'waitlist';
const INTENT_KEY = 'alpha_gate_intent_v1';

const readIntent = (): Way | null => {
  try {
    const v = sessionStorage.getItem(INTENT_KEY);
    return v === 'invite' || v === 'pass' || v === 'waitlist' ? v : null;
  } catch { return null; }
};
const writeIntent = (w: Way | null) => {
  try { w ? sessionStorage.setItem(INTENT_KEY, w) : sessionStorage.removeItem(INTENT_KEY); } catch { /* fine */ }
};

const CODE_MESSAGE: Partial<Record<PreviewStatus | RedeemStatus, string>> = {
  invalid: "That code doesn't work. Check it and try again.",
  used: 'That invite was already used. Each member gets one.',
  self: "That's your own invite. Send it to someone.",
  throttled: 'Too many wrong codes. Wait 15 minutes.',
  error: "Couldn't check that. Try again.",
  missing: "Invites aren't open yet.",
};

export interface GateDefaults {
  exam: 'JEE' | 'NEET';
  currentClass: 11 | 12;
  hours: number;
}

interface Props {
  view: AccessView;
  signedIn: boolean;
  pendingCode: string | null;
  defaults: GateDefaults;
  playApp: boolean;
  onSignIn: () => Promise<string | null>;
  onSignOut: () => void;
  onSettle: (a: AccessAnswer) => void;
}

const GoogleG = () => (
  <svg className="ax-g" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z" />
  </svg>
);

const Gate = ({ view, signedIn, pendingCode, defaults, playApp, onSignIn, onSignOut, onSettle }: Props) => {
  const [open, setOpen] = useState<Way | null>(() => readIntent() ?? (pendingCode ? 'invite' : null));
  const [code, setCode] = useState(pendingCode ? formatAccessCode(pendingCode) : '');
  const [codeNote, setCodeNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signInNote, setSignInNote] = useState<string | null>(null);

  // An invite link: who sent it, read before sign-in.
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

  // You're in: the card, then the app.
  const [welcome, setWelcome] = useState<{ answer: AccessAnswer; inviter: MemberFace | null } | null>(null);

  const redeem = async (raw: string) => {
    const c = normalizeAccessCode(raw);
    if (c.length !== 12) { setCodeNote('An invite code has 12 letters and numbers.'); return; }
    setBusy(true);
    setCodeNote(null);
    const r = await redeemAccessInvite(c);
    if (r.status === 'joined' || r.status === 'member') {
      clearAccessInvite();
      writeIntent(null);
      const answer = await fetchAccess();
      sfx.play('target-hit');
      setWelcome({ answer, inviter: r.inviter ?? inviter });
    } else {
      setCodeNote(CODE_MESSAGE[r.status] ?? CODE_MESSAGE.error!);
      if (r.status === 'used' || r.status === 'self') clearAccessInvite();
    }
    setBusy(false);
  };

  // Signed in with an invite waiting: redeem it at once.
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

  // ── Waitlist application ──
  const [exam, setExam] = useState<'JEE' | 'NEET'>(defaults.exam);
  const [klass, setKlass] = useState<11 | 12 | 13>(defaults.currentClass);
  const [hours, setHours] = useState(Math.min(16, Math.max(2, Math.round(defaults.hours || 8))));
  const [why, setWhy] = useState('');
  const [wantsPass, setWantsPass] = useState(false);
  const [applyNote, setApplyNote] = useState<string | null>(null);

  const apply = async () => {
    setBusy(true);
    setApplyNote(null);
    const r = await joinWaitlist({ exam, class: klass, goal_hours: hours, why: why.trim(), wants_pass: wantsPass });
    setBusy(false);
    if (r.status === 'waitlist' || r.status === 'member') {
      writeIntent(null);
      onSettle(r);
    } else {
      setApplyNote(r.status === 'missing' ? "The waitlist isn't open yet." : "Couldn't save that. Try again.");
    }
  };

  const toggle = (w: Way) => setOpen(o => (o === w ? null : w));

  if (view.kind === 'checking' || (pendingCode && !previewed && !signedIn)) {
    return <div className="ax" aria-busy="true" />;
  }

  // ── You're in ──
  if (welcome) {
    const m = welcome.answer.status === 'member' ? welcome.answer.member : null;
    return (
      <div className="ax">
        <div className="ax-wrap">
          <div className="ax-top"><span>Tracker Alpha</span></div>
          <div className="ax-hero">
            <div className="ax-rise">
              <p className="ax-kicker">Welcome in</p>
              <h1 className="ax-h1">You're in<i>.</i></h1>
              <p className="ax-serif">
                {welcome.inviter?.name ? `${welcome.inviter.name} vouched for you.` : 'Now show up every day.'}
              </p>
              <p className="ax-lead">
                You're member No. {memberNo(m?.memberNo)}. You get one invite too. Use it on someone who actually studies.
              </p>
              <div style={{ marginTop: 32 }}>
                <button className="ax-btn ax-btn-red" onClick={() => onSettle(welcome.answer)}>Enter Alpha</button>
              </div>
            </div>
            <div className="ax-cardstage ax-rise" style={{ animationDelay: '120ms' }}>
              <CardArt no={m?.memberNo} name={null} tier={tierOf(m?.source)} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── On the waitlist ──
  if (view.kind === 'waitlist') {
    return (
      <div className="ax">
        <div className="ax-wrap">
          <div className="ax-top">
            <span>Tracker Alpha</span>
            <button onClick={onSignOut}>Use another account</button>
          </div>
          <div className="ax-hero">
            <div className="ax-rise">
              <p className="ax-kicker">You're on the list</p>
              <p className="ax-place"><small>No.</small>{view.position.toLocaleString('en-IN')}</p>
              <p className="ax-serif">in line.</p>
              <p className="ax-lead">
                We let people in in waves. Come back and check. When you're in, this page opens the app.
              </p>
              <div className="ax-ways">
                <Way n="01" t="Got an invite?" s="A member's code gets you in right now." on={open === 'invite'} onClick={() => toggle('invite')} />
                {open === 'invite' && (
                  <InvitePanel code={code} setCode={setCode} note={codeNote} busy={busy} signedIn onSubmit={() => redeem(code)} />
                )}
                {!playApp && (
                  <>
                    <Way n="02" t="Priority Pass" s={`${PASS_PRICE_LABEL} once. Skip the line. Yours for life.`} tag="Opens soon" on={open === 'pass'} onClick={() => toggle('pass')} />
                    {open === 'pass' && <PassPanel wantsPass={view.wantsPass} />}
                  </>
                )}
              </div>
            </div>
            <div className="ax-cardstage ax-rise" style={{ animationDelay: '120ms' }}>
              <CardArt no={null} name={null} tier="Waiting" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── The door ──
  const invited = !!inviter && !codeNote;
  return (
    <div className="ax">
      <div className="ax-wrap">
        <div className="ax-top">
          <span>Tracker Alpha</span>
          {signedIn
            ? <button onClick={onSignOut}>Use another account</button>
            : <button onClick={() => signIn(null)} disabled={busy}>Member? Sign in</button>}
        </div>
        <div className="ax-hero">
          <div className="ax-rise">
            {invited ? (
              <>
                <p className="ax-kicker">An invite for you</p>
                <h1 className="ax-h1" style={{ fontSize: 'clamp(40px, 7vw, 68px)' }}>{inviter!.name || 'A member'} invited you<i>.</i></h1>
                <p className="ax-serif">
                  {inviter!.founding ? 'A founding member' : 'Member'} No. {memberNo(inviter!.member_no)}. One invite each. They picked you.
                </p>
                <div style={{ marginTop: 32, maxWidth: 380 }}>
                  {signedIn ? (
                    <button className="ax-btn ax-btn-red ax-btn-wide" disabled={busy} onClick={() => redeem(pendingCode!)}>
                      {busy ? 'Letting you in…' : 'Accept invite'}
                    </button>
                  ) : (
                    <button className="ax-btn ax-btn-white ax-btn-wide" disabled={busy} onClick={() => signIn('invite', pendingCode!)}>
                      <GoogleG /> Accept with Google
                    </button>
                  )}
                  {codeNote && <p className="ax-note bad">{codeNote}</p>}
                  {signInNote && <p className="ax-note bad">{signInNote}</p>}
                </div>
              </>
            ) : (
              <>
                <p className="ax-kicker">By invitation</p>
                <h1 className="ax-h1">Invite only<i>.</i></h1>
                <p className="ax-serif">For the ones who actually lock in.</p>
                <p className="ax-lead">
                  Alpha lets people in slowly. Get an invite from a member, take a Priority Pass, or join the line.
                </p>
                <div className="ax-ways">
                  <Way n="01" t="I have an invite" s="A member gave you a code." on={open === 'invite'} onClick={() => toggle('invite')} />
                  {open === 'invite' && (
                    <InvitePanel
                      code={code} setCode={setCode} note={codeNote ?? signInNote} busy={busy} signedIn={signedIn}
                      onSubmit={() => (signedIn ? redeem(code) : (normalizeAccessCode(code).length === 12
                        ? signIn('invite', normalizeAccessCode(code))
                        : setCodeNote('An invite code has 12 letters and numbers.')))}
                    />
                  )}
                  {!playApp && (
                    <>
                      <Way n="02" t="Priority Pass" s={`${PASS_PRICE_LABEL} once. Skip the line. Yours for life.`} tag="Opens soon" on={open === 'pass'} onClick={() => toggle('pass')} />
                      {open === 'pass' && <PassPanel onJoin={() => { setWantsPass(true); setOpen('waitlist'); }} />}
                    </>
                  )}
                  <Way n={playApp ? '02' : '03'} t="Join the waitlist" s="Tell us how you study. Get your place in line." on={open === 'waitlist'} onClick={() => toggle('waitlist')} />
                  {open === 'waitlist' && (
                    <div className="ax-panelbox">
                      {signedIn ? (
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
                          <div className="ax-field">
                            <label className="ax-label" htmlFor="ax-hours">Hours you study a day</label>
                            <div className="ax-hours">{hours}<small>{hours === 1 ? 'hour' : 'hours'}</small></div>
                            <input id="ax-hours" className="ax-range" type="range" min={2} max={16} step={1} value={hours} onChange={e => setHours(Number(e.target.value))} />
                          </div>
                          <div className="ax-field">
                            <label className="ax-label" htmlFor="ax-why">Why should we let you in? <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(optional)</span></label>
                            <textarea id="ax-why" className="ax-input" maxLength={140} value={why} onChange={e => setWhy(e.target.value)} placeholder="One line. Make it count." />
                            <div className="ax-count">{why.length}/140</div>
                          </div>
                          {!playApp && (
                            <div className="ax-field">
                              <label className="ax-check">
                                <input type="checkbox" checked={wantsPass} onChange={e => setWantsPass(e.target.checked)} />
                                <span>I'd buy the Priority Pass when it opens.</span>
                              </label>
                            </div>
                          )}
                          <div className="ax-field">
                            <button className="ax-btn ax-btn-red ax-btn-wide" disabled={busy} onClick={apply}>
                              {busy ? 'Saving…' : 'Join the line'}
                            </button>
                            {applyNote && <p className="ax-note bad">{applyNote}</p>}
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="ax-note" style={{ marginTop: 0 }}>Sign in first. Your place is tied to your account.</p>
                          <div style={{ marginTop: 16 }}>
                            <button className="ax-btn ax-btn-white ax-btn-wide" disabled={busy} onClick={() => signIn('waitlist')}>
                              <GoogleG /> Continue with Google
                            </button>
                            {signInNote && <p className="ax-note bad">{signInNote}</p>}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <p className="ax-fine">
                  Already used Alpha before 1 November? You're a founding member. {signedIn
                    ? <>Sign in with that same Google account.</>
                    : <button onClick={() => signIn(null)} disabled={busy}>Sign in with Google</button>}
                </p>
              </>
            )}
          </div>
          <div className="ax-cardstage ax-rise" style={{ animationDelay: '120ms' }}>
            <CardArt no={null} name={null} tier={invited ? 'Invited' : 'Members only'} />
          </div>
        </div>
      </div>
    </div>
  );
};

interface WayProps { n: string; t: string; s: string; tag?: string; on: boolean; onClick: () => void }
const Way = ({ n, t, s, tag, on, onClick }: WayProps) => (
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
        aria-label="Invite code"
      />
      <button className={`ax-btn ${signedIn ? 'ax-btn-red' : 'ax-btn-white'}`} disabled={busy} type="submit">
        {signedIn ? (busy ? '…' : 'Enter') : <><GoogleG /> Go</>}
      </button>
    </form>
    {!signedIn && <p className="ax-note">You'll sign in with Google, then you're in.</p>}
    {note && <p className="ax-note bad">{note}</p>}
  </div>
);

const PassPanel = ({ onJoin, wantsPass }: { onJoin?: () => void; wantsPass?: boolean }) => (
  <div className="ax-panelbox">
    <p className="ax-note" style={{ marginTop: 0, color: '#d4d4d8' }}>
      Pay {PASS_PRICE_LABEL} once. Skip the line. Full Alpha for life, plus your own invite.
    </p>
    <p className="ax-note">
      Payments open soon. {onJoin
        ? 'Join the line and tick the Pass box. You hear first.'
        : wantsPass ? "You ticked the Pass box. You'll hear first." : 'Stay in line. It opens here.'}
    </p>
    {onJoin && (
      <div style={{ marginTop: 16 }}>
        <button className="ax-btn ax-btn-ghost ax-btn-wide" onClick={onJoin}>Join the line</button>
      </div>
    )}
  </div>
);

export default Gate;
