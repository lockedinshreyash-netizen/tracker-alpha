-- ── Administrators, app-wide announcements, and the feedback inbox ──
-- Run this once in the Supabase dashboard: SQL Editor → New query → Run.
-- Every statement is idempotent; re-run it any time.
--
-- THREE FEATURES, ONE FILE, BECAUSE THEY SHARE ONE PREDICATE.
--
-- `public.is_admin()` is the only thing standing between a normal signed-in
-- student and the ability to broadcast to every user of the app or read every
-- report filed against them. It is defined once here and referenced by every
-- policy below, so there is exactly one definition of "administrator" in the
-- system and no second place for it to drift.
--
-- Nothing in the client is a security boundary. The admin tab, the publish
-- button and the inbox are conveniences; a user who opens the console in
-- devtools and calls `supabase.from('announcements').insert(...)` by hand gets
-- a row-level-security failure, because the policy is evaluated in the
-- database against the id inside their verified JWT and not against anything
-- the request says about itself.
--
-- Naming: `announcements`, not `notifications`. The app already has a
-- `notify/` domain, and it means OS-level notifications — a bell for a Pomodoro
-- block, a deadline on a lock screen. This is a different thing entirely: one
-- row, written once by a human, read by everybody. Calling both "notification"
-- would guarantee somebody wires the wrong one up.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Roles
--
-- Deliberately a separate table from `user_profiles`. That table is a single
-- jsonb blob of the user's whole AppState, written by the client on every
-- keystroke-sized change — a role stored inside it would be a privilege the
-- client could grant itself by editing localStorage.
--
-- A role therefore lives in a table the client cannot write AT ALL. There is no
-- insert, update or delete policy for `authenticated` below, which under RLS
-- means those operations are denied to every client, including the row's own
-- owner and including an administrator. Roles are granted by the two functions
-- in §2 (admin-guarded, server-side) or from the SQL editor.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.user_roles (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  role       text        not null default 'user',
  granted_at timestamptz not null default now(),
  -- Who did it. Null for the bootstrap admin, who is created from the SQL
  -- editor before any administrator exists to attribute it to.
  granted_by uuid        references auth.users (id) on delete set null,

  constraint user_roles_role_valid check (role in ('user', 'admin'))
);

-- The only lookup that happens on a hot path: "is this uuid an admin".
create index if not exists user_roles_admins
  on public.user_roles (user_id)
  where role = 'admin';


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. The predicate, and the two ways to change it
--
-- `security definer` is load-bearing twice over:
--
--   1. Recursion. `is_admin()` reads `user_roles`, and it is also referenced by
--      a policy ON `user_roles`. Evaluating that policy would re-enter the
--      function, which would re-evaluate the policy, forever. A definer
--      function owned by `postgres` — which owns the table and is not subject
--      to its RLS — reads it directly and the cycle never forms.
--
--   2. Honesty. The function answers about `auth.uid()`, taken from the
--      verified JWT. It accepts no argument, so there is nothing for a caller
--      to pass a different user id in.
--
-- `set search_path` is what stops a caller creating their own `user_roles` in a
-- schema earlier on the path and having a definer function read it instead.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Every signed-in client may ask whether IT is an admin. That is all this
-- answers, and the app uses it to decide whether to render the console.
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;


