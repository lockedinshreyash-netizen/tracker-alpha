import { DailyQuestionsLog, QuestionTrackingState, QSubject } from '../types';
import { getISTDateString } from '../utils';

// --- IST Week Boundaries (Monday = start, Sunday = end) ---

export const getISTWeekBounds = (): { start: string; end: string } => {
  const now = new Date();
  const istStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
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

export interface WeeklyProgress {
  physicsCompleted: number;
  chemistryCompleted: number;
  mathCompleted: number;
  totalCompleted: number;
}

export const computeWeeklyProgress = (logs: DailyQuestionsLog[]): WeeklyProgress => {
  const weekLogs = getWeekLogs(logs);
  const p = weekLogs.reduce((s, l) => s + l.physicsCount, 0);
  const c = weekLogs.reduce((s, l) => s + l.chemistryCount, 0);
  const m = weekLogs.reduce((s, l) => s + l.mathCount, 0);
  return { physicsCompleted: p, chemistryCompleted: c, mathCompleted: m, totalCompleted: p + c + m };
};

// --- Days left in week (IST, minimum 1) ---

export const getDaysLeftInWeek = (): number => {
  const now = new Date();
  const istStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
  const istNow = new Date(istStr);
  const day = istNow.getDay(); // 0=Sun
  // Sun=1, Mon=7, Tue=6, Wed=5, Thu=4, Fri=3, Sat=2
  const left = day === 0 ? 1 : 7 - day + 1;
  return Math.max(1, left);
};

// --- Effective goal per subject (deterministic mixed-goal logic) ---

export interface EffectiveGoals {
  physics: number | null;
  chemistry: number | null;
  math: number | null;
  totalGoal: number | null;
  activeSubjects: QSubject[];
}

export const computeEffectiveGoals = (state: QuestionTrackingState): EffectiveGoals => {
  const { weeklyGoalTotal, weeklyGoalBySubject, weakSubject } = state;
  const { physicsGoal, chemistryGoal, mathGoal } = weeklyGoalBySubject;

  const hasTotal = weeklyGoalTotal !== null && weeklyGoalTotal > 0;
  const hasPhysics = physicsGoal !== null && physicsGoal > 0;
  const hasChemistry = chemistryGoal !== null && chemistryGoal > 0;
  const hasMath = mathGoal !== null && mathGoal > 0;
  const hasAnySubject = hasPhysics || hasChemistry || hasMath;

  // Case: No goals at all
  if (!hasTotal && !hasAnySubject) {
    return { physics: null, chemistry: null, math: null, totalGoal: null, activeSubjects: [] };
  }

  // Case: Subject-specific only (no total)
  if (!hasTotal && hasAnySubject) {
    const active: QSubject[] = [];
    if (hasPhysics) active.push('physics');
    if (hasChemistry) active.push('chemistry');
    if (hasMath) active.push('math');
    return {
      physics: hasPhysics ? physicsGoal : null,
      chemistry: hasChemistry ? chemistryGoal : null,
      math: hasMath ? mathGoal : null,
      totalGoal: null,
      activeSubjects: active,
    };
  }

  // Case: Total only (no subject goals)
  if (hasTotal && !hasAnySubject) {
    const dist = distributeTotal(weeklyGoalTotal!, weakSubject);
    return {
      physics: dist.physics,
      chemistry: dist.chemistry,
      math: dist.math,
      totalGoal: weeklyGoalTotal,
      activeSubjects: ['physics', 'chemistry', 'math'],
    };
  }

  // Case: Mixed (total + some subject goals)
  // Subject goals are prioritized. Remaining from total is distributed to unset subjects.
  const setSum = (physicsGoal || 0) + (chemistryGoal || 0) + (mathGoal || 0);
  const remaining = Math.max(0, weeklyGoalTotal! - setSum);

  const unsetSubjects: QSubject[] = [];
  if (!hasPhysics) unsetSubjects.push('physics');
  if (!hasChemistry) unsetSubjects.push('chemistry');
  if (!hasMath) unsetSubjects.push('math');

  let distPhysics = physicsGoal || 0;
  let distChemistry = chemistryGoal || 0;
  let distMath = mathGoal || 0;

  if (unsetSubjects.length > 0 && remaining > 0) {
    const perUnset = distributeAmongSubjects(remaining, unsetSubjects, weakSubject);
    if (!hasPhysics) distPhysics = perUnset.physics;
    if (!hasChemistry) distChemistry = perUnset.chemistry;
    if (!hasMath) distMath = perUnset.math;
  }

  return {
    physics: distPhysics,
    chemistry: distChemistry,
    math: distMath,
    totalGoal: weeklyGoalTotal,
    activeSubjects: ['physics', 'chemistry', 'math'],
  };
};

// --- Distribute a total across 3 subjects with optional weak boost ---

const distributeTotal = (
  total: number,
  weakSubject: QSubject | null
): { physics: number; chemistry: number; math: number } => {
  return distributeAmongSubjects(total, ['physics', 'chemistry', 'math'], weakSubject);
};

const distributeAmongSubjects = (
  total: number,
  subjects: QSubject[],
  weakSubject: QSubject | null
): { physics: number; chemistry: number; math: number } => {
  const result = { physics: 0, chemistry: 0, math: 0 };
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
  const diff = total - (result.physics + result.chemistry + result.math);
  if (diff !== 0 && subjects.length > 0) {
    result[subjects[0]] += diff;
  }

  return result;
};

// --- Weekly progress EXCLUDING today (for locked daily target) ---

export const computeWeeklyProgressBeforeToday = (logs: DailyQuestionsLog[]): WeeklyProgress => {
  const today = getISTDateString();
  const { start, end } = getISTWeekBounds();
  const weekLogsBeforeToday = logs.filter(l => l.date >= start && l.date <= end && l.date !== today);
  const p = weekLogsBeforeToday.reduce((s, l) => s + l.physicsCount, 0);
  const c = weekLogsBeforeToday.reduce((s, l) => s + l.chemistryCount, 0);
  const m = weekLogsBeforeToday.reduce((s, l) => s + l.mathCount, 0);
  return { physicsCompleted: p, chemistryCompleted: c, mathCompleted: m, totalCompleted: p + c + m };
};

// --- Daily adaptive targets (LOCKED at start of day) ---

export interface DailyTargets {
  total: number;
  physics: number | null;
  chemistry: number | null;
  math: number | null;
}

export const computeDailyTargets = (state: QuestionTrackingState): DailyTargets => {
  const goals = computeEffectiveGoals(state);
  // Use progress BEFORE today so target stays locked all day
  const progressBeforeToday = computeWeeklyProgressBeforeToday(state.dailyQuestionsLog);
  const daysLeft = getDaysLeftInWeek();

  const nullTarget: DailyTargets = { total: 0, physics: null, chemistry: null, math: null };

  if (goals.activeSubjects.length === 0) return nullTarget;

  const calcTarget = (goal: number | null, completed: number): number | null => {
    if (goal === null) return null;
    const remaining = Math.max(0, goal - completed);
    return Math.ceil(remaining / daysLeft);
  };

  const pTarget = calcTarget(goals.physics, progressBeforeToday.physicsCompleted);
  const cTarget = calcTarget(goals.chemistry, progressBeforeToday.chemistryCompleted);
  const mTarget = calcTarget(goals.math, progressBeforeToday.mathCompleted);

  const total = (pTarget || 0) + (cTarget || 0) + (mTarget || 0);

  return { total, physics: pTarget, chemistry: cTarget, math: mTarget };
};

// --- Today's progress ---

export interface TodayProgress {
  total: number;
  physics: number;
  chemistry: number;
  math: number;
}

export const getTodayProgress = (logs: DailyQuestionsLog[]): TodayProgress => {
  const log = getTodayLog(logs);
  if (!log) return { total: 0, physics: 0, chemistry: 0, math: 0 };
  return {
    total: log.physicsCount + log.chemistryCount + log.mathCount,
    physics: log.physicsCount,
    chemistry: log.chemistryCount,
    math: log.mathCount,
  };
};

// --- Adaptive feedback ---

export type PaceStatus = 'behind' | 'ahead' | 'on_track';

export interface AdaptiveFeedback {
  status: PaceStatus;
  message: string;
  dailyTarget: number;
}

export const computeFeedback = (state: QuestionTrackingState): AdaptiveFeedback | null => {
  const goals = computeEffectiveGoals(state);
  if (goals.activeSubjects.length === 0) return null;

  const totalGoal = goals.totalGoal ||
    ((goals.physics || 0) + (goals.chemistry || 0) + (goals.math || 0));
  if (totalGoal <= 0) return null;

  const progress = computeWeeklyProgress(state.dailyQuestionsLog);
  const { start } = getISTWeekBounds();
  const today = getISTDateString();

  const startDate = new Date(start + 'T00:00:00');
  const todayDate = new Date(today + 'T00:00:00');
  const daysElapsed = Math.max(1, Math.floor((todayDate.getTime() - startDate.getTime()) / 86400000) + 1);

  const expectedByNow = Math.round((totalGoal / 7) * daysElapsed);
  const dailyTarget = computeDailyTargets(state).total;

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
  if (!log) return 0;
  return log.physicsCount + log.chemistryCount + log.mathCount;
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
  const istStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
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
    const total = weekLogs.reduce((s, l) => s + l.physicsCount + l.chemistryCount + l.mathCount, 0);

    result.push({ label: `Week ${weeksBack - w}`, total });
  }

  return result;
};
