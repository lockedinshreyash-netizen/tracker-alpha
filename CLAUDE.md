# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

"LOCK IN JEE'27 Tracker" — a single-page React app for tracking daily study logs, syllabus progress, and question practice for JEE/NEET 2027 aspirants (India). Vite + React 19 + TypeScript, no test framework or linter configured.

## Commands

```bash
npm run dev      # start Vite dev server on port 3000 (host 0.0.0.0)
npm run build    # production build
npm run preview  # preview production build
```

There are no test, lint, or typecheck scripts defined in `package.json`. `tsconfig.json` has `noEmit: true`, so `npx tsc --noEmit` can be used to typecheck manually if needed.

Environment variable `GEMINI_API_KEY` is read via `vite.config.ts` and exposed as `process.env.API_KEY` / `process.env.GEMINI_API_KEY` (not currently referenced elsewhere in the code).

## Architecture

- **Monolithic `App.tsx`** (~1800 lines) contains the root `App` component plus most tab components defined inline as local consts: `AuthModal`, `Header`, `Navbar`, `TaskSection`, `SyllabusTab`, `MonthlyHeatmap`, `StreakTab`, `ReviewTab`, `TodayTab`. When making changes, search within this file rather than assuming separate component files exist.
- **Separate top-level components**: `Sidebar.tsx`, `LandingPage.tsx`, `OnboardingTour.tsx`, and the `landing/` (Hero/Features/Stats/FinalCta sections) and `questions/` (Questions tab + its subsections) directories.
- **`review/`** holds chart components (`QuestionsBarChart`, `QuestionsHeatmap`) used by `ReviewTab`.
- **State shape** is centralized in `types.ts` (`AppState`), covering logs, syllabus progress, tasks, timer, lock-in mode, question tracking, and theme. `constants.tsx` holds static config: syllabus chapter lists per class/subject, status colors/labels, exam-preference helpers (`getActiveSubjects`, `getCoreSubjects`, `getCoreQSubjects` switch behavior between JEE and NEET), and exam countdown target dates.
- **`utils.ts`** has pure functions operating on `AppState`/`DailyLog[]`: IST date handling (`getISTDateString` — all dates are computed in Asia/Kolkata timezone, not local time), streak calculation, 7-day stats, subject distribution, and the "Lock-In Score" composite metric (consistency 30% + volume 30% + syllabus progress 10% + quality 30%, minus a distraction penalty).

### Persistence & sync model (in `App.tsx`)

- Local-first: full `AppState` is persisted to `localStorage` under key `locked_in_state_v2` on every state change.
- Optional cloud sync via Supabase (`@supabase/supabase-js`), table `user_profiles` (columns: `id`, `state` jsonb, `updated_at`). The Supabase URL/anon key are hardcoded in `App.tsx`.
- Conflict resolution uses a `lastUpdated` timestamp on `AppState`: on initial sync, whichever of local/remote has the newer `lastUpdated` wins wholesale, except when local is newer, in which case `logs`/`tasks` are merged by `id` to avoid resurrecting deletions while keeping unique entries from both sides. UI-only fields (`lastUsedTab`, `theme`) always stay local.
- A Supabase Realtime channel (`profile_changes_${user.id}`) listens for `UPDATE` on `user_profiles` and applies remote state locally if its `lastUpdated` is newer, guarded by a `preventSyncOnUpdate` ref to avoid sync feedback loops.
- `triggerSync` upserts state to Supabase, debounced via `isSyncingRef`/`pendingSyncRef` so overlapping writes queue rather than race.
- Auth (email/password) is handled through `AuthModal` and `supabase.auth`; signing out clears all `sb-*` and the `locked_in_state_v2` localStorage keys and resets to `DEFAULT_STATE`.

### Timer / Lock-In mode

`TimerState` tracks a running study timer per subject with distraction counting (tab switches/blur events) and an `isLockInActive` flag. Starting a session with Lock-In enabled forces the Fullscreen API; exiting fullscreen while active is treated as a "breach" (recorded distraction + forced pause + a "SESSION BREACHED" full-screen interstitial the user must explicitly resume from). Sessions require 15 real minutes (`REQUIRED_FOCUS_MS`) before they can be ended/logged — the end button is disabled and shows a countdown until then. A separate "wipe" affordance (15s press-and-hold) discards the in-progress session instead of logging it. `allowList` in `AppState` is defined in `types.ts` but not currently read/written anywhere in the app — treat it as unused/aspirational state.

## Product philosophy & tone

