import { Subject, SprintItem, SprintOutcome, SprintRecord, SprintRuntime, Task } from '../types';
import { getISTDateString } from '../utils';
import { MIN_LOGGABLE_MS } from './pomodoro';

/* Pure rules for Alpha Sprints, the counterpart of today/stopwatch.ts and
   today/pomodoro.ts. A sprint is one or two named things and a time limit the
   student sets themselves: work expands to fill the time it is given, so give
   it less.

   Everything is derived from timestamps. The clock counts *working* time: a
   pause freezes what is left, and the deadline is a total of working time
   (`allowedMs + extendedMs`), not a wall-clock instant, so a pause never eats
   into it. Past the deadline the clock keeps counting as overtime, because
   finishing four minutes late is a fact worth recording, but only for
   OVERTIME_MAX_MS: after that the sprint ends itself as expired and the
   unanswered overtime is not counted, the same stance "Still studying?" takes
   on a timer nobody is watching. With MAX_SPRINT_MS that keeps a sprint inside
   one 3.5h sitting, so it never needs the presence check. */

export const MAX_ITEMS = 2;
/** Longest deadline, extensions included. */
export const MAX_SPRINT_MS = 180 * 60_000;
export const OVERTIME_MAX_MS = 30 * 60_000;
export const PRESET_MINUTES = [5, 15, 25, 30, 45, 60] as const;
export const EXTEND_MINUTES = [5, 10, 15] as const;
/** Ended sprints kept in the synced blob. */
export const HISTORY_KEEP = 300;

const MIN = 60_000;

/** A whole number of minutes, 1 to 180. Anything else is null. */
export const parseMinutes = (raw: string | number): number | null => {
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n * MIN > MAX_SPRINT_MS) return null;
  return n;
};

export const finalMs = (r: { allowedMs: number; extendedMs: number }): number => r.allowedMs + r.extendedMs;

/** Working time so far. A clock moved backwards cannot make it shrink. */
export const workedMs = (r: SprintRuntime, now: number = Date.now()): number =>
  r.workedMs + (r.runStartedAt !== null ? Math.max(0, now - r.runStartedAt) : 0);

/** Time left before the deadline. Negative = overtime. */
export const leftMs = (r: SprintRuntime, now: number = Date.now()): number => finalMs(r) - workedMs(r, now);

/** The wall-clock instant the deadline lands on, while running. */
export const deadlineAt = (r: SprintRuntime): number | null =>
  r.runStartedAt === null ? null : r.runStartedAt + finalMs(r) - r.workedMs;

/** When an unanswered overtime ends the sprint by itself, while running. */
export const staleAt = (r: SprintRuntime): number | null => {
  const d = deadlineAt(r);
  return d === null ? null : d + OVERTIME_MAX_MS;
};

export type SprintStatus = 'running' | 'paused' | 'over' | 'stale';

export const statusOf = (r: SprintRuntime, now: number = Date.now()): SprintStatus => {
  if (r.runStartedAt === null) return 'paused';
  const left = leftMs(r, now);
  if (left > 0) return 'running';
  return -left >= OVERTIME_MAX_MS ? 'stale' : 'over';
};

export const isPaused = (r: SprintRuntime): boolean => r.runStartedAt === null;

/** 0–1 of the deadline still left; 0 once it has passed. */
export const leftFraction = (r: SprintRuntime, now: number = Date.now()): number => {
  const f = finalMs(r);
  return f > 0 ? Math.min(1, Math.max(0, leftMs(r, now) / f)) : 0;
};

export interface Draft {
  items: { text: string; taskId?: string; subject?: Subject }[];
  note?: string;
  subject: Subject;
  minutes: number;
}

