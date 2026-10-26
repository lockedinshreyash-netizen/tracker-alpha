import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANSWER_MS, SITTING_MS, checkStatus, pauseStopwatchForCheck, pomodoroCheckAt, pausePomodoroForCheck, stopwatchCheckAt, stopwatchKeeps } from '../presence';
import { resumeRun, sessionSpan } from '../stopwatch';
import { PomodoroRuntime, TimerState } from '../../types';

const H = 3_600_000;
const T0 = Date.parse('2026-10-26T06:00:00Z'); // 11:30 IST
const run = (over: Partial<TimerState> = {}): TimerState =>
  ({ isRunning: true, startTime: T0, accumulatedMs: 0, subject: 'Physics', ...over });

test('a run is asked 3.5h after the last start or resume', () => {
  assert.equal(stopwatchCheckAt(run()), T0 + SITTING_MS);
  assert.equal(stopwatchCheckAt(run({ isRunning: false, startTime: null, accumulatedMs: H })), null);
  // A resume is a tap: the clock starts over from the resume.
  const resumed = resumeRun({ ...run(), isRunning: false, startTime: null, accumulatedMs: H, pausedAt: T0 + H }, T0 + 2 * H).update;
  assert.equal(stopwatchCheckAt({ ...run(), ...resumed } as TimerState), T0 + 2 * H + SITTING_MS);
});

test('status walks none → due → asking → missed on the wall clock', () => {
  const at = T0 + SITTING_MS;
  assert.equal(checkStatus(at, false, at - 1), 'none');
  assert.equal(checkStatus(at, false, at), 'due');
  assert.equal(checkStatus(at, true, at + ANSWER_MS - 1), 'asking');
  assert.equal(checkStatus(at, true, at + ANSWER_MS), 'missed');
  // App closed overnight: missed straight away, never asked.
  assert.equal(checkStatus(at, false, at + 8 * H), 'missed');
});

test('the pause lands on the check instant, not when it was noticed', () => {
  const at = T0 + SITTING_MS;
  const t = { ...run(), ...pauseStopwatchForCheck(run(), at) } as TimerState;
  assert.equal(t.isRunning, false);
  assert.equal(t.accumulatedMs, SITTING_MS);
  assert.equal(t.pausedAt, at);
  assert.equal(stopwatchCheckAt(t), at);
  // "I'm done": everything up to the check, nothing after.
  assert.equal(sessionSpan(t, at + 5 * 60_000).hours, 3.5);
});

test('a miss keeps only time that ended with a tap', () => {
  // 1h studied, paused, resumed: the second run is the unanswered one.
  const t = run({ accumulatedMs: H });
  const at = T0 + SITTING_MS;
  const keep = stopwatchKeeps(t, at)!;
  assert.equal(keep.hours, 1);
  assert.equal(keep.endedAt, T0);
  const paused = { ...t, ...pauseStopwatchForCheck(t, at) } as TimerState;
  assert.deepEqual(stopwatchKeeps(paused, at), keep);
  // Nothing before the last tap: nothing kept.
  assert.equal(stopwatchKeeps(run(), at), null);
});

test('Pomodoro is asked 3.5h after the last tap, never on an auto-started chain alone', () => {
  const p: PomodoroRuntime = {
    phase: 'work', phaseEndsAt: T0 + 25 * 60_000, isRunning: true, phaseTotalMs: 25 * 60_000,
    servedMs: 0, completedBlocks: 0, subject: 'Physics', pendingRating: [], presenceAt: T0 - 3 * H,
  };
  assert.equal(pomodoroCheckAt(p), T0 - 3 * H + SITTING_MS);
  assert.equal(pomodoroCheckAt({ ...p, presenceAt: undefined }), null);
  const at = T0 + 10 * 60_000;
  const paused = { ...p, ...pausePomodoroForCheck(p, at) };
  assert.equal(paused.isRunning, false);
  assert.equal(paused.servedMs, 10 * 60_000);
  assert.equal(pomodoroCheckAt(paused), at);
});
