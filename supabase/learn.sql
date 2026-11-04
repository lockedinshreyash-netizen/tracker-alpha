-- ═══════════════════════════════════════════════════════════════════════════
-- Alpha Learn — the library key
-- ═══════════════════════════════════════════════════════════════════════════
--
-- A student's lecture library never leaves their device (learn/store.ts): the
-- lectures, bookmarks, notes and progress live in IndexedDB, each record
-- sealed with AES-GCM (learn/crypto.ts). This file holds the one thing the
-- server keeps for it: each account's 256-bit key.
--
-- Why the server holds the key at all:
--   - sign-out deletes the device's cached copy, so what stays behind on a
--     shared laptop is ciphertext the next person cannot open;
--   - signing back in fetches the key here, and the library opens as it was;
--   - deleting the account deletes the key (on delete cascade), and every copy
--     of the library on every device becomes unreadable for good.
--
-- The server never sees the library, only the key. Staff with database access
-- can read keys and nothing they would open. The key is made on the first
-- device (crypto.getRandomValues) and kept only if the account has none yet,
-- so two devices starting at once agree on one key. No pgcrypto.
--
-- Same stance as every other table here: RLS on, no client policy, every
-- privilege revoked; the only door is `learn_key`, a definer function that
-- answers about auth.uid() and nobody else. Members only: when access.sql is
-- installed, has_access() is asked first.
--
-- Run it any time; re-runnable. Then deploy. Until it is run, the Learn tab
-- reports the library as locked (no key) and stores nothing.

-- ── 1. The keys ────────────────────────────────────────────────────────────

create table if not exists public.learn_keys (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  -- 32 bytes, standard base64 (learn/crypto.ts keyToB64): always 44 characters.
  key        text not null check (key ~ '^[A-Za-z0-9+/]{43}=$'),
  created_at timestamptz not null default now()
);

alter table public.learn_keys enable row level security;

-- No policy, and no privilege: under RLS that already denies every row, and
-- the revoke means a client cannot even ask.
revoke all on public.learn_keys from public, anon, authenticated;


-- ── 2. The one door ────────────────────────────────────────────────────────
-- learn_key(p_key) stores p_key as this account's key if it has none, and
-- returns the account's key either way. learn_key(null) only reads, and
-- returns null for an account that never opened Learn.

create or replace function public.learn_key(p_key text default null)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  found text;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  -- Nested, not `and`: PL/pgSQL plans a whole condition at once, so naming
  -- has_access() beside the check for it fails where access.sql is not run.
  if to_regprocedure('public.has_access()') is not null then
    if not public.has_access() then
      raise exception 'not a member' using errcode = '42501';
    end if;
  end if;

  if p_key is not null then
    if p_key !~ '^[A-Za-z0-9+/]{43}=$' then
      raise exception 'malformed key' using errcode = '22023';
    end if;
    insert into public.learn_keys (user_id, key) values (uid, p_key)
      on conflict (user_id) do nothing;
  end if;

  select k.key into found from public.learn_keys k where k.user_id = uid;
  return found;
end;
$$;

-- Supabase grants EXECUTE to anon by name, so both are revoked explicitly.
revoke all on function public.learn_key(text) from public, anon;
grant execute on function public.learn_key(text) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Discover — searching YouTube from inside Learn
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Searches go through the Edge Function `learn-search` (supabase/functions/
-- learn-search), which holds the YouTube API key. YouTube's quota is small
-- (a project starts with about 100 searches a day), so every search is
-- counted here, per student per study day (04:00 IST), against two limits:
--   - per student: 30 searches a day (title refreshes have their own 20);
--   - for the whole app: a ceiling set just under the quota YouTube granted,
--     counted only on searches that really reached YouTube (cache misses).
-- What is searched is never stored. Results are cached for a few hours
-- under a SHA-256 of the search (the same words always give the same key),
-- so a chapter search many students make costs YouTube one call; the cache
-- holds YouTube's own public results, never who asked.
--
-- Nothing here is readable or writable by a client. Students reach only
-- `learn_search_take` (definer, auth.uid(), members only when access.sql is
-- installed); the cache and the global count are the Edge Function's, through
-- the service role.

create table if not exists public.learn_search_usage (
  user_id   uuid not null references auth.users (id) on delete cascade,
  day       date not null,
  searches  integer not null default 0 check (searches >= 0),
  refreshes integer not null default 0 check (refreshes >= 0),
  -- Searches that reached YouTube (not answered from the cache).
  misses    integer not null default 0 check (misses >= 0),
  primary key (user_id, day)
);
create index if not exists learn_search_usage_day on public.learn_search_usage (day);
alter table public.learn_search_usage enable row level security;
revoke all on public.learn_search_usage from public, anon, authenticated;

