-- ═══════════════════════════════════════════════════════════════════════════
-- Alpha Notes — sync between a student's own devices
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Notes are local first (notes/store.ts): every page lives in IndexedDB on the
-- device and works with no account at all. This file exists only so the same
-- account on a second device sees the same pages.
--
-- What is stored is Yjs updates, base64, one row per page per burst of typing.
-- The server never reads them: it cannot merge Yjs and does not need to.
-- Clients merge, which is why two devices editing offline both keep their
-- words. A page's rows are periodically replaced by one snapshot
-- (`compact_note_doc`), so a table that only grew is kept to a few rows a page.
--
-- Deliberately not `user_profiles`: notes inside the AppState blob would be
-- re-uploaded whole on every keystroke, and every merge path in App.tsx would
-- have to learn about them.
--
-- Private to the author. No policy here mentions is_admin(): staff cannot read
-- a student's notes, the same stance as a private group's chat.
--
-- Run it any time; re-runnable. Then deploy.

-- ── 1. The rows ────────────────────────────────────────────────────────────

create table if not exists public.note_updates (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- 'workspace' (the page tree) or a page id from notes/bytes.ts newId().
  doc_id     text not null check (doc_id ~ '^[a-z0-9_-]{1,64}$'),
  -- The writing database's id, so a device skips its own rows on a pull.
  origin     text not null check (origin ~ '^[a-z0-9]{8,32}$'),
  data       text not null check (length(data) between 1 and 4000000),
  kind       text not null default 'update' check (kind in ('update', 'snapshot')),
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists note_updates_pull on public.note_updates (user_id, created_at, id);
create index if not exists note_updates_doc on public.note_updates (user_id, doc_id, created_at);

-- The pull cursor is created_at, so the client must not be able to choose it:
-- a backdated row would land behind every other device's cursor and never be
-- read. The trigger also owns `kind` (snapshots come only from the function
-- below) and keeps a runaway client from flooding the table.
create or replace function public.note_updates_before_insert()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.created_at := clock_timestamp();
  if coalesce(current_setting('alpha.note_snapshot', true), '') <> 'on' then
    new.kind := 'update';
  end if;
  if (select count(*) from public.note_updates
       where user_id = new.user_id and created_at > clock_timestamp() - interval '1 minute') >= 600 then
    raise exception 'note_flood' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists note_updates_before_insert on public.note_updates;
create trigger note_updates_before_insert
  before insert on public.note_updates
  for each row execute function public.note_updates_before_insert();

alter table public.note_updates enable row level security;

drop policy if exists "notes: read own" on public.note_updates;
create policy "notes: read own" on public.note_updates
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "notes: write own" on public.note_updates;
create policy "notes: write own" on public.note_updates
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "notes: delete own" on public.note_updates;
create policy "notes: delete own" on public.note_updates
  for delete to authenticated using (auth.uid() = user_id);

-- No UPDATE policy: a row is never edited, only superseded by a snapshot.
revoke all on public.note_updates from anon, public;
grant select, insert, delete on public.note_updates to authenticated;

-- ── 2. Compaction ──────────────────────────────────────────────────────────
-- The caller's full state for one page replaces every row of that page older
-- than `p_before`: the point up to which the caller has certainly seen every
-- other device's rows (its pull cursor less the overlap). Rows newer than that
-- stay, so nothing another device wrote a moment ago is lost. The snapshot is
-- inserted first and is newer than every row it replaces, so a device that is
-- behind fetches it and gets everything.
--
-- Security invoker: RLS applies, so the caller can only touch their own rows.

create or replace function public.compact_note_doc(p_doc text, p_origin text, p_data text, p_before timestamptz)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  new_id bigint;
  removed integer;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '28000'; end if;
  perform set_config('alpha.note_snapshot', 'on', true);
  insert into public.note_updates (user_id, doc_id, origin, data, kind)
    values (uid, p_doc, p_origin, p_data, 'snapshot')
    returning id into new_id;
  perform set_config('alpha.note_snapshot', 'off', true);
  delete from public.note_updates
   where user_id = uid and doc_id = p_doc and id <> new_id and created_at < p_before;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.compact_note_doc(text, text, text, timestamptz) from public, anon;
grant execute on function public.compact_note_doc(text, text, text, timestamptz) to authenticated;

-- ── 3. Realtime: the doorbell ──────────────────────────────────────────────
-- Postgres Changes applies the SELECT policy per subscriber, so a device only
-- ever hears about its own account's rows. Only INSERTs are listened to.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'note_updates'
  ) then
    alter publication supabase_realtime add table public.note_updates;
  end if;
end;
$$;

-- ── 4. Images ──────────────────────────────────────────────────────────────
-- Compressed on the device (notes/files.ts) and stored as <uid>/<id>.<ext> in
-- a private bucket. Only the owner's folder is readable or writable.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notes', 'notes', false, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "notes media read" on storage.objects;
create policy "notes media read" on storage.objects
  for select to authenticated
  using (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "notes media add" on storage.objects;
create policy "notes media add" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "notes media replace" on storage.objects;
create policy "notes media replace" on storage.objects
  for update to authenticated
  using (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "notes media remove" on storage.objects;
create policy "notes media remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'notes' and (storage.foldername(name))[1] = auth.uid()::text);
