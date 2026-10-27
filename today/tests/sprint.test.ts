import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  Draft, MAX_SPRINT_MS, OVERTIME_MAX_MS, allDone, deadlineAt, endSprint, extendSprint, leftMs, mergeSprints,
  normalizeSprint, normalizeSprints, openTasks, parseMinutes, pauseSprint, restartDraft, resumeSprint,
  sprintStats, startSprint, statusOf, toggleItem, workedMs,
} from '../sprint';
import { heldMode } from '../pomodoro';
import { IDLE_POMODORO } from '../../state';
import { SprintRecord, SprintRuntime, Task } from '../../types';

const M = 60_000;
const T0 = Date.parse('2026-10-26T06:00:00Z'); // 11:30 IST
const begin = (minutes = 30, items: Draft['items'] = [{ text: 'Solve 15 Electrostatics PYQs', taskId: 't1' }]): SprintRuntime =>
  startSprint({ items, subject: 'Physics', minutes }, 's1', T0)!;

test('durations: whole minutes from 1 to 180 only', () => {
  assert.equal(parseMinutes(30), 30);
  assert.equal(parseMinutes(' 45 '), 45);
  assert.equal(parseMinutes(180), 180);
  for (const bad of [0, -5, 181, 2.5, NaN, '', 'ten', '1e9']) assert.equal(parseMinutes(bad as any), null, String(bad));
});

test('a draft needs a title and a valid time, and keeps at most two items', () => {
  assert.equal(startSprint({ items: [], subject: 'Physics', minutes: 30 }, 'x', T0), null);
  assert.equal(startSprint({ items: [{ text: '   ' }], subject: 'Physics', minutes: 30 }, 'x', T0), null);
  assert.equal(startSprint({ items: [{ text: 'a' }], subject: 'Physics', minutes: 0 }, 'x', T0), null);
  const r = startSprint({ items: [{ text: 'a' }, { text: 'b' }, { text: 'c' }], subject: 'Physics', minutes: 5 }, 'x', T0)!;
  assert.deepEqual(r.items.map(i => i.text), ['a', 'b']);
  assert.equal(r.allowedMs, 5 * M);
});

test('the countdown is read off the clock, not ticked down', () => {
  const r = begin();
  assert.equal(leftMs(r, T0 + 10 * M), 20 * M);
  // A tab asleep for 25 minutes wakes to the right figure.
  assert.equal(leftMs(r, T0 + 25 * M), 5 * M);
  // A clock moved backwards cannot add time.
  assert.equal(workedMs(r, T0 - 60 * M), 0);
});

test('a pause freezes what is left, and resuming carries on from it', () => {
  let r = pauseSprint(begin(), T0 + 29 * M);
  assert.equal(statusOf(r, T0 + 5 * 60 * M), 'paused');
  assert.equal(leftMs(r, T0 + 5 * 60 * M), M);
  r = resumeSprint(r, T0 + 40 * M).runtime;
  assert.equal(r.pausedMs, 11 * M);
  assert.equal(leftMs(r, T0 + 40 * M), M);
  assert.equal(deadlineAt(r), T0 + 41 * M);
  assert.equal(statusOf(r, T0 + 41 * M), 'over');
});

test('extending moves the deadline, from the clock when already over, never past 3h', () => {
  let r = extendSprint(begin(), 10, T0 + 5 * M);
  assert.equal(r.extendedMs, 10 * M);
  assert.equal(leftMs(r, T0 + 5 * M), 35 * M);
  // 4 minutes over (44 worked of 40), +5 means five more minutes on the clock.
  r = extendSprint(r, 5, T0 + 44 * M);
  assert.equal(r.extensions, 2);
  assert.equal(leftMs(r, T0 + 44 * M), 5 * M);
  assert.equal(r.allowedMs, 30 * M); // the original allowance is kept
  const long = begin(178);
  assert.equal(extendSprint(long, 5, T0), long); // would pass 180
  assert.equal(extendSprint(long, 0, T0), long);
});

test('expiry is a state, never a completion, and only on_time/late mean finished', () => {
  const r = begin();
  assert.equal(statusOf(r, T0 + 30 * M), 'over');
  const end = endSprint(r, 'expire', T0 + 32 * M);
  assert.equal(end.record.outcome, 'expired');
  assert.equal(end.record.items[0].doneAt, undefined);
  assert.equal(endSprint(r, 'abandon', T0 + 10 * M).record.outcome, 'abandoned');
});

