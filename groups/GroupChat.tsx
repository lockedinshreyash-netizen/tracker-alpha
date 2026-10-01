/* ── Group chat ──
   A view over useGroupChat, which owns every guarantee (no gaps, no
   duplicates, sends that survive a dropped connection). This file owns only
   what a person sees: where the scroll sits, which messages carry a name,
   what "deleted" looks like, and the WhatsApp-shaped gestures — tap a message
   for its reactions and Reply, double-tap to ❤️, swipe right to reply.

   Mounted keyed by group id, so switching groups is a fresh subscription and
   a fresh scroll position rather than one group's history flashing under
   another's header. */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { UserChip } from '../profile/Avatar';
import { useProfiles } from '../profile/profileCache';
import { ProfileSummary } from '../profile/profileApi';
import { MyGroup } from './api';
import { GroupMessage, MAX_MESSAGE, QUICK_REACTION, REACTIONS, validateMessage } from './chatApi';
import { Connection, OutboxEntry, QuoteMap, ReactionMap, useGroupChat } from './useGroupChat';
import { clock12, istDay, tokens } from './ui';

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

/** What a reply shows of the message it answers. */
type Quote =
  | { state: 'ok'; id: number; mine: boolean; name: string; body: string; onScreen: boolean }
  | { state: 'deleted'; id: number; mine: boolean; name: string; onScreen: boolean }
  | { state: 'missing' };

/** One chip under a bubble: an emoji, how many, whether it is yours, and who. */
interface ReactionGroup { emoji: string; count: number; mine: boolean; names: string[] }

