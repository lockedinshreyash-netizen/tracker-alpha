-- ── Notes to the founder ──
-- The "A note for the founder" box on the Support Alpha page, and the founder's
-- one reply to each. It is not Feedback (admin.sql §5) and must not become it:
-- Feedback is a support inbox with categories and statuses; this is a
-- letterbox with at most one letter back. No thread, no status, no category.
--
-- Who can write a note: signed-in students only, through send_founder_note().
-- A guest has no row to limit or to delete, and an anonymous write endpoint is
-- one anybody holding the anon key can flood.
--
-- Who can read notes: administrators, through admin_founder_notes(), which
-- returns the words and the signed name and NEVER the author's account or
-- email. A note sent unsigned stays unsigned to the person replying. Nobody
-- reads the table directly; every client privilege on it is revoked.
--
-- Who can reply: administrators, through admin_reply_founder_note(). The
-- author reads the reply through my_founder_notes() and marks it seen with
-- ack_founder_replies(), the same arrangement as feedback replies
-- (reply_seen_at, admin.sql §6b), so reading on the phone clears the laptop.
--
-- The note is tied to its author's account for three reasons only: the rate
-- limit, delivering the reply, and so deleting the account deletes the note
-- (on delete cascade — delete_my_account in account.sql needs nothing extra).
--
-- Re-runnable, and run admin.sql first (is_admin()). Until it is run, the page
-- says notes are not open yet and never pretends a note was sent.

create table if not exists public.founder_notes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  body        text        not null,
  -- Null unless the student chose to sign. Copied from their profile by the
  -- function, never typed, so a note cannot be signed with someone else's name.
  signed_name text,
  created_at  timestamptz not null default now(),

  -- The form is advice; these are the rule.
  constraint founder_notes_body_len check (char_length(btrim(body)) between 1 and 500),
  constraint founder_notes_name_len check (signed_name is null or char_length(signed_name) <= 80)
);

-- The reply. Added by ALTER so a table made by the first version of this file
-- gains it in place.
alter table public.founder_notes add column if not exists reply         text;
alter table public.founder_notes add column if not exists replied_at    timestamptz;
alter table public.founder_notes add column if not exists replied_by    uuid references auth.users (id) on delete set null;
-- When the author last saw the reply. Unseen = a reply, and this null or older
-- than replied_at, so an edited reply counts as new again.
alter table public.founder_notes add column if not exists reply_seen_at timestamptz;

alter table public.founder_notes drop constraint if exists founder_notes_reply_len;
alter table public.founder_notes add constraint founder_notes_reply_len
  check (reply is null or char_length(btrim(reply)) between 1 and 1000);
-- A reply and its date arrive and leave together.
alter table public.founder_notes drop constraint if exists founder_notes_reply_dated;
alter table public.founder_notes add constraint founder_notes_reply_dated
  check ((reply is null) = (replied_at is null));

-- The rate limit's lookup and the author's own list, and newest-first reading.
create index if not exists founder_notes_by_user
  on public.founder_notes (user_id, created_at desc);
create index if not exists founder_notes_newest
  on public.founder_notes (created_at desc);

-- RLS on with no policies at all: every client select, insert, update and
-- delete is refused. The grants are revoked too, so a policy added by mistake
-- later still opens nothing.
alter table public.founder_notes enable row level security;
revoke all on public.founder_notes from public, anon, authenticated;

