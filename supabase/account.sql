-- ═══════════════════════════════════════════════════════════════════════════
-- Deleting your own account
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Google Play requires an app that lets people sign up to let them delete the
-- account from inside it, and so does common decency. This is the database
-- half: one function, callable only by the person being deleted. The client
-- (account/deleteAccount.ts) removes the person's files from Storage first,
-- because Storage objects cannot be deleted from SQL, and its delete policies
-- check rows (a personal deck, the `cbt` feature) that this function removes.
--
-- Almost everything already cascades from auth.users (`on delete cascade` in
-- every other file here; personal decks go by the trigger in decks.sql §6 when
-- their owner is nulled), so the function's job is one guard and the two
-- places that do not cascade:
--
--   1. The last administrator cannot delete themselves. `revoke_admin` refuses
--      the same thing for the same reason: an app with no administrator has no
--      way back in short of the SQL editor.
--   2. `race_chat_messages.deleted_by` has no ON DELETE rule, so anyone who
--      ever deleted a race chat message (their own, or as staff) could not be
--      deleted at all: the foreign key would refuse. It is cleared first.
--   3. `user_profiles` (the synced AppState blob) was created in the dashboard,
--      not in this repo, so its foreign key cannot be checked from here and is
--      not trusted to cascade. It is deleted by hand.
--
-- Every optional table is guarded by to_regclass, so this file installs and
-- works whichever of the others have been run. PL/pgSQL plans a statement only
-- when it first runs, so a branch naming a missing table is never planned.
--
-- Run it any time, in any order relative to the other files. Re-runnable.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  if to_regclass('public.user_roles') is not null then
    if exists (select 1 from public.user_roles where user_id = uid and role = 'admin')
       and not exists (select 1 from public.user_roles where role = 'admin' and user_id <> uid) then
      raise exception 'last_admin' using errcode = 'P0001',
        hint = 'Make someone else an administrator before deleting this account.';
    end if;
  end if;

  if to_regclass('public.race_chat_messages') is not null then
    update public.race_chat_messages set deleted_by = null where deleted_by = uid;
  end if;

  if to_regclass('public.user_profiles') is not null then
    delete from public.user_profiles where id = uid;
  end if;

  -- Everything else goes with this row: profile, Ranks, groups (ownership
  -- passes on by the succession trigger in groups.sql), chat, decks progress,
  -- reminders and push subscriptions, feedback, analytics, AI notes, CBT.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ── Your own avatar files ──
-- profiles.sql gave the avatars bucket no SELECT policy, reasoning that public
-- URLs bypass RLS. They do, but Storage's list() is a SELECT and its remove()
-- is a DELETE that Postgres also filters through SELECT policies, so without
-- this a student could neither find nor delete their own photo: the files
-- would outlive the account, and every avatar ever replaced (uploadAvatar's
-- clean-up runs the same list → remove) is still in the bucket. Own folder
-- only; public reads are unchanged.
drop policy if exists "users list their own avatars" on storage.objects;
create policy "users list their own avatars"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
