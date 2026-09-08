/* ── The reminder domain ──
   Pure, React-free, no storage and no clock of its own — `now` is always passed
   in. Same contract as today/pomodoro.ts, rewards/engine.ts and
   schedule/schedule.ts.

   The design idea worth holding on to: almost every cancellation rule here is a
   filter, not an operation. Ticking a task off, clearing its date, or deleting
   it all stop its reminder because the scan simply stops selecting it — there
   is no cancel() to call and therefore no place to forget to call it. Tasks are
   mutated from App.tsx, three voice intents, the board and the sync merge, and
   the one path that forgot would be the one that fires a reminder for a task
   the user threw away last week. */

import { ReminderPrefs, ScheduleBlock, Task } from '../types';
import { DATE_RE, istInstant } from '../utils';
import { NotificationCopy } from '../notify/channels';
import { formatClock } from '../schedule/schedule';

/* A reminder this overdue is not a reminder. The same twelve hours as
   STALE_PHASE_MS in today/pomodoro.ts, and for the same reason: the browser was
   shut for half a day, and telling somebody at 4am about a 4pm deadline is an
   accusation rather than a service. The card already says OVERDUE, which is
   where that information belongs. */
export const STALE_REMINDER_MS = 12 * 3_600_000;

/* More than this landing together is a burst, and a burst is how an app gets
   its notification permission revoked. Anything past it is collapsed into one
   line. */
export const MAX_BURST = 2;

/** A fire more overdue than this says so, rather than pretending it just landed. */
export const LATE_THRESHOLD_MS = 60_000;

/** `taskId@instant`. The instant is in the key on purpose — see Task.remindedKey. */
export const fireKey = (taskId: string, at: number): string => `${taskId}@${at}`;

/**
 * When this task should speak, or null if it never should.
 *
 * The lead time is subtracted here rather than at the call site so that the key
 * and the fire agree: moving the lead re-keys every pending reminder, which is
 * correct — the user changed when they wanted to be told.
 */
export const dueInstant = (task: Task, prefs: ReminderPrefs): number | null => {
  if (!task.dueAt || !DATE_RE.test(task.dueAt)) return null;
  return istInstant(task.dueAt, task.dueMinute ?? prefs.defaultMinute) - prefs.leadMinutes * 60_000;
};

export interface PendingFire {
  task: Task;
  key: string;
  at: number;
}

export interface DueScan {
  /** Ready to speak, earliest first. */
  fire: PendingFire[];
  /** Past the staleness ceiling: marked as reminded, never shown. */
  drop: PendingFire[];
  /** The earliest instant still ahead, for the timeout. Null when nothing is armed. */
  nextAt: number | null;
}

const EMPTY: DueScan = { fire: [], drop: [], nextAt: null };

/**
 * What is due, what is too old to say, and when to wake up next.
 *
 * Returns a shared empty result when there is nothing at all, so the engine's
 * overwhelmingly common no-op path allocates nothing.
 */
export const scanDue = (tasks: Task[], prefs: ReminderPrefs, now: number): DueScan => {
  if (!prefs.enabled) return EMPTY;

  const fire: PendingFire[] = [];
  const drop: PendingFire[] = [];
  let nextAt: number | null = null;

  for (const task of tasks) {
    if (task.completed) continue;          // ticking it off cancels it
    const at = dueInstant(task, prefs);
    if (at === null) continue;             // no date, or the date was cleared
    const key = fireKey(task.id, at);
    if (task.remindedKey === key) continue; // already said, here or on another device

    if (at > now) {
      if (nextAt === null || at < nextAt) nextAt = at;
      continue;
    }
    (now - at > STALE_REMINDER_MS ? drop : fire).push({ task, key, at });
  }

  if (!fire.length && !drop.length && nextAt === null) return EMPTY;

  fire.sort((a, b) => a.at - b.at);
  return { fire, drop, nextAt };
};

const overdueWords = (ms: number): string => {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
};

/**
 * One reminder, in words.
 *
 * The voice is the app's own — a deadline is a commitment, not a suggestion —
 * but it never invents urgency the user did not sign up for. A fire that is
 * genuinely late says how late rather than pretending it just arrived, the same
 * instinct behind `lateBy` on the Pomodoro bell.
 */
export const fireCopy = (fire: PendingFire, prefs: ReminderPrefs, now: number): NotificationCopy => {
  const late = now - fire.at > LATE_THRESHOLD_MS;
  const when = fire.task.dueMinute !== undefined
    ? formatClock(fire.task.dueMinute)
    : formatClock(prefs.defaultMinute);

  return {
    title: fire.task.text.toUpperCase().slice(0, 80),
    body: late
      ? `Due ${overdueWords(now - fire.at)}. Still not done.`
      : `Due ${when}. You said this was the deadline.`,
  };
};

/**
 * A burst, in one line.
 *
 * Names the earliest and counts the rest. Six notifications arriving together
 * is how an app gets muted; one that says "and three more" is how it stays
 * installed.
 */
export const burstCopy = (fires: PendingFire[]): NotificationCopy => ({
  title: `${fires.length} DEADLINES DUE`,
  body: `${fires[0].task.text}, and ${fires.length - 1} more.`,
});

/* ── The plan channel ───────────────────────────────────────────── */

/** How long before a planned block starts to say so. */
export const BLOCK_LEAD_MINS = 10;

export const blockFireKey = (block: ScheduleBlock, at: number): string => `block:${block.id}@${at}`;

export const blockCopy = (block: ScheduleBlock, title: string): NotificationCopy => ({
  title: title.toUpperCase().slice(0, 80),
  body: `Starts at ${formatClock(block.start)}. It is on your plan.`,
});
