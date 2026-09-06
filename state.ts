import { AppState, CoachState, LeaderboardPrefs, PomodoroRuntime, PomodoroSettings, RewardsState, Subject } from './types';

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
  // Both off until asked for: one needs a browser permission, the other
  // silently keeps a phone's screen lit.
  notify: false,
  keepAwake: false,
};

export const IDLE_POMODORO: PomodoroRuntime = {
  phase: 'work',
  phaseEndsAt: null,
  isRunning: false,
  phaseTotalMs: null,
  servedMs: 0,
  completedBlocks: 0,
  subject: 'Physics',
  pendingRating: [],
};

const SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Maths', 'Biology', 'General'];

/**
 * Whatever was persisted, made safe to run the engine against.
 *
 * The runtime is device-local (every sync path keeps the local copy), so this
 * only ever sees this device's own localStorage — but that can be an older
 * shape, a half-written object, or a `phaseEndsAt` from a session that ended
 * when the tab was closed. Anything nonsensical falls back to idle rather than
 * being trusted: a corrupt runtime must not be able to fabricate study time.
 */
export const normalizePomodoro = (raw: unknown): PomodoroRuntime => {
  const p = { ...IDLE_POMODORO, ...(raw && typeof raw === 'object' ? raw as Partial<PomodoroRuntime> : {}) };

  const phase = p.phase === 'short_break' || p.phase === 'long_break' || p.phase === 'work' ? p.phase : 'work';
  const subject = SUBJECTS.includes(p.subject) ? p.subject : 'Physics';
  const completedBlocks = Number.isFinite(p.completedBlocks) ? Math.max(0, Math.floor(p.completedBlocks)) : 0;

  const pendingRating = Array.isArray(p.pendingRating)
    ? p.pendingRating.filter(r => r && typeof r.logId === 'string' && Number.isFinite(r.hours))
    : [];

  /* A phase is only still armed if its bookkeeping is intact. `phaseTotalMs`
     is what the old shape lacks entirely, so pre-migration state simply lands
     idle — the block it was mid-way through is unrecoverable either way, since
     nothing recorded how long it had run. */
  const total = Number.isFinite(p.phaseTotalMs) && (p.phaseTotalMs as number) > 0 ? p.phaseTotalMs as number : null;
  if (total === null) {
    return { phase, phaseEndsAt: null, isRunning: false, phaseTotalMs: null, servedMs: 0, completedBlocks, subject, pendingRating, pendingBlock: p.pendingBlock ?? null };
  }

  const served = Number.isFinite(p.servedMs) ? Math.min(total, Math.max(0, p.servedMs)) : 0;
  const running = p.isRunning === true && Number.isFinite(p.phaseEndsAt);

  return {
    phase,
    isRunning: running,
    phaseEndsAt: running ? p.phaseEndsAt as number : null,
    phaseTotalMs: total,
    servedMs: served,
    completedBlocks,
    subject,
    pendingRating,
    pendingBlock: p.pendingBlock ?? null,
  };
};

/* Nothing earned yet. Note `wallpaper: null` rather than a default design —
   the plain background is what an unearned account looks like. */
export const DEFAULT_REWARDS: RewardsState = {
  unlocked: {},
  acknowledged: [],
  wallpaper: null,
  bestStreak: 0,
  bestVerifiedStreak: 0,
  bookChapter: 0,
  hamperClaimedOn: null,
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
  rewards: DEFAULT_REWARDS,
};
