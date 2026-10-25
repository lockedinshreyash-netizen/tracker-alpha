/* ── Group chat ──
   A view over useGroupChat, which owns every guarantee (no gaps, no
   duplicates, sends that survive a dropped connection). This file owns only
   what a person sees: where the scroll sits, which messages carry a name,
   what "deleted" looks like. The gestures — swipe right to reply, long press
   for reactions and Reply · Copy · Delete, double-tap to ❤️, and ↩ 😊 ⋯ beside
   a bubble on hover — are chat/ChatMessage.tsx's, shared with race chat.

   Mounted keyed by group id, so switching groups is a fresh subscription and
   a fresh scroll position rather than one group's history flashing under
   another's header. */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { UserChip } from '../profile/Avatar';
import { useProfiles } from '../profile/profileCache';
import { MyGroup } from './api';
import { GroupMessage, MAX_MESSAGE, validateMessage } from './chatApi';
import { Connection, OutboxEntry, useGroupChat } from './useGroupChat';
import { clock12, istDay, tokens } from './ui';
import ChatMessage from '../chat/ChatMessage';
import QuoteBlock, { Quote, resolveQuote } from '../chat/QuoteBlock';
import { ReactionGroup, groupReactions } from '../chat/reactions';

interface Props {
  group: MyGroup;
  userId: string;
  onRead: (groupId: string) => void;
  onOpenProfile: (userId: string) => void;
  theme: 'dark' | 'light';
}

const BOTTOM_THRESHOLD = 96;
const TOP_THRESHOLD = 160;
const MAX_TEXTAREA_PX = 120;
/* Consecutive messages from one sender within this window share a header. */
const RUN_GAP_MS = 5 * 60_000;

type Item =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'msg'; key: string; msg: GroupMessage; first: boolean }
  | { kind: 'out'; key: string; entry: OutboxEntry };

const dayLabel = (day: string): string => {
  const today = istDay(new Date().toISOString());
  const yesterday = istDay(new Date(Date.now() - 86_400_000).toISOString());
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  const [y, m, d] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', ...(y !== new Date().getFullYear() ? { year: 'numeric' } : {}), timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)));
};

const CONNECTION_LABEL: Record<Connection, string | null> = {
  connecting: 'Connecting…',
  live: null,
  reconnecting: 'Reconnecting — messages will catch up',
  offline: 'Offline — you’ll catch up when you’re back',
};

