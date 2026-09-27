-- ── The AI Study Mentor: closed-beta access and a daily budget ──
-- Run once in the Supabase dashboard: SQL Editor → New query → Run.
-- Every statement is idempotent; re-run it any time.
--
-- WHAT IS NOT HERE, AND WHY
--
-- No conversation tables. Mentor chats are stored on the student's device and
-- nowhere else (mentor/threads.ts) — most users are minors, and a server-side
-- archive of what they tell a study mentor is a liability with no feature
-- attached to it.
--
-- No copy of any study data. The `mentor` edge function never reads
-- `user_profiles`: the device computes a snapshot per request and runs the
-- model's read tools itself. Same reasoning as supabase/ai.sql, which this file
-- follows closely — the function runs partly as the service role, so it is
-- given nothing interesting to bypass RLS *for*.
--
-- So this file holds exactly three things: who may use the Mentor, the
-- invites that let someone in, and how much they have used today.


-- ═══════════════════════════════════════════════════════════════════════════
-- 0. Depends on groups.sql
--
-- Mentor invites are the Groups invite system, not a second one: the same
-- 12-character Crockford codes (generate_invite_code / normalize_invite_code)
-- and the same per-account brute-force throttle (invite_throttled /
-- invite_note_failure — 15 wrong codes in 15 minutes, across BOTH kinds of
-- invite, so alternating between them buys a guesser nothing). Stop here with
-- a clear message rather than half-install if that file has not been run.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if to_regprocedure('public.generate_invite_code()') is null
     or to_regprocedure('public.normalize_invite_code(text)') is null
     or to_regprocedure('public.invite_throttled(uuid)') is null
     or to_regprocedure('public.invite_note_failure(uuid)') is null then
    raise exception 'Run supabase/groups.sql first — the Mentor reuses its invite codes and throttle.';
  end if;
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. The closed beta: invite only
--
-- An allowlist, not a flag in the client-written blob: a list kept in AppState
-- is a list a student could add themselves to from localStorage. There is
-- deliberately no insert/update/delete policy on either table — under RLS that
-- denies every client, so the only ways in are redeeming an invite (§3) and
-- the SQL editor (§6).
--
-- Administrators are NOT let in automatically. The beta is the people the
-- owner invites; being staff for announcements is a different thing.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.mentor_beta_users (
  user_id  uuid        primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now(),
  note     text        check (note is null or length(note) <= 200)
);

-- Upgrades from the first version of this file.
alter table public.mentor_beta_users add column if not exists can_invite boolean not null default false;
alter table public.mentor_beta_users add column if not exists invited_by uuid references auth.users (id) on delete set null;
alter table public.mentor_beta_users add column if not exists invite_id  uuid;

alter table public.mentor_beta_users enable row level security;

-- Your own row only: nobody may list who else is in the beta.
drop policy if exists "read own beta row" on public.mentor_beta_users;
create policy "read own beta row"
  on public.mentor_beta_users for select
  to authenticated
  using (auth.uid() = user_id);

-- Pre-approved addresses: access (and optionally invite rights) from the first
-- sign-in, before anyone has invited them. This is how the owner gets in —
-- there has to be a first inviter. Matched only against a CONFIRMED email, so
-- signing up with somebody else's address does not inherit their seat.
create table if not exists public.mentor_beta_emails (
  email      text        primary key check (email = lower(email) and length(email) <= 320),
  can_invite boolean     not null default false,
  added_at   timestamptz not null default now()
);

alter table public.mentor_beta_emails enable row level security;
-- No policies at all: only the definer functions below read it.

insert into public.mentor_beta_emails (email, can_invite)
values ('lockedinshreyash@gmail.com', true)
on conflict (email) do update set can_invite = excluded.can_invite;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Who is in, and who may invite
--
-- One definition, asked by the client (gate or tab?) and by the edge function
-- (answer or refuse?) — with the caller's own JWT both times.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.mentor_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  v_email text;
  member  public.mentor_beta_users;
  seeded  public.mentor_beta_emails;