create table if not exists public.learn_search_settings (
  id                 boolean primary key default true check (id),
  per_user_searches  integer not null default 30 check (per_user_searches between 0 and 1000),
  per_user_refreshes integer not null default 20 check (per_user_refreshes between 0 and 1000),
  -- Raise this when YouTube grants more quota: about quota / 101 units.
  daily_ceiling      integer not null default 90 check (daily_ceiling between 0 and 10000000)
);
insert into public.learn_search_settings (id) values (true) on conflict (id) do nothing;
alter table public.learn_search_settings enable row level security;
revoke all on public.learn_search_settings from public, anon, authenticated;

create table if not exists public.learn_search_cache (
  key        text primary key check (key ~ '^[0-9a-f]{64}$'),
  results    jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists learn_search_cache_age on public.learn_search_cache (created_at);
alter table public.learn_search_cache enable row level security;
revoke all on public.learn_search_cache from public, anon, authenticated;

/* The study day: 04:00 IST to 04:00 IST, the day everything else in Alpha
   resets on. */
create or replace function public.learn_study_day()
returns date
language sql
stable
as $$ select ((now() at time zone 'Asia/Kolkata') - interval '4 hours')::date $$;

/* Takes one search (or one title refresh) from the caller's allowance for
   today, or says why not. Returns
     {"ok": true,  "remaining": 29}
     {"ok": false, "reason": "limit" | "busy", "remaining": 0}
   "busy" is the app-wide ceiling: YouTube's quota for today is spent. The
   row is locked, so two tabs searching at once cannot both take the last. */
create or replace function public.learn_search_take(p_kind text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  d date := public.learn_study_day();
  s public.learn_search_settings;
  u public.learn_search_usage;
  spent integer;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if to_regprocedure('public.has_access()') is not null then
    if not public.has_access() then
      raise exception 'not a member' using errcode = '42501';
    end if;
  end if;
  if p_kind is null or p_kind not in ('search', 'refresh') then
    raise exception 'unknown kind' using errcode = '22023';
  end if;

  select * into s from public.learn_search_settings where id;
  insert into public.learn_search_usage (user_id, day) values (uid, d) on conflict (user_id, day) do nothing;
  select * into u from public.learn_search_usage where user_id = uid and day = d for update;

  if p_kind = 'search' then
    if u.searches >= s.per_user_searches then
      return jsonb_build_object('ok', false, 'reason', 'limit', 'remaining', 0);
    end if;
    select coalesce(sum(misses), 0) into spent from public.learn_search_usage where day = d;
    if spent >= s.daily_ceiling then
      return jsonb_build_object('ok', false, 'reason', 'busy', 'remaining', s.per_user_searches - u.searches);
    end if;
    update public.learn_search_usage set searches = searches + 1 where user_id = uid and day = d;
    return jsonb_build_object('ok', true, 'remaining', s.per_user_searches - u.searches - 1);
  end if;

  if u.refreshes >= s.per_user_refreshes then
    return jsonb_build_object('ok', false, 'reason', 'limit', 'remaining', 0);
  end if;
  update public.learn_search_usage set refreshes = refreshes + 1 where user_id = uid and day = d;
  return jsonb_build_object('ok', true, 'remaining', s.per_user_refreshes - u.refreshes - 1);
end;
$$;

revoke all on function public.learn_search_take(text) from public, anon;
grant execute on function public.learn_search_take(text) to authenticated;
revoke all on function public.learn_study_day() from public, anon;

/* How many searches the caller has left today, without taking one. */
create or replace function public.learn_search_left()
returns integer
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  used integer;
  cap integer;
begin
  if uid is null then
    return 0;
  end if;
  select per_user_searches into cap from public.learn_search_settings where id;
  select searches into used from public.learn_search_usage where user_id = uid and day = public.learn_study_day();
  return greatest(0, cap - coalesce(used, 0));
end;
$$;

revoke all on function public.learn_search_left() from public, anon;
grant execute on function public.learn_search_left() to authenticated;

-- Old cache rows go after a day (results are only served for 6 hours).
-- Optional, if pg_cron is enabled:
--   select cron.schedule('learn-search-cache', '17 * * * *',
--     $$ delete from public.learn_search_cache where created_at < now() - interval '1 day' $$);
