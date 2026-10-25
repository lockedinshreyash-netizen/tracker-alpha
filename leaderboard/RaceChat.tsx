import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { clockLabel } from './messages';
import { validateMessage } from './chatApi';
import { ChatEntry, useRaceChat } from './useRaceChat';
import { UserChip } from '../profile/Avatar';
import { useProfiles } from '../profile/profileCache';
import { ProfileSummary } from '../profile/profileApi';
import ChatMessage from '../chat/ChatMessage';
import QuoteBlock, { Quote, resolveQuote } from '../chat/QuoteBlock';
import { groupReactions, stamp } from '../chat/reactions';

/* ── Race Chat ──
   The room for whoever is in today's race right now. Lives inside RanksTab,
   directly under the standings it's talking about — not a tab of its own,
   not a global inbox. Mounted only while the Ranks tab is, so the realtime
   subscription it opens (useRaceChat) exists only while someone could
   actually be watching it arrive.

   Replies and reactions work as in group chat, through the same bubble
   (chat/ChatMessage.tsx): swipe right to reply, long press for reactions and
   Reply · Copy · Delete, double-tap for ❤️, ↩ 😊 ⋯ beside a bubble on hover.
   You can delete your own messages; app staff can delete anyone's. */

interface Props {
  userId: string;
  displayName: string;
  raceDate: string;
  onOpenProfile: (userId: string) => void;
  /** App staff: may delete anyone's message. The server checks again. */
  isStaff?: boolean;
  theme: 'dark' | 'light';
}

/* How far from the bottom still counts as "there" — close enough that a new
   message should just appear, not announce itself. */
const BOTTOM_THRESHOLD = 80;
const MAX_TEXTAREA_PX = 108;
/* Consecutive messages from one sender within this window share a header. */
const RUN_GAP_MS = 5 * 60_000;

const timeOf = (iso: string) => clockLabel(stamp(iso) || Date.now());

