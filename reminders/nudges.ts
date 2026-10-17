/* ── Daily nudges ──
   The one channel that speaks without a deadline behind it, and the rule that
   lets it (notify/channels.ts): the student asked for it, at a time they
   chose, and it only ever speaks about a day that is not done yet.

   Three moments a day, on the study-day axis (DayMinute, 0 = 04:00 IST):

     start  at the time they said they study, if nothing is logged yet.
            "TIME TO LOCK IN · Day 13 starts now. 10h to go."
     goal   an evening check, if the goal is not met.
            "7.5H TO GO · Only 7.5 hours left of your 10-hour goal.
             The day is not over yet."
     last   23:00, if nothing is logged and there is a streak to lose.
            "12-DAY STREAK ON THE LINE · Skip today and it's gone."

   Hitting the goal silences the rest of that day. Logging anything silences
   start and last. All three share one lock-screen tag per day, so a later one
   replaces an earlier one instead of stacking.

   Pure, like reminders.ts: `now`, the hours and the streak come in as
   arguments. The same plan drives the local fire while the app is open and the
   rows published for the server, so the two can never disagree about what is
   due. The server is handed today plus NUDGE_DAYS_AHEAD days and re-handed
   them whenever the app opens or a session is logged. A student who stops
   opening the app therefore runs out of published days and the nudges stop by
   themselves: nobody is pinged forever by an app they left. */

import type { DayMinute, ReminderPrefs } from '../types';
import type { NotificationCopy } from '../notify/channels';

export type NudgeKind = 'start' | 'goal' | 'last';

/** Today plus this many days are published. Four pings unanswered, then quiet. */
export const NUDGE_DAYS_AHEAD = 3;

/** The evening goal check: no earlier than 8 PM, no later than 10 PM. */
export const GOAL_EARLIEST: DayMinute = 960;
export const GOAL_LATEST: DayMinute = 1080;
/** At least this long after the start nudge, so the two never land together. */
export const GOAL_AFTER_START = 180;
/** "Your streak is on the line": 11 PM, five hours before the day rolls over. */
export const LAST_CALL: DayMinute = 1140;

/** A local fire later than this past its slot is not said at all. */
export const NUDGE_STALE_MS = 20 * 60_000;

export interface NudgeDay {
  /** YYYY-MM-DD study day. */
  day: string;
  /** Hours logged that day, every source. Zero for days still ahead. */
  hours: number;
  /** The streak if nothing more is logged before this day (firewood included). */
  streak: number;
  /** Firewood in the bank going into this day. */
  bank: number;
}

export interface NudgeInput {
  prefs: Pick<ReminderPrefs, 'nudge' | 'studyMinute'>;
  goalHours: number;
  /** Today first, then the days ahead. */
  days: NudgeDay[];
  /** Study day + minute → epoch ms. `istInstant` from utils, passed in. */
  instant: (day: string, minute: DayMinute) => number;
  now: number;
}

export interface Nudge {
  kind: NudgeKind;
  day: string;
  minute: DayMinute;
  at: number;
  /** `nudge:<kind>:<day>@<at>`. The dedup key across local fire and push. */
  key: string;
  copy: NotificationCopy;
}

const fmt = (h: number): string => {
  const r = Math.round(h * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

const hoursWord = (h: number) => (h === 1 ? 'hour' : 'hours');

export const goalMinute = (studyMinute: DayMinute): DayMinute | null => {
  const m = Math.min(Math.max(studyMinute + GOAL_AFTER_START, GOAL_EARLIEST), GOAL_LATEST);
  return m > studyMinute + 60 ? m : null;
};

export const nudgeKey = (kind: NudgeKind, day: string, at: number) => `nudge:${kind}:${day}@${at}`;

/** The day a nudge key belongs to: one lock-screen tag per study day. */
export const nudgeDay = (key: string): string => key.split(':')[2]?.split('@')[0] ?? '';

/* ── Copy ── Deterministic on the numbers, in the app's voice. */

export const startCopy = (d: NudgeDay, goal: number): NotificationCopy => ({
  title: 'TIME TO LOCK IN',
  body: d.streak > 0
    ? `Day ${d.streak + 1} starts now. ${fmt(goal)}h to go. Start the clock.`
    : `You said this is when you study. ${fmt(goal)}h to go. Start the clock.`,
});

export const goalCopy = (d: NudgeDay, goal: number): NotificationCopy => {
  const left = Math.max(0, goal - d.hours);
  if (d.hours <= 0) {
    return {
      title: `0 OF ${fmt(goal)}H LOGGED`,
      body: 'Nothing logged yet. The day is not over. Your competition is still studying.',
    };
  }
  return {
    title: `${fmt(left)}H TO GO`,
    body: `Only ${fmt(left)} ${hoursWord(left)} left of your ${fmt(goal)}-hour goal. The day is not over yet.`,
  };
};

export const lastCopy = (d: NudgeDay): NotificationCopy => ({
  title: `${d.streak}-DAY STREAK ON THE LINE`,
  body: d.bank > 0
    ? 'Skip today and it burns 1 firewood. One session keeps it clean.'
    : `Skip today and your ${d.streak}-day streak is gone. One session saves it.`,
});

/**
 * Every nudge still worth saying, earliest first.
 *
 * `includePast` keeps slots already behind `now` (the local engine decides
 * whether they are fresh enough to say); the publisher leaves it false, so
 * the server is never handed something to send late.
 */
export const planNudges = (input: NudgeInput, includePast = false): Nudge[] => {
  const { prefs, goalHours, days, instant, now } = input;
  if (!prefs.nudge || prefs.studyMinute === undefined) return [];
  const start = prefs.studyMinute;
  const goalAt = goalMinute(start);
  const out: Nudge[] = [];

  for (const d of days) {
    const goal = goalHours > 0 ? goalHours : 0;
    if (goal > 0 && d.hours >= goal) continue;           // the day is done
    const slots: Array<[NudgeKind, DayMinute, NotificationCopy | null]> = [
      ['start', start, d.hours <= 0 ? startCopy(d, goal) : null],
      ['goal', goalAt ?? -1, goalAt !== null && goal > 0 ? goalCopy(d, goal) : null],
      ['last', LAST_CALL, d.hours <= 0 && d.streak > 0 && LAST_CALL > Math.max(start, goalAt ?? 0) ? lastCopy(d) : null],
    ];
    for (const [kind, minute, copy] of slots) {
      if (!copy || minute < 0) continue;
      const at = instant(d.day, minute);
      if (!includePast && at <= now) continue;
      out.push({ kind, day: d.day, minute, at, key: nudgeKey(kind, d.day, at), copy });
    }
  }
  return out.sort((a, b) => a.at - b.at);
};

/**
 * What the open app should say right now: due, not already handled, and not so
 * late that it reads as an accusation. At most one: if the app was asleep
 * through two slots, only the latest is still true.
 */
export const dueNudge = (plan: Nudge[], handled: ReadonlySet<string>, now: number): { fire: Nudge | null; skip: Nudge[] } => {
  const due = plan.filter(n => n.at <= now && !handled.has(n.key));
  if (!due.length) return { fire: null, skip: [] };
  const latest = due[due.length - 1];
  const fresh = now - latest.at <= NUDGE_STALE_MS;
  return { fire: fresh ? latest : null, skip: fresh ? due.slice(0, -1) : due };
};
