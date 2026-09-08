-- ── Deadline reminders and push endpoints ──
-- Run this once in the Supabase dashboard: SQL Editor → New query → Run.
-- Safe to re-run; every statement here is idempotent.
--
-- Two tables, both deliberately separate from user_profiles, for the same
-- reason leaderboard_entries is — and here the reason is sharper.
--
-- user_profiles holds each user's entire AppState in a jsonb blob: every log,
-- note, task, plan and streak. The reminder sender runs as the service role and
-- therefore bypasses row-level security completely. If it read user_profiles to
-- work out what was due, it would be a cron job with unrestricted read access to
-- every user's private life, running every minute, forever.
--
-- So it never sees that table. The client decides what is due and publishes the
-- two strings it wants read back to it on its own lock screen. The sender reads
-- a row, sends it, marks it sent, and cannot learn anything about a task whose
-- owner did not hand it over. Everything the feature needs, and no part of the
-- blob.


-- ═══════════════════════════════════════════════════════════════════════════
-- push_subscriptions — where to deliver
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.push_subscriptions (
  -- The endpoint is the natural key, not the user. One person with a phone, a
  -- laptop and a tablet is three rows, and re-subscribing on the phone must
  -- replace THAT device's row rather than add a fourth.
  endpoint      text        primary key,
  user_id       uuid        not null references auth.users (id) on delete cascade,
  -- The browser's public key and auth secret for this subscription. Required to
  -- encrypt the payload; useless to anyone without the VAPID private key.
  p256dh        text        not null,
  auth          text        not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  -- Consecutive send failures. The sender drops an endpoint at 5 rather than
  -- retrying a dead browser forever.
  failure_count int         not null default 0
);

-- The only query the sender makes against this table.
create index if not exists push_subscriptions_by_user
  on public.push_subscriptions (user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- due_reminders — what to say, and when
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.due_reminders (
  -- The client's fire key, `taskId@instant`. Being the primary key is what
  -- makes the client's reconciler safe to run as often as it likes:
  -- republishing the same fire is an upsert and can never create a duplicate.
  id         text        primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  -- The local fire instant plus PUSH_LAG_MS (see reminders/publish.ts). An app
  -- that is open fires locally and deletes this row before the lag expires, so
  -- the server only ever sends for an app that was genuinely shut.
  fire_at    timestamptz not null,
  title      text        not null,
  body       text        not null default '',
  -- Set when the sender claims the row. Never null-ed, and never deleted by the
  -- client: it is the record of what the user was actually told.
  sent_at    timestamptz,
  created_at timestamptz not null default now(),

  -- Self-reported task text, echoed straight onto a lock screen. Bounded here
  -- rather than trusted, the same way display_name is on the leaderboard.
  constraint reminder_title_len check (char_length(title) between 1 and 120),
  constraint reminder_body_len  check (char_length(body) <= 200),
  -- A row this far out is a client with a broken clock, not a deadline. The
  -- publisher only ever writes a 7-day horizon.
  constraint reminder_horizon   check (fire_at < now() + interval '400 days')
);

-- The only query the sender makes: unsent, and due. Partial, because within a
-- day of shipping the table is mostly sent rows and indexing those is dead
-- weight the writer pays for on every insert.
create index if not exists due_reminders_pending
  on public.due_reminders (fire_at)
  where sent_at is null;

create index if not exists due_reminders_by_user
  on public.due_reminders (user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- Row-level security
--
-- A user may only ever see and write their own rows. The Edge Function does NOT
-- go through any of this — it holds the service role key and bypasses RLS by
-- design, which is why it must filter on `sent_at is null and fire_at <= now()`
-- itself, and why it must never accept a user_id from a request body. Its only
-- input is the shared secret in the Authorization header.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.push_subscriptions enable row level security;
alter table public.due_reminders      enable row level security;

drop policy if exists "own push subscriptions readable" on public.push_subscriptions;
create policy "own push subscriptions readable"
  on public.push_subscriptions for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "own push subscriptions writable" on public.push_subscriptions;
create policy "own push subscriptions writable"
  on public.push_subscriptions for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "own push subscriptions updatable" on public.push_subscriptions;
create policy "own push subscriptions updatable"
  on public.push_subscriptions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own push subscriptions deletable" on public.push_subscriptions;
create policy "own push subscriptions deletable"
  on public.push_subscriptions for delete to authenticated
  using (auth.uid() = user_id);

drop policy if exists "own reminders readable" on public.due_reminders;
create policy "own reminders readable"
  on public.due_reminders for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "own reminders writable" on public.due_reminders;
create policy "own reminders writable"
  on public.due_reminders for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "own reminders updatable" on public.due_reminders;
create policy "own reminders updatable"
  on public.due_reminders for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own reminders deletable" on public.due_reminders;
create policy "own reminders deletable"
  on public.due_reminders for delete to authenticated
  using (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- Scheduling
--
-- Run this AFTER `supabase functions deploy send-reminders --no-verify-jwt`.
-- Replace <CRON_SECRET> with the same value passed to `supabase secrets set`,
-- and <PROJECT_REF> with the project ref.
--
-- The secret goes into Vault rather than inline in the cron command, because
-- cron.job is readable in the dashboard and an inline secret there is a
-- publicly-callable "send everybody their notifications now" button waiting to
-- be found.
-- ═══════════════════════════════════════════════════════════════════════════

-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select vault.create_secret('<CRON_SECRET>', 'reminders_cron_secret');
--
-- select cron.schedule('send-due-reminders', '* * * * *', $$
--   select net.http_post(
--     url := 'https://<PROJECT_REF>.supabase.co/functions/v1/send-reminders',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (
--         select decrypted_secret from vault.decrypted_secrets
--         where name = 'reminders_cron_secret'
--       )
--     )
--   );
-- $$);
