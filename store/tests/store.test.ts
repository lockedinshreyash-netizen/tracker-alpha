import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupEntries, searchEntries, shelfItems } from '../model';
import { dollarsToTex, hasDollarMath, readFormulaFile, toFormulaNotes } from '../formulas';
import { actionFor, checkout } from '../checkout';
import { kitLine, sheetLine, type KitItem, type SheetEntry } from '../types';

const e = (deckId: string, front: string, back = '', tags: string[] = []): SheetEntry =>
  ({ deckId, deckTitle: deckId.toUpperCase(), noteId: `${deckId}:${front}`, kind: 'basic', front, back, tags });

/* ── Sheets ── */

test('sheet: entries group into sections in reading order', () => {
  const g = groupEntries([e('a', '1'), e('a', '2'), e('b', '3'), e('a', '4')]);
  assert.deepEqual(g.map(s => [s.deckId, s.entries.length]), [['a', 2], ['b', 1], ['a', 1]]);
  assert.equal(g[0].title, 'A');
  assert.deepEqual(groupEntries([]), []);
});

test('sheet: search needs every word, looks at label, formula, tags and section', () => {
  const list = [e('kin', 'Range of a projectile', '\\(R = u^2 \\sin 2\\theta / g\\)', ['projectile']), e('kin', 'Kinetic energy', '\\(K = \\tfrac12 mv^2\\)'), e('law', 'Impulse', '<b>J</b> = Δp')];
  assert.equal(searchEntries(list, '').length, 3);
  assert.deepEqual(searchEntries(list, 'range projectile').map(x => x.front), ['Range of a projectile']);
  assert.deepEqual(searchEntries(list, 'mv^2').map(x => x.front), ['Kinetic energy']);
  assert.deepEqual(searchEntries(list, 'law').map(x => x.front), ['Impulse'], 'the section title counts');
  assert.deepEqual(searchEntries(list, 'j = δp').map(x => x.front), ['Impulse'], 'markup is ignored');
  assert.equal(searchEntries(list, 'range energy').length, 0, 'every word must appear');
});

test('sheet: curly quotes and apostrophes fold', () => {
  const list = [e('law', 'Newton’s second law', 'F = ma')];
  assert.equal(searchEntries(list, "newton's").length, 1);
  assert.equal(searchEntries(list, 'newtons').length, 1);
});

/* ── The shelf ── */

const item = (kind: KitItem['kind'], id: string): KitItem => ({ kind, id, title: id, subject: null, status: 'published', count: 1 });

test('shelf: a kit you own is one item; what it brought is not listed again', () => {
  const kits = [{ id: 'k1', inLibrary: true, items: [item('pack', 'p1'), item('sheet', 's1'), item('deck', 'd1')] }, { id: 'k2', inLibrary: false, items: [item('pack', 'p2')] }];
  const packs = [{ id: 'p1', inLibrary: true }, { id: 'p2', inLibrary: true }, { id: 'p3', inLibrary: false }];
  const sheets = [{ id: 's1', inLibrary: true }, { id: 's2', inLibrary: true }];
  const s = shelfItems(kits, packs, sheets);
  assert.deepEqual(s.kits, ['k1']);
  assert.deepEqual(s.packs, ['p2'], 'p1 came in the kit; p2 is in a kit you do not own, so it shows; p3 is not yours');
  assert.deepEqual(s.sheets, ['s2']);
  assert.ok(s.hiddenDecks.has('d1'));
});

test('shelf: with no kits, everything you own shows', () => {
  const s = shelfItems([], [{ id: 'p1', inLibrary: true }], [{ id: 's1', inLibrary: true }]);
  assert.deepEqual([s.packs, s.sheets], [['p1'], ['s1']]);
  assert.equal(s.hiddenDecks.size, 0);
});

/* ── Formulas files ── */

test('formulas: $…$ becomes \\(…\\), $$…$$ becomes \\[…\\], \\$ stays a dollar', () => {
  assert.equal(dollarsToTex('$K = \\tfrac12 mv^2$'), '\\(K = \\tfrac12 mv^2\\)');
  assert.equal(dollarsToTex('Area: $$A = \\pi r^2$$'), 'Area: \\[A = \\pi r^2\\]');
  assert.equal(dollarsToTex('costs \\$5'), 'costs $5');
  assert.equal(dollarsToTex('$a$ and $b$'), '\\(a\\) and \\(b\\)');
  assert.equal(dollarsToTex('no maths here'), 'no maths here');
});

test('formulas: a price is not maths, a formula is', () => {
  assert.equal(hasDollarMath('Kinetic energy, $K = \\tfrac12 mv^2$'), true);
  assert.equal(hasDollarMath('Area, $$A = \\pi r^2$$'), true);
  assert.equal(hasDollarMath('It costs $5 and $10'), false);
});

