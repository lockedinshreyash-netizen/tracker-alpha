import { AppState } from './types';

/* An OAuth sign-in redirects the whole page away, so the AuthModal's
   onAuthSuccess(examPref) callback never survives to run. The chosen exam
   target is parked here instead, and applied on return — but only when the
   account turns out to have no existing cloud profile. */
export const PENDING_EXAM_PREF_KEY = 'lockin_pending_exam_pref';

export const DEFAULT_STATE: AppState = {
  currentClass: 11,
  examPreference: 'JEE',
  logs: [],
  progress: [],
  lastUsedTab: 'Today',
  timer: { isRunning: false, startTime: null, accumulatedMs: 0, subject: 'Physics', isLockInActive: false, distractions: 0 },
  isLockInModeEnabled: false,
  allowList: [],
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
  }
};
