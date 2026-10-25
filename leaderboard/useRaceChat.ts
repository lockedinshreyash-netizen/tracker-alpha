/* ── Race chat, wired up ──
   Mounted from RaceChat.tsx, which only exists while the Ranks tab is open —
   unlike useRace, this has no reason to run anywhere else: the spec is chat
   is live only while someone is actually looking at the race. Unmounting the
   panel tears the subscription down for free.

   `raceDate` is supplied by the caller as `race.race.date` (leaderboard/
   engine.ts), which is already `getISTDateString()` — the same 4 AM-rollover
   value the board itself resets on. useRace's own poll loop re-renders App at
   least every 25s while the Ranks tab is watched (POLL_WATCHING_MS in
   useRace.ts), so that value crosses the rollover within a poll of it
   actually happening — this hook only has to react to the prop changing, not
   run a second clock to notice it changed.

   Group chat's rule holds here too (groups/useGroupChat.ts): Realtime is the
   doorbell, the table is the mailbox. Every copy of a message — the fetch,
   a realtime INSERT or UPDATE, our own insert's response — goes through one
   merge by id in which a deletion always wins, and the latest page is
   fetched again on every SUBSCRIBED, so a dropped socket cannot leave a gap.
   Reactions merge by the server's `updated_at`; an in-flight change of yours
   is drawn from `pending`, which only the RPC's answer clears. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateId } from '../utils';
import {
  MAX_MESSAGE,
  QuotedRaceMessage,
  RaceChatMessage,
  RaceReaction,
  deleteMessage,
  fetchMessages,
  fetchQuotes,
  humanError,
  raceChatExtrasAvailable,
  reactToMessage,
  sendMessage,
  validateMessage,
} from './chatApi';
import { mergeReactions, stamp } from '../chat/reactions';
import { supabase } from '../supabaseClient';

/** A message still in flight reads and renders like a real one, minus an id the server has assigned yet. */
export interface ChatEntry extends RaceChatMessage {
  pending?: boolean;
  failed?: boolean;
}

/** message id → user id → that person's reaction. */
export type RaceReactionMap = Record<string, Record<string, RaceReaction>>;
/** Quoted parents outside the window. null = looked up, not visible to us. */
export type RaceQuoteMap = Record<string, QuotedRaceMessage | null>;

interface Options {
  userId: string | null;
  displayName: string;
  raceDate: string;
  /** Signed in, in the race, with a display name — same gate the board itself uses. */
  enabled: boolean;
}

export interface RaceChatView {
  messages: ChatEntry[];
  reactions: RaceReactionMap;
  pending: Record<string, string | null>;
  quotes: RaceQuoteMap;
  /** Replies, reactions and deletion are available (race_chat.sql has been re-run). */
  extras: boolean;
  loading: boolean;
  error: string | null;
  sending: boolean;
  maxLength: number;
  send: (text: string, replyTo?: string | null) => Promise<void>;
  /** Drop a message that failed to send, so it stops occupying the thread. */
  dismiss: (tempId: string) => void;
  react: (messageId: string, emoji: string | null) => void;
  remove: (messageId: string) => Promise<void>;
}

/** Union by id, oldest first. A deleted version always beats a live one. */
const merge = (prev: ChatEntry[], rows: RaceChatMessage[]): ChatEntry[] => {
  if (!rows.length) return prev;
  const byId = new Map<string, ChatEntry>();
  prev.forEach(m => byId.set(m.id, m));
  let changed = false;
  rows.forEach(r => {
    const existing = byId.get(r.id);
    if (existing?.deleted_at && !r.deleted_at) return;
    if (existing && existing.deleted_at === r.deleted_at && existing.message === r.message
      && (existing.reply_to ?? null) === (r.reply_to ?? null)) return;
    byId.set(r.id, existing ? { ...existing, ...r } : r);
    changed = true;
  });
  if (!changed) return prev;
  // Unsent messages stay at the bottom, in the order they were written.
  const all = Array.from(byId.values());
  const unsent = all.filter(m => m.pending || m.failed);
  const sent = all
    .filter(m => !m.pending && !m.failed)
    // Instants, not strings: PostgREST and Realtime spell one timestamptz differently.
    .sort((a, b) => stamp(a.created_at) - stamp(b.created_at) || a.id.localeCompare(b.id));
  return unsent.length ? [...sent, ...unsent] : sent;
};

const HIDDEN_RESYNC_MS = 60_000;

