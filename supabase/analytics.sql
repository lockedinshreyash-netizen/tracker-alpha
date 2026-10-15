-- ── Analytics: who uses the app, how often, and for what ──
-- Run this once in the Supabase dashboard: SQL Editor → New query → Run.
-- Every statement is idempotent; re-run it any time. Run AFTER admin.sql —
-- every reader here is guarded on `is_admin()`.
--
-- WHY A LEDGER, AND NOT THE DATA THAT WAS ALREADY THERE.
--
-- Nothing on the server could say who used the app on a given day.
-- `user_profiles.updated_at` is only the LAST write, so yesterday is gone the
-- moment somebody syncs today. `auth.users.last_sign_in_at` moves on a password
-- sign-in, not on opening the app with a session that is still valid — which is
-- how almost everybody opens it. `study_days` and `leaderboard_entries` exist
-- only for people who opted into groups or the Race. Reading every
-- `user_profiles.state` blob on each console load would detoast every user's
-- entire private history to count heads, and get slower every week.
--
-- So: one row per user per study day, written by the app while it is open.
-- The primary key is the deduplication — a refresh storm, two tabs and a phone
-- all land on the same row.
--
-- PRIVACY. Neither table below has a single client policy, and both have
-- their grants revoked: no client may read or write them directly, not even
-- an administrator. Rows are written by `track_activity()` (definer, about
-- `auth.uid()` only), and read by two admin-only definer functions:
-- `admin_analytics()`, which returns counts and sums and nothing else, and
-- `admin_recent_users()` (§6b), the newest accounts by name with their public
-- profile and these same numbers — never study content, never an email. Most
-- of these users are minors, so nothing here answers more than that.
--
-- Two kinds of row live in `activity_days`, told apart by `opens`:
--   opens >= 1  the app reported itself open that day (live tracking).
--   opens  = 0  reconstructed by `analytics_backfill()` (§5) from evidence
--               already on the server: study logs, Race days, deck reviews,
--               chat messages, sign-ins. History before live tracking began is
--               therefore a floor, not a count — the console says so.


-- ═══════════════════════════════════════════════════════════════════════════
-- 1. Who was here, per study day
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.activity_days (
  user_id       uuid          not null references auth.users (id) on delete cascade,
  -- The 04:00-IST study day, the same key the Race and groups use.
  day           date          not null,
  -- Visits reported that day (a 30-minute gap starts a new one). 0 = reconstructed.
  opens         int           not null default 0,
  -- That day's logged study, as the device last reported it. Every source;
  -- `tracked_hours` is stopwatch + Pomodoro only, the Race's rule.
  hours         numeric(5, 2) not null default 0,
  tracked_hours numeric(5, 2) not null default 0,
  sessions      int           not null default 0,
  platform      text,
  -- Running as the installed app (home screen / desktop PWA) at any point that day.
  installed     boolean       not null default false,
  first_at      timestamptz,
  last_at       timestamptz,

  primary key (user_id, day),
  constraint activity_hours_sane check (
    hours between 0 and 24 and tracked_hours between 0 and 24 and tracked_hours <= hours
  ),
  constraint activity_counts_sane check (opens between 0 and 10000 and sessions between 0 and 500),
  constraint activity_platform_valid check (platform is null or platform in ('ios', 'android', 'desktop', 'other'))
);

-- Every reader slices by day first; the primary key leads with user_id.
create index if not exists activity_days_by_day on public.activity_days (day);

alter table public.activity_days enable row level security;
revoke all on public.activity_days from anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2. How each person has the app set up, as of their last visit
--
-- One row per user, overwritten. These facts live in the synced blob, and the
-- client already has them normalised and typed — so it reports a handful of
-- counts and flags rather than the server parsing jsonb it does not own.
-- Typed columns with CHECKs, not a free jsonb bag: a field nobody validated is
-- a field somebody will eventually fill with something else.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.usage_snapshots (
  user_id          uuid         primary key references auth.users (id) on delete cascade,
  exam             text,
  class_level      smallint,
  streak           int          not null default 0,
  goal_hours       numeric(4, 2),
  timer_mode       text,
  theme            text,
  -- Plan blocks + repeating rules.
  plan_items       int          not null default 0,
  tasks            int          not null default 0,
  -- Mocks with a result logged, not merely planned.
  mocks            int          not null default 0,
  errors           int          not null default 0,
  chapters_started int          not null default 0,
  chapters_done    int          not null default 0,
  rewards          int          not null default 0,
  race             boolean      not null default false,
  -- Closed-app reminders switched on.
  reminders        boolean      not null default false,
  updated_at       timestamptz  not null default now(),

  constraint usage_exam_valid  check (exam is null or exam in ('JEE', 'NEET')),
  constraint usage_class_valid check (class_level is null or class_level in (11, 12)),
  constraint usage_timer_valid check (timer_mode is null or timer_mode in ('stopwatch', 'pomodoro')),
  constraint usage_theme_valid check (theme is null or theme in ('dark', 'light')),
  constraint usage_goal_sane   check (goal_hours is null or goal_hours between 0 and 24),
  constraint usage_counts_sane check (
    streak between 0 and 100000 and plan_items between 0 and 100000 and tasks between 0 and 100000
    and mocks between 0 and 100000 and errors between 0 and 100000
    and chapters_started between 0 and 100000 and chapters_done between 0 and 100000
    and rewards between 0 and 1000
  )
);

