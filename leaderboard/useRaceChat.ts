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
   run a second clock to notice it changed. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateId } from '../utils';
import {
  MAX_MESSAGE,
  RaceChatMessage,
  fetchMessages,
  humanError,
  sendMessage,
  validateMessage,
} from './chatApi';
import { supabase } from '../supabaseClient';

/** A message still in flight reads and renders like a real one, minus an id the server has assigned yet. */
export interface ChatEntry extends RaceChatMessage {
  pending?: boolean;
  failed?: boolean;
}

interface Options {
  userId: string | null;
  displayName: string;
  raceDate: string;
  /** Signed in, in the race, with a display name — same gate the board itself uses. */
  enabled: boolean;
}

export interface RaceChatView {
  messages: ChatEntry[];
  loading: boolean;
  error: string | null;
  sending: boolean;
  maxLength: number;
  send: (text: string) => Promise<void>;
  /** Drop a message that failed to send, so it stops occupying the thread. */
  dismiss: (tempId: string) => void;
}

export const useRaceChat = ({ userId, displayName, raceDate, enabled }: Options): RaceChatView => {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  /* Read inside the realtime callback and the send handler, neither of which
     should be rebuilt every time a message arrives. */
  const raceDateRef = useRef(raceDate);
  raceDateRef.current = raceDate;

  useEffect(() => {
    if (!enabled) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchMessages(raceDate)
      .then(rows => {
        if (cancelled) return;
        setMessages(rows);
      })
      .catch(e => {
        if (cancelled) return;
        setError(humanError(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    /* One subscription for this race, filtered server-side to it — a message
       posted to yesterday's already-archived room can't reach a panel open on
       today's. Insert-only: nothing in the app updates or deletes a message. */
    const channel = supabase
      .channel(`race_chat_${raceDate}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'race_chat_messages',
          filter: `race_date=eq.${raceDate}`,
        },
        payload => {
          const row = payload.new as RaceChatMessage;
          setMessages(prev => (prev.some(m => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [enabled, raceDate]);

  const send = useCallback(
    async (text: string) => {
      if (!userId || !enabled) return;
      const clean = validateMessage(text);
      if (!clean) return;

      /* Shown the instant the user hits send — "sending feels instant" — and
         reconciled against the real row once the insert returns. The realtime
         echo of this same insert is deduped above by id, so it never doubles up. */
      const tempId = `temp-${generateId()}`;
      const optimistic: ChatEntry = {
        id: tempId,
        race_date: raceDateRef.current,
        user_id: userId,
        display_name: displayName,
        message: clean,
        created_at: new Date().toISOString(),
        pending: true,
      };
      setMessages(prev => [...prev, optimistic]);
      setSending(true);
      setError(null);

      try {
        const saved = await sendMessage(userId, displayName, raceDateRef.current, clean);
        setMessages(prev => {
          const withoutTemp = prev.filter(m => m.id !== tempId);
          // A realtime echo may have already landed while the insert was in flight.
          return withoutTemp.some(m => m.id === saved.id) ? withoutTemp : [...withoutTemp, saved];
        });
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

  return { messages, loading, error, sending, maxLength: MAX_MESSAGE, send, dismiss };
};
