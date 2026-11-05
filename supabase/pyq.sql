-- ── PYQ: a shared bank of JEE Main questions from NTA's own papers ──
-- Run after access.sql and cbt.sql: SQL Editor → New query → Run. Every
-- statement is idempotent; re-run it any time (and after re-running cbt.sql).
--
-- WHAT IT IS.
-- The private CBT (cbt.sql) is one student's hand-made bank. This file adds a
-- second, shared bank that every member can sit papers from. Its questions are
-- NTA's own published papers: each question and option is NTA's image, and the
-- answer is NTA's final answer key, matched by NTA's Question ID. Nothing is
-- typed or read by a model. The rows are loaded by scripts/pyq/load.py with the
-- service role; no client can write them.
--
-- WHO CAN USE IT.
-- `pyq_open()`: a member (`has_access()`), and either granted the `pyq`
-- feature (a staged rollout, by hand in §8) or the global switch is on. The
-- switch stays off until NTA has given permission to reproduce its papers.
--
-- THE BANK CAN'T BE BULK-DOWNLOADED.
-- `pyq_questions` has no client policy at all. A student reads:
--   pyq_index()               what the generator needs: subject, kind, chapter…
--   pyq_create_paper(…)       a sitting, at most 90 questions, 12 a day, kept for good
--   pyq_paper_questions(id)   the images of their own paper's questions
--   pyq_paper_answers(id)     the answers, once that paper is submitted, or at
--                             once for a practice paper (blueprint.mode =
--                             'practice'), which checks each answer as it goes
-- and figures are signed only for questions in a paper they own.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. The feature name and the switch
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.user_features drop constraint if exists user_features_known;
alter table public.user_features add constraint user_features_known check (feature in ('cbt', 'pyq'));

create table if not exists public.pyq_settings (
  id         smallint    primary key default 1 check (id = 1),
  live       boolean     not null default false,
  updated_at timestamptz not null default now()
);
insert into public.pyq_settings (id) values (1) on conflict (id) do nothing;
alter table public.pyq_settings enable row level security;
revoke all on public.pyq_settings from public, anon, authenticated;

create or replace function public.pyq_open()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_access() then
    return false;
  end if;
  return exists (select 1 from public.user_features where user_id = auth.uid() and feature = 'pyq')
      or coalesce((select live from public.pyq_settings where id = 1), false);
end;
$$;

revoke all on function public.pyq_open() from public, anon;
grant execute on function public.pyq_open() to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Questions
--
-- `body` and `options` are figure tokens ([[fig:N]] → figures[N]), a path in
-- the `pyq` bucket. `answer` is {"option": 0-3} or {"value": n}, or null for a
-- question NTA dropped, bonused or gave two answers: such a row is kept (it is
-- part of the paper) but never put in a sitting.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.pyq_questions (
  id          uuid        primary key default gen_random_uuid(),
  nta_id      text        not null unique check (nta_id ~ '^[0-9]{6,14}$'),
  paper       text        not null check (paper ~ '^[0-9]{4}-[0-9]{4}-S[12]$'),
  exam_date   date        not null,
  shift       smallint    not null check (shift in (1, 2)),
  number      smallint    not null check (number between 1 and 120),
  kind        text        not null check (kind in ('mcq', 'numerical')),
  subject     text        not null check (subject in ('Physics', 'Chemistry', 'Maths')),
  section     text        check (section in ('A', 'B')),
  body        text        not null check (char_length(body) between 1 and 400),
  options     jsonb,
  answer      jsonb,
  figures     text[]      not null check (cardinality(figures) between 1 and 12),
  class_id    smallint    check (class_id in (11, 12)),
  chapter     text        check (char_length(chapter) between 1 and 120),
  confidence  real        check (confidence between 0 and 1),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint pyq_options_shape check (
    (kind = 'mcq' and jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4)
    or (kind = 'numerical' and options is null)
  ),
  constraint pyq_answer_shape check (
    answer is null
    or (kind = 'mcq' and jsonb_typeof(answer) = 'object' and (answer ->> 'option') in ('0', '1', '2', '3'))
    or (kind = 'numerical' and jsonb_typeof(answer) = 'object' and jsonb_typeof(answer -> 'value') = 'number')
  ),
  -- A chapter is only ever set together with its class.
  constraint pyq_chapter_has_class check ((chapter is null) = (class_id is null))
);

-- Words to search the web with for a worked solution: the start of the
-- question's on-device OCR, cleaned (scripts/pyq/load.py). Handed out only
-- with the answers, so it is never a way to read the bank early.
alter table public.pyq_questions add column if not exists search_text text;
alter table public.pyq_questions drop constraint if exists pyq_search_text_len;
alter table public.pyq_questions add constraint pyq_search_text_len check (char_length(search_text) <= 400);

