
export type Subject = 'Physics' | 'Chemistry' | 'Maths' | 'Biology' | 'General';

export type ExamPreference = 'JEE' | 'NEET';

export type SyllabusStatus = 'not_started' | 'in_progress' | 'completed' | 'revision_pending';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export type QSubject = 'physics' | 'chemistry' | 'math' | 'biology';

export interface DailyLog {
  id: string;
  date: string; // YYYY-MM-DD (IST)
  subject: Subject;
  hours: number;
  quality: number; // 1-5
  distractions: number; // Count of tab switches/blur events
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

export type TabType = 'Today' | 'Syllabus' | 'Streak' | 'Questions' | 'Review';

export interface TimerState {
  isRunning: boolean;
  startTime: number | null;
  accumulatedMs: number;
  subject: Subject;
  isLockInActive: boolean;
  distractions: number;
}

export interface AppState {
  currentClass: 11 | 12;
  examPreference?: ExamPreference;
  logs: DailyLog[];
  progress: ChapterProgress[];
  lastUsedTab: TabType;
  timer: TimerState;
  isLockInModeEnabled: boolean;
  allowList: string[];
  tasks: Task[];
  theme?: 'dark' | 'light';
  dailyGoalHours: number;
  lastUpdated: number; // Timestamp for sync resolution
  questionTracking: QuestionTrackingState;
}
