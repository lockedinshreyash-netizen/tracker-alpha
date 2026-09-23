import React, { useEffect, useMemo, useRef, useState } from 'react';
import { clockLabel } from './messages';
import { validateMessage } from './chatApi';
import { ChatEntry, useRaceChat } from './useRaceChat';
import { UserChip } from '../profile/Avatar';
import { useProfiles } from '../profile/profileCache';
import { ProfileSummary } from '../profile/profileApi';

/* ── Race Chat ──
   The room for whoever is in today's race right now. Lives inside RanksTab,
   directly under the standings it's talking about — not a tab of its own,
   not a global inbox. Mounted only while the Ranks tab is, so the realtime
   subscription it opens (useRaceChat) exists only while someone could
   actually be watching it arrive. */

interface Props {
  userId: string;
  displayName: string;
  raceDate: string;
  onOpenProfile: (userId: string) => void;
  theme: 'dark' | 'light';
}

/* How far from the bottom still counts as "there" — close enough that a new
   message should just appear, not announce itself. */
const BOTTOM_THRESHOLD = 80;
const MAX_TEXTAREA_PX = 108;

const RaceChat: React.FC<Props> = ({ userId, displayName, raceDate, onOpenProfile, theme }) => {
  const dark = theme === 'dark';
  const muted = dark ? 'text-zinc-500' : 'text-[#8A8577]';
  const heading = dark ? 'text-white' : 'text-[#17150F]';
  const card = dark ? 'bg-[#111114] border-white/[0.06]' : 'bg-white border-[#E3E0D9]';

  const chat = useRaceChat({ userId, displayName, raceDate, enabled: true });
  const [draft, setDraft] = useState('');
  /* Local and unpersisted, same stance Today's own collapsed session history
     takes — a disclosure preference isn't data, and putting it in AppState
     would fire a Supabase upsert every time somebody folded the panel. */
  const [collapsed, setCollapsed] = useState(false);

  /* Only other senders ever show a name+avatar (see ChatBubble) — no point batching my own id in. */
  const senderIds = useMemo(
    () => Array.from(new Set(chat.messages.filter(m => m.user_id !== userId).map(m => m.user_id))),
    [chat.messages, userId]
  );
  const profiles = useProfiles(senderIds);

  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [nearBottom, setNearBottom] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const prevLenRef = useRef(0);
  const didInitialScrollRef = useRef(false);

  /* Reset the "already scrolled once" flag when the race itself changes —
     4 AM rollover, or reopening the tab on a new day — so the fresh room's
     first batch jumps to bottom the same way the very first load did. */
  useEffect(() => {
    didInitialScrollRef.current = false;
    prevLenRef.current = 0;
    setNewCount(0);
    setNearBottom(true);
  }, [raceDate]);

  useEffect(() => {
    if (chat.loading) return;
    const el = listRef.current;
    if (!el) return;

    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      prevLenRef.current = chat.messages.length;
      el.scrollTop = el.scrollHeight;
      return;
    }

    if (chat.messages.length <= prevLenRef.current) {
      prevLenRef.current = chat.messages.length;
      return;
    }
    prevLenRef.current = chat.messages.length;

    if (nearBottom) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    } else {
      setNewCount(c => c + 1);
    }
  }, [chat.messages.length, chat.loading, nearBottom]);

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
    setDraft('');
    await chat.send(text);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void handleSend();
  };

  return (
    <section className={`rounded-xl border overflow-hidden ${card}`}>
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        className="w-full flex items-center justify-between gap-4 px-5 pt-5 pb-3"
      >
        <h3 className={`text-[9px] font-black uppercase tracking-[0.18em] font-ui ${muted}`}>
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
              className="h-[320px] md:h-[380px] overflow-y-auto px-5 py-2 space-y-2.5"
            >
              {!chat.loading && chat.messages.length === 0 && (
                <div className="h-full flex items-center justify-center">
                  <p className={`text-[11px] font-ui italic text-center px-6 ${muted}`}>
                    Nobody's said anything yet. Be the first.
                  </p>
                </div>
              )}

              {chat.messages.map(msg => (
                <ChatBubble
                  key={msg.id}
                  msg={msg}
                  isMe={msg.user_id === userId}
                  profile={profiles[msg.user_id]}
                  onOpenProfile={onOpenProfile}
                  dark={dark}
                  muted={muted}
                  heading={heading}
                  theme={theme}
                  onDismiss={chat.dismiss}
                />
              ))}
            </div>

            {newCount > 0 && (
              <button
                onClick={scrollToBottom}
                className="absolute left-1/2 -translate-x-1/2 bottom-3 px-3.5 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.08em] font-ui bg-[#E10600] text-white shadow-lg active:scale-[0.97] transition-transform"
              >
                {newCount} new {newCount === 1 ? 'message' : 'messages'} ↓
              </button>
            )}
          </div>

          {chat.error && (
            <p className={`text-[9px] font-ui text-center px-5 pt-2 ${muted}`}>{chat.error}</p>
          )}

          <div className={`flex items-end gap-2.5 p-3.5 border-t ${dark ? 'border-white/[0.06]' : 'border-[#E3E0D9]'}`}>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => window.setTimeout(() => textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 250)}
              maxLength={chat.maxLength}
              rows={1}
              placeholder="Write a message…"
              className={`flex-1 min-w-0 resize-none px-3.5 py-2.5 rounded-lg border text-sm font-ui leading-snug outline-none transition-colors focus:border-[#E10600] ${dark ? 'bg-[#0D0D10] border-white/[0.08] text-white placeholder:text-zinc-700' : 'bg-[#F2F0EC] border-[#E3E0D9] text-[#17150F] placeholder:text-[#B5AFA0]'}`}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!canSend}
              aria-label="Send message"
              className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-black transition-all active:scale-[0.96] ${canSend
                ? 'bg-[#E10600] text-white hover:bg-red-700'
                : dark ? 'bg-zinc-900 text-zinc-700 cursor-not-allowed' : 'bg-[#E3E0D9] text-[#B5AFA0] cursor-not-allowed'}`}
            >
              <span aria-hidden="true">➤</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
};

const ChatBubble: React.FC<{
  msg: ChatEntry;
  isMe: boolean;
  profile: ProfileSummary | undefined;
  onOpenProfile: (userId: string) => void;
  dark: boolean;
  muted: string;
  heading: string;
  theme: 'dark' | 'light';
  onDismiss: (id: string) => void;
}> = ({ msg, isMe, profile, onOpenProfile, dark, muted, heading, theme, onDismiss }) => {
  const bubble = isMe
    ? 'bg-[#E10600]/10 border-[#E10600]/25'
    : dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-[#F2F0EC] border-[#E3E0D9]';

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] md:max-w-[70%] min-w-0 px-3.5 py-2.5 rounded-lg border ${bubble}`}>
        {!isMe && (
          <UserChip
            userId={msg.user_id}
            name={msg.display_name}
            profile={profile}
            onOpen={onOpenProfile}
            theme={theme}
            size={20}
            className="mb-1"
            nameClassName={`truncate text-[10px] font-bold font-ui ${heading}`}
          />
        )}
        <p className={`text-[13px] font-ui leading-relaxed whitespace-pre-wrap break-words ${dark ? 'text-zinc-200' : 'text-[#17150F]'} ${msg.pending ? 'opacity-50' : ''}`}>
          {msg.message}
        </p>
        <p className={`text-[9px] font-ui mt-1 ${isMe ? 'text-right' : ''} ${muted}`}>
          {msg.failed ? (
            <button onClick={() => onDismiss(msg.id)} className="text-[#E10600] font-bold">
              Not sent · Remove
            </button>
          ) : msg.pending ? (
            'Sending…'
          ) : (
            clockLabel(new Date(msg.created_at).getTime())
          )}
        </p>
      </div>
    </div>
  );
};

export default RaceChat;
