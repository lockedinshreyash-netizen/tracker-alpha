
export type Subject = 'Physics' | 'Chemistry' | 'Maths';

export type SyllabusStatus = 'not_started' | 'in_progress' | 'completed' | 'revision_pending';

export type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export interface DailyLog {
  id: string;
  date: string; // YYYY-MM-DD (IST)
  subject: Subject;
  hours: number;
  quality: number; // 1-5
  distractions: number; // Count of tab switches/blur events
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  subject?: Subject | 'General';
}

export interface ChapterProgress {
  classId: 11 | 12;
  subject: Subject;
  chapter: string;
  status: SyllabusStatus;
  notes?: string;
}

export type TabType = 'Today' | 'Syllabus' | 'Streak' | 'Review';

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
}