-- ── Race chat ──
-- Run this once in the Supabase dashboard: SQL Editor → New query → Run.
--
-- One chat room per Race — and the Race already has an identifier, it just
-- isn't a table row. `getISTDateString()` (utils.ts) is the IST *study day*,
-- shifted so it rolls over at 04:00 IST rather than midnight; that exact
-- string is what `leaderboard_entries.date` is keyed on (see
-- leaderboard_daily_history.sql) and what RaceState.date carries. A message
-- belongs to a race the same way a leaderboard row does: by carrying that
-- date. There is deliberately no `races` table to point a foreign key at —
-- introducing one would be a second, competing definition of "which race is
-- this" alongside the one the leaderboard already trusts.
--
-- Because the date only advances at 4 AM, "today's chat" and "today's board"
-- roll over in the same instant, by the same client-side clock check, with no
-- extra logic anywhere.

create table if not exists public.race_chat_messages (
  id           uuid        primary key default gen_random_uuid(),
  -- The client sends the same getISTDateString() value it publishes its
  -- leaderboard row under. Postgres coerces the 'YYYY-MM-DD' text to date.
  race_date    date        not null,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  -- Denormalized, exactly like leaderboard_entries.display_name: there is no
  -- profiles table in this app to join against, and a message should keep
  -- reading back under the name it was sent with, not whatever the account is
  -- called by the time someone scrolls up to it.
  display_name text        not null,
  message      text        not null,
  created_at   timestamptz not null default now(),

  -- Not read or written anywhere yet — message deletion isn't a feature of
  -- Tracker Alpha today. Here so that if it becomes one, it's a policy
  -- referencing public.is_admin() (supabase/admin.sql) plus a client-side
  -- filter, not a migration.
  deleted_at   timestamptz,
  deleted_by   uuid references auth.users (id),

  constraint display_name_length check (char_length(trim(display_name)) between 2 and 24),
  -- Mirrors chatApi.ts's MAX_MESSAGE. A lightweight race-day chat, not a
  -- messaging app — long enough for real conversation, short enough that one
  -- message can't fill the panel.
  constraint message_length check (char_length(trim(message)) between 1 and 500)
);

-- The only query the app makes: one race's messages, oldest first.
create index if not exists race_chat_messages_by_race
  on public.race_chat_messages (race_date, created_at);

alter table public.race_chat_messages enable row level security;

-- Anyone signed in can read any race's messages — the same openness
-- leaderboard_entries already gives the board itself. The client only ever
-- asks for the current race_date (see leaderboard/chatApi.ts); nothing here
-- restricts by date, because there is nothing in an old day's chat that isn't
-- already true of today's.
drop policy if exists "race chat is readable by signed-in users" on public.race_chat_messages;
create policy "race chat is readable by signed-in users"
  on public.race_chat_messages for select
  to authenticated
  using (true);

-- You may only ever post as yourself. auth.uid() comes from the verified JWT,
-- so a user cannot send a message under someone else's identity by editing
-- the request payload.
drop policy if exists "users insert their own race chat message" on public.race_chat_messages;
create policy "users insert their own race chat message"
  on public.race_chat_messages for insert
  to authenticated
  with check (auth.uid() = user_id);

-- No update or delete policy — under RLS that denies both to every client,
-- admins included. Message editing/deletion isn't part of Tracker Alpha yet;
-- when it is, it's one more policy here (`using (public.is_admin())`) plus
-- the deleted_at/deleted_by columns above, not a new table or a rewrite of
-- this one.

-- Realtime: this table must be added to the publication, or inserts never
-- reach anyone's open Race Chat panel. Table Editor → race_chat_messages →
-- toggle "Realtime" does the same thing as the line below.
alter publication supabase_realtime add table public.race_chat_messages;
