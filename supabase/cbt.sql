-- ── CBT: a private question bank and practice papers ──
-- Run this once in the Supabase dashboard: SQL Editor → New query → Run.
-- Every statement is idempotent; re-run it any time. It depends on nothing
-- else in supabase/ and nothing else depends on it.
--
-- A PRIVATE FEATURE, GATED IN THE DATABASE.
--
-- The CBT is for the people listed in `user_features` and nobody else. Every
-- table, the storage bucket and every policy below re-derive that from the
-- caller's verified JWT through `public.has_feature('cbt')`. The client hides
-- the Question bank from everyone else, but that is presentation: a student
-- who forces the tab open in devtools gets empty lists and refused writes.
--
-- Same stance as `user_roles` in admin.sql, and deliberately a separate
-- table: `user_roles` holds one role per person, and "may use the CBT" is not
-- a role — an administrator does not get it by being one.
--
-- WHY NOT `user_profiles`.
-- A question bank is thousands of rows of LaTeX plus figure paths. Inside the
-- synced jsonb blob it would be re-uploaded on every state change, which is
-- the same reason the error notebook is text-only. Only the summary of a
-- finished paper (a MockTest and its ErrorEntries) goes into AppState.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Feature grants
--
-- No insert/update/delete policy at all: under RLS that denies those
-- operations to every client, so the only way in is the statement in §6, run
-- by hand from the SQL editor.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.user_features (
  user_id    uuid        not null references auth.users (id) on delete cascade,
  feature    text        not null,
  granted_at timestamptz not null default now(),
  primary key (user_id, feature),
  -- A typo here would be a grant nothing ever checks. Add a feature to this
  -- list when one is added to the app.
  constraint user_features_known check (feature in ('cbt'))
);

alter table public.user_features enable row level security;

drop policy if exists "read own features" on public.user_features;
create policy "read own features"
  on public.user_features for select
  to authenticated
  using (auth.uid() = user_id);

-- `security definer` so a policy on a table can call it without needing a
-- select grant on `user_features`; `set search_path` so a caller cannot shadow
-- the table with one of their own.
create or replace function public.has_feature(p_feature text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_features
    where user_id = auth.uid() and feature = p_feature
  );
$$;

-- Supabase grants EXECUTE to `anon` by name, so revoking from `public` alone
-- is not enough.
revoke all on function public.has_feature(text) from public, anon;
grant execute on function public.has_feature(text) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Sources — one row per imported PDF
--
-- `file_hash` is the SHA-256 of the PDF. Unique per user, so importing the
-- same file twice is refused rather than doubling the bank.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.qbank_sources (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  name       text        not null check (char_length(name) between 1 and 120),
  file_hash  text        not null check (file_hash ~ '^[0-9a-f]{64}$'),
  pages      int         check (pages between 0 and 5000),
  exam       text        not null default 'mains' check (exam in ('mains', 'advanced', 'neet', 'other')),
  extractor  text        check (char_length(extractor) <= 120),
  created_at timestamptz not null default now(),
  unique (user_id, file_hash)
);

alter table public.qbank_sources enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Questions
--
-- `body` and `options` are text with inline LaTeX ($…$) and figure tokens
-- ([[fig:N]] → figures[N], a path in the `qbank` bucket).
--
-- `answer` is {"option": 0-3} for an MCQ, {"value": n} for a numerical, or
-- null. A question with no answer can never be graded, so it can never be
-- `ready` — that is a CHECK, not a client convention, because one wrong
-- answer key teaches the wrong physics.
--
-- `text_hash` is the SHA-256 of the normalised question text. Unique per user:
-- the same PYQ printed in three PDFs is one question.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.qbank_questions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  source_id   uuid        not null references public.qbank_sources (id) on delete cascade,
  number      text        check (char_length(number) <= 20),
  kind        text        not null check (kind in ('mcq', 'numerical')),
  body        text        not null check (char_length(body) between 1 and 8000),
  options     jsonb,
  answer      jsonb,
  figures     text[]      not null default '{}' check (cardinality(figures) <= 12),
  subject     text        not null check (subject in ('Physics', 'Chemistry', 'Maths', 'Biology')),
  class_id    smallint    check (class_id in (11, 12)),
  chapter     text        check (char_length(chapter) between 1 and 120),
  topic       text        check (char_length(topic) <= 60),
  year        smallint    check (year between 1978 and 2100),
  shift       text        check (char_length(shift) <= 40),
  difficulty  smallint    check (difficulty between 1 and 5),
  confidence  real        check (confidence between 0 and 1),
  status      text        not null default 'needs_review'
                          check (status in ('needs_review', 'ready', 'ungraded', 'rejected')),
  text_hash   text        not null check (text_hash ~ '^[0-9a-f]{64}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (user_id, text_hash),

  -- An MCQ has exactly four options; a numerical has none.
  constraint qbank_options_shape check (
    (kind = 'mcq' and jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4)
    or (kind = 'numerical' and options is null)
  ),
  -- The answer matches the kind, or is absent.
  constraint qbank_answer_shape check (
    answer is null
    or (kind = 'mcq' and jsonb_typeof(answer) = 'object' and (answer ->> 'option') in ('0', '1', '2', '3'))
    or (kind = 'numerical' and jsonb_typeof(answer) = 'object' and jsonb_typeof(answer -> 'value') = 'number')
  ),
  -- A question that can be put in a paper is one that can be graded and placed.
  constraint qbank_ready_is_complete check (
    status <> 'ready' or (answer is not null and chapter is not null and class_id is not null)
  )
);

