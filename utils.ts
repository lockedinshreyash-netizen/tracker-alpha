
import { DailyLog, Subject } from './types';
import { SYLLABUS_DATA } from './constants';

export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

export const getISTDateString = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

export const getDaysRemaining = (target: Date): number => {
  const now = new Date();

  // Create IST date objects for both target and current time
  const istNowStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
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

const streakFromDates = (loggedDates: Set<string>): number => {
  if (loggedDates.size === 0) return 0;

  const today = getISTDateString();
  const yesterday = getISTDateString(new Date(Date.now() - 86400000));

  if (!loggedDates.has(today) && !loggedDates.has(yesterday)) {
    return 0;
  }

  let streak = 0;
  let currentDate = loggedDates.has(today) ? new Date(today) : new Date(yesterday);

  while (true) {
    const checkDateStr = getISTDateString(currentDate);
    if (loggedDates.has(checkDateStr)) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
};

export const calculateStreak = (logs: DailyLog[]): number =>
  streakFromDates(new Set(logs.map(l => l.date)));

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
  streakFromDates(new Set(logs.filter(isVerifiedLog).map(l => l.date)));

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
