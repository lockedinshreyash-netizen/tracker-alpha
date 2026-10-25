/* ── `?chat=debug` (DEV only) ──
   The shared chat bubble on a fixture thread, no database: swipe to reply,
   long press, double tap, the hover strip, the menu near both edges, quotes,
   reactions, a deleted message. Light/dark switch at the top. Nothing is
   written anywhere. */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import ChatMessage from './ChatMessage';
import QuoteBlock, { resolveQuote } from './QuoteBlock';
import { groupReactions } from './reactions';

interface Msg { id: string; from: string; body: string; at: string; replyTo?: string; deleted?: boolean }

const ME = 'me';
const NAMES: Record<string, string> = { me: 'You', riya: 'Riya', arjun: 'Arjun', kabir: 'Kabir' };

const FIXTURE: Msg[] = [
  { id: 'm1', from: 'riya', body: 'Who’s doing rotational today?', at: '6:02 PM' },
  { id: 'm2', from: 'arjun', body: 'Me. 3h in. Moment of inertia is eating me alive.', at: '6:03 PM' },
  { id: 'm3', from: ME, body: 'Same chapter. Let’s race it.', at: '6:05 PM', replyTo: 'm1' },
  { id: 'm4', from: 'kabir', body: 'Message deleted', at: '6:06 PM', deleted: true },
  { id: 'm5', from: 'riya', body: 'Parallel axis theorem is the whole trick. Do 20 from HC Verma and it clicks.', at: '6:09 PM', replyTo: 'm2' },
  { id: 'm6', from: ME, body: 'Ok. Phone away. Back at 8.', at: '6:10 PM' },
  { id: 'm7', from: 'arjun', body: 'LOCK IN 🔒', at: '6:11 PM' },
];

const DebugChat = () => {
  const [dark, setDark] = useState(true);
  const [messages, setMessages] = useState(FIXTURE);
  const [reactions, setReactions] = useState<Record<string, Record<string, { emoji: string | null }>>>({
    m2: { riya: { emoji: '😢' }, kabir: { emoji: '😢' } },
    m6: { arjun: { emoji: '🔥' } },
  });
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const note = (s: string) => setLog(l => [s, ...l].slice(0, 6));

  const nameOf = useCallback((id: string) => NAMES[id] ?? id, []);
  const byId = useMemo(() => new Map(messages.map(m => [m.id, m])), [messages]);
  const quoteFor = (id?: string | null) => {
    if (!id) return null;
    const q = byId.get(id);
    return resolveQuote(id, q && { senderId: q.from, body: q.body, deleted: !!q.deleted, name: nameOf(q.from) }, !!q, ME);
  };

  const react = (id: string, emoji: string) => {
    setReactions(prev => {
      const mine = prev[id]?.[ME]?.emoji ?? null;
      return { ...prev, [id]: { ...prev[id], [ME]: { emoji: mine === emoji ? null : emoji } } };
    });
    note(`react ${emoji} on ${id}`);
  };

  const jumpTo = (id: string | number) => {
    listRef.current?.querySelector<HTMLElement>(`[data-msg-id="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFlash(String(id));
    window.setTimeout(() => setFlash(null), 1600);
  };

  const replyQuote = quoteFor(replyTo);
  const muted = 'text-zinc-500';

  return (
    <div className={`min-h-screen font-ui ${dark ? 'bg-[#0B0B0D] text-white' : 'bg-[#F2F0EC] text-zinc-900'}`}>
      <div className="max-w-[640px] mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Chat bubble board</h1>
          <button className="text-xs underline" onClick={() => setDark(d => !d)}>{dark ? 'Light' : 'Dark'}</button>
        </div>
        <p className={`text-xs ${muted}`}>
          Touch: swipe right to reply, long press for the menu, double tap for ❤️. Mouse: hover for ↩ 😊 ⋯, right click or double click.
        </p>

        <section className={`rounded-xl border overflow-hidden ${dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm'}`}>
          <div ref={listRef} className="h-[460px] overflow-y-auto overflow-x-hidden px-5 py-2">
            {messages.map((m, i) => {
              const mine = m.from === ME;
              const first = i === 0 || messages[i - 1].from !== m.from;
              const quote = quoteFor(m.replyTo);
              return (
                <ChatMessage
                  key={m.id}
                  id={m.id}
                  mine={mine}
                  dark={dark}
                  interactive={!m.deleted}
                  canDelete={!m.deleted && mine}
                  className={first ? 'mt-3' : 'mt-1'}
                  bubbleClass={`${mine ? 'bg-[#E10600]/10 border-[#E10600]/25' : dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'} ${m.deleted ? 'opacity-60' : ''}`}
                  flash={flash === m.id}
                  header={first && !mine ? <span className={`text-[11px] font-bold mb-1 px-1`}>{nameOf(m.from)} <span className={`text-[9px] font-normal ${muted}`}>{m.at}</span></span> : undefined}
                  reactions={m.deleted ? [] : groupReactions(reactions[m.id], undefined, ME, nameOf)}
                  reactionBusy={false}
                  timeLabel={m.at}
                  copyText={m.body}
                  onReact={emoji => react(m.id, emoji)}
                  onReply={() => { setReplyTo(m.id); note(`reply to ${m.id}`); }}
                  onDelete={() => { setMessages(ms => ms.map(x => (x.id === m.id ? { ...x, deleted: true, body: '' } : x))); note(`delete ${m.id}`); }}
                >
                  {quote && !m.deleted && <div className="mb-1.5 -mx-1"><QuoteBlock quote={quote} dark={dark} onJump={jumpTo} /></div>}
                  {m.deleted
                    ? <span className={`text-[12px] italic ${muted}`}>Message deleted</span>
                    : <span className={`block text-[13px] leading-relaxed whitespace-pre-wrap break-words ${dark ? 'text-zinc-200' : 'text-zinc-900'}`}>{m.body}</span>}
                </ChatMessage>
              );
            })}
          </div>
          {replyQuote && (
            <div className={`flex items-center gap-3 px-3.5 py-2.5 border-t ${dark ? 'border-white/[0.06]' : 'border-zinc-200'}`}>
              <div className="flex-1 min-w-0"><QuoteBlock quote={replyQuote} dark={dark} label="Replying to" /></div>
              <button onClick={() => setReplyTo(null)} className={muted}>✕</button>
            </div>
          )}
        </section>

        <ul className={`text-[11px] font-mono ${muted}`} data-testid="log">
          {log.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      </div>
    </div>
  );
};

export default DebugChat;
