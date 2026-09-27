-- ── Groups ──
-- Run this once in the Supabase dashboard: SQL Editor → New query → Run.
-- Re-running the whole file is safe. It reads `auth.users` and nothing else
-- from any other migration — `profiles.sql` is only needed for the client to
-- draw names and avatars, and is not referenced from here.
--
-- What a group is: a set of people who have agreed to see some of each
-- other's study data, and to talk. Everything below follows from taking both
-- halves of that seriously.
--
--   "agreed"  → membership is a row, never a JSON array on the group, and the
--               only way to become a row is to redeem an invite server-side.
--               Knowing a group's id buys you nothing.
--   "some"    → joining shares nothing by itself. Hours and tasks are each a
--               separate, per-group switch on the membership row, and the
--               functions that read them for other people check the switch.
--   "talk"    → messages persist in Postgres. Realtime is only the doorbell.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- Why the study data is not read out of `user_profiles`
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The source of truth for a day's hours is `user_profiles.state.logs` — the
-- whole AppState blob. A security-definer function COULD sum it for every
-- member of a group, and that would be the one design here with zero derived
-- data. It is rejected for the same reason `leaderboard.sql` and
-- `reminders.sql` give: a function that can read that blob for other users is
-- a function that can read everybody's entire private life, and a single bug
-- in its membership check leaks all of it. It would also detoast every
-- member's full blob (tasks, schedule, notes, question logs) to add up one
-- number.
--
-- So the client publishes a projection, exactly like the Race already does:
-- `study_days` is one row per user per study day — date, two hour totals,
-- nothing else. It is NOT a copy of sessions and it is NOT per group: one row
-- per day however many groups you are in, and every group reads the same row.
-- The client re-derives it from `logs` on every change, so editing or deleting
-- a log corrects the published figure by the same path that wrote it.
--
-- Why not `leaderboard_entries`, which already holds a daily figure? Because
-- that table is readable by every signed-in user and joining it is an explicit
-- public opt-in. Writing rows there for someone who only joined a friends'
-- group would publish their hours to the whole app.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- Sizing, so nothing here is built for a scale we will not see
-- ═══════════════════════════════════════════════════════════════════════════
--
--   study_days       one row per active user-day. 10,000 users × 365 = 3.65M
--                    rows/year at ~60 bytes: a few hundred MB, all reads by
--                    primary-key range.
--   group_messages   10,000 users / 1,000 groups / 20 per group per day =
--                    20k/day, 7.3M/year. ~250 bytes a row with its index is
--                    ~2GB/year. Every read is an index range scan on
--                    (group_id, id) — the cost of fetching 50 messages does
--                    not change between the first row and the ten-millionth.
--                    The realistic near-term figure is two orders of magnitude
--                    smaller. See the retention note at the bottom.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Tables
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.groups (
  id            uuid        primary key default gen_random_uuid(),
  name          text        not null,
  description   text,
  -- One emoji (or a short glyph sequence — family emoji are several code
  -- points). Rendered as text by React, never as HTML or a URL, so there is
  -- nothing to validate beyond length.
  icon          text,
  -- 'private'      — reachable only by invite. The only value anything sets.
  -- 'discoverable' — metadata (name, icon, description, size) readable by any
  --                  signed-in user, for a future directory. The SELECT policy
  --                  below already honours it; what does not exist yet is a
  --                  way to set it or a join path that skips the invite.
  visibility    text        not null default 'private',
  -- Who may mint invites. Admins always can.
  invite_policy text        not null default 'admins',
  -- History only. Ownership lives on `group_members.role`, never here: two
  -- places saying who the owner is are two places that can disagree, and the
  -- owner leaving or deleting their account must not take the group with it.
  created_by    uuid        references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint group_name_length        check (char_length(trim(name)) between 2 and 48),
  constraint group_description_length check (description is null or char_length(description) <= 280),
  constraint group_icon_length        check (icon is null or char_length(icon) between 1 and 16),
  constraint group_visibility_valid   check (visibility in ('private', 'discoverable')),
  constraint group_invite_policy_valid check (invite_policy in ('admins', 'members'))
);

create table if not exists public.group_members (
  group_id     uuid        not null references public.groups (id) on delete cascade,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  -- A text + CHECK rather than an enum type: adding a role is one ALTER of
  -- this constraint and one line in role_rank(), not an enum migration.
  role         text        not null default 'member',
  joined_at    timestamptz not null default now(),

  -- ── Privacy, per group ──
  -- Both default to sharing nothing. The client asks explicitly at the moment
  -- of joining (with hours pre-ticked, visibly, because a study group whose
  -- board is empty is not a study group) — but a row that reaches the table
  -- by any other path shares nothing.
  share_hours  boolean     not null default false,
  -- 'private' — nothing. 'summary' — "8/10 done today". 'tasks' — the list.
  share_tasks  text        not null default 'private',

  -- The highest message id this member has seen, for an unread count on the
  -- group list. Never exposed to other members (they read membership through
  -- group_members_list(), which does not return it) — it is a read receipt.
  last_read_id bigint      not null default 0,

  primary key (group_id, user_id),
  constraint member_role_valid        check (role in ('owner', 'admin', 'member')),
  constraint member_share_tasks_valid check (share_tasks in ('private', 'summary', 'tasks'))
);

