-- ── Optional AI insights ──
-- Run this once in the Supabase dashboard: SQL Editor → New query → Run.
-- Every statement is idempotent; re-run it any time.
--
-- TWO NARROW TABLES, DELIBERATELY NOT `user_profiles`.
--
-- Same reasoning as supabase/reminders.sql, and it matters more here. The edge
-- function that reads these runs with the service role and bypasses RLS
-- entirely. If it read `user_profiles` instead, it would be a
-- publicly-reachable HTTP endpoint holding unrestricted access to every user's
-- complete study history, notes and tasks — and it would only need one auth bug
-- to hand that to someone.
--
-- So it is given nothing interesting to bypass RLS *for*. These tables hold a
-- hash, a short block of generated prose, and some counters. The statistics
-- themselves are never stored server-side at all: the client computes them,
-- sends them for the length of one request, and keeps them nowhere but the
-- user's own synced blob.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. The cache
--
-- Keyed by a hash of the statistics *and* the prompt version, so an identical
-- week never pays twice — on any device — and changing the prompt invalidates
-- everything at once.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.ai_insights (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  packet_hash text        not null,
  -- The generated note, and nothing else. No statistics, no history.
  payload     jsonb       not null,
  created_at  timestamptz not null default now(),

  primary key (user_id, packet_hash),

  -- A hash is a fixed shape. Anything else in this column is a bug or an
  -- attempt, and either way it should not reach a row.
  constraint packet_hash_shape check (packet_hash ~ '^[0-9a-f]{64}$')
);

alter table public.ai_insights enable row level security;

-- Read your own, and only your own. There is no policy for insert or update:
-- rows are written exclusively by the edge function under the service role, so
-- a client cannot forge an insight or overwrite one.
drop policy if exists "users read their own insights" on public.ai_insights;
create policy "users read their own insights"
  on public.ai_insights for select
  to authenticated
  using (auth.uid() = user_id);

-- Turning AI off deletes what it generated. The user owns this.
drop policy if exists "users delete their own insights" on public.ai_insights;
create policy "users delete their own insights"
  on public.ai_insights for delete
  to authenticated
  using (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. The budget
--
-- One row per user per month. The caps live in the edge function's environment,
-- but the counting lives here — a client that could increment its own quota
-- could also decrement it, so no client may write this at all.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.ai_usage (
  user_id       uuid not null references auth.users (id) on delete cascade,
  month         date not null,            -- always the first of the month, UTC
  calls         int  not null default 0,
  input_tokens  int  not null default 0,
  output_tokens int  not null default 0,
  updated_at    timestamptz not null default now(),

  primary key (user_id, month)
);

alter table public.ai_usage enable row level security;

-- Readable by the owner so the app can show "3 of 10 used this month".
-- Writable by nobody: the service role bypasses RLS, and it is the only writer.
drop policy if exists "users read their own usage" on public.ai_usage;
create policy "users read their own usage"
  on public.ai_usage for select
  to authenticated
  using (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. The global counter
--
-- The function checks a single monthly total before every call. Summed here
-- rather than in the function, because selecting every user's row to add them
-- up in TypeScript is a cost control that costs — at ten thousand users it
-- would pull ten thousand rows on every request.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace view public.ai_month_calls as
  select month, sum(calls)::bigint as calls
  from public.ai_usage
  group by month;

-- The view is reachable only by the service role. A per-user client has no
-- business knowing the platform's total spend.
revoke all on public.ai_month_calls from anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Recording a call
--
-- An upsert from the function would have to read-modify-write, and two requests
-- landing together would each read the same count and each write count+1 — one
-- call billed, two allowed. Doing the arithmetic in the database makes the
-- increment atomic, which is what actually enforces the cap.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.ai_record_call(
  p_user  uuid,
  p_month date,
  p_in    int,
  p_out   int
) returns void
language sql
security definer
set search_path = public
as $$
  insert into public.ai_usage (user_id, month, calls, input_tokens, output_tokens)
  values (p_user, p_month, 1, p_in, p_out)
  on conflict (user_id, month) do update
    set calls         = public.ai_usage.calls + 1,
        input_tokens  = public.ai_usage.input_tokens + excluded.input_tokens,
        output_tokens = public.ai_usage.output_tokens + excluded.output_tokens,
        updated_at    = now();
$$;

-- Only the service role may call it. `security definer` means this function
-- runs with the privileges of its owner, so leaving it callable by clients
-- would be handing them a quota-increment button.
revoke all on function public.ai_record_call(uuid, date, int, int) from anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Watching the bill
--
-- Run this whenever you want to know what the month has cost. Rates are
-- Claude Haiku 4.5: $1 per million input tokens, $5 per million output.
-- ═══════════════════════════════════════════════════════════════════════════

--   select month,
--          count(*)                                      as users,
--          sum(calls)                                    as calls,
--          sum(input_tokens)                             as in_tokens,
--          sum(output_tokens)                            as out_tokens,
--          round((sum(input_tokens)  / 1e6 * 1.00)::numeric +
--                (sum(output_tokens) / 1e6 * 5.00)::numeric, 4) as usd
--   from public.ai_usage
--   group by month
--   order by month desc;