const nameList = (names: string[]): string =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

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
  const [selected, setSelected] = useState<number | null>(null);
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
    return resolveQuote(id, byId, chat.quotes, userId, nameOf);
  }, [byId, chat.quotes, userId, nameOf]);

  const reactionsFor = useCallback(
    (messageId: number): ReactionGroup[] => groupReactions(chat.reactions, chat.pending, messageId, userId, nameOf),
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

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || chat.loading) return;
    const firstId = chat.messages[0]?.id ?? null;
    const lastMsg = chat.messages[chat.messages.length - 1];
    const lastId = lastMsg?.id ?? null;
    const outLen = chat.outbox.length;

    if (initialRef.current) {
      initialRef.current = false;
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
    setSelected(null);
    textareaRef.current?.focus();
  }, []);

  /* Tapping a quote goes to the original, if it is loaded, and flashes it so
     the eye lands on the right bubble. Scrolling up there clears "stick to
     bottom" through the normal onScroll path. */
  const flashTimer = useRef<number | undefined>(undefined);
  const jumpTo = useCallback((id: number) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-msg-id="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFlash(id);
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
                  <div className={`h-10 rounded-lg animate-pulse ${dark ? 'bg-white/[0.03]' : 'bg-[#F2F0EC]'}`} style={{ width: `${w}%` }} />
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
                      <div className={`flex-1 h-px ${dark ? 'bg-white/[0.06]' : 'bg-[#E3E0D9]'}`} />
                      <span className={`text-[9px] font-black uppercase tracking-[0.14em] font-ui ${t.muted}`}>{item.label}</span>
                      <div className={`flex-1 h-px ${dark ? 'bg-white/[0.06]' : 'bg-[#E3E0D9]'}`} />
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
                return (
                  <MessageBubble
                    key={item.key}
                    msg={msg}
                    mine={mine}
                    first={first}
                    profile={profiles[msg.sender_id]}
                    selected={selected === msg.id}
                    flash={flash === msg.id}
                    extras={chat.extras}
                    quote={quoteFor(msg.reply_to)}
                    reactions={chat.extras ? reactionsFor(msg.id) : []}
                    reactionBusy={chat.pending[msg.id] !== undefined}
                    canDelete={!msg.deleted_at && (mine || canModerate)}
                    onSelect={() => setSelected(s => (s === msg.id ? null : msg.id))}
                    onReact={emoji => toggleReaction(msg.id, emoji)}
                    onDoubleTap={() => { setSelected(null); toggleReaction(msg.id, QUICK_REACTION); }}
                    onReply={() => startReply(msg.id)}
                    onJump={jumpTo}
                    onDelete={() => {
                      const who = mine ? 'your message' : 'this message for everyone';
                      if (window.confirm(`Delete ${who}? This can’t be undone.`)) {
                        setSelected(null);
                        void chat.remove(msg.id);
                      }
                    }}
                    onOpenProfile={onOpenProfile}
                    theme={theme}
                  />
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
          className={`flex-1 min-w-0 resize-none px-3.5 py-2.5 rounded-lg border text-sm font-ui leading-snug outline-none transition-colors focus:border-[#E10600] ${dark ? 'bg-[#0D0D10] border-white/[0.08] text-white placeholder:text-zinc-700' : 'bg-[#F2F0EC] border-[#E3E0D9] text-[#17150F] placeholder:text-[#B5AFA0]'}`}
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

/* ── Pure helpers for the view ── */

const resolveQuote = (
  id: number,
  byId: Map<number, GroupMessage>,
  quotes: QuoteMap,
  userId: string,
  nameOf: (id: string) => string
): Quote => {
  const onScreen = byId.get(id);
  const q = onScreen ?? quotes[id];
  if (!q) return { state: 'missing' };
  const mine = q.sender_id === userId;
  const name = nameOf(q.sender_id);
  if (q.deleted_at) return { state: 'deleted', id, mine, name, onScreen: !!onScreen };
  return { state: 'ok', id, mine, name, body: q.body, onScreen: !!onScreen };
};

/* Chips in the order of the picker, so a message's reactions do not reshuffle
   every time somebody adds one. An in-flight change of yours is drawn as if
   it had landed. */
const groupReactions = (
  reactions: ReactionMap,
  pending: Record<number, string | null>,
  messageId: number,
  userId: string,
  nameOf: (id: string) => string
): ReactionGroup[] => {
  const byUser = reactions[messageId] ?? {};
  const picks: Array<[string, string]> = [];
  Object.entries(byUser).forEach(([uid, r]) => {
    if (uid !== userId && r.emoji) picks.push([uid, r.emoji]);
  });
  const mineNow = pending[messageId] !== undefined ? pending[messageId] : byUser[userId]?.emoji ?? null;
  if (mineNow) picks.push([userId, mineNow]);
  if (!picks.length) return [];

  const order = (REACTIONS as readonly string[]);
  const groups = new Map<string, ReactionGroup>();
  picks.forEach(([uid, emoji]) => {
    const g = groups.get(emoji) ?? { emoji, count: 0, mine: false, names: [] };
    g.count += 1;
    if (uid === userId) g.mine = true;
    else g.names.push(nameOf(uid));
    groups.set(emoji, g);
  });
  groups.forEach(g => { if (g.mine) g.names.push('You'); });
  return Array.from(groups.values()).sort((a, b) => order.indexOf(a.emoji) - order.indexOf(b.emoji));
};

const SWIPE_TRIGGER_PX = 56;
const SWIPE_MAX_PX = 80;
const DOUBLE_TAP_MS = 300;

/* ── Pieces ── */

const QuoteBlock: React.FC<{
  quote: Quote;
  dark: boolean;
  label?: string;
  onJump?: (id: number) => void;
}> = ({ quote, dark, label, onJump }) => {
  const t = tokens(dark);
  const mine = quote.state !== 'missing' && quote.mine;
  const rail = mine ? 'border-[#E10600]/60' : dark ? 'border-zinc-500' : 'border-[#8A8577]';
  const fill = dark ? 'bg-white/[0.04]' : 'bg-black/[0.04]';
  const jumpable = !!onJump && quote.state !== 'missing' && quote.onScreen;
  const who = quote.state === 'missing' ? '' : label && quote.mine ? 'yourself' : quote.name;
  const heading = [label, who].filter(Boolean).join(' ');
  const inner = (
    <>
      {heading && (
        <span className={`block text-[10px] font-bold font-ui truncate ${mine ? 'text-[#E10600]' : t.heading}`}>{heading}</span>
      )}
      {quote.state === 'ok' && (
        <span className={`block text-[11px] font-ui truncate ${t.muted}`}>{quote.body.replace(/\s+/g, ' ')}</span>
      )}
      {quote.state === 'deleted' && <span className={`block text-[11px] font-ui italic ${t.muted}`}>Message deleted</span>}
      {quote.state === 'missing' && <span className={`block text-[11px] font-ui italic ${t.muted}`}>Original message unavailable</span>}
    </>
  );
  const cls = `block w-full text-left min-w-0 pl-2.5 pr-3 py-1.5 rounded-md border-l-2 ${rail} ${fill}`;
  if (!jumpable) return <div className={cls}>{inner}</div>;
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onJump!(quote.id); }}
      className={`${cls} hover:opacity-80`}
      aria-label={`Go to the message from ${quote.name}`}
    >
      {inner}
    </button>
  );
};