-- "My groups". The primary key leads with group_id and cannot serve it.
create index if not exists group_members_by_user on public.group_members (user_id);
-- Exactly one owner, enforced by the database rather than by every function
-- that touches roles remembering to.
create unique index if not exists group_members_one_owner
  on public.group_members (group_id) where role = 'owner';

-- Removal and banning are different decisions. A removed member can come back
-- with a fresh invite; a banned one cannot, whoever invites them.
create table if not exists public.group_bans (
  group_id  uuid        not null references public.groups (id) on delete cascade,
  user_id   uuid        not null references auth.users (id) on delete cascade,
  banned_by uuid        references auth.users (id) on delete set null,
  banned_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_invites (
  id         uuid        primary key default gen_random_uuid(),
  group_id   uuid        not null references public.groups (id) on delete cascade,
  -- 12 characters of Crockford base32 (no I, L, O, U — nothing to misread off
  -- a phone screen) = 60 bits from gen_random_uuid()'s CSPRNG. Stored in the
  -- clear so an admin can copy the link again tomorrow; readable only by the
  -- group's admins and the invite's own creator (policy below). The redeem
  -- path never reads this table through RLS — it goes through a definer
  -- function that is also rate-limited per user.
  code       text        not null unique,
  created_by uuid        references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses   int,
  uses       int         not null default 0,
  revoked_at timestamptz,

  constraint invite_code_shape check (code ~ '^[0-9A-HJKMNP-TV-Z]{12}$'),
  constraint invite_max_uses   check (max_uses is null or max_uses between 1 and 1000),
  constraint invite_uses       check (uses >= 0 and (max_uses is null or uses <= max_uses))
);

create index if not exists group_invites_by_group on public.group_invites (group_id);

-- Failed redemptions per user, for the brute-force throttle. No policies at
-- all: only the definer functions below ever read or write it.
create table if not exists public.group_invite_attempts (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  window_start timestamptz not null default now(),
  failures     int         not null default 0
);

create table if not exists public.group_messages (
  -- A bigint identity rather than a uuid: it is a total order that two
  -- messages sent in the same millisecond cannot tie on, it is the pagination
  -- cursor by itself (`id < oldest`), and it is half the index width.
  id         bigint      generated always as identity primary key,
  group_id   uuid        not null references public.groups (id) on delete cascade,
  -- Cascade, not set-null: a deleted account takes its words with it. Most
  -- users are minors, and "your messages outlive your account" is not a
  -- promise this app should make on their behalf.
  sender_id  uuid        not null references auth.users (id) on delete cascade,
  -- Generated by the sending client, once per message, and reused on retry.
  -- The unique constraint below turns "did my send land before the network
  -- dropped?" into a question the database answers: a retry either inserts
  -- or fails with 23505, and in both cases exactly one row exists. It is also
  -- how the sender's optimistic bubble is matched to its realtime echo.
  client_id  uuid        not null,
  body       text        not null,
  -- Forced to now() by the insert trigger; a client cannot backdate.
  created_at timestamptz not null default now(),
  -- Soft delete, and a real one: the text is blanked in the same UPDATE. The
  -- row stays so every open client receives the change as an UPDATE and can
  -- replace the bubble with "message deleted", rather than holding on to a
  -- message the server has forgotten.
  deleted_at timestamptz,
  deleted_by uuid        references auth.users (id) on delete set null,

  constraint message_body check (
    (deleted_at is null and char_length(trim(body)) between 1 and 1000)
    or (deleted_at is not null and body = '')
  ),
  constraint message_client_unique unique (sender_id, client_id)
);

-- The only access path chat has: one group's messages by id, in either
-- direction (latest page, older page, catch-up). A btree scans backwards as
-- cheaply as forwards, so no separate DESC index.
create index if not exists group_messages_by_group on public.group_messages (group_id, id);
-- The flood guard's lookup. The unique (sender_id, client_id) index already
-- covers the account-deletion cascade but cannot answer "how many in the last
-- 30 seconds".
create index if not exists group_messages_by_sender_time on public.group_messages (sender_id, created_at);

-- One row per user per IST study day. See the header for why this exists.
create table if not exists public.study_days (
  user_id       uuid          not null references auth.users (id) on delete cascade,
  -- getISTDateString(): the 04:00-IST study day, the same key the Race uses.
  date          date          not null,
  -- Every logged hour, any source.
  hours         numeric(5, 2) not null default 0,
  -- Stopwatch and Pomodoro only — what groups rank on, for the reason the
  -- Race gives: a board anybody can type their way to the top of is not one.
  -- Both are kept so a group could choose to count manual hours later without
  -- a migration.
  tracked_hours numeric(5, 2) not null default 0,
  updated_at    timestamptz   not null default now(),

  primary key (user_id, date),
  constraint study_hours_sane check (
    hours between 0 and 24 and tracked_hours between 0 and 24 and tracked_hours <= hours
  )
);

-- Today's task board, as much of it as the user has agreed to share with at
-- least one group. One row per user, overwritten — only "today" is ever shown.
create table if not exists public.task_shares (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  date       date        not null,
  done       int         not null default 0,
  total      int         not null default 0,
  -- [{ "text", "done", "subject"? }]. Null unless at least one membership is
  -- set to 'tasks'; the client clears it the moment none is.
  tasks      jsonb,
  updated_at timestamptz not null default now(),

  constraint task_counts_sane check (done >= 0 and total >= done and total <= 500),
  constraint task_list_shape  check (
    tasks is null
    or (jsonb_typeof(tasks) = 'array' and jsonb_array_length(tasks) <= 50 and pg_column_size(tasks) <= 16000)
  )
);


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Predicates
--
-- `security definer` for the reason `is_admin()` gives in admin.sql: these
-- read `group_members`, and are referenced by policies that sit on it and on
-- tables it guards. A definer function reads the table directly and no policy
-- recursion forms. Each answers only about `auth.uid()`, from the verified JWT.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.role_rank(p_role text)
returns int
language sql
immutable
as $$
  select case p_role when 'owner' then 3 when 'admin' then 2 when 'member' then 1 else 0 end;
$$;

create or replace function public.group_role(p_group uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.group_members where group_id = p_group and user_id = auth.uid();
$$;

create or replace function public.is_group_member(p_group uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members where group_id = p_group and user_id = auth.uid()
  );
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Row-level security
--
-- The shape of it: almost nothing is writable directly. Groups, memberships,
-- bans and invites change only through the functions in §5, because every one
-- of those writes needs a rule a policy cannot express cleanly ("an admin may
-- remove a member but not another admin", "a member may change their own
-- sharing but not their own role"). No INSERT/UPDATE/DELETE policy means
-- RLS refuses the operation to every client — the same stance user_roles
-- takes in admin.sql. The two exceptions are the ones where the rule really
-- is "your own row": sending a message, and publishing your own study data.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.groups                enable row level security;
alter table public.group_members         enable row level security;
alter table public.group_bans            enable row level security;
alter table public.group_invites         enable row level security;
alter table public.group_invite_attempts enable row level security;
alter table public.group_messages        enable row level security;
alter table public.study_days            enable row level security;
alter table public.task_shares           enable row level security;

-- groups: members see their group; anybody signed in sees a discoverable one.
drop policy if exists "members read their groups" on public.groups;
create policy "members read their groups"
  on public.groups for select
  to authenticated
  using (visibility = 'discoverable' or public.is_group_member(id));

-- group_members: your own rows only. Co-members are listed by
-- group_members_list(), which leaves out last_read_id.
drop policy if exists "users read their own memberships" on public.group_members;
create policy "users read their own memberships"
  on public.group_members for select
  to authenticated
  using (user_id = auth.uid());

-- group_bans: the group's admins.
drop policy if exists "group admins read bans" on public.group_bans;
create policy "group admins read bans"
  on public.group_bans for select
  to authenticated
  using (public.role_rank(public.group_role(group_id)) >= 2);

-- group_invites: the group's admins, and a member reading invites they made
-- themselves (under invite_policy = 'members'). Membership is re-checked so a
-- removed member cannot keep listing the codes they minted.
drop policy if exists "admins and creators read invites" on public.group_invites;
create policy "admins and creators read invites"
  on public.group_invites for select
  to authenticated
  using (
    public.role_rank(public.group_role(group_id)) >= 2
    or (created_by = auth.uid() and public.is_group_member(group_id))
  );

-- group_messages: members read; members post as themselves. This SELECT
-- policy is also what authorizes realtime — Supabase evaluates it per
-- subscriber for every change on a table in the publication, so a
-- non-member's subscription with `group_id=eq.<X>` receives nothing, whatever
-- the client code does.
drop policy if exists "members read group messages" on public.group_messages;
create policy "members read group messages"
  on public.group_messages for select
  to authenticated
  using (public.is_group_member(group_id));

drop policy if exists "members post as themselves" on public.group_messages;
create policy "members post as themselves"
  on public.group_messages for insert
  to authenticated
  with check (sender_id = auth.uid() and public.is_group_member(group_id));
-- No UPDATE or DELETE policy. Deletion is delete_group_message(), which is
-- the only way `deleted_at` is ever set and never lets a body be rewritten.

-- study_days / task_shares: your own rows, all operations. Other members read
-- them only through group_leaderboard() / group_task_progress(), which apply
-- the per-group sharing switches. A date more than a day ahead of IST is
-- refused — a clock-skewed device must not publish tomorrow.
drop policy if exists "users read their own study days" on public.study_days;
create policy "users read their own study days"
  on public.study_days for select to authenticated using (user_id = auth.uid());
drop policy if exists "users insert their own study days" on public.study_days;
create policy "users insert their own study days"
  on public.study_days for insert to authenticated
  with check (user_id = auth.uid() and date <= (now() at time zone 'Asia/Kolkata')::date + 1);
drop policy if exists "users update their own study days" on public.study_days;
create policy "users update their own study days"
  on public.study_days for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and date <= (now() at time zone 'Asia/Kolkata')::date + 1);
drop policy if exists "users delete their own study days" on public.study_days;
create policy "users delete their own study days"
  on public.study_days for delete to authenticated using (user_id = auth.uid());

drop policy if exists "users read their own task share" on public.task_shares;
create policy "users read their own task share"
  on public.task_shares for select to authenticated using (user_id = auth.uid());
drop policy if exists "users insert their own task share" on public.task_shares;
create policy "users insert their own task share"
  on public.task_shares for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users update their own task share" on public.task_shares;
create policy "users update their own task share"
  on public.task_shares for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users delete their own task share" on public.task_shares;
create policy "users delete their own task share"
  on public.task_shares for delete to authenticated using (user_id = auth.uid());


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Triggers
-- ═══════════════════════════════════════════════════════════════════════════

-- Messages: the server owns the clock and the moderation columns, and a
-- flood guard stops one account filling a group's history. Definer so the
-- count sees every one of the sender's recent rows, not only the ones RLS
-- would show them.
create or replace function public.group_messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.created_at := now();
  new.deleted_at := null;
  new.deleted_by := null;

  if (select count(*) from public.group_messages
       where sender_id = new.sender_id
         and created_at > now() - interval '30 seconds') >= 15 then
    raise exception 'slow down' using errcode = 'P0001', hint = 'rate_limited';
  end if;

  return new;
end;
$$;

drop trigger if exists group_messages_before_insert on public.group_messages;
create trigger group_messages_before_insert
  before insert on public.group_messages
  for each row execute function public.group_messages_before_insert();

-- Succession. Fires on every way a membership row can disappear — leaving,
-- being removed, and the cascade from a deleted account — so there is exactly
-- one place that decides what happens to a group that just lost its owner:
-- the longest-standing admin takes over, else the longest-standing member.
-- A group with nobody left in it is deleted: it is unreachable, and an old
-- invite link must not let a stranger walk into its chat history as its only
-- member.
--
-- When the group itself is being deleted, its member rows go by cascade and
-- this fires for each; the parent row is already gone by then, and the
-- trigger stands aside.
create or replace function public.group_members_after_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  successor uuid;
begin
  if not exists (select 1 from public.groups where id = old.group_id) then
    return null;
  end if;

  if not exists (select 1 from public.group_members where group_id = old.group_id) then
    delete from public.groups where id = old.group_id;
    return null;
  end if;

  if old.role = 'owner' then
    select user_id into successor
      from public.group_members
     where group_id = old.group_id
     order by public.role_rank(role) desc, joined_at asc, user_id
     limit 1;
    update public.group_members set role = 'owner'
     where group_id = old.group_id and user_id = successor;
  end if;

  return null;
end;
$$;

drop trigger if exists group_members_after_delete on public.group_members;
create trigger group_members_after_delete
  after delete on public.group_members
  for each row execute function public.group_members_after_delete();


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Functions — every write, and every read of other people's data
--
-- Each checks the caller's role as its FIRST statement, in the same
-- transaction as the write. Limits are constants here rather than columns;
-- they are there to stop abuse, not to be a product setting.
-- ═══════════════════════════════════════════════════════════════════════════

-- 60 bits from a CSPRNG. gen_random_uuid() is pg_strong_random underneath and
-- is built in, unlike pgcrypto's gen_random_bytes (profiles.sql explains why
-- this project does not lean on pgcrypto). Bytes 0–5 and 9–14 of a v4 uuid
-- are fully random — 6 and 8 carry the version and variant bits and are
-- skipped. 256 is a multiple of 32, so `% 32` has no modulo bias.
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  raw  bytea := uuid_send(gen_random_uuid());
  pos  int;
  code text := '';
begin
  foreach pos in array array[0, 1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 14] loop
    code := code || substr(alphabet, (get_byte(raw, pos) % 32) + 1, 1);
  end loop;
  return code;
end;
$$;

-- Whatever was typed or pasted → the stored shape. Crockford's own decoding
-- rules: O reads as 0, I and L as 1; dashes and spaces are decoration.
create or replace function public.normalize_invite_code(p_code text)
returns text
language sql
immutable
as $$
  select regexp_replace(translate(upper(coalesce(p_code, '')), 'OIL', '011'), '[^0-9A-Z]', '', 'g');
$$;

-- ── Brute-force throttle ──
-- 15 wrong codes in 15 minutes locks that account out of redeeming for the
-- rest of the window. Against a 60-bit space this is belt and braces — even
-- unthrottled, a million guesses against ten thousand live invites succeed
-- with probability ~1e-8 — but it costs one row per user and turns a script
-- into a wall rather than a slow crawl.
create or replace function public.invite_throttled(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_invite_attempts
     where user_id = p_user and failures >= 15 and window_start > now() - interval '15 minutes'
  );
$$;

create or replace function public.invite_note_failure(p_user uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.group_invite_attempts as a (user_id, window_start, failures)
  values (p_user, now(), 1)
  on conflict (user_id) do update
    set failures     = case when a.window_start > now() - interval '15 minutes' then a.failures + 1 else 1 end,
        window_start = case when a.window_start > now() - interval '15 minutes' then a.window_start else now() end;
$$;

-- ── Create ──
create or replace function public.create_group(
  p_name          text,
  p_description   text default null,
  p_icon          text default null,
  p_invite_policy text default 'admins',
  p_share_hours   boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  gid uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.group_members where user_id = uid) >= 30 then
    raise exception 'group limit' using errcode = 'P0001', hint = 'group_limit';
  end if;
  if (select count(*) from public.group_members where user_id = uid and role = 'owner') >= 10 then
    raise exception 'owned group limit' using errcode = 'P0001', hint = 'owned_limit';
  end if;

  insert into public.groups (name, description, icon, invite_policy, created_by)
  values (
    trim(p_name),
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_icon, '')), ''),
    coalesce(p_invite_policy, 'admins'),
    uid
  )
  returning id into gid;

  insert into public.group_members (group_id, user_id, role, share_hours)
  values (gid, uid, 'owner', coalesce(p_share_hours, false));

  return gid;