create index if not exists usage_snapshots_recent on public.usage_snapshots (updated_at);

alter table public.usage_snapshots enable row level security;
revoke all on public.usage_snapshots from anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Helpers
--
-- Defined here rather than borrowing `ist_study_day()` from groups.sql, so this
-- file installs on a project that never ran that one. Same rule: the day rolls
-- over at 04:00 IST, and IST has no daylight saving.
--
-- The `analytics_*` readers turn a client-written JSON field into a value or a
-- null — never an exception. A malformed field costs that field, not the ping.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.analytics_day(p_at timestamptz)
returns date
language sql
immutable
as $$
  select ((p_at at time zone 'Asia/Kolkata') - interval '4 hours')::date;
$$;

create or replace function public.analytics_today()
returns date
language sql
stable
as $$
  select public.analytics_day(now());
$$;

-- The Monday a study day's week starts on. Date arithmetic, not date_trunc:
-- date_trunc on a date goes through a timestamp and the session time zone.
create or replace function public.analytics_week(p_day date)
returns date
language sql
immutable
as $$
  select p_day - (extract(isodow from p_day)::int - 1);
$$;

create or replace function public.analytics_num(p jsonb, k text, lo numeric, hi numeric)
returns numeric
language sql
immutable
as $$
  select case when jsonb_typeof(p -> k) = 'number'
              then least(greatest((p ->> k)::numeric, lo), hi) end;
$$;

create or replace function public.analytics_int(p jsonb, k text, hi int)
returns int
language sql
immutable
as $$
  select coalesce(floor(public.analytics_num(p, k, 0, hi))::int, 0);
$$;

create or replace function public.analytics_bool(p jsonb, k text)
returns boolean
language sql
immutable
as $$
  select case when jsonb_typeof(p -> k) = 'boolean' then (p ->> k)::boolean end;
$$;

create or replace function public.analytics_text(p jsonb, k text, allowed text[])
returns text
language sql
immutable
as $$
  select case when jsonb_typeof(p -> k) = 'string' and (p ->> k) = any (allowed) then p ->> k end;
$$;

create or replace function public.analytics_date(p text)
returns date
language plpgsql
immutable
as $$
begin
  if p is null or p !~ '^\d{4}-\d{2}-\d{2}$' then
    return null;
  end if;
  return p::date;
exception when others then
  -- '2026-02-31' matches the shape and is still not a date.
  return null;
end;
$$;

