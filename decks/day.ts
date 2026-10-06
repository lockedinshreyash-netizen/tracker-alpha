/* ── The study day, for cards ──
   "Due today" means what "today" means everywhere else in Alpha: the study day
   that runs 04:00 IST to 04:00 IST (utils.ts, DAY_START_HOUR). A card due
   "tomorrow" is due from 04:00 tomorrow, so it is waiting at breakfast rather
   than appearing at whatever minute it happened to be answered today. */

import { DAY_START_HOUR, getISTDateString } from '../utils';

const DAY_MS = 86_400_000;
const HOUR = String(DAY_START_HOUR).padStart(2, '0');

/** 04:00 IST at the start of the study day `now` falls in. IST has no DST. */
export const studyDayStart = (now: Date = new Date()): Date =>
  new Date(Date.parse(`${getISTDateString(now)}T${HOUR}:00:00+05:30`));

export const studyDayBounds = (now: Date = new Date()): { start: Date; end: Date } => {
  const start = studyDayStart(now);
  return { start, end: new Date(start.getTime() + DAY_MS) };
};

/** The start of the study day `days` after the one `now` is in. */
export const studyDayAfter = (now: Date, days: number): Date =>
  new Date(studyDayStart(now).getTime() + days * DAY_MS);