const GroupChat: React.FC<Props> = ({ group, userId, onRead, onOpenProfile, theme }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
  const chat = useGroupChat({ groupId: group.id, userId, active: visible, onRead });
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const [newCount, setNewCount] = useState(0);
  const canModerate = group.role === 'owner' || group.role === 'admin';

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  /* Everyone whose name might be drawn: senders, people who reacted, and the
     authors of quoted messages above the window. */
  const senderIds = useMemo(() => {
    const ids = new Set<string>();
    chat.messages.forEach(m => ids.add(m.sender_id));
    Object.values(chat.reactions).forEach(byUser => Object.keys(byUser).forEach(id => ids.add(id)));
    Object.values(chat.quotes).forEach(q => { if (q) ids.add(q.sender_id); });
    ids.delete(userId);
    return Array.from(ids);
  }, [chat.messages, chat.reactions, chat.quotes, userId]);
  const profiles = useProfiles(senderIds);
  const nameOf = useCallback(
    (id: string) => (id === userId ? 'You' : profiles[id]?.display_name ?? 'Member'),
    [profiles, userId]
  );

  const byId = useMemo(() => new Map(chat.messages.map(m => [m.id, m])), [chat.messages]);
  const quoteFor = useCallback((id: number | null | undefined): Quote | null => {
    if (!id) return null;
    const onScreen = byId.get(id);
    const q = onScreen ?? chat.quotes[id];
    return resolveQuote(id, q && { senderId: q.sender_id, body: q.body, deleted: !!q.deleted_at, name: nameOf(q.sender_id) }, !!onScreen, userId);
  }, [byId, chat.quotes, userId, nameOf]);

  const reactionsFor = useCallback(
    (messageId: number): ReactionGroup[] => groupReactions(chat.reactions[messageId], chat.pending[messageId], userId, nameOf),
    [chat.reactions, chat.pending, userId, nameOf]
  );

  /* ── Items: day dividers, runs, then whatever is still in the outbox ── */
  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    let lastDay = '';
    let prev: GroupMessage | null = null;
    for (const msg of chat.messages) {
      const day = istDay(msg.created_at);
      if (day !== lastDay) {
        out.push({ kind: 'day', key: `d-${day}`, label: dayLabel(day) });
        lastDay = day;
        prev = null;
      }
      const first = !prev || prev.sender_id !== msg.sender_id
        || new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() > RUN_GAP_MS;
      out.push({ kind: 'msg', key: `m-${msg.id}`, msg, first });
      prev = msg;
    }
    chat.outbox.forEach(entry => out.push({ kind: 'out', key: `o-${entry.client_id}`, entry }));
    return out;
  }, [chat.messages, chat.outbox]);

  /* ── Scroll ──
     Three cases, told apart by what changed at each end of the list:
       · an older page landed at the top → hold the reader's place exactly;
       · something landed at the bottom → follow it if the reader was already
         there (or it is their own), otherwise count it on the pill;
       · first load → jump to the bottom. */
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  /* "Keep me at the newest message." Set by arriving at the bottom, cleared
     only by the reader moving UP — never by content growing underneath a
     still scroll position. Deriving it from geometry at scroll-event time was
     wrong: a font swap between our own scroll-to-bottom and the event it
     queues makes the reader look 700px away when they never moved. */
  const nearBottomRef = useRef(true);
  const lastTopRef = useRef(0);
  const toEnd = (el: HTMLDivElement) => {
    el.scrollTop = el.scrollHeight;
    lastTopRef.current = el.scrollTop;
  };
  const prependRef = useRef<{ height: number; top: number } | null>(null);
  const firstIdRef = useRef<number | null>(null);
  const lastIdRef = useRef<number | null>(null);
  const outLenRef = useRef(0);
  const initialRef = useRef(true);
  /* The newest message when the thread first drew. Anything after it rose in
     while the reader watched, and is the only thing that animates. */
  const settledIdRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || chat.loading) return;
    const firstId = chat.messages[0]?.id ?? null;
    const lastMsg = chat.messages[chat.messages.length - 1];
    const lastId = lastMsg?.id ?? null;
    const outLen = chat.outbox.length;

    if (initialRef.current) {
      initialRef.current = false;
      settledIdRef.current = lastId ?? 0;
      toEnd(el);
    } else if (prependRef.current && firstId !== firstIdRef.current) {
      const { height, top } = prependRef.current;
      el.scrollTop = el.scrollHeight - height + top;
      lastTopRef.current = el.scrollTop;
      prependRef.current = null;
    } else {
      /* Judged on the newest CONFIRMED message, not the last row drawn: an
         unsent message parked at the bottom must not hide arrivals above it. */
      const arrived = lastId !== null && lastId !== lastIdRef.current;
      const queued = outLen > outLenRef.current;
      if (queued || (arrived && (nearBottomRef.current || lastMsg.sender_id === userId))) {
        toEnd(el);
        setNewCount(0);
      } else if (arrived) {
        setNewCount(c => c + 1);
      }
    }
    firstIdRef.current = firstId;
    lastIdRef.current = lastId;
    outLenRef.current = outLen;
  }, [chat.loading, chat.messages, chat.outbox.length, userId]);

  /* Content grows after it is laid out — sender avatars resolve a render
     after the messages do, images decode, the phone keyboard shrinks the pane
     — and none of that fires a scroll event. A reader sitting at the bottom
     stays at the bottom through all of it; one who has scrolled up is left
     alone. Two triggers, because neither covers everything: a layout effect
     after every render catches React's own changes before they paint, and a
     ResizeObserver catches the ones React never sees. The height guard keeps
     the per-render check to one cached layout read. */
  const contentRef = useRef<HTMLDivElement>(null);
  const pinnedHeightRef = useRef(0);
  const pinIfAtBottom = useCallback(() => {
    const el = listRef.current;
    if (!el || !nearBottomRef.current || prependRef.current) return;
    if (el.scrollHeight === pinnedHeightRef.current) return;
    pinnedHeightRef.current = el.scrollHeight;
    toEnd(el);
  }, []);
  useLayoutEffect(pinIfAtBottom);
  useEffect(() => {
    const el = listRef.current;
    const content = contentRef.current;
    if (!el || !content || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(pinIfAtBottom);
    ro.observe(content);
    ro.observe(el);
    return () => ro.disconnect();
  }, [chat.loading, pinIfAtBottom]);

  const { hasOlder, loadingOlder, loadOlder } = chat;
  const onScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (fromBottom < BOTTOM_THRESHOLD) {
      nearBottomRef.current = true;
      setNewCount(0);
    } else if (el.scrollTop < lastTopRef.current - 2) {
      nearBottomRef.current = false;
    }
    lastTopRef.current = el.scrollTop;
    if (el.scrollTop < TOP_THRESHOLD && hasOlder && !loadingOlder) {
      prependRef.current = { height: el.scrollHeight, top: el.scrollTop };
      void loadOlder();
    }
  }, [hasOlder, loadingOlder, loadOlder]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [draft]);

  const jumpToBottom = () => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setNewCount(0);
  };

  const canSend = Boolean(validateMessage(draft));
  const handleSend = () => {
    if (!canSend) return;
    chat.send(draft, replyTo);
    setDraft('');
    setReplyTo(null);
    nearBottomRef.current = true;
    textareaRef.current?.focus();
  };

  const startReply = useCallback((id: number) => {
    setReplyTo(id);
    textareaRef.current?.focus({ preventScroll: true });
  }, []);

  /* Tapping a quote goes to the original, if it is loaded, and flashes it so
     the eye lands on the right bubble. Scrolling up there clears "stick to
     bottom" through the normal onScroll path. */
  const flashTimer = useRef<number | undefined>(undefined);
  const jumpTo = useCallback((id: string | number) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-msg-id="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFlash(Number(id));
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1600);
  }, []);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  /* Mine: tap the same emoji to take it back, another to switch — one
     reaction per person, as in WhatsApp. */
  const toggleReaction = useCallback((messageId: number, emoji: string) => {
    const current = chat.pending[messageId] !== undefined
      ? chat.pending[messageId]
      : chat.reactions[messageId]?.[userId]?.emoji ?? null;
    chat.react(messageId, current === emoji ? null : emoji);
  }, [chat.pending, chat.reactions, chat.react, userId]);

  const replyQuote = quoteFor(replyTo);

  const connectionNote = CONNECTION_LABEL[chat.connection];

  return (
    <section className={`rounded-xl border overflow-hidden flex flex-col ${t.card}`}>
      <div className={`flex items-center justify-between gap-3 px-5 py-3 border-b ${t.rule}`}>
        <p className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${dark ? 'text-zinc-500' : 'text-zinc-400'}`}>Chat</p>
        <span className={`flex items-center gap-1.5 text-[10px] font-ui ${t.muted}`} role="status" aria-live="polite">
          <span
            className={`w-1.5 h-1.5 rounded-full ${chat.connection === 'live' ? 'bg-emerald-500' : chat.connection === 'offline' ? 'bg-zinc-500' : 'bg-amber-500 animate-pulse'}`}
            aria-hidden="true"
          />
          {connectionNote ?? 'Live'}
        </span>
      </div>

      <div className="relative">
        <div
          ref={listRef}
          onScroll={onScroll}
          className="h-[58vh] min-h-[340px] md:h-[520px] overflow-y-auto px-4 md:px-5 py-3"
          aria-label={`${group.name} messages`}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {chat.loading ? (
            <div className="space-y-3 pt-2" aria-busy="true">
              {[60, 40, 72, 50].map((w, i) => (
                <div key={i} className={`flex ${i % 2 ? 'justify-end' : ''}`}>
                  <div className={`h-10 rounded-lg animate-pulse ${dark ? 'bg-white/[0.03]' : 'bg-zinc-50'}`} style={{ width: `${w}%` }} />
                </div>
              ))}
            </div>
          ) : (
            <div ref={contentRef}>
              {hasOlder ? (
                <div className="flex justify-center py-2">
                  <button
                    onClick={() => {
                      const el = listRef.current;
                      if (el) prependRef.current = { height: el.scrollHeight, top: el.scrollTop };
                      void loadOlder();
                    }}
                    disabled={loadingOlder}
                    className={`text-[10px] font-black uppercase tracking-[0.1em] font-ui ${t.muted} hover:text-[#E10600]`}
                  >
                    {loadingOlder ? 'Loading…' : 'Load earlier messages'}
                  </button>
                </div>
              ) : chat.messages.length > 0 && (
                <p className={`text-center text-[10px] font-ui py-3 ${t.faint}`}>Start of {group.name}</p>
              )}

              {!chat.messages.length && !chat.outbox.length && (
                <div className="flex flex-col items-center justify-center text-center px-6 py-24">
                  <p className={`text-sm font-ui ${t.body}`}>Nothing here yet.</p>
                  <p className={`text-[11px] font-ui mt-1 ${t.muted}`}>Say what you’re studying tonight. Then go study it.</p>
                </div>
              )}

              {items.map(item => {
                if (item.kind === 'day') {
                  return (
                    <div key={item.key} className="flex items-center gap-3 my-4" role="separator">
                      <div className={`flex-1 h-px ${dark ? 'bg-white/[0.06]' : 'bg-zinc-200'}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${t.muted}`}>{item.label}</span>
                      <div className={`flex-1 h-px ${dark ? 'bg-white/[0.06]' : 'bg-zinc-200'}`} />
                    </div>
                  );
                }
                if (item.kind === 'out') {
                  return (
                    <OutboxBubble
                      key={item.key}
                      entry={item.entry}
                      quote={quoteFor(item.entry.reply_to)}
                      dark={dark}
                      onRetry={chat.retry}
                      onDiscard={chat.discard}
                    />
                  );
                }
                const { msg, first } = item;
                const mine = msg.sender_id === userId;
                const deleted = !!msg.deleted_at;
                const profile = profiles[msg.sender_id];
                const quote = quoteFor(msg.reply_to);
                return (
                  <ChatMessage
                    key={item.key}
                    id={msg.id}
                    mine={mine}
                    dark={dark}
                    interactive={chat.extras && !deleted}
                    canDelete={!deleted && (mine || canModerate)}
                    className={first ? 'mt-3' : 'mt-1'}
                    bubbleClass={`${mine
                      ? 'bg-[#E10600]/10 border-[#E10600]/25'
                      : dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200'} ${deleted ? 'opacity-60' : ''}`}
                    flash={flash === msg.id}
                    animateIn={!mine && settledIdRef.current !== null && msg.id > settledIdRef.current}
                    header={first && (mine ? (
                      <span className={`text-[9px] font-ui mb-1 px-1 ${t.muted}`}>{clock12(msg.created_at)}</span>
                    ) : (
                      <div className="flex items-baseline gap-2 mb-1 px-1">
                        <UserChip
                          userId={msg.sender_id}
                          name={profile?.display_name ?? 'Member'}
                          profile={profile}
                          onOpen={onOpenProfile}
                          theme={theme}
                          size={18}
                          nameClassName={`truncate text-[11px] font-bold font-ui ${t.heading}`}
                        />
                        <span className={`text-[9px] font-ui ${t.muted}`}>{clock12(msg.created_at)}</span>
                      </div>
                    ))}
                    reactions={chat.extras && !deleted ? reactionsFor(msg.id) : []}
                    reactionBusy={chat.pending[msg.id] !== undefined}
                    timeLabel={clock12(msg.created_at)}
                    copyText={msg.body}
                    ariaLabel={deleted ? 'Deleted message' : undefined}
                    onReact={emoji => toggleReaction(msg.id, emoji)}
                    onReply={() => startReply(msg.id)}
                    onDelete={() => void chat.remove(msg.id)}
                  >
                    {quote && !deleted && (
                      <div className="mb-1.5 -mx-1">
                        <QuoteBlock quote={quote} dark={dark} onJump={jumpTo} />
                      </div>
                    )}
                    {deleted ? (
                      <span className={`text-[12px] font-ui italic ${t.muted}`}>Message deleted</span>
                    ) : (
                      <span className={`block text-[13px] font-ui leading-relaxed whitespace-pre-wrap break-words ${t.body}`}>{msg.body}</span>
                    )}
                  </ChatMessage>
                );
              })}
            </div>
          )}
        </div>

        {newCount > 0 && (
          <button
            onClick={jumpToBottom}
            className="absolute left-1/2 -translate-x-1/2 bottom-3 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.08em] font-ui bg-[#E10600] text-white shadow-lg active:scale-[0.97] transition-transform"
          >
            {newCount} new {newCount === 1 ? 'message' : 'messages'} ↓
          </button>
        )}
      </div>

      {chat.error && (
        <p className={`text-[10px] font-ui text-center px-5 pt-2 ${t.muted}`}>{chat.error}</p>
      )}

      {replyQuote && (
        <div className={`flex items-center gap-3 px-4 pt-2.5 border-t ${t.rule}`}>
          <div className="flex-1 min-w-0">
            <QuoteBlock quote={replyQuote} dark={dark} label="Replying to" />
          </div>
          <button
            onClick={() => setReplyTo(null)}
            aria-label="Cancel reply"
            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm ${t.muted} ${t.hover}`}
          >
            ✕
          </button>
        </div>
      )}

      <div className={`flex items-end gap-2.5 p-3 ${replyQuote ? '' : `border-t ${t.rule}`}`}>
        <label htmlFor={`chat-input-${group.id}`} className="sr-only">Message {group.name}</label>
        <textarea
          id={`chat-input-${group.id}`}
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape' && replyTo) { e.preventDefault(); setReplyTo(null); return; }
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
            e.preventDefault();
            handleSend();
          }}
          maxLength={MAX_MESSAGE}
          rows={1}
          placeholder={replyQuote ? 'Write your reply…' : 'Type a message…'}
          className={`flex-1 min-w-0 resize-none px-3.5 py-2.5 rounded-lg border text-sm font-ui leading-snug outline-none transition-colors focus:border-[#E10600] ${dark ? 'bg-[#0D0D10] border-white/[0.08] text-white placeholder:text-zinc-700' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'}`}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          className={`flex-shrink-0 h-10 px-4 rounded-lg text-[10px] font-black uppercase tracking-[0.14em] font-ui transition-all active:scale-[0.96] ${canSend ? t.primary : t.disabled}`}
        >
          Send
        </button>
      </div>
      {draft.length > MAX_MESSAGE - 100 && (
        <p className={`text-right text-[9px] font-ui px-4 pb-2 -mt-1 ${t.muted}`}>{draft.length}/{MAX_MESSAGE}</p>
      )}
    </section>
  );
};

/* ── Pieces ── */

const OutboxBubble: React.FC<{
  entry: OutboxEntry;
  quote: Quote | null;
  dark: boolean;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
}> = ({ entry, quote, dark, onRetry, onDiscard }) => {
  const t = tokens(dark);
  const failed = entry.status === 'failed';
  return (
    <div className="flex justify-end mt-1">
      <div className="max-w-[85%] md:max-w-[70%] min-w-0 flex flex-col items-end chat-in">
        <div className={`px-3.5 py-2 rounded-2xl rounded-br-md border bg-[#E10600]/10 ${failed ? 'border-[#E10600]/60' : 'border-[#E10600]/25 opacity-60'}`}>
          {quote && (
            <div className="mb-1.5 -mx-1">
              <QuoteBlock quote={quote} dark={dark} />
            </div>
          )}
          <span className={`block text-[13px] font-ui leading-relaxed whitespace-pre-wrap break-words ${t.body}`}>{entry.body}</span>
        </div>
        <p className={`text-[9px] font-ui mt-1 px-1 ${t.muted}`}>
          {failed ? (
            <>
              <span className="text-[#E10600]">{entry.error ?? 'Not sent'}</span>
              {' · '}
              <button onClick={() => onRetry(entry.client_id)} className="font-black uppercase tracking-[0.1em] text-[#E10600]">Retry</button>
              {' · '}
              <button onClick={() => onDiscard(entry.client_id)} className="font-black uppercase tracking-[0.1em]">Discard</button>
            </>
          ) : 'Sending…'}
        </p>
      </div>
    </div>
  );
};

export default GroupChat;
