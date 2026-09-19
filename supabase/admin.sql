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
    check (type in ('announcement', 'update', 'important', 'maintenance')),
  -- Bounded because both strings are rendered verbatim into a modal every user
  -- of the app will see. Long enough for a real message, short enough that it
  -- cannot become a wall.
  constraint announcement_title_len check (char_length(trim(title)) between 3 and 90),
  constraint announcement_body_len  check (char_length(trim(body)) between 3 and 1200),
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
create or replace function public.admin_list_announcements()
returns table (
  id           uuid,
  title        text,
  body         text,
  type         text,
  created_at   timestamptz,
  published_at timestamptz,
  expires_at   timestamptz,
  read_count   bigint
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
           count(r.user_id) as read_count
    from public.announcements a
    left join public.announcement_reads r on r.announcement_id = a.id
    group by a.id
    order by a.created_at desc;
end;
$$;

revoke all on function public.admin_list_announcements() from public;
grant execute on function public.admin_list_announcements() to authenticated;


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
