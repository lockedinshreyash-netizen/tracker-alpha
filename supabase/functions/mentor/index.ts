/* ── The Mentor proxy ──
   Brokers the model. It holds the provider keys, owns the prompt, meters the
   budget and checks what comes back. What it deliberately does NOT do is read
   or write any study data: the student's device builds the snapshot and runs
   every read tool against its own state (see CLAUDE.md, "The Mentor"), and
   every write is a card the student applies on the device. So there is no user
   id anywhere in the request that could be pointed at somebody else, and no
   code path here that could reach another student's data even with a bug in it.

   Order of operations, and the order is the cost control:
     1. is the feature configured at all
     2. who is asking (JWT) and are they in the beta (mentor_access, as them)
     3. is the request well-formed and within its limits
     4. reserve one call atomically — per student, and against the global cap
     5. call the model chain; fall through on rate limits and failures
     6. validate the tool calls; record tokens; refund the call if no model
        answered at all

   JWT verification stays ON for this function (the default). */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  checkToolCall, MENTOR_INTENTS, MENTOR_LIMITS, MENTOR_PROTOCOL_VERSION, MENTOR_TOOLS,
  MentorErrorCode, MentorIntent, MentorResponse, WireMessage,
} from '../_shared/mentor-protocol.ts';
import { SYSTEM_PROMPT, snapshotMessage } from './prompt.ts';
import { chat, ChatResult, OAIMessage, OAITool, parseChain, ProviderError } from './providers.ts';

const env = (k: string) => Deno.env.get(k);

/* All overridable without a redeploy. The defaults assume Groq's free tier:
   200K counted tokens per model per day, ~5K per model call. */
const CHAIN = env('MENTOR_CHAIN') ?? 'groq:openai/gpt-oss-120b,groq:openai/gpt-oss-20b';
const USER_DAILY_CALLS = Number(env('MENTOR_USER_DAILY_CALLS') ?? 40);
const GLOBAL_DAILY_TOKENS = Number(env('MENTOR_GLOBAL_DAILY_TOKENS') ?? 350_000);
/* true opens the Mentor to every signed-in user. Off: the closed beta. */
const OPEN = env('MENTOR_OPEN') === 'true';
const ORIGINS = (env('MENTOR_ORIGINS') ?? 'https://trackeralpha.in,https://www.trackeralpha.in,http://localhost:3000')
  .split(',').map(s => s.trim()).filter(Boolean);

const MAX_OUTPUT_TOKENS = 2_000;
const CALL_TIMEOUT_MS = 25_000;
const MAX_WIRE_MESSAGES = 24;

/* Reasoning costs output tokens. Questions get a little; planning gets more. */
const EFFORT: Record<MentorIntent, 'low' | 'medium'> = {
  chat: 'low', on_track: 'low', review_week: 'low',
  plan_day: 'medium', roadmap: 'medium', replan: 'medium',
};

const TOOLS: OAITool[] = MENTOR_TOOLS.map(t => ({
  type: 'function',
  function: { name: t.name, description: t.description, parameters: t.parameters },
}));

const corsFor = (req: Request) => {
  const origin = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
};

/** The IST study day, 04:00 boundary — the same key every daily figure in the app uses. */
const studyDay = (): string =>
  new Date(Date.now() + (5.5 - 4) * 3_600_000).toISOString().slice(0, 10);

/* ── Request validation ── */

const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;

const validMessages = (raw: unknown): WireMessage[] | null => {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_WIRE_MESSAGES) return null;
  const out: WireMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') return null;
    const r = m as Record<string, unknown>;
    if (r.role === 'user' && isStr(r.content, MENTOR_LIMITS.maxMessageChars)) {
      out.push({ role: 'user', content: r.content });
    } else if (r.role === 'assistant' && isStr(r.content, 8_000)) {
      const calls = r.tool_calls;
      if (calls !== undefined) {
        if (!Array.isArray(calls) || calls.length > 6) return null;
        for (const c of calls) {
          if (!c || !isStr(c.id, 64) || !isStr(c.name, 64) || !isStr(c.arguments, 8_000)) return null;
        }
      }
      out.push(calls?.length
        ? { role: 'assistant', content: r.content, tool_calls: (calls as { id: string; name: string; arguments: string }[]).map(c => ({ id: c.id, name: c.name, arguments: c.arguments })) }
        : { role: 'assistant', content: r.content });
    } else if (r.role === 'tool' && isStr(r.tool_call_id, 64) && isStr(r.content, MENTOR_LIMITS.maxToolResultChars)) {
      out.push({ role: 'tool', tool_call_id: r.tool_call_id, content: r.content });
    } else {
      /* Anything else — including a `system` message — is refused outright. */
      return null;
    }
  }
  /* It must be the model's turn. */
  const last = out[out.length - 1];
  if (last.role !== 'user' && last.role !== 'tool') return null;
  return out;
};

const toOpenAI = (m: WireMessage): OAIMessage =>
  m.role === 'assistant' && m.tool_calls?.length
    ? {
      role: 'assistant',
      content: m.content,
      tool_calls: m.tool_calls.map(c => ({ id: c.id, type: 'function' as const, function: { name: c.name, arguments: c.arguments } })),
    }
    : m.role === 'tool'
      ? { role: 'tool', tool_call_id: m.tool_call_id, content: m.content }
      : { role: m.role, content: m.content };

