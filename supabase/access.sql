-- ═══════════════════════════════════════════════════════════════════════════
-- Access: Alpha is invite-only from 1 Nov 2026
-- ═══════════════════════════════════════════════════════════════════════════
--
-- The backend is not ready for a sudden spike, so from the cutover a new
-- account needs a way in. There are four, and every one ends in a row in
-- access_grants:
--
--   founding  every account created before the cutover. has_access() answers
--             yes for them from auth.users.created_at alone, so nobody already
--             inside depends on a backfill having run; the row only gives them
--             a member number. A device that was used before the cutover can
--             also claim it for a new account (claim_founding_device), flagged
--             so staff can see it.
--   invite    every member owns exactly ONE invite code (access_invites.owner_id
--             is unique). It is single use.
--   waitlist  sign in, apply, wait. Staff admit from the console.
--   pass      the ₹2,500 Priority Pass. Written by the payment webhook (service
--             role) through access_grant_pass(); no client can call it.
--   admin     granted by hand from the console (the Play reviewer, a friend).
--
-- Same stance as cbt.sql's has_feature() and admin.sql's is_admin(): every
-- table has RLS with no client write policy, every function is security
-- definer answering only about auth.uid(), and every function is revoked from
-- public and anon (Supabase grants EXECUTE to anon by name). The client
-- (access/useAccess.ts) only decides what to DRAW; the restrictive policies in
-- §6 are what stop a non-member writing to the busy tables.
--
-- Run after admin.sql (is_admin). Re-runnable. Then, once:
--   select public.access_backfill();
-- which numbers the founding members by sign-up date.

-- ── 1. The cutover ──
-- One place. access/cutover.ts holds the same instant for the client.
create or replace function public.access_cutover()
returns timestamptz
language sql
immutable
as $$ select timestamptz '2026-11-01 00:00:00+05:30' $$;


-- ── 2. Tables ──

create table if not exists public.access_grants (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  source       text        not null,
  invited_by   uuid        references auth.users (id) on delete set null,
  -- The status number on the member card. Founding members get the lowest
  -- ones because access_backfill() inserts them first, in sign-up order.
  member_no    bigint      generated always as identity,
  -- A founding claim made from a device rather than from an account's age.
  -- Forgeable through localStorage, accepted as low stakes, shown to staff.
  device_claim boolean     not null default false,
  order_ref    text,
  granted_at   timestamptz not null default now(),
  constraint access_source_known check (source in ('founding', 'invite', 'waitlist', 'pass', 'admin')),
  constraint access_member_no_unique unique (member_no)
);

create table if not exists public.access_invites (
  code        text        primary key,
  owner_id    uuid        not null unique references auth.users (id) on delete cascade,
  redeemed_by uuid        unique references auth.users (id) on delete set null,
  redeemed_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint access_code_shape check (code ~ '^[0-9A-HJKMNP-TV-Z]{12}$'),
  -- Spent is redeemed_at. redeemed_by can go null later (the invitee deleted
  -- their account); the invite stays spent.
  constraint access_redeemed_pair check (redeemed_by is null or redeemed_at is not null)
);

create table if not exists public.access_waitlist (
  user_id     uuid        primary key references auth.users (id) on delete cascade,
  place       bigint      generated always as identity,
  exam        text,
  class       smallint,
  goal_hours  numeric(4, 1),
  why         text,
  wants_pass  boolean     not null default false,
  joined_at   timestamptz not null default now(),
  admitted_at timestamptz,
  constraint waitlist_exam check (exam is null or exam in ('JEE', 'NEET')),
  constraint waitlist_class check (class is null or class in (11, 12, 13)),
  constraint waitlist_hours check (goal_hours is null or goal_hours between 0 and 16),
  constraint waitlist_why check (why is null or char_length(why) <= 140)
);
create index if not exists access_waitlist_waiting on public.access_waitlist (place) where admitted_at is null;

create table if not exists public.access_invite_attempts (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  window_start timestamptz not null default now(),
  failures     int         not null default 0
);

alter table public.access_grants          enable row level security;
alter table public.access_invites         enable row level security;
alter table public.access_waitlist        enable row level security;
alter table public.access_invite_attempts enable row level security;

-- Select-own only, as user_features. No write policies anywhere: under RLS that
-- denies every client write, and the functions below are the only writers.
drop policy if exists "own access grant" on public.access_grants;
create policy "own access grant" on public.access_grants
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "own access invite" on public.access_invites;
create policy "own access invite" on public.access_invites
  for select to authenticated using (auth.uid() = owner_id);

