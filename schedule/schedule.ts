/**
 * The scheduling domain, with no React and no storage in it.
 *
 * Same contract as today/pomodoro.ts and rewards/engine.ts: everything here
 * is a pure function of its arguments, so the timeline, the template editor
 * and the adherence readout can all derive the same day without one of them
 * being the owner of it.
 */

import { DailyLog, DayMinute, ScheduleBlock, ScheduleState, Subject, TemplateRule } from '../types';
import { DAY_START_HOUR, weekdayOf } from '../utils';
import { countsAsStudy } from './colors';

export const DAY_MINUTES = 1440;

/** Drag granularity. Five minutes is fine enough to be honest, coarse enough to hit. */
export const SNAP_MINS = 5;

/** Below this a block is a smudge on the grid and cannot be read or grabbed. */
export const MIN_BLOCK_MINS = 10;

/** The minute the calendar day rolls over, on the study-day axis. */
export const MIDNIGHT_MINUTE = (24 - DAY_START_HOUR) * 60; // 1200

/* ── Clock ─────────────────────────────────────────────────────── */

/**
 * Where a moment sits on the study-day axis.
 *
 * IST wall clock, deliberately: this answers "how far into the day are we",
 * which is a different question from "which day is this" — that one belongs
 * to getISTDateString and must not be answered here.
 */
export const nowMinute = (d: Date = new Date()): DayMinute => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  return (hour * 60 + minute - DAY_START_HOUR * 60 + DAY_MINUTES) % DAY_MINUTES;
};

/** Wall-clock hours and minutes for a point on the study-day axis. */
const wallClock = (m: DayMinute): { h24: number; h12: number; mm: number; ampm: 'AM' | 'PM' } => {
  const wall = (Math.round(m) + DAY_START_HOUR * 60) % DAY_MINUTES;
  const h24 = Math.floor(wall / 60);
  return {
    h24,
    h12: h24 % 12 === 0 ? 12 : h24 % 12,
    mm: wall % 60,
    ampm: h24 < 12 ? 'AM' : 'PM',
  };
};

