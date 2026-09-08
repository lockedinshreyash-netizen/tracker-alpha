
export type Subject = 'Physics' | 'Chemistry' | 'Maths' | 'Biology' | 'General';

export type ExamPreference = 'JEE' | 'NEET';

export type SyllabusStatus = 'not_started' | 'in_progress' | 'completed' | 'revision_pending';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export type QSubject = 'physics' | 'chemistry' | 'math' | 'biology';

/**
 * Where a log came from.
 *
 * `timer` and `pomodoro` were measured by the app as the time passed;
 * `manual` was typed in after the fact. The leaderboard counts only the first
 * two, so the distinction has to survive on the log itself.
 */
export type LogSource = 'timer' | 'pomodoro' | 'manual';

export interface DailyLog {
  id: string;
  date: string; // YYYY-MM-DD (IST)
  subject: Subject;
  hours: number;
  quality: number; // 1-5
  distractions: number; // Count of tab switches/blur events
  /* Absent on logs written before this existed. Treated as `manual`, because
     an unverifiable origin must never count towards a public ranking. */
  source?: LogSource;
  /* What was actually studied. Optional because the timer can be started
     without picking one, and every log predating this field has none. Turns
     "4h of Physics" into "4h on Thermodynamics", which is the only way the
     coach can notice a chapter you are stuck on. */
  chapter?: string;
  /* The planned block this session was started from, if it was started from
     one. The only way adherence can know a block was honoured rather than
     guess it — a log carries no start time, so without this the best the
     Plan tab can do is match on subject and hours. */
  blockId?: string;
}

export interface DailyQuestionsLog {
  date: string; // YYYY-MM-DD (IST)
  counts: Partial<Record<QSubject, number>>;
}

export type WeeklyGoalBySubject = Partial<Record<QSubject, number | null>>;

export interface QuestionTrackingState {
  weeklyGoalTotal: number | null;
  weeklyGoalBySubject: WeeklyGoalBySubject;
  dailyQuestionsLog: DailyQuestionsLog[];
  weakSubject: QSubject | null;
  goalStartDate: string | null; // ISO date when current goal was set (IST)
}

/** The three columns of the board, left to right. */
export type TaskColumn = 'todo' | 'doing' | 'done';

export interface Task {
  id: string;
  text: string;
  /* Still the authoritative flag even though `column` now carries the same
     truth. share/stats.ts counts `completed && completedAt`, the voice grammar
     sets it, and every task saved before the board existed has nothing else.
     The two are always written together, through one code path: `column ===
     'done'` if and only if `completed`. normalizeTasks forces them to agree,
     because a sync merge between an old client and a new one can produce a row
     where they do not. */
  completed: boolean;
  subject?: Subject;
  /* The study day the box was ticked, stamped the same way and for the same
     reason as `ChapterProgress.completedAt`. A task carries no other clock, so
     without this "what did I finish today" is unanswerable — the boolean alone
     is a running total that silently rewrites its own history.

     Absent on every task completed before this existed, and deliberately not
     backfilled: a task finished at an unknown time must not be credited to
     today. Anything counting per-period completions has to tolerate that
     (see `share/stats.ts`, which falls through to another metric rather than
     report a zero it cannot stand behind). */
  completedAt?: string; // YYYY-MM-DD (IST)

  /* Absent on every task that predates the board. `normalizeTasks` derives it
     from `completed`, so an existing list opens as a populated Todo/Done board
     rather than an empty one. */
  column?: TaskColumn;

  /* Position within its own column. Reindexed 0..n across the affected columns
     on every drop, rather than fractional ranks: a board holds tens of cards,
     not thousands, and a whole-column reindex is one pass over an array the
     user is already looking at. Ties are possible after a sync merge unions two
     devices' tasks, so the sort resolves them by id — see board/board.ts. */
  order?: number;

  /* `#rrggbb` only. Absent means the card wears its subject's colour, which is
     the case for almost every card — the override is for the user who wants
     "red = the thing I keep avoiding". */
  color?: string;

  /* The study day this is due. Absent means no deadline, and a task with no
     deadline never produces a notification of any kind. */
  dueAt?: string; // YYYY-MM-DD (IST study day)

