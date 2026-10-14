import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysHeld, FIREWOOD_SINCE, ledgerFromDates as ledgerAt, NO_FIREWOOD } from '../firewood';

/* The mechanics, with firewood live for the whole history. The launch-day
   boundary has its own tests below. */
const ALWAYS = '2000-01-01';
const ledgerFromDates = (dates: string[], today: string) => ledgerAt(dates, today, ALWAYS);

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

/* ── The launch day ── */

test('before launch, a missed day still ends the streak (old rule, no backdating)', () => {
  const run = [...days('2026-09-01', 20), ...days('2026-09-23', 5)]; // gap on 09-21, 09-22
  const L = ledgerAt(run, '2026-09-27', '2026-10-15');
  assert.equal(L.streak, 5);
  assert.equal(L.longest, 20);
  assert.equal(L.bank, 0);
});

test('history before launch earns no firewood', () => {
  const L = ledgerAt(days('2026-01-05', 280), '2026-10-11', '2026-10-15'); // ~40 weeks of study
  assert.equal(L.bank, 0);
  assert.equal(L.streak, 280);
});

test('the bank starts at 0 and fills from the first study day after launch', () => {
  const run = [...days('2026-10-01', 15)]; // 10-01 .. 10-15 (a Thursday)
  const L = ledgerAt(run, '2026-10-15', '2026-10-15');
  assert.equal(L.bank, 3);
  assert.equal(L.streak, 15);
});

test('a missed day after launch burns firewood instead of breaking', () => {
  const run = [...days('2026-10-01', 15)]; // ends 10-15
  const L = ledgerAt(run, '2026-10-17', '2026-10-15'); // 10-16 missed
  assert.equal(L.streak, 15);
  assert.equal(L.bank, 2);
  assert.equal(L.holding, true);
});

test('the shipped launch day is a fixed date', () => {
  assert.match(FIREWOOD_SINCE, /^\d{4}-\d{2}-\d{2}$/);
});

test('the timed streak never gets firewood: a missed day ends it', () => {
  const run = [...days('2026-10-15', 10), '2026-10-27']; // 10-25, 10-26 missed
  const L = ledgerAt(run, '2026-10-27', NO_FIREWOOD);
  assert.equal(L.streak, 1);
  assert.equal(L.longest, 10);
  assert.equal(L.bank, 0);
});