test('completing before, at and after the deadline', () => {
  const ticked = (at: number) => toggleItem(begin(), 's1.0', at);
  const early = endSprint(ticked(T0 + 24 * M), 'complete', T0 + 24 * M).record;
  assert.equal(early.outcome, 'on_time');
  assert.equal(early.finalMs - early.workedMs, 6 * M);
  assert.equal(endSprint(ticked(T0 + 30 * M), 'complete', T0 + 30 * M).record.outcome, 'on_time');
  const late = endSprint(ticked(T0 + 34 * M), 'complete', T0 + 34 * M).record;
  assert.equal(late.outcome, 'late');
  assert.equal(late.workedMs, 34 * M);
  // Judged against the extended deadline, with the first allowance kept beside it.
  const ext = extendSprint(begin(), 10, T0 + 20 * M);
  const r = endSprint(toggleItem(ext, 's1.0', T0 + 34 * M), 'complete', T0 + 34 * M).record;
  assert.equal(r.outcome, 'on_time');
  assert.equal(r.allowedMs, 30 * M);
  assert.equal(r.finalMs, 40 * M);
  assert.equal(r.extensions, 1);
});

test('unanswered overtime ends as expired and counts only to the deadline', () => {
  const r = begin();
  const at = T0 + 30 * M + OVERTIME_MAX_MS;
  assert.equal(statusOf(r, at), 'stale');
  // Even "complete" pressed on a stale sprint (a reopened tab) is not a finish.
  const end = endSprint(r, 'complete', at + 8 * 60 * M);
  assert.equal(end.record.outcome, 'expired');
  assert.equal(end.record.workedMs, 30 * M);
  assert.equal(end.record.endedAt, T0 + 30 * M);
  assert.equal(end.span!.endedAt, T0 + 30 * M);
  assert.equal(end.span!.hours, 0.5);
});

test('the log ends where the clock last ran and spans the working time only', () => {
  let r = pauseSprint(begin(), T0 + 10 * M);
  r = resumeSprint(r, T0 + 20 * M).runtime;
  const end = endSprint(r, 'abandon', T0 + 25 * M);
  assert.equal(end.record.workedMs, 15 * M);
  assert.equal(end.record.pausedMs, 10 * M);
  assert.deepEqual(end.span, { hours: 0.25, startedAt: T0 + 10 * M, endedAt: T0 + 25 * M });
  // Under a minute logs nothing.
  assert.equal(endSprint(begin(), 'abandon', T0 + 30_000).span, null);
  // Ended while paused: placed at the pause.
  const paused = endSprint(pauseSprint(begin(), T0 + 12 * M), 'abandon', T0 + 90 * M);
  assert.equal(paused.span!.endedAt, T0 + 12 * M);
});

test('a pause across 04:00 IST banks last night first', () => {
  const night = Date.parse('2026-10-26T17:00:00Z'); // 22:30 IST
  let r = startSprint({ items: [{ text: 'x' }], subject: 'Maths', minutes: 60 }, 'n', night)!;
  r = pauseSprint(r, night + 20 * M);
  const next = night + 10 * 60 * M; // 08:30 IST next day
  const { runtime, bank } = resumeSprint(r, next);
  assert.deepEqual(bank, { hours: 20 / 60, startedAt: night, endedAt: night + 20 * M });
  assert.equal(runtime.bankedMs, 20 * M);
  const end = endSprint(runtime, 'abandon', next + 10 * M);
  assert.equal(end.record.workedMs, 30 * M);
  assert.equal(end.span!.hours, 10 / 60); // only today's part is logged now
});

test('items tick and untick; both must be done', () => {
  let r = begin(30, [{ text: 'a', taskId: 't1' }, { text: 'b' }]);
  r = toggleItem(r, 's1.0', T0 + M, 'doing');
  assert.equal(r.items[0].movedFrom, 'doing');
  assert.equal(allDone(r), false);
  r = toggleItem(r, 's1.0', T0 + 2 * M);
  assert.equal(r.items[0].doneAt, undefined);
  assert.equal(r.items[0].movedFrom, undefined);
  r = toggleItem(toggleItem(r, 's1.0', T0 + 3 * M), 's1.1', T0 + 4 * M);
  assert.equal(allDone(r), true);
});

