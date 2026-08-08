import { AppState, CoachState, LeaderboardPrefs, PomodoroRuntime, PomodoroSettings } from './types';

export const DEFAULT_COACH: CoachState = {
  dismissed: [],
  dismissedOn: null,
  served: {},
};

/* Off until the user explicitly joins — nothing about their study is visible to
   anyone else before that. */
export const DEFAULT_LEADERBOARD: LeaderboardPrefs = {
  enabled: false,
  displayName: '',
  notifications: false,
};

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
  timer: { isRunning: false, startTime: null, accumulatedMs: 0, subject: 'Physics' },
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
  leaderboard: DEFAULT_LEADERBOARD,
  coach: DEFAULT_COACH,
};
