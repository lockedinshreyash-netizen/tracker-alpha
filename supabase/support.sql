-- ── Notes to the founder ──
-- The "A note for the founder" box on the Support Alpha page. One table, one
-- function, and deliberately nothing else: no reply, no status, no category.
-- It is not Feedback (admin.sql §5) and must not become it — Feedback is a
-- support inbox; this is a letterbox.
--
-- Who can write: signed-in students only, through send_founder_note(). A
-- guest has no row to limit or to delete, and an anonymous write endpoint is
-- one anybody holding the anon key can flood.
--
-- Who can read: nobody through the API, administrators included. The founder
-- reads them in the Supabase dashboard (Table editor → founder_notes), which
-- runs as the service role. There is no console screen, so there is no query
-- for a policy to get wrong.
--
-- The note is tied to its author's account for two reasons only: the rate
-- limit, and so deleting the account deletes the note (on delete cascade —
-- delete_my_account in account.sql needs nothing extra). Their name is copied
-- onto the note only if they tick "Sign it with my name".
--
-- Re-runnable. Run any time; until it is run, the page says notes are not open
-- yet and never pretends a note was sent.

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

-- The rate limit's lookup, and newest-first reading in the dashboard.
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
