
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

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  subject?: Subject;
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

export type BlockKind = 'study' | 'revision' | 'test' | 'break' | 'fixed';

/**
 * A planned block that exists on one date only.
 *
 * Instances of a weekly rule are NOT stored here — they are derived from
 * `TemplateRule` at render time. See `materializeDay`.
 */
export interface ScheduleBlock {
  id: string;
  date: string; // YYYY-MM-DD (IST study day)
  subject: Subject;
  chapter?: string;
  start: DayMinute;
  durationMins: number;
  kind: BlockKind;
  label?: string;
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
  subject: Subject;
  chapter?: string;
  start: DayMinute;
  durationMins: number;
  kind: BlockKind;
  label?: string;
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
}
