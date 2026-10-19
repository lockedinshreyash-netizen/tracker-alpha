import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BookChapter } from '../../content/book';
import { CHAPTERS } from '../../content/bookText';
import { BOOK } from '../../content/book';
import {
  chapterUnits, compareAnchors, foldForSearch, mergeReading, normalizeReading, parseInline, plainOf,
  progressAt, rangeInUnit, snapToWords, resolveHighlight, searchBook, segments, textBetween, trimRange, unitsOf,
  type Highlight, EMPTY_READING,
} from '../model';

const CH: BookChapter = {
  id: 'x',
  number: 'Chapter 9',
  title: 'Test',
  part: { title: 'Level 9.', intro: ['A part intro.'] },
  blocks: [
    { id: 'x.01', kind: 'p', text: 'He did *the deed,* then slept.' },
    { id: 'x.02', kind: 'h', text: 'A heading' },
    { id: 'x.03', kind: 'list', ordered: false, items: [{ id: 'x.03.1', text: 'One', sub: [{ id: 'x.03.1.1', text: 'One-a' }] }, { id: 'x.03.2', text: '**Two** – done' }] },
    { id: 'x.04', kind: 'fragment', label: 'Fragment I', title: 'Skip me' },
    { id: 'x.05', kind: 'action', label: 'Action Step 1', text: 'Write it down.' },
  ],
};

const hl = (over: Partial<Highlight>): Highlight => ({
  id: 'h1', chapterId: 'x', start: { u: 'x.01', o: 0 }, end: { u: 'x.01', o: 2 }, quote: 'He',
  color: 'yellow', createdAt: 1, updatedAt: 1, ...over,
});

test('inline marks become runs, and plain text drops the markers', () => {
  assert.deepEqual(parseInline('a *b* **c** d'), [{ text: 'a ' }, { text: 'b', i: true }, { text: ' ' }, { text: 'c', b: true }, { text: ' d' }]);
  assert.equal(plainOf('He did *the deed,* then slept.'), 'He did the deed, then slept.');
  assert.equal(plainOf('a lone * star'), 'a lone * star');
});

test('units: part intro first, list items and sub-items in order, fragments skipped', () => {
  assert.deepEqual(unitsOf(CH).map(u => u.id), ['x.part0', 'x.01', 'x.02', 'x.03.1', 'x.03.1.1', 'x.03.2', 'x.05']);
  assert.equal(unitsOf(CH)[5].plain, 'Two – done');
});

