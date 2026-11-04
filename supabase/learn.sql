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
