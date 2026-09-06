import { DailyQuestionsLog, QuestionTrackingState, QSubject } from '../types';
import { getISTDateString, toStudyDayInstant } from '../utils';

// --- IST Week Boundaries (Monday = start, Sunday = end) ---

export const getISTWeekBounds = (): { start: string; end: string } => {
  const now = new Date();
  const istStr = toStudyDayInstant(now).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istNow = new Date(istStr);

  const day = istNow.getDay(); // 0=Sun, 1=Mon...
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(istNow);
  monday.setDate(istNow.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    start: formatDateStr(monday),
    end: formatDateStr(sunday),
  };
};

const formatDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// --- Filter logs to current week ---

export const getWeekLogs = (logs: DailyQuestionsLog[]): DailyQuestionsLog[] => {
  const { start, end } = getISTWeekBounds();
  return logs.filter(l => l.date >= start && l.date <= end);
};

// --- Weekly Progress (computed, not stored) ---

export const computeWeeklyProgress = (logs: DailyQuestionsLog[]): Record<string, number> & { totalCompleted: number } => {
  const weekLogs = getWeekLogs(logs);
  const progress: Record<string, number> & { totalCompleted: number } = { totalCompleted: 0 };
  ['physics', 'chemistry', 'math', 'biology'].forEach(s => {
    progress[s] = weekLogs.reduce((acc, l) => acc + (l.counts?.[s as QSubject] || 0), 0);
    progress.totalCompleted += progress[s];
  });
  return progress;
};

// --- Days left in week (IST, minimum 1) ---

export const getDaysLeftInWeek = (): number => {
  const now = new Date();
  const istStr = toStudyDayInstant(now).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istNow = new Date(istStr);
  const day = istNow.getDay(); // 0=Sun
  // Sun=1, Mon=7, Tue=6, Wed=5, Thu=4, Fri=3, Sat=2
  const left = day === 0 ? 1 : 7 - day + 1;
  return Math.max(1, left);
};

// --- Effective goal per subject (deterministic mixed-goal logic) ---

export type EffectiveGoals = Record<string, number | null> & {
  totalGoal: number | null;
  activeSubjects: QSubject[];
};

export const computeEffectiveGoals = (state: QuestionTrackingState, coreSubjects: QSubject[]): EffectiveGoals => {
  const { weeklyGoalTotal, weeklyGoalBySubject, weakSubject } = state;
  const hasTotal = weeklyGoalTotal !== null && weeklyGoalTotal > 0;

  const subjects: QSubject[] = coreSubjects;
  const hasAnySubject = subjects.some(s => (weeklyGoalBySubject as any)[s] !== null && (weeklyGoalBySubject as any)[s] > 0);

  const result: EffectiveGoals = { totalGoal: null, activeSubjects: [] } as any;
  subjects.forEach(s => result[s] = null);

  // Case: No goals at all
  if (!hasTotal && !hasAnySubject) {
    return result;
  }

  // Case: Subject-specific only (no total)
  if (!hasTotal && hasAnySubject) {
    subjects.forEach(s => {
      const g = (weeklyGoalBySubject as any)[s];
      if (g !== null && g > 0) {
        result[s] = g;
        result.activeSubjects.push(s);
      }
    });
    return result;
  }

  const core = coreSubjects;

  // Case: Total only (no subject goals)
  if (hasTotal && !hasAnySubject) {
    const dist = distributeAmongSubjects(weeklyGoalTotal!, core, weakSubject);
    core.forEach(s => result[s] = (dist as any)[s]);
    result.totalGoal = weeklyGoalTotal;
    result.activeSubjects = core;
    return result;
  }

  // Case: Mixed (total + some subject goals)
  let setSum = 0;
  const unsetSubjects: QSubject[] = [];
  core.forEach(s => {
    const g = (weeklyGoalBySubject as any)[s];
    if (g !== null && g > 0) {
      result[s] = g;
      setSum += g;
    } else {
      unsetSubjects.push(s);
    }
  });

  const remaining = Math.max(0, weeklyGoalTotal! - setSum);
  if (unsetSubjects.length > 0 && remaining > 0) {
    const perUnset = distributeAmongSubjects(remaining, unsetSubjects, weakSubject);
    unsetSubjects.forEach(s => result[s] = (perUnset as any)[s]);
  }

  result.totalGoal = weeklyGoalTotal;
  result.activeSubjects = core;
  return result;
};

// --- Distribute a total across 3 subjects with optional weak boost ---

const distributeAmongSubjects = (
  total: number,
  subjects: QSubject[],
  weakSubject: QSubject | null
): Record<string, number> => {
  const result: Record<string, number> = {};
  subjects.forEach(s => result[s] = 0);
  if (subjects.length === 0) return result;

  const weights: Record<string, number> = {};
  let sumWeights = 0;
  for (const s of subjects) {
    const w = (weakSubject && s === weakSubject) ? 1.4 : 1;
    weights[s] = w;
    sumWeights += w;
  }

  for (const s of subjects) {
    result[s] = Math.round((weights[s] / sumWeights) * total);
  }

  // Fix rounding
  let sumAssigned = 0;
  subjects.forEach(s => sumAssigned += result[s]);
  const diff = total - sumAssigned;
  if (diff !== 0 && subjects.length > 0) {
    result[subjects[0]] += diff;
  }

  return result;
};

// --- Weekly progress EXCLUDING today (for locked daily target) ---