test('every unit id in the real book is unique', () => {
  const ids = CHAPTERS.flatMap(c => chapterUnits(c).map(u => u.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length > 300);
});

test('text between anchors spans units with a single space', () => {
  assert.equal(textBetween(CH, { u: 'x.01', o: 7 }, { u: 'x.02', o: 1 }), 'the deed, then slept. A');
  assert.equal(compareAnchors(CH, { u: 'x.01', o: 9 }, { u: 'x.02', o: 0 }) < 0, true);
});

test('trimRange pulls selection ends off whitespace, across unit edges', () => {
  const plain = plainOf(CH.blocks[0].kind === 'p' ? CH.blocks[0].text : '');
  const r = trimRange(CH, { u: 'x.01', o: 6 }, { u: 'x.02', o: 0 });
  assert.deepEqual(r, { start: { u: 'x.01', o: 7 }, end: { u: 'x.01', o: plain.length } });
  assert.equal(trimRange(CH, { u: 'x.01', o: 2 }, { u: 'x.01', o: 3 }), null);
});

test('rangeInUnit gives the slice of a multi-unit range inside each unit', () => {
  const s = { u: 'x.01', o: 7 };
  const e = { u: 'x.03.1', o: 2 };
  assert.deepEqual(rangeInUnit(CH, 'x.01', s, e), [7, 28]);
  assert.deepEqual(rangeInUnit(CH, 'x.02', s, e), [0, 9]);
  assert.deepEqual(rangeInUnit(CH, 'x.03.1', s, e), [0, 2]);
  assert.equal(rangeInUnit(CH, 'x.05', s, e), null);
});

test('segments cut runs at highlight edges and keep italics', () => {
  const pieces = segments('He did *the deed,* then slept.', [{ from: 3, to: 11, id: 'h', kind: 'hl', color: 'green', note: true }]);
  assert.deepEqual(pieces.map(p => [p.text, !!p.i, p.hl?.color ?? null, p.noteAfter ?? null]), [
    ['He ', false, null, null],
    ['did ', false, 'green', null],
    ['the ', true, 'green', 'h'],
    ['deed,', true, null, null],
    [' then slept.', false, null, null],
  ]);
});

test('overlapping highlights: the later one paints the overlap', () => {
  const pieces = segments('abcdef', [
    { from: 0, to: 4, id: 'old', kind: 'hl', color: 'yellow' },
    { from: 2, to: 6, id: 'new', kind: 'hl', color: 'pink' },
  ]);
  assert.deepEqual(pieces.map(p => [p.text, p.hl?.id]), [['ab', 'old'], ['cd', 'new'], ['ef', 'new']]);
});

test('a highlight re-anchors by its quote when the offsets drift', () => {
  const drifted = hl({ start: { u: 'x.01', o: 0 }, end: { u: 'x.01', o: 8 }, quote: 'the deed' });
  assert.deepEqual(resolveHighlight(CH, drifted), { start: { u: 'x.01', o: 7 }, end: { u: 'x.01', o: 15 } });
  assert.equal(resolveHighlight(CH, hl({ quote: 'words that are not here' , start: { u: 'gone', o: 0 } })), null);
});

test('search folds apostrophes, quotes and ellipses', () => {
  assert.equal(foldForSearch('Don’t “stop”…'), 'don\'t "stop"...');
  const hits = searchBook(CHAPTERS, "don't chase girls");
  assert.ok(hits.length >= 2);
  assert.equal(hits[0].match.toLowerCase(), 'don’t chase girls');
  assert.equal(searchBook(CHAPTERS, 'a').length, 0);
});

test('progress runs 0 → 1 through the book', () => {
  const first = CHAPTERS[0];
  const last = CHAPTERS[CHAPTERS.length - 1];
  const start = progressAt(CHAPTERS, first.id, chapterUnits(first)[0].id, 0);
  const lastUnits = chapterUnits(last);
  const end = progressAt(CHAPTERS, last.id, lastUnits[lastUnits.length - 1].id, 1);
  assert.equal(start.book, 0);
  assert.ok(end.book > 0.99);
  assert.equal(end.minutesLeftInChapter, 0);
  assert.ok(start.minutesLeftInBook > 30, `book is ${start.minutesLeftInBook} min`);
});

test('normalize drops junk, bounds text, and migrates the old chapter index', () => {
  const r = normalizeReading({
    highlights: [hl({}), hl({}), { id: 'bad' }, hl({ id: 'h2', color: 'purple' as never, note: 'x'.repeat(9000) })],
    bookmarks: [{ id: 'b', chapterId: 'x', u: 'x.01', snippet: 'Hi', createdAt: 2 }],
    furthest: { x: 4 },
  });
  assert.equal(r.highlights.length, 2);
  assert.equal(r.highlights[1].color, 'yellow');
  assert.equal(r.highlights[1].note!.length, 4000);
  assert.equal(r.furthest.x, 1);
  assert.equal(r.bookmarks[0].updatedAt, 2);
  const migrated = normalizeReading(undefined, CHAPTERS[3].id);
  assert.deepEqual(migrated.position, { chapterId: CHAPTERS[3].id, u: '', f: 0, at: 0 });
  assert.deepEqual(normalizeReading(null), EMPTY_READING);
});

test('tombstones outlive a merge with an older live copy, then expire', () => {
  const now = 100 * 86_400_000;
  const gone = now - 86_400_000;
  const deleted = normalizeReading({ highlights: [hl({ updatedAt: gone, deletedAt: gone })] }, null, now);
  const stale = normalizeReading({ highlights: [hl({ updatedAt: 10 })] }, null, now);
  const merged = mergeReading(deleted, stale, now);
  assert.equal(merged.highlights.length, 1);
  assert.equal(merged.highlights[0].deletedAt, gone);
  const later = normalizeReading(merged, null, now + 61 * 86_400_000);
  assert.equal(later.highlights.length, 0);
});

test('merge: newer position wins, furthest only rises, later tick or untick wins', () => {
  const a = normalizeReading({ position: { chapterId: 'x', u: 'x.01', f: 0.5, at: 10 }, furthest: { x: 0.9 }, actions: { s1: 5, s2: -20 } });
  const b = normalizeReading({ position: { chapterId: 'y', u: 'y.01', f: 0, at: 20 }, furthest: { x: 0.2, y: 0.4 }, actions: { s1: -8, s2: 9 } });
  const m = mergeReading(a, b);
  assert.equal(m.position?.chapterId, 'y');
  assert.deepEqual(m.furthest, { x: 0.9, y: 0.4 });
  assert.deepEqual(m.actions, { s1: -8, s2: -20 });
});

test('the cover facts the vault reads agree with the text', () => {
  assert.deepEqual(BOOK.chapterIds, CHAPTERS.map(c => c.id));
  assert.equal(BOOK.chapterCount, CHAPTERS.length);
});

test('a selection grows out to whole words, never into punctuation', () => {
  // 'He did the deed, then slept.' — select 'id the de'
  const r = snapToWords(CH, { u: 'x.01', o: 4 }, { u: 'x.01', o: 13 });
  assert.equal(textBetween(CH, r.start, r.end), 'did the deed');
  const clean = snapToWords(CH, { u: 'x.01', o: 3 }, { u: 'x.01', o: 15 });
  assert.equal(textBetween(CH, clean.start, clean.end), 'did the deed');
  const comma = snapToWords(CH, { u: 'x.01', o: 7 }, { u: 'x.01', o: 16 });
  assert.equal(textBetween(CH, comma.start, comma.end), 'the deed,');
});