const ReactionChips: React.FC<{
  groups: ReactionGroup[];
  mine: boolean;
  busy: boolean;
  dark: boolean;
  onReact: (emoji: string) => void;
}> = ({ groups, mine, busy, dark, onReact }) => {
  const t = tokens(dark);
  if (!groups.length) return null;
  return (
    <div className={`flex flex-wrap gap-1 -mt-2 px-2 relative ${mine ? 'justify-end' : 'justify-start'}`}>
      {groups.map(g => (
        <button
          key={g.emoji}
          type="button"
          disabled={busy}
          onClick={() => onReact(g.emoji)}
          title={nameList(g.names)}
          aria-label={`${g.emoji} ${g.count}: ${nameList(g.names)}. ${g.mine ? 'Tap to remove yours.' : 'Tap to react with this.'}`}
          aria-pressed={g.mine}
          className={`h-6 px-1.5 rounded-full border flex items-center gap-1 text-[12px] leading-none shadow-sm transition-transform active:scale-[0.94] ${
            g.mine
              ? 'border-[#E10600]/50 bg-[#E10600]/15'
              : dark ? 'border-white/[0.08] bg-[#17171B]' : 'border-[#E3E0D9] bg-white'
          } ${busy ? 'opacity-70' : ''}`}
        >
          <span aria-hidden="true">{g.emoji}</span>
          {g.count > 1 && <span className={`text-[10px] font-bold font-ui ${g.mine ? 'text-[#E10600]' : t.muted}`}>{g.count}</span>}
        </button>
      ))}
    </div>
  );
};

