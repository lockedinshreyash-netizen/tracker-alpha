import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preview, intervalLabel } from '../srs';
import { studyDayStart } from '../day';
import { answer, appendCards, applyPending, current, holding, interleave, remaining, startSession } from '../session';
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

test('session: a card answered before leaving waits out its step on return', () => {
  const t = now.getTime();
  const justAnswered = card('j', 1, new Date(t + 9 * 60_000).toISOString());
  const s = startSession([justAnswered, card('n1'), card('r1', 2)], t);
  assert.deepEqual(s.queue.map(c => c.cardId).sort(), ['n1', 'r1']);
  assert.equal(s.learning.length, 1);
  assert.notEqual(current(s, t)!.card.cardId, 'j');
  // Due now: shown first.
  const overdue = startSession([card('o', 1, new Date(t - 60_000).toISOString()), card('n2')], t);
  assert.equal(current(overdue, t)!.card.cardId, 'o');
});

test('session: unsent answers are laid over the server queue', () => {
  const t = now.getTime();
  const dayEnd = t + 6 * 3600_000;
  const learning: Progress = { state: 1, due: new Date(t + 10 * 60_000).toISOString(), stability: 1, difficulty: 5, scheduledDays: 0, learningSteps: 1, reps: 1, lapses: 0, lastReview: now.toISOString() };
  const tomorrow: Progress = { ...learning, state: 2, due: new Date(dayEnd + 3600_000).toISOString(), scheduledDays: 1 };
  const out = applyPending([card('a'), card('b'), card('c')], new Map([['a', learning], ['b', tomorrow]]), dayEnd);
  assert.deepEqual(out.map(c => c.cardId), ['a', 'c']);
  assert.equal(out[0].progress?.state, 1);
  const s = startSession(out, t);
  assert.equal(current(s, t)!.card.cardId, 'c');
});

test('session: a pack mixes its decks — new cards take turns, reviews by due', () => {
  const t = now.getTime();
  const at = (m: number) => new Date(t - m * 60_000).toISOString();
  const inDeck = (c: QueueCard, deckId: string) => ({ ...c, deckId });
  const cards = [
    inDeck(card('a1'), 'A'), inDeck(card('a2'), 'A'), inDeck(card('a3'), 'A'),
    inDeck(card('b1'), 'B'),
    inDeck(card('ra', 2, at(5)), 'A'), inDeck(card('rb', 2, at(50)), 'B'),
  ];
  const order = interleave(cards).map(c => c.cardId);
  assert.deepEqual(order.filter(id => !id.startsWith('r')), ['a1', 'b1', 'a2', 'a3']);
  assert.deepEqual(order.filter(id => id.startsWith('r')), ['rb', 'ra']);
});

test('session: the card on screen stays until it is answered, even when a learning card comes due', () => {
  const t = now.getTime();
  const dayEnd = t + 12 * 3600_000;
  let s = startSession([card('a'), card('b'), card('c')], t);
  // Answer a with Again: it comes back in a minute.
  const pa = current(s, t)!;
  s = answer(s, pa, 1, preview(null, now)[1].next, dayEnd);
  // b is put on screen…
  const pb = current(s, t)!;
  assert.equal(pb.card.cardId, 'b');
  // …and two minutes later, with a now due, b is still the card being studied.
  const later = t + 2 * 60_000;
  assert.equal(current(s, later)!.card.cardId, 'a', 'a is due now');
  assert.equal(holding(s, pb)!.card.cardId, 'b', 'but b stays on screen');
  // Answering b releases it; only then does a come up.
  s = answer(s, pb, 3, preview(null, now)[3].next, dayEnd);
  assert.equal(holding(s, pb), null);
  assert.equal(current(s, later)!.card.cardId, 'a');
});

test('session: a learning card answered again is released, not shown twice', () => {
  const t = now.getTime();
  const dayEnd = t + 12 * 3600_000;
  let s = startSession([card('a')], t);
  s = answer(s, current(s, t)!, 1, preview(null, now)[1].next, dayEnd);
  const later = new Date(t + 61_000);
  const p = current(s, later.getTime())!;
  assert.equal(p.from, 'learning');
  s = answer(s, p, 1, preview(p.card.progress, later)[1].next, dayEnd);
  assert.equal(holding(s, p), null, 'the same card, but a new state: released');
});