  /* Where in that day it lands, on the study-day minute axis (0 = 04:00 IST) —
     the same axis as ScheduleBlock.start, so toClockValue/fromClockValue bridge
     it to an <input type="time"> with no new conversion code. Absent means "use
     the user's default hour", so changing that default moves every task that
     never asked for a specific time and none of the ones that did. */
  dueMinute?: DayMinute;

  /* The fire key of the reminder already delivered for this task — not a
     boolean. The key contains the due instant, so moving a deadline changes the
     key and re-arms the reminder by itself, with no separate "clear the flag"
     path to forget in one of the several places tasks are mutated.

     Lives on the task, inside the synced blob, deliberately: a reminder fired
     on the laptop must not fire again on the phone an hour later. A
     device-local ledger would double-fire across devices, which is the one
     duplicate the user must never see. */
  remindedKey?: string;
}

export interface ChapterProgress {
  classId: 11 | 12;
  subject: Subject;
  chapter: string;
  status: SyllabusStatus;
  notes?: string;
  /* Absent on entries written before these existed, and deliberately not
     backfilled — a chapter completed at an unknown time must not be treated as
     freshly revised. The coach reads `undefined` as "age unknown" and leans on
     weightage instead of decay for those. */
  completedAt?: string;   // YYYY-MM-DD (IST)
  lastRevisedAt?: string; // YYYY-MM-DD (IST)
}

export type TabType = 'Today' | 'Plan' | 'Syllabus' | 'Streak' | 'Questions' | 'Ranks' | 'Review';

/** Opt-in, per account. Nothing is published until `enabled` is true. */
export interface LeaderboardPrefs {
  enabled: boolean;
  displayName: string;
  /* Race notifications — losing a place, a lead being eaten into. Separate
     from `enabled`: being on the board and wanting to be interrupted about it
     are two different decisions. Only ever true alongside browser permission,
     which can be revoked without the app being told. */
  notifications?: boolean;
}

export interface TimerState {
  isRunning: boolean;
  startTime: number | null;
  accumulatedMs: number;
  subject: Subject;
  /* Set when the session was launched from a block on the Plan tab, and
     stamped onto the log when it stops. Device-local like the rest of the
     timer — a block engaged on the laptop is not running on the phone. */
  blockId?: string;
  /* Carried alongside blockId so the log can say what was actually studied,
     not just which subject. */
  chapter?: string;
}

export type TimerMode = 'stopwatch' | 'pomodoro';

export type PomodoroPhase = 'work' | 'short_break' | 'long_break';

export interface PomodoroSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  blocksBeforeLongBreak: number;
  autoStartNext: boolean;
  /* A bell only helps if you can hear it in another tab. Opt-in, and only ever
     true alongside browser permission — which can be revoked without the app
     being told, so every send is still guarded. */
  notify?: boolean;
  /* Hold the screen awake while a block runs. Phones dim mid-block otherwise,
     and a timer you have to keep waking is a timer you stop trusting. */
  keepAwake?: boolean;
}

/**
 * A Pomodoro block that has already been written to `logs` and is only waiting
 * for its focus rating.
 *
 * The log is written the moment the block ends, at a neutral quality; rating
 * amends it. Study time is never held hostage by a rating the user may never
 * give — the old shape parked an unlogged block here, and anything that
 * cleared it (a second block finishing, a wipe, a closed tab) took real hours
 * with it.
 */
export interface PendingRating {
  /** id of the DailyLog already recorded for this block. */
  logId: string;
  subject: Subject;
  hours: number;
  /** Ended by hand before the bell, rather than run to full length. */
  partial: boolean;
}

export interface PomodoroRuntime {
  phase: PomodoroPhase;
  /* Absolute epoch ms, never a decrementing counter — background tabs throttle
     timers, so remaining time must always be derived from the clock. Null
     whenever the phase is not actively running. */
  phaseEndsAt: number | null;
  isRunning: boolean;
  /* Full length of the phase currently armed, captured when it started. Null
     means nothing is armed (idle). Stored rather than recomputed from settings
     so editing the block length mid-phase cannot retroactively change how long
     the running block was, or how much time it earns. */
  phaseTotalMs: number | null;
  /* Time already served in the armed phase, banked at the last pause. While
     running it is stale by design — the live figure comes off the clock. */
  servedMs: number;
  completedBlocks: number; // within the current set; resets after a long break
  subject: Subject;
  /* Finished blocks awaiting a rating. A queue, because a second block can
     finish before the first is rated. */
  pendingRating: PendingRating[];
  /* @deprecated Pre-queue shape: a finished block that was measured but never
     logged. Never written any more — flushed to `logs` once on load, then
     dropped. Kept only so state saved by an older build loses nothing. */
  pendingBlock?: { subject: Subject; hours: number } | null;
}

