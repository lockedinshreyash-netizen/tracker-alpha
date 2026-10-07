import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answersFor, isCloze, nextOrdinal, normalizeOrdinals, ordinals, parseCloze, renderAllAnswers, renderCloze } from '../cloze';

const S = 'Aldehydes can be reduced to {{c1::primary alcohols}} using {{c2::LiAlH4}}.';

test('c1 and c2 make two cards', () => {
  assert.deepEqual(ordinals(S), [1, 2]);
  assert.equal(isCloze(S), true);
});

test('card 1 hides c1 and shows c2 as text', () => {
  assert.equal(renderCloze(S, 1, false), 'Aldehydes can be reduced to <span data-cloze="hidden" data-size="l"><span data-sr>blank</span></span> using LiAlH4.');
  assert.equal(renderCloze(S, 2, true), 'Aldehydes can be reduced to primary alcohols using <span data-cloze="shown">LiAlH4</span>.');
});

test('same number twice is one card that hides both', () => {
  const s = '{{c1::Na}} and {{c1::K}} are alkali metals';
  assert.deepEqual(ordinals(s), [1]);
  assert.deepEqual(answersFor(s, 1), ['Na', 'K']);
});

test('hints', () => {
  const p = parseCloze('{{c1::LiAlH4::reducing agent}}');
  assert.deepEqual(p.segs[0], { t: 'cloze', n: 1, answer: 'LiAlH4', hint: 'reducing agent', raw: '{{c1::LiAlH4::reducing agent}}' });
  assert.match(renderCloze('{{c1::LiAlH4::reducing agent}}', 1, false), /reducing agent/);
});

test('formatting inside a cloze survives', () => {
  assert.equal(renderCloze('x {{c1::<b>bold</b>}}', 1, true), 'x <span data-cloze="shown"><b>bold</b></span>');
});

test('LaTeX braces close where they look like they should', () => {
  const p = parseCloze('Area is {{c1::\\frac{a}{b}}} units');
  assert.equal(p.errors.length, 0);
  assert.equal((p.segs[1] as { answer: string }).answer, '\\frac{a}{b}');
  assert.equal((p.segs[2] as { v: string }).v, ' units');
});

test('unbalanced braces fall back to Anki rule', () => {
  const p = parseCloze('{{c1::{x}}');
  assert.equal((p.segs[0] as { answer: string }).answer, '{x');
});

test('missing closing braces is an error', () => {
  const p = parseCloze('Reduced by {{c1::LiAlH4 to alcohols');
  assert.ok(p.errors.some(e => /never closed/.test(e)));
  assert.equal(isCloze('Reduced by {{c1::LiAlH4 to alcohols'), false);
});

test('malformed syntax is flagged', () => {
  assert.ok(parseCloze('{{c1:typo}}').errors.length > 0);
  assert.ok(parseCloze('{{c::x}}').errors.length > 0);
  assert.ok(parseCloze('{{c1::}}').errors.length > 0);
  assert.ok(parseCloze('{{c1::outer {{c2::inner}} }}').errors.some(e => /inside/.test(e)));
});

test('ordinal gaps are fine; next is max + 1', () => {
  assert.deepEqual(ordinals('{{c1::a}} {{c3::b}}'), [1, 3]);
  assert.equal(nextOrdinal('{{c1::a}} {{c3::b}}'), 4);
  assert.equal(nextOrdinal('plain'), 1);
});

test('normalize renumbers by first appearance', () => {
  assert.equal(normalizeOrdinals('{{c3::a}} {{c5::b::h}} {{c3::c}}'), '{{c1::a}} {{c2::b::h}} {{c1::c}}');
});

test('Unicode and Hindi', () => {
  assert.equal(renderCloze('अम्ल {{c1::H₂SO₄}}', 1, true), 'अम्ल <span data-cloze="shown">H₂SO₄</span>');
});


test('browse view marks every answer', () => {
  assert.equal(renderAllAnswers(S), 'Aldehydes can be reduced to <span data-cloze="mark">primary alcohols</span> using <span data-cloze="mark">LiAlH4</span>.');
});

test('a note is one card: ord 0 hides every blank at once', () => {
  const src = 'Aldehydes reduce to {{c1::primary alcohols}} with {{c2::LiAlH₄::reagent}}.';
  const q = renderCloze(src, 0, false);
  assert.equal((q.match(/data-cloze="hidden"/g) ?? []).length, 2);
  assert.ok(!q.includes('primary alcohols'));
  const a = renderCloze(src, 0, true);
  assert.equal((a.match(/data-cloze="shown"/g) ?? []).length, 2);
  assert.deepEqual(answersFor(src, 0), ['primary alcohols', 'LiAlH₄']);
  // A single number still renders on its own, for anything saved before.
  assert.equal((renderCloze(src, 2, false).match(/data-cloze="hidden"/g) ?? []).length, 1);
});
