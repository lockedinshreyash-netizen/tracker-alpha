-- ── Daily study hours leaderboard ──
-- Run this once in the Supabase dashboard: SQL Editor → New query → Run.
--
-- Deliberately a separate table from user_profiles. That table holds each
-- user's entire AppState in a jsonb blob — every log, task and note — so it can
-- never be readable by other users. This one carries only what a leaderboard
-- row needs: a chosen name, a date, and a number.
--
-- One row per user, rewritten each day, rather than a row per user per day.
-- The board only ever shows today, so history here would be dead weight; the
-- user's own history already lives in their profile.

create table if not exists public.leaderboard_entries (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text        not null,
  -- The user's local (IST) date, sent by the client. Postgres' own now() is
  -- UTC and would roll over at 05:30 IST, splitting everyone's evening.
  date         date        not null,
  hours        numeric(5, 2) not null default 0,
  updated_at   timestamptz not null default now(),

  constraint display_name_length check (char_length(trim(display_name)) between 2 and 24),
  -- Self-reported from the client, so bound it to something physically possible.
  constraint hours_sane check (hours >= 0 and hours <= 24)
);

-- The only query the app makes: today's rows, highest first.
create index if not exists leaderboard_entries_daily
  on public.leaderboard_entries (date, hours desc);

alter table public.leaderboard_entries enable row level security;

-- Anyone signed in can read the board. This is the whole point of the feature,
-- and the table holds nothing beyond a self-chosen name and an hour count.
drop policy if exists "leaderboard is readable by signed-in users" on public.leaderboard_entries;
create policy "leaderboard is readable by signed-in users"
  on public.leaderboard_entries for select
  to authenticated
  using (true);

-- You may only ever write your own row. auth.uid() comes from the verified JWT,
-- so a user cannot post hours under someone else's id.
drop policy if exists "users insert their own entry" on public.leaderboard_entries;
create policy "users insert their own entry"
  on public.leaderboard_entries for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users update their own entry" on public.leaderboard_entries;
create policy "users update their own entry"
  on public.leaderboard_entries for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Leaving the board deletes the row outright rather than hiding it.
drop policy if exists "users delete their own entry" on public.leaderboard_entries;
create policy "users delete their own entry"
  on public.leaderboard_entries for delete
  to authenticated
  using (auth.uid() = user_id);
