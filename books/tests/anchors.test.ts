import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contextOf, pageText, quoteOf, resolveHighlight, searchPage, snapToWords } from '../anchors';

const { text } = pageText([
  { str: 'The SI unit of force is the', hasEOL: true },
  { str: 'newton (N). One newton is the force' },
  { str: ' that gives 1 kg an acceleration of 1 m s–2.', hasEOL: true },
]);

test('page text joins items with line breaks where pdf.js says', () => {
  assert.ok(text.startsWith('The SI unit of force is the\nnewton (N).'));
});

test('a selection snaps out to whole words and loses edge spaces', () => {
  const i = text.indexOf('ewto');
  const [a, b] = snapToWords(text, i, i + 3);
  assert.equal(text.slice(a, b), 'newton');
  const j = text.indexOf(' One');
  const [c, d] = snapToWords(text, j, j + 6);
  assert.equal(text.slice(c, d), 'One newton');
});

test('offsets that still hold the words win', () => {
  const s = text.indexOf('One newton');
  const r = resolveHighlight(text, { start: s, end: s + 10, quote: 'One newton' });
  assert.deepEqual(r, { start: s, end: s + 10, via: 'offsets' });
});

test('moved offsets fall back to the words, nearest first, across line breaks', () => {
  const r = resolveHighlight(text, { start: 999, end: 1010, quote: 'force is the newton' });
  assert.equal(r.via, 'quote');
  if (r.via === 'quote') assert.equal(quoteOf(text, r.start, r.end), 'force is the newton');
});

test('words that are gone leave the rectangles', () => {
  assert.deepEqual(resolveHighlight(text, { start: 0, end: 4, quote: 'momentum' }), { via: 'rects' });
});

test('search is case-insensitive and gives context', () => {
  const hits = searchPage(text, 'NEWTON');
  assert.equal(hits.length, 2);
  assert.match(contextOf(text, hits[0][0], hits[0][1], 10), /newton/);
});
