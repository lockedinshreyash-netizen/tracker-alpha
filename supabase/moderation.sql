-- ── Moderation: removals, with a reason the removed person is shown ──
-- Run this once in the Supabase dashboard: SQL Editor → New query → Run.
-- Re-running the whole file is safe.
--
-- Needs admin.sql (is_admin), groups.sql and leaderboard.sql to have been run
-- first. Run order for this change: groups.sql (remove_member gained a reason),
-- then this file, then deploy the client. The previous client keeps working in
-- between — the new argument defaults.
--
-- Two kinds of person can remove somebody:
--
--   a group's owner/admin  — from their own group, through remove_member() in
--                            groups.sql, exactly as before; it now also writes
--                            a notice.
--   app staff (is_admin)   — from any PUBLIC group, and from the Ranks race.
--                            Private groups stay out of staff's reach, for the
--                            reason delete_group() gives: staff cannot see
--                            them, and a moderation power over something you
--                            cannot see is surveillance with extra steps.
--
-- Every removal writes one row to `moderation_notices`, which is how the
-- person learns it happened and why. The reason is optional — a removal with
-- no reason still tells them they were removed, because finding a group gone
-- from your list with no explanation reads as the app being broken.
--
-- The one exception is a HIDE (§3b): staff taking somebody off everyone
-- else's view of the race for a set time, without telling them. That writes
-- no notice at all — being silent is the whole of what it is for.
--
-- What a notice never says: WHO did it. A group notice says "an admin of X";
-- a staff notice says "Tracker Alpha". Most users are minors, and naming the
-- person who removed them is handing them somebody to go after.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Notices
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.moderation_notices (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  kind       text        not null,
  -- The group's name when it happened. A snapshot rather than a foreign key:
  -- the notice has to outlive the membership, and often the group too.
  context    text,
  reason     text,
  -- Staff, or a group's own admins. The only thing said about the remover.
  by_staff   boolean     not null default false,
  created_at timestamptz not null default now(),
  read_at    timestamptz,

  constraint moderation_notice_kind check (kind in (
    'group_removed', 'group_banned', 'leaderboard_removed', 'leaderboard_banned'
  )),
  -- Mirrors moderation/api.ts's MAX_REASON.
  constraint moderation_notice_reason_length check (reason is null or char_length(reason) between 1 and 500),
  constraint moderation_notice_context_length check (context is null or char_length(context) <= 64)
);

-- The only query the app makes: my unread notices.
create index if not exists moderation_notices_unread
  on public.moderation_notices (user_id, created_at) where read_at is null;

alter table public.moderation_notices enable row level security;

-- Your own notices, and nobody else's — staff included. A notice is addressed
-- to one person; the console has no reason to read it back.
drop policy if exists "read own notices" on public.moderation_notices;
create policy "read own notices"
  on public.moderation_notices for select
  to authenticated
  using (auth.uid() = user_id);

-- No insert/update/delete policies. Only the definer functions below write
-- here: a client able to insert could forge a "removed by staff" notice into
-- its own inbox, and one able to update could rewrite the reason it was given.

