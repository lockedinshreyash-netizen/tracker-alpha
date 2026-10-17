import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOAL_EARLIEST, LAST_CALL, NUDGE_STALE_MS, Nudge, NudgeDay, dueNudge, goalCopy, goalMinute, nudgeDay, planNudges } from '../nudges';

/* The real istInstant: study-day minute 0 is 04:00 IST. */
const istInstant = (date: string, minute: number): number => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) + (4 * 60 + minute) * 60_000 - 5.5 * 3_600_000;
};

const day = (d: string, hours = 0, streak = 12, bank = 0): NudgeDay => ({ day: d, hours, streak, bank });
const at = (d: string, minute: number) => istInstant(d, minute);
const SIX_PM = 840;

const plan = (days: NudgeDay[], now: number, goal = 10, studyMinute: number | undefined = SIX_PM, nudge = true, past = false) =>
  planNudges({ prefs: { nudge, studyMinute }, goalHours: goal, days, instant: istInstant, now }, past);

test('nothing at all unless the student asked for it', () => {
  assert.deepEqual(plan([day('2026-10-17')], at('2026-10-17', 0), 10, SIX_PM, false), []);
  const noTime = planNudges({ prefs: { nudge: true, studyMinute: undefined }, goalHours: 10, days: [day('2026-10-17')], instant: istInstant, now: at('2026-10-17', 0) });
  assert.deepEqual(noTime, []);
});

test('a fresh day gets start at 6 PM, the goal check at 9 PM, and the last call at 11 PM', () => {
  const n = plan([day('2026-10-17')], at('2026-10-17', 0));
  assert.deepEqual(n.map(x => [x.kind, x.minute]), [['start', SIX_PM], ['goal', SIX_PM + 180], ['last', LAST_CALL]]);
  assert.equal(n[0].copy.body, 'Day 13 starts now. 10h to go. Start the clock.');
});

test('the goal check never lands before 8 PM or after 10 PM', () => {
  assert.equal(goalMinute(300), GOAL_EARLIEST);       // studies at 9 AM → 8 PM check
  assert.equal(goalMinute(1000), 1080);                 // studies at 8:40 PM → 10 PM check
  assert.equal(goalMinute(1060), null);                 // too close to the start: no goal check
});

test('the user’s own example: 2.5h logged of 10', () => {
  assert.deepEqual(goalCopy(day('2026-10-17', 2.5), 10), {
    title: '7.5H TO GO',
    body: 'Only 7.5 hours left of your 10-hour goal. The day is not over yet.',
  });
});

test('logging anything drops start and last; only the goal check remains', () => {
  const n = plan([day('2026-10-17', 2.5)], at('2026-10-17', 0));
  assert.deepEqual(n.map(x => x.kind), ['goal']);
});

test('hitting the goal silences the rest of the day', () => {
  assert.deepEqual(plan([day('2026-10-17', 10)], at('2026-10-17', 0)), []);
  assert.deepEqual(plan([day('2026-10-17', 11)], at('2026-10-17', 0)), []);
});

test('no streak, no last call', () => {
  const n = plan([day('2026-10-17', 0, 0)], at('2026-10-17', 0));
  assert.deepEqual(n.map(x => x.kind), ['start', 'goal']);
  assert.equal(n[0].copy.body, 'You said this is when you study. 10h to go. Start the clock.');
});

test('firewood changes the last call from a loss to a cost', () => {
  const held = plan([day('2026-10-17', 0, 12, 2)], at('2026-10-17', 0)).find(x => x.kind === 'last')!;
  assert.equal(held.copy.body, 'Skip today and it burns 1 firewood. One session keeps it clean.');
  const bare = plan([day('2026-10-17', 0, 12, 0)], at('2026-10-17', 0)).find(x => x.kind === 'last')!;
  assert.equal(bare.copy.title, '12-DAY STREAK ON THE LINE');
});

test('slots already past are not published', () => {
  const n = plan([day('2026-10-17')], at('2026-10-17', SIX_PM + 1));
  assert.deepEqual(n.map(x => x.kind), ['goal', 'last']);
});

test('future days are planned from their own numbers, earliest first', () => {
  const n = plan([day('2026-10-17', 3), day('2026-10-18', 0, 12, 1)], at('2026-10-17', 0));
  assert.deepEqual(n.map(x => `${x.day}:${x.kind}`), ['2026-10-17:goal', '2026-10-18:start', '2026-10-18:goal', '2026-10-18:last']);
});

test('keys are unique and name their day', () => {
  const n = plan([day('2026-10-17'), day('2026-10-18')], at('2026-10-17', 0));
  assert.equal(new Set(n.map(x => x.key)).size, n.length);
  assert.equal(nudgeDay(n[0].key), '2026-10-17');
});

test('the open app says only the latest due nudge, and never a stale one', () => {
  const all = plan([day('2026-10-17')], at('2026-10-17', 0), 10, SIX_PM, true, true);
  const [start, goal] = all as [Nudge, Nudge];
  const justAfterGoal = goal.at + 60_000;
  const r = dueNudge(all, new Set(), justAfterGoal);
  assert.equal(r.fire?.kind, 'goal');
  assert.deepEqual(r.skip.map(x => x.key), [start.key]);

  const handled = dueNudge(all, new Set([goal.key, start.key]), justAfterGoal);
  assert.equal(handled.fire, null);

  const late = dueNudge(all, new Set(), goal.at + NUDGE_STALE_MS + 1);
  assert.equal(late.fire, null);
  assert.equal(late.skip.length, 2);
});