-- Appointing another administrator. Guarded on `is_admin()` INSIDE the
-- function rather than by who may execute it: the guard has to run in the same
-- transaction as the write, and a grant/revoke on EXECUTE cannot express
-- "only if the caller is already an admin".
create or replace function public.grant_admin(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select id into target
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if target is null then
    -- Deliberately not "no such user": an admin-only oracle is still an
    -- oracle, and this message is also what the console shows.
    raise exception 'no account with that email has signed in yet'
      using errcode = 'P0002';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (target, 'admin', auth.uid())
  on conflict (user_id) do update
    set role = 'admin', granted_at = now(), granted_by = auth.uid();

  return target::text;
end;
$$;

revoke all on function public.grant_admin(text) from public;
grant execute on function public.grant_admin(text) to authenticated;


-- Standing an administrator down. The last one cannot be removed: an app with
-- no administrator has no way back in short of the SQL editor, and the person
-- who would need it is the person who just locked themselves out.
create or replace function public.revoke_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select count(*) into remaining
  from public.user_roles
  where role = 'admin' and user_id <> p_user_id;

  if remaining = 0 then
    raise exception 'cannot remove the last administrator' using errcode = 'P0001';
  end if;

  update public.user_roles
  set role = 'user', granted_at = now(), granted_by = auth.uid()
  where user_id = p_user_id;
end;
$$;

revoke all on function public.revoke_admin(uuid) from public;
grant execute on function public.revoke_admin(uuid) to authenticated;


-- Who the administrators are, with their emails, for the console's roster.
-- A definer function rather than a view, because a view would either leak
-- auth.users to everyone who can select it or need its own security barrier;
-- this way the authorization check is the first statement in the body.
create or replace function public.admin_list_admins()
returns table (user_id uuid, email text, granted_at timestamptz)
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
    select r.user_id, u.email::text, r.granted_at
    from public.user_roles r
    join auth.users u on u.id = r.user_id
    where r.role = 'admin'
    order by r.granted_at;
end;
$$;

revoke all on function public.admin_list_admins() from public;
grant execute on function public.admin_list_admins() to authenticated;


alter table public.user_roles enable row level security;

-- Read your own row, and — for the roster — an admin reads all of them.
-- There is NO insert, update or delete policy, by design: under RLS an
-- operation with no policy is denied to every client. §2's functions are the
-- only writers.
drop policy if exists "read own role" on public.user_roles;
create policy "read own role"
  on public.user_roles for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Announcements
--
-- ONE ROW, GLOBAL. There is deliberately no per-user copy and no fan-out on
-- publish: an admin writing to ten thousand students must not become ten
-- thousand inserts, and a `read` boolean on the row itself would mean the first
-- student to acknowledge it hides it from everyone.
--
-- Publication is `published_at`, not a boolean. A timestamp answers "is it
-- live" exactly as well and also answers "since when", which is the first
-- question anyone asks about an announcement that went out wrong. Null is a
-- draft; a future value is scheduled and simply does not match the policy yet.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.announcements (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  body         text        not null,
  type         text        not null default 'announcement',
  created_at   timestamptz not null default now(),
  -- The author. `set null` rather than cascade: deleting a staff account must
  -- not silently delete the notices they sent.
  created_by   uuid        references auth.users (id) on delete set null,
  published_at timestamptz,
  expires_at   timestamptz,

  constraint announcement_type_valid
    check (type in ('announcement', 'update', 'important', 'maintenance', 'poll', 'video')),
  -- Bounded because both strings are rendered verbatim into a modal every user
  -- of the app will see. Long enough for a real message, short enough that it
  -- cannot become a wall.
  constraint announcement_title_len check (char_length(trim(title)) between 3 and 90),
  -- A poll's question is its title and a video's subject is its title, so both
  -- are allowed an empty body. The four prose types still have to say something.
  constraint announcement_body_len  check (
    char_length(trim(body)) <= 1200
    and (type in ('poll', 'video') or char_length(trim(body)) >= 3)
  ),
  -- An expiry before publication would be a notice that is live and expired at
  -- the same instant; the visibility policy would simply never match it.
  constraint announcement_window
    check (expires_at is null or published_at is null or expires_at > published_at)
);

-- The only query a student's app makes: what is live, oldest first.
create index if not exists announcements_live
  on public.announcements (published_at)
  where published_at is not null;

alter table public.announcements enable row level security;

-- ── Who can see what ──
-- A student sees a notice only once it is published, only while it is live, and
-- never before its publication instant. Drafts and scheduled notices are
-- invisible to them at the DATABASE, not merely absent from a query the client
-- happens to write — an unpublished announcement is not leakable by a crafted
-- request.
drop policy if exists "live announcements are readable" on public.announcements;
create policy "live announcements are readable"
  on public.announcements for select
  to authenticated
  using (
    public.is_admin()
    or (
      published_at is not null
      and published_at <= now()
      and (expires_at is null or expires_at > now())
    )
  );

-- ── Who can write ──
-- Admins, and nobody else. `created_by` is pinned to the caller's own verified
-- id in the WITH CHECK, so an admin cannot post under a colleague's name and a
-- non-admin cannot post at all.
drop policy if exists "admins create announcements" on public.announcements;
create policy "admins create announcements"
  on public.announcements for insert
  to authenticated
  with check (public.is_admin() and created_by = auth.uid());

drop policy if exists "admins update announcements" on public.announcements;
create policy "admins update announcements"
  on public.announcements for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins delete announcements" on public.announcements;
create policy "admins delete announcements"
  on public.announcements for delete
  to authenticated
  using (public.is_admin());


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. Per-user acknowledgement
--
-- The composite primary key is the whole deduplication strategy. A student's
-- app acknowledges with an upsert, so a double tap, a retry after a flaky
-- network and a second device all collapse into the same single row. There is
-- nothing to count, nothing to clean up, and no way to accumulate duplicates.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.announcement_reads (
  announcement_id uuid        not null references public.announcements (id) on delete cascade,
  user_id         uuid        not null references auth.users (id) on delete cascade,
  read_at         timestamptz not null default now(),

  primary key (announcement_id, user_id)
);

-- The query every client makes on the way into Today: "which of these have I
-- already seen". The primary key indexes (announcement_id, user_id); this is
-- the other direction.
create index if not exists announcement_reads_by_user
  on public.announcement_reads (user_id);

alter table public.announcement_reads enable row level security;

-- You may read and write exactly your own acknowledgements. `auth.uid()` comes
-- from the verified JWT, so there is no request in which a user can mark a
-- notice read on somebody else's behalf — or unread, to make it reappear for
-- them.
drop policy if exists "own reads readable" on public.announcement_reads;
create policy "own reads readable"
  on public.announcement_reads for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "own reads writable" on public.announcement_reads;
create policy "own reads writable"
  on public.announcement_reads for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Deliberately no update policy: a read row has nothing to change. Delete is
-- allowed so the user's own acknowledgement is theirs to undo, and so an
-- account deletion cascades cleanly.
drop policy if exists "own reads deletable" on public.announcement_reads;
create policy "own reads deletable"
  on public.announcement_reads for delete
  to authenticated
  using (auth.uid() = user_id);


-- The console's list: every announcement, plus how many people have actually
-- acknowledged it. Counted in the database rather than by pulling the reads
-- table into the browser, for the obvious reason.
-- The console's listing function — every announcement plus its reach — lives at
-- the END of this file instead of here. It reads the poll tables added in §9,
-- and while plpgsql would resolve those names at call time rather than at
-- creation, a definition that only works because of that is a definition that
-- breaks the first time somebody reorders the file.


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Feedback and moderation reports
--
-- One table for all four categories, including abuse. They differ in what the
-- form asks and in how urgently a human reads them — not in their shape — and
-- a separate `abuse_reports` table would need its own policies, its own inbox
-- and its own chance to get one of them wrong.
--
-- `reported_name` is free text the reporter typed. It is deliberately NOT a
-- foreign key to a user: resolving it would mean the client had to look
-- somebody up, which is a user-directory endpoint, which is the one thing a
-- report form must not ship with.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.feedback_tickets (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users (id) on delete cascade,
  category      text        not null,
  subject       text        not null,
  message       text        not null,
  status        text        not null default 'open',
  -- Where they were standing when they hit send. The single most useful piece
  -- of metadata on a bug report, and the one a user should never have to type.
  route         text,
  user_agent    text,
  reported_name text,
  -- Written by an admin from the inbox. Shown back to the submitter under
  -- their own ticket; see §6.
  admin_response text,
  responded_at   timestamptz,
  responded_by   uuid        references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint feedback_category_valid
    check (category in ('bug', 'idea', 'abuse', 'general')),
  constraint feedback_status_valid
    check (status in ('open', 'in_progress', 'resolved')),
  -- Bounded at the database, not merely in the form. The form is advice; this
  -- is the rule.
  constraint feedback_subject_len  check (char_length(trim(subject)) between 3 and 120),
  constraint feedback_message_len  check (char_length(trim(message)) between 5 and 4000),
  constraint feedback_route_len    check (route is null or char_length(route) <= 120),
  constraint feedback_ua_len       check (user_agent is null or char_length(user_agent) <= 400),
  constraint feedback_reported_len check (reported_name is null or char_length(reported_name) <= 60),
  constraint feedback_response_len check (admin_response is null or char_length(admin_response) <= 2000)
);

-- The inbox's ordering, and the "my tickets" lookup.
create index if not exists feedback_tickets_triage
  on public.feedback_tickets (status, created_at desc);

create index if not exists feedback_tickets_by_user
  on public.feedback_tickets (user_id, created_at desc);

create or replace function public.touch_feedback_ticket()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists feedback_tickets_touch on public.feedback_tickets;
create trigger feedback_tickets_touch
  before update on public.feedback_tickets
  for each row execute function public.touch_feedback_ticket();

alter table public.feedback_tickets enable row level security;

-- ── Reading ──
-- Your own, or everything if you are an administrator. A student cannot read
-- another student's ticket, which is what makes "report abuse" safe to offer:
-- the person being reported cannot find the report.
drop policy if exists "read own or all as admin" on public.feedback_tickets;
create policy "read own or all as admin"
  on public.feedback_tickets for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- ── Filing ──
-- Under your own id only, and in the state a new ticket is allowed to be in.
-- Without the last two clauses a user could insert a ticket that arrived
-- pre-resolved (and so was never read) or that arrived carrying a forged reply
-- from support.
drop policy if exists "file own ticket" on public.feedback_tickets;
create policy "file own ticket"
  on public.feedback_tickets for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and status = 'open'
    and admin_response is null
    and responded_at is null
    and responded_by is null
  );

