/**
 * Card data, derived from the same arrays every other tab reads.
 *
 * Pure and React-free, the same contract as `schedule/schedule.ts` and
 * `today/pomodoro.ts`. There is no second source of truth here and nothing is
 * cached — a card is recomputed from `logs` the way the Streak tab recomputes
 * its heatmap, so a card can never disagree with the app that produced it.
 *
 * Every day boundary goes through `getISTDateString` and the exact string
 * arithmetic in `utils.ts`. That matters more here than anywhere else in the
 * app: a shared image is the one artifact that outlives the session that made
 * it, and a month that quietly started on the wrong day is unfalsifiable once
 * it is on someone's Story.
 */

import { DailyLog, DailyQuestionsLog, Task } from '../types';
import { getISTDateString, dateValue, addDays, weekdayOf, calculateStreak, DATE_RE } from '../utils';
import {
  CardData, DailyCard, DayBar, DayLevel, Duration, Metric, MonthlyCard, WeeklyCard,
} from './types';
import { phraseFor } from './phrases';

/** The narrow slice of `AppState` a card needs. Never the whole thing. */
export interface StatsInput {
  logs: DailyLog[];
  tasks: Task[];
  dailyQuestionsLog: DailyQuestionsLog[];
  dailyGoalHours: number;
}

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
/** Monday-first, matching the week the Questions tab already defines. */
const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/* ── date range helpers ──────────────────────────────────────────────────── */

/** The Monday of the week containing `date`. Weeks are Mon–Sun app-wide. */
export const weekStart = (date: string): string =>
  addDays(date, -((weekdayOf(date) + 6) % 7));

/** The first of the month containing `date`. */
export const monthStart = (date: string): string => `${date.slice(0, 7)}-01`;

export const daysInMonth = (date: string): number => {
  const [y, m] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/**
 * ISO 8601 week number — the one printed as "WEEK 36".
 *
 * Defined by the Thursday of the week, which is what makes it agree with the
 * year at the turn: 01 Jan can legitimately be week 52 of the year before.
 */
export const isoWeek = (date: string): number => {
  const d = new Date(dateValue(date));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3); // that week's Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
};

const inRange = (date: string, from: string, to: string): boolean => date >= from && date <= to;

/* ── aggregation ─────────────────────────────────────────────────────────── */

const hoursIn = (logs: DailyLog[], from: string, to: string): number =>
  logs.reduce((sum, l) => (inRange(l.date, from, to) ? sum + (l.hours || 0) : sum), 0);

const sessionsIn = (logs: DailyLog[], from: string, to: string): number =>
  logs.reduce((n, l) => (inRange(l.date, from, to) ? n + 1 : n), 0);

const activeDaysIn = (logs: DailyLog[], from: string, to: string): number => {
  const seen = new Set<string>();
  for (const l of logs) if (inRange(l.date, from, to) && (l.hours || 0) > 0) seen.add(l.date);
  return seen.size;
};

const tasksIn = (tasks: Task[], from: string, to: string): number =>
  tasks.reduce(
    (n, t) => (t.completed && t.completedAt && inRange(t.completedAt, from, to) ? n + 1 : n),
    0
  );

const questionsIn = (qlogs: DailyQuestionsLog[], from: string, to: string): number =>
  qlogs.reduce((n, row) => {
    if (!inRange(row.date, from, to)) return n;
    return n + Object.values(row.counts || {}).reduce<number>((a, b) => a + (b || 0), 0);
  }, 0);

/** Hours per day across an inclusive range, in order. */
const hoursByDay = (logs: DailyLog[], from: string, to: string): number[] => {
  const totals = new Map<string, number>();
  for (const l of logs) {
    if (!inRange(l.date, from, to)) continue;
    totals.set(l.date, (totals.get(l.date) || 0) + (l.hours || 0));
  }
  const out: number[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(totals.get(d) || 0);
  return out;
};

/* ── presentation ────────────────────────────────────────────────────────── */

/**
 * Fractional hours into the three groups the card prints.
 *
 * The seconds are honest arithmetic on a rounded input, not a measurement:
 * `logStudy` stores hours to two decimal places, so this resolves to roughly
 * ±18s. The composition wants three groups and the figure is not a stopwatch
 * claim, so the precision is spent on the layout.
 */
export const toDuration = (totalHours: number): Duration => {
  const safe = Math.max(0, totalHours);
  const totalSeconds = Math.round(safe * 3600);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    totalHours: safe,
  };
};

/** 'HH:MM:SS', hours un-padded past two digits so a month reads `127:14:38`. */
export const formatDuration = (d: Duration): string =>
  `${String(d.hours).padStart(2, '0')}:${String(d.minutes).padStart(2, '0')}:${String(d.seconds).padStart(2, '0')}`;

