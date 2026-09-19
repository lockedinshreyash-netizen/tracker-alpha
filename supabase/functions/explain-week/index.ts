/* ── The AI proxy ──
   The only place in this product that talks to Anthropic, and the only place
   the API key exists.

   It exists because the key cannot go in the client. A Vite build inlines every
   `VITE_`-prefixed variable into a public JavaScript bundle, so an API key
   shipped that way is not "hidden in the app" — it is published, and anybody
   can spend the balance. That is the whole reason for this file.

   Three jobs, in order, and the order is the cost control:
     1. authenticate the caller,
     2. refuse to spend money it should not,
     3. and only then make one request.

   Contrast with `send-reminders`, which authenticates with a shared secret
   because its caller is a database job with no user session. This one is called
   by a signed-in browser, so it verifies the user's JWT — and every row it
   touches is keyed to the id inside that token rather than to anything the
   request body claims. */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

/* Overridable without a redeploy. Model ids are the one thing here likeliest to
   need changing on short notice, and a secret is faster than a deploy. */
const MODEL = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-haiku-4-5';

/* ── Budget ──
   Both caps are enforced here rather than in the client, because a client that
   could raise its own quota is not a quota. The per-user cap stops one account
   running away; the global cap is what stands between a bug and the whole
   balance. */
const PER_USER_MONTHLY = Number(Deno.env.get('AI_USER_CAP') ?? 10);
const GLOBAL_MONTHLY = Number(Deno.env.get('AI_GLOBAL_CAP') ?? 2000);

/* A hard ceiling on the most expensive half of a request. Output is billed at
   five times input, so this is the single most effective per-call control —
   and it is a server-side number the client cannot raise. */
const MAX_TOKENS = 600;

const ok = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/* ── The prompt ──
   Frozen, and versioned by the client's PROMPT_VERSION, which is baked into the
   cache key. Editing this text without raising that version would leave every
   student reading insights written by the previous prompt.

   The three prohibitions are not decoration. This model is writing to
   seventeen-year-olds about their own study habits during exam preparation, and
   the failure mode that matters is not a wrong number — the numbers are all
   computed before it is called — it is confident language attached to thin
   evidence. */
const SYSTEM = `You write short performance notes for a student using a study tracker called Alpha.

You are given a JSON object of statistics Alpha has already calculated from the student's own timed study sessions. Your only job is to turn those numbers into plain, useful English.

RULES — these are absolute:
1. Never state or imply causation. "Your sessions went better in the morning" is allowed. "Mornings make you focus better" is not.
2. Never invent a number, a window, a subject or a trend that is not in the JSON. If it is not there, it does not exist.
3. If "confidence" is "insufficient" or "emerging", do not describe any pattern as established. Say what is being watched and what is still needed, using the "gates" numbers.
4. Never suggest sleeping less, studying longer than is healthy, or working through exhaustion.
5. Do not congratulate, cheerlead, or moralise. No exclamation marks.

VOICE: direct, concrete, second person. Short sentences. The student is busy and has read a thousand motivational messages. Sound like a coach reading a stopwatch, not an app.

Write:
- headline: at most 12 words, the single most useful thing in the data.
- paragraphs: exactly 2, at most 45 words each. The first says what the numbers show. The second says what to do with it, or what Alpha is still waiting for.
- caveat: at most 20 words, naming the main limit on what this data can support.`;

/* The response shape, enforced by the API rather than requested in prose. A
   bounded schema is also a bounded bill: the model cannot decide to write an
   essay. */
const SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    paragraphs: { type: 'array', items: { type: 'string' } },
    caveat: { type: 'string' },
  },
  required: ['headline', 'paragraphs', 'caveat'],
  additionalProperties: false,
};

