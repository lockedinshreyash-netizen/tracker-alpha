/* ── The board domain ──
   Pure, React-free, and the only place the board's arithmetic happens. Same
   contract as schedule/schedule.ts and today/pomodoro.ts: functions of their
   arguments, no storage, no clock beyond what is passed in. */

import { DayMinute, ScheduleBlock, Task, TaskColumn } from '../types';
import { BlockStyle, HEX_RE, derive, subjectStyle } from '../schedule/colors';
import { DATE_RE, addDays, dateValue, getISTDateString } from '../utils';

export const COLUMNS: TaskColumn[] = ['todo', 'doing', 'done'];

export const COLUMN_LABEL: Record<TaskColumn, string> = {
  todo: 'To Do',
  doing: 'Doing',
  done: 'Done',
};

/* A card with no subject, and no colour of its own, still has to be visible.
   Deliberately a grey rather than the accent: #E10600 belongs to actions and to
   the now-line, the same reservation schedule/colors.ts makes. */
const NEUTRAL_TASK_HEX = '#8a8577';

/* The Done column stops here, with the rest behind an expander. A Done column
   with two hundred cards in it is a wall, and arriving in it is the whole point
   of the column. */
export const DONE_VISIBLE = 8;

/**
 * A card's colour.
 *
 * The same dispatch `blockStyle` makes for a plan block, for the same reason:
 * subject colours are fixed data and a user-picked colour is the user's own
 * label. A Physics card is Physics-blue on every device unless its owner
 * deliberately said otherwise, so colour still means something at a glance.
 */
export const taskStyle = (task: Pick<Task, 'color' | 'subject'>): BlockStyle => {
  if (task.color && HEX_RE.test(task.color)) return derive(task.color);
  if (task.subject && task.subject !== 'General') return subjectStyle(task.subject);
  return derive(NEUTRAL_TASK_HEX);
};

export const columnOf = (task: Task): TaskColumn =>
  task.completed ? 'done' : task.column === 'doing' ? 'doing' : 'todo';

/* Ties are real: the local-newer sync path unions two devices' tasks by id, so
   two cards written independently can carry the same order. Falling through to
   the id makes the resolution deterministic and, crucially, identical on both
   devices — an unstable sort here would show the same board in two orders. */
