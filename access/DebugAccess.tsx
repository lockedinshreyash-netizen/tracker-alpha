/* ── `?access=debug` (DEV only) ──
   Every state of the Gate, the member card, the founding moment and Console →
   Access, on in-memory RPCs answered before the network (the support board's
   fetch stub). A picker in the corner switches state; nothing is written. */

import { useState } from 'react';
import Gate from './Gate';
import MemberSheet from './MemberSheet';
import AccessAdmin from '../admin/AccessAdmin';
import type { AccessView } from './useAccess';
import type { MemberFace, MemberInfo } from './api';

const RAHUL: MemberFace = { name: 'Rahul Verma', avatar_type: 'alpha', avatar_id: 'alpha_03', member_no: 412, founding: true };
const PRIYA: MemberFace = { name: 'Priya S', avatar_type: 'alpha', avatar_id: 'alpha_07', member_no: 1288, founding: false };

const FOUNDING: MemberInfo = {
  source: 'founding', memberNo: 412, grantedAt: '2026-03-04T10:00:00Z', invitedBy: null,
  invite: { code: '7K3QM9XD2PWC', redeemedAt: null, redeemedBy: null },
};
const INVITED: MemberInfo = {
  source: 'invite', memberNo: 1288, grantedAt: '2026-11-02T10:00:00Z', invitedBy: RAHUL,
  invite: { code: 'H4R8ZT1QK6NB', redeemedAt: '2026-11-03T08:00:00Z', redeemedBy: { name: 'Aman K', member_no: 1301, founding: false } },
};

let previewStatus: 'ok' | 'used' | 'invalid' = 'ok';
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

const answer = (fn: string, args: Record<string, unknown>): Response => {
  switch (fn) {
    case 'preview_access_invite':
      return ok(previewStatus === 'ok' ? { status: 'ok', inviter: RAHUL } : { status: previewStatus });
    case 'redeem_access_invite':
      return ok(String(args.p_code ?? '').startsWith('0000') ? { status: 'invalid' } : { status: 'joined', inviter: RAHUL });
    case 'my_access':
      return ok({ status: 'member', source: 'invite', member_no: 1288, invited_by: RAHUL, invite: { code: 'H4R8ZT1QK6NB', redeemed_at: null, redeemed_by: null } });
    case 'join_waitlist':
      return ok({ status: 'waitlist', position: 41, wants_pass: !!(args.p as { wants_pass?: boolean })?.wants_pass });
    case 'admin_access_overview':
      return ok({ cutover: '2026-10-31T18:30:00Z', by_source: { founding: 3120, invite: 418, waitlist: 200, admin: 3 }, device_claims: 12, founding_unnumbered: 0, invites_redeemed: 418, invites_open: 3323, waiting: 2, waiting_wants_pass: 1, admitted_from_waitlist: 200 });
    case 'admin_waitlist':
      return ok([
        { user_id: 'a', place: 1, name: 'Ishaan', exam: 'JEE', class: 12, goal_hours: 10, why: 'I study 10 hours. I want the people around me to as well.', wants_pass: true, joined_at: '2026-11-01T06:10:00Z' },
        { user_id: 'b', place: 2, name: null, exam: 'NEET', class: 13, goal_hours: 8, why: null, wants_pass: false, joined_at: '2026-11-01T09:42:00Z' },
      ]);
    default:
      return new Response(JSON.stringify({ code: 'PGRST202', message: 'unknown' }), { status: 404 });
  }
};

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const m = url.match(/\/rest\/v1\/rpc\/(\w+)/);
  if (!m) return realFetch(input, init);
  await new Promise(r => setTimeout(r, 300));
  let args: Record<string, unknown> = {};
  try { args = JSON.parse(String(init?.body ?? '{}')); } catch { /* none */ }
  return answer(m[1], args);
};

