import { useCallback, useState } from 'react';
import { AiInsight } from '../types';
import { ExperimentState } from '../insight/observe';
import { SleepLog } from '../types';
import { supabase } from '../supabaseClient';

/**
 * Whether the feature exists in this deployment at all.
 *
 * Ships dark, exactly like closed-app reminders do without
 * `VITE_VAPID_PUBLIC_KEY`: with no flag set, the switch does not render, the
 * packet builder is never imported, and no request is ever possible. A control
 * that cannot work is worse than no control.
 */
export const AI_AVAILABLE = import.meta.env.VITE_AI_ENABLED === 'true';

export type ExplainError =
  | 'offline' | 'signed_out' | 'user_limit' | 'budget_exhausted' | 'failed';

interface Options {
  experiment: ExperimentState;
  sleepLogs: SleepLog[];
  cache: Record<string, AiInsight>;
  signedIn: boolean;
  onCached: (hash: string, insight: AiInsight) => void;
}

/**
 * One insight, on demand, at most once per distinct set of statistics.
 *
 * Every cost control in the plan lands in this one function, and the order is
 * the point:
 *
 *   1. The packet builder is a **dynamic import**, so a student who never opts
 *      in never downloads it — the same treatment `reminders/publish.ts` and
 *      `notify/push.ts` already get.
 *   2. The local cache is checked first, so reopening an unchanged week is free
 *      and instant.
 *   3. Only then is a request made, and it is made by an explicit tap. Nothing
 *      here is wired to a timer, a mount, a sync, or a session ending — the
 *      budget is set by where the button is, not by how the prompt is written.
 */
export const useExplain = ({ experiment, sleepLogs, cache, signedIn, onCached }: Options) => {
  const [insight, setInsight] = useState<AiInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ExplainError | null>(null);

  const explain = useCallback(async () => {
    if (!AI_AVAILABLE) return;
    if (!signedIn) { setError('signed_out'); return; }
    if (!navigator.onLine) { setError('offline'); return; }

    setError(null);
    setLoading(true);

    try {
      /* Imported here rather than at module scope. This is the whole of the
         "ten thousand non-AI users cost nothing" guarantee on the client side:
         the code that constructs data for an API call is not in the bundle a
         user who never presses this downloads. */
      const { buildPacket, packetHash } = await import('../insight/packet');

      const packet = buildPacket(experiment, sleepLogs);
      const hash = await packetHash(packet);

      const hit = cache[hash];
      if (hit) {
        setInsight(hit);
        setLoading(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('explain-week', {
        body: { hash, packet },
      });

      if (fnError || !data) { setError('failed'); return; }

      if (data.error) {
        setError(
          data.error === 'user_limit' ? 'user_limit'
            : data.error === 'budget_exhausted' ? 'budget_exhausted'
              : 'failed',
        );
        return;
      }

      const result = data.insight as AiInsight;
      if (!result?.headline) { setError('failed'); return; }

      setInsight(result);
      onCached(hash, result);
    } catch {
      setError('failed');
    } finally {
      setLoading(false);
    }
  }, [experiment, sleepLogs, cache, signedIn, onCached]);

  return { insight, loading, error, explain, reset: () => { setInsight(null); setError(null); } };
};

/** What each failure says to a student, in their terms. */
export const EXPLAIN_MESSAGE: Record<ExplainError, string> = {
  offline: 'You’re offline. Everything else on this page still works.',
  signed_out: 'Sign in to use this — it needs an account to keep your notes with.',
  user_limit: 'That’s all your notes for this month. Everything else here keeps updating.',
  /* Deliberately not "we ran out of budget". The student did nothing wrong and
     there is nothing they can do; the honest, useful framing is that this one
     extra is unavailable and the real page is unaffected. */
  budget_exhausted: 'Written notes are paused right now. Your numbers above are unaffected.',
  failed: 'That didn’t work. Try again in a moment.',
};
