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
-- admins included. Deletion is delete_race_message() below: a soft delete
-- that blanks the body, so no client ever UPDATEs a message directly.


-- ═══════════════════════════════════════════════════════════════════════════
-- Replies, reactions and deletion
--
-- Same shape as group chat (supabase/groups.sql), for the same reasons:
--   · a reply stores only `reply_to`; the quote is never copied, so deleting
--     the original blanks every quote of it;
--   · one reaction per person per message, a fixed emoji set, written only by
--     an RPC; taking one back sets `emoji` to null instead of deleting the
--     row, because Realtime can neither filter DELETEs nor apply RLS to them;
--   · deletion is a soft delete that blanks the body, so open panels get an
--     UPDATE and nobody holds text the server has forgotten.
-- Re-runnable: run the whole file again any time.
-- ═══════════════════════════════════════════════════════════════════════════

-- A deleted message has an empty body, which the old CHECK refused.
alter table public.race_chat_messages drop constraint if exists message_length;
alter table public.race_chat_messages
  add constraint message_length
  check (deleted_at is not null or char_length(trim(message)) between 1 and 500);

-- Set null, not cascade: a reply outlives the account it quoted.
alter table public.race_chat_messages
  add column if not exists reply_to uuid references public.race_chat_messages (id) on delete set null;
create index if not exists race_chat_messages_reply_to
  on public.race_chat_messages (reply_to) where reply_to is not null;

-- Every insert arrives live: a client cannot post a message pre-deleted, nor
-- (with a forged deleted_by) one that blames somebody else. A reply must
-- answer a message in the same race. Definer, so a parent the sender cannot
-- see (a hidden racer's) is still found and checked rather than refused.
create or replace function public.race_chat_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.deleted_at := null;
  new.deleted_by := null;
  new.created_at := now();
  if new.reply_to is not null and not exists (
    select 1 from public.race_chat_messages p
     where p.id = new.reply_to and p.race_date = new.race_date
  ) then
    raise exception 'reply must be to a message in the same race' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists race_chat_before_insert on public.race_chat_messages;
create trigger race_chat_before_insert
  before insert on public.race_chat_messages
  for each row execute function public.race_chat_before_insert();

-- `race_date` is copied from the message by react_to_race_message(), never
-- sent by a client; it lets the realtime filter and the hidden-racer policy
-- name the race without a join.
create table if not exists public.race_chat_reactions (
  message_id uuid        not null references public.race_chat_messages (id) on delete cascade,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  race_date  date        not null,
  emoji      text,
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id),
  -- Mirrors REACTIONS in chat/reactions.ts, byte for byte (❤️ carries U+FE0F).
  constraint race_reaction_emoji check (emoji is null or emoji in ('👍', '❤️', '😂', '😮', '😢', '🔥'))
);

create index if not exists race_chat_reactions_by_race on public.race_chat_reactions (race_date);

alter table public.race_chat_reactions enable row level security;

-- Readable exactly as widely as the messages. No write policy at all: the
-- only writer is react_to_race_message().
drop policy if exists "race reactions are readable by signed-in users" on public.race_chat_reactions;
create policy "race reactions are readable by signed-in users"
  on public.race_chat_reactions for select
  to authenticated
  using (true);

-- A hidden racer's reactions go with their messages (moderation.sql). Guarded,
-- so this file still installs before moderation.sql; moderation.sql creates
-- the same policy, so the order the two are run in does not matter.
do $$
begin
  if to_regprocedure('public.leaderboard_row_visible(uuid, date)') is not null then
    execute 'drop policy if exists "hidden racers'' reactions are not shown" on public.race_chat_reactions';
    execute 'create policy "hidden racers'' reactions are not shown"
               on public.race_chat_reactions as restrictive for select
               to authenticated
               using (public.leaderboard_row_visible(user_id, race_date))';
  end if;
end $$;

-- Soft delete: your own message, or anyone's if you are app staff. The staff
-- check goes through EXECUTE so this file installs without admin.sql.
create or replace function public.delete_race_message(p_message uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  msg public.race_chat_messages;
  staff boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select * into msg from public.race_chat_messages where id = p_message;
  if not found or msg.deleted_at is not null then
    return;
  end if;
  if msg.user_id <> auth.uid() then
    if to_regprocedure('public.is_admin()') is not null then
      execute 'select public.is_admin()' into staff;
    end if;
    if not coalesce(staff, false) then
      raise exception 'not authorized' using errcode = '42501';
    end if;
  end if;
  update public.race_chat_messages
     set message = '', deleted_at = now(), deleted_by = auth.uid()
   where id = p_message;
  -- A deleted message keeps no reactions. UPDATEs, for the realtime reason above.
  update public.race_chat_reactions
     set emoji = null, updated_at = now()
   where message_id = p_message and emoji is not null;
end;
$$;

-- React, change your reaction, or take it back (p_emoji null). Returns the
-- row as stored so the client merges it by `updated_at` like any realtime
-- event. A banned racer cannot chat, so cannot react either.
create or replace function public.react_to_race_message(p_message uuid, p_emoji text)
returns public.race_chat_reactions
language plpgsql
security definer
set search_path = public
as $$
declare
  msg    public.race_chat_messages;
  r      public.race_chat_reactions;
  banned boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if to_regprocedure('public.leaderboard_banned()') is not null then
    execute 'select public.leaderboard_banned()' into banned;
    if coalesce(banned, false) then
      raise exception 'not authorized' using errcode = '42501';
    end if;
  end if;
  select * into msg from public.race_chat_messages where id = p_message;
  if not found then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  if msg.deleted_at is not null then
    raise exception 'message deleted' using errcode = 'P0001', hint = 'message_deleted';
  end if;

  -- A floor per row stops a script toggling one reaction in a loop.
  select * into r from public.race_chat_reactions
   where message_id = p_message and user_id = auth.uid();
  if found and r.updated_at > now() - interval '300 milliseconds' then
    raise exception 'slow down' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  if p_emoji is null and (not found or r.emoji is null) then
    return r;
  end if;

  insert into public.race_chat_reactions (message_id, user_id, race_date, emoji, updated_at)
  values (p_message, auth.uid(), msg.race_date, p_emoji, now())
  on conflict (message_id, user_id)
  do update set emoji = excluded.emoji, updated_at = now()
  returning * into r;
  return r;
end;
$$;

-- Supabase grants EXECUTE to anon by name, so revoke from both.
revoke all on function public.delete_race_message(uuid) from public, anon;
revoke all on function public.react_to_race_message(uuid, text) from public, anon;
revoke all on function public.race_chat_before_insert() from public, anon, authenticated;
grant execute on function public.delete_race_message(uuid) to authenticated;
grant execute on function public.react_to_race_message(uuid, text) to authenticated;

-- Realtime: both tables must be in the publication, or nothing reaches an
-- open Race Chat panel — messages and deletions on the first, reactions on
-- the second. Guarded so the file stays re-runnable (a bare ADD TABLE errors
-- the second time).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'race_chat_messages'
  ) then
    alter publication supabase_realtime add table public.race_chat_messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'race_chat_reactions'
  ) then
    alter publication supabase_realtime add table public.race_chat_reactions;
  end if;
end $$;
