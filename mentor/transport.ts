/* ── One request to the `mentor` edge function ──
   Never throws except on abort. Every failure comes back as a MentorResponse
   the UI already knows how to explain, including the ones that never reached
   the function at all. */

import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';
import { MentorRequest, MentorResponse } from '../supabase/functions/_shared/mentor-protocol';

export type ClientError = 'offline';

export const callMentor = async (body: MentorRequest, signal: AbortSignal): Promise<MentorResponse | { ok: false; error: ClientError }> => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, error: 'offline' };

  const { data, error } = await supabase.functions.invoke('mentor', { body, signal });
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

  if (error) {
    /* A non-2xx from the function still carries our JSON body — 429s and 403s
       are answers, not crashes. Anything else (relay, DNS, CORS) is simply
       "could not be reached". */
    if (error instanceof FunctionsHttpError) {
      try {
        const parsed = await (error.context as Response).json();
        if (parsed && parsed.ok === false && typeof parsed.error === 'string') return parsed as MentorResponse;
      } catch {
        /* Fall through. */
      }
      const status = (error.context as Response | undefined)?.status;
      if (status === 401) return { ok: false, error: 'unauthorized' };
      if (status === 404) return { ok: false, error: 'not_configured' };
    }
    return { ok: false, error: 'unavailable' };
  }

  if (!data || typeof data !== 'object' || typeof (data as MentorResponse).ok !== 'boolean') {
    return { ok: false, error: 'unavailable' };
  }
  return data as MentorResponse;
};
