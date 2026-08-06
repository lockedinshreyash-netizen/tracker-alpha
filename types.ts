
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
}

export type TabType = 'Today' | 'Syllabus' | 'Streak' | 'Questions' | 'Ranks' | 'Review';

/** Opt-in, per account. Nothing is published until `enabled` is true. */
export interface LeaderboardPrefs {
  enabled: boolean;
  displayName: string;
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
}
