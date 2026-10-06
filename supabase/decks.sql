-- ── Alpha Decks: spaced-repetition flashcards ──
-- Run this once in the Supabase dashboard: SQL Editor → New query → Run.
-- Every statement is idempotent; re-run it any time.
--
-- RUN ORDER: admin.sql first. Who may write an Alpha-wide deck is
-- `public.is_admin()`, and there is deliberately no second definition here.
--
-- THREE CONCEPTS, THREE PLACES — never one field.
--
--   Ownership    who made the deck            decks.owner_id
--   Scope        who may see it               decks.scope  (personal | global)
--   Review state how THIS user is doing with  user_card_progress, one row per
--                THIS card                    (user, card)
--
-- A global deck exists once. Ten thousand students studying card 123 are ten
-- thousand progress rows pointing at the same card row, never ten thousand
-- copies of it. That is what lets an administrator fix a typo once and have it
-- reach everyone, with nobody's schedule disturbed: content and review state
-- are different tables and an edit touches only one of them.
--
-- WHY NOT `user_profiles`. A deck is thousands of rows. In the synced jsonb
-- blob it would be re-uploaded on every state change — the reason the CBT bank
-- is a table too. Nothing in this file is read or written through AppState.
--
-- NOTES AND CARDS. Anki's model, kept: a note is what you write, a card is what
-- you review. "Aldehydes → {{c1::primary alcohols}} with {{c2::LiAlH4}}" is ONE
-- note and TWO cards. `deck_cards` is derived from the note by a trigger and no
-- client may write it, so a card can never disagree with the text it came from.
--
-- PRIVACY. `is_admin()` opens every Alpha-wide deck, drafts included. It never
-- opens a student's personal deck — the same line moderation draws around
-- private group chat. Staff see aggregates of global decks, never anybody's
-- own cards.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Decks
--
-- `owner_id` is nullable only so that deleting an account does not take an
-- Alpha-wide deck down with it (on delete set null). A personal deck whose
-- owner is gone is deleted by the trigger in §6.
--
-- `status` is the publishing lifecycle of a global deck:
--   draft      admins only — being written or being fixed
--   published  in the library, open to everyone
--   archived   retired: gone from the library, but students who already had it
--              keep studying it
-- A personal deck has no audience to publish to, so it is only ever
-- `published` (meaning live) or `archived`.
--
-- `collection` is which shelf an Alpha deck sits on for students:
--   essentials  Alpha Essentials — the must-have decks, shown first and large
--   more        More from Alpha — everything else worth browsing
-- Every global deck has one and no personal deck may (a biconditional check,
-- the same stance `poll_visibility` takes in admin.sql): a deck cannot keep a
-- shelf it no longer has, and a new Alpha deck lands in "more" unless the
-- administrator says otherwise. Administrators can move it later.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.decks (
  id           uuid        primary key default gen_random_uuid(),
  owner_id     uuid        default auth.uid() references auth.users (id) on delete set null,
  scope        text        not null check (scope in ('personal', 'global')),
  title        text        not null check (char_length(btrim(title)) between 1 and 120),
  description  text        check (char_length(description) <= 600),
  subject      text        check (subject in ('Physics', 'Chemistry', 'Maths', 'Biology')),
  class_id     smallint    check (class_id in (11, 12)),
  chapter      text        check (char_length(chapter) between 1 and 120),
  status       text        not null default 'published' check (status in ('draft', 'published', 'archived')),
  collection   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  published_at timestamptz,

  constraint decks_personal_status check (scope = 'global' or status in ('published', 'archived'))
);

-- The shelf, added after the first version of this file: an existing table
-- gets the column, its Alpha decks go to "more", and only then are the checks
-- added. On a fresh install the column already exists and the update is a no-op.
alter table public.decks add column if not exists collection text;
update public.decks set collection = 'more' where scope = 'global' and collection is null;
update public.decks set collection = null where scope = 'personal' and collection is not null;
alter table public.decks drop constraint if exists decks_collection_valid;
alter table public.decks add constraint decks_collection_valid check (collection in ('essentials', 'more'));
alter table public.decks drop constraint if exists decks_collection_scope;
alter table public.decks add constraint decks_collection_scope check ((scope = 'global') = (collection is not null));

create index if not exists decks_owner on public.decks (owner_id) where scope = 'personal';
create index if not exists decks_library on public.decks (status, published_at desc) where scope = 'global';