/** '07 SEP 2026' */
export const formatDateLabel = (date: string): string => {
  const [y, m, d] = date.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS_SHORT[m - 1]} ${y}`;
};

/**
 * '01 SEP – 07 SEP 2026', with the year written once when both ends share it —
 * the same economy `schedule/schedule.ts` applies to the meridiem in a range.
 */
export const formatRangeLabel = (from: string, to: string): string => {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const left = `${String(fd).padStart(2, '0')} ${MONTHS_SHORT[fm - 1]}`;
  const right = `${String(td).padStart(2, '0')} ${MONTHS_SHORT[tm - 1]} ${ty}`;
  return fy === ty ? `${left} – ${right}` : `${left} ${fy} – ${right}`;
};

/** Thousands separators. `1284` → `1,284`. */
export const formatCount = (n: number): string => n.toLocaleString('en-US');

/**
 * Percent change, or null when there is nothing to compare against.
 *
 * A first week has no previous week and a previous week of zero hours has no
 * ratio — both are `null`, and the card drops the slot rather than printing an
 * infinity, a dash, or a `0%` that reads as a flat week the user never had.
 */
export const percentChange = (current: number, previous: number): number | null => {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
};

/**
 * The second metric slot, resolved against what the account actually holds.
 *
 * `Task.completedAt` only exists going forward, so an account with months of
 * history can have no dated task completions at all. Rather than report a zero
 * it cannot stand behind, the slot falls through to a quantity that is
 * genuinely recorded for the period, and carries the matching label.
 */
const resolveMetric = (
  input: StatsInput,
  from: string,
  to: string,
  allowSessions: boolean
): Metric | null => {
  const tasks = tasksIn(input.tasks, from, to);
  if (tasks > 0) return { value: tasks, label: tasks === 1 ? 'TASK' : 'TASKS' };

  const questions = questionsIn(input.dailyQuestionsLog, from, to);
  if (questions > 0) return { value: questions, label: questions === 1 ? 'QUESTION' : 'QUESTIONS' };

  if (!allowSessions) return null; // the daily card already prints sessions
  const sessions = sessionsIn(input.logs, from, to);
  if (sessions > 0) return { value: sessions, label: 'SESSIONS' };

  return null;
};

/**
 * Days elapsed in a period, so an in-progress week reads `05/05` and not
 * `05/07`. A denominator that counts days the user has not lived yet is a
 * shortfall the card invented.
 */
const elapsedDays = (from: string, to: string, today: string): number => {
  const end = lived(to, today);
  if (end < from) return 0;
  return Math.round((dateValue(end) - dateValue(from)) / 86_400_000) + 1;
};

/**
 * The last day of a period that has actually been lived.
 *
 * Everything a card *counts* stops here, while everything it *draws* still
 * spans the whole period — a week shows seven bars and a month shows all its
 * dots, but the days ahead of today contribute nothing to the totals. Without
 * this a clock-skewed device (or a log backfilled with the wrong date) reports
 * `27/07 DAYS ACTIVE`, which is not merely odd-looking: it is the card claiming
 * days the user has not reached. `longestRunFromDates` in `utils.ts` refuses
 * future dates for the same reason.
 */
const lived = (to: string, today: string): string => (to < today ? to : today);

/* ── builders ────────────────────────────────────────────────────────────── */

export const buildDaily = (input: StatsInput, anchor: string = getISTDateString()): DailyCard => {
  const duration = toDuration(hoursIn(input.logs, anchor, anchor));
  const card: DailyCard = {
    period: 'daily',
    date: anchor,
    dateLabel: formatDateLabel(anchor),
    duration,
    sessions: sessionsIn(input.logs, anchor, anchor),
    metric: resolveMetric(input, anchor, anchor, false),
    phrase: '',
  };
  return { ...card, phrase: phraseFor(card, input.dailyGoalHours) };
};

export const buildWeekly = (input: StatsInput, anchor: string = getISTDateString()): WeeklyCard => {
  const start = weekStart(anchor);
  const end = addDays(start, 6);
  const today = getISTDateString();

  const prevStart = addDays(start, -7);
  const counted = lived(end, today);
  const hours = hoursIn(input.logs, start, counted);
  /* The previous week is measured over the same number of days that have been
     lived in this one. On a Tuesday, two days of work compared against a whole
     previous week reads as a 70% collapse — which is arithmetically true and
     completely useless. Like-for-like is the only comparison worth printing. */
  const prevCounted = addDays(prevStart, elapsedDays(start, end, today) - 1);

  /* Seven columns always — a week is a shape, and a Wednesday that has not
     happened yet is an empty column rather than a missing one. But the bars are
     drawn from the *counted* days only: a chart that included a day the hero
     total excludes would sum to visibly more than the figure above it, which is
     the one contradiction a shared card can never survive. */
  const byDay = hoursByDay(input.logs, start, counted);
  const bars: DayBar[] = WEEKDAYS.map((label, i) => ({
    label,
    hours: Math.round((byDay[i] ?? 0) * 10) / 10,
  }));

  const card: WeeklyCard = {
    period: 'weekly',
    start,
    end,
    weekNumber: isoWeek(start),
    rangeLabel: formatRangeLabel(start, end),
    duration: toDuration(hours),
    daysActive: activeDaysIn(input.logs, start, counted),
    totalDays: elapsedDays(start, end, today),
    metric: resolveMetric(input, start, counted, true),
    change: percentChange(hours, hoursIn(input.logs, prevStart, prevCounted)),
    bars,
    phrase: '',
  };
  return { ...card, phrase: phraseFor(card, input.dailyGoalHours) };
};

export const buildMonthly = (input: StatsInput, anchor: string = getISTDateString()): MonthlyCard => {
  const start = monthStart(anchor);
  const length = daysInMonth(anchor);
  const end = addDays(start, length - 1);
  const today = getISTDateString();

  const prevEnd = addDays(start, -1);
  const prevStart = monthStart(prevEnd);
  const counted = lived(end, today);
  const hours = hoursIn(input.logs, start, counted);
  /* Same rule as the week, and it matters more here: seven days of September
     against the whole of August is not a comparison, it is a subtraction. The
     previous month is read over the same stretch, clamped to its own length so
     a 31-day month never reaches past the end of a 28-day one. */
  const elapsed = elapsedDays(start, end, today);
  const prevSpan = Math.min(elapsed, daysInMonth(prevStart));
  const prevCounted = addDays(prevStart, prevSpan - 1);

  const [year, month] = anchor.split('-').map(Number);
  const goal = Math.max(0.1, input.dailyGoalHours || 8);

  /* Every day of the real month gets a dot — 28 in February, 31 in October —
     but only lived days can be filled. The empty tail of the current month is
     the month still being written, and drawing it is the point. */
  const byDay = hoursByDay(input.logs, start, counted);
  const days: DayLevel[] = Array.from({ length: length }, (_, i) => {
    const h = byDay[i] ?? 0;
    return h <= 0 ? 0 : h >= goal ? 2 : 1;
  });

  const card: MonthlyCard = {
    period: 'monthly',
    monthLabel: `${MONTHS_SHORT[month - 1]} ${year}`,
    monthName: MONTHS_LONG[month - 1],
    year,
    duration: toDuration(hours),
    daysActive: activeDaysIn(input.logs, start, counted),
    totalDays: elapsed,
    metric: resolveMetric(input, start, counted, true),
    change: percentChange(hours, hoursIn(input.logs, prevStart, prevCounted)),
    prevMonthLabel: MONTHS_LONG[(month + 10) % 12].toUpperCase(),
    days,
    streak: calculateStreak(input.logs),
    phrase: '',
  };
  return { ...card, phrase: phraseFor(card, input.dailyGoalHours) };
};

export const buildCard = (
  period: CardData['period'],
  input: StatsInput,
  anchor?: string
): CardData =>
  period === 'daily' ? buildDaily(input, anchor)
    : period === 'weekly' ? buildWeekly(input, anchor)
      : buildMonthly(input, anchor);

/**
 * A cheap identity for the rendered result, so switching period and back does
 * not redraw. Covers everything a card can display.
 */
export const cardKey = (data: CardData): string => {
  const base = `${data.period}:${formatDuration(data.duration)}:${data.metric?.value ?? 'x'}`;
  if (data.period === 'daily') return `${base}:${data.date}:${data.sessions}`;
  if (data.period === 'weekly') {
    return `${base}:${data.start}:${data.daysActive}/${data.totalDays}:${data.change}:${data.bars.map(b => b.hours).join(',')}`;
  }
  return `${base}:${data.monthLabel}:${data.daysActive}/${data.totalDays}:${data.change}:${data.days.join('')}`;
};

/**
 * The card in words, for the preview's `aria-label`.
 *
 * The artifact itself is an image and cannot be read by anything but eyes, so
 * the surrounding UI has to say what is in it — a screen-reader user deciding
 * whether to share this needs the numbers, not "card preview".
 */
export const describeCard = (data: CardData): string => {
  const d = data.duration;
  const time = `${d.hours} hours ${d.minutes} minutes`;
  const extra = data.metric ? `, ${formatCount(data.metric.value)} ${data.metric.label.toLowerCase()}` : '';

  if (data.period === 'daily') {
    return `Daily card for ${data.dateLabel}: ${time} studied across ${data.sessions} sessions${extra}.`;
  }
  const change = data.change === null
    ? ''
    : `, ${data.change >= 0 ? 'up' : 'down'} ${Math.abs(data.change).toFixed(1)} percent`;
  if (data.period === 'weekly') {
    return `Weekly card for ${data.rangeLabel}: ${time} studied over ${data.daysActive} of ${data.totalDays} days${extra}${change} versus last week.`;
  }
  return `Monthly card for ${data.monthName} ${data.year}: ${time} studied over ${data.daysActive} of ${data.totalDays} days${extra}${change} versus ${data.prevMonthLabel.toLowerCase()}.`;
};

/** A filename stamp for the period the card covers. */
export const stampFor = (data: CardData): string =>
  data.period === 'daily' ? data.date
    : data.period === 'weekly' ? data.start
      : `${data.year}-${data.monthLabel.slice(0, 3).toLowerCase()}`;

/* `DATE_RE` is re-exported so a caller validating an anchor does not have to
   reach past this module into `utils`. */
export { DATE_RE };
