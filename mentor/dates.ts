/* ── Date arithmetic the model is never trusted with ──
   Every date the Mentor reasons about is an IST study-day string (the 04:00
   boundary in utils.ts), and every count of days between two of them comes
   from here. Pure; built on utils.ts' exact UTC stepping, so there is no clock
   and no timezone in any answer. */

import { addDays, dateValue, getISTDateString, weekdayOf } from '../utils';

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** b − a in whole days. Negative when b is before a. */
export const daysBetween = (a: string, b: string): number =>
  Math.round((dateValue(b) - dateValue(a)) / 86_400_000);

/** Monday of the week `date` falls in. Weeks run Mon–Sun, the way a student plans one. */
export const weekMonday = (date: string): string => addDays(date, -((weekdayOf(date) + 6) % 7));

export interface DayCount {
  /** Calendar days from `from` to `to`, both inclusive. 0 when `to` is before `from`. */
  calendarDays: number;
  /** The same, minus the excluded weekdays. */
  studyDays: number;
}

export const countDays = (from: string, to: string, excludeWeekdays: number[] = []): DayCount => {
  const span = daysBetween(from, to) + 1;
  if (span <= 0) return { calendarDays: 0, studyDays: 0 };
  const excluded = new Set(excludeWeekdays);
  let studyDays = 0;
  /* Whole weeks by multiplication, the remainder by walking — exact, and a
     multi-year span costs at most six iterations. */
  const weeks = Math.floor(span / 7);
  studyDays += weeks * (7 - excluded.size);
  const startWd = weekdayOf(from);
  for (let i = 0; i < span % 7; i++) {
    if (!excluded.has((startWd + weeks * 7 + i) % 7)) studyDays++;
  }
  return { calendarDays: span, studyDays };
};

/** Every date from `from` to `to`, inclusive. Capped so a bad input cannot allocate a year of strings by accident. */
export const eachDay = (from: string, to: string, cap = 400): string[] => {
  const out: string[] = [];
  const n = Math.min(cap, daysBetween(from, to) + 1);
  for (let i = 0; i < n; i++) out.push(addDays(from, i));
  return out;
};

export interface CalendarDay {
  date: string;
  day: string;
  /** "today" / "tomorrow" for the first two, absent otherwise. */
  rel?: 'today' | 'tomorrow';
}

/**
 * The next `n` days with their weekday names, handed to the model so "next
 * Monday" is a lookup, not a calculation.
 */
export const calendarFrom = (today: string, n = 14): CalendarDay[] =>
  Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i);
    return {
      date,
      day: DAY_NAMES[weekdayOf(date)],
      ...(i === 0 ? { rel: 'today' as const } : i === 1 ? { rel: 'tomorrow' as const } : {}),
    };
  });

/**
 * "Mon 28 Sep", or "Wed 6 Oct 2027" once it is not this year — how dates are
 * printed on Mentor cards. The year is not decoration: a projected finish of
 * "6 Oct" that actually means next October is the single most misleading
 * thing a pace card could say.
 */
export const formatDay = (date: string, thisYear: string = getISTDateString().slice(0, 4)): string => {
  const [y, m, d] = date.split('-').map(Number);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  return `${DAY_NAMES[weekdayOf(date)]} ${d} ${month}${String(y) === thisYear ? '' : ` ${y}`}`;
};

/** A real calendar date — "2026-02-31" has the right shape and is still rejected. */
export const isDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && addDays(v, 0) === v;