type S =
  | 'door-out' | 'door-in' | 'door-play' | 'invited-out' | 'invited-used' | 'invited-in'
  | 'waitlist' | 'waitlist-play' | 'card-founding' | 'card-invited' | 'intro' | 'console-dark' | 'console-light';

const STATES: Array<[S, string]> = [
  ['door-out', 'Door · signed out'],
  ['door-in', 'Door · signed in (apply)'],
  ['door-play', 'Door · Play app'],
  ['invited-out', 'Invite link · signed out'],
  ['invited-used', 'Invite link · already used'],
  ['invited-in', 'Invite link · signed in → welcome'],
  ['waitlist', 'On the waitlist'],
  ['waitlist-play', 'On the waitlist · Play app'],
  ['card-founding', 'Member card · founding, invite open'],
  ['card-invited', 'Member card · invited, invite used'],
  ['intro', 'Founding moment (once)'],
  ['console-dark', 'Console → Access · dark'],
  ['console-light', 'Console → Access · light'],
];

const DEFAULTS = { exam: 'JEE' as const, currentClass: 12 as const, hours: 9 };
const noop = () => { /* debug */ };

const DebugAccess = () => {
  const [s, setS] = useState<S>(() => (new URLSearchParams(location.search).get('s') as S) || 'door-out');
  previewStatus = s === 'invited-used' ? 'used' : 'ok';
  try { sessionStorage.removeItem('alpha_gate_intent_v1'); } catch { /* fine */ }

  const view = (k: AccessView['kind']): AccessView =>
    k === 'waitlist' ? { kind: 'waitlist', position: 41, wantsPass: true } : ({ kind: k } as AccessView);

  const gate = (v: AccessView, signedIn: boolean, code: string | null, play = false) => (
    <Gate
      key={s}
      view={v}
      signedIn={signedIn}
      pendingCode={code}
      defaults={DEFAULTS}
      playApp={play}
      onSignIn={async () => 'Debug: Google is not reached from the board.'}
      onSignOut={noop}
      onSettle={a => alert(`settle → ${JSON.stringify(a).slice(0, 160)}`)}
    />
  );

  let body: React.ReactNode = null;
  if (s === 'door-out') body = gate(view('locked'), false, null);
  else if (s === 'door-in') body = gate(view('none'), true, null);
  else if (s === 'door-play') body = gate(view('locked'), false, null, true);
  else if (s === 'invited-out' || s === 'invited-used') body = gate(view('locked'), false, 'H4R8ZT1QK6NB');
  else if (s === 'invited-in') body = gate(view('none'), true, 'H4R8ZT1QK6NB');
  else if (s === 'waitlist') body = gate(view('waitlist'), true, null);
  else if (s === 'waitlist-play') body = gate(view('waitlist'), true, null, true);
  else if (s === 'card-founding') body = <MemberSheet key={s} member={FOUNDING} name="Shreyash" onClose={noop} />;
  else if (s === 'card-invited') body = <MemberSheet key={s} member={INVITED} name={PRIYA.name} onClose={noop} />;
  else if (s === 'intro') body = <MemberSheet key={s} member={FOUNDING} name="Shreyash" intro onClose={noop} />;
  else {
    const dark = s === 'console-dark';
    body = (
      <div className={`min-h-screen p-6 md:p-10 ${dark ? 'bg-[#0B0B0D]' : 'bg-[#F2F0EC]'}`}>
        <div className="max-w-5xl mx-auto"><AccessAdmin key={s} theme={dark ? 'dark' : 'light'} /></div>
      </div>
    );
  }

  return (
    <>
      {body}
      <select
        value={s}
        onChange={e => { setS(e.target.value as S); history.replaceState(null, '', `?access=debug&s=${e.target.value}`); }}
        style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 1000, padding: '8px 10px', borderRadius: 10, font: '600 13px system-ui', background: '#fff', color: '#000' }}
        aria-label="State"
      >
        {STATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </>
  );
};

export default DebugAccess;