test('formulas: a header row of column names is recognised and skipped', () => {
  const f = readFormulaFile('Name,Formula,Tags\nKinetic energy,$K = \\tfrac12 mv^2$,mechanics\nIdeal gas,$PV = nRT$,gases\n');
  assert.equal(f.headerGuess, true);
  assert.equal(f.dollars, true);
  const rows = toFormulaNotes(f, f.headerGuess, f.dollars);
  const ok = rows.flatMap(r => (r.status === 'ok' ? [r.note] : []));
  assert.equal(ok.length, 2);
  assert.equal(ok[0].front, 'Kinetic energy');
  assert.equal(ok[0].back, '\\(K = \\tfrac12 mv^2\\)');
  assert.deepEqual(ok[0].tags, ['mechanics']);
});

test('formulas: without a header, the first row is a formula', () => {
  const f = readFormulaFile('Kinetic energy,$K = \\tfrac12 mv^2$\nIdeal gas,$PV = nRT$');
  assert.equal(f.headerGuess, false);
  assert.equal(toFormulaNotes(f, false, true).filter(r => r.status === 'ok').length, 2);
});

test('formulas: plain text unless the file has real tags, so a < b survives', () => {
  const f = readFormulaFile('Inequality,a < b and c > d');
  assert.equal(f.html, false);
  const ok = toFormulaNotes(f, false, false).flatMap(r => (r.status === 'ok' ? [r.note] : []));
  assert.equal(ok[0].back, 'a &lt; b and c &gt; d');
  const h = readFormulaFile('Bold,<b>F</b> = ma');
  assert.equal(h.html, true);
});

test('formulas: turning $-maths off leaves dollars alone', () => {
  const f = readFormulaFile('Price,costs $5 or $7');
  const ok = toFormulaNotes(f, false, false).flatMap(r => (r.status === 'ok' ? [r.note] : []));
  assert.equal(ok[0].back, 'costs $5 or $7');
});

test('formulas: a tab-separated file reads the same', () => {
  const f = readFormulaFile('Kinetic energy\t$K = \\tfrac12 mv^2$\tmechanics');
  const ok = toFormulaNotes(f, false, true).flatMap(r => (r.status === 'ok' ? [r.note] : []));
  assert.equal(ok[0].back, '\\(K = \\tfrac12 mv^2\\)');
});

/* ── Checkout and labels ── */

test('checkout: unlocked items are added, locked ones go to the (closed) checkout', async () => {
  assert.equal(actionFor({ kind: 'kit', access: 'free', priceInr: null, unlocked: true }).label, 'Add to Alpha');
  const paid = actionFor({ kind: 'sheet', access: 'paid', priceInr: 49, unlocked: false });
  assert.equal(paid.label, '₹49 · Get sheet');
  assert.equal(paid.needsCheckout, true);
  assert.equal(actionFor({ kind: 'kit', access: 'pro', priceInr: null, unlocked: false }).label, 'Get Alpha Pro');
  const r = await checkout({ kind: 'kit', access: 'paid' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.message, /kits opens soon/);
});

test('labels: kit and sheet lines', () => {
  assert.equal(kitLine([item('pack', 'a'), item('pack', 'b'), item('sheet', 'c')]), '2 packs · 1 sheet');
  assert.equal(kitLine([]), 'Empty for now');
  assert.equal(sheetLine({ entries: 1, decks: [{ id: 'x', title: '', subject: null, status: 'published', entries: 1 }] }), '1 formula · 1 section');
});

/* ── The filter ── */

import { emptyFor, filterLine, matchesSubject, parseFilter, showsType } from '../filter';

test('filter: types and subjects narrow the page', () => {
  assert.equal(showsType({ type: 'all', subject: 'all' }, 'kits'), true);
  assert.equal(showsType({ type: 'sheets', subject: 'all' }, 'kits'), false);
  assert.equal(matchesSubject({ subject: 'Physics' }, { type: 'all', subject: 'Physics' }), true);
  assert.equal(matchesSubject({ subject: null }, { type: 'all', subject: 'Physics' }), false, 'no subject shows only under all');
  assert.equal(matchesSubject({ subject: null }, { type: 'all', subject: 'all' }), true);
});

test('filter: a stored filter is checked, and a subject outside the exam falls back', () => {
  assert.deepEqual(parseFilter('{"type":"kits","subject":"Maths"}', 'JEE'), { type: 'kits', subject: 'Maths' });
  assert.deepEqual(parseFilter('{"type":"kits","subject":"Maths"}', 'NEET'), { type: 'kits', subject: 'all' });
  assert.deepEqual(parseFilter('not json', 'JEE'), { type: 'all', subject: 'all' });
  assert.deepEqual(parseFilter('{"type":"spaceships"}', 'JEE'), { type: 'all', subject: 'all' });
  assert.deepEqual(parseFilter(null, 'JEE'), { type: 'all', subject: 'all' });
});

test('filter: the heading and empty racks say what is shown', () => {
  assert.equal(filterLine({ type: 'kits', subject: 'Physics' }), 'Kits for Physics.');
  assert.equal(filterLine({ type: 'all', subject: 'Chemistry' }), 'Everything for Chemistry.');
  assert.equal(emptyFor('packs', { type: 'all', subject: 'all' }), null);
  assert.equal(emptyFor('sheets', { type: 'all', subject: 'Maths' })?.title, 'No Maths formula sheets yet.');
});
