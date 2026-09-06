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

### Streak rewards (`rewards/`)

- Milestones live in `rewards/catalog.ts` (`REWARDS`) — day 30 wallpaper pack, day 100 in-app book, day 365 physical hamper. Adding a tier is one entry there, provided its `kind` already has a way to be opened. Nothing else hardcodes a milestone.
- `rewards/engine.ts` is pure: `evaluate` re-derives unlocks from logs on every `state.logs` change (returns the *same* object when nothing changed, so the effect settles in one pass). Because it runs on mount, users with pre-existing streaks get their tiers backfilled.
- **Unlocks come from the longest run in the history, not the live streak.** `evaluate` uses `longestStreak`/`longestVerifiedStreak` (`utils.ts`) over all logs, so a month that ended in March still pays out, and a backfilled month counts. The earlier rule read `calculateStreak`, which only sees the run reaching today — a completed 30-day run that broke before the vault was next opened was never rewarded at all.
- **Progress is measured by the live streak.** `rewardProgress(rewards, streak, verifiedStreak)` — the days-to-go line has to answer "what does one more day buy me". Driving it off the high-water mark froze the whole vault for anyone rebuilding after a break (day 8 of a new run, best of 12 → "18 days to go", unchanged for four days running, directly under a card reading "Current streak: 8"). The stored best is shown beside the bar as `best N` when it beats the run in progress, and nothing else.
- **Unlocks are permanent and monotone.** Breaking a streak never revokes one. `RewardsState` stores `bestStreak`/`bestVerifiedStreak` high-water marks so deleting old logs cannot take a reward back either. That one-way property is why `mergeRewards` unions rewards on sync instead of letting last-write-wins drop a tier — it is applied in all three merge paths in `App.tsx` (cloud-newer, local-newer, realtime).
- Rewards with real cost behind them (`requiresVerified: true` — book, hamper) count only the **verified streak**: consecutive days with a `timer`/`pomodoro` log, via `calculateVerifiedStreak` in `utils.ts`. Manual backfills keep the visible streak alive but cannot mint a year of study in a for-loop. Same stance the leaderboard takes on `LogSource`.
- UI: `RewardsVault` (in `StreakTab`) shows locked tiers too — a prize you cannot see is not a reason to log tomorrow. `UnlockModal` fires once per reward, oldest un-shown first, gated on `acknowledged`.
- Wallpapers (`rewards/wallpapers.ts`) ship no image assets — every design is layered CSS, plus SVG data URIs generated at module init by `starfield()` (a seeded PRNG placing individual stars; tiled `radial-gradient` dots were tried first and always read as graph paper). `rewards/WallpaperLayer.tsx` paints both the fixed full-page layer in `App.tsx` and the picker swatches, so a preview is exactly what gets applied.
- The Aurora wallpaper is animated, which a CSS `background` cannot be — it renders real elements: `AURORA_CURTAINS` (masked ribbons of hairline "rays" over a luminous sheet) and `AURORA_GLOWS` (unmasked, heavily blurred ambient spill so the light falls off across the page instead of stopping at the mask). Motion lives in `index.css` (`aurora-drift`/`aurora-glow`/`aurora-shimmer`/`aurora-breathe`) and is disabled under `prefers-reduced-motion`. Per-element `animationDuration` must list one value **per keyframe animation** — a single value silently applies to all of them and locks the cycles together.
- Two things constrain every wallpaper: they sit behind the header, so peak brightness has to leave the countdown text readable; and the same CSS paints a 64px swatch, so no viewport units.
- The day-100 book text is `content/book.ts` — **currently a scaffold** with `complete: false`. Replace `BOOK.chapters` with the manuscript and flip the flag; the reader, vault and progress all read from there. It is bundled rather than fetched so it works offline.
- The hamper claim is deliberately a `mailto:`, not a form. The app never collects a postal address — most users are minors, and shipping details in a synced jsonb blob is a liability, not a feature.

### Scheduling (`schedule/`)