drop policy if exists "own waitlist row" on public.access_waitlist;
create policy "own waitlist row" on public.access_waitlist
  for select to authenticated using (auth.uid() = user_id);

revoke all on public.access_invite_attempts from anon, authenticated;


-- ── 3. The predicate ──
-- Everything that asks "is this person in" asks this. A grant row, an account
-- older than the cutover, or staff. Before the cutover every account is older
-- than it, so the gate is inert until the moment arrives.
create or replace function public.has_access()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return false;
  end if;
  if exists (select 1 from public.access_grants where user_id = uid) then
    return true;
  end if;
  if exists (select 1 from auth.users where id = uid and created_at < public.access_cutover()) then
    return true;
  end if;
  if to_regprocedure('public.is_admin()') is not null then
    return public.is_admin();
  end if;
  return false;
end;
$$;


-- ── 4. Internal helpers (no client may call these) ──

-- 60 bits from a CSPRNG, Crockford base32. A copy of groups.sql's
-- generate_invite_code under its own name, so this file installs alone.
create or replace function public.access_generate_code()
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

create or replace function public.access_normalize_code(p_code text)
returns text
language sql
immutable
as $$
  select regexp_replace(translate(upper(coalesce(p_code, '')), 'OIL', '011'), '[^0-9A-Z]', '', 'g');
$$;

-- 15 wrong codes in 15 minutes and that account stops being able to redeem
-- for the rest of the window. groups.sql explains why this is belt and braces.
create or replace function public.access_throttled(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.access_invite_attempts
     where user_id = p_user and failures >= 15 and window_start > now() - interval '15 minutes'
  );
$$;

