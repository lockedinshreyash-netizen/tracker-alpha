import { AppState, BlockKind, BlockOverride, CoachState, LeaderboardPrefs, PomodoroRuntime, PomodoroSettings, ReminderPrefs, RewardsState, ScheduleBlock, ScheduleState, Subject, Task, TaskColumn, TemplateRule } from './types';
import { HEX_RE, RECOLOURABLE } from './schedule/colors';

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
export const DEFAULT_SCHEDULE: ScheduleState = { blocks: [], rules: [], overrides: [], colors: {} };

const BLOCK_KINDS: BlockKind[] = ['study', 'revision', 'test', 'class', 'sleep', 'meal', 'gym', 'break', 'travel', 'other'];
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

const asMinute = (v: unknown, fallback: number): number =>
  Number.isFinite(v as number) ? Math.min(1439, Math.max(0, Math.floor(v as number))) : fallback;

const asDuration = (v: unknown): number =>
  Number.isFinite(v as number) ? Math.min(1440, Math.max(10, Math.floor(v as number))) : 60;

const asSubject = (v: unknown): Subject | undefined =>
  SUBJECTS.includes(v as Subject) ? (v as Subject) : undefined;

const asKind = (v: unknown): BlockKind =>
  BLOCK_KINDS.includes(v as BlockKind) ? (v as BlockKind) : 'study';

const asDate = (v: unknown): string | null =>
  typeof v === 'string' && DATE_SHAPE.test(v) ? v : null;

/* A colour off the wire ends up in an inline `style`, so it is checked against
   the exact shape rather than trusted — `#rrggbb` and nothing else. */
const asHex = (v: unknown): string | null =>
  typeof v === 'string' && HEX_RE.test(v) ? v.toLowerCase() : null;

const asText = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.slice(0, 120) : undefined;

/* ── Reminders ──
   Everything off. The app does not start speaking because it was installed;
   see the rule at the top of notify/channels.ts.

   09:00 as the default hour (300 minutes past the 04:00 study-day start): a
   deadline that lands in the morning leaves the whole day to act on it, which
   is the entire point of putting a date on something. */
export const DEFAULT_REMINDERS: ReminderPrefs = {
  enabled: false,
  defaultMinute: 300,
  leadMinutes: 0,
  push: false,
  planBlocks: false,
};

export const normalizeReminders = (raw: unknown): ReminderPrefs => {
  const r = { ...DEFAULT_REMINDERS, ...(raw && typeof raw === 'object' ? raw as Partial<ReminderPrefs> : {}) };
  return {
    enabled: r.enabled === true,
    defaultMinute: asMinute(r.defaultMinute, DEFAULT_REMINDERS.defaultMinute),
    /* A week of lead time on a deadline is not a reminder, it is a second
       deadline. Clamped rather than rejected so a bad value degrades to "on the
       day" instead of dropping the whole preference. */
    leadMinutes: Number.isFinite(r.leadMinutes)
      ? Math.min(3 * 1440, Math.max(0, Math.floor(r.leadMinutes)))
      : 0,
    push: r.push === true,
    planBlocks: r.planBlocks === true,
  };
};

const TASK_COLUMNS: TaskColumn[] = ['todo', 'doing', 'done'];

/**
 * Whatever was persisted, made safe to render a board from.
 *
 * There was no task normalizer before the board — tasks only ever got `[]` from
 * DEFAULT_STATE and were otherwise trusted. The board cannot do that: it reads
 * `column` to decide where a card goes and `order` to decide where in the
 * column, and every task saved before this feature has neither.
 *
 * The important job is reconciling `completed` and `column`, which carry the
 * same truth and can disagree. They disagree in two real situations, not one:
 * an old task that has never had a column, and a row that came back from a sync
 * merge with a device still running the previous build. `completed` wins both
 * times — it is the field share/stats.ts, the voice grammar and every earlier
 * version of the app have always written.
 */
export const normalizeTasks = (raw: unknown): Task[] => {
  const list = Array.isArray(raw) ? raw : [];

  const cleaned = list
    .filter((t): t is Task => !!t && typeof t === 'object' && typeof (t as Task).id === 'string' && typeof (t as Task).text === 'string')
    .map(t => {
      const completed = t.completed === true;
      const stored = TASK_COLUMNS.includes(t.column as TaskColumn) ? t.column as TaskColumn : undefined;
      /* Done and not-done are decided by `completed`. Only the choice between
         todo and doing is the column's to make, because `completed` cannot
         express it. */
      const column: TaskColumn = completed ? 'done' : stored === 'doing' ? 'doing' : 'todo';

      return {
        id: t.id,
        text: t.text.slice(0, 500),
        completed,
        subject: asSubject(t.subject),
        completedAt: asDate(t.completedAt) ?? undefined,
        column,
        order: Number.isFinite(t.order) ? Math.floor(t.order as number) : undefined,
        color: asHex(t.color) ?? undefined,
        dueAt: asDate(t.dueAt) ?? undefined,
        dueMinute: Number.isFinite(t.dueMinute) ? asMinute(t.dueMinute, 0) : undefined,
        remindedKey: typeof t.remindedKey === 'string' ? t.remindedKey.slice(0, 120) : undefined,
      } satisfies Task;
    });

  /* Backfill `order` per column by the position the task already had in the
     array, so a list that predates the board opens in the order it was written
     rather than in an arbitrary one. Only tasks that have no order at all are
     touched; a partially-ordered column keeps the positions it knows. */
  const next: Record<TaskColumn, number> = { todo: 0, doing: 0, done: 0 };
  for (const t of cleaned) {
    if (t.order === undefined) t.order = next[t.column!];
    next[t.column!] = Math.max(next[t.column!], t.order) + 1;
  }

  return cleaned;
};

/**
 * Whatever was persisted, made safe to render a day from.
 *
 * Same stance as normalizePomodoro: validate every field rather than trusting
 * the shape, and drop the row outright when its identity is unusable. A block
 * with no date or no id cannot be drawn, moved or deleted — keeping it would
 * only put something on the grid the user has no way to get rid of.
 */
export const normalizeSchedule = (raw: unknown, knownTaskIds?: Set<string>): ScheduleState => {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<ScheduleState>;

  /* A `taskId` pointing at a task that no longer exists would render a block
     with a title nothing can supply. Dropped when the caller knows the task
     list — the same stance overrides take when their rule is gone, and what
     keeps these references bounded rather than accumulating forever.

     Omitting the set means "I cannot check", which keeps the id rather than
     silently severing every link: a normalizer that cannot see the tasks must
     not conclude there are none. */
  const asTaskId = (v: unknown): string | undefined => {
    if (typeof v !== 'string' || !v) return undefined;
    if (knownTaskIds && !knownTaskIds.has(v)) return undefined;
    return v;
  };

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
      taskId: asTaskId(b.taskId),
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
      taskId: asTaskId(r.taskId),
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
      subject: asSubject(o.subject),
      chapter: asText(o.chapter),
    }));

  /* Only the kinds whose colour the user actually owns. A stored colour for a
     study kind would be dead weight at best and, if anything ever read it,
     would break the one guarantee subject colours make. */
  const colors: Partial<Record<BlockKind, string>> = {};
  const rawColors = (src.colors && typeof src.colors === 'object' ? src.colors : {}) as Record<string, unknown>;
  for (const kind of RECOLOURABLE) {
    const hex = asHex(rawColors[kind]);
    if (hex) colors[kind] = hex;
  }

  return { blocks, rules, overrides, colors };
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
  reminders: DEFAULT_REMINDERS,
};