export const computeWeeklyProgressBeforeToday = (logs: DailyQuestionsLog[]): Record<string, number> & { totalCompleted: number } => {
  const today = getISTDateString();
  const { start, end } = getISTWeekBounds();
  const weekLogsBeforeToday = logs.filter(l => l.date >= start && l.date <= end && l.date !== today);
  
  const progress: Record<string, number> & { totalCompleted: number } = { totalCompleted: 0 };
  ['physics', 'chemistry', 'math', 'biology'].forEach(s => {
    progress[s] = weekLogsBeforeToday.reduce((acc, l) => acc + (l.counts?.[s as QSubject] || 0), 0);
    progress.totalCompleted += progress[s];
  });
  return progress;
};

// --- Daily adaptive targets (LOCKED at start of day) ---

export type DailyTargets = Record<string, number | null> & { total: number };

export const computeDailyTargets = (state: QuestionTrackingState, coreSubjects: QSubject[]): DailyTargets => {
  const goals = computeEffectiveGoals(state, coreSubjects);
  // Use progress BEFORE today so target stays locked all day
  const progressBeforeToday = computeWeeklyProgressBeforeToday(state.dailyQuestionsLog);
  const daysLeft = getDaysLeftInWeek();

  const result: DailyTargets = { total: 0 };
  ['physics', 'chemistry', 'math', 'biology'].forEach(s => result[s] = null);

  if (goals.activeSubjects.length === 0) return result;

  const calcTarget = (goal: number | null, completed: number): number | null => {
    if (goal === null) return null;
    const remaining = Math.max(0, goal - completed);
    return Math.ceil(remaining / daysLeft);
  };

  goals.activeSubjects.forEach(s => {
    const t = calcTarget(goals[s], progressBeforeToday[s]);
    result[s] = t;
    if (t) result.total += t;
  });

  return result;
};

// --- Today's progress ---

export type TodayProgress = Record<string, number> & { total: number };

export const getTodayProgress = (logs: DailyQuestionsLog[]): TodayProgress => {
  const log = getTodayLog(logs);
  const result: TodayProgress = { total: 0 };
  ['physics', 'chemistry', 'math', 'biology'].forEach(s => result[s] = 0);
  
  if (!log || !log.counts) return result;
  
  Object.keys(log.counts).forEach(s => {
    result[s] = log.counts[s as QSubject] || 0;
    result.total += result[s];
  });
  
  return result;
};

// --- Adaptive feedback ---

export type PaceStatus = 'behind' | 'ahead' | 'on_track';

export interface AdaptiveFeedback {
  status: PaceStatus;
  message: string;
  dailyTarget: number;
}

export const computeFeedback = (state: QuestionTrackingState, coreSubjects: QSubject[]): AdaptiveFeedback | null => {
  const goals = computeEffectiveGoals(state, coreSubjects);
  if (goals.activeSubjects.length === 0) return null;

  const totalGoal = goals.totalGoal ||
    goals.activeSubjects.reduce((sum, s) => sum + (goals[s] || 0), 0);
  if (totalGoal <= 0) return null;

  const progress = computeWeeklyProgress(state.dailyQuestionsLog);
  const { start } = getISTWeekBounds();
  const today = getISTDateString();

  const startDate = new Date(start + 'T00:00:00');
  const todayDate = new Date(today + 'T00:00:00');
  const daysElapsed = Math.max(1, Math.floor((todayDate.getTime() - startDate.getTime()) / 86400000) + 1);

  const expectedByNow = Math.round((totalGoal / 7) * daysElapsed);
  const dailyTarget = computeDailyTargets(state, coreSubjects).total;

  const diff = progress.totalCompleted - expectedByNow;
  const tolerance = Math.max(5, Math.round(totalGoal * 0.03));

  if (diff < -tolerance) {
    return { status: 'behind', message: `You're behind pace. Target adjusted to ${dailyTarget} today.`, dailyTarget };
  }
  if (diff > tolerance) {
    return { status: 'ahead', message: `You're ahead. Target reduced to ${dailyTarget} today.`, dailyTarget };
  }
  return { status: 'on_track', message: `You're on track. Keep going.`, dailyTarget };
};

// --- Today's log helpers ---

export const getTodayLog = (logs: DailyQuestionsLog[]): DailyQuestionsLog | null => {
  const today = getISTDateString();
  return logs.find(l => l.date === today) || null;
};

export const getTodayTotal = (logs: DailyQuestionsLog[]): number => {
  const log = getTodayLog(logs);
  if (!log || !log.counts) return 0;
  return Object.values(log.counts).reduce((acc, c) => acc + (c || 0), 0);
};

// --- Check if goal started mid-week ---

export const isGoalMidWeek = (goalStartDate: string | null): boolean => {
  if (!goalStartDate) return false;
  const { start } = getISTWeekBounds();
  return goalStartDate > start;
};

// --- High target warning threshold ---

export const HIGH_TARGET_THRESHOLD = 200;

// --- Weekly analytics helpers (for Review tab) ---

export const getWeeklyQuestionTotals = (
  logs: DailyQuestionsLog[],
  weeksBack: number = 4
): { label: string; total: number }[] => {
  const result: { label: string; total: number }[] = [];
  const now = new Date();
  const istStr = toStudyDayInstant(now).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istNow = new Date(istStr);

  for (let w = weeksBack - 1; w >= 0; w--) {
    const ref = new Date(istNow);
    ref.setDate(ref.getDate() - w * 7);

    const day = ref.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(ref);
    mon.setDate(ref.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);

    const startStr = formatDateStr(mon);
    const endStr = formatDateStr(sun);

    const weekLogs = logs.filter(l => l.date >= startStr && l.date <= endStr);
    const total = weekLogs.reduce((s, l) => s + (l.counts ? Object.values(l.counts).reduce((acc, c) => acc + (c || 0), 0) : 0), 0);

    result.push({ label: `Week ${weeksBack - w}`, total });
  }

  return result;
};