const monthStart = (): string => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
};

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return ok({ error: 'method_not_allowed' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  /* Unset means the feature was never deployed. Say so plainly rather than
     failing obscurely — the client renders nothing at all in this case. */
  if (!apiKey) return ok({ error: 'not_configured' }, 503);

  /* ── 1. Who is asking ──
     The client is created with the caller's own token, so `getUser` verifies
     it and everything downstream runs as them. The service role is never used
     for the user's own rows here; it is only needed for the global counter. */
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) return ok({ error: 'unauthorized' }, 401);
  const userId = auth.user.id;

  let body: { hash?: string; packet?: unknown };
  try {
    body = await req.json();
  } catch {
    return ok({ error: 'bad_request' }, 400);
  }

  const hash = typeof body.hash === 'string' ? body.hash : '';
  /* The hash is a cache key we look rows up by, so it is checked against its
     exact shape rather than trusted — 64 lowercase hex characters, nothing
     else. */
  if (!/^[0-9a-f]{64}$/.test(hash) || !body.packet || typeof body.packet !== 'object') {
    return ok({ error: 'bad_request' }, 400);
  }

  /* ── 2. Has this exact week already been paid for ──
     Checked before the quota, because a cache hit costs nothing and should
     never consume an allowance. The client checks its own cache first; this
     catches the second device. */
  const { data: cached } = await supabase
    .from('ai_insights')
    .select('payload')
    .eq('user_id', userId)
    .eq('packet_hash', hash)
    .maybeSingle();

  if (cached?.payload) return ok({ insight: cached.payload, cached: true });

  /* ── 3. Is there budget ──
     Service role, because the global counter spans every user and no single
     user may read or write it under RLS. */
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const month = monthStart();

  const { data: usage } = await admin
    .from('ai_usage')
    .select('calls')
    .eq('user_id', userId)
    .eq('month', month)
    .maybeSingle();

  if ((usage?.calls ?? 0) >= PER_USER_MONTHLY) {
    return ok({ error: 'user_limit', limit: PER_USER_MONTHLY }, 429);
  }

  /* Summed in the database rather than pulled row by row — at ten thousand
     users this select would otherwise return ten thousand rows on every call,
     which is a cost control that costs. `ai_month_calls` is a view; see
     supabase/ai.sql. */
  const { data: global } = await admin
    .from('ai_month_calls')
    .select('calls')
    .eq('month', month)
    .maybeSingle();

  if ((global?.calls ?? 0) >= GLOBAL_MONTHLY) {
    /* The deterministic panel renders exactly as normal on the client when this
       comes back; there is no degraded state and no error banner. A student
       should never see "we ran out of budget". */
    return ok({ error: 'budget_exhausted' }, 429);
  }

  /* ── 4. One request ──
     No streaming, no tools, no thinking. One question, one bounded answer. */
  let anthropic: Response;
  try {
    anthropic = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: `Here are this student's statistics. Write their note.\n\n${JSON.stringify(body.packet)}`,
        }],
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      }),
    });
  } catch (e) {
    return ok({ error: 'upstream_unreachable', detail: String(e) }, 502);
  }

  if (!anthropic.ok) {
    const detail = await anthropic.text();
    /* Not charged, not counted. A failed call must not consume the student's
       monthly allowance. */
    return ok({ error: 'upstream_error', status: anthropic.status, detail: detail.slice(0, 400) }, 502);
  }

  const result = await anthropic.json();

  if (result.stop_reason === 'refusal') {
    return ok({ error: 'refused' }, 422);
  }

  const text = (result.content ?? []).find((b: { type: string }) => b.type === 'text')?.text;
  if (!text) return ok({ error: 'empty_response' }, 502);

  let insight: { headline: string; paragraphs: string[]; caveat: string };
  try {
    insight = JSON.parse(text);
  } catch {
    return ok({ error: 'unparseable' }, 502);
  }

  /* Trimmed here as well as on the client. The schema constrains the shape, not
     the length, and this text is rendered into a page. */
  const payload = {
    headline: String(insight.headline ?? '').slice(0, 200),
    paragraphs: (Array.isArray(insight.paragraphs) ? insight.paragraphs : [])
      .slice(0, 3).map((p: unknown) => String(p).slice(0, 600)),
    caveat: String(insight.caveat ?? '').slice(0, 300),
    at: Date.now(),
  };

  /* ── 5. Record what it cost ──
     After the call, so a failure upstream never bills the student's allowance.
     The trade-off is the mirror of the one `send-reminders` documents: counting
     first can over-charge on a crash, counting after can under-count. Here the
     stake is a fraction of a cent rather than a missed notification, so the
     kinder direction wins. */
  const usedIn = result.usage?.input_tokens ?? 0;
  const usedOut = result.usage?.output_tokens ?? 0;

  /* Accumulated, not overwritten. The row is the month's running total, and
     assigning this call's usage to it would make every month read as though it
     contained exactly one request. */
  await admin.rpc('ai_record_call', {
    p_user: userId,
    p_month: month,
    p_in: usedIn,
    p_out: usedOut,
  });

  await admin.from('ai_insights').upsert({
    user_id: userId,
    packet_hash: hash,
    payload,
  }, { onConflict: 'user_id,packet_hash' });

  return ok({ insight: payload, cached: false });
});