const byOrder = (a: Task, b: Task): number =>
  (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
  || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const columnTasks = (tasks: Task[], column: TaskColumn): Task[] =>
  tasks.filter(t => columnOf(t) === column).sort(byOrder);

export type Board = Record<TaskColumn, Task[]>;

export const buildBoard = (tasks: Task[]): Board => ({
  todo: columnTasks(tasks, 'todo'),
  doing: columnTasks(tasks, 'doing'),
  done: columnTasks(tasks, 'done'),
});

/**
 * Move one card to a column and an index, returning the whole task list.
 *
 * Reindexes both affected columns 0..n rather than inventing a fractional rank
 * between two neighbours. A board holds tens of cards; a full pass over the two
 * columns the user is looking at is cheaper than the sort-key drift that
 * fractional ranks accumulate, and it repairs any duplicate orders a sync merge
 * left behind as a side effect.
 *
 * `today` is passed in rather than read, so this stays pure and the caller
 * decides what "today" means.
 */
export const moveCard = (
  tasks: Task[],
  id: string,
  to: TaskColumn,
  index: number,
  today: string = getISTDateString(),
): Task[] => {
  const moving = tasks.find(t => t.id === id);
  if (!moving) return tasks;

  const from = columnOf(moving);
  if (from === to) {
    const current = columnTasks(tasks, to).findIndex(t => t.id === id);
    if (current === index) return tasks;
  }

  /* Dropping into Done is the same write toggleTask has always made, so
     everything that counts completions — share/stats.ts especially — keeps
     working without knowing the board exists. Dragging back out clears both,
     matching what un-ticking the box has always done. */
  const completed = to === 'done';
  const moved: Task = {
    ...moving,
    completed,
    column: to,
    completedAt: completed ? (moving.completed ? moving.completedAt : today) : undefined,
  };

  const rest = tasks.filter(t => t.id !== id);
  const target = columnTasks(rest, to);
  const at = Math.max(0, Math.min(index, target.length));
  target.splice(at, 0, moved);

  const reindexed = new Map<string, number>();
  target.forEach((t, i) => reindexed.set(t.id, i));
  if (from !== to) columnTasks(rest, from).forEach((t, i) => reindexed.set(t.id, i));

  /* Rebuilt in the original array order so the list keeps a stable identity —
     only `order`, `column` and the completion fields change. */
  return tasks.map(t => {
    const source = t.id === id ? moved : t;
    const order = reindexed.get(t.id);
    return order === undefined ? source : { ...source, order };
  });
};

/** Where a brand-new card goes: the end of Todo. */
export const nextOrder = (tasks: Task[], column: TaskColumn): number => {
  const list = columnTasks(tasks, column);
  return list.length ? (list[list.length - 1].order ?? list.length - 1) + 1 : 0;
};

/* ── Deadlines ─────────────────────────────────────────────────── */

export type DueState = 'none' | 'later' | 'soon' | 'tomorrow' | 'today' | 'overdue';

export const dueState = (task: Pick<Task, 'dueAt' | 'completed'>, today: string = getISTDateString()): DueState => {
  if (!task.dueAt || !DATE_RE.test(task.dueAt)) return 'none';
  /* A finished task cannot be late. The date stays on the card as a record of
     what was asked, but it stops accusing anyone. */
  if (task.completed) return 'later';
  const diff = Math.round((dateValue(task.dueAt) - dateValue(today)) / 86_400_000);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  return diff <= 6 ? 'soon' : 'later';
};

const WEEKDAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/**
 * The calm date label the card wears.
 *
 * Deliberately not a countdown. A live "2D 14H LEFT" shrinking on every card is
 * a pressure the user tunes out inside a week, and the app already applies
 * pressure where it belongs — this is the one place it does not need to. The
 * only escalation is the word OVERDUE, in the accent, and only once it is true.
 */
export const dueLabel = (task: Pick<Task, 'dueAt' | 'completed'>, today: string = getISTDateString()): string | null => {
  const state = dueState(task, today);
  if (state === 'none') return null;
  if (state === 'overdue') return 'OVERDUE';
  if (state === 'today') return 'DUE TODAY';
  if (state === 'tomorrow') return 'DUE TOMORROW';

  const [y, m, d] = task.dueAt!.split('-').map(Number);
  /* Within the week a weekday reads faster than a date — "due Sunday" is how
     the deadline was set in the first place. Past that it stops being useful:
     "DUE SUN" three weeks out names four different days. */
  if (state === 'soon') return `DUE ${WEEKDAY[new Date(dateValue(task.dueAt!)).getUTCDay()]}`;
  return `DUE ${d} ${MONTH[m - 1]}${y === Number(today.slice(0, 4)) ? '' : ` ${y}`}`;
};

/**
 * Quick-pick dates for the editor.
 *
 * The third one is the coming Sunday, not "seven days from now" — "finish this
 * before Sunday" is how a week's work actually gets bounded, and a chip landing
 * on the same weekday you are already standing on answers nobody's question. On
 * a Sunday it offers the Sunday after, since today already has its own chip.
 */
export const dueChoices = (today: string = getISTDateString()): Array<{ label: string; date: string }> => {
  const weekday = new Date(dateValue(today)).getUTCDay();
  const untilSunday = weekday === 0 ? 7 : 7 - weekday;
  return [
    { label: 'Today', date: today },
    { label: 'Tomorrow', date: addDays(today, 1) },
    { label: 'Sunday', date: addDays(today, untilSunday) },
  ];
};

/* ── The plan link ─────────────────────────────────────────────── */

/**
 * Which tasks have a block on the day's timeline.
 *
 * Derived on read rather than stored on the task: a block can be moved,
 * deleted, or be a rule instance that exists only as a materialized row, and a
 * flag on the task would go stale on all three.
 */
export const scheduledTaskIds = (blocks: ScheduleBlock[]): Set<string> => {
  const ids = new Set<string>();
  for (const b of blocks) if (b.taskId) ids.add(b.taskId);
  return ids;
};

/** Open tasks, for the plan editor's task picker. Newest column order. */
export const openTasks = (tasks: Task[]): Task[] =>
  [...columnTasks(tasks, 'doing'), ...columnTasks(tasks, 'todo')];

/** The due instant's minute, or the user's default. Kept here so the engine and the UI agree. */
export const dueMinuteOf = (task: Pick<Task, 'dueMinute'>, fallback: DayMinute): DayMinute =>
  task.dueMinute ?? fallback;
