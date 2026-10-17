/* ── From AppState to a nudge plan ──
   The one place nudges read the app's data, shared by the local engine
   (useNudges.ts) and the publisher (publish.ts), so the open app and the
   server are always working from the same plan. */

import type { DailyLog, ReminderPrefs } from '../types';
import { addDays, getISTDateString, istInstant, streakLedger } from '../utils';
import { NUDGE_DAYS_AHEAD, Nudge, NudgeDay, planNudges } from './nudges';

export const nudgeDays = (logs: DailyLog[], today = getISTDateString()): NudgeDay[] => {
  const days: NudgeDay[] = [];
  for (let i = 0; i <= NUDGE_DAYS_AHEAD; i++) {
    const day = addDays(today, i);
    const hours = i === 0 ? logs.reduce((s, l) => (l.date === day ? s + (l.hours || 0) : s), 0) : 0;
    /* The streak and bank as they would stand on that day if nothing more is
       logged before it: firewood burns for the days in between. */
    const ledger = streakLedger(logs, { today: day });
    days.push({ day, hours, streak: ledger.streak, bank: ledger.bank });
  }
  return days;
};

export const nudgePlan = (
  logs: DailyLog[],
  goalHours: number,
  prefs: ReminderPrefs,
  now: number,
  includePast = false,
): Nudge[] =>
  planNudges({ prefs, goalHours, days: nudgeDays(logs), instant: istInstant, now }, includePast);