export const useRaceChat = ({ userId, displayName, raceDate, enabled }: Options): RaceChatView => {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [reactions, setReactions] = useState<RaceReactionMap>({});
  const [pending, setPending] = useState<Record<string, string | null>>({});
  const [quotes, setQuotes] = useState<RaceQuoteMap>({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  /* Read inside the realtime callback and the send handler, neither of which
     should be rebuilt every time a message arrives. */
  const raceDateRef = useRef(raceDate);
  raceDateRef.current = raceDate;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    setMessages([]);
    setReactions({});
    setQuotes({});
    setPending({});
    setLoaded(false);
    if (!enabled) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const sync = () => fetchMessages(raceDate)
      .then(page => {
        if (cancelled) return;
        setMessages(prev => merge(prev, page.messages));
        setReactions(prev => mergeReactions(prev, page.reactions));
        setLoaded(true);
      })
      .catch(e => {
        if (cancelled) return;
        setError(humanError(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    void sync();

    /* One subscription for this race, filtered server-side to it — a message
       posted to yesterday's already-archived room can't reach a panel open on
       today's. UPDATEs carry deletions; reactions arrive on their own table. */
    const filter = `race_date=eq.${raceDate}`;
    let subscribedOnce = false;
    const channel = supabase
      .channel(`race_chat_${raceDate}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'race_chat_messages', filter }, payload => {
        setMessages(prev => merge(prev, [payload.new as RaceChatMessage]));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'race_chat_messages', filter }, payload => {
        const row = payload.new as RaceChatMessage;
        setMessages(prev => merge(prev, [row]));
        setQuotes(prev => (row.id in prev
          ? { ...prev, [row.id]: { id: row.id, user_id: row.user_id, display_name: row.display_name, message: row.message, deleted_at: row.deleted_at ?? null } }
          : prev));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'race_chat_reactions', filter }, payload => {
        setReactions(prev => mergeReactions(prev, [payload.new as RaceReaction]));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'race_chat_reactions', filter }, payload => {
        setReactions(prev => mergeReactions(prev, [payload.new as RaceReaction]));
      })
      .subscribe(status => {
        // Every rejoin after the first catches up on what the socket missed.
        if (status !== 'SUBSCRIBED') return;
        if (subscribedOnce) void sync();
        subscribedOnce = true;
      });

    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      if (hiddenAt && Date.now() - hiddenAt > HIDDEN_RESYNC_MS) void sync();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, [enabled, raceDate]);

  /* ── Quotes outside the window ── each id is asked for once per race. */
  const askedRef = useRef(new Set<string>());
  useEffect(() => { askedRef.current = new Set(); }, [raceDate]);
  useEffect(() => {
    const onScreen = new Set(messages.map(m => m.id));
    const missing = messages
      .map(m => m.reply_to)
      .filter((id): id is string => !!id && !onScreen.has(id) && !(id in quotes) && !askedRef.current.has(id));
    if (!missing.length) return;
    const ids = Array.from(new Set(missing));
    ids.forEach(id => askedRef.current.add(id));
    const day = raceDate;
    fetchQuotes(ids)
      .then(found => {
        if (raceDateRef.current !== day) return;
        setQuotes(prev => {
          const next = { ...prev };
          ids.forEach(id => { next[id] = found.find(q => q.id === id) ?? null; });
          return next;
        });
      })
      // Asked again on the next change, rather than never.
      .catch(() => ids.forEach(id => askedRef.current.delete(id)));
  }, [messages, quotes, raceDate]);

  const send = useCallback(
    async (text: string, replyTo: string | null = null) => {
      if (!userId || !enabled) return;
      const clean = validateMessage(text);
      if (!clean) return;

      /* Shown the instant the user hits send — "sending feels instant" — and
         reconciled against the real row once the insert returns. The realtime
         echo of this same insert is deduped by id, so it never doubles up. */
      const tempId = `temp-${generateId()}`;
      const optimistic: ChatEntry = {
        id: tempId,
        race_date: raceDateRef.current,
        user_id: userId,
        display_name: displayName,
        message: clean,
        created_at: new Date().toISOString(),
        reply_to: replyTo,
        pending: true,
      };
      setMessages(prev => [...prev, optimistic]);
      setSending(true);
      setError(null);

      try {
        const saved = await sendMessage(userId, displayName, raceDateRef.current, clean, replyTo);
        setMessages(prev => merge(prev.filter(m => m.id !== tempId), [saved]));
      } catch (e) {
        setMessages(prev => prev.map(m => (m.id === tempId ? { ...m, pending: false, failed: true } : m)));
        setError(humanError(e));
      } finally {
        setSending(false);
      }
    },
    [userId, displayName, enabled]
  );

  const dismiss = useCallback((tempId: string) => {
    setMessages(prev => prev.filter(m => m.id !== tempId));
  }, []);

  const remove = useCallback(async (messageId: string) => {
    const msg = messagesRef.current.find(m => m.id === messageId);
    if (!msg) return;
    try {
      await deleteMessage(messageId);
      setMessages(prev => merge(prev, [{ ...msg, message: '', deleted_at: new Date().toISOString() }]));
    } catch (e) {
      setError(humanError(e));
    }
  }, []);

  // A ref, not `pending`: two taps inside one render must not both get through.
  const reactingRef = useRef(new Set<string>());
  const react = useCallback((messageId: string, emoji: string | null) => {
    // One change per message at a time; the chip is held until it answers.
    if (reactingRef.current.has(messageId)) return;
    reactingRef.current.add(messageId);
    const day = raceDateRef.current;
    setPending(p => ({ ...p, [messageId]: emoji }));
    reactToMessage(messageId, emoji)
      .then(row => { if (row && raceDateRef.current === day) setReactions(prev => mergeReactions(prev, [row])); })
      .catch(e => { if (raceDateRef.current === day) setError(humanError(e)); })
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

  return {
    messages,
    reactions,
    pending,
    quotes,
    extras: loaded && raceChatExtrasAvailable(),
    loading,
    error,
    sending,
    maxLength: MAX_MESSAGE,
    send,
    dismiss,
    react,
    remove,
  };
};