/** A new sprint, on the clock from `now`. Null if the draft cannot be one. */
export const startSprint = (d: Draft, id: string, now: number = Date.now()): SprintRuntime | null => {
  const minutes = parseMinutes(d.minutes);
  const items = d.items
    .map(i => ({ ...i, text: i.text.trim().slice(0, 200) }))
    .filter(i => i.text)
    .slice(0, MAX_ITEMS);
  if (minutes === null || items.length === 0) return null;
  const note = d.note?.trim().slice(0, 200);
  return {
    id,
    items: items.map((i, n) => ({
      id: `${id}.${n}`,
      text: i.text,
      ...(i.taskId ? { taskId: i.taskId } : {}),
      ...(i.subject ? { subject: i.subject } : {}),
    })),
    ...(note ? { note } : {}),
    subject: d.subject,
    allowedMs: minutes * MIN,
    extendedMs: 0,
    extensions: 0,
    startedAt: now,
    runStartedAt: now,
    workedMs: 0,
    pausedMs: 0,
    bankedMs: 0,
  };
};

export const pauseSprint = (r: SprintRuntime, now: number = Date.now()): SprintRuntime =>
  r.runStartedAt === null ? r : { ...r, workedMs: workedMs(r, now), runStartedAt: null, pausedAt: now };

/** A run of working time to write to `logs`. */
export interface SprintSpan {
  hours: number;
  startedAt: number;
  endedAt: number;
}

const spanOf = (ms: number, endedAt: number): SprintSpan | null =>
  ms >= MIN_LOGGABLE_MS ? { hours: ms / 3_600_000, startedAt: endedAt - ms, endedAt } : null;

/**
 * Start the clock again. A pause that outlived its study day banks the time
 * served so far first, so last night's minutes stay on last night (and on the
 * streak) rather than moving onto the day the sprint ends: the stopwatch's
 * `resumeRun` rule.
 */
export const resumeSprint = (r: SprintRuntime, now: number = Date.now()): { runtime: SprintRuntime; bank: SprintSpan | null } => {
  if (r.runStartedAt !== null) return { runtime: r, bank: null };
  const pausedAt = r.pausedAt ?? now;
  const crossed = getISTDateString(new Date(pausedAt)) !== getISTDateString(new Date(now));
  const bank = crossed ? spanOf(r.workedMs - r.bankedMs, pausedAt) : null;
  const { pausedAt: _gone, ...rest } = r;
  return {
    runtime: {
      ...rest,
      runStartedAt: now,
      pausedMs: r.pausedMs + Math.max(0, now - pausedAt),
      bankedMs: bank ? r.workedMs : r.bankedMs,
    },
    bank,
  };
};

/** Room left under MAX_SPRINT_MS, in ms. */
export const extendRoomMs = (r: SprintRuntime, now: number = Date.now()): number =>
  MAX_SPRINT_MS - Math.max(finalMs(r), workedMs(r, now));

/**
 * Move the deadline out by `minutes`. Past the deadline it moves out from
 * where the clock is now, so +5 always means five more minutes on the clock;
 * the overtime it absorbs is part of the extension, and the history keeps the
 * original allowance beside it. Never past MAX_SPRINT_MS.
 */
export const extendSprint = (r: SprintRuntime, minutes: number, now: number = Date.now()): SprintRuntime => {
  const add = minutes * MIN;
  if (!(add > 0) || add > extendRoomMs(r, now)) return r;
  const base = Math.max(finalMs(r), workedMs(r, now));
  return { ...r, extendedMs: base + add - r.allowedMs, extensions: r.extensions + 1 };
};

/** Tick or untick one item. */
export const toggleItem = (r: SprintRuntime, itemId: string, now: number = Date.now(), movedFrom?: SprintItem['movedFrom']): SprintRuntime => ({
  ...r,
  items: r.items.map(i => {
    if (i.id !== itemId) return i;
    if (i.doneAt) {
      const { doneAt: _d, movedFrom: _m, ...rest } = i;
      return rest;
    }
    return { ...i, doneAt: now, ...(movedFrom ? { movedFrom } : {}) };
  }),
});

export const allDone = (r: { items: SprintItem[] }): boolean => r.items.length > 0 && r.items.every(i => !!i.doneAt);