Deno.serve(async req => {
  const cors = corsFor(req);
  const reply = (body: MentorResponse | { ok: false; error: MentorErrorCode }, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...cors } });
  const refuse = (error: MentorErrorCode, status: number, extra: Record<string, unknown> = {}) =>
    reply({ ok: false, error, ...extra } as MentorResponse, status);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return refuse('bad_request', 405);

  /* ── 1. Configured? ── */
  const chain = parseChain(CHAIN, env);
  if (!chain.length) return refuse('not_configured', 503);

  /* ── 2. Who, and are they in ── */
  const authHeader = req.headers.get('Authorization') ?? '';
  const asUser = createClient(env('SUPABASE_URL')!, env('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth, error: authError } = await asUser.auth.getUser();
  if (authError || !auth?.user) return refuse('unauthorized', 401);
  const userId = auth.user.id;

  if (!OPEN) {
    const { data: allowed, error } = await asUser.rpc('mentor_access');
    if (error || allowed !== true) return refuse('forbidden', 403);
  }

  /* ── 3. Shape and size ── */
  const raw = await req.text();
  if (raw.length > MENTOR_LIMITS.maxBodyBytes) return refuse('bad_request', 413);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return refuse('bad_request', 400);
  }
  if (body.v !== MENTOR_PROTOCOL_VERSION) return refuse('bad_request', 400);
  const intent = body.intent as MentorIntent;
  if (!MENTOR_INTENTS.includes(intent)) return refuse('bad_request', 400);
  const messages = validMessages(body.messages);
  if (!messages) return refuse('bad_request', 400);
  const snapshotText = JSON.stringify(body.snapshot ?? null);
  if (snapshotText.length > MENTOR_LIMITS.maxSnapshotChars) return refuse('bad_request', 413);

  /* Rounds already spent on this turn. The last permitted call is forced to
     answer in words, so a turn always ends with something the student can read. */
  const lastUser = messages.map(m => m.role).lastIndexOf('user');
  if (lastUser < 0) return refuse('bad_request', 400);
  const rounds = messages.slice(lastUser).filter(m => m.role === 'assistant').length;
  if (rounds >= MENTOR_LIMITS.maxCallsPerTurn) return refuse('bad_request', 400);
  const toolChoice = rounds >= MENTOR_LIMITS.maxCallsPerTurn - 1 ? 'none' : 'auto';

  /* ── 4. Reserve ── */
  const admin = createClient(env('SUPABASE_URL')!, env('SUPABASE_SERVICE_ROLE_KEY')!);
  const day = studyDay();
  const { data: reserved, error: reserveError } = await admin.rpc('mentor_reserve_call', {
    p_user: userId,
    p_day: day,
    p_user_cap: USER_DAILY_CALLS,
    p_global_tokens: GLOBAL_DAILY_TOKENS,
  });
  const verdict = Array.isArray(reserved) ? reserved[0] : reserved;
  if (reserveError || !verdict) return refuse('unavailable', 503);
  if (verdict.status === 'user_limit') return refuse('user_limit', 429, { remaining: 0 });
  if (verdict.status === 'global_limit') return refuse('global_limit', 429);
  const remaining = Math.max(0, USER_DAILY_CALLS - Number(verdict.calls ?? 0));

  /* ── 5. The model ── */
  const prompt: OAIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.slice(0, lastUser).map(toOpenAI),
    { role: 'user', content: snapshotMessage(body.snapshot) },
    ...messages.slice(lastUser).map(toOpenAI),
  ];

  let result: ChatResult | null = null;
  let model = '';
  let busy = false;
  let retryAfter: number | undefined;
  const usage = { input: 0, cached: 0, output: 0 };

  for (const link of chain) {
    try {
      const r = await chat(link, {
        messages: prompt,
        tools: TOOLS,
        toolChoice,
        effort: EFFORT[intent],
        maxTokens: MAX_OUTPUT_TOKENS,
        timeoutMs: CALL_TIMEOUT_MS,
      });
      usage.input += r.usage.input;
      usage.cached += r.usage.cached;
      usage.output += r.usage.output;

      /* ── 6. Validate. A reply naming a tool that does not exist, or with
         arguments that do not parse, is the model misbehaving — the next link
         gets a chance before the student sees anything. Schema errors on a
         KNOWN tool pass through: the device answers them with the error, and
         the model corrects itself on the next round. */
      const unknown = r.toolCalls.filter(c => {
        const checked = checkToolCall(c);
        return !checked.ok && (!MENTOR_TOOLS.some(t => t.name === c.name) || checked.error.includes('not valid JSON'));
      });
      if (unknown.length || (!r.content.trim() && !r.toolCalls.length)) {
        console.warn(`mentor: ${link.provider.id}/${link.model} returned unusable output`);
        continue;
      }
      result = r;
      model = link.model;
      break;
    } catch (e) {
      if (e instanceof ProviderError) {
        console.warn(`mentor: ${e.message}`);
        if (e.rateLimited) {
          busy = true;
          if (e.retryAfter !== undefined) retryAfter = Math.min(retryAfter ?? Infinity, e.retryAfter);
        }
        continue;
      }
      console.error('mentor: unexpected', e);
    }
  }

  if (usage.input || usage.output) {
    await admin.rpc('mentor_record_usage', {
      p_user: userId, p_day: day, p_in: usage.input, p_cached: usage.cached, p_out: usage.output,
    });
  }

  if (!result) {
    /* No model answered: the student is not charged for it. */
    await admin.rpc('mentor_release_call', { p_user: userId, p_day: day });
    if (busy) return refuse('busy', 429, { retryAfter: retryAfter ?? 15, remaining: remaining + 1 });
    return usage.output ? refuse('invalid_output', 502) : refuse('unavailable', 502);
  }

  return reply({
    ok: true,
    /* Length-capped here and rendered as plain text on the device. */
    content: result.content.slice(0, 6_000),
    tool_calls: result.toolCalls.slice(0, 4),
    model,
    remaining,
  });
});