begin
  if uid is null then
    return jsonb_build_object('access', false, 'can_invite', false);
  end if;

  select * into member from public.mentor_beta_users where user_id = uid;

  select lower(email) into v_email from auth.users where id = uid and email_confirmed_at is not null;
  if v_email is not null then
    select * into seeded from public.mentor_beta_emails where email = v_email;
  end if;

  return jsonb_build_object(
    'access',     member.user_id is not null or seeded.email is not null,
    'can_invite', coalesce(member.can_invite, false) or coalesce(seeded.can_invite, false)
  );
end;
$$;

create or replace function public.mentor_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((public.mentor_status() ->> 'access')::boolean, false);
$$;

revoke all on function public.mentor_status() from public, anon;
revoke all on function public.mentor_access() from public, anon;
grant execute on function public.mentor_status() to authenticated;
grant execute on function public.mentor_access() to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Invites — the Groups mechanics, pointed at the beta
--
-- Link: https://trackeralpha.in/?beta=CODE (see mentor/invite.ts), carried
-- across sign-up exactly like a group's ?join=CODE.
-- ═══════════════════════════════════════════════════════════════════════════

/* How many people the beta can hold. The Mentor runs on a free tier that
   carries roughly 10–20 daily users; past this, redeeming says "full" rather
   than letting quality collapse for everyone already in. Raise it here. */
create or replace function public.mentor_beta_capacity()
returns int language sql immutable as $$ select 50 $$;

create table if not exists public.mentor_invites (
  id         uuid        primary key default gen_random_uuid(),
  -- Same shape and same generator as group_invites.code.
  code       text        not null unique,
  created_by uuid        references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  max_uses   int         not null default 1,
  uses       int         not null default 0,
  revoked_at timestamptz,

  constraint mentor_invite_code_shape check (code ~ '^[0-9A-HJKMNP-TV-Z]{12}$'),
  constraint mentor_invite_max_uses   check (max_uses between 1 and 50),
  constraint mentor_invite_uses       check (uses >= 0 and uses <= max_uses)
);

create index if not exists mentor_invites_by_creator on public.mentor_invites (created_by);

alter table public.mentor_invites enable row level security;

-- An inviter sees their own invites (to copy a link again, or revoke one).
-- Nobody else sees any — the redeem path reads through the definer functions.
drop policy if exists "inviters read their own invites" on public.mentor_invites;
create policy "inviters read their own invites"
  on public.mentor_invites for select
  to authenticated
  using (created_by = auth.uid());

create or replace function public.create_mentor_invite(
  p_max_uses      int default 1,
  p_expires_hours int default 168
)
returns public.mentor_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  created public.mentor_invites;
  attempt int  := 0;
begin
  if uid is null or not coalesce((public.mentor_status() ->> 'can_invite')::boolean, false) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  -- Twenty live links per inviter. Enough to hand out a wave; not a firehose.
  if (select count(*) from public.mentor_invites
       where created_by = uid and revoked_at is null
         and (expires_at is null or expires_at > now())
         and uses < max_uses) >= 20 then
    raise exception 'invite limit' using errcode = 'P0001', hint = 'invite_limit';
  end if;

  loop
    attempt := attempt + 1;
    begin
      insert into public.mentor_invites (code, created_by, expires_at, max_uses)
      values (
        public.generate_invite_code(),
        uid,
        now() + make_interval(hours => greatest(1, least(coalesce(p_expires_hours, 168), 720))),
        greatest(1, least(coalesce(p_max_uses, 1), 50))
      )
      returning * into created;
      return created;
    exception when unique_violation then
      if attempt >= 5 then raise; end if;
    end;
  end loop;
end;
$$;