The product frames studying as high-stakes competition, not a gentle habit tracker — copy is deliberately blunt, uppercase, and pressure-inducing ("THE COMPETITION IS STUDYING. ARE YOU?", "YOUR COMPETITION IS LOGGING HOURS RIGHT NOW.", "Now stop reading and start studying."). Actions are phrased as commitments/consequences (`ENGAGE` / `ABORT`, `WIPE`, `SESSION BREACHED`, `LOCK-OUT: 00:04:12`) rather than neutral CRUD labels. Preserve this voice in any new UI copy — avoid softening it into generic encouragement.

Landing page (`LandingPage.tsx` + `landing/*`) pitches the app as "free JEE study tracker, no fluff" and drives a countdown to JEE Mains 2027, gated behind a one-time `hasVisited` localStorage flag so returning users skip straight to the app.

`OnboardingTour.tsx` runs a short spotlight-based tour (modal → highlight session timer → highlight daily target → highlight Syllabus/Streak nav → closing modal) on first visit to the app proper, tracked separately via the `onboarding_complete` localStorage key. Spotlight targets are located via `data-onboarding-target` attributes on the actual UI elements (see `Sidebar.tsx`), not hardcoded coordinates — new nav items must carry this attribute to stay tour-compatible.

### Design system (`index.css`)

Dark-first "premium" aesthetic: near-black gradient background (`--bg-base #0B0B0D`), a single accent red (`--accent #E10600`) used for progress/action elements, and a light theme variant toggled via `state.theme`. Four fonts are combined intentionally, each scoped to a class:
- `font-display` (Anton, uppercase-only, weight 400) — logo, hero numbers, timers, key stats. Never for body text.
- `font-ui` (Satoshi) — all body/labels/buttons/nav/inputs.
- `font-accent` (Playfair Display) — sparse brand/tagline moments.
- `num-timer` (Averia Serif Libre) — the countdown/session timer specifically, distinct from other stat numbers (`num-stat`, `num-hero` use Anton).
Buttons/cards get a small `active:scale-97` press effect and `.card-interactive` hover-lift globally; the active timer view uses a grain+red-glow "premium" background (`.timer-active-bg`) rather than a flat card.

## Domain model / usage flow

- **Exam preference** (`JEE` vs `NEET`) is chosen at signup and switchable later; it changes which subjects (`getActiveSubjects`/`getCoreSubjects`/`getCoreQSubjects` in `constants.tsx`) and which syllabus chapter set (`SYLLABUS_DATA[11|12]`) are shown, without deleting the other exam's historical data.
- **Tabs** (`Today`, `Syllabus`, `Streak`, `Questions`, `Review`) map to the app's core loops:
  - `Today` — start/stop a study session timer (optionally Lock-In-gated), log focus quality (1-5) and manual hours, manage a subject-tagged task list, view today's per-subject hour distribution and session history.
  - `Syllabus` — per-chapter status cycling (`not_started → in_progress → completed → revision_pending`) across Class 11/12 chapters for the active exam's subjects.
  - `Streak` — current daily-logging streak (`calculateStreak`, only breaks if neither today nor yesterday has a log), a 7-day hours bar chart, a monthly heatmap, and (if present) question-practice charts.
  - `Questions` — a separate practice-question tracker (`questions/` dir) with its own weekly/daily goals per subject, "weak subject" flagging, and breakdowns — distinct from the hours/log tracking in `Today`.
  - `Review` — the composite "Lock-In Score" (see `calculateLockInScore` in `utils.ts`), aggregate stats (total hours/sessions/avg quality), account/sync controls (sign in/out, "Reset Device"), exam-preference switch, contact links, and a manual log entry form (for backfilling sessions not tracked live via the timer).
- **Sync/account model**: the app is fully usable offline/local-only (`OFFLINE MODE` badge); signing in via Supabase email/password enables cross-device sync (see Persistence & sync model above). There is no anonymous-to-authenticated data migration beyond the merge-by-id logic already described — signing in on a fresh device pulls cloud state; signing out wipes the local device copy (cloud record is preserved, per the confirm dialog copy).

## Supabase (external, not in this repo)

- Project URL/anon key are hardcoded in `App.tsx` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) — no `.env`-based Supabase config exists in this repo.
- Single table `user_profiles`: `id` (auth user id, PK), `state` (jsonb serialization of `AppState`), `updated_at`. Realtime is enabled on this table for `UPDATE` events (used for the live cross-device sync channel).
- No migrations/schema files live in this repo — the schema must be inspected/changed directly in the Supabase dashboard.