/**
 * Just enough memory for the coach to stop repeating itself.
 *
 * Deliberately not a history: `served` keeps one date per task id so the coach
 * rotates through a chapter's topics instead of serving the same one daily, and
 * `dismissed` is cleared whenever `dismissedOn` is not today. Both are bounded
 * by the number of authored topics, so this cannot grow without limit inside
 * the synced state blob.
 */
export interface CoachState {
  dismissed: string[];
  dismissedOn: string | null; // YYYY-MM-DD (IST)
  served: Record<string, string>; // task id -> YYYY-MM-DD last served
  /* Muted for good, for people who already know what they're doing. Lives in
     synced state rather than localStorage so it holds across devices — being
     told what to study on your phone after muting it on your laptop would be
     the whole point missed. Never auto-unmutes. */
  muted?: boolean;
}

/**
 * Everything the user has earned by showing up.
 *
 * Unlocks are permanent and monotone. A reward is a receipt for days already
 * survived, so breaking a streak never takes one back — and that one-way
 * property is what lets two devices merge their rewards by union rather than
 * by whichever wrote last.
 *
 * The high-water marks are stored rather than recomputed because logs can be
 * deleted. A user who clears old logs has still done the days; the receipt
 * stands.
 */
export interface RewardsState {
  /** reward id -> YYYY-MM-DD (IST) it was unlocked. Presence means unlocked. */
  unlocked: Record<string, string>;
  /** Unlocks whose interstitial has been shown, so it fires exactly once. */
  acknowledged: string[];
  /** Selected wallpaper id, or null for the plain app background. */
  wallpaper: string | null;
  bestStreak: number;
  /** Best streak counting only days with a timer/pomodoro log. See LogSource. */
  bestVerifiedStreak: number;
  /** Chapter index the in-app book is open at. */
  bookChapter?: number;
  /** YYYY-MM-DD the user asked to claim the year-one hamper. */
  hamperClaimedOn?: string | null;
}

/**
 * Result of a topic's question in a chapter mastery test.
 *
 * `shaky` exists because the rule is "confidently get all of these right".
 * A right answer the student flagged as a guess is not mastery — it is a gap
 * that happened to land, and treating it as solid would certify a chapter on
 * luck. Only `solid` counts towards completing a chapter.
 */
export type TopicResult = 'solid' | 'shaky' | 'gap';

export interface TopicMastery {
  result: TopicResult;
  date: string; // YYYY-MM-DD (IST)
}

/* ────────────────────────────────────────────────────────────────
   SCHEDULING — the Plan tab
   ──────────────────────────────────────────────────────────────── */

/**
 * Minutes since the start of the study day, which is 04:00 IST — not
 * midnight. See DAY_START_HOUR in utils.ts.
 *
 * So minute 0 is 04:00, minute 1199 is 23:59, and minute 1200 is 00:00 the
 * following calendar morning while still belonging to the same study day.
 * Range 0 … 1439.
 */
export type DayMinute = number;

/**
 * What a block actually is.
 *
 * A day is not only study. Sleep, meals, school and the gym are what decide
 * when studying can happen at all, so they belong on the same grid — but only
 * the first three count as planned study, and only those are measured against
 * `logs`. See `countsAsStudy`.
 */
export type BlockKind =
  | 'study' | 'revision' | 'test'
  | 'class' | 'sleep' | 'meal' | 'gym' | 'break' | 'travel' | 'other';

/**
 * A planned block that exists on one date only.
 *
 * Instances of a weekly rule are NOT stored here — they are derived from
 * `TemplateRule` at render time. See `materializeDay`.
 */
export interface ScheduleBlock {
  id: string;
  date: string; // YYYY-MM-DD (IST study day)
  /* Only study kinds carry one. Sleep has no subject, and pretending it does
     would put it in the adherence maths. */
  subject?: Subject;
  chapter?: string;
  start: DayMinute;
  durationMins: number;
  kind: BlockKind;
  label?: string;
  /* The board card this block is time for, if any. A reference, not a copy —
     the block shows the task's current text, so renaming the card renames the
     block. `normalizeSchedule` drops it when no such task exists, the same
     stance it takes on an override whose rule is gone, which is what keeps
     these references from accumulating.

     Deliberately one-directional: finishing the block does not tick the task.
     Sitting down to work on something is not finishing it, and auto-ticking
     would make the board lie. */
  taskId?: string;
}

