import { AppState, BlockKind, BlockOverride, CoachState, LeaderboardPrefs, PomodoroRuntime, PomodoroSettings, RewardsState, ScheduleBlock, ScheduleState, Subject, TemplateRule } from './types';

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

/* An empty plan, not a suggested one. A timetable somebody else wrote is the
   thing students abandon in week two. */
export const DEFAULT_SCHEDULE: ScheduleState = { blocks: [], rules: [], overrides: [] };

const BLOCK_KINDS: BlockKind[] = ['study', 'revision', 'test', 'break', 'fixed'];
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

const asMinute = (v: unknown, fallback: number): number =>
  Number.isFinite(v as number) ? Math.min(1439, Math.max(0, Math.floor(v as number))) : fallback;

const asDuration = (v: unknown): number =>
  Number.isFinite(v as number) ? Math.min(1440, Math.max(10, Math.floor(v as number))) : 60;

const asSubject = (v: unknown): Subject =>
  SUBJECTS.includes(v as Subject) ? (v as Subject) : 'General';

const asKind = (v: unknown): BlockKind =>
  BLOCK_KINDS.includes(v as BlockKind) ? (v as BlockKind) : 'study';

const asDate = (v: unknown): string | null =>
  typeof v === 'string' && DATE_SHAPE.test(v) ? v : null;

const asText = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.slice(0, 120) : undefined;

/**
 * Whatever was persisted, made safe to render a day from.
 *
 * Same stance as normalizePomodoro: validate every field rather than trusting
 * the shape, and drop the row outright when its identity is unusable. A block
 * with no date or no id cannot be drawn, moved or deleted — keeping it would
 * only put something on the grid the user has no way to get rid of.
 */
export const normalizeSchedule = (raw: unknown): ScheduleState => {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<ScheduleState>;

  const blocks: ScheduleBlock[] = (Array.isArray(src.blocks) ? src.blocks : [])
    .filter(b => b && typeof b.id === 'string' && asDate(b.date))
    .map(b => ({
      id: b.id,
      date: asDate(b.date)!,
      subject: asSubject(b.subject),
      chapter: asText(b.chapter),
      start: asMinute(b.start, 0),
      durationMins: asDuration(b.durationMins),
      kind: asKind(b.kind),
      label: asText(b.label),
    }));

  const rules: TemplateRule[] = (Array.isArray(src.rules) ? src.rules : [])
    .filter(r => r && typeof r.id === 'string' && asDate(r.from))
    .map(r => ({
      id: r.id,
      days: (Array.isArray(r.days) ? r.days : [])
        .filter(d => Number.isInteger(d) && d >= 0 && d <= 6)
        .filter((d, i, a) => a.indexOf(d) === i)
        .sort((a, b) => a - b),
      subject: asSubject(r.subject),
      chapter: asText(r.chapter),
      start: asMinute(r.start, 0),
      durationMins: asDuration(r.durationMins),
      kind: asKind(r.kind),
      label: asText(r.label),
      from: asDate(r.from)!,
      until: asDate(r.until),
    }))
    /* A rule with no days can never materialize and can never be seen to be
       deleted — it would just sit in the blob forever. */
    .filter(r => r.days.length > 0);

  const ruleIds = new Set(rules.map(r => r.id));

  const overrides: BlockOverride[] = (Array.isArray(src.overrides) ? src.overrides : [])
    .filter(o => o && typeof o.id === 'string' && typeof o.ruleId === 'string' && asDate(o.date))
    /* An override whose rule is gone describes an instance that no longer
       exists. Dropping it is the only way this array stays bounded. */
    .filter(o => ruleIds.has(o.ruleId))
    .map(o => ({
      id: o.id,
      ruleId: o.ruleId,
      date: asDate(o.date)!,
      skipped: o.skipped === true ? true : undefined,
      start: o.start === undefined ? undefined : asMinute(o.start, 0),
      durationMins: o.durationMins === undefined ? undefined : asDuration(o.durationMins),
      subject: o.subject === undefined ? undefined : asSubject(o.subject),
      chapter: asText(o.chapter),
    }));

  return { blocks, rules, overrides };
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
  schedule: DEFAULT_SCHEDULE,
};