-- Internal. Called by every removal path, including remove_member() in
-- groups.sql. Revoked from every client role in §5 — a caller with EXECUTE on
-- this could write a notice into anybody's inbox.
create or replace function public.record_moderation_notice(
  p_user     uuid,
  p_kind     text,
  p_context  text,
  p_reason   text,
  p_by_staff boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.moderation_notices (user_id, kind, context, reason, by_staff)
  values (
    p_user,
    p_kind,
    left(p_context, 64),
    left(nullif(trim(p_reason), ''), 500),
    p_by_staff
  );
end;
$$;

-- Marking read. A function rather than an UPDATE policy, because a policy
-- cannot limit WHICH columns change and this must never touch the reason.
create or replace function public.ack_moderation_notice(p_notice uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.moderation_notices
     set read_at = now()
   where id = p_notice and user_id = auth.uid() and read_at is null;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Staff, in public groups
-- ═══════════════════════════════════════════════════════════════════════════

-- Who is in a public group. Ids and roles only; names come from `profiles`,
-- which is already readable by any signed-in user. Nothing a membership would
-- reveal — hours, tasks, chat — is returned here.
create or replace function public.staff_group_members(p_group uuid)
returns table (user_id uuid, role text, joined_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin()
     or not exists (select 1 from public.groups where id = p_group and visibility = 'discoverable') then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select m.user_id, m.role, m.joined_at
      from public.group_members m
     where m.group_id = p_group
     order by public.role_rank(m.role) desc, m.joined_at;
end;
$$;

-- Staff may remove anyone from a public group, owner included — the
-- succession trigger in groups.sql hands the group on, and deletes it if
-- nobody is left. A ban is a group ban like any other; the group's own admins
-- can lift it from their settings.
create or replace function public.staff_remove_group_member(
  p_group  uuid,
  p_user   uuid,
  p_ban    boolean default false,
  p_reason text    default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  group_name text;
begin
  if not public.is_admin() or p_user = auth.uid() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select name into group_name from public.groups where id = p_group and visibility = 'discoverable';
  if group_name is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.group_members where group_id = p_group and user_id = p_user) then
    return;
  end if;

  if p_ban then
    insert into public.group_bans (group_id, user_id, banned_by)
    values (p_group, p_user, auth.uid())
    on conflict (group_id, user_id) do nothing;
  end if;
  delete from public.group_members where group_id = p_group and user_id = p_user;

  perform public.record_moderation_notice(
    p_user, case when p_ban then 'group_banned' else 'group_removed' end, group_name, p_reason, true
  );
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Staff, on the Ranks race
--
-- Deleting somebody's leaderboard row on its own does nothing: their app
-- republishes it within a minute. So a removal is a row here, and the two
-- restrictive policies below refuse every publish while it exists.
--
--   removed (banned = false) — lasts until the person chooses to rejoin, which
--                              calls rejoin_leaderboard() and clears it. The
--                              app turns their race off when the notice lands,
--                              so nothing publishes behind their back.
--   banned  (banned = true)  — lasts until staff lift it. rejoin refuses.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.leaderboard_blocks (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  banned       boolean     not null default false,
  -- The name they were racing under, so the console's ban list says who.
  display_name text,
  reason       text,
  blocked_by   uuid        references auth.users (id) on delete set null,
  blocked_at   timestamptz not null default now()
);

alter table public.leaderboard_blocks enable row level security;

-- Your own row (so the app can tell you why you cannot rejoin), and staff.
drop policy if exists "read own block or all as staff" on public.leaderboard_blocks;
create policy "read own block or all as staff"
  on public.leaderboard_blocks for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- No write policies. Changes only through the functions below.

create or replace function public.leaderboard_blocked()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.leaderboard_blocks where user_id = auth.uid());
$$;

create or replace function public.leaderboard_banned()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.leaderboard_blocks where user_id = auth.uid() and banned);
$$;

-- RESTRICTIVE, so they AND with leaderboard.sql's own policies instead of
-- replacing them — and under their own names, so re-running leaderboard.sql
-- cannot quietly drop them. Upsert is INSERT … ON CONFLICT DO UPDATE, so both
-- halves are covered.
drop policy if exists "blocked users cannot publish" on public.leaderboard_entries;
create policy "blocked users cannot publish"
  on public.leaderboard_entries as restrictive for insert
  to authenticated
  with check (not public.leaderboard_blocked());

drop policy if exists "blocked users cannot republish" on public.leaderboard_entries;
create policy "blocked users cannot republish"
  on public.leaderboard_entries as restrictive for update
  to authenticated
  using (not public.leaderboard_blocked())
  with check (not public.leaderboard_blocked());

-- A ban from the race is a ban from its chat. A plain removal is not: it is
-- a nudge off today's board, not a mute.
drop policy if exists "banned racers cannot chat" on public.race_chat_messages;
create policy "banned racers cannot chat"
  on public.race_chat_messages as restrictive for insert
  to authenticated
  with check (not public.leaderboard_banned());

-- `p_date` is the study day on the board staff are looking at. The client
-- sends it for the reason leaderboard.sql gives: Postgres' own date is UTC and
-- rolls over at the wrong hour. Only that day's row goes — earlier days are
-- history the person's profile totals are built from.
create or replace function public.staff_remove_from_leaderboard(
  p_user   uuid,
  p_date   date,
  p_ban    boolean default false,
  p_reason text    default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  racer_name text;
begin
  if not public.is_admin() or p_user = auth.uid() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select display_name into racer_name
    from public.leaderboard_entries
   where user_id = p_user
   order by date desc
   limit 1;

  delete from public.leaderboard_entries where user_id = p_user and date = p_date;

  -- A ban is never downgraded by a later plain removal.
  insert into public.leaderboard_blocks (user_id, banned, display_name, reason, blocked_by)
  values (p_user, p_ban, racer_name, left(nullif(trim(p_reason), ''), 500), auth.uid())
  on conflict (user_id) do update
     set banned       = public.leaderboard_blocks.banned or excluded.banned,
         display_name = coalesce(excluded.display_name, public.leaderboard_blocks.display_name),
         reason       = excluded.reason,
         blocked_by   = excluded.blocked_by,
         blocked_at   = now();

  perform public.record_moderation_notice(
    p_user, case when p_ban then 'leaderboard_banned' else 'leaderboard_removed' end, null, p_reason, true
  );
end;
$$;

create or replace function public.staff_unban_leaderboard(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  delete from public.leaderboard_blocks where user_id = p_user;
end;
$$;

-- The person choosing to race again. Clears a plain removal; refuses a ban.
-- Returns a status rather than raising, so the app can say which.
create or replace function public.rejoin_leaderboard()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.leaderboard_blocks where user_id = auth.uid() and banned) then
    return 'banned';
  end if;
  delete from public.leaderboard_blocks where user_id = auth.uid();
  return 'ok';
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3b. Staff, hiding a racer — silently, for a set time
--
-- Different from a removal in the one way that matters: the person is NOT
-- told, and nothing on their own screen changes. They keep publishing, keep
-- seeing themselves on the board at the place their hours earn, and keep
-- chatting. Everybody else simply does not see them. No notice is written,
-- the hide table is readable by staff alone, and the one row a hidden person
-- can always read is their own — so there is no query they can make whose
-- answer gives it away.
--
-- It is always timed. `hidden_until` is required and the check below lets
-- it run at most 30 days; the policies compare it to now(), so a hide lapses
-- by itself at that instant with nothing to clean up. "Until the next
-- rollover" is simply the next 04:00 IST, computed by the client for the
-- reason leaderboard.sql gives about dates.
--
-- `from_date` is the study day it started on. Only rows from that day on are
-- hidden: earlier days are history other people's profiles already show
-- (profile/profileApi.ts sums them), and a total that suddenly dropped would
-- be a hide anybody could notice.
--
-- The race chat is hidden by the same rule, for the same days. Someone
-- invisible on the board but talking in its chat is a name everybody can see
-- is missing from the standings.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.leaderboard_hides (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  from_date    date        not null,
  hidden_until timestamptz not null,
  -- The name they were racing under, so the console can say who.
  display_name text,
  -- Staff's own note. Never shown to the person — nothing about a hide is.
  note         text,
  hidden_by    uuid        references auth.users (id) on delete set null,
  hidden_at    timestamptz not null default now(),

  constraint leaderboard_hide_note_length check (note is null or char_length(note) <= 500),
  constraint leaderboard_hide_window check (hidden_until > hidden_at and hidden_until <= hidden_at + interval '30 days')
);

alter table public.leaderboard_hides enable row level security;

-- Staff only. Deliberately NOT "own row or staff" like leaderboard_blocks:
-- a hidden person able to read their own row here would be told.
drop policy if exists "staff read hides" on public.leaderboard_hides;
create policy "staff read hides"
  on public.leaderboard_hides for select
  to authenticated
  using (public.is_admin());

-- Whether the caller may see one leaderboard row or race chat message. You
-- always see your own; anyone else's is visible unless a hide covering that
-- day is still running.
create or replace function public.leaderboard_row_visible(p_user uuid, p_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user = auth.uid()
      or not exists (
        select 1 from public.leaderboard_hides h
         where h.user_id = p_user
           and h.hidden_until > now()
           and p_date >= h.from_date
      );
$$;

-- RESTRICTIVE, for the reason given above the publish policies: they AND with
-- leaderboard.sql's and race_chat.sql's "readable by signed-in users".
-- Realtime applies SELECT policies to what it broadcasts, so a hidden
-- person's chat messages are not pushed to anybody else either.
drop policy if exists "hidden racers are not listed" on public.leaderboard_entries;
create policy "hidden racers are not listed"
  on public.leaderboard_entries as restrictive for select
  to authenticated
  using (public.leaderboard_row_visible(user_id, date));

drop policy if exists "hidden racers are not heard" on public.race_chat_messages;
create policy "hidden racers are not heard"
  on public.race_chat_messages as restrictive for select
  to authenticated
  using (public.leaderboard_row_visible(user_id, race_date));

-- Hide, or change a running hide's end. `p_from` is the board's study day,
-- sent by the client. Re-hiding someone already hidden keeps the earlier
-- start, so extending a hide never un-hides a day it already covered.
create or replace function public.staff_hide_from_leaderboard(
  p_user  uuid,
  p_from  date,
  p_until timestamptz,
  p_note  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  racer_name text;
begin
  if not public.is_admin() or p_user = auth.uid() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_until <= now() or p_until > now() + interval '30 days' then
    raise exception 'hide must end within 30 days' using errcode = '22023';
  end if;

  select display_name into racer_name
    from public.leaderboard_entries
   where user_id = p_user
   order by date desc
   limit 1;

  insert into public.leaderboard_hides (user_id, from_date, hidden_until, display_name, note, hidden_by)
  values (p_user, p_from, p_until, racer_name, left(nullif(trim(p_note), ''), 500), auth.uid())
  on conflict (user_id) do update
     set from_date    = case when public.leaderboard_hides.hidden_until > now()
                             then least(public.leaderboard_hides.from_date, excluded.from_date)
                             else excluded.from_date end,
         hidden_until = excluded.hidden_until,
         display_name = coalesce(excluded.display_name, public.leaderboard_hides.display_name),
         note         = excluded.note,
         hidden_by    = excluded.hidden_by,
         hidden_at    = now();
end;
$$;

create or replace function public.staff_unhide_leaderboard(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  delete from public.leaderboard_hides where user_id = p_user;
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Realtime
--
-- So a notice lands on a screen that is already open. The SELECT policy above
-- is applied to what Realtime sends, so each subscriber receives their own
-- notices and nothing else. The app also checks on open and on returning to
-- the tab; this is the fast path, not the only one.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'moderation_notices'
  ) then
    alter publication supabase_realtime add table public.moderation_notices;
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Privileges
--
-- Revoked from `anon` by name as well as PUBLIC, for the reason groups.sql §6
-- gives: Supabase grants EXECUTE to `anon` explicitly.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.ack_moderation_notice(uuid)',
    'public.staff_group_members(uuid)',
    'public.staff_remove_group_member(uuid, uuid, boolean, text)',
    'public.staff_remove_from_leaderboard(uuid, date, boolean, text)',
    'public.staff_unban_leaderboard(uuid)',
    'public.rejoin_leaderboard()',
    'public.leaderboard_blocked()',
    'public.leaderboard_banned()',
    'public.leaderboard_row_visible(uuid, date)',
    'public.staff_hide_from_leaderboard(uuid, date, timestamptz, text)',
    'public.staff_unhide_leaderboard(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  execute 'revoke all on function public.record_moderation_notice(uuid, text, text, text, boolean) from public, anon, authenticated';
end $$;