create or replace function public.access_note_failure(p_user uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.access_invite_attempts as a (user_id, window_start, failures)
  values (p_user, now(), 1)
  on conflict (user_id) do update
    set failures     = case when a.window_start > now() - interval '15 minutes' then a.failures + 1 else 1 end,
        window_start = case when a.window_start > now() - interval '15 minutes' then a.window_start else now() end;
$$;

-- A member's public face: what profiles.sql already shows any signed-in
-- student, plus the member number. Never an email, never the uuid.
create or replace function public.access_public_face(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  face jsonb := '{}'::jsonb;
  g    public.access_grants;
begin
  if p_user is null then
    return null;
  end if;
  if to_regclass('public.profiles') is not null then
    execute $q$
      select jsonb_build_object(
        'name', p.display_name, 'avatar_type', p.avatar_type,
        'avatar_id', p.avatar_id, 'avatar_url', p.avatar_url)
        from public.profiles p where p.user_id = $1
    $q$ into face using p_user;
  end if;
  select * into g from public.access_grants where user_id = p_user;
  return coalesce(face, '{}'::jsonb)
      || jsonb_build_object('member_no', g.member_no, 'founding', g.source = 'founding');
end;
$$;

-- Make sure a member has a grant row and an invite. A founding member who
-- predates the backfill (or signed up between it and the cutover) gets their
-- row here, on first ask.
create or replace function public.access_ensure_member(p_user uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  tries int := 0;
begin
  if not exists (select 1 from public.access_grants where user_id = p_user) then
    if exists (select 1 from auth.users where id = p_user and created_at < public.access_cutover()) then
      insert into public.access_grants (user_id, source) values (p_user, 'founding')
      on conflict (user_id) do nothing;
    elsif to_regclass('public.user_roles') is not null
      and exists (select 1 from public.user_roles where user_id = p_user and role = 'admin') then
      insert into public.access_grants (user_id, source) values (p_user, 'admin')
      on conflict (user_id) do nothing;
    else
      return;
    end if;
  end if;

  while not exists (select 1 from public.access_invites where owner_id = p_user) loop
    tries := tries + 1;
    begin
      insert into public.access_invites (code, owner_id) values (public.access_generate_code(), p_user)
      on conflict (owner_id) do nothing;
    exception when unique_violation then
      if tries >= 5 then raise; end if;
    end;
  end loop;
end;
$$;


-- ── 5. What clients call ──

-- Where do I stand. One call on sign-in and on return to the foreground.
create or replace function public.my_access()
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  g   public.access_grants;
  inv public.access_invites;
  w   public.access_waitlist;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  if public.has_access() then
    perform public.access_ensure_member(uid);
    select * into g from public.access_grants where user_id = uid;
    select * into inv from public.access_invites where owner_id = uid;
    return jsonb_build_object(
      'status', 'member',
      'source', g.source,
      'member_no', g.member_no,
      'granted_at', g.granted_at,
      'invited_by', case when g.invited_by is null then null else public.access_public_face(g.invited_by) end,
      'invite', case when inv.code is null then null else jsonb_build_object(
        'code', inv.code,
        'redeemed_at', inv.redeemed_at,
        'redeemed_by', case when inv.redeemed_by is null then null else public.access_public_face(inv.redeemed_by) end
      ) end
    );
  end if;

  select * into w from public.access_waitlist where user_id = uid;
  if found then
    return jsonb_build_object(
      'status', 'waitlist',
      'position', (select count(*) from public.access_waitlist
                    where admitted_at is null and place < w.place) + 1,
      'joined_at', w.joined_at,
      'wants_pass', w.wants_pass
    );
  end if;

  return jsonb_build_object('status', 'none');
end;
$$;

-- "Rahul invited you." Callable before sign-in, because that is the moment it
-- matters. A valid code reveals only the inviter's public face; anything else
-- reveals nothing. 60 bits make guessing pointless; signed-in guessers are
-- throttled as well.
create or replace function public.preview_access_invite(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.access_invites;
begin
  if uid is not null and public.access_throttled(uid) then
    return jsonb_build_object('status', 'throttled');
  end if;

  select * into inv from public.access_invites where code = public.access_normalize_code(p_code);
  if not found then
    if uid is not null then perform public.access_note_failure(uid); end if;
    return jsonb_build_object('status', 'invalid');
  end if;
  if uid is not null and inv.owner_id = uid then
    return jsonb_build_object('status', 'self');
  end if;
  if uid is not null and inv.redeemed_by = uid then
    return jsonb_build_object('status', 'member');
  end if;
  if inv.redeemed_at is not null then
    return jsonb_build_object('status', 'used');
  end if;
  return jsonb_build_object('status', 'ok', 'inviter', public.access_public_face(inv.owner_id));
end;
$$;

-- The way in by invite. Returns a status instead of raising: a raise would
-- roll back the throttle's failure count.
create or replace function public.redeem_access_invite(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv public.access_invites;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.has_access() then
    return jsonb_build_object('status', 'member');
  end if;
  if public.access_throttled(uid) then
    return jsonb_build_object('status', 'throttled');
  end if;

  -- FOR UPDATE: two people racing for the same code cannot both get in.
  select * into inv from public.access_invites
   where code = public.access_normalize_code(p_code)
   for update;
  if not found then
    perform public.access_note_failure(uid);
    return jsonb_build_object('status', 'invalid');
  end if;
  if inv.owner_id = uid then
    return jsonb_build_object('status', 'self');
  end if;
  if inv.redeemed_at is not null then
    return jsonb_build_object('status', 'used');
  end if;

  insert into public.access_grants (user_id, source, invited_by)
  values (uid, 'invite', inv.owner_id)
  on conflict (user_id) do nothing;
  update public.access_invites set redeemed_by = uid, redeemed_at = now() where code = inv.code;
  update public.access_waitlist set admitted_at = coalesce(admitted_at, now()) where user_id = uid;
  perform public.access_ensure_member(uid);

  return jsonb_build_object('status', 'joined', 'inviter', public.access_public_face(inv.owner_id));
end;
$$;

-- Apply. Re-applying updates the answers and keeps the place.
create or replace function public.join_waitlist(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  v_exam text := nullif(p->>'exam', '');
  v_class smallint;
  v_hours numeric;
  v_why  text := nullif(left(trim(coalesce(p->>'why', '')), 140), '');
  v_pass boolean := coalesce((p->>'wants_pass')::boolean, false);
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.has_access() then
    return public.my_access();
  end if;

  if v_exam not in ('JEE', 'NEET') then v_exam := null; end if;
  begin v_class := (p->>'class')::smallint; exception when others then v_class := null; end;
  if v_class not in (11, 12, 13) then v_class := null; end if;
  begin v_hours := round((p->>'goal_hours')::numeric, 1); exception when others then v_hours := null; end;
  if v_hours < 0 or v_hours > 16 then v_hours := null; end if;

  insert into public.access_waitlist (user_id, exam, class, goal_hours, why, wants_pass)
  values (uid, v_exam, v_class, v_hours, v_why, v_pass)
  on conflict (user_id) do update
    set exam = excluded.exam, class = excluded.class, goal_hours = excluded.goal_hours,
        why = excluded.why, wants_pass = excluded.wants_pass;

  return public.my_access();
end;
$$;

-- A device that was in use before the cutover, signing into a new account.
-- p.first_day is the earliest log date the device holds (YYYY-MM-DD, IST).
-- The client cannot prove it, so the grant is marked and staff can see it.
create or replace function public.claim_founding_device(p jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid   uuid := auth.uid();
  v_first date;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if public.has_access() then
    return public.my_access();
  end if;
  -- ISO only: Postgres reads 'yesterday' and 'today' as dates.
  if coalesce(p->>'first_day', '') ~ '^\d{4}-\d{2}-\d{2}$' then
    begin v_first := (p->>'first_day')::date; exception when others then v_first := null; end;
  end if;
  if v_first is null or v_first >= (public.access_cutover() at time zone 'Asia/Kolkata')::date then
    return jsonb_build_object('status', 'refused');
  end if;

  insert into public.access_grants (user_id, source, device_claim)
  values (uid, 'founding', true)
  on conflict (user_id) do nothing;
  update public.access_waitlist set admitted_at = coalesce(admitted_at, now()) where user_id = uid;
  return public.my_access();
end;
$$;


-- ── 5b. Payment hook (service role only) ──
-- The Pass. The provider's webhook calls this BEFORE the client is told the
-- payment went through. Idempotent on the user.
create or replace function public.access_grant_pass(p_user uuid, p_order_ref text)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  insert into public.access_grants (user_id, source, order_ref)
  values (p_user, 'pass', p_order_ref)
  on conflict (user_id) do nothing;
  update public.access_waitlist set admitted_at = coalesce(admitted_at, now()) where user_id = p_user;
  perform public.access_ensure_member(p_user);
end;
$$;


-- ── 5c. Staff ──

create or replace function public.admin_access_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'cutover', public.access_cutover(),
    'by_source', coalesce((select jsonb_object_agg(source, n) from (
        select source, count(*) n from public.access_grants group by source) s), '{}'::jsonb),
    'device_claims', (select count(*) from public.access_grants where device_claim),
    'founding_unnumbered', (select count(*) from auth.users u
        where u.created_at < public.access_cutover()
          and not exists (select 1 from public.access_grants g where g.user_id = u.id)),
    'invites_redeemed', (select count(*) from public.access_invites where redeemed_at is not null),
    'invites_open', (select count(*) from public.access_invites where redeemed_at is null),
    'waiting', (select count(*) from public.access_waitlist where admitted_at is null),
    'waiting_wants_pass', (select count(*) from public.access_waitlist where admitted_at is null and wants_pass),
    'admitted_from_waitlist', (select count(*) from public.access_waitlist where admitted_at is not null)
  );
end;
$$;

-- The queue, oldest first, keyset-paged on place. Names come from profiles,
-- never an email (admin_recent_users' rule).
create or replace function public.admin_waitlist(p_limit int default 50, p_after bigint default null)
returns table (
  user_id uuid, place bigint, name text, exam text, class smallint,
  goal_hours numeric, why text, wants_pass boolean, joined_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select w.user_id, w.place, (public.access_public_face(w.user_id)->>'name'),
           w.exam, w.class, w.goal_hours, w.why, w.wants_pass, w.joined_at
      from public.access_waitlist w
     where w.admitted_at is null and (p_after is null or w.place > p_after)
     order by w.place
     limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

create or replace function public.admin_admit(p_users uuid[])
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n int;
  u uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  with admitted as (
    update public.access_waitlist set admitted_at = now()
     where user_id = any(p_users) and admitted_at is null
     returning user_id
  ), granted as (
    insert into public.access_grants (user_id, source)
    select user_id, 'waitlist' from admitted
    on conflict (user_id) do nothing
    returning user_id
  )
  select count(*) into n from admitted;
  foreach u in array coalesce(p_users, '{}') loop
    perform public.access_ensure_member(u);
  end loop;
  return n;
end;
$$;

create or replace function public.admin_admit_next(p_count int)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  ids uuid[];
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select array_agg(user_id order by place) into ids from (
    select user_id, place from public.access_waitlist
     where admitted_at is null order by place
     limit least(greatest(coalesce(p_count, 0), 0), 1000)
  ) q;
  return public.admin_admit(coalesce(ids, '{}'));
end;
$$;

-- By email: the Play reviewer's Google account, a friend. Returns a status.
create or replace function public.admin_grant_access(p_email text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select id into target from auth.users where lower(email) = lower(trim(p_email));
  if target is null then
    return jsonb_build_object('status', 'no_account');
  end if;
  if exists (select 1 from public.access_grants where user_id = target) then
    return jsonb_build_object('status', 'already');
  end if;
  insert into public.access_grants (user_id, source) values (target, 'admin');
  update public.access_waitlist set admitted_at = coalesce(admitted_at, now()) where user_id = target;
  perform public.access_ensure_member(target);
  return jsonb_build_object('status', 'granted');
end;
$$;

-- Once, after this file: number every founding member by sign-up date, so the
-- earliest accounts carry the lowest numbers. Safe to re-run; new rows only.
create or replace function public.access_backfill()
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n int;
begin
  insert into public.access_grants (user_id, source, granted_at)
  select u.id, 'founding', u.created_at
    from auth.users u
   where u.created_at < public.access_cutover()
     and not exists (select 1 from public.access_grants g where g.user_id = u.id)
   order by u.created_at, u.id;
  get diagnostics n = row_count;
  return n;
end;
$$;


-- ── 6. The door the client cannot hold open ──
-- RESTRICTIVE policies, so they AND with whatever permissive policies a table
-- already has and survive re-running that table's own file. Only on the
-- busiest client-written tables, and only where RLS is already on: enabling
-- RLS on a table with no permissive policies would lock out everyone.
-- Definer RPCs (create_group, record_reviews, …) bypass RLS; a non-member
-- calling them by hand is not a load problem.
do $$
declare
  t text;
begin
  foreach t in array array[
    'user_profiles', 'leaderboard_entries', 'study_days', 'task_shares',
    'group_messages', 'race_chat_messages', 'note_updates'
  ] loop
    if to_regclass('public.' || t) is null then
      continue;
    end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise notice 'access.sql: RLS is off on public.%, no members-only policy added', t;
      continue;
    end if;
    execute format('drop policy if exists "members only insert" on public.%I', t);
    execute format('create policy "members only insert" on public.%I as restrictive for insert to authenticated with check (public.has_access())', t);
    execute format('drop policy if exists "members only update" on public.%I', t);
    execute format('create policy "members only update" on public.%I as restrictive for update to authenticated using (public.has_access()) with check (public.has_access())', t);
  end loop;
end;
$$;


-- ── 7. Privileges ──
revoke all on function public.access_cutover()               from public, anon;
revoke all on function public.has_access()                   from public, anon;
revoke all on function public.my_access()                    from public, anon;
revoke all on function public.preview_access_invite(text)    from public, anon;
revoke all on function public.redeem_access_invite(text)     from public, anon;
revoke all on function public.join_waitlist(jsonb)           from public, anon;
revoke all on function public.claim_founding_device(jsonb)   from public, anon;
revoke all on function public.admin_access_overview()        from public, anon;
revoke all on function public.admin_waitlist(int, bigint)    from public, anon;
revoke all on function public.admin_admit(uuid[])            from public, anon;
revoke all on function public.admin_admit_next(int)          from public, anon;
revoke all on function public.admin_grant_access(text)       from public, anon;

grant execute on function public.access_cutover()             to authenticated;
grant execute on function public.has_access()                 to authenticated;
grant execute on function public.my_access()                  to authenticated;
grant execute on function public.preview_access_invite(text)  to anon, authenticated;
grant execute on function public.redeem_access_invite(text)   to authenticated;
grant execute on function public.join_waitlist(jsonb)         to authenticated;
grant execute on function public.claim_founding_device(jsonb) to authenticated;
grant execute on function public.admin_access_overview()      to authenticated;
grant execute on function public.admin_waitlist(int, bigint)  to authenticated;
grant execute on function public.admin_admit(uuid[])          to authenticated;
grant execute on function public.admin_admit_next(int)        to authenticated;
grant execute on function public.admin_grant_access(text)     to authenticated;

-- Internal: the service role (webhook, SQL editor) only.
revoke all on function public.access_generate_code()             from public, anon, authenticated;
revoke all on function public.access_normalize_code(text)        from public, anon, authenticated;
revoke all on function public.access_throttled(uuid)             from public, anon, authenticated;
revoke all on function public.access_note_failure(uuid)          from public, anon, authenticated;
revoke all on function public.access_public_face(uuid)           from public, anon, authenticated;
revoke all on function public.access_ensure_member(uuid)         from public, anon, authenticated;
revoke all on function public.access_grant_pass(uuid, text)      from public, anon, authenticated;
revoke all on function public.access_backfill()                  from public, anon, authenticated;