export type EndKind = 'complete' | 'expire' | 'abandon';

export interface Ending {
  record: SprintRecord;
  /** The working time not yet in `logs`, or null if under a minute. */
  span: SprintSpan | null;
}

/**
 * End the sprint. `complete` is decided by the clock: on time if the work
 * fitted inside the final deadline, late if it did not. A sprint that ran
 * past its overtime limit unanswered is counted only up to the deadline.
 */
export const endSprint = (r: SprintRuntime, kind: EndKind, now: number = Date.now()): Ending => {
  const final = finalMs(r);
  let worked = workedMs(r, now);
  let endedAt = r.runStartedAt !== null ? now : (r.pausedAt ?? now);
  const stale = statusOf(r, now) === 'stale';
  if (stale) {
    worked = final;
    endedAt = deadlineAt(r) ?? endedAt;
  }
  const outcome: SprintOutcome =
    kind === 'abandon' ? 'abandoned'
      : kind === 'expire' || stale ? 'expired'
        : worked <= final ? 'on_time' : 'late';
  const pausedMs = r.pausedMs + (r.runStartedAt === null && r.pausedAt ? Math.max(0, now - r.pausedAt) : 0);
  const record: SprintRecord = {
    id: r.id,
    items: r.items,
    ...(r.note ? { note: r.note } : {}),
    subject: r.subject,
    allowedMs: r.allowedMs,
    finalMs: final,
    extensions: r.extensions,
    workedMs: Math.round(worked),
    pausedMs: Math.round(pausedMs),
    startedAt: r.startedAt,
    endedAt: Math.round(endedAt),
    outcome,
  };
  return { record, span: spanOf(worked - r.bankedMs, endedAt) };
};

/** The same work again, with the original allowance and a fresh clock. Items already done drop out. */
export const restartDraft = (r: SprintRuntime): Draft => ({
  items: r.items.filter(i => !i.doneAt).map(({ text, taskId, subject }) => ({ text, taskId, subject })),
  note: r.note,
  subject: r.subject,
  minutes: Math.round(r.allowedMs / MIN),
});

/** Cards that can start a sprint: not done, Doing first, then the board's own order. */
export const openTasks = (tasks: Task[]): Task[] => {
  const rank = (t: Task) => (t.column === 'doing' ? 0 : 1);
  return tasks
    .filter(t => !t.completed && t.text.trim())
    .sort((a, b) => rank(a) - rank(b) || (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id));
};

/* ── History ── */

export const isFinished = (o: SprintOutcome) => o === 'on_time' || o === 'late';

export interface SprintStats {
  ended: number;
  completed: number;
  onTime: number;
  /** All working time across ended sprints; it was all logged as study. */
  focusedMs: number;
  /** Share of ended sprints finished inside their final deadline. Null under three sprints. */
  onTimeRate: number | null;
  /** Mean working time of finished sprints. Null under two. */
  avgCompletedMs: number | null;
  /** Deadline left over on sprints finished on time. */
  savedMs: number;
}

export const sprintStats = (records: SprintRecord[]): SprintStats => {
  const done = records.filter(r => isFinished(r.outcome));
  const onTime = records.filter(r => r.outcome === 'on_time');
  return {
    ended: records.length,
    completed: done.length,
    onTime: onTime.length,
    focusedMs: records.reduce((n, r) => n + r.workedMs, 0),
    onTimeRate: records.length >= 3 ? onTime.length / records.length : null,
    avgCompletedMs: done.length >= 2 ? done.reduce((n, r) => n + r.workedMs, 0) / done.length : null,
    savedMs: onTime.reduce((n, r) => n + Math.max(0, r.finalMs - r.workedMs), 0),
  };
};

/* ── Normalizers and merge ── */

const SUBJECTS: Subject[] = ['Physics', 'Chemistry', 'Maths', 'Biology', 'General'];
const OUTCOMES: SprintOutcome[] = ['on_time', 'late', 'expired', 'abandoned'];
const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const subj = (v: unknown): Subject => (SUBJECTS.includes(v as Subject) ? (v as Subject) : 'General');