const MessageBubble: React.FC<{
  msg: GroupMessage;
  mine: boolean;
  first: boolean;
  profile: ProfileSummary | undefined;
  selected: boolean;
  flash: boolean;
  extras: boolean;
  quote: Quote | null;
  reactions: ReactionGroup[];
  reactionBusy: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onReact: (emoji: string) => void;
  onDoubleTap: () => void;
  onReply: () => void;
  onJump: (id: number) => void;
  onDelete: () => void;
  onOpenProfile: (userId: string) => void;
  theme: 'dark' | 'light';
}> = ({
  msg, mine, first, profile, selected, flash, extras, quote, reactions, reactionBusy, canDelete,
  onSelect, onReact, onDoubleTap, onReply, onJump, onDelete, onOpenProfile, theme,
}) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const deleted = !!msg.deleted_at;
  const interactive = extras && !deleted;
  const bubble = mine
    ? 'bg-[#E10600]/10 border-[#E10600]/25'
    : dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-[#F2F0EC] border-[#E3E0D9]';
  const myEmoji = reactions.find(g => g.mine)?.emoji ?? null;

  /* Double tap = ❤️, as on Instagram. The first tap still opens the actions
     immediately — waiting 300ms to find out whether a second is coming would
     make every single tap feel broken. */
  const swipeRef = useRef<{ x: number; y: number; id: number; active: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const [dx, setDx] = useState(0);
  const lastTapRef = useRef(0);
  const handleTap = () => {
    if (suppressClickRef.current) { suppressClickRef.current = false; return; }
    const now = Date.now();
    if (interactive && now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0;
      onDoubleTap();
      return;
    }
    lastTapRef.current = now;
    onSelect();
  };

  /* Swipe right to reply, as in WhatsApp — touch only; a mouse has the Reply
     button. `touch-action: pan-y` leaves vertical scrolling to the browser
     (which cancels the pointer the moment it starts panning) and hands the
     horizontal movement to us. Geometry is local state on this one bubble. */
  const endSwipe = (commit: boolean) => {
    const s = swipeRef.current;
    swipeRef.current = null;
    if (s?.active) {
      suppressClickRef.current = true;
      if (commit && dx >= SWIPE_TRIGGER_PX) onReply();
    }
    setDx(0);
  };

  return (
    <div
      data-msg-id={msg.id}
      className={`flex ${mine ? 'justify-end' : 'justify-start'} ${first ? 'mt-3' : 'mt-1'} ${reactions.length ? 'mb-2' : ''}`}
    >
      <div className={`max-w-[85%] md:max-w-[70%] min-w-0 flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
        {first && !mine && (
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
        )}
        {first && mine && <span className={`text-[9px] font-ui mb-1 px-1 ${t.muted}`}>{clock12(msg.created_at)}</span>}

        <div className="relative max-w-full">
          {dx > 0 && (
            <span
              aria-hidden="true"
              className={`absolute top-1/2 -translate-y-1/2 text-sm ${dx >= SWIPE_TRIGGER_PX ? 'text-[#E10600]' : t.muted}`}
              style={{ left: -26, opacity: Math.min(1, dx / SWIPE_TRIGGER_PX) }}
            >
              ↩
            </span>
          )}
          <div
            role="button"
            tabIndex={deleted ? -1 : 0}
            aria-disabled={deleted || undefined}
            aria-expanded={!deleted ? selected : undefined}
            onClick={deleted ? undefined : handleTap}
            // A double click would also select a word; drag-to-select still works.
            onMouseDown={e => { if (interactive && e.detail > 1) e.preventDefault(); }}
            onKeyDown={e => {
              if (deleted || (e.key !== 'Enter' && e.key !== ' ')) return;
              if (e.target !== e.currentTarget) return;
              e.preventDefault();
              onSelect();
            }}
            onPointerDown={e => {
              if (!interactive || e.pointerType !== 'touch') return;
              swipeRef.current = { x: e.clientX, y: e.clientY, id: e.pointerId, active: false };
            }}
            onPointerMove={e => {
              const s = swipeRef.current;
              if (!s || e.pointerId !== s.id) return;
              const mx = e.clientX - s.x;
              const my = e.clientY - s.y;
              if (!s.active) {
                if (Math.abs(my) > 10 || mx < -10) { swipeRef.current = null; return; }
                if (mx < 12) return;
                s.active = true;
              }
              setDx(Math.max(0, Math.min(mx - 12, SWIPE_MAX_PX)));
            }}
            onPointerUp={() => endSwipe(true)}
            onPointerCancel={() => endSwipe(false)}
            className={`text-left px-3.5 py-2 rounded-lg border outline-none focus-visible:ring-2 focus-visible:ring-[#E10600]/40 ${bubble} ${deleted ? 'opacity-60' : 'cursor-pointer'} ${flash ? 'ring-2 ring-[#E10600]/50' : ''}`}
            style={{
              transform: dx ? `translateX(${dx}px)` : undefined,
              transition: dx ? 'none' : 'transform 160ms ease-out, box-shadow 300ms',
              touchAction: interactive ? 'pan-y' : undefined,
            }}
            aria-label={deleted ? 'Deleted message' : undefined}
            title={clock12(msg.created_at)}
          >
            {quote && !deleted && (
              <div className="mb-1.5 -mx-1">
                <QuoteBlock quote={quote} dark={dark} onJump={onJump} />
              </div>
            )}
            {deleted ? (
              <span className={`text-[12px] font-ui italic ${t.muted}`}>Message deleted</span>
            ) : (
              <span className={`block text-[13px] font-ui leading-relaxed whitespace-pre-wrap break-words ${t.body}`}>{msg.body}</span>
            )}
          </div>
        </div>

        {!deleted && <ReactionChips groups={reactions} mine={mine} busy={reactionBusy} dark={dark} onReact={onReact} />}

        {selected && !deleted && (
          <div className={`flex flex-col gap-1.5 mt-1.5 ${mine ? 'items-end' : 'items-start'}`}>
            {extras && (
              <div
                role="group"
                aria-label="React"
                className={`flex items-center gap-0.5 p-1 rounded-full border shadow-sm ${dark ? 'bg-[#17171B] border-white/[0.08]' : 'bg-white border-[#E3E0D9]'}`}
              >
                {REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    type="button"
                    disabled={reactionBusy}
                    onClick={() => onReact(emoji)}
                    aria-label={myEmoji === emoji ? `Remove ${emoji}` : `React ${emoji}`}
                    aria-pressed={myEmoji === emoji}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[17px] leading-none transition-transform active:scale-[0.85] hover:scale-110 ${myEmoji === emoji ? 'bg-[#E10600]/15' : ''}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            {reactions.length > 0 && (
              <p className={`text-[10px] font-ui px-1 ${t.muted}`}>
                {reactions.map(g => `${g.emoji} ${nameList(g.names)}`).join(' · ')}
              </p>
            )}
            <div className={`flex items-center gap-3 px-1 text-[9px] font-ui ${t.muted}`}>
              <span>{clock12(msg.created_at)}</span>
              {extras && (
                <button onClick={onReply} className={`font-black uppercase tracking-[0.1em] ${t.heading}`}>Reply</button>
              )}
              {canDelete && (
                <button onClick={onDelete} className="font-black uppercase tracking-[0.1em] text-[#E10600]">Delete</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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
      <div className="max-w-[85%] md:max-w-[70%] min-w-0 flex flex-col items-end">
        <div className={`px-3.5 py-2 rounded-lg border bg-[#E10600]/10 ${failed ? 'border-[#E10600]/60' : 'border-[#E10600]/25 opacity-60'}`}>
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
