
import { DailyLog, Subject } from './types';
import { ledgerFromDates, type StreakLedger } from './streak/firewood';
import { SYLLABUS_DATA } from './constants';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

/**
 * The hour (IST) at which one study day becomes the next.
 *
 * Not midnight. Someone still working at 01:30 is finishing the day they
 * started, not beginning a new one, and rolling over mid-session would split
 * their hours across two days and break a streak they were actively earning.
 *
 * Everything that decides "which day is this moment part of" must go through
 * here — logs, streaks, the leaderboard date, race days, question goals.
 * Anything that formats a wall-clock time for display must NOT.
 */
export const DAY_START_HOUR = 4;

/**
 * The instant re-based so that the study day lines up with the calendar day.
 *
 * Shifting back by DAY_START_HOUR means 03:59 IST still reads as the previous
 * date and 04:00 begins the new one. Callers can then use ordinary date maths
 * on the result and get study-day answers.
 */
export const toStudyDayInstant = (date: Date = new Date()): Date =>
  new Date(date.getTime() - DAY_START_HOUR * 3_600_000);

export const getISTDateString = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(toStudyDayInstant(date));
};

export const getDaysRemaining = (target: Date): number => {
  const now = new Date();

  // Create IST date objects for both target and current time
  const istNowStr = toStudyDayInstant(now).toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istTargetStr = target.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });

  const start = new Date(istNowStr);
  start.setHours(0, 0, 0, 0);

  const end = new Date(istTargetStr);
  end.setHours(0, 0, 0, 0);

  // Calculate difference in whole days
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
};

/* ── Streaks ──
   Every streak number in the app comes from one replay of the history
   (streak/firewood.ts): days studied in a row, held through missed days by
   firewood while the bank lasts. Cached per log array and day, because App
   re-renders ten times a second while a session runs and reads the streak on
   every render. */
const ledgerCache = new WeakMap<DailyLog[], Map<string, StreakLedger>>();

/**
 * The live streak, the longest it has stood, and the firewood bank.
 * `verified` replays only days the app timed itself (see
 * `calculateVerifiedStreak`), with its own bank earned in timed weeks.
 */
export const streakLedger = (logs: DailyLog[], opts: { verified?: boolean; today?: string } = {}): StreakLedger => {
  const today = opts.today ?? getISTDateString();
  const key = `${opts.verified ? 'v' : 'a'}|${today}`;
  let byKey = ledgerCache.get(logs);
  const hit = byKey?.get(key);
  if (hit) return hit;
  const source = opts.verified ? logs.filter(isVerifiedLog) : logs;
  const ledger = ledgerFromDates(source.map(l => l.date), today);
  if (!byKey) { byKey = new Map(); ledgerCache.set(logs, byKey); }
  byKey.set(key, ledger);
  return ledger;
};

/** Days studied in a row. A missed day burns firewood instead of ending it. */
export const calculateStreak = (logs: DailyLog[]): number => streakLedger(logs).streak;

/** A log the app measured itself, rather than one typed in after the fact. */
export const isVerifiedLog = (log: DailyLog): boolean =>
  log.source === 'timer' || log.source === 'pomodoro';

/**
 * The streak counting only days the app actually watched happen.
 *
 * Same rule as `calculateStreak`, over a smaller set of days. Manual logs keep
 * the visible streak alive but cannot buy a reward that costs real money —
 * a backfill loop would otherwise mint a year of study in a minute. This is
 * the same stance the leaderboard already takes on `LogSource`.
 */
export const calculateVerifiedStreak = (logs: DailyLog[]): number =>
  streakLedger(logs, { verified: true }).streak;

/* Study-day strings are plain calendar dates, so stepping between them is
   exact UTC arithmetic — no timezone, no DST, no clock in it at all. */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const dateValue = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** A study-day string stepped by whole days. Exact, for the same reason. */
export const addDays = (date: string, days: number): string =>
  new Date(dateValue(date) + days * 86_400_000).toISOString().slice(0, 10);

/** 0=Sun … 6=Sat for a study-day string, with no timezone in the answer. */
export const weekdayOf = (date: string): number =>
  new Date(dateValue(date)).getUTCDay();

/* India is a fixed +05:30 with no DST, so a wall-clock moment converts to an
   instant by arithmetic — there is no ambiguous or skipped hour to resolve, and
   no need for a timezone round-trip. */
export const IST_OFFSET_MS = 330 * 60_000;

/**
 * The epoch instant of a wall-clock moment on a given study day, in IST.
 *
 * Deliberately NOT the device's local zone. A student on a trip, or a phone
 * whose clock is set to the wrong region, must not get their 09:00 reminder at
 * 03:30 — every date in this app already means an Indian date, and this keeps
 * the times inside those dates honest too.
 *
 * `minute` is on the study-day axis, so 0 is 04:00, 1200 is midnight, and 1439
 * is 03:59 the following calendar morning while still belonging to this study
 * day. See DayMinute.
 */
