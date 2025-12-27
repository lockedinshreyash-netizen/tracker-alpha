
import { DailyLog, Subject } from './types';

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
  const diffTime = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

export const calculateStreak = (logs: DailyLog[]): number => {
  if (logs.length === 0) return 0;
  
  const loggedDates = new Set(logs.map(l => l.date));
  const sortedDates = Array.from(loggedDates).sort((a, b) => b.localeCompare(a));
  
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

export const getLast7DaysStats = (logs: DailyLog[]): { date: string, hours: number }[] => {
  const stats = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    const dateStr = getISTDateString(d);
    const dayLogs = logs.filter(l => l.date === dateStr);
    const totalHours = dayLogs.reduce((acc, l) => acc + l.hours, 0);
    stats.push({
      date: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d),
      hours: parseFloat(totalHours.toFixed(1))
    });
  }
  return stats;
};

export const getSubjectDistribution = (logs: DailyLog[]): Record<Subject, number> => {
  const dist: Record<Subject, number> = { Physics: 0, Chemistry: 0, Maths: 0 };
  const today = getISTDateString();
  logs.filter(l => l.date === today).forEach(l => {
    dist[l.subject] += l.hours;
  });
  return dist;
};

export const calculateLockInScore = (
  logs: DailyLog[], 
  currentClass: 11 | 12, 
  progress: any[]
): number => {
  const now = new Date();
  const datesLast30: string[] = [];
  for (let i = 0; i < 30; i++) {
    datesLast30.push(getISTDateString(new Date(now.getTime() - i * 86400000)));
  }
  
  const logsLast30 = logs.filter(l => datesLast30.includes(l.date));
  
  // 1. Consistency (30%) - Based on frequency of logs
  const loggedDaysLast30 = new Set(logsLast30.map(l => l.date)).size;
  const consistencyScore = (loggedDaysLast30 / 30) * 100;
  
  // 2. Volume (30%) - Target 10 hours per day avg
  const totalHoursLast30 = logsLast30.reduce((acc, l) => acc + l.hours, 0);
  const avgHoursLast30 = totalHoursLast30 / (loggedDaysLast30 || 1);
  const hoursScore = Math.min((avgHoursLast30 / 10) * 100, 100);
  
  // 3. Syllabus Progress (10%)
  const classProgress = progress.filter(p => p.classId === currentClass && p.status === 'completed').length;
  const totalChapters = 45; 
  const progressScore = Math.min((classProgress / totalChapters) * 100, 100);
  
  // 4. Quality (30%)
  const avgQuality = logsLast30.length > 0 
    ? logsLast30.reduce((acc, l) => acc + l.quality, 0) / logsLast30.length 
    : 0;
  const qualityScore = (avgQuality / 5) * 100;

  // Composite Base Score
  const baseScore = (consistencyScore * 0.30) + (hoursScore * 0.30) + (progressScore * 0.10) + (qualityScore * 0.30);
  
  // 5. PENALTY: Distractions / Breaches
  // Every distraction subtracts 2 points from the final integrity score
  const totalDistractions = logsLast30.reduce((acc, l) => acc + (l.distractions || 0), 0);
  const penalty = totalDistractions * 2;

  const finalScore = Math.max(0, Math.round(baseScore - penalty));
  return finalScore;
};