/** Minute on the study-day axis → "6:30 AM". */
export const formatClock = (m: DayMinute): string => {
  const { h12, mm, ampm } = wallClock(m);
  return `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
};

/** The axis gutter: "6 AM", "12 PM". Bare hours, so the column stays narrow. */
export const formatHour = (m: DayMinute): string => {
  const { h12, ampm } = wallClock(m);
  return `${h12} ${ampm}`;
};

/**
 * A span, with the meridiem written once when both ends share it:
 * "6:00 – 7:30 AM", but "11:00 AM – 1:00 PM".
 */
export const formatRange = (start: DayMinute, durationMins: number): string => {
  const a = wallClock(start);
  const b = wallClock(start + durationMins);
  const left = `${a.h12}:${String(a.mm).padStart(2, '0')}`;
  const right = `${b.h12}:${String(b.mm).padStart(2, '0')} ${b.ampm}`;
  return a.ampm === b.ampm ? `${left} – ${right}` : `${left} ${a.ampm} – ${right}`;
};

/** "1h 30m" / "45m" — for durations, never for a time of day. */
export const formatSpan = (mins: number): string => {
  const m = Math.max(0, Math.round(mins));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  if (rest === 0) return `${h}h`;
  return `${h}h ${rest}m`;
};

export const snap = (m: number, grid: number = SNAP_MINS): number =>
  Math.round(m / grid) * grid;

/** Keeps a block inside the day and above the legibility floor. */
export const clampBlock = (
  start: number,
  durationMins: number,
): { start: DayMinute; durationMins: number } => {
  const duration = Math.min(
    DAY_MINUTES,
    Math.max(MIN_BLOCK_MINS, Math.round(durationMins) || MIN_BLOCK_MINS),
  );
  const s = Math.min(DAY_MINUTES - duration, Math.max(0, Math.round(start) || 0));
  return { start: s, durationMins: duration };
};

export const blockEnd = (b: { start: DayMinute; durationMins: number }): number =>
  b.start + b.durationMins;

/* ── Rule instances ────────────────────────────────────────────── */

/**
 * The id a materialized rule instance carries.
 *
 * Derived rather than stored, and identical to the key an override uses, so
 * an instance keeps its identity across renders without anything being
 * written for the days you never touched.
 */
export const instanceId = (ruleId: string, date: string): string => `${ruleId}@${date}`;

export const isInstanceId = (id: string): boolean => id.includes('@');

export const parseInstanceId = (id: string): { ruleId: string; date: string } | null => {
  const at = id.lastIndexOf('@');
  if (at <= 0) return null;
  return { ruleId: id.slice(0, at), date: id.slice(at + 1) };
};

export const ruleAppliesOn = (rule: TemplateRule, date: string): boolean => {
  if (date < rule.from) return false;
  if (rule.until && date > rule.until) return false;
  return rule.days.includes(weekdayOf(date));
};

/**
 * Everything planned for one study day: one-off blocks plus every rule
 * instance, with that date's overrides applied and skipped instances dropped.
 */
export const materializeDay = (schedule: ScheduleState, date: string): ScheduleBlock[] => {
  const out: ScheduleBlock[] = schedule.blocks.filter(b => b.date === date);

  for (const rule of schedule.rules) {
    if (!ruleAppliesOn(rule, date)) continue;
    const id = instanceId(rule.id, date);
    const ov = schedule.overrides.find(o => o.id === id);
    if (ov?.skipped) continue;
    const { start, durationMins } = clampBlock(
      ov?.start ?? rule.start,
      ov?.durationMins ?? rule.durationMins,
    );
    out.push({
      id,
      date,
      subject: ov?.subject ?? rule.subject,
      chapter: ov?.chapter ?? rule.chapter,
      start,
      durationMins,
      kind: rule.kind,
      label: rule.label,
    });
  }

  return out.sort((a, b) => a.start - b.start || b.durationMins - a.durationMins || a.id.localeCompare(b.id));
};

/** Has this instance been moved off what the template says? */
export const isOverridden = (schedule: ScheduleState, blockId: string): boolean =>
  isInstanceId(blockId) && schedule.overrides.some(o => o.id === blockId && !o.skipped);

/* ── Layout ────────────────────────────────────────────────────── */

export interface LaidOutBlock {
  block: ScheduleBlock;
  lane: number;
  lanes: number;
}

/**
 * Side-by-side lanes for blocks that overlap.
 *
 * Overlaps are allowed on purpose — a student double-booked at 19:00 is
 * information worth showing, and refusing the drop is a worse answer than
 * drawing the clash.
 */
export const layoutDay = (blocks: ScheduleBlock[]): LaidOutBlock[] => {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const out: LaidOutBlock[] = [];

  let cluster: ScheduleBlock[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const assigned: { block: ScheduleBlock; lane: number }[] = [];
    for (const b of cluster) {
      let lane = laneEnds.findIndex(end => end <= b.start);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = blockEnd(b);
      assigned.push({ block: b, lane });
    }
    const lanes = laneEnds.length;
    for (const a of assigned) out.push({ ...a, lanes });
    cluster = [];
    clusterEnd = -1;
  };

  for (const b of sorted) {
    if (cluster.length > 0 && b.start >= clusterEnd) flush();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, blockEnd(b));
  }
  flush();

  return out;
};

/** Other blocks on the day this one collides with. */
export const clashesWith = (block: ScheduleBlock, blocks: ScheduleBlock[]): ScheduleBlock[] =>
  blocks.filter(
    b => b.id !== block.id && b.start < blockEnd(block) && block.start < blockEnd(b),
  );

/**
 * The first gap at or after `from` that fits, so a one-tap add lands somewhere
 * usable instead of stacking every meal at 8 AM.
 *
 * Falls back to `from` when the day is genuinely full — an honest clash the
 * user can see and move beats silently refusing to add anything.
 */
export const firstFreeSlot = (
  blocks: ScheduleBlock[],
  from: DayMinute,
  durationMins: number,
): DayMinute => {
  const busy = [...blocks].sort((a, b) => a.start - b.start);
  let cursor = from;
  for (const b of busy) {
    if (blockEnd(b) <= cursor) continue;
    if (b.start >= cursor + durationMins) break;
    cursor = blockEnd(b);
  }
  return cursor + durationMins <= DAY_MINUTES ? cursor : from;
};

/** The next block that has not started yet, for the Today strip. */
export const nextBlock = (blocks: ScheduleBlock[], minute: DayMinute): ScheduleBlock | null =>
  blocks.filter(b => b.start >= minute).sort((a, b) => a.start - b.start)[0] || null;

/** The block currently underway, if any. */
export const currentBlock = (blocks: ScheduleBlock[], minute: DayMinute): ScheduleBlock | null =>
  blocks.find(b => b.start <= minute && minute < blockEnd(b)) || null;

/* ── Adherence ─────────────────────────────────────────────────── */

export interface BlockOutcome {
  minutes: number;
  /** The app measured this against the block itself, rather than inferring it. */
  attributed: boolean;
}

export interface DayAdherence {
  plannedMins: number;
  honouredMins: number;
  /** 0…1, capped. Zero planned minutes reads as zero, not as a perfect day. */
  adherence: number;
  /** Studied, but against nothing that was planned. */
  offPlanMins: number;
  perBlock: Record<string, BlockOutcome>;
  /** Planned blocks whose time has passed with nothing to show for it. */
  skipped: ScheduleBlock[];
  /** Planned blocks still ahead of now. Not yet a verdict either way. */
  pending: ScheduleBlock[];
  /** True when any block's minutes were inferred rather than measured. */
  hasInferred: boolean;
}

/**
 * Plan against reality for one day.
 *
 * A DailyLog has a date, a subject and a number of hours — no start time —
 * and until now nothing wrote `chapter` either. So per-block truth exists in
 * exactly one case: the session was started from the block, which stamps
 * `blockId` on the log. Everything else is an allocation, and the UI says so
 * rather than dressing a guess up as a measurement.
 *
 * `minute` is where "now" is on the day being viewed, or null for a day that
 * is already over — it only decides whether an untouched block reads as
 * skipped or as still ahead of you.
 */
export const computeAdherence = (
  blocks: ScheduleBlock[],
  logs: DailyLog[],
  date: string,
  minute: DayMinute | null,
): DayAdherence => {
  /* Only study counts. Sleep and dinner are what the day is made of, not a
     debt against it — and a block with no subject can never be matched to a
     log, which carries one. */
  const planned = blocks.filter(b => countsAsStudy(b.kind) && !!b.subject);
  const perBlock: Record<string, BlockOutcome> = {};
  for (const b of planned) perBlock[b.id] = { minutes: 0, attributed: false };

  const dayLogs = logs.filter(l => l.date === date);
  const spent = new Set<string>();

  // Tier 1 — measured against this exact block.
  for (const log of dayLogs) {
    if (!log.blockId) continue;
    const slot = perBlock[log.blockId];
    if (!slot) continue;
    slot.minutes += log.hours * 60;
    slot.attributed = true;
    spent.add(log.id);
  }

  // Tier 2 — allocate what is left to same-subject blocks the app did not watch.
  const pool: Partial<Record<Subject, number>> = {};
  for (const log of dayLogs) {
    if (spent.has(log.id)) continue;
    pool[log.subject] = (pool[log.subject] || 0) + log.hours * 60;
  }

  /* Chronological, not largest-first. If you planned Physics at 06:00 and
     again at 20:00 and only did an hour, the honest reading is that you did
     the morning one and quit — not that you did whichever was bigger. It also
     leaves the late block correctly marked skipped. */
  let hasInferred = false;
  const unwatched = planned
    .filter(b => !perBlock[b.id].attributed)
    .sort((a, b) => a.start - b.start);

  for (const b of unwatched) {
    const subject = b.subject!;
    const available = pool[subject] || 0;
    if (available <= 0) continue;
    const take = Math.min(available, b.durationMins);
    perBlock[b.id].minutes += take;
    pool[subject] = available - take;
    if (take > 0) hasInferred = true;
  }

  const offPlanMins = Object.values(pool).reduce<number>((a, b) => a + (b || 0), 0);

  const plannedMins = planned.reduce((a, b) => a + b.durationMins, 0);
  const honouredMins = planned.reduce(
    (a, b) => a + Math.min(perBlock[b.id].minutes, b.durationMins),
    0,
  );

  const isOver = (b: ScheduleBlock) => minute === null || blockEnd(b) <= minute;
  const untouched = planned.filter(b => perBlock[b.id].minutes <= 0);

  return {
    plannedMins,
    honouredMins,
    adherence: plannedMins > 0 ? Math.min(1, honouredMins / plannedMins) : 0,
    offPlanMins,
    perBlock,
    skipped: untouched.filter(isOver),
    pending: untouched.filter(b => !isOver(b)),
    hasInferred,
  };
};

/* ── Sync ──────────────────────────────────────────────────────── */

export const EMPTY_SCHEDULE: ScheduleState = { blocks: [], rules: [], overrides: [] };

const unionById = <T extends { id: string }>(mine: T[], theirs: T[]): T[] => {
  const out = [...mine];
  for (const t of theirs) if (!out.some(m => m.id === t.id)) out.push(t);
  return out;
};

/**
 * Two devices' plans, reconciled.
 *
 * Blocks and rules are things the user created, exactly like logs and tasks,
 * so last-write-wins would silently drop one made on the other device. On a
 * genuine collision — two devices moving the same rule instance, which share
 * the id `${ruleId}@${date}` — `mine` wins, for the reason mergeRewards
 * gives: the merge always runs on the device the user is looking at.
 */
export const mergeSchedule = (
  mine: ScheduleState,
  theirs: ScheduleState | undefined,
): ScheduleState => {
  if (!theirs) return mine;
  return {
    blocks: unionById(mine.blocks, theirs.blocks),
    rules: unionById(mine.rules, theirs.rules),
    overrides: unionById(mine.overrides, theirs.overrides),
  };
};
