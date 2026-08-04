import { AppState, PomodoroRuntime, PomodoroSettings } from './types';

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  blocksBeforeLongBreak: 4,
  // A break you have to start is a break you actually notice.
  autoStartNext: false,
};

export const IDLE_POMODORO: PomodoroRuntime = {
  phase: 'work',
  phaseEndsAt: null,
  isRunning: false,
  completedBlocks: 0,
  subject: 'Physics',
  pendingBlock: null,
};

export const DEFAULT_STATE: AppState = {
  currentClass: 11,
  examPreference: 'JEE',
  logs: [],
  progress: [],
  lastUsedTab: 'Today',
  timer: { isRunning: false, startTime: null, accumulatedMs: 0, subject: 'Physics', isLockInActive: false, distractions: 0 },
  isLockInModeEnabled: false,
  tasks: [],
  theme: 'light',
  dailyGoalHours: 8,
  lastUpdated: 0,
  questionTracking: {
    weeklyGoalTotal: null,
    weeklyGoalBySubject: {},
    dailyQuestionsLog: [],
    weakSubject: null,
    goalStartDate: null,
  },
  timerMode: 'stopwatch',
  pomodoroSettings: DEFAULT_POMODORO_SETTINGS,
  pomodoro: IDLE_POMODORO,
};