-- Only the definer functions below call these, and they run as the owner.
revoke all on function public.analytics_day(timestamptz)           from public, anon, authenticated;
revoke all on function public.analytics_today()                    from public, anon, authenticated;
revoke all on function public.analytics_week(date)                 from public, anon, authenticated;
revoke all on function public.analytics_num(jsonb, text, numeric, numeric) from public, anon, authenticated;
revoke all on function public.analytics_int(jsonb, text, int)      from public, anon, authenticated;
revoke all on function public.analytics_bool(jsonb, text)          from public, anon, authenticated;
revoke all on function public.analytics_text(jsonb, text, text[])  from public, anon, authenticated;
revoke all on function public.analytics_date(text)                 from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4. The write path — "I am here"
--
-- Called by the app (analytics/useActivityPing.ts) on load, on coming back
-- after a 30-minute gap, and a few seconds after today's logs change. One
-- jsonb argument rather than a parameter list, so a field added later never
-- changes the signature (a changed signature leaves an overload behind that
-- makes PostgREST calls ambiguous).
--
--   { open: bool, platform: 'ios'|'android'|'desktop'|'other', installed: bool,
--     days:  [{ day: 'YYYY-MM-DD', hours, tracked, sessions }]   -- today, yesterday
--     facts: { exam, class, streak, goal, timer, theme, plan, tasks, mocks,
--              errors, started, done, rewards, race, reminders } }
--
-- The day being marked active is the SERVER's study day — a device clock is
-- not asked. The device's own totals are accepted only for today and
-- yesterday, and yesterday only onto a row that already exists: a session
-- settled just after 04:00 lands on the day it was studied, but logging hours
-- never invents a visit.
--
-- Everything here is self-reported, like the Race. The worst a hostile client
-- can do is misreport itself, inside the bounds the CHECKs allow.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.track_activity(p jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid       uuid := auth.uid();
  today     date := public.analytics_today();
  v_open    boolean;
  v_plat    text;
  v_inst    boolean;
  d         jsonb;
  d_day     date;
  d_hours   numeric;
  d_tracked numeric;
  f         jsonb;
  v_class   numeric;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p is null or jsonb_typeof(p) <> 'object' then
    p := '{}'::jsonb;
  end if;

  v_open := coalesce(public.analytics_bool(p, 'open'), false);
  v_plat := public.analytics_text(p, 'platform', array['ios', 'android', 'desktop', 'other']);
  v_inst := coalesce(public.analytics_bool(p, 'installed'), false);

  -- The first report of the day is a visit whatever it says; a reconstructed
  -- row (opens = 0) becomes a live one.
  insert into public.activity_days as a (user_id, day, opens, platform, installed, first_at, last_at)
  values (uid, today, 1, v_plat, v_inst, now(), now())
  on conflict (user_id, day) do update set
    opens     = least(greatest(a.opens + case when v_open then 1 else 0 end, 1), 10000),
    platform  = coalesce(excluded.platform, a.platform),
    installed = a.installed or excluded.installed,
    first_at  = coalesce(a.first_at, excluded.first_at),
    last_at   = excluded.last_at;

  if jsonb_typeof(p -> 'days') = 'array' then
    for d in
      select e from jsonb_array_elements(p -> 'days') with ordinality as t(e, i) where i <= 2
    loop
      continue when jsonb_typeof(d) <> 'object';
      d_day := public.analytics_date(d ->> 'day');
      continue when d_day is null or d_day not in (today, today - 1);
      d_hours := public.analytics_num(d, 'hours', 0, 24);
      continue when d_hours is null;
      d_tracked := least(coalesce(public.analytics_num(d, 'tracked', 0, 24), 0), d_hours);

      update public.activity_days
         set hours         = round(d_hours, 2),
             tracked_hours = round(d_tracked, 2),
             sessions      = public.analytics_int(d, 'sessions', 500)
       where user_id = uid and day = d_day;
    end loop;
  end if;

  f := p -> 'facts';
  if jsonb_typeof(f) = 'object' then
    v_class := public.analytics_num(f, 'class', 0, 99);
    insert into public.usage_snapshots as s (
      user_id, exam, class_level, streak, goal_hours, timer_mode, theme, plan_items, tasks,
      mocks, errors, chapters_started, chapters_done, rewards, race, reminders, updated_at
    ) values (
      uid,
      public.analytics_text(f, 'exam', array['JEE', 'NEET']),
      case when v_class in (11, 12) then v_class::smallint end,
      public.analytics_int(f, 'streak', 100000),
      round(public.analytics_num(f, 'goal', 0, 24), 2),
      public.analytics_text(f, 'timer', array['stopwatch', 'pomodoro']),
      public.analytics_text(f, 'theme', array['dark', 'light']),
      public.analytics_int(f, 'plan', 100000),
      public.analytics_int(f, 'tasks', 100000),
      public.analytics_int(f, 'mocks', 100000),
      public.analytics_int(f, 'errors', 100000),
      public.analytics_int(f, 'started', 100000),
      public.analytics_int(f, 'done', 100000),
      public.analytics_int(f, 'rewards', 1000),
      coalesce(public.analytics_bool(f, 'race'), false),
      coalesce(public.analytics_bool(f, 'reminders'), false),
      now()
    )
    on conflict (user_id) do update set
      exam = excluded.exam, class_level = excluded.class_level, streak = excluded.streak,
      goal_hours = excluded.goal_hours, timer_mode = excluded.timer_mode, theme = excluded.theme,
      plan_items = excluded.plan_items, tasks = excluded.tasks, mocks = excluded.mocks,
      errors = excluded.errors, chapters_started = excluded.chapters_started,
      chapters_done = excluded.chapters_done, rewards = excluded.rewards, race = excluded.race,
      reminders = excluded.reminders, updated_at = excluded.updated_at;
  end if;
end;
$$;

revoke all on function public.track_activity(jsonb) from public, anon;
grant execute on function public.track_activity(jsonb) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5. Reconstructing the past
--
-- Without this, every chart would start empty on the day the file was run.
-- History is rebuilt from what the server already holds, all of it evidence
-- that the person was in the app that day:
--
--   study logs in user_profiles.state   (with that day's hours and sessions)
--   the sign-up day, for accounts that went on to sync
--   the last password sign-in
--   Race days, deck reviews, group and Race chat messages
--
-- Days before the account existed are dropped: the app is local-first, so a
-- log can predate the account it was later synced into, and activity before
-- a sign-up would turn every retention cohort inside out.
--
-- Reconstructed rows carry opens = 0, and `on conflict do nothing` means a
-- re-run never touches a live row. Study logs go first so their hours win a
-- day the other sources also found. Run once by the line at the bottom of this
-- file; it reads every blob, so it is not callable by any client.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.analytics_backfill()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  today   date := public.analytics_today();
  n_logs  int  := 0;
  n_other int  := 0;
  k       int;
begin
  if to_regclass('public.user_profiles') is not null then
    insert into public.activity_days (user_id, day, opens, hours, tracked_hours, sessions)
    select x.user_id, x.day, 0,
           least(round(x.hours, 2), 24),
           least(round(x.tracked, 2), least(round(x.hours, 2), 24)),
           least(x.sessions, 500)
    from (
      select up.id as user_id, l.day,
             sum(l.hours)                                      as hours,
             coalesce(sum(l.hours) filter (where l.verified), 0) as tracked,
             count(*)                                          as sessions
      from public.user_profiles up
      join auth.users u on u.id = up.id
      cross join lateral (
        select public.analytics_date(e ->> 'date')              as day,
               (e ->> 'hours')::numeric                         as hours,
               coalesce(e ->> 'source' in ('timer', 'pomodoro'), false) as verified
        from jsonb_array_elements(
          case when jsonb_typeof(up.state -> 'logs') = 'array' then up.state -> 'logs' else '[]'::jsonb end
        ) e
        where jsonb_typeof(e) = 'object' and jsonb_typeof(e -> 'hours') = 'number'
      ) l
      where l.hours > 0
        and l.day between public.analytics_day(u.created_at) and today
      group by up.id, l.day
    ) x
    on conflict (user_id, day) do nothing;
    get diagnostics n_logs = row_count;

    insert into public.activity_days (user_id, day)
    select distinct x.user_id, x.day
    from (
      select up.id as user_id, public.analytics_day(up.updated_at) as day
      from public.user_profiles up where up.updated_at is not null
      union all
      select u.id, public.analytics_day(u.created_at)
      from auth.users u where exists (select 1 from public.user_profiles up where up.id = u.id)
    ) x
    join auth.users u on u.id = x.user_id
    where x.day between public.analytics_day(u.created_at) and today
    on conflict (user_id, day) do nothing;
    get diagnostics k = row_count;
    n_other := n_other + k;
  end if;

  insert into public.activity_days (user_id, day)
  select distinct u.id, public.analytics_day(u.last_sign_in_at)
  from auth.users u
  where u.last_sign_in_at is not null
    and public.analytics_day(u.last_sign_in_at) between public.analytics_day(u.created_at) and today
  on conflict (user_id, day) do nothing;
  get diagnostics k = row_count;
  n_other := n_other + k;

  if to_regclass('public.leaderboard_entries') is not null then
    insert into public.activity_days (user_id, day)
    select distinct le.user_id, le.date
    from public.leaderboard_entries le
    join auth.users u on u.id = le.user_id
    where le.date between public.analytics_day(u.created_at) and today
    on conflict (user_id, day) do nothing;
    get diagnostics k = row_count;
    n_other := n_other + k;
  end if;

  if to_regclass('public.review_events') is not null then
    insert into public.activity_days (user_id, day)
    select distinct r.user_id, public.analytics_day(r.reviewed_at)
    from public.review_events r
    join auth.users u on u.id = r.user_id
    where public.analytics_day(r.reviewed_at) between public.analytics_day(u.created_at) and today
    on conflict (user_id, day) do nothing;
    get diagnostics k = row_count;
    n_other := n_other + k;
  end if;

  if to_regclass('public.group_messages') is not null then
    insert into public.activity_days (user_id, day)
    select distinct m.sender_id, public.analytics_day(m.created_at)
    from public.group_messages m
    join auth.users u on u.id = m.sender_id
    where public.analytics_day(m.created_at) between public.analytics_day(u.created_at) and today
    on conflict (user_id, day) do nothing;
    get diagnostics k = row_count;
    n_other := n_other + k;
  end if;

  if to_regclass('public.race_chat_messages') is not null then
    insert into public.activity_days (user_id, day)
    select distinct m.user_id, public.analytics_day(m.created_at)
    from public.race_chat_messages m
    join auth.users u on u.id = m.user_id
    where public.analytics_day(m.created_at) between public.analytics_day(u.created_at) and today
    on conflict (user_id, day) do nothing;
    get diagnostics k = row_count;
    n_other := n_other + k;
  end if;

  return jsonb_build_object('from_logs', n_logs, 'from_other', n_other);
end;
$$;

revoke all on function public.analytics_backfill() from public, anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6. The read path — the console's whole dashboard in one call
--
-- Counts and sums only; nothing returned can be traced to a person. One round
-- trip because the console draws everything at once and a dozen requests
-- would each re-check `is_admin()` for nothing.
--
-- Definitions, so the console and this file never disagree:
--   active on day D   a row in activity_days for D (§1)
--   DAU               active today, so far
--   WAU / MAU         active on any of the last 7 / 30 study days, today included
--   stickiness        (active user-days over the 30 complete days before
--                     today ÷ 30) ÷ distinct users across those 30 days
--   day-N retention   of confirmed accounts that signed up within the 90 days
--                     ending N days ago, the share active exactly N days later
--   growth            per ISO week: new (first-ever active week), retained
--                     (active this week and last), resurrected (active this
--                     week, not last, seen before), churned (last week, not this)
--
-- Rolling WAU/MAU are not a distinct count per day (90 × a window scan).
-- Each active day covers the next 7 (or 30) days up to that user's next active
-- day, so the windows a user is counted in never overlap; +1 at the start and
-- −1 after the end, summed in day order, is the count for every day at once.
--
-- Every block that reads another feature's table is guarded on that table
-- existing and wrapped in its own exception handler: a project that never ran
-- decks.sql still gets its dashboard, just without a Decks line.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.admin_analytics(p_days int default 90)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  today       date := public.analytics_today();
  n           int  := least(greatest(coalesce(p_days, 90), 7), 365);
  r_start     date := today - (n - 1);
  wk_now      date := public.analytics_week(today);
  wk_first    date := public.analytics_week(today) - 7 * 11;
  today_start timestamptz := ((today::timestamp + interval '4 hours') at time zone 'Asia/Kolkata');
  out         jsonb;
  part        jsonb;
  extra       jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  out := jsonb_build_object(
    'generated_at', now(),
    'today', today,
    'days', n,
    'start', r_start,
    'tracking_since', (select public.analytics_day(min(first_at)) from public.activity_days)
  );

  -- ── Accounts ──
  select jsonb_build_object(
    'total',          count(*),
    'confirmed',      count(*) filter (where u.email_confirmed_at is not null),
    'synced',         count(*) filter (where exists (select 1 from public.user_profiles up where up.id = u.id)),
    'new_today',      count(*) filter (where s.d = today),
    'new_7',          count(*) filter (where s.d > today - 7),
    'new_prev_7',     count(*) filter (where s.d between today - 13 and today - 7),
    'new_30',         count(*) filter (where s.d > today - 30),
    'new_prev_30',    count(*) filter (where s.d between today - 59 and today - 30),
    'new_range',      count(*) filter (where s.d >= r_start),
    'new_prev_range', count(*) filter (where s.d between r_start - n and r_start - 1)
  ) into part
  from auth.users u
  cross join lateral (select public.analytics_day(u.created_at) as d) s;
  out := out || jsonb_build_object('accounts', part);

  -- ── Activity and study, headline figures ──
  select jsonb_build_object(
    'dau',          count(*) filter (where day = today),
    'dau_prev',     count(*) filter (where day = today - 1),
    'wau',          count(distinct user_id) filter (where day > today - 7),
    'wau_prev',     count(distinct user_id) filter (where day between today - 13 and today - 7),
    'mau',          count(distinct user_id) filter (where day > today - 30),
    'mau_prev',     count(distinct user_id) filter (where day between today - 59 and today - 30),
    'user_days_30', count(*) filter (where day between today - 30 and today - 1),
    'mau_complete', count(distinct user_id) filter (where day between today - 30 and today - 1),
    'days_per_mau', count(*) filter (where day > today - 30),
    'visits_7',     coalesce(sum(opens) filter (where day > today - 7 and opens > 0), 0),
    'live_days_7',  count(*) filter (where day > today - 7 and opens > 0)
  ),
  jsonb_build_object(
    'hours_today',     coalesce(sum(hours) filter (where day = today), 0),
    'hours_7',         coalesce(sum(hours) filter (where day > today - 7), 0),
    'hours_prev_7',    coalesce(sum(hours) filter (where day between today - 13 and today - 7), 0),
    'tracked_7',       coalesce(sum(tracked_hours) filter (where day > today - 7), 0),
    'sessions_7',      coalesce(sum(sessions) filter (where day > today - 7), 0),
    'studiers_today',  count(*) filter (where day = today and hours > 0),
    'studiers_7',      count(distinct user_id) filter (where day > today - 7 and hours > 0),
    'student_days_7',  count(*) filter (where day > today - 7 and hours > 0)
  )
  into part, extra
  from public.activity_days
  where day > today - 60;
  out := out || jsonb_build_object('active', part, 'study', extra);

  -- ── Daily series over the range ──
  with days as (
    select r_start + i as day from generate_series(0, n - 1) as g(i)
  ),
  daily as (
    select day,
           count(*)                          as dau,
           count(*) filter (where opens > 0) as live,
           count(*) filter (where hours > 0) as studiers,
           coalesce(sum(hours), 0)           as hours,
           coalesce(sum(tracked_hours), 0)   as tracked,
           coalesce(sum(sessions), 0)        as sessions,
           coalesce(sum(opens), 0)           as visits
    from public.activity_days
    where day between r_start and today
    group by day
  ),
  a as (
    select day, lead(day) over (partition by user_id order by day) as nxt
    from public.activity_days
    where day between r_start - 29 and today
  ),
  deltas as (
    select day as d, 1 as w7, 1 as w30 from a
    union all select least(day + 7,  coalesce(nxt, day + 7)),  -1,  0 from a
    union all select least(day + 30, coalesce(nxt, day + 30)),  0, -1 from a
    union all select day, 0, 0 from days
  ),
  run as (
    select d, sum(sum(w7)) over (order by d) as wau, sum(sum(w30)) over (order by d) as mau
    from deltas group by d
  ),
  signups as (
    select public.analytics_day(created_at) as day, count(*) as n
    from auth.users group by 1
  ),
  series_rows as (
    select days.day,
           coalesce(daily.dau, 0)      as dau,
           coalesce(run.wau, 0)        as wau,
           coalesce(run.mau, 0)        as mau,
           coalesce(daily.live, 0)     as live,
           coalesce(daily.studiers, 0) as studiers,
           coalesce(daily.hours, 0)    as hours,
           coalesce(daily.tracked, 0)  as tracked,
           coalesce(daily.sessions, 0) as sessions,
           coalesce(daily.visits, 0)   as visits,
           coalesce(s.n, 0)            as signups,
           (select count(*) from auth.users where public.analytics_day(created_at) < r_start)
             + sum(coalesce(s.n, 0)) over (order by days.day) as accounts
    from days
    left join daily   on daily.day = days.day
    left join run     on run.d = days.day
    left join signups s on s.day = days.day
  )
  select jsonb_agg(to_jsonb(series_rows) order by series_rows.day) into part from series_rows;
  out := out || jsonb_build_object('series', coalesce(part, '[]'::jsonb));

  -- ── Day-N retention ──
  select coalesce(jsonb_agg(jsonb_build_object('n', t.k, 'eligible', t.e, 'retained', t.r) order by t.k), '[]'::jsonb)
  into part
  from (
    select k.k, count(*) as e,
           count(*) filter (where exists (
             select 1 from public.activity_days a where a.user_id = u.id and a.day = u.sd + k.k
           )) as r
    from (values (1), (7), (30)) as k(k)
    join (
      select id, public.analytics_day(created_at) as sd
      from auth.users where email_confirmed_at is not null
    ) u on u.sd between today - k.k - 89 and today - k.k
    group by k.k
  ) t;
  out := out || jsonb_build_object('retention', part);

  -- ── Weekly cohorts: share of each sign-up week active k weeks later ──
  -- Week k is days [7k, 7k+6] after each person's own sign-up day.
  with c as (
    select id, public.analytics_day(created_at) as sd
    from auth.users
    where email_confirmed_at is not null
      and public.analytics_day(created_at) between wk_first and today
  ),
  cw as (select id, sd, public.analytics_week(sd) as wk from c),
  hits as (
    select cw.wk, (a.day - cw.sd) / 7 as k, count(distinct cw.id) as n
    from cw join public.activity_days a on a.user_id = cw.id and a.day >= cw.sd
    group by 1, 2
  ),
  sizes as (select wk, count(*) as size from cw group by wk)
  select coalesce(jsonb_agg(jsonb_build_object(
           'week', s.wk,
           'size', s.size,
           'active', (
             select jsonb_agg(coalesce(h.n, 0) order by g.k)
             from generate_series(0, (today - s.wk) / 7) as g(k)
             left join hits h on h.wk = s.wk and h.k = g.k
           )
         ) order by s.wk), '[]'::jsonb)
  into part
  from sizes s;
  out := out || jsonb_build_object('cohorts', part);

  -- ── Weekly growth accounting ──
  with w as (
    select distinct user_id, public.analytics_week(day) as wk
    from public.activity_days
    where day >= wk_first - 7
  ),
  firsts as (
    select a.user_id, public.analytics_week(min(a.day)) as fw
    from public.activity_days a
    where a.user_id in (select user_id from w)
    group by a.user_id
  ),
  weeks as (select wk_first + 7 * i as wk from generate_series(0, 11) as g(i)),
  pairs as (
    select weeks.wk, w.user_id,
           bool_or(w.wk = weeks.wk)     as cur,
           bool_or(w.wk = weeks.wk - 7) as prev
    from weeks join w on w.wk in (weeks.wk, weeks.wk - 7)
    group by weeks.wk, w.user_id
  )
  select jsonb_agg(jsonb_build_object(
           'week', t.wk, 'new', t.nw, 'retained', t.rt, 'resurrected', t.rs, 'churned', t.ch
         ) order by t.wk)
  into part
  from (
    select weeks.wk,
           count(*) filter (where p.cur and f.fw = weeks.wk)                   as nw,
           count(*) filter (where p.cur and p.prev)                            as rt,
           count(*) filter (where p.cur and not p.prev and f.fw < weeks.wk)    as rs,
           count(*) filter (where p.prev and not p.cur)                        as ch
    from weeks
    left join pairs p  on p.wk = weeks.wk
    left join firsts f on f.user_id = p.user_id
    group by weeks.wk
  ) t;
  out := out || jsonb_build_object('growth', coalesce(part, '[]'::jsonb), 'week_now', wk_now);

  -- ── How many of the last 30 days each active person showed up ──
  select coalesce(jsonb_agg(jsonb_build_object('days', t.k, 'users', t.c) order by t.k), '[]'::jsonb)
  into part
  from (
    select k, count(*) as c
    from (select count(*) as k from public.activity_days where day > today - 30 group by user_id) x
    group by k
  ) t;
  out := out || jsonb_build_object('frequency', part);

  -- ── Activation, for accounts created in the range ──
  -- Nested: each step also requires every step before it.
  select jsonb_build_object(
    'signed_up', count(*),
    'confirmed', count(*) filter (where t.confirmed),
    'signed_in', count(*) filter (where t.confirmed and t.synced),
    'studied',   count(*) filter (where t.confirmed and t.synced and t.studied),
    'returned',  count(*) filter (where t.confirmed and t.synced and t.studied and t.days >= 2),
    'habit',     count(*) filter (where t.confirmed and t.synced and t.studied and t.days >= 7)
  ) into part
  from (
    select u.email_confirmed_at is not null as confirmed,
           exists (select 1 from public.user_profiles up where up.id = u.id) as synced,
           exists (select 1 from public.activity_days a where a.user_id = u.id and a.hours > 0) as studied,
           (select count(*) from public.activity_days a where a.user_id = u.id) as days
    from auth.users u
    where public.analytics_day(u.created_at) >= r_start
  ) t;
  out := out || jsonb_build_object('funnel', part);

  -- ── Devices, last 30 days (each person's most recent platform) ──
  select jsonb_build_object(
    'platforms', coalesce((
      select jsonb_object_agg(platform, c)
      from (
        select platform, count(*) as c
        from (
          select distinct on (user_id) user_id, platform
          from public.activity_days
          where day > today - 30 and platform is not null
          order by user_id, day desc
        ) x
        group by platform
      ) y
    ), '{}'::jsonb),
    'installed', (select count(distinct user_id) from public.activity_days where day > today - 30 and installed),
    'reporting', (select count(distinct user_id) from public.activity_days where day > today - 30 and platform is not null)
  ) into part;
  out := out || jsonb_build_object('devices', part);

  -- ── How people have the app set up (snapshots from the last 30 days) ──
  select jsonb_build_object(
    'reporting', count(*),
    'exam',    jsonb_build_object('JEE', count(*) filter (where exam = 'JEE'), 'NEET', count(*) filter (where exam = 'NEET')),
    'class',   jsonb_build_object('11', count(*) filter (where class_level = 11), '12', count(*) filter (where class_level = 12)),
    'timer',   jsonb_build_object('stopwatch', count(*) filter (where timer_mode = 'stopwatch'), 'pomodoro', count(*) filter (where timer_mode = 'pomodoro')),
    'theme',   jsonb_build_object('dark', count(*) filter (where theme = 'dark'), 'light', count(*) filter (where theme = 'light')),
    'streaks', jsonb_build_object(
      '0',    count(*) filter (where streak = 0),
      '1-2',  count(*) filter (where streak between 1 and 2),
      '3-6',  count(*) filter (where streak between 3 and 6),
      '7-29', count(*) filter (where streak between 7 and 29),
      '30+',  count(*) filter (where streak >= 30)
    ),
    'goal_avg',          round(avg(goal_hours), 1),
    'chapters_done_avg', round(avg(chapters_done), 1),
    'adoption', jsonb_build_object(
      'plan',      count(*) filter (where plan_items > 0),
      'tasks',     count(*) filter (where tasks > 0),
      'mocks',     count(*) filter (where mocks > 0),
      'errors',    count(*) filter (where errors > 0),
      'syllabus',  count(*) filter (where chapters_started > 0),
      'rewards',   count(*) filter (where rewards > 0),
      'race',      count(*) filter (where race),
      'reminders', count(*) filter (where reminders),
      'pomodoro',  count(*) filter (where timer_mode = 'pomodoro')
    )
  ) into part
  from public.usage_snapshots
  where updated_at > now() - interval '30 days';
  out := out || jsonb_build_object('setup', part);

  -- ── Server-side features. Each optional, each on its own. ──
  part := '{}'::jsonb;

  if to_regclass('public.group_messages') is not null then
    begin
      part := part || jsonb_build_object(
        'groups',            (select count(*) from public.groups),
        'group_members',     (select count(distinct user_id) from public.group_members),
        'groups_active_7',   (select count(distinct group_id) from public.group_messages where created_at > now() - interval '7 days'),
        'group_messages_7',  (select count(*) from public.group_messages where created_at > now() - interval '7 days' and deleted_at is null),
        'group_chatters_30', (select count(distinct sender_id) from public.group_messages where created_at > now() - interval '30 days')
      );
    exception when others then null;
    end;
  end if;

  if to_regclass('public.leaderboard_entries') is not null then
    begin
      part := part || jsonb_build_object(
        'race_today', (select count(*) from public.leaderboard_entries where date = today),
        'race_30',    (select count(distinct user_id) from public.leaderboard_entries where date > today - 30)
      );
    exception when others then null;
    end;
  end if;

  if to_regclass('public.review_events') is not null then
    begin
      part := part || jsonb_build_object(
        'reviews_today', (select count(*) from public.review_events where reviewed_at >= today_start),
        'reviews_7',     (select count(*) from public.review_events where reviewed_at >= today_start - interval '6 days'),
        'reviewers_7',   (select count(distinct user_id) from public.review_events where reviewed_at >= today_start - interval '6 days'),
        'reviewers_30',  (select count(distinct user_id) from public.review_events where reviewed_at >= today_start - interval '29 days'),
        'deck_students', (select count(distinct user_id) from public.user_decks)
      );
    exception when others then null;
    end;
  end if;

  if to_regclass('public.push_subscriptions') is not null then
    begin
      part := part || jsonb_build_object(
        'push_users', (select count(distinct user_id) from public.push_subscriptions)
      );
    exception when others then null;
    end;
  end if;

  if to_regclass('public.profiles') is not null then
    begin
      part := part || jsonb_build_object('profiles', (select count(*) from public.profiles));
    exception when others then null;
    end;
  end if;

  if to_regclass('public.feedback_tickets') is not null then
    begin
      part := part || jsonb_build_object(
        'feedback_open', (select count(*) from public.feedback_tickets where status <> 'resolved'),
        'feedback_7',    (select count(*) from public.feedback_tickets where created_at > now() - interval '7 days')
      );
    exception when others then null;
    end;
  end if;

  if to_regclass('public.announcement_reads') is not null then
    begin
      part := part || jsonb_build_object('announcement', (
        select jsonb_build_object(
          'title', a.title,
          'published_at', a.published_at,
          'reads', (select count(*) from public.announcement_reads r where r.announcement_id = a.id)
        )
        from public.announcements a
        where a.published_at is not null and a.published_at <= now()
        order by a.published_at desc
        limit 1
      ));
    exception when others then null;
    end;
  end if;

  if to_regclass('public.ai_usage') is not null then
    begin
      part := part || jsonb_build_object(
        'ai_users_month', (
          select count(*) from public.ai_usage
          where month = date_trunc('month', now() at time zone 'utc')::date and calls > 0
        )
      );
    exception when others then null;
    end;
  end if;

  out := out || jsonb_build_object('features', part);
  return out;
end;
$$;

revoke all on function public.admin_analytics(int) from public, anon;
grant execute on function public.admin_analytics(int) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6b. The newest accounts, by name — administrators only
--
-- The one reader here that names people, and it was asked for on purpose:
-- staff want to see who just arrived. It returns the newest accounts with
-- what is already public on their profile (name, handle, bio, avatar) plus
-- the numbers this file already keeps about them (exam, class, goal, streak,
-- days active, hours, device). Never study content, never the synced blob,
-- never an email address: it reads `profiles`, `usage_snapshots` and
-- `activity_days`, and nothing else besides `auth.users.created_at`.
--
-- Keyset-paged on `created_at` (`p_before` = the oldest row already shown),
-- at most 100 a page. plpgsql, so a project without profiles.sql still
-- installs this file; calling it there fails, and the console says so.
-- ═══════════════════════════════════════════════════════════════════════════

drop function if exists public.admin_recent_users(int, timestamptz);
create function public.admin_recent_users(p_limit int default 25, p_before timestamptz default null)
returns table (
  user_id      uuid,
  joined_at    timestamptz,
  handle       text,
  display_name text,
  bio          text,
  avatar_type  text,
  avatar_id    text,
  avatar_url   text,
  exam         text,
  class_level  smallint,
  goal_hours   numeric,
  streak       int,
  last_active  date,
  days_active  int,
  hours        numeric,
  platform     text,
  installed    boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  with newest as (
    select au.id, au.created_at
    from auth.users au
    where p_before is null or au.created_at < p_before
    order by au.created_at desc
    limit least(greatest(coalesce(p_limit, 25), 1), 100)
  )
  select
    n.id,
    n.created_at,
    p.handle,
    p.display_name,
    p.bio,
    p.avatar_type,
    p.avatar_id,
    p.avatar_url,
    s.exam,
    s.class_level,
    s.goal_hours::numeric,
    s.streak,
    a.last_active,
    coalesce(a.days_active, 0)::int,
    coalesce(a.hours, 0)::numeric,
    a.platform,
    coalesce(a.installed, false)
  from newest n
  left join public.profiles p        on p.user_id = n.id
  left join public.usage_snapshots s on s.user_id = n.id
  left join lateral (
    select
      max(d.day)                                                             as last_active,
      count(*)                                                               as days_active,
      sum(d.hours)                                                           as hours,
      (array_agg(d.platform order by d.day desc) filter (where d.platform is not null))[1] as platform,
      bool_or(d.installed)                                                   as installed
    from public.activity_days d
    where d.user_id = n.id
  ) a on true
  order by n.created_at desc;
end;
$$;

revoke all on function public.admin_recent_users(int, timestamptz) from public, anon;
grant execute on function public.admin_recent_users(int, timestamptz) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 7. Rebuild history now. Safe to re-run: it never overwrites a live row.
-- ═══════════════════════════════════════════════════════════════════════════

select public.analytics_backfill();
