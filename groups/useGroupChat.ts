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
     Unsent messages survive a reload in localStorage and retry on reconnect. */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import {
  GroupMessage,
  PAGE_SIZE,
  deleteMessage,
  fetchLatest,
  fetchOlder,
  insertMessage,
  newClientId,
  validateMessage,
} from './chatApi';
import { humanError, markRead } from './api';

export interface OutboxEntry {
  client_id: string;
  body: string;
  created_at: string;
  status: 'sending' | 'failed';
  error?: string;
}

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
}

type Action =
  | { type: 'reset'; group: string; outbox: OutboxEntry[] }
  | { type: 'latest'; page: GroupMessage[] }
  | { type: 'ingest'; rows: GroupMessage[] }
  | { type: 'older'; page: GroupMessage[]; generation: number }
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

const settleOutbox = (outbox: OutboxEntry[], rows: GroupMessage[]): OutboxEntry[] => {
  if (!outbox.length) return outbox;
  const landed = new Set(rows.map(r => r.client_id));
  const next = outbox.filter(o => !landed.has(o.client_id));
  return next.length === outbox.length ? outbox : next;
};

const reducer = (state: ChatState, action: Action): ChatState => {
  switch (action.type) {
    case 'reset':
      return { group: action.group, messages: [], outbox: action.outbox, hasOlder: false, generation: state.generation + 1, loaded: false };

    case 'latest': {
      const { page } = action;
      const outbox = settleOutbox(state.outbox, page);
      if (!state.loaded || !state.messages.length) {
        return { ...state, messages: page, outbox, hasOlder: page.length === PAGE_SIZE, loaded: true };
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
          hasOlder: true,
          generation: state.generation + 1,
          loaded: true,
        };
      }
      return { ...state, messages: merge(state.messages, page), outbox, loaded: true };
    }

    case 'ingest':
      return { ...state, messages: merge(state.messages, action.rows), outbox: settleOutbox(state.outbox, action.rows) };

    case 'older':
      if (action.generation !== state.generation) return state;
      return {
        ...state,
        messages: merge(state.messages, action.page),
        outbox: settleOutbox(state.outbox, action.page),
        hasOlder: action.page.length === PAGE_SIZE,
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
  loading: boolean;
  hasOlder: boolean;
  loadingOlder: boolean;
  connection: Connection;
  error: string | null;
  send: (text: string) => void;
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
  }));
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
      if (!stateRef.current.loaded) dispatch({ type: 'latest', page: [] });
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
      const row = await insertMessage(gid, userId, entry.client_id, entry.body);
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
    setError(null);
    setConnection(navigator.onLine === false ? 'offline' : 'connecting');
    let alive = true;
    let firstSync = true;

    const ingest = (payload: { new: unknown }) => {
      const row = payload.new as GroupMessage;
      if (!row || row.group_id !== groupId) return;
      dispatch({ type: 'ingest', rows: [{ ...row, id: Number(row.id) }] });
    };

    const channel = supabase
      .channel(`group_chat_${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, ingest)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` }, ingest)
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

  const send = useCallback((text: string) => {
    const body = validateMessage(text);
    if (!body) return;
    const entry: OutboxEntry = {
      client_id: newClientId(),
      body,
      created_at: new Date().toISOString(),
      status: 'sending',
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
    loading: !state.loaded,
    hasOlder: state.hasOlder,
    loadingOlder,
    connection,
    error,
    send,
    retry,
    discard,
    remove,
    loadOlder,
  };
};
