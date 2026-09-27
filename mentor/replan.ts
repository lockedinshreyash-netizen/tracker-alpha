/* ── When a day slips ──
   Missed work is NOT dumped onto tomorrow. Each slipped card goes to the
   earliest day in the horizon that has room for it, where "room" is that day's
   realistic capacity minus what is already due there — and no day absorbs
   more carried-over work than a quarter of its capacity (at least 30 min), so
   one bad Monday cannot turn Tuesday into a nine-hour wall that also fails.
   The one exception: a day with room may always take its FIRST carried card,
   or a 90-minute card could never move anywhere at all.

   Order: cards for chapters on this week's roadmap first (they are what the
   plan depends on), then oldest first. Anything that fits nowhere is reported
   rather than forced — that is the signal to re-plan the roadmap, and the
   card says so instead of quietly overfilling next week.

   Only cards the Mentor planned, or cards with a size, are moved. A student's
   hand-written "buy a geometry box" is theirs; the planner has no business
   rescheduling it. */

import { AppState, Task } from '../types';
import { addDays } from '../utils';
import { dayCapacity, PLAN_FILL } from './capacity';
import { roadmapStatus } from './roadmap';

const DEFAULT_CARD_MINS = 45;
const CARRY_SHARE = 0.25;
const CARRY_FLOOR = 30;

export const cardMins = (t: Task): number => t.estMins || DEFAULT_CARD_MINS;

/** Open cards whose day has passed and which the planner is allowed to move. */
export const slippedTasks = (tasks: Task[], today: string): Task[] =>
  tasks.filter(t => !t.completed && !!t.dueAt && t.dueAt < today && (t.origin === 'mentor' || !!t.estMins));

export interface Move {
  taskId: string;
  text: string;
  estMins: number;
  from: string;
  to: string;
}

export interface Replan {
  horizon: number;
  moves: Move[];
  /** Cards that fit nowhere in the horizon. */
  unplaced: { taskId: string; text: string; estMins: number; from: string }[];
  slippedMins: number;
}

export const redistribute = (state: AppState, today: string, now?: number, horizon = 7): Replan => {
  const slipped = slippedTasks(state.tasks, today);
  const slippedIds = new Set(slipped.map(t => t.id));

  const onRoadmap = new Set(
    (roadmapStatus(state, today)?.thisWeek ?? []).filter(i => !i.done).map(i => `${i.subject}|${i.chapter}`),
  );
  const ordered = [...slipped].sort((a, b) => {
    const ra = a.chapter && onRoadmap.has(`${a.subject}|${a.chapter}`) ? 0 : 1;
    const rb = b.chapter && onRoadmap.has(`${b.subject}|${b.chapter}`) ? 0 : 1;
    return ra - rb || (a.dueAt ?? '').localeCompare(b.dueAt ?? '') || a.id.localeCompare(b.id);
  });

  const days = Array.from({ length: horizon }, (_, i) => addDays(today, i));
  const headroom = new Map<string, number>();
  const carryLeft = new Map<string, number>();
  for (const d of days) {
    const cap = dayCapacity(state, d, today, d === today ? now : undefined).minutes;
    const due = state.tasks
      .filter(t => !t.completed && t.dueAt === d && !slippedIds.has(t.id))
      .reduce((a, t) => a + cardMins(t), 0);
    headroom.set(d, Math.round(cap * PLAN_FILL) - due);
    carryLeft.set(d, cap > 0 ? Math.max(CARRY_FLOOR, Math.round(cap * CARRY_SHARE)) : 0);
  }

  const carried = new Set<string>();
  const moves: Move[] = [];
  const unplaced: Replan['unplaced'] = [];
  for (const t of ordered) {
    const mins = cardMins(t);
    const day = days.find(d => (headroom.get(d) ?? 0) >= mins
      && ((carryLeft.get(d) ?? 0) >= mins || !carried.has(d)));
    if (!day) {
      unplaced.push({ taskId: t.id, text: t.text, estMins: mins, from: t.dueAt! });
      continue;
    }
    carried.add(day);
    headroom.set(day, (headroom.get(day) ?? 0) - mins);
    carryLeft.set(day, (carryLeft.get(day) ?? 0) - mins);
    moves.push({ taskId: t.id, text: t.text, estMins: mins, from: t.dueAt!, to: day });
  }

  return {
    horizon,
    moves,
    unplaced,
    slippedMins: slipped.reduce((a, t) => a + cardMins(t), 0),
  };
};
