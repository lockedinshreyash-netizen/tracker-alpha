/* ── Group chat, wired up ──
   The rule this hook is built around: Realtime is the doorbell, the table is
   the mailbox. Nothing on screen depends on having received every event.

   How that holds together:

   · Every row, from any source — the first fetch, a realtime INSERT or
     UPDATE, the insert response for our own send, an older page — goes
     through one merge keyed by `id`. The merge is order-independent and
     idempotent, so it does not matter which of those arrives first or
     whether one arrives twice. That is what makes the classic
     fetch-then-subscribe gap a non-issue: the channel is opened FIRST, and the
     latest page is fetched on every SUBSCRIBED — the first one and every
     rejoin after a dropped socket. Anything committed before the fetch is in
     the page; anything after is on the stream; the overlap is deduplicated.

   · Catch-up is "fetch the latest page again". Either it overlaps what is on
     screen and merges in, or — a long disconnect in a busy group — it does
     not, and the window is reset to that page with `hasOlder` set, so the
     missing stretch is reachable by scrolling up instead of silently absent.
     It runs on every SUBSCRIBED, on the browser's `online`, when a tab
     returns, and on a slow safety poll, because a phone that slept can hold a
     socket that looks open and delivers nothing.

   · Deletion wins every merge. A stale page fetched before a message was
     deleted cannot resurrect its text over the realtime UPDATE that removed it.

   · A pagination request carries the window's generation. If the window was
     reset while it was in flight, its page is from the far side of a gap and
     is dropped rather than glued on.

   · Sends are optimistic, keyed by a client-generated uuid that the server
     stores under a unique constraint. The same uuid is reused on retry, so a
     send whose response was lost cannot land twice, and the realtime echo of
     our own message is matched to its bubble by that uuid, not by guessing.
     Unsent messages survive a reload in localStorage and retry on reconnect.

   · Reactions follow the same rule with a different key. They are stored per
     (message, person), and every copy — embedded in a page, a realtime event,
     the RPC's own response — carries the server's `updated_at`; the merge
     keeps the newer one, so a page fetched before a change cannot undo it.
     Taking a reaction back is a row with a null emoji, never a missing row,
     so "gone" is something a merge can see rather than infer. While a change
     is in flight its emoji is drawn from `pending`, which only the RPC's
     answer clears — a server timestamp is never compared with this clock.

   · A reply's quote is read from the window when its parent is there, and
     otherwise looked up once by id and cached. Anything that ingests a
     message also refreshes that cache, so deleting the original blanks
     every quote of it. */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  GroupMessage,
  MessagePage,
  PAGE_SIZE,
  QuotedMessage,
  Reaction,
  chatExtrasAvailable,
  deleteMessage,
  fetchLatest,
  fetchOlder,
  fetchQuotes,
  insertMessage,
  newClientId,
  normalize,
  normalizeReaction,
  reactToMessage,
  validateMessage,
} from './chatApi';
import { humanError, markRead } from './api';

export interface OutboxEntry {
  client_id: string;
  body: string;
  created_at: string;
  status: 'sending' | 'failed';
  error?: string;
  /** The message this one answers; travels with the entry so a retry keeps it. */
  reply_to?: number | null;
}

/** message id → user id → that person's reaction. */
export type ReactionMap = Record<number, Record<string, Reaction>>;
/** Quoted parents outside the window. null = looked up, not visible to us. */
export type QuoteMap = Record<number, QuotedMessage | null>;

export type Connection = 'connecting' | 'live' | 'reconnecting' | 'offline';

interface ChatState {
  /* Which group `outbox` belongs to. The save effect checks it, so a render
     that already has the new groupId but still the old state can never write
     one group's unsent messages under another group's key. */
  group: string;
  messages: GroupMessage[];
  outbox: OutboxEntry[];
  hasOlder: boolean;
  /** Bumped whenever the window is reset across a gap. */
  generation: number;
  loaded: boolean;
  reactions: ReactionMap;
  quotes: QuoteMap;
}

type Action =
  | { type: 'reset'; group: string; outbox: OutboxEntry[] }
  | { type: 'latest'; page: MessagePage }
  | { type: 'ingest'; rows: GroupMessage[] }
  | { type: 'older'; page: MessagePage; generation: number }
  | { type: 'reactions'; rows: Reaction[] }
  | { type: 'quotes'; found: QuotedMessage[]; asked: number[] }
  | { type: 'queue'; entry: OutboxEntry }
  | { type: 'outbox'; clientId: string; patch: Partial<OutboxEntry> }
  | { type: 'drop'; clientId: string };