create index if not exists qbank_questions_pool
  on public.qbank_questions (user_id, subject, status);
create index if not exists qbank_questions_source
  on public.qbank_questions (source_id);

alter table public.qbank_questions enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Papers — one row per sitting
--
-- `blueprint` holds the sections, marking and duration; `question_ids` the
-- paper in order. No foreign key into qbank_questions (Postgres has none for
-- arrays): deleting a source leaves an old paper pointing at questions that
-- are gone, and the review screen says so rather than the delete being
-- refused.
--
-- `responses` is written while the paper runs and once more at submit. A
-- retake is a new row with the same seed, never an overwrite.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.cbt_papers (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  name         text        not null check (char_length(name) between 1 and 80),
  kind         text        not null check (kind in ('full', 'subject', 'chapters')),
  blueprint    jsonb       not null,
  seed         bigint      not null,
  question_ids uuid[]      not null check (cardinality(question_ids) between 1 and 200),
  responses    jsonb       not null default '{}'::jsonb,
  started_at   timestamptz,
  submitted_at timestamptz,
  score        jsonb,
  -- The MockTest this sitting became, once it was saved to Mocks.
  mock_id      text        check (char_length(mock_id) <= 64),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists cbt_papers_recent
  on public.cbt_papers (user_id, created_at desc);

alter table public.cbt_papers enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Policies — your own rows, and only while you hold the feature
--
-- Holding the feature is checked on every statement, not just at sign-in:
-- deleting your row from `user_features` locks the bank immediately, and
-- re-inserting it gives it back untouched.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  t text;
begin
  foreach t in array array['qbank_sources', 'qbank_questions', 'cbt_papers'] loop
    execute format('drop policy if exists "cbt owner select" on public.%I', t);
    execute format('drop policy if exists "cbt owner insert" on public.%I', t);
    execute format('drop policy if exists "cbt owner update" on public.%I', t);
    execute format('drop policy if exists "cbt owner delete" on public.%I', t);

    execute format($p$create policy "cbt owner select" on public.%I for select to authenticated
      using (auth.uid() = user_id and public.has_feature('cbt'))$p$, t);
    execute format($p$create policy "cbt owner insert" on public.%I for insert to authenticated
      with check (auth.uid() = user_id and public.has_feature('cbt'))$p$, t);
    execute format($p$create policy "cbt owner update" on public.%I for update to authenticated
      using (auth.uid() = user_id and public.has_feature('cbt'))
      with check (auth.uid() = user_id and public.has_feature('cbt'))$p$, t);
    execute format($p$create policy "cbt owner delete" on public.%I for delete to authenticated
      using (auth.uid() = user_id and public.has_feature('cbt'))$p$, t);
  end loop;
end $$;

-- A question must sit under a source its writer owns; without this a row
-- could be filed under somebody else's source id (it would still be the
-- writer's own row, but the cascade on that source would then reach it).
drop policy if exists "cbt question source is mine" on public.qbank_questions;
create policy "cbt question source is mine"
  on public.qbank_questions as restrictive for insert
  to authenticated
  with check (exists (
    select 1 from public.qbank_sources s
    where s.id = qbank_questions.source_id and s.user_id = auth.uid()
  ));


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Figures — a private bucket, one folder per user
--
-- Paths are `<user id>/<source id>/<file>`. Only the folder owner, holding the
-- feature, can read or write it; figures are served through short-lived
-- signed URLs, never public ones.
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('qbank', 'qbank', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "qbank figures select" on storage.objects;
create policy "qbank figures select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'qbank' and (storage.foldername(name))[1] = auth.uid()::text and public.has_feature('cbt'));

drop policy if exists "qbank figures insert" on storage.objects;
create policy "qbank figures insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'qbank' and (storage.foldername(name))[1] = auth.uid()::text and public.has_feature('cbt'));

drop policy if exists "qbank figures update" on storage.objects;
create policy "qbank figures update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'qbank' and (storage.foldername(name))[1] = auth.uid()::text and public.has_feature('cbt'))
  with check (bucket_id = 'qbank' and (storage.foldername(name))[1] = auth.uid()::text and public.has_feature('cbt'));

drop policy if exists "qbank figures delete" on storage.objects;
create policy "qbank figures delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'qbank' and (storage.foldername(name))[1] = auth.uid()::text and public.has_feature('cbt'));


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Granting the feature
--
-- Run by hand, with the email of an account that already exists (sign up in
-- the app first). There is no in-app way to do this, on purpose.
-- ═══════════════════════════════════════════════════════════════════════════

--   insert into public.user_features (user_id, feature)
--   select id, 'cbt' from auth.users where lower(email) = lower('you@example.com')
--   on conflict do nothing;

-- Taking it away (the bank stays, locked, until it is granted again):
--
--   delete from public.user_features
--   where feature = 'cbt'
--     and user_id = (select id from auth.users where lower(email) = lower('you@example.com'));