create or replace function public.revoke_mentor_invite(p_invite uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.mentor_invites
     set revoked_at = coalesce(revoked_at, now())
   where id = p_invite and created_by = auth.uid();
  if not found then
    raise exception 'not authorized' using errcode = '42501';
  end if;
end;
$$;

-- What a code would do, without doing it. Returns a status rather than
-- raising — a raise would roll back the throttle's failure count.
create or replace function public.preview_mentor_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.mentor_invites;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if coalesce((public.mentor_status() ->> 'access')::boolean, false) then
    return jsonb_build_object('status', 'member');
  end if;
  if public.invite_throttled(uid) then
    return jsonb_build_object('status', 'throttled');
  end if;

  select * into inv from public.mentor_invites where code = public.normalize_invite_code(p_code);
  if not found then
    perform public.invite_note_failure(uid);
    return jsonb_build_object('status', 'invalid');
  end if;
  if inv.revoked_at is not null then return jsonb_build_object('status', 'revoked'); end if;
  if inv.expires_at is not null and inv.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
  if inv.uses >= inv.max_uses then return jsonb_build_object('status', 'exhausted'); end if;
  if (select count(*) from public.mentor_beta_users) >= public.mentor_beta_capacity() then
    return jsonb_build_object('status', 'full');
  end if;
  return jsonb_build_object('status', 'ok', 'expires_at', inv.expires_at);
end;
$$;

-- The only way into the beta without the SQL editor.
create or replace function public.redeem_mentor_invite(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid      uuid := auth.uid();
  inv      public.mentor_invites;
  inserted int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  -- Already in: succeed without spending a use, so opening the link twice or
  -- on a second device is not an error.
  if coalesce((public.mentor_status() ->> 'access')::boolean, false) then
    return jsonb_build_object('status', 'member');
  end if;
  if public.invite_throttled(uid) then
    return jsonb_build_object('status', 'throttled');
  end if;

  -- FOR UPDATE: two people racing for the last use of a one-use link cannot
  -- both get in.
  select * into inv from public.mentor_invites
   where code = public.normalize_invite_code(p_code)
   for update;
  if not found then
    perform public.invite_note_failure(uid);
    return jsonb_build_object('status', 'invalid');
  end if;
  if inv.revoked_at is not null then return jsonb_build_object('status', 'revoked'); end if;
  if inv.expires_at is not null and inv.expires_at <= now() then return jsonb_build_object('status', 'expired'); end if;
  if inv.uses >= inv.max_uses then return jsonb_build_object('status', 'exhausted'); end if;
  if (select count(*) from public.mentor_beta_users) >= public.mentor_beta_capacity() then
    return jsonb_build_object('status', 'full');
  end if;

  -- Invitees get access, not invite rights: the beta grows only as fast as the
  -- people the owner trusts to grow it (§6 grants the right explicitly).
  insert into public.mentor_beta_users (user_id, invited_by, invite_id, note)
  values (uid, inv.created_by, inv.id, 'invite')
  on conflict (user_id) do nothing;
  get diagnostics inserted = row_count;

  if inserted > 0 then
    update public.mentor_invites set uses = uses + 1 where id = inv.id;
  end if;

  return jsonb_build_object('status', 'joined');
end;
$$;

revoke all on function public.mentor_beta_capacity() from public, anon;
revoke all on function public.create_mentor_invite(int, int) from public, anon;
revoke all on function public.revoke_mentor_invite(uuid) from public, anon;
revoke all on function public.preview_mentor_invite(text) from public, anon;
revoke all on function public.redeem_mentor_invite(text) from public, anon;
grant execute on function public.create_mentor_invite(int, int) to authenticated;
grant execute on function public.revoke_mentor_invite(uuid) to authenticated;
grant execute on function public.preview_mentor_invite(text) to authenticated;
grant execute on function public.redeem_mentor_invite(text) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. The daily budget
--
-- Daily, not monthly like ai_usage, because the free tier the Mentor runs on
-- is metered per day. `day` is the IST study day (04:00 boundary), the same
-- key every other daily figure in the app uses, so "resets at 4 AM" is true.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.mentor_usage (
  user_id       uuid        not null references auth.users (id) on delete cascade,
  day           date        not null,
  calls         int         not null default 0 check (calls >= 0),
  input_tokens  bigint      not null default 0,
  cached_tokens bigint      not null default 0,
  output_tokens bigint      not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (user_id, day)
);

create index if not exists mentor_usage_by_day on public.mentor_usage (day);

alter table public.mentor_usage enable row level security;

-- Readable by the owner. Writable by nobody but the service role.
drop policy if exists "users read their own mentor usage" on public.mentor_usage;
create policy "users read their own mentor usage"
  on public.mentor_usage for select
  to authenticated
  using (auth.uid() = user_id);


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Reserve, release, record
--
-- RESERVE BEFORE CALLING, atomically. explain-week checks the count, calls the
-- model, then records — so two requests landing together both pass the check.
-- Harmless at a cent a call, not for an agent that makes several calls a turn.
-- Here the check and the increment are one statement: the conditional upsert
-- takes the row lock, and a request past the cap simply gets no row back.
--
-- The global check sums "counted" tokens (input − cached + output), which is
-- how the provider meters its own free-tier limit. It is a soft ceiling —
-- concurrent requests can overshoot it by one call each — and exists to stop
-- hammering a provider that is about to say no anyway.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.mentor_reserve_call(uuid, date, int, bigint);
create function public.mentor_reserve_call(
  p_user          uuid,
  p_day           date,
  p_user_cap      int,
  p_global_tokens bigint
) returns table (status text, calls int)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_global bigint;
  v_calls  int;
begin
  select coalesce(sum(u.input_tokens - u.cached_tokens + u.output_tokens), 0)
    into v_global
    from public.mentor_usage u
   where u.day = p_day;

  if v_global >= p_global_tokens then
    return query select 'global_limit'::text, null::int;
    return;
  end if;

  insert into public.mentor_usage as u (user_id, day, calls)
  values (p_user, p_day, 1)
  on conflict (user_id, day) do update
    set calls = u.calls + 1, updated_at = now()
    where u.calls < p_user_cap
  returning u.calls into v_calls;

  if v_calls is null then
    return query select 'user_limit'::text, p_user_cap;
    return;
  end if;

  return query select 'ok'::text, v_calls;
end;
$$;

-- A call that never reached a model must not cost the student anything.
create or replace function public.mentor_release_call(p_user uuid, p_day date)
returns void
language sql
security definer
set search_path = public
as $$
  update public.mentor_usage
     set calls = greatest(0, calls - 1), updated_at = now()
   where user_id = p_user and day = p_day;
$$;

create or replace function public.mentor_record_usage(
  p_user   uuid,
  p_day    date,
  p_in     int,
  p_cached int,
  p_out    int
) returns void
language sql
security definer
set search_path = public
as $$
  update public.mentor_usage
     set input_tokens  = input_tokens  + greatest(0, p_in),
         cached_tokens = cached_tokens + greatest(0, least(p_cached, p_in)),
         output_tokens = output_tokens + greatest(0, p_out),
         updated_at    = now()
   where user_id = p_user and day = p_day;
$$;

-- Service role only. Supabase grants EXECUTE to anon and authenticated by name,
-- so revoking from `public` alone would leave a client able to reset its own
-- counter (see groups.sql for the same trap).
revoke all on function public.mentor_reserve_call(uuid, date, int, bigint) from public, anon, authenticated;
revoke all on function public.mentor_release_call(uuid, date) from public, anon, authenticated;
revoke all on function public.mentor_record_usage(uuid, date, int, int, int) from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Running the beta (copy into the SQL editor as needed)
-- ═══════════════════════════════════════════════════════════════════════════

-- Normally people join with an invite link from inside the Mentor tab. For
-- anything else, the SQL editor:

-- Pre-approve an address (works even before they sign up; confirmed email only):
--   insert into public.mentor_beta_emails (email, can_invite)
--   values (lower('friend@example.com'), false)
--   on conflict (email) do nothing;

-- Let an existing beta member invite others too:
--   update public.mentor_beta_users set can_invite = true
--   where user_id = (select id from auth.users where email = 'friend@example.com');

-- Remove someone (their device keeps its chats; the Mentor stops answering):
--   delete from public.mentor_beta_users
--   where user_id = (select id from auth.users where email = 'friend@example.com');
--   delete from public.mentor_beta_emails where email = 'friend@example.com';

-- Who is in, and who brought them:
--   select u.email, b.added_at, b.can_invite, i.email as invited_by
--   from public.mentor_beta_users b
--   join auth.users u on u.id = b.user_id
--   left join auth.users i on i.id = b.invited_by
--   order by b.added_at;

-- Today's load against the free tier (counted = what the provider meters):
--   select day, count(*) as students, sum(calls) as model_calls,
--          sum(input_tokens - cached_tokens + output_tokens) as counted_tokens,
--          sum(cached_tokens) as cached_tokens
--   from public.mentor_usage
--   group by day order by day desc limit 14;
