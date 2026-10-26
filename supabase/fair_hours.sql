-- ── Fair hours: a second line behind the "Still studying?" check ──
--
-- The app stops a timer nobody is watching after 3.5h (today/presence.ts), but
-- the app is the only thing enforcing that, and a modified client skips it.
-- These cap what one study day can put on a ranked board at 16 timed hours:
-- past that a day is a timer left running, not studying.
--
-- Triggers, not CHECKs: a CHECK rejects the whole upsert (the student's row
-- freezes on the board) and cannot be added over rows already above 16. The
-- app clamps to the same number (MAX_RANKED_HOURS), so honest use never hits
-- these. Existing rows are left alone. Re-runnable; either table may be absent.

create or replace function public.cap_ranked_hours()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_table_name = 'leaderboard_entries' then
    new.hours := least(new.hours, 16);
  else
    new.tracked_hours := least(new.tracked_hours, 16);
  end if;
  return new;
end $$;

do $$
begin
  if to_regclass('public.leaderboard_entries') is not null then
    drop trigger if exists leaderboard_entries_cap on public.leaderboard_entries;
    create trigger leaderboard_entries_cap before insert or update of hours
      on public.leaderboard_entries for each row execute function public.cap_ranked_hours();
  end if;
  if to_regclass('public.study_days') is not null then
    drop trigger if exists study_days_cap on public.study_days;
    create trigger study_days_cap before insert or update of tracked_hours
      on public.study_days for each row execute function public.cap_ranked_hours();
  end if;
end $$;