const normalizeItems = (raw: unknown): SprintItem[] =>
  (Array.isArray(raw) ? raw : [])
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object' && typeof (i as any).id === 'string')
    .map(i => {
      const item: SprintItem = { id: str(i.id, 80), text: str(i.text, 200) };
      if (typeof i.taskId === 'string') item.taskId = i.taskId;
      if (SUBJECTS.includes(i.subject as Subject)) item.subject = i.subject as Subject;
      if (typeof i.doneAt === 'number' && i.doneAt > 0) item.doneAt = i.doneAt;
      if (i.movedFrom === 'todo' || i.movedFrom === 'doing') item.movedFrom = i.movedFrom;
      return item;
    })
    .filter(i => i.text)
    .slice(0, MAX_ITEMS);

/** This device's own saved sprint. Anything impossible is dropped rather than run. */
export const normalizeSprint = (raw: unknown): SprintRuntime | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const items = normalizeItems(r.items);
  const allowedMs = num(r.allowedMs);
  const startedAt = num(r.startedAt);
  if (typeof r.id !== 'string' || !items.length || allowedMs <= 0 || startedAt <= 0) return null;
  const run = r.runStartedAt === null || r.runStartedAt === undefined ? null : num(r.runStartedAt, startedAt);
  const out: SprintRuntime = {
    id: r.id,
    items,
    subject: subj(r.subject),
    allowedMs,
    extendedMs: Math.max(0, num(r.extendedMs)),
    extensions: Math.max(0, Math.floor(num(r.extensions))),
    startedAt,
    runStartedAt: run,
    workedMs: Math.max(0, num(r.workedMs)),
    pausedMs: Math.max(0, num(r.pausedMs)),
    bankedMs: Math.max(0, num(r.bankedMs)),
  };
  if (typeof r.note === 'string' && r.note) out.note = r.note.slice(0, 200);
  if (run === null) out.pausedAt = num(r.pausedAt, startedAt);
  if (typeof r.rangFor === 'number') out.rangFor = r.rangFor;
  return out;
};

const normalizeRecord = (raw: unknown): SprintRecord | null => {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const items = normalizeItems(r.items);
  if (typeof r.id !== 'string' || !items.length || !OUTCOMES.includes(r.outcome as SprintOutcome)) return null;
  const rec: SprintRecord = {
    id: r.id,
    items,
    subject: subj(r.subject),
    allowedMs: Math.max(0, num(r.allowedMs)),
    finalMs: Math.max(0, num(r.finalMs, num(r.allowedMs))),
    extensions: Math.max(0, Math.floor(num(r.extensions))),
    workedMs: Math.max(0, num(r.workedMs)),
    pausedMs: Math.max(0, num(r.pausedMs)),
    startedAt: num(r.startedAt),
    endedAt: num(r.endedAt),
    outcome: r.outcome as SprintOutcome,
  };
  if (typeof r.note === 'string' && r.note) rec.note = r.note.slice(0, 200);
  return rec;
};

const bound = (records: SprintRecord[]) =>
  records.sort((a, b) => a.endedAt - b.endedAt || a.id.localeCompare(b.id)).slice(-HISTORY_KEEP);

export const normalizeSprints = (raw: unknown): SprintRecord[] => {
  const seen = new Map<string, SprintRecord>();
  for (const r of Array.isArray(raw) ? raw : []) {
    const rec = normalizeRecord(r);
    if (rec) seen.set(rec.id, rec);
  }
  return bound([...seen.values()]);
};

/**
 * Union by id. Safe in every merge path, unlike `logs` or `tasks`: a record
 * is written once when its sprint ends and never edited or deleted, so there
 * is nothing a union can resurrect.
 */
export const mergeSprints = (a: unknown, b: unknown): SprintRecord[] =>
  normalizeSprints([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]);
