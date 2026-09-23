-- ── Profiles ──
-- Run this once in the Supabase dashboard: SQL Editor → New query → Run.
--
-- A public identity card, deliberately separate from `user_profiles` (that
-- table is one user's whole AppState as a jsonb blob, private by design) and
-- deliberately separate from `leaderboard_entries` (a Race alias, re-chosen
-- per day, that already has its own display_name). This table answers a third
-- question neither of those does: "who is this person, in general" — a name,
-- a bio, a picture, readable by anyone signed in, editable by nobody but its
-- owner.
--
-- What it does NOT hold: total hours studied. That is already public, already
-- authoritative, and already un-editable from here — it is
-- `sum(leaderboard_entries.hours)` for the user, computed at read time (see
-- profile/profileApi.ts). Storing a second copy on this table would be a
-- number the profile's own owner could simply type over.

create table if not exists public.profiles (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  -- The public URL slug (/u/:handle). Opaque and immutable — generated once,
  -- never derived from display_name — so renaming yourself never breaks a
  -- link someone already has, and it never leaks the auth uuid.
  handle       text        not null unique,
  display_name text        not null,
  bio          text,
  avatar_type  text        not null default 'alpha',
  -- Exactly one of these is set, enforced below. 'alpha' -> avatar_id names an
  -- entry in profile/alphaAvatars.tsx (code-defined, not stored here — new
  -- avatars ship without touching this table). 'upload' -> avatar_url is the
  -- public Storage URL from the 'avatars' bucket below.
  avatar_id    text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Mirrors leaderboard's MIN_NAME/MAX_NAME (leaderboard/api.ts) — the same
  -- bounds already govern a Race display name, so one is never valid where
  -- the other isn't.
  constraint display_name_length check (char_length(trim(display_name)) between 2 and 24),
  -- Mirrors profileApi.ts's MAX_BIO. Short on purpose — a identity card, not a
  -- text box.
  constraint bio_length check (bio is null or char_length(bio) <= 140),
  constraint handle_shape check (handle ~ '^[a-z0-9]{6,16}$'),
  constraint avatar_type_valid check (avatar_type in ('upload', 'alpha')),
  constraint avatar_alpha_shape check ((avatar_type = 'alpha') = (avatar_id is not null)),
  constraint avatar_upload_shape check ((avatar_type = 'upload') = (avatar_url is not null))
);

alter table public.profiles enable row level security;

-- Anyone signed in can look anyone up — the entire point of a public identity
-- card, and nothing on this row is sensitive (no email, no auth id beyond the
-- primary key itself, which is never selected into a client-facing list; see
-- profile/profileApi.ts, which always projects an explicit column list).
drop policy if exists "profiles are readable by signed-in users" on public.profiles;
create policy "profiles are readable by signed-in users"
  on public.profiles for select
  to authenticated
  using (true);

-- You may only ever change your own row.
drop policy if exists "users update their own profile" on public.profiles;
create policy "users update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No insert policy. Under RLS that denies a bare client insert to everyone —
-- on purpose. The only writer of a NEW row is ensure_profile() below, because
-- creating one properly needs two things a client insert cannot safely do:
-- read auth.users for the true signup date and any Google name, and read
-- leaderboard_entries for a Race name already chosen. A definer function can
-- do both without granting the client read access to either.
-- No delete policy either — profile deletion isn't a feature.


-- ═══════════════════════════════════════════════════════════════════════════
-- ensure_profile() — get this user's profile, creating it on first call.
--
-- Called once per session after sign-in (see profile/useProfileController.ts)
-- and doubles as the backfill for every account that predates this table —
-- there is deliberately no separate migration script, because "does this
-- user have a profile yet" and "create the first one" are the same branch.
--
-- security definer so it can read auth.users (for the real created_at and any
-- Google profile name) and leaderboard_entries (for a Race name already
-- chosen) — neither of which the client may read directly for another user,
-- and here it's only ever reading its own caller's row of each.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  existing     public.profiles;
  uid          uuid := auth.uid();
  seed_name    text;
  real_created timestamptz;
  seed_handle  text;
  seed_avatar  text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into existing from public.profiles where user_id = uid;
  if found then
    return existing;
  end if;

  select created_at into real_created from auth.users where id = uid;

  -- Priority: a Race name they already picked, then whatever Google handed
  -- back at sign-in, then the part of their email before the @, then a plain
  -- fallback. All server-side — nothing here trusts client input.
  select le.display_name into seed_name
    from public.leaderboard_entries le
   where le.user_id = uid
   order by le.date desc
   limit 1;

  if seed_name is null then
    select coalesce(
      nullif(trim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(u.raw_user_meta_data->>'name'), ''),
      nullif(trim(split_part(u.email, '@', 1)), '')
    ) into seed_name
    from auth.users u
    where u.id = uid;
  end if;

  seed_name := coalesce(nullif(trim(seed_name), ''), 'Racer');
  -- The same shape display_name_length enforces, so a long Google name or
  -- email local-part can't fail the insert below.
  seed_name := left(seed_name, 24);
  if char_length(seed_name) < 2 then
    seed_name := 'Racer';
  end if;

  seed_handle := lower(encode(gen_random_bytes(5), 'hex'));
  -- One pseudo-random pick out of 16, seeded from the user's own id so it's
  -- stable if this ever runs twice for the same uid (it can't, given the
  -- select above, but stable-over-arbitrary is a free property here).
  seed_avatar := 'alpha_' || lpad((1 + (('x' || substr(md5(uid::text), 1, 8))::bit(32)::bigint % 16))::text, 2, '0');

  insert into public.profiles (user_id, handle, display_name, avatar_type, avatar_id, created_at, updated_at)
  values (uid, seed_handle, seed_name, 'alpha', seed_avatar, coalesce(real_created, now()), now())
  returning * into existing;

  return existing;
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- profile_total_hours() — the one stat the profile card shows.
--
-- Not `security definer` — leaderboard_entries is already readable by any
-- authenticated user (see supabase/leaderboard.sql), so this needs no
-- elevated privilege. It exists only because PostgREST has no ad-hoc sum()
-- over a plain table select, and shipping years of daily rows to the client
-- just to add them up client-side would be the exact "N individual queries /
-- unbounded payload" mistake the rest of this app avoids.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.profile_total_hours(p_user_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(hours), 0) from public.leaderboard_entries where user_id = p_user_id;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- Storage — Alpha Avatars need none (they're inline SVG, see
-- profile/alphaAvatars.tsx); an uploaded photo needs a bucket.
--
-- Public, deliberately: a profile picture on a public identity card isn't
-- sensitive, and a public bucket serves it via a stable URL with no signed-URL
-- expiry to manage — every leaderboard row and chat bubble that renders an
-- <img> would otherwise need to refresh a signature. Only the WRITE side is
-- restricted: an object's first path segment must be the uploader's own id,
-- so `avatars/<user_id>/<file>` is the only path a given user may write to.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "users upload their own avatar" on storage.objects;
create policy "users upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users replace their own avatar" on storage.objects;
create policy "users replace their own avatar"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete their own avatar" on storage.objects;
create policy "users delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- No select policy needed: the bucket's `public` flag serves GET requests
-- through /storage/v1/object/public/avatars/... without RLS being consulted.
