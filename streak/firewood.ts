/* ── Firewood: streak extenders ──
   A missed day no longer has to end a streak. Each missed day burns one
   firewood instead, and the streak holds at the number it had. Firewood never
   adds a day: a 45-day streak on a two-week trip is still 45 when the student
   comes back, and the next session makes it 46.

   The rules, all derived from the study log (nothing is stored, so it syncs
   by itself and cannot be edited into existence):
     · Each week (Monday to Sunday, IST study days) in which the student
       studies at least once earns FIREWOOD_PER_WEEK, credited on that week's
       first study day. Unused firewood stays in the bank, with no cap.
     · A week with no study earns nothing. So a bank of 30 really is 30 days
       away: a holiday does not refill the bank it is burning.
     · Each finished day without a log, while a streak is alive, burns one.
       Today never burns: it is not over yet.
     · An empty bank on a missed day ends the streak, exactly as before.

   Pure and React-free, and deliberately free of imports from utils.ts, which
   imports this file. Replaying the history day by day is cheap (a few hundred
   steps for a year of use) and makes every number a fact about the log. */

export const FIREWOOD_PER_WEEK = 3;

export interface StreakLedger {
  /** Days studied in the live run. Firewood days are not counted. */
  streak: number;
  /** The highest the streak has ever stood. */
  longest: number;
  /** Firewood left now. */
  bank: number;
  /** Days of the live run kept alive by firewood, oldest first. */
  burned: string[];
  /** Held by firewood right now: yesterday was missed and today has no session yet. */
  holding: boolean;
}

export const EMPTY_LEDGER: StreakLedger = { streak: 0, longest: 0, bank: 0, burned: [], holding: false };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;
const value = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
const step = (date: string, days: number): string => new Date(value(date) + days * DAY_MS).toISOString().slice(0, 10);
/** The Monday that starts this study day's week. */
const weekOf = (date: string): string => step(date, -((new Date(value(date)).getUTCDay() + 6) % 7));

/**
 * Replays the history from the first study day to today. `today` is a
 * study-day string; dates after it are ignored, so a device with a wrong clock
 * cannot write itself a streak.
 */
export const ledgerFromDates = (dates: Iterable<string>, today: string): StreakLedger => {
  const studied = new Set<string>();
  for (const d of dates) if (DATE_RE.test(d) && d <= today) studied.add(d);
  if (!studied.size) return EMPTY_LEDGER;

  const first = [...studied].sort()[0];
  const credited = new Set<string>();
  let bank = 0;
  let streak = 0;
  let longest = 0;
  let burned: string[] = [];

  for (let d = first; d <= today; d = step(d, 1)) {
    if (studied.has(d)) {
      const week = weekOf(d);
      if (!credited.has(week)) {
        credited.add(week);
        bank += FIREWOOD_PER_WEEK;
      }
      streak += 1;
      if (streak > longest) longest = streak;
    } else if (d < today && streak > 0) {
      if (bank > 0) {
        bank -= 1;
        burned.push(d);
      } else {
        streak = 0;
        burned = [];
      }
    }
  }

  const yesterday = step(today, -1);
  // Held right now: yesterday was covered and today has no session yet.
  const holding = streak > 0 && !studied.has(today) && burned[burned.length - 1] === yesterday;
  return { streak, longest, bank, burned, holding };
};

/** How many days in a row firewood has just covered, ending yesterday. */
export const daysHeld = (ledger: StreakLedger, today: string): number => {
  let n = 0;
  let d = step(today, -1);
  const burned = new Set(ledger.burned);
  while (burned.has(d)) { n += 1; d = step(d, -1); }
  return n;
};
