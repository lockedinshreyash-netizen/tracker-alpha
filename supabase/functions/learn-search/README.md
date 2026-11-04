# learn-search — deploy runbook

Discover (Learn → Discover and the ⌘K search) works only through this function.
Until it is deployed, and `VITE_LEARN_DISCOVER=true` is set on Vercel, Discover
is not drawn at all. Pasting a link always works.

## Before anything: YouTube's side

1. A Google Cloud project for Tracker Alpha, with **YouTube Data API v3**
   enabled. One project for this app only (YouTube API policy III.D.1.c).
2. An **API key**, restricted to the YouTube Data API v3. Leave application
   restrictions off: the key is only ever used from this function, never from
   a browser.
3. Default quota is about **100 searches a day for the whole app** (each search
   costs 101 units: search.list 100 + videos.list 1). Real use needs a quota
   extension, which needs YouTube's **API Compliance Audit**. Apply once a small
   private beta has real numbers to show.

## Deploy

```bash
# learn.sql must be run first (§3 holds the counters and the cache)
supabase secrets set YOUTUBE_API_KEY=...        # from step 2
supabase functions deploy learn-search
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided
to every function by Supabase.

Then on Vercel: `VITE_LEARN_DISCOVER=true`, and redeploy (VITE_ variables are
read at build time).

## Limits

In `learn_search_settings` (one row, SQL editor only):

| Column | Default | Meaning |
|---|---:|---|
| `per_user_searches` | 30 | Searches per student per study day (04:00 IST) |
| `per_user_refreshes` | 20 | Title refreshes per student per day |
| `daily_ceiling` | 90 | Searches that may reach YouTube per day, app-wide. Set to about (granted quota ÷ 101) minus a margin |

```sql
update public.learn_search_settings set daily_ceiling = 9500;  -- after a 1M-unit grant
```

Cached searches (same words, same length, last 6 hours) cost no quota and do
not count against the ceiling. They still count against the student's 30.

## What it stores

- `learn_search_usage`: per student per day, three counts. Deleted with the account.
- `learn_search_cache`: SHA-256 of the search → YouTube's public results. Never who searched.
- Nothing else. The words searched are not logged.

## Responses

| Status | Body | The app says |
|---|---|---|
| 200 | `{ results, remaining }` | the results, and "28 searches left today" |
| 429 | `{ error: 'limit' }` | "That's today's 30 searches. Back at 4 AM." |
| 429 / 502 | `{ error: 'busy' }` | Discover is full for today (app-wide ceiling or YouTube's quota) |
| 503 | `not_configured` / `not_set_up` | Discover isn't switched on yet |
| 403 | `not_member` | members only |
