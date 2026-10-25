/* ── `?support=debug` (DEV only) ──
   The founder-notes loop end to end with no database: the student's Support
   page (signed in, as a fixture user) beside Console → Notes, both talking to
   an in-memory copy of supabase/support.sql's functions. Send a note on the
   left, reply on the right, press "Check replies" to see the line Today would
   show, scroll to Your notes to mark it read. Nothing leaves the page: the
   support RPCs are answered here before they reach the network. */

import React, { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import SupportPage from './SupportPage';
import FounderNotesAdmin from '../admin/FounderNotesAdmin';
import NoticeLine from '../notify/NoticeLine';
import { countUnseenReplies } from './api';
import { SUPPORT_COPY } from './content';

interface Row {
  id: string; body: string; signed_name: string | null; created_at: string;
  reply: string | null; replied_at: string | null; reply_seen_at: string | null;
}

const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

const rows: Row[] = [
  { id: 'n3', body: 'Can you add a way to see my hours per chapter? That would help a lot before mocks.', signed_name: null, created_at: ago(40), reply: null, replied_at: null, reply_seen_at: null },
  { id: 'n2', body: 'Alpha got me through Class 11. Thank you for building it.', signed_name: 'Asha', created_at: ago(60 * 26), reply: 'This made my week, Asha. Keep going.', replied_at: ago(60 * 2), reply_seen_at: null },
  { id: 'n1', body: 'The streak thing actually works on me lol', signed_name: null, created_at: ago(60 * 24 * 6), reply: 'It works on me too.', replied_at: ago(60 * 24 * 5), reply_seen_at: ago(60 * 24 * 5) },
];

const json = (v: unknown) => new Response(JSON.stringify(v), { status: 200, headers: { 'content-type': 'application/json' } });
const fail = (message: string, code = 'P0001') => new Response(JSON.stringify({ code, message }), { status: 400, headers: { 'content-type': 'application/json' } });
const unseen = (r: Row) => !!r.reply && (!r.reply_seen_at || r.reply_seen_at < (r.replied_at ?? ''));

const answer = (name: string, a: Record<string, unknown>): Response => {
  switch (name) {
    case 'send_founder_note': {
      const body = String(a.p_body ?? '').trim();
      if (!body || body.length > 500) return fail('founder_note_length', '22023');
      const row: Row = { id: `n${Date.now()}`, body, signed_name: a.p_signed ? 'Asha' : null, created_at: new Date().toISOString(), reply: null, replied_at: null, reply_seen_at: null };
      rows.unshift(row);
      return json(row.id);
    }
    case 'my_founder_notes':
      return json(rows.map(r => ({ id: r.id, body: r.body, signed: r.signed_name !== null, created_at: r.created_at, reply: r.reply, replied_at: r.replied_at, reply_seen_at: r.reply_seen_at })));
    case 'unseen_founder_replies':
      return json(rows.filter(unseen).length);
    case 'ack_founder_replies': {
      const ids = (a.p_ids as string[]) ?? [];
      rows.forEach(r => { if (ids.includes(r.id) && r.reply) r.reply_seen_at = new Date().toISOString(); });
      return json(null);
    }
    case 'admin_founder_notes': {
      const list = rows.filter(r => (!a.p_unreplied || !r.reply) && (!a.p_before || r.created_at < String(a.p_before)));
      return json(list.map(r => ({ id: r.id, body: r.body, signed_name: r.signed_name, created_at: r.created_at, reply: r.reply, replied_at: r.replied_at, reply_seen: !!r.reply && !unseen(r) })));
    }
    case 'admin_reply_founder_note': {
      const row = rows.find(r => r.id === a.p_id);
      if (!row) return fail('founder_note_missing', 'P0002');
      const reply = String(a.p_reply ?? '').trim() || null;
      row.reply = reply;
      row.replied_at = reply ? new Date().toISOString() : null;
      if (!reply) row.reply_seen_at = null;
      return json(null);
    }
    default:
      return fail('unknown', 'PGRST202');
  }
};

/* Installed when this module loads, which only happens on ?support=debug in DEV. */
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const m = url.match(/\/rest\/v1\/rpc\/(\w*founder\w*)/);
  if (!m) return realFetch(input, init);
  await new Promise(r => setTimeout(r, 350));
  let args: Record<string, unknown> = {};
  try { args = JSON.parse(String(init?.body ?? '{}')); } catch { /* none */ }
  return answer(m[1], args);
};

const STUDENT = { id: 'debug-student', email: 'asha@example.com' } as unknown as User;

const DebugSupport = () => {
  const [dark, setDark] = useState(true);
  const [count, setCount] = useState(0);
  const [focus, setFocus] = useState(false);
  const theme = dark ? 'dark' : 'light';
  const check = () => { void countUnseenReplies().then(setCount); };
  useEffect(check, []);

  return (
    <div className={`min-h-screen font-ui ${dark ? 'bg-[#0B0B0D] text-white' : 'bg-[#F2F0EC] text-zinc-900'}`}>
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-3 px-6 py-3 border-b border-white/[0.08] backdrop-blur bg-black/40 text-white text-[12px]">
        <b>?support=debug</b>
        <button onClick={() => setDark(d => !d)} className="px-3 py-1.5 rounded-md border border-white/20">{dark ? 'Light' : 'Dark'}</button>
        <button onClick={check} className="px-3 py-1.5 rounded-md border border-white/20">Check replies</button>
        <span className="opacity-60">In-memory RPCs. Nothing is written.</span>
      </div>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_480px] gap-10 px-4 md:px-8 py-8">
        <div className="max-w-5xl w-full mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-500 mb-3">Today (as the student)</p>
          {count > 0 ? (
            <NoticeLine theme={theme} label={`${SUPPORT_COPY.signature} replied to your note`} detail="Tap to read" onOpen={() => setFocus(true)} />
          ) : <p className="text-[12px] text-zinc-500">No line: nothing unseen.</p>}
          <div className="mt-10">
            <SupportPage
              theme={theme}
              user={STUDENT}
              onSignIn={() => {}}
              onRepliesSeen={() => setCount(0)}
              focusNotes={focus}
              onNotesFocused={() => setFocus(false)}
            />
          </div>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-zinc-500 mb-3">Console → Notes (as an admin)</p>
          <FounderNotesAdmin theme={theme} />
        </div>
      </div>
    </div>
  );
};

export default DebugSupport;
