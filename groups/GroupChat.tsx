/* ── Group chat ──
   A view over useGroupChat, which owns every guarantee (no gaps, no
   duplicates, sends that survive a dropped connection). This file owns only
   what a person sees: where the scroll sits, which messages carry a name, and
   what "deleted" looks like.

   Mounted keyed by group id, so switching groups is a fresh subscription and
   a fresh scroll position rather than one group's history flashing under
   another's header. */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { UserChip } from '../profile/Avatar';
import { useProfiles } from '../profile/profileCache';
import { ProfileSummary } from '../profile/profileApi';
import { MyGroup } from './api';
import { GroupMessage, MAX_MESSAGE, validateMessage } from './chatApi';
import { Connection, OutboxEntry, useGroupChat } from './useGroupChat';
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
  const [newCount, setNewCount] = useState(0);
  const canModerate = group.role === 'owner' || group.role === 'admin';

  useEffect(() => {
    const onVis = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const senderIds = useMemo(
    () => Array.from(new Set(chat.messages.map(m => m.sender_id).filter(id => id !== userId))),
    [chat.messages, userId]
  );
  const profiles = useProfiles(senderIds);

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
    chat.send(draft);
    setDraft('');
    nearBottomRef.current = true;
    textareaRef.current?.focus();
  };

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
                  return <OutboxBubble key={item.key} entry={item.entry} dark={dark} onRetry={chat.retry} onDiscard={chat.discard} />;
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
                    canDelete={!msg.deleted_at && (mine || canModerate)}
                    onSelect={() => setSelected(s => (s === msg.id ? null : msg.id))}
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

      <div className={`flex items-end gap-2.5 p-3 border-t ${t.rule}`}>
        <label htmlFor={`chat-input-${group.id}`} className="sr-only">Message {group.name}</label>
        <textarea
          id={`chat-input-${group.id}`}
          ref={textareaRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return;
            e.preventDefault();
            handleSend();
          }}
          maxLength={MAX_MESSAGE}
          rows={1}
          placeholder="Type a message…"
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

const MessageBubble: React.FC<{
  msg: GroupMessage;
  mine: boolean;
  first: boolean;
  profile: ProfileSummary | undefined;
  selected: boolean;
  canDelete: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onOpenProfile: (userId: string) => void;
  theme: 'dark' | 'light';
}> = ({ msg, mine, first, profile, selected, canDelete, onSelect, onDelete, onOpenProfile, theme }) => {
  const dark = theme === 'dark';
  const t = tokens(dark);
  const deleted = !!msg.deleted_at;
  const bubble = mine
    ? 'bg-[#E10600]/10 border-[#E10600]/25'
    : dark ? 'bg-[#0D0D10] border-white/[0.06]' : 'bg-[#F2F0EC] border-[#E3E0D9]';

  return (
    <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${first ? 'mt-3' : 'mt-1'}`}>
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
        <button
          type="button"
          onClick={onSelect}
          disabled={deleted}
          className={`text-left px-3.5 py-2 rounded-lg border ${bubble} ${deleted ? 'opacity-60' : ''}`}
          aria-label={deleted ? 'Deleted message' : undefined}
          title={clock12(msg.created_at)}
        >
          {deleted ? (
            <span className={`text-[12px] font-ui italic ${t.muted}`}>Message deleted</span>
          ) : (
            <span className={`block text-[13px] font-ui leading-relaxed whitespace-pre-wrap break-words ${t.body}`}>{msg.body}</span>
          )}
        </button>
        {selected && !deleted && (
          <div className={`flex items-center gap-3 mt-1 px-1 text-[9px] font-ui ${t.muted}`}>
            <span>{clock12(msg.created_at)}</span>
            {canDelete && (
              <button onClick={onDelete} className="font-black uppercase tracking-[0.1em] text-[#E10600]">Delete</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const OutboxBubble: React.FC<{
  entry: OutboxEntry;
  dark: boolean;
  onRetry: (clientId: string) => void;
  onDiscard: (clientId: string) => void;
}> = ({ entry, dark, onRetry, onDiscard }) => {
  const t = tokens(dark);
  const failed = entry.status === 'failed';
  return (
    <div className="flex justify-end mt-1">
      <div className="max-w-[85%] md:max-w-[70%] min-w-0 flex flex-col items-end">
        <div className={`px-3.5 py-2 rounded-lg border bg-[#E10600]/10 ${failed ? 'border-[#E10600]/60' : 'border-[#E10600]/25 opacity-60'}`}>
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