export const istInstant = (date: string, minute: number): number =>
  dateValue(date) + (DAY_START_HOUR * 60 + minute) * 60_000 - IST_OFFSET_MS;

/**
 * The highest the streak has ever stood, anywhere in the history.
 *
 * `calculateStreak` only sees the run alive today, which is the wrong thing to
 * earn a reward with: a month-long run that ended in March is a month the
 * student actually did. Rewards are receipts for days survived, so they come
 * from the whole history. Firewood holds a run through missed days but never
 * adds to it, so this is still a count of days studied.
 *
 * Dates in the future are ignored — a device with a wrong clock must not be
 * able to write itself a streak.
 */
export const longestStreak = (logs: DailyLog[], today?: string): number =>
  streakLedger(logs, { today }).longest;

/** Same, over days the app timed itself. See `calculateVerifiedStreak`. */
export const longestVerifiedStreak = (logs: DailyLog[], today?: string): number =>
  streakLedger(logs, { verified: true, today }).longest;

export const getLast7DaysStats = (
  logs: DailyLog[],
  activeSubjects: Subject[]
): { date: string; hours: number }[] => {
  const stats: { date: string; hours: number }[] = [];

  // Build last 7 IST date STRINGS only
  const dates: string[] = [];
  let base = new Date();

  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    dates.push(getISTDateString(d));
  }

  for (const dateStr of dates) {
    const totalHours = logs
      .filter(l => l.date === dateStr && activeSubjects.includes(l.subject))
      .reduce((sum, l) => sum + l.hours, 0);

    stats.push({
      date: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(
        new Date(dateStr + "T12:00:00")
      ),
      hours: Number(totalHours.toFixed(1))
    });
  }

  return stats;
};
export const getSubjectDistribution = (logs: DailyLog[], activeSubjects: Subject[]): Partial<Record<Subject, number>> => {
  const dist: Partial<Record<Subject, number>> = {};
  activeSubjects.forEach(s => dist[s] = 0);
  
  const today = getISTDateString();
  logs.filter(l => l.date === today && activeSubjects.includes(l.subject)).forEach(l => {
    dist[l.subject] = (dist[l.subject] || 0) + l.hours;
  });
  return dist;
};

export const calculateLockInScore = (
  logs: DailyLog[],
  currentClass: 11 | 12,
  progress: any[],
  activeSubjects: Subject[]
): number => {
  const now = new Date();
  const datesLast30: string[] = [];
  for (let i = 0; i < 30; i++) {
    datesLast30.push(getISTDateString(new Date(now.getTime() - i * 86400000)));
  }

  const logsLast30 = logs.filter(l => datesLast30.includes(l.date) && activeSubjects.includes(l.subject));

  // 1. Consistency (30%) - Based on frequency of logs
  const loggedDaysLast30 = new Set(logsLast30.map(l => l.date)).size;
  const consistencyScore = (loggedDaysLast30 / 30) * 100;

  // 2. Volume (30%) - Target 10 hours per day avg
  const totalHoursLast30 = logsLast30.reduce((acc, l) => acc + l.hours, 0);
  const avgHoursLast30 = totalHoursLast30 / (loggedDaysLast30 || 1);
  const hoursScore = Math.min((avgHoursLast30 / 10) * 100, 100);

  // 3. Syllabus Progress (10%)
  const classProgress = progress.filter(p => p.classId === currentClass && activeSubjects.includes(p.subject) && p.status === 'completed').length;
  const totalChapters = activeSubjects
    .filter((s): s is 'Physics' | 'Chemistry' | 'Maths' | 'Biology' => s !== 'General')
    .reduce((sum, s) => sum + (SYLLABUS_DATA[currentClass][s]?.length || 0), 0);
  const progressScore = totalChapters > 0 ? Math.min((classProgress / totalChapters) * 100, 100) : 0;

  // 4. Quality (30%)
  const avgQuality = logsLast30.length > 0
    ? logsLast30.reduce((acc, l) => acc + l.quality, 0) / logsLast30.length
    : 0;
  const qualityScore = (avgQuality / 5) * 100;

  // Composite Base Score
  const baseScore = (consistencyScore * 0.30) + (hoursScore * 0.30) + (progressScore * 0.10) + (qualityScore * 0.30);

  // 5. PENALTY: Distractions / Breaches
  const totalDistractions = logsLast30.reduce((acc, l) => acc + (l.distractions || 0), 0);
  const penalty = totalDistractions * 2;

  const finalScore = Math.max(0, Math.round(baseScore - penalty));
  return finalScore;
};