- The **Plan** tab. `schedule/schedule.ts` is pure and React-free (same contract as `today/pomodoro.ts`); `PlanTab.tsx` is a zero-logic container over `DateStrip`, `DayTimeline`, `AdherenceSection` and `TemplateSection`, taking a narrow slice plus narrow callbacks like `questions/QuestionsTab.tsx` — never `AppState` or `setState`.
- **`DayMinute` is minutes since 04:00 IST, not since midnight.** Minute 0 is 04:00, 1200 is midnight, 1439 is 03:59 the next morning. Storing wall-clock minutes instead would make a 23:00–01:00 block wrap, and every one of overlap detection, sorting, layout, drag-clamping and hit-testing would need a special case. `start + durationMins <= 1440` is a hard clamp everywhere (`clampBlock`) — a block may not straddle the rollover, or its hours would land on two study days and be unfalsifiable against `logs`. The grid draws a labelled `MIDNIGHT` divider at 1200 so the wrap is legible.
- **Recurrence is rules plus per-date overrides, never materialized rows.** `TemplateRule` has `days`/`from`/`until`; `materializeDay(schedule, date)` derives instances on read and gives each the synthetic id `` `${ruleId}@${date}` `` — the same key a `BlockOverride` uses, so an instance has a stable identity without anything being written for days you never touched. Writing seven rows a week would grow the synced jsonb blob without bound and would need a nightly job that has nowhere to run.
- **Editing a rule closes it and opens a new one** (`updateRule` in `App.tsx`: old rule's `until` = yesterday, a new rule `from` today), and `deleteRule` sets `until` rather than removing the row. Editing in place would move the slot on days already spent, so last Monday's adherence would silently be re-measured against a plan that did not exist when it was lived. A rule created today has no such history and really is edited/removed outright.
- Dragging a rule instance writes an override for that date only — `updateBlock` routes on whether the id contains `@`. `normalizeSchedule` (`state.ts`) drops overrides whose rule is gone, which is what keeps that array bounded.
- **A gesture never touches `AppState`.** Every state change writes localStorage and fires `triggerSync`, so committing per frame would mean ~60 Supabase upserts per drag. `DayTimeline` keeps live geometry in a `preview` state plus a `dragRef`, and calls the mutator exactly once on release. Pointer Events, not HTML5 drag-and-drop (no touch support, no resize); `pointermove`/`up` are bound to **window**, because `setPointerCapture` routes captured events back to the element that claimed them and a handler anywhere else would never fire. A `ref`-only gesture cannot wake an effect, hence the `gesture` state whose only job is attaching those listeners. `pointerup` after a real drag sets `suppressClickRef` so the trailing click does not open the editor on the block just moved.
- All block geometry is **inline `style`**, never Tailwind. Tailwind here is the CDN script with no config, so `h-[${n}px]` in a template literal compiles to nothing. `touchAction: 'none'` on cards and handles is what makes touch dragging work at all; the 56px hour gutter stays scrollable so the grid can still be panned on a phone.
- Overlaps are allowed, never blocked — `layoutDay` splits clashing blocks into side-by-side lanes and the editor warns without refusing. A student double-booked at 19:00 is information; refusing the drop reads as the app being broken.
- **Past days are read-only.** Editing yesterday's plan after the fact would falsify its adherence.
- **Adherence is two-tier, and the UI says which.** `DailyLog` has a date, a subject and hours but **no start time**, so per-block truth exists only when the app was watching: `startBlock` stamps `TimerState.blockId`/`chapter`, `handleStopTimer` passes them to `logStudy`, and they land on the log (this is also why `logStudy` gained trailing optional `chapter`/`blockId` params, and why `engageRecommendation` now carries `rec.chapter` — `hoursOnChapter` in `recommend.ts` had been reading a field nothing ever wrote). Everything else is allocated by subject, **earliest block first** — the charitable reading that still leaves a late block correctly marked skipped — and the leftover is `offPlanMins`. Blocks of kind `break`/`fixed` are commitments and never count as planned study.
- `schedule/colors.ts` is the app's only subject colour map; it did not exist before this feature. The accent `#E10600` is deliberately absent from it — that belongs to the now-line and to actions.
- `mergeSchedule` runs in the **local-newer sync path only**, exactly like the by-id merges of `logs`/`tasks`. A union in the realtime or cloud-newer paths would look kinder and be wrong: a block deleted on the phone has to reach the laptop, and a device that unions can never be told something is gone.

### Timer / Lock-In mode

`TimerState` tracks a running study timer per subject with distraction counting (tab switches/blur events) and an `isLockInActive` flag. Starting a session with Lock-In enabled forces the Fullscreen API; exiting fullscreen while active is treated as a "breach" (recorded distraction + forced pause + a "SESSION BREACHED" full-screen interstitial the user must explicitly resume from). Sessions require 15 real minutes (`REQUIRED_FOCUS_MS`) before they can be ended/logged — the end button is disabled and shows a countdown until then. A separate "wipe" affordance (15s press-and-hold) discards the in-progress session instead of logging it. `allowList` in `AppState` is defined in `types.ts` but not currently read/written anywhere in the app — treat it as unused/aspirational state.

### Pomodoro (`today/pomodoro.ts`, `today/usePomodoro.ts`, `today/PomodoroTimer.tsx`)

- **`usePomodoro` is the engine and it is mounted in `App.tsx`, not in the timer component.** A block has to keep running — and keep logging — while the user is on the Streak tab, or on no tab at all. When the loop lived inside `PomodoroTimer` it stopped existing the moment that component unmounted, and the bell never rang. `PomodoroTimer` is a view over the runtime plus the engine's controls; its own 250ms tick only redraws the clock.
- **Time served is never lost.** A block's `DailyLog` is written the instant the block ends — bell, `end()`, `reset()`, or switching to the stopwatch — at neutral quality 4, and rating it afterwards only amends that log (`pendingRating` holds `logId`, never unlogged hours). The old shape parked an unlogged block in `pendingBlock`, so stopping a 60-minute block after 15 minutes threw away the 15 minutes, and a second block finishing before the first was rated overwrote it. `pendingBlock` survives in `types.ts` only to be flushed once from old saved state.
- **Three runtime states, told apart by two fields** (`isIdle`/`isPaused` in `today/pomodoro.ts`): idle is `phaseTotalMs === null`; running has `phaseEndsAt` set; paused keeps `phaseTotalMs` with the time banked in `servedMs`. Everything is derived from the wall clock — `servedMs` is stale by design while running. `phaseTotalMs` is captured at start, so editing the block length mid-phase cannot change what the running block earns.
- Ending a work phase early logs whatever was served (floor `MIN_LOGGABLE_MS`, one minute) and advances to the break, but only fills a dot in the set if at least `COUNTS_TOWARDS_SET` (half) of the block was served — otherwise four ten-second blocks would buy a long break.
- A bell that rang while the tab was hidden is settled at `phaseEndsAt`, so the hours land on the study day they were served, and auto-start is suppressed (chaining off a bell nobody heard fabricates phases). Past `STALE_PHASE_MS` (12h) the phase is dropped instead of logged — the browser was closed, not studied through.
- Settling is idempotent: guarded per `phaseEndsAt` and by a 500ms floor between settles, because a timeout, a 5s safety interval, a visibility handler, a double-tap and a voice command can all reach for the same transition.
- The runtime is device-local — all three sync merge paths in `App.tsx` keep the local `pomodoro` — so `normalizePomodoro` (`state.ts`) only ever sanitizes this device's own localStorage, and `commitPomodoro` bumps `lastUpdated` only when a log is actually written.

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
- **Tabs** (`Today`, `Plan`, `Syllabus`, `Streak`, `Questions`, `Ranks`, `Review`) map to the app's core loops:
  - `Plan` — a day timeline (drag to move, drag an edge to resize, tap to edit, ENGAGE to start the clock on a block), a weekly recurring template, and a plan-vs-actual adherence readout. See Scheduling above.
  - `Today` — start/stop a study session timer (optionally Lock-In-gated), log focus quality (1-5) and manual hours, manage a subject-tagged task list, view today's per-subject hour distribution and session history.
  - `Syllabus` — per-chapter status cycling (`not_started → in_progress → completed → revision_pending`) across Class 11/12 chapters for the active exam's subjects.
  - `Streak` — current daily-logging streak (`calculateStreak`, only breaks if neither today nor yesterday has a log), progress to the next reward, the reward vault (see Streak rewards below), a 7-day hours bar chart, a monthly heatmap, and (if present) question-practice charts.
  - `Questions` — a separate practice-question tracker (`questions/` dir) with its own weekly/daily goals per subject, "weak subject" flagging, and breakdowns — distinct from the hours/log tracking in `Today`.
  - `Review` — the composite "Lock-In Score" (see `calculateLockInScore` in `utils.ts`), aggregate stats (total hours/sessions/avg quality), account/sync controls (sign in/out, "Reset Device"), exam-preference switch, contact links, and a manual log entry form (for backfilling sessions not tracked live via the timer).
- **Sync/account model**: the app is fully usable offline/local-only (`OFFLINE MODE` badge); signing in via Supabase email/password enables cross-device sync (see Persistence & sync model above). There is no anonymous-to-authenticated data migration beyond the merge-by-id logic already described — signing in on a fresh device pulls cloud state; signing out wipes the local device copy (cloud record is preserved, per the confirm dialog copy).

## Supabase (external, not in this repo)

- Project URL/anon key are hardcoded in `App.tsx` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) — no `.env`-based Supabase config exists in this repo.
- Single table `user_profiles`: `id` (auth user id, PK), `state` (jsonb serialization of `AppState`), `updated_at`. Realtime is enabled on this table for `UPDATE` events (used for the live cross-device sync channel).
- No migrations/schema files live in this repo — the schema must be inspected/changed directly in the Supabase dashboard.