/**
 * One repeating slot in the weekly template.
 *
 * `from`/`until` are what keep history honest. Editing a rule closes the old
 * one at yesterday and opens a new one from today, rather than mutating it in
 * place — otherwise moving your Monday slot would retroactively change what
 * last Monday's adherence was measured against.
 */
export interface TemplateRule {
  id: string;
  days: number[]; // 0=Sun … 6=Sat, in study-day terms
  subject?: Subject;
  chapter?: string;
  start: DayMinute;
  durationMins: number;
  kind: BlockKind;
  label?: string;
  /** As on ScheduleBlock. A repeating slot can be time for a standing task. */
  taskId?: string;

  from: string;          // inclusive YYYY-MM-DD; nothing materializes before this
  until?: string | null; // inclusive last day, or null while the rule is live
}

/**
 * One instance of a rule, moved or dropped for a single date.
 *
 * The id is `${ruleId}@${date}` so re-editing the same instance replaces its
 * override instead of stacking a second one.
 */
export interface BlockOverride {
  id: string;
  ruleId: string;
  date: string;
  skipped?: boolean;
  start?: DayMinute;
  durationMins?: number;
  subject?: Subject;
  chapter?: string;
}

/**
 * The plan.
 *
 * Rules plus overrides rather than materialized rows: seven rows a week
 * written forever would grow the synced blob without bound, and every edit to
 * the template would rewrite days already spent. Overrides accrue only where
 * the user actually deviated, so this stays small.
 */
export interface ScheduleState {
  blocks: ScheduleBlock[];
  rules: TemplateRule[];
  overrides: BlockOverride[];
  /**
   * Per-activity colour overrides, `#rrggbb`, keyed by `BlockKind`.
   *
   * Study kinds are never keyed here: a study block wears its subject's colour,
   * and those are fixed so a subject stays recognisable everywhere it appears.
   * Absent means "whatever the app ships" — see `ACTIVITY_BASE`.
   */
  colors?: Partial<Record<BlockKind, string>>;
}

/**
 * Deadline reminders. Off until asked for, like every other thing here that can
 * interrupt.
 */
export interface ReminderPrefs {
  enabled: boolean;
  /* The hour a dated task speaks at when it was not given one, on the study-day
     axis: 300 is 09:00. Set once, in settings — a time picker on every task is
     a tax on the ninety percent of tasks that just want "some time on
     Thursday". */
  defaultMinute: DayMinute;
  /** Minutes before the due instant. 0 fires at the moment itself. */
  leadMinutes: number;
  /* Closed-app delivery, opted into separately. Being willing to be reminded
     while the app is open and being willing to hand a push endpoint to a server
     are two different decisions — the same split LeaderboardPrefs already makes
     between `enabled` and `notifications`. */
  push: boolean;
  /** "Coaching in 10 minutes", from the Plan timeline. Off by default. */
  planBlocks: boolean;
}

export interface AppState {
  currentClass: 11 | 12;
  examPreference?: ExamPreference;
  logs: DailyLog[];
  progress: ChapterProgress[];
  lastUsedTab: TabType;
  timer: TimerState;
  tasks: Task[];
  theme?: 'dark' | 'light';
  dailyGoalHours: number;
  lastUpdated: number; // Timestamp for sync resolution
  questionTracking: QuestionTrackingState;
  timerMode: TimerMode;
  pomodoroSettings: PomodoroSettings;
  pomodoro: PomodoroRuntime;
  leaderboard: LeaderboardPrefs;
  coach?: CoachState;
  rewards?: RewardsState;
  /* Keyed by Topic.id. Bounded by the number of authored topics, so it stays
     small inside the synced state blob. */
  topicMastery?: Record<string, TopicMastery>;
  /* Optional because it arrived after these users already had saved state.
     `normalizeSchedule` fills it on load. */
  schedule?: ScheduleState;
  /* Optional for the same reason `schedule` is — it arrived after these users
     already had saved state. `normalizeReminders` fills it on load. */
  reminders?: ReminderPrefs;
}
