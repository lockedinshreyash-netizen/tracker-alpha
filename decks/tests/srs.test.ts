import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preview, intervalLabel } from '../srs';
import { studyDayStart } from '../day';
import { answer, appendCards, current, interleave, remaining, startSession } from '../session';
import type { Progress, QueueCard } from '../types';

const now = new Date('2026-10-06T10:00:00+05:30');

test('new card: Again/Hard stay in learning, Good steps, Easy graduates', () => {
  const p = preview(null, now);
  assert.equal(p[1].next.state, 1);
  assert.equal(p[1].label, '1m');
  assert.equal(p[3].next.state, 1);
  assert.equal(p[3].label, '10m');
  assert.equal(p[4].next.state, 2);
  assert.ok(p[4].next.scheduledDays >= 1);
});

test('learning card: Good on the last step graduates to review', () => {
  const step1 = preview(null, now)[3].next;
  const later = new Date(now.getTime() + 10 * 60_000);
  const p = preview(step1, later);
  assert.equal(p[3].next.state, 2);
  assert.ok(p[3].next.scheduledDays >= 1);
});

test('review card: intervals are ordered Again < Hard <= Good <= Easy', () => {
  const r: Progress = { state: 2, due: now.toISOString(), stability: 10, difficulty: 5, scheduledDays: 10, learningSteps: 0, reps: 4, lapses: 0, lastReview: new Date(now.getTime() - 10 * 86400000).toISOString() };
  const p = preview(r, now);
  assert.equal(p[1].next.state, 3);
  assert.equal(p[1].next.lapses, 1);
  assert.ok(p[2].next.scheduledDays <= p[3].next.scheduledDays);
  assert.ok(p[3].next.scheduledDays <= p[4].next.scheduledDays);
  assert.ok(p[3].next.scheduledDays > 10);
});

test('overdue review still schedules forward', () => {
  const r: Progress = { state: 2, due: new Date(now.getTime() - 30 * 86400000).toISOString(), stability: 5, difficulty: 5, scheduledDays: 5, learningSteps: 0, reps: 3, lapses: 0, lastReview: new Date(now.getTime() - 35 * 86400000).toISOString() };
  const p = preview(r, now);
  assert.ok(new Date(p[3].next.due).getTime() > now.getTime());
});

test('day-length intervals are pinned to 04:00 IST', () => {
  const p = preview(null, now)[4].next;
  const due = new Date(p.due);
  assert.equal(due.getTime(), studyDayStart(due).getTime());
  assert.equal(due.toISOString().slice(11, 16), '22:30'); // 04:00 IST
});

test('labels', () => {
  const base: Progress = { state: 2, due: now.toISOString(), stability: 1, difficulty: 5, scheduledDays: 45, learningSteps: 0, reps: 1, lapses: 0, lastReview: null };
  assert.equal(intervalLabel(base, now), '1.5mo');
  assert.equal(intervalLabel({ ...base, scheduledDays: 400 }, now), '1.1y');
  assert.equal(intervalLabel({ ...base, state: 1, scheduledDays: 0, due: new Date(now.getTime() + 30_000).toISOString() }, now), '<1m');
});

const card = (id: string, state: 0 | 1 | 2 | 3 = 0, due = now.toISOString()): QueueCard => ({
  cardId: id, noteId: `n${id}`, ord: 1, kind: 'cloze', front: `{{c1::${id}}}`, back: '', tags: [],
  progress: state === 0 ? null : { state, due, stability: 1, difficulty: 5, scheduledDays: state === 2 ? 3 : 0, learningSteps: 0, reps: 1, lapses: 0, lastReview: null },
});

test('session: learning first, new cards spread through reviews', () => {
  const order = interleave([card('n1'), card('n2'), card('r1', 2), card('r2', 2), card('r3', 2), card('r4', 2), card('l1', 1)]).map(c => c.cardId);
  assert.equal(order[0], 'l1');
  assert.notDeepEqual(order.slice(-2), ['n1', 'n2']);
  assert.equal(order.length, 7);
});

test('session: Again comes back after its step, learn-ahead pulls it forward at the end', () => {
  let s = startSession([card('a'), card('b')]);
  const t = now.getTime();
  const dayEnd = t + 12 * 3600_000;
  const p1 = current(s, t)!;
  assert.equal(p1.card.cardId, 'a');
  s = answer(s, p1, 1, preview(null, now)[1].next, dayEnd);
  assert.equal(remaining(s), 2);
  const p2 = current(s, t)!;
  assert.equal(p2.card.cardId, 'b');
  s = answer(s, p2, 4, preview(null, now)[4].next, dayEnd);
  const p3 = current(s, t)!;
  assert.equal(p3.card.cardId, 'a');
  assert.equal(p3.from, 'learning');
  s = answer(s, p3, 4, preview(p3.card.progress, now)[4].next, dayEnd);
  assert.equal(current(s, t), null);
  assert.equal(s.done, 3);
  assert.deepEqual(s.answered, { 1: 1, 2: 0, 3: 0, 4: 2 });
});

test('session: prefetch never adds a card twice', () => {
  let s = startSession([card('a')]);
  s = appendCards(s, [card('a'), card('b')]);
  assert.deepEqual(s.queue.map(c => c.cardId), ['a', 'b']);
});