create index if not exists pyq_questions_paper on public.pyq_questions (paper, number);
create index if not exists pyq_questions_figures on public.pyq_questions using gin (figures);

alter table public.pyq_questions enable row level security;
revoke all on public.pyq_questions from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Sittings live in cbt_papers, marked by `bank`
--
-- A PYQ sitting is created only by pyq_create_paper(). Its owner may then save
-- responses and submit, but never change which questions it holds: otherwise a
-- paper could be rewritten into a list of every question in the bank.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.cbt_papers add column if not exists bank text not null default 'private';
alter table public.cbt_papers drop constraint if exists cbt_papers_bank_check;
alter table public.cbt_papers add constraint cbt_papers_bank_check check (bank in ('private', 'pyq'));

-- 'shift' is a real NTA paper, sat as it was set.
alter table public.cbt_papers drop constraint if exists cbt_papers_kind_check;
alter table public.cbt_papers add constraint cbt_papers_kind_check check (kind in ('full', 'subject', 'chapters', 'shift'));

create index if not exists cbt_papers_pyq_recent on public.cbt_papers (user_id, created_at desc) where bank = 'pyq';

-- Permissive policies OR together, so these add PYQ sittings beside cbt.sql's
-- owner policies without touching them.
drop policy if exists "pyq owner select" on public.cbt_papers;
create policy "pyq owner select" on public.cbt_papers for select to authenticated
  using (auth.uid() = user_id and bank = 'pyq' and public.pyq_open());

drop policy if exists "pyq owner update" on public.cbt_papers;
create policy "pyq owner update" on public.cbt_papers for update to authenticated
  using (auth.uid() = user_id and bank = 'pyq' and public.pyq_open())
  with check (auth.uid() = user_id and bank = 'pyq' and public.pyq_open());

-- A PYQ sitting is never deleted by a client, not even by a holder of `cbt`
-- (whose cbt.sql delete policy would otherwise reach it): the 12-a-day limit
-- counts the rows, so deleting one would buy another sitting, and another
-- 90 questions' images. Account deletion cascades from auth.users regardless.
drop policy if exists "pyq owner delete" on public.cbt_papers;
drop policy if exists "pyq papers are kept" on public.cbt_papers;
create policy "pyq papers are kept" on public.cbt_papers as restrictive for delete to authenticated
  using (bank = 'private');

-- No client inserts a PYQ sitting directly, not even a holder of `cbt`.
drop policy if exists "pyq only through the rpc" on public.cbt_papers;
create policy "pyq only through the rpc" on public.cbt_papers as restrictive for insert to authenticated
  with check (bank = 'private');

create or replace function public.cbt_papers_guard()
returns trigger
language plpgsql
as $$
begin
  if new.bank is distinct from old.bank then
    raise exception 'a paper''s bank cannot change';
  end if;
  if old.bank = 'pyq' and (
       new.question_ids is distinct from old.question_ids
    or new.blueprint is distinct from old.blueprint
    or new.kind is distinct from old.kind
    or new.seed is distinct from old.seed
    or new.user_id is distinct from old.user_id) then
    raise exception 'a PYQ paper''s questions cannot change';
  end if;
  return new;
end;
$$;

drop trigger if exists cbt_papers_guard on public.cbt_papers;
create trigger cbt_papers_guard before update on public.cbt_papers
  for each row execute function public.cbt_papers_guard();


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Reading
-- ═══════════════════════════════════════════════════════════════════════════