end;
$$;

-- ── Settings ── admins and the owner. Visibility is deliberately not a
-- parameter yet; see the column comment.
create or replace function public.update_group(
  p_group         uuid,
  p_name          text,
  p_description   text,
  p_icon          text,
  p_invite_policy text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.role_rank(public.group_role(p_group)) < 2 then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  update public.groups
     set name          = trim(p_name),
         description   = nullif(trim(coalesce(p_description, '')), ''),
         icon          = nullif(trim(coalesce(p_icon, '')), ''),
         invite_policy = coalesce(p_invite_policy, invite_policy),
         updated_at    = now()
   where id = p_group;
end;
$$;

-- ── Delete ── the owner only. Members, invites, bans and messages go by cascade.
create or replace function public.delete_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.group_role(p_group) is distinct from 'owner' then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  delete from public.groups where id = p_group;
end;
$$;

-- ── Invites ──
create or replace function public.create_invite(
  p_group         uuid,
  p_expires_hours int default 168,
  p_max_uses      int default null
)
returns public.group_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  my_role text := public.group_role(p_group);
  inv_policy text;
  ttl_hours  int  := p_expires_hours;
  created public.group_invites;
  attempt int  := 0;
begin
  if my_role is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select invite_policy into inv_policy from public.groups where id = p_group;
  if my_role = 'member' and inv_policy <> 'members' then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- "Can a non-admin generate unlimited invites?" No: 25 live per group, and a
  -- plain member may hold 3 of them, each expiring within a week.
  if (select count(*) from public.group_invites
       where group_id = p_group and revoked_at is null
         and (expires_at is null or expires_at > now())
         and (max_uses is null or uses < max_uses)) >= 25 then
    raise exception 'invite limit' using errcode = 'P0001', hint = 'invite_limit';
  end if;

  if my_role = 'member' then
    if (select count(*) from public.group_invites
         where group_id = p_group and created_by = uid and revoked_at is null
           and (expires_at is null or expires_at > now())
           and (max_uses is null or uses < max_uses)) >= 3 then
      raise exception 'invite limit' using errcode = 'P0001', hint = 'invite_limit';
    end if;
    ttl_hours := least(coalesce(ttl_hours, 168), 168);
  end if;

  if ttl_hours is not null then
    ttl_hours := greatest(1, least(ttl_hours, 720));
  end if;

  -- A collision in 2^60 is not going to happen, but the unique constraint is
  -- what makes that true rather than hoped, so retry on it rather than fail.
  loop
    attempt := attempt + 1;
    begin
      insert into public.group_invites (group_id, code, created_by, expires_at, max_uses)
      values (
        p_group,
        public.generate_invite_code(),
        uid,
        case when ttl_hours is null then null else now() + make_interval(hours => ttl_hours) end,
        p_max_uses
      )
      returning * into created;
      return created;
    exception when unique_violation then
      if attempt >= 5 then raise; end if;
    end;
  end loop;
end;
$$;

create or replace function public.revoke_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.group_invites;
begin
  select * into inv from public.group_invites where id = p_invite;
  if not found then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if public.role_rank(public.group_role(inv.group_id)) < 2
     and not (inv.created_by = auth.uid() and public.is_group_member(inv.group_id)) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.group_invites set revoked_at = coalesce(revoked_at, now()) where id = p_invite;
end;
$$;

-- What an invite would do, without doing it — the "you're invited to…" card.
-- Returns a status rather than raising, because a raise would roll back the
-- throttle's failure count along with everything else.
--
-- Group details are revealed only for a code that would actually work, and
-- only to a signed-in caller (EXECUTE is not granted to anon). A revoked,
-- expired or used-up code says which, and nothing about the group behind it.
create or replace function public.preview_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  inv  public.group_invites;
  g    public.groups;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.invite_throttled(uid) then
    return jsonb_build_object('status', 'throttled');
  end if;

  select * into inv from public.group_invites where code = public.normalize_invite_code(p_code);
  if not found then
    perform public.invite_note_failure(uid);
    return jsonb_build_object('status', 'invalid');
  end if;

  if exists (select 1 from public.group_members where group_id = inv.group_id and user_id = uid) then
    return jsonb_build_object('status', 'member', 'group_id', inv.group_id);
  end if;
  if inv.revoked_at is not null then return jsonb_build_object('status', 'revoked'); end if;
  if inv.expires_at is not null and inv.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
  if inv.max_uses is not null and inv.uses >= inv.max_uses then return jsonb_build_object('status', 'exhausted'); end if;
  if exists (select 1 from public.group_bans where group_id = inv.group_id and user_id = uid) then
    return jsonb_build_object('status', 'banned');
  end if;

  select * into g from public.groups where id = inv.group_id;
  return jsonb_build_object(
    'status', 'ok',
    'group', jsonb_build_object(
      'id', g.id,
      'name', g.name,
      'description', g.description,
      'icon', g.icon,
      'member_count', (select count(*) from public.group_members where group_id = g.id)
    )
  );
end;
$$;

-- The only way into a group.
create or replace function public.redeem_invite(p_code text, p_share_hours boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid      uuid := auth.uid();
  inv      public.group_invites;
  inserted int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.invite_throttled(uid) then
    return jsonb_build_object('status', 'throttled');
  end if;

  -- FOR UPDATE serializes redemptions of the same invite, so two people
  -- racing for the last use of a one-use link cannot both get in.
  select * into inv from public.group_invites
   where code = public.normalize_invite_code(p_code)
   for update;
  if not found then
    perform public.invite_note_failure(uid);
    return jsonb_build_object('status', 'invalid');
  end if;

  -- Already in: succeed without spending a use. Opening the same link twice,
  -- or on two devices, is not an error.
  if exists (select 1 from public.group_members where group_id = inv.group_id and user_id = uid) then
    return jsonb_build_object('status', 'member', 'group_id', inv.group_id);
  end if;
  if inv.revoked_at is not null then return jsonb_build_object('status', 'revoked'); end if;
  if inv.expires_at is not null and inv.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
  if inv.max_uses is not null and inv.uses >= inv.max_uses then return jsonb_build_object('status', 'exhausted'); end if;
  if exists (select 1 from public.group_bans where group_id = inv.group_id and user_id = uid) then
    return jsonb_build_object('status', 'banned');
  end if;
  if (select count(*) from public.group_members where group_id = inv.group_id) >= 500 then
    return jsonb_build_object('status', 'full');
  end if;
  if (select count(*) from public.group_members where user_id = uid) >= 30 then
    return jsonb_build_object('status', 'limit');
  end if;

  insert into public.group_members (group_id, user_id, role, share_hours)
  values (inv.group_id, uid, 'member', coalesce(p_share_hours, false))
  on conflict (group_id, user_id) do nothing;
  get diagnostics inserted = row_count;

  if inserted > 0 then
    update public.group_invites set uses = uses + 1 where id = inv.id;
  end if;

  return jsonb_build_object('status', 'joined', 'group_id', inv.group_id);
end;
$$;

-- ── Membership ──
create or replace function public.leave_group(p_group uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Succession, and deleting an emptied group, happen in the trigger.
  delete from public.group_members where group_id = p_group and user_id = auth.uid();
end;
$$;

-- The owner may remove anyone; an admin may remove members. Nobody removes
-- someone of equal or higher rank, and nobody removes themselves this way.
create or replace function public.remove_member(p_group uuid, p_user uuid, p_ban boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  my_rank     int := public.role_rank(public.group_role(p_group));
  target_role text;
begin
  if my_rank < 2 or p_user = auth.uid() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select role into target_role from public.group_members where group_id = p_group and user_id = p_user;
  if target_role is null then
    return;
  end if;
  if public.role_rank(target_role) >= my_rank then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_ban then
    insert into public.group_bans (group_id, user_id, banned_by)
    values (p_group, p_user, auth.uid())
    on conflict (group_id, user_id) do nothing;
  end if;
  delete from public.group_members where group_id = p_group and user_id = p_user;
end;
$$;

create or replace function public.unban_member(p_group uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.role_rank(public.group_role(p_group)) < 2 then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  delete from public.group_bans where group_id = p_group and user_id = p_user;
end;
$$;

-- Promote to admin / demote to member. The owner only.
create or replace function public.set_member_role(p_group uuid, p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.group_role(p_group) is distinct from 'owner' or p_user = auth.uid() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  update public.group_members set role = p_role
   where group_id = p_group and user_id = p_user and role <> 'owner';
end;
$$;

-- Demote first, then promote: the one-owner unique index is checked per row,
-- and doing it the other way round would briefly have two.
create or replace function public.transfer_ownership(p_group uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.group_role(p_group) is distinct from 'owner' or p_user = auth.uid() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if not exists (select 1 from public.group_members where group_id = p_group and user_id = p_user) then
    raise exception 'not a member' using errcode = '22023';
  end if;
  update public.group_members set role = 'admin' where group_id = p_group and user_id = auth.uid();
  update public.group_members set role = 'owner' where group_id = p_group and user_id = p_user;
end;
$$;

-- Your own privacy switches, and nothing else on your own row. An UPDATE
-- policy on group_members could not stop the same request setting `role`.
create or replace function public.set_group_sharing(p_group uuid, p_share_hours boolean, p_share_tasks text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_share_tasks not in ('private', 'summary', 'tasks') then
    raise exception 'invalid sharing level' using errcode = '22023';
  end if;
  update public.group_members
     set share_hours = coalesce(p_share_hours, share_hours),
         share_tasks = p_share_tasks
   where group_id = p_group and user_id = auth.uid();
  if not found then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.mark_group_read(p_group uuid, p_last_id bigint)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.group_members
     set last_read_id = p_last_id
   where group_id = p_group and user_id = auth.uid() and last_read_id < p_last_id;
$$;

-- ── Reads ──

-- The group list: one call, with the counts it shows. Unread stops counting
-- at 100 ("99+"), so a dormant member of a busy group never pays for a count
-- of ten thousand rows.
create or replace function public.my_groups()
returns table (
  id              uuid,
  name            text,
  description     text,
  icon            text,
  visibility      text,
  invite_policy   text,
  created_at      timestamptz,
  role            text,
  share_hours     boolean,
  share_tasks     text,
  joined_at       timestamptz,
  member_count    int,
  unread          int,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select g.id, g.name, g.description, g.icon, g.visibility, g.invite_policy, g.created_at,
         m.role, m.share_hours, m.share_tasks, m.joined_at,
         (select count(*) from public.group_members c where c.group_id = g.id)::int,
         (select count(*) from (
            select 1 from public.group_messages x
             where x.group_id = g.id and x.id > m.last_read_id
               and x.sender_id <> m.user_id and x.deleted_at is null
             limit 100
          ) u)::int,
         (select x.created_at from public.group_messages x
           where x.group_id = g.id order by x.id desc limit 1)
    from public.group_members m
    join public.groups g on g.id = m.group_id
   where m.user_id = auth.uid()
   order by 14 desc nulls last, g.name;
$$;

-- Who is in a group, what they share, and nothing about when they last read.
create or replace function public.group_members_list(p_group uuid)
returns table (user_id uuid, role text, joined_at timestamptz, share_hours boolean, share_tasks text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_group_member(p_group) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select m.user_id, m.role, m.joined_at, m.share_hours, m.share_tasks
      from public.group_members m
     where m.group_id = p_group
     order by public.role_rank(m.role) desc, m.joined_at;
end;
$$;

-- The leaderboard for any window. Reads study_days by primary-key range per
-- member — the cost is members × days in the window, independent of how many
-- sessions anyone logged or how many groups exist. Null bounds mean open.
--
-- A member who does not share hours is still listed, with nulls, so the board
-- can say "keeps hours private" instead of silently dropping them. The caller
-- always sees their own figure, flagged, since it is theirs.
--
-- This is also the building block for group events: a challenge between
-- groups is this, summed per group, over the event's date range.
create or replace function public.group_leaderboard(p_group uuid, p_from date default null, p_to date default null)
returns table (
  user_id       uuid,
  role          text,
  shares_hours  boolean,
  hours         numeric,
  tracked_hours numeric,
  days_active   int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_group_member(p_group) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select m.user_id, m.role, m.share_hours,
           case when v.visible then coalesce(s.hours, 0) end,
           case when v.visible then coalesce(s.tracked, 0) end,
           case when v.visible then coalesce(s.days, 0)::int end
      from public.group_members m
      cross join lateral (select (m.share_hours or m.user_id = auth.uid()) as visible) v
      left join lateral (
        select sum(d.hours) as hours, sum(d.tracked_hours) as tracked,
               count(*) filter (where d.tracked_hours > 0) as days
          from public.study_days d
         where v.visible
           and d.user_id = m.user_id
           and (p_from is null or d.date >= p_from)
           and (p_to   is null or d.date <= p_to)
      ) s on true
     where m.group_id = p_group;
end;
$$;

-- Task progress of the members who share it, at the level each chose FOR THIS
-- GROUP: a member sharing their list with friends and a summary with their
-- coaching batch is shown exactly that in each. Members at 'private' are not
-- returned at all. `tasks` is non-null only at 'tasks'.
create or replace function public.group_task_progress(p_group uuid)
returns table (user_id uuid, share_tasks text, date date, done int, total int, tasks jsonb, updated_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_group_member(p_group) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select m.user_id, m.share_tasks, t.date, t.done, t.total,
           case when m.share_tasks = 'tasks' then t.tasks end,
           t.updated_at
      from public.group_members m
      join public.task_shares t on t.user_id = m.user_id
     where m.group_id = p_group and m.share_tasks <> 'private';
end;
$$;

-- Soft delete: your own message, or anyone's if you moderate the group.
create or replace function public.delete_group_message(p_message bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  msg public.group_messages;
begin
  select * into msg from public.group_messages where id = p_message;
  if not found or msg.deleted_at is not null then
    return;
  end if;
  if not public.is_group_member(msg.group_id) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if msg.sender_id <> auth.uid() and public.role_rank(public.group_role(msg.group_id)) < 2 then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.group_messages
     set body = '', deleted_at = now(), deleted_by = auth.uid()
   where id = p_message;
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Privileges
--
-- Postgres grants EXECUTE on new functions to PUBLIC, and Supabase's default
-- privileges additionally grant it to `anon` and `authenticated` by name — so
-- revoking from PUBLIC alone leaves `anon` able to call everything. Every
-- function here is revoked from both and granted to `authenticated` alone; the
-- internal helpers are revoked from all three.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.role_rank(text)',
    'public.group_role(uuid)',
    'public.is_group_member(uuid)',
    'public.create_group(text, text, text, text, boolean)',
    'public.update_group(uuid, text, text, text, text)',
    'public.delete_group(uuid)',
    'public.create_invite(uuid, int, int)',
    'public.revoke_invite(uuid)',
    'public.preview_invite(text)',
    'public.redeem_invite(text, boolean)',
    'public.leave_group(uuid)',
    'public.remove_member(uuid, uuid, boolean)',
    'public.unban_member(uuid, uuid)',
    'public.set_member_role(uuid, uuid, text)',
    'public.transfer_ownership(uuid, uuid)',
    'public.set_group_sharing(uuid, boolean, text)',
    'public.mark_group_read(uuid, bigint)',
    'public.my_groups()',
    'public.group_members_list(uuid)',
    'public.group_leaderboard(uuid, date, date)',
    'public.group_task_progress(uuid)',
    'public.delete_group_message(bigint)'
  ] loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;

  foreach fn in array array[
    'public.generate_invite_code()',
    'public.normalize_invite_code(text)',
    'public.invite_throttled(uuid)',
    'public.invite_note_failure(uuid)',
    'public.group_messages_before_insert()',
    'public.group_members_after_delete()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', fn);
  end loop;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Realtime
--
-- Chat messages only. Realtime is the doorbell, not the mailbox: the client
-- treats every event as a hint, fetches history from the table, and
-- reconciles after any reconnect — see groups/useGroupChat.ts. Guarded so the
-- file stays re-runnable (a bare ADD TABLE errors the second time).
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'group_messages'
  ) then
    alter publication supabase_realtime add table public.group_messages;
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- OPTIONAL — retention. Not run by this file.
--
-- Nothing needs it at today's scale. If message volume ever makes storage a
-- line item, the index already makes this cheap, and pg_cron (Database →
-- Extensions) can run it nightly. Decide the window first — a year of a
-- study group's history is plausibly worth keeping.
-- ═══════════════════════════════════════════════════════════════════════════

-- delete from public.group_messages where created_at < now() - interval '365 days';