alter table public.decks enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Notes — the content
--
-- `front` is the cloze text (or the question of a basic card), `back` is
-- Anki's "Back Extra" (or the answer). Both are HTML exactly as Anki stores
-- it; the client sanitises at render time, every time, so nothing written
-- here — by anybody — reaches the page unfiltered.
--
-- Duplicates: `content_hash` is SHA-256 over the normalised text, unique per
-- deck, so importing the same CSV twice adds nothing. `guid` is Anki's own note
-- id when the export carried one (#guid column), unique per deck too.
--
-- `position` is the order new cards are introduced in — the order of the file
-- they were imported from, or of writing.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.deck_notes (
  id           uuid        primary key default gen_random_uuid(),
  deck_id      uuid        not null references public.decks (id) on delete cascade,
  kind         text        not null check (kind in ('cloze', 'basic')),
  front        text        not null check (char_length(front) between 1 and 20000),
  back         text        not null default '' check (char_length(back) <= 20000),
  tags         text[]      not null default '{}' check (cardinality(tags) <= 40),
  guid         text        check (char_length(guid) between 1 and 64),
  content_hash text        not null check (content_hash ~ '^[0-9a-f]{64}$'),
  position     bigint      not null default 0,
  version      int         not null default 1,
  created_by   uuid        default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  unique (deck_id, content_hash)
);

create unique index if not exists deck_notes_guid on public.deck_notes (deck_id, guid) where guid is not null;
create index if not exists deck_notes_order on public.deck_notes (deck_id, position);
create index if not exists deck_notes_tags on public.deck_notes using gin (tags);

alter table public.deck_notes enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Cards — derived, never written by a client
--
-- One row per cloze number (c1, c2, …) of a cloze note; one row with ord 0 for
-- a basic note. Kept in step with the note by the trigger in §6: adding c3 to
-- a note adds a card, removing c2 removes that card (and, by cascade, every
-- student's progress on it — the card no longer exists). Editing the words of
-- c1 changes nothing here, which is why fixing a typo keeps everyone's
-- schedule.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.deck_cards (
  id         uuid        primary key default gen_random_uuid(),
  note_id    uuid        not null references public.deck_notes (id) on delete cascade,
  deck_id    uuid        not null references public.decks (id) on delete cascade,
  ord        smallint    not null check (ord between 0 and 99),
  created_at timestamptz not null default now(),
  unique (note_id, ord)
);

create index if not exists deck_cards_deck on public.deck_cards (deck_id);

alter table public.deck_cards enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. The library, and each student's settings for a deck
--
-- A row here is "this deck is on my shelf". Removing a global deck deletes this
-- row only: progress stays, and adding it back resumes where it was left.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.user_decks (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  deck_id           uuid        not null references public.decks (id) on delete cascade,
  added_at          timestamptz not null default now(),
  new_per_day       smallint    not null default 20 check (new_per_day between 0 and 9999),
  max_reviews       smallint    not null default 200 check (max_reviews between 1 and 9999),
  desired_retention real        not null default 0.9 check (desired_retention between 0.7 and 0.99),
  primary key (user_id, deck_id)
);

create index if not exists user_decks_deck on public.user_decks (deck_id);

alter table public.user_decks enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Review state and review history — per user, per card
--
-- No progress row means the card is new to that user. Nothing is written for a
-- student until they have actually seen a card, so a 5,000-card Alpha deck
-- costs nothing for the people who never open it.
--
-- The fields are FSRS's (ts-fsrs on the client): state 0 new, 1 learning,
-- 2 review, 3 relearning. Scheduling is computed on the client — tampering
-- with it can only ruin the tamperer's own schedule — and written only through
-- `record_reviews` (§8), which derives the deck itself and checks access.
--
-- `review_events` is the history: what was pressed, when, and the state before
-- (`prev`, which is what undo restores). It is also the training data a future
-- per-user FSRS optimiser would need. `client_id` makes a retried upload from
-- the offline outbox land once.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.user_card_progress (
  user_id        uuid        not null references auth.users (id) on delete cascade,
  card_id        uuid        not null references public.deck_cards (id) on delete cascade,
  deck_id        uuid        not null references public.decks (id) on delete cascade,
  state          smallint    not null check (state between 0 and 3),
  due            timestamptz not null,
  stability      real        not null default 0 check (stability between 0 and 1000000),
  difficulty     real        not null default 0 check (difficulty between 0 and 10),
  scheduled_days int         not null default 0 check (scheduled_days between 0 and 36500),
  learning_steps smallint    not null default 0 check (learning_steps between 0 and 100),
  reps           int         not null default 0 check (reps >= 0),
  lapses         int         not null default 0 check (lapses >= 0),
  last_review    timestamptz,
  suspended      boolean     not null default false,
  updated_at     timestamptz not null default now(),
  primary key (user_id, card_id)
);

create index if not exists user_card_progress_due on public.user_card_progress (user_id, deck_id, due);

alter table public.user_card_progress enable row level security;

create table if not exists public.review_events (
  id           bigint      generated always as identity primary key,
  user_id      uuid        not null references auth.users (id) on delete cascade,
  card_id      uuid        not null references public.deck_cards (id) on delete cascade,
  deck_id      uuid        not null references public.decks (id) on delete cascade,
  client_id    uuid        not null,
  rating       smallint    not null check (rating between 1 and 4),
  state_before smallint    not null check (state_before between 0 and 3),
  reviewed_at  timestamptz not null,
  duration_ms  int         check (duration_ms between 0 and 3600000),
  prev         jsonb,
  created_at   timestamptz not null default now(),
  unique (user_id, client_id)
);

create index if not exists review_events_user_deck on public.review_events (user_id, deck_id, reviewed_at);
create index if not exists review_events_card on public.review_events (user_id, card_id, reviewed_at);
create index if not exists review_events_deck on public.review_events (deck_id, reviewed_at);

alter table public.review_events enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5b. Revisions of Alpha-wide notes
--
-- Every edit to a note in a global deck files the previous text here. Nothing
-- reads it in the app yet; it exists so a bad bulk fix can be undone by hand,
-- and so "who changed card 183" has an answer. Written only by trigger.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.deck_note_revisions (
  id         bigint      generated always as identity primary key,
  note_id    uuid        not null references public.deck_notes (id) on delete cascade,
  deck_id    uuid        not null references public.decks (id) on delete cascade,
  version    int         not null,
  kind       text        not null,
  front      text        not null,
  back       text        not null,
  tags       text[]      not null,
  edited_by  uuid        references auth.users (id) on delete set null,
  edited_at  timestamptz not null default now()
);

create index if not exists deck_note_revisions_note on public.deck_note_revisions (note_id, version);

alter table public.deck_note_revisions enable row level security;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. Predicates and triggers
--
-- `security definer` so policies can call them without recursing into the
-- policies of the tables they read; `set search_path` so a caller cannot shadow
-- a table. They answer only about `auth.uid()`.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.can_read_deck(p_deck uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.decks d
    where d.id = p_deck
      and (
        (d.scope = 'personal' and d.owner_id = auth.uid())
        or (d.scope = 'global' and (
          d.status = 'published'
          or public.is_admin()
          or (d.status = 'archived' and exists (
            select 1 from public.user_decks u where u.user_id = auth.uid() and u.deck_id = d.id
          ))
        ))
      )
  );
$$;

create or replace function public.can_edit_deck(p_deck uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.decks d
    where d.id = p_deck
      and (
        (d.scope = 'personal' and d.owner_id = auth.uid())
        or (d.scope = 'global' and public.is_admin())
      )
  );
$$;

revoke all on function public.can_read_deck(uuid) from public, anon;
revoke all on function public.can_edit_deck(uuid) from public, anon;
grant execute on function public.can_read_deck(uuid) to authenticated;
grant execute on function public.can_edit_deck(uuid) to authenticated;

-- Scope and owner never change. A personal deck cannot be "published" by
-- flipping a field, and a global deck cannot be taken private by one admin.
-- The one exception is owner → null, which is the foreign key's own
-- `on delete set null` when an account is deleted.
create or replace function public.decks_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.scope is distinct from old.scope then
    raise exception 'a deck''s scope cannot change' using errcode = '42501';
  end if;
  if new.owner_id is distinct from old.owner_id and new.owner_id is not null then
    raise exception 'a deck''s owner cannot change' using errcode = '42501';
  end if;
  new.updated_at := now();
  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists decks_before_update on public.decks;
create trigger decks_before_update
  before update on public.decks
  for each row execute function public.decks_before_update();

create or replace function public.decks_before_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'published' and new.scope = 'global' then
    new.published_at := now();
  end if;
  -- An Alpha deck lands on "More from Alpha" unless it was put in Essentials;
  -- a personal deck has no shelf.
  new.collection := case when new.scope = 'global' then coalesce(new.collection, 'more') end;
  return new;
end;
$$;

drop trigger if exists decks_before_insert on public.decks;
create trigger decks_before_insert
  before insert on public.decks
  for each row execute function public.decks_before_insert();

-- The creator's own shelf gets the deck. A definer function because the
-- library row is written on the creator's behalf in the same statement.
create or replace function public.decks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is not null then
    insert into public.user_decks (user_id, deck_id) values (new.owner_id, new.id)
    on conflict do nothing;
  end if;
  return null;
end;
$$;

drop trigger if exists decks_after_insert on public.decks;
create trigger decks_after_insert
  after insert on public.decks
  for each row execute function public.decks_after_insert();

-- An account deletion nulls `owner_id`. A global deck stays for everyone; a
-- personal one has nobody left who can open it, so it goes.
create or replace function public.decks_after_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.scope = 'personal' and new.owner_id is null then
    delete from public.decks where id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists decks_after_update on public.decks;
create trigger decks_after_update
  after update of owner_id on public.decks
  for each row execute function public.decks_after_update();

-- A note never moves between decks (that would move a global card into a
-- personal deck, or the reverse). Content edits bump `version`, and in a
-- global deck file the old text as a revision.
create or replace function public.deck_notes_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deck_id is distinct from old.deck_id then
    raise exception 'a card cannot move to another deck' using errcode = '42501';
  end if;
  if (new.kind, new.front, new.back, new.tags) is distinct from (old.kind, old.front, old.back, old.tags) then
    new.version := old.version + 1;
    new.updated_at := now();
    if exists (select 1 from public.decks d where d.id = old.deck_id and d.scope = 'global') then
      insert into public.deck_note_revisions (note_id, deck_id, version, kind, front, back, tags, edited_by)
      values (old.id, old.deck_id, old.version, old.kind, old.front, old.back, old.tags, auth.uid());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists deck_notes_before_update on public.deck_notes;
create trigger deck_notes_before_update
  before update on public.deck_notes
  for each row execute function public.deck_notes_before_update();

-- The cards a note makes. The client's parser (decks/cloze.ts) decides the
-- same set; this is the authority, because it is the one place every write
-- passes through. Cloze numbers 1–99, as Anki allows.
create or replace function public.deck_note_ordinals(p_kind text, p_front text)
returns smallint[]
language sql
immutable
as $$
  select case
    when p_kind = 'basic' then array[0]::smallint[]
    else coalesce(
      (select array_agg(distinct m[1]::smallint order by m[1]::smallint)
         from regexp_matches(p_front, '\{\{c([1-9][0-9]?)::', 'g') as m),
      '{}'::smallint[])
  end;
$$;

create or replace function public.deck_notes_sync_cards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ords smallint[];
begin
  if tg_op = 'UPDATE' and new.kind = old.kind and new.front = old.front then
    return null;
  end if;
  v_ords := public.deck_note_ordinals(new.kind, new.front);
  if cardinality(v_ords) = 0 then
    raise exception 'a cloze card needs at least one {{c1::…}}' using errcode = '23514';
  end if;
  delete from public.deck_cards where note_id = new.id and ord <> all (v_ords);
  insert into public.deck_cards (note_id, deck_id, ord)
  select new.id, new.deck_id, o from unnest(v_ords) as o
  on conflict (note_id, ord) do nothing;
  return null;
end;
$$;

drop trigger if exists deck_notes_sync_cards on public.deck_notes;
create trigger deck_notes_sync_cards
  after insert or update on public.deck_notes
  for each row execute function public.deck_notes_sync_cards();

-- Trigger functions are not for calling.
revoke all on function public.decks_before_update() from public, anon, authenticated;
revoke all on function public.decks_before_insert() from public, anon, authenticated;
revoke all on function public.decks_after_insert() from public, anon, authenticated;
revoke all on function public.decks_after_update() from public, anon, authenticated;
revoke all on function public.deck_notes_before_update() from public, anon, authenticated;
revoke all on function public.deck_notes_sync_cards() from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Policies
--
-- Content: read if you can read the deck, write if you can edit it.
-- Progress and history: read your own; no write policy at all — the RPCs in §8
-- are the only way in, so a crafted card id from a deck you cannot see is
-- refused rather than stored.
-- ═══════════════════════════════════════════════════════════════════════════

-- Spelled out rather than `can_read_deck(id)`: the function looks the deck up
-- by id, and a row inserted by the current statement is not in its snapshot,
-- so `insert … returning` (which is what `.insert().select()` sends) would be
-- refused on the deck it has just created. Keep the two in step.
drop policy if exists "decks read" on public.decks;
create policy "decks read" on public.decks for select to authenticated
  using (
    (scope = 'personal' and owner_id = auth.uid())
    or (scope = 'global' and (
      status = 'published'
      or public.is_admin()
      or (status = 'archived' and exists (
        select 1 from public.user_decks u where u.user_id = auth.uid() and u.deck_id = decks.id
      ))
    ))
  );

-- A global deck can only be made by an administrator, and starts as a draft:
-- nobody publishes an empty deck to every student by accident.
drop policy if exists "decks create" on public.decks;
create policy "decks create" on public.decks for insert to authenticated
  with check (
    owner_id = auth.uid()
    and (scope = 'personal' or (scope = 'global' and status = 'draft' and public.is_admin()))
  );

drop policy if exists "decks edit" on public.decks;
create policy "decks edit" on public.decks for update to authenticated
  using (public.can_edit_deck(id))
  with check (public.can_edit_deck(id));

drop policy if exists "decks delete" on public.decks;
create policy "decks delete" on public.decks for delete to authenticated
  using (public.can_edit_deck(id));

drop policy if exists "notes read" on public.deck_notes;
create policy "notes read" on public.deck_notes for select to authenticated
  using (public.can_read_deck(deck_id));

drop policy if exists "notes create" on public.deck_notes;
create policy "notes create" on public.deck_notes for insert to authenticated
  with check (public.can_edit_deck(deck_id));

drop policy if exists "notes edit" on public.deck_notes;
create policy "notes edit" on public.deck_notes for update to authenticated
  using (public.can_edit_deck(deck_id))
  with check (public.can_edit_deck(deck_id));

drop policy if exists "notes delete" on public.deck_notes;
create policy "notes delete" on public.deck_notes for delete to authenticated
  using (public.can_edit_deck(deck_id));

drop policy if exists "cards read" on public.deck_cards;
create policy "cards read" on public.deck_cards for select to authenticated
  using (public.can_read_deck(deck_id));

drop policy if exists "library read" on public.user_decks;
create policy "library read" on public.user_decks for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "library add" on public.user_decks;
create policy "library add" on public.user_decks for insert to authenticated
  with check (user_id = auth.uid() and public.can_read_deck(deck_id));

drop policy if exists "library settings" on public.user_decks;
create policy "library settings" on public.user_decks for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "library remove" on public.user_decks;
create policy "library remove" on public.user_decks for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "progress read own" on public.user_card_progress;
create policy "progress read own" on public.user_card_progress for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "events read own" on public.review_events;
create policy "events read own" on public.review_events for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "revisions read" on public.deck_note_revisions;
create policy "revisions read" on public.deck_note_revisions for select to authenticated
  using (public.is_admin());


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Functions the app calls
-- ═══════════════════════════════════════════════════════════════════════════

-- Import a chunk of notes. Duplicates (same text, or same Anki guid) are
-- skipped, never overwritten; a row the database refuses is counted, not
-- fatal, so one bad line cannot sink a 2,000-card import. Invoker: the note
-- policies apply to every row exactly as they would to a hand-made card.
create or replace function public.import_deck_notes(p_deck uuid, p_notes jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_base     bigint;
  v_x        jsonb;
  v_i        bigint := 0;
  v_rows     int;
  v_inserted int := 0;
  v_dupes    int := 0;
  v_failed   int := 0;
begin
  if not public.can_edit_deck(p_deck) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_notes) <> 'array' or jsonb_array_length(p_notes) > 1000 then
    raise exception 'send at most 1000 notes at a time' using errcode = '22023';
  end if;

  select coalesce(max(position), 0) into v_base from public.deck_notes where deck_id = p_deck;

  for v_x in select value from jsonb_array_elements(p_notes) loop
    v_i := v_i + 1;
    begin
      insert into public.deck_notes (deck_id, kind, front, back, tags, guid, content_hash, position)
      values (
        p_deck,
        v_x ->> 'kind',
        v_x ->> 'front',
        coalesce(v_x ->> 'back', ''),
        coalesce(array(select jsonb_array_elements_text(coalesce(v_x -> 'tags', '[]'::jsonb))), '{}'),
        nullif(v_x ->> 'guid', ''),
        v_x ->> 'content_hash',
        v_base + v_i
      )
      on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows = 1 then v_inserted := v_inserted + 1; else v_dupes := v_dupes + 1; end if;
    exception when others then
      v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object('inserted', v_inserted, 'duplicates', v_dupes, 'failed', v_failed);
end;
$$;

-- Which of these hashes / guids are already in the deck — the import preview's
-- "16 duplicates", without downloading the deck. A POST body, because a
-- thousand hashes do not fit in a URL.
create or replace function public.existing_note_keys(p_deck uuid, p_hashes text[], p_guids text[])
returns table (content_hash text, guid text)
language sql
stable
security invoker
set search_path = public
as $$
  select n.content_hash, n.guid
  from public.deck_notes n
  where n.deck_id = p_deck
    and (n.content_hash = any (coalesce(p_hashes, '{}')) or n.guid = any (coalesce(p_guids, '{}')));
$$;

-- Record a batch of reviews from the outbox.
--
-- Idempotent on (user, client_id): a flush retried after a lost response lands
-- once. Progress only moves forward in time: a device that was offline since
-- yesterday cannot overwrite this morning's review of the same card. Each
-- entry is its own subtransaction, so a malformed one is dropped instead of
-- wedging the outbox forever. Returns how many were applied.
create or replace function public.record_reviews(p_reviews jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  r       jsonb;
  v_card  uuid;
  v_deck  uuid;
  v_at    timestamptz;
  v_next  jsonb;
  v_rows  int;
  v_n     int := 0;
begin
  if v_uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if jsonb_typeof(p_reviews) <> 'array' or jsonb_array_length(p_reviews) > 200 then
    raise exception 'send at most 200 reviews at a time' using errcode = '22023';
  end if;

  for r in select value from jsonb_array_elements(p_reviews) loop
    begin
      v_card := (r ->> 'card_id')::uuid;
      v_deck := null;
      select c.deck_id into v_deck from public.deck_cards c where c.id = v_card;
      -- A card deleted since, or one this caller may not see: drop it quietly.
      if v_deck is null or not public.can_read_deck(v_deck) then
        continue;
      end if;

      v_at := least((r ->> 'reviewed_at')::timestamptz, now() + interval '5 minutes');
      v_next := r -> 'next';

      insert into public.review_events (user_id, card_id, deck_id, client_id, rating, state_before, reviewed_at, duration_ms, prev)
      values (
        v_uid, v_card, v_deck,
        (r ->> 'client_id')::uuid,
        (r ->> 'rating')::smallint,
        coalesce((r -> 'prev' ->> 'state')::smallint, 0),
        v_at,
        least(greatest(coalesce((r ->> 'duration_ms')::int, 0), 0), 3600000),
        case when jsonb_typeof(r -> 'prev') = 'object' then r -> 'prev' end
      )
      on conflict (user_id, client_id) do nothing;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then
        continue;
      end if;

      insert into public.user_card_progress as p (
        user_id, card_id, deck_id, state, due, stability, difficulty,
        scheduled_days, learning_steps, reps, lapses, last_review, updated_at
      )
      values (
        v_uid, v_card, v_deck,
        (v_next ->> 'state')::smallint,
        (v_next ->> 'due')::timestamptz,
        (v_next ->> 'stability')::real,
        (v_next ->> 'difficulty')::real,
        (v_next ->> 'scheduled_days')::int,
        (v_next ->> 'learning_steps')::smallint,
        (v_next ->> 'reps')::int,
        (v_next ->> 'lapses')::int,
        v_at,
        now()
      )
      on conflict (user_id, card_id) do update set
        state = excluded.state,
        due = excluded.due,
        stability = excluded.stability,
        difficulty = excluded.difficulty,
        scheduled_days = excluded.scheduled_days,
        learning_steps = excluded.learning_steps,
        reps = excluded.reps,
        lapses = excluded.lapses,
        last_review = excluded.last_review,
        updated_at = now()
      where p.last_review is null or p.last_review < excluded.last_review;

      v_n := v_n + 1;
    exception when others then
      -- Malformed entry. Dropped so the rest of the batch, and every batch
      -- after it, can still land.
      null;
    end;
  end loop;

  return v_n;
end;
$$;

-- Undo the last review of a card. Only the newest review of that card can be
-- undone — undoing an older one would rewind past reviews made since.
create or replace function public.undo_review(p_client_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  e     public.review_events%rowtype;
begin
  select * into e from public.review_events where user_id = v_uid and client_id = p_client_id;
  if not found then
    return false;
  end if;
  if exists (
    select 1 from public.review_events
    where user_id = v_uid and card_id = e.card_id and reviewed_at > e.reviewed_at
  ) then
    return false;
  end if;

  if e.prev is null then
    delete from public.user_card_progress where user_id = v_uid and card_id = e.card_id;
  else
    update public.user_card_progress set
      state = (e.prev ->> 'state')::smallint,
      due = (e.prev ->> 'due')::timestamptz,
      stability = (e.prev ->> 'stability')::real,
      difficulty = (e.prev ->> 'difficulty')::real,
      scheduled_days = (e.prev ->> 'scheduled_days')::int,
      learning_steps = (e.prev ->> 'learning_steps')::smallint,
      reps = (e.prev ->> 'reps')::int,
      lapses = (e.prev ->> 'lapses')::int,
      last_review = (e.prev ->> 'last_review')::timestamptz,
      updated_at = now()
    where user_id = v_uid and card_id = e.card_id;
  end if;

  delete from public.review_events where id = e.id;
  return true;
end;
$$;

-- Every deck on the caller's shelf, with the numbers the library draws.
-- `p_day_start`/`p_day_end` are the current study day (04:00 IST to 04:00
-- IST), computed by the client so "due today" means what it means everywhere
-- else in Alpha.
--
--   new_available  min(unseen, new_per_day − new cards already started today)
--   due            review cards due today (capped at max_reviews − reviews
--                  done today) plus learning cards due today
--   mature         review cards with an interval of three weeks or more
-- Dropped first: its RETURNS TABLE gained `collection`, and Postgres will not
-- replace a function whose return type changed.
drop function if exists public.deck_summaries(timestamptz, timestamptz);
create function public.deck_summaries(p_day_start timestamptz, p_day_end timestamptz)
returns table (
  deck_id uuid, scope text, status text, collection text, title text, description text,
  subject text, class_id smallint, chapter text, owner_id uuid, updated_at timestamptz,
  new_per_day int, max_reviews int, desired_retention real, added_at timestamptz,
  total int, unseen int, new_available int, due int, learning int,
  young int, mature int, suspended int, reviews_today int, next_due timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with lib as (
    select u.deck_id, u.new_per_day, u.max_reviews, u.desired_retention, u.added_at
    from public.user_decks u
    where u.user_id = auth.uid() and public.can_read_deck(u.deck_id)
  ),
  cards as (
    select c.deck_id, count(*)::int as total
    from public.deck_cards c join lib using (deck_id)
    group by c.deck_id
  ),
  prog as (
    select p.deck_id,
      count(*) filter (where p.state > 0 or p.suspended)::int                                   as started,
      count(*) filter (where p.suspended)::int                                                  as suspended,
      count(*) filter (where not p.suspended and p.state in (1, 3))::int                        as learning,
      count(*) filter (where not p.suspended and p.state = 2 and p.due < p_day_end)::int        as due_review,
      count(*) filter (where not p.suspended and p.state in (1, 3) and p.due < p_day_end)::int  as due_learning,
      count(*) filter (where p.state = 2 and p.scheduled_days < 21)::int                        as young,
      count(*) filter (where p.state = 2 and p.scheduled_days >= 21)::int                       as mature,
      min(p.due) filter (where not p.suspended and p.state > 0)                                 as next_due
    from public.user_card_progress p join lib using (deck_id)
    where p.user_id = auth.uid()
    group by p.deck_id
  ),
  today as (
    select e.deck_id,
      count(*) filter (where e.state_before = 0)::int as new_today,
      count(*) filter (where e.state_before = 2)::int as reviews_today
    from public.review_events e join lib using (deck_id)
    where e.user_id = auth.uid() and e.reviewed_at >= p_day_start
    group by e.deck_id
  )
  select
    d.id, d.scope, d.status, d.collection, d.title, d.description,
    d.subject, d.class_id, d.chapter, d.owner_id, d.updated_at,
    lib.new_per_day, lib.max_reviews, lib.desired_retention, lib.added_at,
    coalesce(cards.total, 0),
    greatest(coalesce(cards.total, 0) - coalesce(prog.started, 0), 0),
    greatest(least(
      coalesce(cards.total, 0) - coalesce(prog.started, 0),
      lib.new_per_day - coalesce(today.new_today, 0)
    ), 0),
    least(coalesce(prog.due_review, 0), greatest(lib.max_reviews - coalesce(today.reviews_today, 0), 0))
      + coalesce(prog.due_learning, 0),
    coalesce(prog.learning, 0),
    coalesce(prog.young, 0),
    coalesce(prog.mature, 0),
    coalesce(prog.suspended, 0),
    coalesce(today.new_today, 0) + coalesce(today.reviews_today, 0),
    prog.next_due
  from lib
  join public.decks d on d.id = lib.deck_id
  left join cards on cards.deck_id = lib.deck_id
  left join prog on prog.deck_id = lib.deck_id
  left join today on today.deck_id = lib.deck_id
  order by d.title;
$$;

-- Reviews per study day for one deck — the dashboard's activity chart.
create or replace function public.deck_activity(p_deck uuid, p_since timestamptz)
returns table (day text, reviews int, again int)
language sql
stable
security definer
set search_path = public
as $$
  select to_char((e.reviewed_at at time zone 'Asia/Kolkata') - interval '4 hours', 'YYYY-MM-DD') as day,
         count(*)::int,
         count(*) filter (where e.rating = 1)::int
  from public.review_events e
  where e.user_id = auth.uid() and e.deck_id = p_deck and e.reviewed_at >= p_since
  group by 1
  order by 1;
$$;

-- The next cards to study in a deck, content included.
--
-- Due cards first, oldest due first; then new cards in the deck's order, up to
-- what is left of today's new-card allowance. Siblings are buried, as in Anki:
-- at most one new card per note per day, and none from a note already seen
-- today, so c2 never shows up straight after c1 has given its answer away.
-- `p_exclude` is the cards the session already holds (it prefetches in pages).
create or replace function public.review_queue(
  p_deck uuid,
  p_day_start timestamptz,
  p_day_end timestamptz,
  p_limit int default 100,
  p_tags text[] default null,
  p_exclude uuid[] default '{}'
)
returns table (
  card_id uuid, note_id uuid, ord smallint, kind text, front text, back text, tags text[],
  state smallint, due timestamptz, stability real, difficulty real, scheduled_days int,
  learning_steps smallint, reps int, lapses int, last_review timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid       uuid := auth.uid();
  v_lim       int := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_new_per   int;
  v_max_rev   int;
  v_new_today int;
  v_rev_today int;
  v_new_allow int;
  v_rev_allow int;
begin
  if not public.can_read_deck(p_deck) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select u.new_per_day, u.max_reviews into v_new_per, v_max_rev
  from public.user_decks u where u.user_id = v_uid and u.deck_id = p_deck;
  v_new_per := coalesce(v_new_per, 20);
  v_max_rev := coalesce(v_max_rev, 200);

  select count(*) filter (where e.state_before = 0), count(*) filter (where e.state_before = 2)
    into v_new_today, v_rev_today
  from public.review_events e
  where e.user_id = v_uid and e.deck_id = p_deck and e.reviewed_at >= p_day_start;

  v_rev_allow := greatest(v_max_rev - v_rev_today, 0);

  return query
  with due_cards as (
    select p.card_id, p.state, p.due
    from public.user_card_progress p
    where p.user_id = v_uid and p.deck_id = p_deck
      and not p.suspended and p.state > 0 and p.due < p_day_end
      and not (p.card_id = any (coalesce(p_exclude, '{}')))
      and (p_tags is null or exists (
        select 1 from public.deck_cards c2 join public.deck_notes n2 on n2.id = c2.note_id
        where c2.id = p.card_id and n2.tags && p_tags
      ))
  ),
  -- Learning cards are never capped (they are mid-lesson); review cards stop
  -- at what is left of today's max_reviews, most overdue first.
  capped as (
    select d.card_id from (
      select dc.card_id, dc.state, row_number() over (partition by (dc.state = 2) order by dc.due) as rn
      from due_cards dc
    ) d
    where d.state <> 2 or d.rn <= v_rev_allow
  )
  select c.id, n.id, c.ord, n.kind, n.front, n.back, n.tags,
         p.state, p.due, p.stability, p.difficulty, p.scheduled_days,
         p.learning_steps, p.reps, p.lapses, p.last_review
  from capped
  join public.deck_cards c on c.id = capped.card_id
  join public.deck_notes n on n.id = c.note_id
  join public.user_card_progress p on p.user_id = v_uid and p.card_id = c.id
  order by p.due
  limit v_lim;

  v_new_allow := greatest(least(v_new_per - v_new_today, v_lim), 0);
  if v_new_allow = 0 then
    return;
  end if;

  return query
  with seen_today as (
    select distinct c.note_id
    from public.review_events e join public.deck_cards c on c.id = e.card_id
    where e.user_id = v_uid and e.deck_id = p_deck and e.reviewed_at >= p_day_start
  ),
  fresh as (
    select distinct on (n.id) c.id as card_id, n.id as note_id, c.ord, n.kind, n.front, n.back, n.tags, n.position
    from public.deck_cards c
    join public.deck_notes n on n.id = c.note_id
    where c.deck_id = p_deck
      and not (c.id = any (coalesce(p_exclude, '{}')))
      and (p_tags is null or n.tags && p_tags)
      and not exists (
        select 1 from public.user_card_progress p
        where p.user_id = v_uid and p.card_id = c.id and (p.state > 0 or p.suspended)
      )
      and not exists (select 1 from seen_today s where s.note_id = n.id)
    order by n.id, c.ord
  )
  select f.card_id, f.note_id, f.ord, f.kind, f.front, f.back, f.tags,
         0::smallint, null::timestamptz, null::real, null::real, null::int,
         null::smallint, null::int, null::int, null::timestamptz
  from fresh f
  order by f.position, f.ord
  limit v_new_allow;
end;
$$;

-- The Alpha deck library: published, Essentials first, then newest first,
-- searchable by title. Dropped first because its return type gained
-- `collection`.
drop function if exists public.explore_decks(text);
create function public.explore_decks(p_search text default null)
returns table (
  deck_id uuid, title text, description text, subject text, class_id smallint,
  chapter text, collection text, published_at timestamptz, cards int, in_library boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select d.id, d.title, d.description, d.subject, d.class_id, d.chapter, d.collection, d.published_at,
         (select count(*)::int from public.deck_cards c where c.deck_id = d.id),
         exists (select 1 from public.user_decks u where u.user_id = auth.uid() and u.deck_id = d.id)
  from public.decks d
  where d.scope = 'global' and d.status = 'published'
    and (
      coalesce(btrim(p_search), '') = ''
      or d.title ilike '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by (d.collection = 'essentials') desc, d.published_at desc nulls last
  limit 60;
$$;

-- Suspend or unsuspend one card for yourself. A card never seen gets a
-- progress row in state 0 so the suspension has somewhere to live.
create or replace function public.set_card_suspended(p_card uuid, p_suspended boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deck uuid;
begin
  select c.deck_id into v_deck from public.deck_cards c where c.id = p_card;
  if v_deck is null or not public.can_read_deck(v_deck) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  insert into public.user_card_progress (user_id, card_id, deck_id, state, due, suspended)
  values (auth.uid(), p_card, v_deck, 0, now(), p_suspended)
  on conflict (user_id, card_id) do update set suspended = excluded.suspended, updated_at = now();
end;
$$;

-- Forget everything about a deck, for yourself only.
create or replace function public.reset_deck_progress(p_deck uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from public.user_card_progress where user_id = auth.uid() and deck_id = p_deck;
  delete from public.review_events where user_id = auth.uid() and deck_id = p_deck;
end;
$$;

-- Staff: every Alpha-wide deck with how it is being used. Aggregates only —
-- never who is studying it or how any one of them is doing.
-- Dropped first: its return type gained `collection`.
drop function if exists public.admin_deck_stats();
create function public.admin_deck_stats()
returns table (
  deck_id uuid, title text, status text, collection text, subject text, chapter text,
  updated_at timestamptz, published_at timestamptz,
  cards int, students int, active_7d int, reviews_7d int, again_rate real
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
  select d.id, d.title, d.status, d.collection, d.subject, d.chapter, d.updated_at, d.published_at,
    (select count(*)::int from public.deck_cards c where c.deck_id = d.id),
    (select count(*)::int from public.user_decks u where u.deck_id = d.id),
    (select count(distinct e.user_id)::int from public.review_events e
       where e.deck_id = d.id and e.reviewed_at > now() - interval '7 days'),
    (select count(*)::int from public.review_events e
       where e.deck_id = d.id and e.reviewed_at > now() - interval '7 days'),
    (select (avg((e.rating = 1)::int))::real from public.review_events e
       where e.deck_id = d.id and e.state_before = 2 and e.reviewed_at > now() - interval '30 days')
  from public.decks d
  where d.scope = 'global'
  order by case d.status when 'draft' then 0 when 'published' then 1 else 2 end,
           (d.collection = 'essentials') desc, d.updated_at desc;
end;
$$;

-- Supabase grants EXECUTE to `anon` by name, so revoking from `public` alone is
-- not enough.
revoke all on function public.import_deck_notes(uuid, jsonb) from public, anon;
revoke all on function public.existing_note_keys(uuid, text[], text[]) from public, anon;
revoke all on function public.record_reviews(jsonb) from public, anon;
revoke all on function public.undo_review(uuid) from public, anon;
revoke all on function public.deck_summaries(timestamptz, timestamptz) from public, anon;
revoke all on function public.deck_activity(uuid, timestamptz) from public, anon;
revoke all on function public.review_queue(uuid, timestamptz, timestamptz, int, text[], uuid[]) from public, anon;
revoke all on function public.explore_decks(text) from public, anon;
revoke all on function public.set_card_suspended(uuid, boolean) from public, anon;
revoke all on function public.reset_deck_progress(uuid) from public, anon;
revoke all on function public.admin_deck_stats() from public, anon;
revoke all on function public.deck_note_ordinals(text, text) from public, anon;

grant execute on function public.import_deck_notes(uuid, jsonb) to authenticated;
grant execute on function public.existing_note_keys(uuid, text[], text[]) to authenticated;
grant execute on function public.record_reviews(jsonb) to authenticated;
grant execute on function public.undo_review(uuid) to authenticated;
grant execute on function public.deck_summaries(timestamptz, timestamptz) to authenticated;
grant execute on function public.deck_activity(uuid, timestamptz) to authenticated;
grant execute on function public.review_queue(uuid, timestamptz, timestamptz, int, text[], uuid[]) to authenticated;
grant execute on function public.explore_decks(text) to authenticated;
grant execute on function public.set_card_suspended(uuid, boolean) to authenticated;
grant execute on function public.reset_deck_progress(uuid) to authenticated;
grant execute on function public.admin_deck_stats() to authenticated;
grant execute on function public.deck_note_ordinals(text, text) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. Card images — a private bucket, one folder per deck
--
-- Paths are `<deck id>/<sha-256>.<ext>`, and the card HTML holds only the bare
-- file name (`<img src="ab12….webp">`) — exactly how Anki references media, so
-- an imported `<img src="benzene.png">` resolves the moment a file of that
-- name is added to the deck, and an export goes back to Anki unchanged.
--
-- Who can see an image is who can see the deck; who can add one is who can
-- edit it. Served through short-lived signed URLs, never public ones.
-- ═══════════════════════════════════════════════════════════════════════════

-- The deck a storage path belongs to, or null for anything not shaped like
-- `<uuid>/…` — a cast that throws inside a policy would refuse with an error
-- instead of an empty answer.
create or replace function public.deck_media_deck(p_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then split_part(p_name, '/', 1)::uuid
  end;
$$;

revoke all on function public.deck_media_deck(text) from public, anon;
grant execute on function public.deck_media_deck(text) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('decks', 'decks', false, 1048576, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "deck media read" on storage.objects;
create policy "deck media read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'decks' and public.can_read_deck(public.deck_media_deck(name)));

drop policy if exists "deck media add" on storage.objects;
create policy "deck media add"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'decks' and public.can_edit_deck(public.deck_media_deck(name)));

drop policy if exists "deck media replace" on storage.objects;
create policy "deck media replace"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'decks' and public.can_edit_deck(public.deck_media_deck(name)))
  with check (bucket_id = 'decks' and public.can_edit_deck(public.deck_media_deck(name)));

drop policy if exists "deck media remove" on storage.objects;
create policy "deck media remove"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'decks' and public.can_edit_deck(public.deck_media_deck(name)));