const RaceChat = ({ userId, displayName, raceDate, onOpenProfile, isStaff = false, theme }: Props) => {
  const dark = theme === 'dark';
  const muted = 'text-zinc-500';
  const card = dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-zinc-100 shadow-sm';
  const rule = dark ? 'border-white/[0.06]' : 'border-zinc-200';

  const chat = useRaceChat({ userId, displayName, raceDate, enabled: true });
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  /* Local and unpersisted, same stance Today's own collapsed session history
     takes — a disclosure preference isn't data, and putting it in AppState
     would fire a Supabase upsert every time somebody folded the panel. */
  const [collapsed, setCollapsed] = useState(false);

  /* Everyone whose name or face might be drawn: other senders and people who
     reacted. My own id is never batched in. */
  const senderIds = useMemo(() => {
    const ids = new Set<string>();
    chat.messages.forEach(m => ids.add(m.user_id));
    Object.values(chat.reactions).forEach(byUser => Object.keys(byUser).forEach(id => ids.add(id)));
    ids.delete(userId);
    return Array.from(ids);
  }, [chat.messages, chat.reactions, userId]);
  const profiles = useProfiles(senderIds);

  /* A message carries the name it was sent under; reactors are named by profile. */
  const sentNames = useMemo(() => {
    const names: Record<string, string> = {};
    chat.messages.forEach(m => { names[m.user_id] = m.display_name; });
    return names;
  }, [chat.messages]);
  const nameOf = useCallback(
    (id: string) => (id === userId ? 'You' : profiles[id]?.display_name ?? sentNames[id] ?? 'Racer'),
    [profiles, sentNames, userId]
  );

  const byId = useMemo(() => new Map(chat.messages.map(m => [m.id, m])), [chat.messages]);
  const quoteFor = useCallback((id: string | null | undefined): Quote | null => {
    if (!id) return null;
    const onScreen = byId.get(id);
    const q = onScreen ?? chat.quotes[id];
    return resolveQuote(
      id,
      q && { senderId: q.user_id, body: q.message, deleted: !!q.deleted_at, name: q.user_id === userId ? 'You' : q.display_name },
      !!onScreen,
      userId
    );
  }, [byId, chat.quotes, userId]);

  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [nearBottom, setNearBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const prevLenRef = useRef(0);
  const didInitialScrollRef = useRef(false);
  /* Ids on screen when the room first drew. Anything else rose in while the
     reader watched, and is the only thing that animates. */
  const settledRef = useRef<Set<string> | null>(null);

  /* Reset the "already scrolled once" flag when the race itself changes —
     4 AM rollover, or reopening the tab on a new day — so the fresh room's
     first batch jumps to bottom the same way the very first load did. */
  useEffect(() => {
    didInitialScrollRef.current = false;
    settledRef.current = null;
    prevLenRef.current = 0;
    setNewCount(0);
    setNearBottom(true);
    setReplyTo(null);
  }, [raceDate]);

  useLayoutEffect(() => {
    if (chat.loading) return;
    const el = listRef.current;
    if (!el) return;

    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      settledRef.current = new Set(chat.messages.map(m => m.id));
      prevLenRef.current = chat.messages.length;
      el.scrollTop = el.scrollHeight;
      return;
    }

    if (chat.messages.length <= prevLenRef.current) {
      prevLenRef.current = chat.messages.length;
      return;
    }
    prevLenRef.current = chat.messages.length;

    const last = chat.messages[chat.messages.length - 1];
    if (nearBottom || last?.user_id === userId) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      setNewCount(c => c + 1);
    }
  }, [chat.messages, chat.loading, nearBottom, userId]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [draft]);

  /* The list unmounts while collapsed, so the scroll-tracking effect above
     can't see messages that arrived in the meantime. Re-opening jumps
     straight to the bottom and resyncs its counters rather than replaying
     whatever built up as one fake "new message" burst. */
  useEffect(() => {
    if (collapsed) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    prevLenRef.current = chat.messages.length;
    setNewCount(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setNewCount(0);
    setNearBottom(true);
  };

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distance < BOTTOM_THRESHOLD;
    setNearBottom(atBottom);
    if (atBottom) setNewCount(0);
  };

  const canSend = Boolean(validateMessage(draft)) && !chat.sending;

  const handleSend = async () => {
    const text = draft;
    if (!validateMessage(text) || chat.sending) return;
    const answering = replyTo;
    setDraft('');
    setReplyTo(null);
    await chat.send(text, answering);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape' && replyTo) { e.preventDefault(); setReplyTo(null); return; }
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void handleSend();
  };

  const startReply = useCallback((id: string) => {
    setReplyTo(id);
    textareaRef.current?.focus({ preventScroll: true });
  }, []);

  /* Tapping a quote goes to the original and flashes it so the eye lands on
     the right bubble. */
  const flashTimer = useRef<number | undefined>(undefined);
  const jumpTo = useCallback((id: string | number) => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-msg-id="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFlash(String(id));
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1600);
  }, []);
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  /* Mine: tap the same emoji to take it back, another to switch — one
     reaction per person, as in WhatsApp. */
  const { pending, reactions, react } = chat;
  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    const current = pending[messageId] !== undefined ? pending[messageId] : reactions[messageId]?.[userId]?.emoji ?? null;
    react(messageId, current === emoji ? null : emoji);
  }, [pending, reactions, react, userId]);

  const replyQuote = quoteFor(replyTo);

  return (
    <section className={`rounded-xl border overflow-hidden ${card}`}>
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        className="w-full flex items-center justify-between gap-4 px-5 pt-5 pb-3"
      >
        <h3 className={`text-[10px] font-bold uppercase tracking-[0.06em] font-ui ${muted}`}>
          Race chat
        </h3>
        <span className="flex items-center gap-2">
          <span className={`text-[9px] font-ui ${muted}`}>
            {collapsed
              ? (chat.messages.length ? `${chat.messages.length} message${chat.messages.length === 1 ? '' : 's'}` : 'Minimized')
              : (chat.loading ? 'Loading…' : 'Live')}
          </span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
            className={`${muted} transition-transform ${collapsed ? '-rotate-90' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {!collapsed && (
        <>
          <div className="relative">
            <div
              ref={listRef}
              onScroll={onScroll}
              className="h-[320px] md:h-[380px] overflow-y-auto overflow-x-hidden px-5 py-2"
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              aria-label="Race chat messages"
            >
              {!chat.loading && chat.messages.length === 0 && (
                <div className="h-full flex items-center justify-center">
                  <p className={`text-[11px] font-ui italic text-center px-6 ${muted}`}>
                    Nobody's said anything yet. Be the first.
                  </p>
                </div>
              )}

              {chat.messages.map((msg, i) => {
                const prev = chat.messages[i - 1];
                const first = !prev || prev.user_id !== msg.user_id
                  || stamp(msg.created_at) - stamp(prev.created_at) > RUN_GAP_MS;
                return (
                  <RaceMessage
                    key={msg.id}
                    msg={msg}
                    first={first}
                    isMe={msg.user_id === userId}
                    isStaff={isStaff}
                    extras={chat.extras}
                    flash={flash === msg.id}
                    animateIn={settledRef.current !== null && !settledRef.current.has(msg.id) && msg.user_id !== userId}
                    quote={quoteFor(msg.reply_to)}
                    reactions={groupReactions(reactions[msg.id], pending[msg.id], userId, nameOf)}
                    reactionBusy={pending[msg.id] !== undefined}
                    profile={profiles[msg.user_id]}
                    onOpenProfile={onOpenProfile}
                    onReact={toggleReaction}
                    onReply={startReply}
                    onDelete={chat.remove}
                    onDismiss={chat.dismiss}
                    onJump={jumpTo}
                    theme={theme}
                  />
                );
              })}
            </div>

            {newCount > 0 && (
              <button
                onClick={scrollToBottom}
                className="absolute left-1/2 -translate-x-1/2 bottom-3 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.08em] font-ui bg-[#E10600] text-white shadow-lg active:scale-[0.97] transition-transform chat-pop"
              >
                {newCount} new {newCount === 1 ? 'message' : 'messages'} ↓
              </button>
            )}
          </div>

          {chat.error && (
            <p className={`text-[9px] font-ui text-center px-5 pt-2 ${muted}`}>{chat.error}</p>
          )}

          {replyQuote && (
            <div className={`flex items-center gap-3 px-3.5 pt-2.5 border-t ${rule} chat-in`}>
              <div className="flex-1 min-w-0">
                <QuoteBlock quote={replyQuote} dark={dark} label="Replying to" />
              </div>
              <button
                onClick={() => setReplyTo(null)}
                aria-label="Cancel reply"
                className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm ${muted} ${dark ? 'hover:bg-white/[0.06]' : 'hover:bg-zinc-100'}`}
              >
                ✕
              </button>
            </div>
          )}

          <div className={`flex items-end gap-2.5 p-3.5 ${replyQuote ? '' : `border-t ${rule}`}`}>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => window.setTimeout(() => textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 250)}
              maxLength={chat.maxLength}
              rows={1}
              aria-label="Message the race"
              placeholder={replyQuote ? 'Write your reply…' : 'Write a message…'}
              className={`flex-1 min-w-0 resize-none px-3.5 py-2.5 rounded-2xl border text-sm font-ui leading-snug outline-none transition-colors focus:border-[#E10600] ${dark ? 'bg-[#0D0D10] border-white/[0.08] text-white placeholder:text-zinc-700' : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder:text-zinc-400'}`}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!canSend}
              aria-label="Send message"
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-black transition-all active:scale-[0.9] ${canSend
                ? 'bg-[#E10600] text-white hover:bg-red-700'
                : dark ? 'bg-zinc-900 text-zinc-700 cursor-not-allowed' : 'bg-zinc-200 text-zinc-400 cursor-not-allowed'}`}
            >
              <span aria-hidden="true">➤</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
};

const RaceMessage = ({
  msg, first, isMe, isStaff, extras, flash, animateIn, quote, reactions, reactionBusy, profile,
  onOpenProfile, onReact, onReply, onDelete, onDismiss, onJump, theme,
}: {
  msg: ChatEntry;
  first: boolean;
  isMe: boolean;
  isStaff: boolean;
  extras: boolean;
  flash: boolean;
  animateIn: boolean;
  quote: Quote | null;
  reactions: ReturnType<typeof groupReactions>;
  reactionBusy: boolean;
  profile: ProfileSummary | undefined;
  onOpenProfile: (userId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onReply: (messageId: string) => void;
  onDelete: (messageId: string) => Promise<void>;
  onDismiss: (tempId: string) => void;
  onJump: (id: string | number) => void;
  theme: 'dark' | 'light';
}) => {
  const dark = theme === 'dark';
  const muted = 'text-zinc-500';
  const deleted = !!msg.deleted_at;
  const unsent = !!msg.pending || !!msg.failed;
  const bubble = isMe
    ? `bg-[#E10600]/10 ${msg.failed ? 'border-[#E10600]/60' : 'border-[#E10600]/25'}`
    : dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200';
  const time = timeOf(msg.created_at);

  return (
    <ChatMessage
      id={msg.id}
      mine={isMe}
      dark={dark}
      interactive={extras && !deleted && !unsent}
      canDelete={!deleted && !unsent && (isMe || isStaff)}
      className={first ? 'mt-3' : 'mt-1'}
      bubbleClass={`${bubble} ${deleted ? 'opacity-60' : ''} ${msg.pending ? 'opacity-60' : ''}`}
      flash={flash}
      animateIn={animateIn}
      header={first && !isMe && (
        <div className="flex items-baseline gap-2 mb-1 px-1 max-w-full">
          <UserChip
            userId={msg.user_id}
            name={msg.display_name}
            profile={profile}
            onOpen={onOpenProfile}
            theme={theme}
            size={18}
            nameClassName={`truncate text-[11px] font-bold font-ui ${dark ? 'text-white' : 'text-zinc-900'}`}
          />
          <span className={`text-[9px] font-ui flex-shrink-0 ${muted}`}>{time}</span>
        </div>
      )}
      footer={unsent ? (
        <p className={`text-[9px] font-ui mt-1 px-1 ${muted}`}>
          {msg.failed ? (
            <button onClick={() => onDismiss(msg.id)} className="text-[#E10600] font-bold">
              Not sent · Remove
            </button>
          ) : 'Sending…'}
        </p>
      ) : undefined}
      reactions={deleted ? [] : reactions}
      reactionBusy={reactionBusy}
      timeLabel={time}
      copyText={msg.message}
      ariaLabel={deleted ? 'Deleted message' : undefined}
      onReact={emoji => onReact(msg.id, emoji)}
      onReply={() => onReply(msg.id)}
      onDelete={() => void onDelete(msg.id)}
    >
      {quote && !deleted && (
        <div className="mb-1.5 -mx-1">
          <QuoteBlock quote={quote} dark={dark} onJump={onJump} />
        </div>
      )}
      {deleted ? (
        <span className={`text-[12px] font-ui italic ${muted}`}>Message deleted</span>
      ) : (
        <span className={`block text-[13px] font-ui leading-relaxed whitespace-pre-wrap break-words ${dark ? 'text-zinc-200' : 'text-zinc-900'}`}>
          {msg.message}
          {isMe && !unsent && (
            <span className={`inline-block align-bottom ml-2 text-[9px] leading-[1.9] ${muted}`}>{time}</span>
          )}
        </span>
      )}
    </ChatMessage>
  );
};

export default RaceChat;
