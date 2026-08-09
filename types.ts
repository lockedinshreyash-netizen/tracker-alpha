
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

export type TabType = 'Today' | 'Syllabus' | 'Streak' | 'Questions' | 'Ranks' | 'Review';

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
}

export type TimerMode = 'stopwatch' | 'pomodoro';

export type PomodoroPhase = 'work' | 'short_break' | 'long_break';

export interface PomodoroSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  blocksBeforeLongBreak: number;
  autoStartNext: boolean;
}

export interface PomodoroRuntime {
  phase: PomodoroPhase;
  /* Absolute epoch ms, never a decrementing counter — background tabs throttle
     timers, so remaining time must always be derived from the clock. */
  phaseEndsAt: number | null;
  isRunning: boolean;
  completedBlocks: number; // within the current set; resets after a long break
  subject: Subject;
  /* A finished work block awaiting its quality rating. Persisted so a reload
     or a closed tab can't silently lose logged study time. */
  pendingBlock: { subject: Subject; hours: number } | null;
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
}
