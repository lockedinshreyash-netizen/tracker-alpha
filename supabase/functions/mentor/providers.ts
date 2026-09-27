/* ── The model adapter ──
   Every provider the Mentor can use speaks OpenAI's Chat Completions API, so
   there is one adapter and a table of differences. Switching provider or model
   is a secret change, not a deploy:

     supabase secrets set MENTOR_CHAIN="groq:openai/gpt-oss-120b,groq:openai/gpt-oss-20b"

   The chain is tried in order. A rate limit, a 5xx, a timeout or a malformed
   tool call from one link falls through to the next — a free tier's limits are
   per model, so the second link is a second allowance, not just a backup.

   Only providers whose API key is set are used. A chain naming a provider with
   no key silently skips it rather than failing every request. */

export interface ProviderSpec {
  id: string;
  baseUrl: string;
  keyEnv: string;
  /** How this provider takes reasoning effort for gpt-oss-style models. */
  reasoning: 'effort' | 'openrouter' | 'none';
  /** The name of the output-length parameter it prefers. */
  maxTokensParam: 'max_completion_tokens' | 'max_tokens';
  /** Extra body fields this provider needs. */
  extra?: Record<string, unknown>;
}

const PROVIDERS: Record<string, ProviderSpec> = {
  groq: {
    id: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    reasoning: 'effort',
    maxTokensParam: 'max_completion_tokens',
    /* Reasoning text is never shown; not sending it back saves bandwidth. */
    extra: { include_reasoning: false },
  },
  cerebras: {
    id: 'cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    keyEnv: 'CEREBRAS_API_KEY',
    reasoning: 'effort',
    maxTokensParam: 'max_completion_tokens',
  },
  openrouter: {
    id: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    reasoning: 'openrouter',
    maxTokensParam: 'max_tokens',
    /* Never route a minor's data to a provider that trains on it. */
    extra: { provider: { data_collection: 'deny' } },
  },
};

export interface ChainLink {
  provider: ProviderSpec;
  model: string;
  key: string;
}

export const parseChain = (raw: string, env: (k: string) => string | undefined): ChainLink[] =>
  raw.split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(entry => {
      const i = entry.indexOf(':');
      if (i <= 0) return null;
      const provider = PROVIDERS[entry.slice(0, i)];
      const model = entry.slice(i + 1);
      const key = provider ? env(provider.keyEnv) : undefined;
      return provider && model && key ? { provider, model, key } : null;
    })
    .filter((l): l is ChainLink => l !== null);

/* ── Wire types (OpenAI shape) ── */
export interface OAIToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export type OAIMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; tool_calls?: OAIToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface OAITool {
  type: 'function';
  function: { name: string; description: string; parameters: unknown };
}

export interface ChatRequest {
  messages: OAIMessage[];
  tools: OAITool[];
  toolChoice: 'auto' | 'none';
  effort: 'low' | 'medium';
  maxTokens: number;
  timeoutMs: number;
}

export interface ChatResult {
  content: string;
  toolCalls: { id: string; name: string; arguments: string }[];
  usage: { input: number; cached: number; output: number };
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** True for errors the next link in the chain might not have. */
    readonly retryable: boolean,
    readonly retryAfter?: number,
    readonly rateLimited = false,
  ) {
    super(message);
  }
}

const retryAfterOf = (res: Response): number | undefined => {
  const h = res.headers.get('retry-after');
  const n = h ? Number(h) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n) : undefined;
};

export const chat = async (link: ChainLink, req: ChatRequest): Promise<ChatResult> => {
  const { provider, model, key } = link;
  const body: Record<string, unknown> = {
    model,
    messages: req.messages,
    tools: req.tools,
    tool_choice: req.toolChoice,
    temperature: 0.3,
    [provider.maxTokensParam]: req.maxTokens,
    ...(provider.extra ?? {}),
  };
  if (provider.reasoning === 'effort') body.reasoning_effort = req.effort;
  if (provider.reasoning === 'openrouter') body.reasoning = { effort: req.effort, exclude: true };

  let res: Response;
  try {
    res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(req.timeoutMs),
    });
  } catch (e) {
    const timedOut = e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError');
    throw new ProviderError(timedOut ? 'timeout' : `network: ${String(e)}`, 0, true);
  }

  if (!res.ok) {
    const text = (await res.text()).slice(0, 500);
    const rateLimited = res.status === 429;
    /* Groq answers a malformed tool call from the model with a 400
       `tool_use_failed`. That is the model's fault, not the request's, so the
       next link may well do better. */
    const toolFailed = res.status === 400 && text.includes('tool_use_failed');
    const retryable = rateLimited || res.status >= 500 || toolFailed || res.status === 408;
    throw new ProviderError(`${provider.id} ${res.status}: ${text}`, res.status, retryable, retryAfterOf(res), rateLimited);
  }

  const json = await res.json();
  const message = json?.choices?.[0]?.message ?? {};
  const toolCalls = Array.isArray(message.tool_calls)
    ? message.tool_calls
      .filter((c: OAIToolCall) => c?.function?.name)
      .map((c: OAIToolCall, i: number) => ({
        id: typeof c.id === 'string' && c.id ? c.id.slice(0, 64) : `call_${Date.now()}_${i}`,
        name: String(c.function.name).slice(0, 64),
        arguments: typeof c.function.arguments === 'string' ? c.function.arguments : JSON.stringify(c.function.arguments ?? {}),
      }))
    : [];

  const usage = json?.usage ?? {};
  return {
    content: typeof message.content === 'string' ? message.content : '',
    toolCalls,
    usage: {
      input: Number(usage.prompt_tokens) || 0,
      cached: Number(usage.prompt_tokens_details?.cached_tokens) || 0,
      output: Number(usage.completion_tokens) || 0,
    },
  };
};