/** Union by id, sorted. A deleted version always beats a live one. */
const merge = (prev: GroupMessage[], rows: GroupMessage[]): GroupMessage[] => {
  if (!rows.length) return prev;
  const byId = new Map<number, GroupMessage>();
  prev.forEach(m => byId.set(m.id, m));
  rows.forEach(r => {
    const existing = byId.get(r.id);
    byId.set(r.id, existing?.deleted_at && !r.deleted_at ? existing : r);
  });
  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
};

/* Compared as instants, not strings: PostgREST and Realtime do not promise
   the same text for one timestamptz ("T" vs space, "+00:00" vs "+00"), and
   Safari's Date.parse accepts only the ISO shape. Millisecond precision is
   plenty — the RPC refuses two changes to one row inside 300ms. */
const stamp = (s: string): number => {
  const t = Date.parse(s.replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1').replace(/([+-]\d\d)$/, '$1:00'));
  return Number.isNaN(t) ? 0 : t;
};

/** Newer `updated_at` wins; a tie goes to the incoming copy. */
const mergeReactions = (prev: ReactionMap, rows: Reaction[]): ReactionMap => {
  if (!rows.length) return prev;
  let next = prev;
  for (const r of rows) {
    const existing = next[r.message_id]?.[r.user_id];
    if (existing) {
      const was = stamp(existing.updated_at);
      const now = stamp(r.updated_at);
      if (was > now || (was === now && existing.emoji === r.emoji)) continue;
    }
    if (next === prev) next = { ...prev };
    next[r.message_id] = { ...next[r.message_id], [r.user_id]: r };
  }
  return next;
};

/* Keep cached quotes in step with any copy of the message that arrives —
   above all its deletion. */
const refreshQuotes = (quotes: QuoteMap, rows: GroupMessage[]): QuoteMap => {
  let next = quotes;
  for (const r of rows) {
    if (!(r.id in quotes)) continue;
    const cached = quotes[r.id];
    if (cached?.deleted_at && !r.deleted_at) continue;
    if (next === quotes) next = { ...quotes };
    next[r.id] = { id: r.id, sender_id: r.sender_id, body: r.body, deleted_at: r.deleted_at };
  }
  return next;
};

const settleOutbox = (outbox: OutboxEntry[], rows: GroupMessage[]): OutboxEntry[] => {
  if (!outbox.length) return outbox;
  const landed = new Set(rows.map(r => r.client_id));
  const next = outbox.filter(o => !landed.has(o.client_id));
  return next.length === outbox.length ? outbox : next;
};

const reducer = (state: ChatState, action: Action): ChatState => {
  switch (action.type) {
    case 'reset':
      return {
        group: action.group, messages: [], outbox: action.outbox, hasOlder: false,
        generation: state.generation + 1, loaded: false, reactions: {}, quotes: {},
      };

    case 'latest': {
      const page = action.page.messages;
      const outbox = settleOutbox(state.outbox, page);
      const reactions = mergeReactions(state.reactions, action.page.reactions);
      const quotes = refreshQuotes(state.quotes, page);
      if (!state.loaded || !state.messages.length) {
        return { ...state, messages: page, outbox, reactions, quotes, hasOlder: page.length === PAGE_SIZE, loaded: true };
      }
      const newest = state.messages[state.messages.length - 1].id;
      const pageOldest = page.length ? page[0].id : Infinity;
      /* A full page that starts after everything on screen may have a hole in
         front of it. Keep only what is newer than the page's start (realtime
         arrivals the fetch raced) and let "load older" walk back into the hole. */
      if (page.length === PAGE_SIZE && pageOldest > newest) {
        return {
          ...state,
          messages: merge(state.messages.filter(m => m.id >= pageOldest), page),
          outbox,
          reactions,
          quotes,
          hasOlder: true,
          generation: state.generation + 1,
          loaded: true,
        };
      }
      return { ...state, messages: merge(state.messages, page), outbox, reactions, quotes, loaded: true };
    }

    case 'ingest':
      return {
        ...state,
        messages: merge(state.messages, action.rows),
        outbox: settleOutbox(state.outbox, action.rows),
        quotes: refreshQuotes(state.quotes, action.rows),
      };

    case 'reactions':
      return { ...state, reactions: mergeReactions(state.reactions, action.rows) };

    case 'quotes': {
      const quotes = { ...state.quotes };
      action.asked.forEach(id => { if (!(id in quotes)) quotes[id] = null; });
      action.found.forEach(q => { quotes[q.id] = q; });
      return { ...state, quotes };
    }

    case 'older':
      if (action.generation !== state.generation) return state;
      return {
        ...state,
        messages: merge(state.messages, action.page.messages),
        outbox: settleOutbox(state.outbox, action.page.messages),
        reactions: mergeReactions(state.reactions, action.page.reactions),
        quotes: refreshQuotes(state.quotes, action.page.messages),
        hasOlder: action.page.messages.length === PAGE_SIZE,
      };

    case 'queue':
      return { ...state, outbox: [...state.outbox, action.entry] };

    case 'outbox':
      return {
        ...state,
        outbox: state.outbox.map(o => (o.client_id === action.clientId ? { ...o, ...action.patch } : o)),
      };

    case 'drop':
      return { ...state, outbox: state.outbox.filter(o => o.client_id !== action.clientId) };
  }
};

/* ── Unsent messages survive a reload ──
   Keyed by user as well as group: on a shared device, the next account to open
   this group must never retry the previous account's words under its own
   name. Sign-out also clears these outright (forgetGroupsOnDevice). */
const outboxKey = (userId: string, groupId: string) => `group_outbox_v1:${userId}:${groupId}`;

const loadOutbox = (userId: string, groupId: string): OutboxEntry[] => {
  try {
    const raw = localStorage.getItem(outboxKey(userId, groupId));
    if (!raw) return [];
    // Whatever was mid-flight when the page closed is, from here, unsent.
    return (JSON.parse(raw) as OutboxEntry[]).map(o => ({ ...o, status: 'failed' as const }));
  } catch {
    return [];
  }
};

const saveOutbox = (userId: string, groupId: string, outbox: OutboxEntry[]): void => {
  try {
    if (outbox.length) localStorage.setItem(outboxKey(userId, groupId), JSON.stringify(outbox));
    else localStorage.removeItem(outboxKey(userId, groupId));
  } catch {
    // Unsent messages simply won't outlive the tab.
  }
};

const SAFETY_SYNC_MS = 60_000;
const HIDDEN_RESYNC_MS = 10_000;
const MARK_READ_DEBOUNCE_MS = 1_200;

export interface GroupChatView {
  messages: GroupMessage[];
  outbox: OutboxEntry[];
  reactions: ReactionMap;
  /** Reactions whose change is in flight: message id → the emoji being set (null = taking it back). */
  pending: Record<number, string | null>;
  quotes: QuoteMap;
  /** False until supabase/groups.sql has been re-run with replies and reactions. */
  extras: boolean;
  loading: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  connection: Connection;
  error: string | null;
  send: (text: string, replyTo?: number | null) => void;
  react: (messageId: number, emoji: string | null) => void;
  retry: (clientId: string) => void;
  discard: (clientId: string) => void;
  remove: (messageId: number) => Promise<void>;
  loadOlder: () => Promise<void>;
}

interface Options {
  groupId: string;
  userId: string;
  /** The chat is on screen; only then do arrivals count as read. */
  active: boolean;
  onRead: (groupId: string) => void;
}

export const useGroupChat = ({ groupId, userId, active, onRead }: Options): GroupChatView => {
  const [state, dispatch] = useReducer(reducer, undefined, (): ChatState => ({
    group: groupId,
    messages: [],
    outbox: loadOutbox(userId, groupId),
    hasOlder: false,
    generation: 0,
    loaded: false,
    reactions: {},
    quotes: {},
  }));
  const [pending, setPending] = useState<Record<number, string | null>>({});
  const [connection, setConnection] = useState<Connection>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const stateRef = useRef(state);
  stateRef.current = state;
  const groupRef = useRef(groupId);
  groupRef.current = groupId;
  const inFlightRef = useRef(new Set<string>());

  useEffect(() => {
    if (state.group === groupId) saveOutbox(userId, groupId, state.outbox);
  }, [userId, groupId, state.group, state.outbox]);

  const sync = useCallback(async () => {
    const gid = groupRef.current;
    try {
      const page = await fetchLatest(gid);
      if (groupRef.current !== gid) return;
      dispatch({ type: 'latest', page });
      setError(null);
    } catch (e) {
      if (groupRef.current !== gid) return;
      setError(humanError(e));
      // An empty, failed first load is still "loaded" — show the error, not a spinner forever.
      if (!stateRef.current.loaded) dispatch({ type: 'latest', page: { messages: [], reactions: [] } });
    }
  }, []);

  /* ── Sending ── */
  const attempt = useCallback(async (entry: OutboxEntry) => {
    const gid = groupRef.current;
    if (inFlightRef.current.has(entry.client_id)) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      dispatch({ type: 'outbox', clientId: entry.client_id, patch: { status: 'failed', error: 'Offline — will retry' } });
      return;
    }
    inFlightRef.current.add(entry.client_id);
    dispatch({ type: 'outbox', clientId: entry.client_id, patch: { status: 'sending', error: undefined } });
    try {
      const row = await insertMessage(gid, userId, entry.client_id, entry.body, entry.reply_to ?? null);
      if (groupRef.current === gid) dispatch({ type: 'ingest', rows: [row] });
    } catch (e) {
      if (groupRef.current === gid) {
        dispatch({ type: 'outbox', clientId: entry.client_id, patch: { status: 'failed', error: humanError(e) } });
      }
    } finally {
      inFlightRef.current.delete(entry.client_id);
    }
  }, [userId]);

  const retryAllFailed = useCallback(() => {
    stateRef.current.outbox.filter(o => o.status === 'failed').forEach(o => { void attempt(o); });
  }, [attempt]);

  /* ── Subscribe first, then fetch on every SUBSCRIBED ── */
  useEffect(() => {
    dispatch({ type: 'reset', group: groupId, outbox: loadOutbox(userId, groupId) });
    setPending({});
    setError(null);
    setConnection(navigator.onLine === false ? 'offline' : 'connecting');
    let alive = true;
    let firstSync = true;

    const ingest = (payload: { new: unknown }) => {
      const row = payload.new as GroupMessage;
      if (!row || row.group_id !== groupId) return;
      dispatch({ type: 'ingest', rows: [normalize(row)] });
    };

    const ingestReaction = (payload: { new: unknown }) => {
      const row = payload.new as Reaction & { group_id?: string };
      if (!row || row.group_id !== groupId) return;
      dispatch({ type: 'reactions', rows: [normalizeReaction(row)] });
    };

    const channel = supabase
      .channel(`group_chat_${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, ingest)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, ingest)
      /* INSERT and UPDATE only. A reaction is never deleted while its message
         exists (see supabase/groups.sql), and Realtime cannot filter DELETEs. */
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_message_reactions', filter: `group_id=eq.${groupId}` }, ingestReaction)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_message_reactions', filter: `group_id=eq.${groupId}` }, ingestReaction)
      .subscribe(status => {
        if (!alive) return;
        if (status === 'SUBSCRIBED') {
          setConnection('live');
          void sync().then(() => {
            // Anything left unsent by a previous visit gets its retry once history is in.
            if (firstSync && alive) { firstSync = false; retryAllFailed(); }
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setConnection(navigator.onLine === false ? 'offline' : 'reconnecting');
          /* History must not wait on the socket. If realtime is down or
             blocked entirely, the thread still loads and the safety poll
             below keeps it moving. */
          if (!stateRef.current.loaded) void sync();
        }
      });

    // If the socket never answers at all (a proxy eating websockets), don't hold the thread hostage.
    const fallback = window.setTimeout(() => { if (alive && !stateRef.current.loaded) void sync(); }, 4_000);

    return () => {
      alive = false;
      window.clearTimeout(fallback);
      void supabase.removeChannel(channel);
    };
  }, [groupId, userId, sync, retryAllFailed]);

  /* ── Catch-up triggers ── */
  useEffect(() => {
    let hiddenAt = 0;
    const onOnline = () => {
      setConnection(c => (c === 'offline' ? 'reconnecting' : c));
      void sync();
      retryAllFailed();
    };
    const onOffline = () => setConnection('offline');
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > HIDDEN_RESYNC_MS) void sync();
    };
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine !== false) void sync();
    }, SAFETY_SYNC_MS);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [sync, retryAllFailed]);

  /* ── Read marker ── the newest id on screen, while the chat is actually visible. */
  const newestId = state.messages.length ? state.messages[state.messages.length - 1].id : 0;
  const markedRef = useRef(0);
  const onReadRef = useRef(onRead);
  onReadRef.current = onRead;
  useEffect(() => { markedRef.current = 0; }, [groupId]);
  useEffect(() => {
    if (!active || !newestId || newestId <= markedRef.current) return;
    const gid = groupId;
    const t = window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return;
      markedRef.current = newestId;
      onReadRef.current(gid);
      void markRead(gid, newestId).catch(() => { markedRef.current = 0; });
    }, MARK_READ_DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [active, newestId, groupId]);

  /* ── Quotes outside the window ── each id is asked for once per group. */
  const askedRef = useRef(new Set<number>());
  useEffect(() => { askedRef.current = new Set(); }, [groupId]);
  useEffect(() => {
    const onScreen = new Set(state.messages.map(m => m.id));
    const missing = new Set<number>();
    const consider = (id: number | null | undefined) => {
      if (id && !onScreen.has(id) && !(id in state.quotes) && !askedRef.current.has(id)) missing.add(id);
    };
    state.messages.forEach(m => consider(m.reply_to));
    state.outbox.forEach(o => consider(o.reply_to));
    if (!missing.size) return;
    const ids = Array.from(missing);
    ids.forEach(id => askedRef.current.add(id));
    const gid = groupId;
    fetchQuotes(ids)
      .then(found => { if (groupRef.current === gid) dispatch({ type: 'quotes', found, asked: ids }); })
      // Asked again on the next change, rather than never.
      .catch(() => ids.forEach(id => askedRef.current.delete(id)));
  }, [state.messages, state.outbox, state.quotes, groupId]);

  const send = useCallback((text: string, replyTo: number | null = null) => {
    const body = validateMessage(text);
    if (!body) return;
    const entry: OutboxEntry = {
      client_id: newClientId(),
      body,
      created_at: new Date().toISOString(),
      status: 'sending',
      ...(replyTo ? { reply_to: replyTo } : {}),
    };
    dispatch({ type: 'queue', entry });
    void attempt(entry);
  }, [attempt]);

  const retry = useCallback((clientId: string) => {
    const entry = stateRef.current.outbox.find(o => o.client_id === clientId);
    if (entry) void attempt(entry);
  }, [attempt]);

  const discard = useCallback((clientId: string) => dispatch({ type: 'drop', clientId }), []);

  const remove = useCallback(async (messageId: number) => {
    const msg = stateRef.current.messages.find(m => m.id === messageId);
    if (!msg) return;
    try {
      await deleteMessage(messageId);
      dispatch({ type: 'ingest', rows: [{ ...msg, body: '', deleted_at: new Date().toISOString() }] });
    } catch (e) {
      setError(humanError(e));
    }
  }, []);

  // A ref, not `pending`: two taps inside one render must not both get through.
  const reactingRef = useRef(new Set<number>());
  const react = useCallback((messageId: number, emoji: string | null) => {
    // One change per message at a time; the chip is held until it answers.
    if (reactingRef.current.has(messageId)) return;
    reactingRef.current.add(messageId);
    const gid = groupRef.current;
    setPending(p => ({ ...p, [messageId]: emoji }));
    reactToMessage(messageId, emoji)
      .then(row => { if (row && groupRef.current === gid) dispatch({ type: 'reactions', rows: [row] }); })
      .catch(e => { if (groupRef.current === gid) setError(humanError(e)); })
      .finally(() => {
        reactingRef.current.delete(messageId);
        setPending(p => {
          if (!(messageId in p)) return p;
          const next = { ...p };
          delete next[messageId];
          return next;
        });
      });
  }, []);

  const loadOlder = useCallback(async () => {
    const s = stateRef.current;
    if (!s.hasOlder || loadingOlder || !s.messages.length) return;
    const gid = groupRef.current;
    const generation = s.generation;
    setLoadingOlder(true);
    try {
      const page = await fetchOlder(gid, s.messages[0].id);
      if (groupRef.current === gid) dispatch({ type: 'older', page, generation });
    } catch (e) {
      if (groupRef.current === gid) setError(humanError(e));
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder]);

  return {
    messages: state.messages,
    outbox: state.outbox,
    reactions: state.reactions,
    pending,
    quotes: state.quotes,
    extras: state.loaded && chatExtrasAvailable(),
    loading: !state.loaded,
    hasOlder: state.hasOlder,
    loadingOlder,
    connection,
    error,
    send,
    react,
    retry,
    discard,
    remove,
    loadOlder,
  };
};