-- ── Triage ──
-- Admins only. A submitter deliberately cannot update their own ticket: there
-- is nothing on it they should be able to change after it has been read, and an
-- editable message is a message that can be swapped out from under a decision.
drop policy if exists "admins triage tickets" on public.feedback_tickets;
create policy "admins triage tickets"
  on public.feedback_tickets for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admins delete tickets" on public.feedback_tickets;
create policy "admins delete tickets"
  on public.feedback_tickets for delete
  to authenticated
  using (public.is_admin());


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. The inbox
--
-- The tickets themselves are readable by admins through the policy above, so
-- this function exists for exactly one thing the policy cannot provide: the
-- submitter's email address, which lives in `auth.users` and must not be
-- exposed to clients by a view.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.admin_list_feedback(
  p_status text default null,
  p_limit  int  default 100
)
returns table (
  id             uuid,
  user_id        uuid,
  email          text,
  category       text,
  subject        text,
  message        text,
  status         text,
  route          text,
  user_agent     text,
  reported_name  text,
  admin_response text,
  responded_at   timestamptz,
  created_at     timestamptz
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
    select t.id, t.user_id, u.email::text, t.category, t.subject, t.message,
           t.status, t.route, t.user_agent, t.reported_name,
           t.admin_response, t.responded_at, t.created_at
    from public.feedback_tickets t
    left join auth.users u on u.id = t.user_id
    where p_status is null or t.status = p_status
    order by
      -- Open first, then in progress, then resolved; newest within each.
      case t.status when 'open' then 0 when 'in_progress' then 1 else 2 end,
      t.created_at desc
    limit greatest(1, least(coalesce(p_limit, 100), 500));
end;
$$;

revoke all on function public.admin_list_feedback(text, int) from public;
grant execute on function public.admin_list_feedback(text, int) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Bootstrap — the first administrator
--
-- Run ONCE, by hand, with your own email. There is no other way in, which is
-- the point: if the app could appoint the first admin, so could anyone who
-- read the app.
--
-- The account must already exist (sign up in the app first).
-- ═══════════════════════════════════════════════════════════════════════════

--   insert into public.user_roles (user_id, role)
--   select id, 'admin' from auth.users where lower(email) = lower('you@example.com')
--   on conflict (user_id) do update set role = 'admin';

-- Every administrator after the first is appointed from inside the app: Admin
-- tab → Administrators → their email → Appoint.
--
-- NOT with `select public.grant_admin('them@example.com');` from this editor.
-- The editor runs as `postgres` with no JWT, so `auth.uid()` is null,
-- `is_admin()` is false, and the guard raises `not authorized`. That guard is
-- doing its job — the function is written to authorize a signed-in caller, and
-- there is no signed-in caller here. From the SQL editor, use the insert above
-- with their email instead; it works because `postgres` owns the table and is
-- not subject to its RLS.


-- ═══════════════════════════════════════════════════════════════════════════
-- 8. Optional — live delivery of a newly published announcement
--
-- The app does not need this: it checks on the way into Today, and again when
-- the tab is brought back to the foreground. That is the reliable path and it
-- is the one that must keep working. Uncomment only if you want a notice to
-- land on a screen that is already open and idle.
--
-- `announcements` is safe to publish over realtime in a way `user_profiles` is
-- not: every row in it is a message written to be read by everybody, and the
-- SELECT policy above is still applied to realtime payloads, so a draft is not
-- broadcast.
-- ═══════════════════════════════════════════════════════════════════════════

--   alter publication supabase_realtime add table public.announcements;


-- ═══════════════════════════════════════════════════════════════════════════
-- 9. Polls and video announcements
--
-- Added after §1–§8 shipped, so everything here is an ALTER rather than a
-- rewrite: the file stays re-runnable against a database that already has the
-- original four announcement types in it.
--
-- TWO NEW TYPES, TWO DIFFERENT SHAPES OF EXTRA DATA.
--
--   video — one string, so it is one column on `announcements`.
--   poll  — a list the user votes against, so it is two tables.
--
-- The poll is the interesting one, and the design turns on a single rule:
-- NOBODY EVER READS ANOTHER PERSON'S VOTE. Not another student, and not an
-- administrator. Results exist only as aggregates, returned by one function
-- that counts rows the caller cannot select. A poll that quietly tells staff
-- who picked what is a different product from the one this claims to be, and
-- the users it would be reporting on are minors.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.announcements
  -- 'private' → only administrators may read the tally.
  -- 'live'    → every signed-in user may, and the app refreshes it as votes land.
  add column if not exists poll_visibility text,
  -- The 11-character YouTube id, never a URL. The admin pastes whatever link
  -- they have and the client extracts this; storing the raw URL would mean the
  -- embed is built from user input, which is how an iframe src becomes a
  -- vulnerability.
  add column if not exists video_id text;

-- Postgres has no `add constraint if not exists`, so every one of these is a
-- drop-then-add. Re-running the file is therefore safe, and an existing
-- database picks up the widened type list here rather than from the CREATE
-- TABLE above, which does nothing once the table exists.
alter table public.announcements drop constraint if exists announcement_type_valid;
alter table public.announcements add constraint announcement_type_valid
  check (type in ('announcement', 'update', 'important', 'maintenance', 'poll', 'video'));

alter table public.announcements drop constraint if exists announcement_body_len;
alter table public.announcements add constraint announcement_body_len check (
  char_length(trim(body)) <= 1200
  and (type in ('poll', 'video') or char_length(trim(body)) >= 3)
);

alter table public.announcements drop constraint if exists announcement_poll_shape;
alter table public.announcements add constraint announcement_poll_shape check (
  -- Biconditional, deliberately: a poll must declare a visibility, and nothing
  -- that is not a poll may carry one. Without the second half, changing a
  -- poll's type would leave a stale setting behind that the UI would not show
  -- and the results function would still act on.
  (type = 'poll') = (poll_visibility is not null)
  and (poll_visibility is null or poll_visibility in ('private', 'live'))
);

alter table public.announcements drop constraint if exists announcement_video_shape;
alter table public.announcements add constraint announcement_video_shape check (
  (type = 'video') = (video_id is not null)
  -- Exactly YouTube's id alphabet and length. This value is interpolated into
  -- an iframe src, so it is validated as a shape rather than trusted as a
  -- string — the one field in this schema that reaches an embed.
  and (video_id is null or video_id ~ '^[A-Za-z0-9_-]{11}$')
);


-- ── The options ────────────────────────────────────────────────────────────

create table if not exists public.announcement_poll_options (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  -- `idx`, not `position`: POSITION is a SQL function name, and a RETURNS TABLE
  -- output parameter called `position` collides with it inside plpgsql.
  idx             int  not null,
  label           text not null,

  unique (announcement_id, idx),
  constraint poll_option_label_len check (char_length(trim(label)) between 1 and 80)
);

create index if not exists poll_options_by_announcement
  on public.announcement_poll_options (announcement_id, idx);

alter table public.announcement_poll_options enable row level security;

-- ── Why this policy is a bare EXISTS ──
-- It does not repeat the published/expired predicate from the announcements
-- policy, and it must not. A subquery inside a policy is executed with the
-- calling user's own permissions, so row-level security on `announcements`
-- applies to it: the row is found only if the caller could have selected the
-- announcement itself. Restating the predicate would be a second copy to keep
-- in sync, and the copy that drifts is the one that leaks a draft.
drop policy if exists "poll options follow their announcement" on public.announcement_poll_options;
create policy "poll options follow their announcement"
  on public.announcement_poll_options for select
  to authenticated
  using (
    exists (
      select 1 from public.announcements a
      where a.id = announcement_poll_options.announcement_id
    )
  );

drop policy if exists "admins write poll options" on public.announcement_poll_options;
create policy "admins write poll options"
  on public.announcement_poll_options for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- ── The votes ──────────────────────────────────────────────────────────────

create table if not exists public.announcement_poll_votes (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  option_id       uuid not null references public.announcement_poll_options (id) on delete cascade,
  voted_at        timestamptz not null default now(),

  -- One vote per person per poll, enforced by the key rather than by the app —
  -- the same trick `announcement_reads` uses. Changing your mind is an UPDATE
  -- of this row, so there is no way to accumulate two.
  primary key (announcement_id, user_id)
);

create index if not exists poll_votes_by_option
  on public.announcement_poll_votes (option_id);

alter table public.announcement_poll_votes enable row level security;

-- ── You may read exactly one vote row: your own ──
-- There is deliberately no administrator clause here. Staff read the tally
-- through `poll_results()` and cannot read this table at all, so "who voted for
-- what" is not a question the product is able to answer. That is a decision
-- about minors' data, not an oversight — see this section's header.
drop policy if exists "read own vote" on public.announcement_poll_votes;
create policy "read own vote"
  on public.announcement_poll_votes for select
  to authenticated
  using (auth.uid() = announcement_poll_votes.user_id);

-- Casting a vote. The EXISTS does two jobs at once: it proves the option
-- belongs to THIS poll (so a crafted request cannot add a vote for an option of
-- some other announcement), and — because the options policy above is itself
-- subject to the announcements policy — it proves the poll is one the caller is
-- allowed to see at all. A draft cannot be voted on.
drop policy if exists "cast own vote" on public.announcement_poll_votes;
create policy "cast own vote"
  on public.announcement_poll_votes for insert
  to authenticated
  with check (
    auth.uid() = announcement_poll_votes.user_id
    and exists (
      select 1 from public.announcement_poll_options o
      where o.id = announcement_poll_votes.option_id
        -- FULLY QUALIFIED, and it has to be. `announcement_poll_options` has an
        -- `announcement_id` column of its own, so an unqualified reference here
        -- binds to the INNER row and the condition silently degrades to
        -- `o.announcement_id = o.announcement_id` — always true. That would let
        -- a crafted request file a vote against this poll while pointing at an
        -- option belonging to a different one.
        and o.announcement_id = announcement_poll_votes.announcement_id
    )
  );

drop policy if exists "change own vote" on public.announcement_poll_votes;
create policy "change own vote"
  on public.announcement_poll_votes for update
  to authenticated
  using (auth.uid() = announcement_poll_votes.user_id)
  with check (
    auth.uid() = announcement_poll_votes.user_id
    and exists (
      select 1 from public.announcement_poll_options o
      where o.id = announcement_poll_votes.option_id
        and o.announcement_id = announcement_poll_votes.announcement_id
    )
  );

drop policy if exists "retract own vote" on public.announcement_poll_votes;
create policy "retract own vote"
  on public.announcement_poll_votes for delete
  to authenticated
  using (auth.uid() = announcement_poll_votes.user_id);


-- ── The tally ──────────────────────────────────────────────────────────────
-- The only way anybody sees a result. Definer, because it counts rows in a
-- table no client may select — which is exactly what makes aggregate-only
-- access possible.
create or replace function public.poll_results(p_announcement uuid)
returns table (opt_id uuid, opt_idx int, opt_label text, vote_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_visibility text;
  v_published  timestamptz;
  v_expires    timestamptz;
  v_admin      boolean := public.is_admin();
begin
  select a.poll_visibility, a.published_at, a.expires_at
    into v_visibility, v_published, v_expires
  from public.announcements a
  where a.id = p_announcement;

  if v_visibility is null then
    raise exception 'not a poll' using errcode = 'P0002';
  end if;

  if not v_admin then
    -- A private poll's tally is for staff. The app never offers it to anyone
    -- else, and this is the reason that stays true when the app is bypassed.
    if v_visibility <> 'live' then
      raise exception 'results are private' using errcode = '42501';
    end if;
    -- And a live poll's tally is still only readable while the poll itself is.
    if v_published is null or v_published > now()
       or (v_expires is not null and v_expires <= now()) then
      raise exception 'not authorized' using errcode = '42501';
    end if;
  end if;

  return query
    select o.id, o.idx, o.label, count(w.user_id)
    from public.announcement_poll_options o
    left join public.announcement_poll_votes w on w.option_id = o.id
    where o.announcement_id = p_announcement
    group by o.id, o.idx, o.label
    order by o.idx;
end;
$$;

revoke all on function public.poll_results(uuid) from public;
grant execute on function public.poll_results(uuid) to authenticated;


-- ── Creating one ───────────────────────────────────────────────────────────
-- A poll is an announcement plus its options, and the two must land together or
-- not at all. Through PostgREST that is two requests and therefore two chances
-- to leave a poll with no options on somebody's Today page. One function, one
-- transaction, and the same guard as everything else in this file.
--
-- All six types go through it rather than only the poll, so there is one
-- creation path to reason about. The INSERT policy in §3 stays as the backstop.
create or replace function public.admin_create_announcement(
  p_title           text,
  p_body            text,
  p_type            text,
  p_publish         boolean default false,
  p_expires_at      timestamptz default null,
  p_poll_visibility text default null,
  p_video_id        text default null,
  p_options         text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id     uuid;
  v_label  text;
  v_i      int := 0;
  v_count  int := 0;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_type = 'poll' then
    -- Checked here rather than left to a constraint: "at least two options"
    -- spans two tables, and a CHECK cannot see across one.
    v_count := coalesce(array_length(p_options, 1), 0);
    if v_count < 2 or v_count > 6 then
      raise exception 'a poll needs between 2 and 6 options' using errcode = '22023';
    end if;
  end if;

  insert into public.announcements
    (title, body, type, created_by, published_at, expires_at, poll_visibility, video_id)
  values (
    trim(p_title), coalesce(trim(p_body), ''), p_type, auth.uid(),
    case when p_publish then now() else null end,
    p_expires_at,
    case when p_type = 'poll' then coalesce(p_poll_visibility, 'live') else null end,
    case when p_type = 'video' then p_video_id else null end
  )
  returning id into v_id;

  if p_type = 'poll' then
    foreach v_label in array p_options loop
      insert into public.announcement_poll_options (announcement_id, idx, label)
      values (v_id, v_i, trim(v_label));
      v_i := v_i + 1;
    end loop;
  end if;

  return v_id;
end;
$$;

revoke all on function public.admin_create_announcement(text, text, text, boolean, timestamptz, text, text, text[]) from public;
grant execute on function public.admin_create_announcement(text, text, text, boolean, timestamptz, text, text, text[]) to authenticated;


-- ── The console's listing ──
-- Placed last because it reads `announcement_reads` (§4) and
-- `announcement_poll_votes` (§9), so every table it touches exists by the time
-- this statement runs on a fresh database.
-- Dropped before it is created, not `create or replace`. This function's
-- RETURNS TABLE gained columns when polls and video arrived, and Postgres
-- refuses to replace a function whose return type changed — so a plain
-- `create or replace` here would fail on every database that already ran an
-- earlier version of this file.
drop function if exists public.admin_list_announcements();

create function public.admin_list_announcements()
returns table (
  id              uuid,
  title           text,
  body            text,
  type            text,
  created_at      timestamptz,
  published_at    timestamptz,
  expires_at      timestamptz,
  read_count      bigint,
  poll_visibility text,
  video_id        text,
  vote_count      bigint
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
    select a.id, a.title, a.body, a.type, a.created_at, a.published_at, a.expires_at,
           -- Counted as correlated subqueries rather than by joining both child
           -- tables: two LEFT JOINs against one parent multiply each other's
           -- rows, and the read count would come back as reads x votes.
           (select count(*) from public.announcement_reads r where r.announcement_id = a.id),
           a.poll_visibility,
           a.video_id,
           (select count(*) from public.announcement_poll_votes w where w.announcement_id = a.id)
    from public.announcements a
    order by a.created_at desc;
end;
$$;

revoke all on function public.admin_list_announcements() from public;
grant execute on function public.admin_list_announcements() to authenticated;