-- Everything a paper can be built from, without the question itself.
create or replace function public.pyq_index()
returns table (
  id uuid, paper text, exam_date date, shift smallint, number smallint,
  kind text, subject text, section text, class_id smallint, chapter text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.pyq_open() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select q.id, q.paper, q.exam_date, q.shift, q.number, q.kind, q.subject, q.section, q.class_id, q.chapter
    from public.pyq_questions q
    where q.answer is not null
    order by q.paper, q.number;
end;
$$;

create or replace function public.pyq_paper_questions(p_paper uuid)
returns table (
  id uuid, paper text, exam_date date, shift smallint, number smallint, kind text, subject text,
  body text, options jsonb, figures text[], class_id smallint, chapter text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ids uuid[];
begin
  if not public.pyq_open() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select c.question_ids into ids from public.cbt_papers c
    where c.id = p_paper and c.user_id = auth.uid() and c.bank = 'pyq';
  if ids is null then
    raise exception 'no such paper' using errcode = 'P0002';
  end if;
  return query
    select q.id, q.paper, q.exam_date, q.shift, q.number, q.kind, q.subject,
           q.body, q.options, q.figures, q.class_id, q.chapter
    from public.pyq_questions q
    where q.id = any (ids);
end;
$$;

-- Answers exist for a sitting only after it is submitted, except a practice
-- paper, whose whole point is checking each answer as you go. That gives away
-- nothing a mock does not: submit a mock at once and its answers arrive too,
-- under the same 90-question, 12-a-day limits. The mode is in the blueprint,
-- which cbt_papers_guard() freezes, so a mock cannot be turned into practice
-- halfway through to read its answers.
-- Its return type gained search_text, which `create or replace` cannot change.
drop function if exists public.pyq_paper_answers(uuid);
create function public.pyq_paper_answers(p_paper uuid)
returns table (id uuid, answer jsonb, search_text text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ids uuid[];
begin
  if not public.pyq_open() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select c.question_ids into ids from public.cbt_papers c
    where c.id = p_paper and c.user_id = auth.uid() and c.bank = 'pyq'
      and (c.submitted_at is not null or c.blueprint ->> 'mode' = 'practice');
  if ids is null then
    raise exception 'submit the paper first' using errcode = 'P0002';
  end if;
  return query select q.id, q.answer, q.search_text from public.pyq_questions q where q.id = any (ids);
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Creating a sitting
--
-- The paper is chosen on the device (cbt/generate.ts, seeded and tested); the
-- server checks it: real, answerable questions, no repeats, at most 90, and at
-- most 12 new sittings in 24 hours.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.pyq_create_paper(
  p_name text, p_kind text, p_blueprint jsonb, p_seed bigint, p_question_ids uuid[]
)
returns setof public.cbt_papers
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n int := coalesce(cardinality(p_question_ids), 0);
  recent int;
begin
  if not public.pyq_open() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if n < 1 or n > 90 then
    raise exception 'a paper holds 1 to 90 questions' using errcode = '22023';
  end if;
  if (select count(distinct x) from unnest(p_question_ids) x) <> n then
    raise exception 'a question appears twice' using errcode = '22023';
  end if;
  if (select count(*) from public.pyq_questions q where q.id = any (p_question_ids) and q.answer is not null) <> n then
    raise exception 'unknown question' using errcode = '22023';
  end if;
  select count(*) into recent from public.cbt_papers
    where user_id = auth.uid() and bank = 'pyq' and created_at > now() - interval '24 hours';
  if recent >= 12 then
    raise exception 'That''s 12 papers today. Come back tomorrow.' using errcode = '54000';
  end if;
  return query
    insert into public.cbt_papers (user_id, name, kind, blueprint, seed, question_ids, bank)
    values (auth.uid(), left(coalesce(nullif(trim(p_name), ''), 'PYQ paper'), 80), p_kind, p_blueprint, p_seed, p_question_ids, 'pyq')
    returning *;
end;
$$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Figures: a private bucket, signed only for questions in your own paper
-- ═══════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pyq', 'pyq', false, 524288, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.pyq_figure_visible(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.pyq_open() and exists (
    select 1 from public.pyq_questions q
    where q.figures @> array[p_name]
      and exists (
        select 1 from public.cbt_papers c
        where c.user_id = auth.uid() and c.bank = 'pyq' and q.id = any (c.question_ids)
      )
  );
$$;

drop policy if exists "pyq figures select" on storage.objects;
create policy "pyq figures select" on storage.objects for select to authenticated
  using (bucket_id = 'pyq' and public.pyq_figure_visible(name));


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Grants. Supabase grants EXECUTE to anon by name, so revoke from both.
-- ═══════════════════════════════════════════════════════════════════════════

revoke all on function public.pyq_index()                                   from public, anon;
revoke all on function public.pyq_paper_questions(uuid)                     from public, anon;
revoke all on function public.pyq_paper_answers(uuid)                       from public, anon;
revoke all on function public.pyq_create_paper(text, text, jsonb, bigint, uuid[]) from public, anon;
revoke all on function public.pyq_figure_visible(text)                      from public, anon;
revoke all on function public.cbt_papers_guard()                            from public, anon, authenticated;

grant execute on function public.pyq_index()                                   to authenticated;
grant execute on function public.pyq_paper_questions(uuid)                     to authenticated;
grant execute on function public.pyq_paper_answers(uuid)                       to authenticated;
grant execute on function public.pyq_create_paper(text, text, jsonb, bigint, uuid[]) to authenticated;
grant execute on function public.pyq_figure_visible(text)                      to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Turning it on
--
-- For one account (testing, or a first batch), with an email that exists:
--
--   insert into public.user_features (user_id, feature)
--   select id, 'pyq' from auth.users where lower(email) = lower('you@example.com')
--   on conflict do nothing;
--
-- For every member, once NTA has said yes:
--
--   update public.pyq_settings set live = true, updated_at = now() where id = 1;
--
-- And off again:
--
--   update public.pyq_settings set live = false, updated_at = now() where id = 1;
-- ═══════════════════════════════════════════════════════════════════════════
