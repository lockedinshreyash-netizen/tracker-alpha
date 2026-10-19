-- ── Festive themes ──────────────────────────────────────────────────────────
--
-- One switch for the whole app: which festive theme, if any, every student
-- sees right now. An administrator flips it in Console → Theme and every open
-- copy of Alpha changes within a second (Realtime), guests included.
--
-- Shape: a single-row table. `id` is pinned to 1 by a CHECK, so there is
-- exactly one answer to "what is the theme" and nowhere for a second to drift.
--
-- Who can do what:
--   * read  — everybody, `anon` included. A theme is decoration, not data, and
--             a signed-out guest is still a student who should see Diwali.
--   * write — nobody directly. There is no INSERT/UPDATE/DELETE policy, so RLS
--             refuses every client write; the only writer is
--             `admin_set_festive_theme`, which checks `is_admin()` first.
--
-- Run after admin.sql (it needs `public.is_admin()`). Re-runs cleanly.

create table if not exists public.app_settings (
  id             smallint primary key default 1 check (id = 1),
  festive_theme  text not null default 'none'
                 check (festive_theme in ('none', 'dussehra', 'diwali', 'christmas')),
  updated_at     timestamptz not null default now()
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- Dussehra became its own theme after the first version shipped with
-- 'none' | 'diwali' | 'christmas'. `create table if not exists` leaves an old
-- table's CHECK alone, so it is replaced here by name.
alter table public.app_settings drop constraint if exists app_settings_festive_theme_check;
alter table public.app_settings add constraint app_settings_festive_theme_check
  check (festive_theme in ('none', 'dussehra', 'diwali', 'christmas'));

alter table public.app_settings enable row level security;

drop policy if exists "app_settings readable by everyone" on public.app_settings;
create policy "app_settings readable by everyone"
  on public.app_settings for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.app_settings from anon, authenticated;
grant select on public.app_settings to anon, authenticated;
-- Deliberately no "who flipped it" column: every client can read this row,
-- and an administrator's id has no business being public.

create or replace function public.admin_set_festive_theme(p_theme text)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_theme not in ('none', 'dussehra', 'diwali', 'christmas') then
    raise exception 'unknown theme %', p_theme using errcode = '22023';
  end if;

  insert into public.app_settings (id, festive_theme, updated_at)
  values (1, p_theme, now())
  on conflict (id) do update
    set festive_theme = excluded.festive_theme,
        updated_at    = excluded.updated_at;

  return p_theme;
end;
$$;

revoke all on function public.admin_set_festive_theme(text) from public, anon;
grant execute on function public.admin_set_festive_theme(text) to authenticated;

-- Realtime: the doorbell that makes a flip reach open tabs at once. Realtime
-- applies the SELECT policy per subscriber, and that policy is `true`, so
-- every client — guest or not — receives the UPDATE.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end;
$$;