test('restart keeps the unfinished work and the first allowance', () => {
  let r = extendSprint(begin(25, [{ text: 'a' }, { text: 'b' }]), 10, T0);
  r = toggleItem(r, 's1.0', T0 + M);
  const d = restartDraft(r);
  assert.deepEqual(d.items.map(i => i.text), ['b']);
  assert.equal(d.minutes, 25);
});

test('only open cards can start a sprint, Doing first', () => {
  const tasks: Task[] = [
    { id: 'a', text: 'todo card', completed: false, column: 'todo', order: 0 },
    { id: 'b', text: 'done card', completed: true, column: 'done', order: 0 },
    { id: 'c', text: 'doing card', completed: false, column: 'doing', order: 0 },
    { id: 'd', text: '  ', completed: false, column: 'todo', order: 1 },
  ];
  assert.deepEqual(openTasks(tasks).map(t => t.id), ['c', 'a']);
});

const rec = (over: Partial<SprintRecord>): SprintRecord => ({
  id: 'r', items: [{ id: 'r.0', text: 'x' }], subject: 'Physics', allowedMs: 30 * M, finalMs: 30 * M,
  extensions: 0, workedMs: 20 * M, pausedMs: 0, startedAt: T0, endedAt: T0 + 20 * M, outcome: 'on_time', ...over,
});

test('stats use only what was recorded, and say nothing without enough of it', () => {
  assert.deepEqual(sprintStats([]), { ended: 0, completed: 0, onTime: 0, focusedMs: 0, onTimeRate: null, avgCompletedMs: null, savedMs: 0 });
  const one = sprintStats([rec({})]);
  assert.equal(one.onTimeRate, null);
  assert.equal(one.avgCompletedMs, null);
  assert.equal(one.savedMs, 10 * M);
  const s = sprintStats([
    rec({ id: 'a' }),
    rec({ id: 'b', outcome: 'late', workedMs: 40 * M }),
    rec({ id: 'c', outcome: 'expired', workedMs: 30 * M }),
    rec({ id: 'd', outcome: 'abandoned', workedMs: 5 * M }),
  ]);
  assert.equal(s.completed, 2);
  assert.equal(s.onTimeRate, 0.25);
  assert.equal(s.avgCompletedMs, 30 * M);
  assert.equal(s.focusedMs, 95 * M);
  assert.equal(s.savedMs, 10 * M);
});

test('history unions by id, drops junk and stays bounded', () => {
  const merged = mergeSprints([rec({ id: 'a' }), rec({ id: 'b' })], [rec({ id: 'b' }), rec({ id: 'c' }), { id: 'junk' }, null]);
  assert.deepEqual(merged.map(r => r.id).sort(), ['a', 'b', 'c']);
  const many = Array.from({ length: 320 }, (_, i) => rec({ id: `x${i}`, endedAt: T0 + i }));
  const kept = normalizeSprints(many);
  assert.equal(kept.length, 300);
  assert.equal(kept[0].id, 'x20');
  assert.deepEqual(normalizeSprints(undefined), []);
});

test('a saved sprint survives a reload in the state it was left', () => {
  const paused = pauseSprint(begin(), T0 + 5 * M);
  const back = normalizeSprint(JSON.parse(JSON.stringify(paused)))!;
  assert.equal(back.runStartedAt, null);
  assert.equal(leftMs(back, T0 + 99 * M), 25 * M);
  const running = normalizeSprint(JSON.parse(JSON.stringify(begin())))!;
  assert.equal(leftMs(running, T0 + 10 * M), 20 * M);
  assert.equal(normalizeSprint({ id: 'x', items: [], allowedMs: 1, startedAt: 1 }), null);
  assert.equal(normalizeSprint(null), null);
  assert.ok(MAX_SPRINT_MS + OVERTIME_MAX_MS <= 3.5 * 60 * M);
});

test('an armed sprint holds the timer mode', () => {
  const idle = { isRunning: false, startTime: null, accumulatedMs: 0, subject: 'Physics' as const };
  assert.equal(heldMode(idle, IDLE_POMODORO, begin()), 'sprint');
  assert.equal(heldMode(idle, IDLE_POMODORO, null), null);
  assert.equal(heldMode({ ...idle, isRunning: true, startTime: T0 }, IDLE_POMODORO, begin()), 'stopwatch');
});
