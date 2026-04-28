
export type Subject = 'Physics' | 'Chemistry' | 'Maths' | 'General';

export type SyllabusStatus = 'not_started' | 'in_progress' | 'completed' | 'revision_pending';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export type QSubject = 'physics' | 'chemistry' | 'math';

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
  physicsCount: number;
  chemistryCount: number;
  mathCount: number;
}

export interface WeeklyGoalBySubject {
  physicsGoal: number | null;
  chemistryGoal: number | null;
  mathGoal: number | null;
}

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
