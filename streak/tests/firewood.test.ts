import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysHeld, ledgerFromDates } from '../firewood';

/** `n` consecutive study days from `from`. */
const days = (from: string, n: number): string[] =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));

test('a 45-day run is held through a 14-day trip, and does not grow', () => {
  const run = days('2026-08-31', 45); // a Monday; ends 2026-10-14, seven weeks studied
  const today = '2026-10-29'; // 10-15 .. 10-28 missed: 14 days
  const L = ledgerFromDates(run, today);
  assert.equal(L.streak, 45);
  assert.equal(L.bank, 7 * 3 - 14);
  assert.equal(L.holding, true);
  assert.equal(daysHeld(L, today), 14);
});

test('coming back adds exactly one day', () => {
  const L = ledgerFromDates([...days('2026-08-31', 45), '2026-10-29'], '2026-10-29');
  assert.equal(L.streak, 46);
  assert.equal(L.holding, false);
  assert.equal(daysHeld(L, '2026-10-29'), 14);
});

test('an empty bank on a missed day ends the streak', () => {
  const L = ledgerFromDates(days('2026-10-05', 3), '2026-10-12'); // bank 3, four days missed
  assert.equal(L.streak, 0);
  assert.equal(L.bank, 0);
  assert.equal(L.longest, 3);
});

test('exactly enough firewood holds', () => {
  const L = ledgerFromDates(days('2026-10-05', 3), '2026-10-11');
  assert.equal(L.streak, 3);
  assert.equal(L.bank, 0);
  assert.equal(L.holding, true);
});

test('today, not over yet, never burns', () => {
  const L = ledgerFromDates(['2026-10-13'], '2026-10-14');
  assert.equal(L.streak, 1);
  assert.equal(L.bank, 3);
  assert.equal(L.holding, false);
});

test('a bank of 30 is 30 days away: a week off earns nothing', () => {
  const run = days('2026-06-01', 70); // ten full weeks: 30 firewood
  assert.equal(ledgerFromDates(run, '2026-09-09').streak, 70); // 30 missed
  assert.equal(ledgerFromDates(run, '2026-09-10').streak, 0); // 31 missed
});

test('unused firewood stays in the bank', () => {
  assert.equal(ledgerFromDates(days('2026-06-01', 28), '2026-06-28').bank, 12);
});

test('dates after today are ignored', () => {
  assert.equal(ledgerFromDates(['2026-10-14', '2026-12-01'], '2026-10-14').streak, 1);
});