-- ── Sending ──
-- Definer, because the caller has no rights on the table. Everything about the
-- row is decided here from auth.uid(): who wrote it, when, and under what name.
create or replace function public.send_founder_note(p_body text, p_signed boolean default false)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_body   text := btrim(coalesce(p_body, ''));
  v_name   text;
  v_recent int;
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'founder_note_signed_out' using errcode = '28000';
  end if;
  if char_length(v_body) = 0 or char_length(v_body) > 500 then
    raise exception 'founder_note_length' using errcode = '22023';
  end if;

  -- Three a day. The lock serialises one person's sends so two tabs pressing
  -- Send together cannot both read "two so far" and both insert a fourth.
  perform pg_advisory_xact_lock(hashtext('founder_note:' || v_uid::text));
  select count(*) into v_recent
    from public.founder_notes
   where user_id = v_uid and created_at > now() - interval '24 hours';
  if v_recent >= 3 then
    raise exception 'founder_note_rate' using errcode = 'P0001';
  end if;

  if coalesce(p_signed, false) and to_regclass('public.profiles') is not null then
    execute 'select nullif(btrim(display_name), '''') from public.profiles where user_id = $1'
      into v_name using v_uid;
    v_name := left(v_name, 80);
  end if;

  insert into public.founder_notes (user_id, body, signed_name)
  values (v_uid, v_body, v_name)
  returning id into v_id;
  return v_id;
end;
$$;

-- Supabase grants EXECUTE to anon by name, so revoke from both, then give it
-- back to signed-in users only.
revoke all on function public.send_founder_note(text, boolean) from public, anon;
grant execute on function public.send_founder_note(text, boolean) to authenticated;

-- ── The author's side ──
-- Their own notes, newest first, with any reply. Never anyone else's.
drop function if exists public.my_founder_notes();
create function public.my_founder_notes()
returns table (
  id uuid, body text, signed boolean, created_at timestamptz,
  reply text, replied_at timestamptz, reply_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select n.id, n.body, n.signed_name is not null, n.created_at, n.reply, n.replied_at, n.reply_seen_at
    from public.founder_notes n
   where n.user_id = auth.uid()
   order by n.created_at desc
   limit 50;
$$;

-- Marks replies seen. Own rows only, this column only, and never earlier than
-- the reply itself (replied_at comes from the replier's request; greatest()
-- keeps a reply edited a moment later from looking already seen).
create or replace function public.ack_founder_replies(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  for v_id in
    update public.founder_notes
       set reply_seen_at = greatest(now(), replied_at)
     where user_id = auth.uid()
       and id = any(coalesce(p_ids, '{}'))
       and reply is not null
    returning id
  loop
    -- Read in the app: a lock-screen push still waiting to go out would only
    -- announce what they have just read.
    perform public.founder_reply_push(v_id, auth.uid(), null);
  end loop;
end;
$$;

-- How many replies are waiting: the line on Today.
create or replace function public.unseen_founder_replies()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.founder_notes
   where user_id = auth.uid()
     and reply is not null
     and (reply_seen_at is null or reply_seen_at < replied_at);
$$;

-- ── The lock-screen push ──
-- A reply is queued as a row in due_reminders (reminders.sql), the table the
-- send-reminders Edge Function already drains every minute, so a student whose
-- app is closed hears about it on their lock screen. Only students who turned
-- on reminders with an account have a push address; for everyone else the row
-- simply goes unsent and the reply card in the app does the job.
--
-- Key: `founder:<note id>@<epoch ms>`. The `founder:` prefix is what tells the
-- sender how to word and route it (`/?open=support`), and what the client's
-- reminder reconciler (reminders/publish.ts) leaves alone — it deletes every
-- other unsent row it did not write. Unsent rows for a note are withdrawn when
-- the reply changes, is taken back, or is read in the app. Sent rows are never
-- touched: they are the record of what the student was told.
--
-- Internal: called only by the two functions above and below, never by a
-- client. Guarded, so support.sql still installs without reminders.sql.
create or replace function public.founder_reply_push(p_note uuid, p_user uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text;
begin
  if to_regclass('public.due_reminders') is null then
    return;
  end if;
  execute 'delete from public.due_reminders where user_id = $1 and sent_at is null and id like $2'
    using p_user, 'founder:' || p_note::text || '@%';
  if p_reply is null then
    return;
  end if;
  -- The reply itself, shortened to fit the lock screen (body <= 200).
  v_body := case when char_length(p_reply) > 160 then left(p_reply, 157) || '…' else p_reply end;
  -- The name matches SUPPORT_COPY.signature in support/content.ts.
  execute 'insert into public.due_reminders (id, user_id, fire_at, title, body) values ($1, $2, now(), $3, $4)'
    using 'founder:' || p_note::text || '@' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint::text,
          p_user, 'Shreyash replied to your note', v_body;
end;
$$;

revoke all on function public.founder_reply_push(uuid, uuid, text) from public, anon, authenticated;

-- ── The founder's side ──
-- Every note, newest first, keyset-paged on created_at. Unreplied only when
-- asked. The author is not in the result: only what they wrote and, if they
-- chose to sign, their name.
drop function if exists public.admin_founder_notes(boolean, timestamptz, int);
create function public.admin_founder_notes(
  p_unreplied boolean default false,
  p_before    timestamptz default null,
  p_limit     int default 50
)
returns table (
  id uuid, body text, signed_name text, created_at timestamptz,
  reply text, replied_at timestamptz, reply_seen boolean
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
    select n.id, n.body, n.signed_name, n.created_at, n.reply, n.replied_at,
           (n.reply is not null and n.reply_seen_at is not null and n.reply_seen_at >= n.replied_at)
      from public.founder_notes n
     where (not coalesce(p_unreplied, false) or n.reply is null)
       and (p_before is null or n.created_at < p_before)
     order by n.created_at desc
     limit greatest(1, least(coalesce(p_limit, 50), 100));
end;
$$;

-- Write, change or take back the one reply. An empty reply removes it.
create or replace function public.admin_reply_founder_note(p_id uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reply text := nullif(btrim(coalesce(p_reply, '')), '');
  v_author uuid;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if v_reply is not null and char_length(v_reply) > 1000 then
    raise exception 'founder_reply_length' using errcode = '22023';
  end if;
  update public.founder_notes
     set reply = v_reply,
         replied_at = case when v_reply is null then null else now() end,
         replied_by = case when v_reply is null then null else auth.uid() end,
         reply_seen_at = case when v_reply is null then null else reply_seen_at end
   where id = p_id
  returning user_id into v_author;
  if not found then
    raise exception 'founder_note_missing' using errcode = 'P0002';
  end if;
  -- Queue (or withdraw) the lock-screen push. An edited reply replaces the
  -- unsent one rather than adding a second.
  perform public.founder_reply_push(p_id, v_author, v_reply);
end;
$$;

revoke all on function public.my_founder_notes() from public, anon;
revoke all on function public.ack_founder_replies(uuid[]) from public, anon;
revoke all on function public.unseen_founder_replies() from public, anon;
revoke all on function public.admin_founder_notes(boolean, timestamptz, int) from public, anon;
revoke all on function public.admin_reply_founder_note(uuid, text) from public, anon;
grant execute on function public.my_founder_notes() to authenticated;
grant execute on function public.ack_founder_replies(uuid[]) to authenticated;
grant execute on function public.unseen_founder_replies() to authenticated;
grant execute on function public.admin_founder_notes(boolean, timestamptz, int) to authenticated;
grant execute on function public.admin_reply_founder_note(uuid, text) to authenticated;
