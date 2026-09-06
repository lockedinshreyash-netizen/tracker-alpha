-- ── Migration: one row per user per DAY ──
--
-- leaderboard.sql originally stored one row per user, rewritten each day, on
-- the reasoning that "the board only ever shows today, so history here would be
-- dead weight". That turned out to be wrong: it means yesterday's race is
-- destroyed by the first session logged today, so no recap or history feature
-- can ever be built. This changes the grain to (user_id, date).
--
-- ORDER MATTERS. The live site upserts with ON CONFLICT (user_id). Postgres
-- rejects an ON CONFLICT clause with no matching unique constraint, so if the
-- primary key is swapped in one step, every publish from the deployed client
-- fails until the new build lands. Steps 1 and 3 are therefore separated by a
-- deploy, and at no point is the site left without a usable conflict target.
--
-- Run step 1, deploy the client, then run step 3. Each step is idempotent.


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1 — run this FIRST, before deploying any client change.
--
-- Adds the composite unique constraint alongside the existing primary key.
-- Both ON CONFLICT targets now resolve, so the old client keeps working and
-- the new one will work the moment it ships. Rows are still capped at one per
-- user by the surviving primary key — history does not start accumulating
-- until step 3.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.leaderboard_entries'::regclass
      and conname  = 'leaderboard_entries_user_date_key'
  ) then
    alter table public.leaderboard_entries
      add constraint leaderboard_entries_user_date_key unique (user_id, date);
  end if;
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2 — deploy the client.
--
--   publishEntry : onConflict 'user_id'  ->  'user_id,date'
--   fetchBoard   : add .eq('date', getISTDateString())
--
-- Without the fetchBoard filter the board would start listing every past day's
-- row as if it were a separate competitor the moment step 3 lands.
-- No SQL to run here.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3 — run this AFTER the client above is live.
--
-- Retires the single-column primary key so a user may hold one row per day.
-- From this moment history begins accumulating. It is not retroactive: days
-- before this ran were overwritten and cannot be recovered.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
begin
  -- Promote the composite key to primary, then drop the old one. Done in this
  -- order so the table is never momentarily without a primary key.
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.leaderboard_entries'::regclass
      and conname  = 'leaderboard_entries_pkey'
      and (select array_agg(attname order by attnum)
             from pg_attribute
            where attrelid = conrelid and attnum = any(conkey)) = array['user_id']::name[]
  ) then
    alter table public.leaderboard_entries drop constraint leaderboard_entries_pkey;
    alter table public.leaderboard_entries
      add constraint leaderboard_entries_pkey primary key (user_id, date);

    -- The composite unique from step 1 is now redundant: the primary key
    -- enforces exactly the same thing.
    alter table public.leaderboard_entries
      drop constraint if exists leaderboard_entries_user_date_key;
  end if;
end $$;

-- The foreign key to auth.users, with its on delete cascade, is defined
-- separately from the primary key and survives all of the above untouched.
-- Deleting an account still removes every one of its rows.

-- The existing (date, hours desc) index already serves both queries this
-- feature needs: today's board, and any past day's final standings.
create index if not exists leaderboard_entries_daily
  on public.leaderboard_entries (date, hours desc);


-- ═══════════════════════════════════════════════════════════════════════════
-- OPTIONAL — retention.
--
-- At 200 users this table grows by ~73k rows a year, which Postgres will not
-- notice. Only worth running if the board grows by orders of magnitude, and
-- only if you have decided how far back history should go.
-- ═══════════════════════════════════════════════════════════════════════════

-- delete from public.leaderboard_entries
--  where date < (current_date - interval '180 days');


-- ── Verify ──
-- After step 3, this should list leaderboard_entries_pkey over (user_id, date).
--
--   select conname,
--          (select string_agg(attname, ', ' order by attnum)
--             from pg_attribute
--            where attrelid = conrelid and attnum = any(conkey)) as columns
--     from pg_constraint
--    where conrelid = 'public.leaderboard_entries'::regclass
--      and contype in ('p', 'u');
