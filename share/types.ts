/**
 * The shapes the renderer draws.
 *
 * Deliberately flat and already-formatted: every label, every rounded number
 * and every omission decision is made in `stats.ts`, so a draw function never
 * has to ask a question about the data. A canvas layout that also does
 * arithmetic is a canvas layout nobody can adjust.
 */

export type CardPeriod = 'daily' | 'weekly' | 'monthly';

/** Aspect ratios, each of which is a real composition — see `render/format.ts`. */
export type CardFormat = '4:5' | '9:16' | '1:1';

/**
 * The hero time, pre-split.
 *
 * `hours` is not clamped to 24 — a weekly card is routinely three digits, and
 * `127:14:38` is the correct reading of a month, not an overflow.
 */
export interface Duration {
  hours: number;
  minutes: number;
  seconds: number;
  /** The raw fractional sum, kept for comparisons the card doesn't display. */
  totalHours: number;
}

/**
 * The second supporting metric.
 *
 * Which quantity this is depends on what the user actually has — tasks are
 * only countable per-day since `Task.completedAt` was added, so a long-standing
 * account can have a full history and no task dates at all. The label travels
 * with the value so the card can never announce the wrong noun, and the whole
 * thing is nullable so a slot with nothing true to say is dropped and the row
 * re-centres, rather than printing a zero that reads as a failure.
 */
export interface Metric {
  value: number;
  label: string;
}

/** One bar of the weekly chart. */
export interface DayBar {
  /** 'MON' … 'SUN' */
  label: string;
  hours: number;
}

/** One dot of the monthly grid. 0 inactive, 1 studied, 2 met the daily goal. */
export type DayLevel = 0 | 1 | 2;

export interface DailyCard {
  period: 'daily';
  date: string;
  /** '07 SEP 2026' */
  dateLabel: string;
  duration: Duration;
  sessions: number;
  metric: Metric | null;
  phrase: string;
}

export interface WeeklyCard {
  period: 'weekly';
  start: string;
  end: string;
  /** ISO 8601 week number. */
  weekNumber: number;
  /** '01 SEP – 07 SEP 2026' */
  rangeLabel: string;
  duration: Duration;
  daysActive: number;
  /** Days elapsed for a week still running; 7 for one that has finished. */
  totalDays: number;
  metric: Metric | null;
  /** Percent change vs the previous week, or null when there is no basis. */
  change: number | null;
  bars: DayBar[];
  phrase: string;
}

export interface MonthlyCard {
  period: 'monthly';
  /** 'SEP 2026' */
  monthLabel: string;
  /** 'September' */
  monthName: string;
  year: number;
  duration: Duration;
  daysActive: number;
  totalDays: number;
  metric: Metric | null;
  change: number | null;
  /** 'AUGUST' — the label beside the change figure. */
  prevMonthLabel: string;
  /** One entry per day of the real month: 28, 29, 30 or 31 of them. */
  days: DayLevel[];
  streak: number;
  phrase: string;
}

export type CardData = DailyCard | WeeklyCard | MonthlyCard;
