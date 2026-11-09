import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOK_TOMBSTONE_MS, addBook, addBookMark, cleanSections, deleteBook, deleteBookMark, emptyShelf, fractionRead, liveBooks,
  marksOf, mergeRuns, normalizeBook, normalizeBookMark, proposeSections, pruneShelf, recordReading, restoreBookMark,
  sectionAt, sectionsFor, shelfFrom, updateBook, updateBookMark, type NewBook, type Shelf,
} from '../model';

const T0 = Date.parse('2026-11-09T06:00:00Z');
const FP1 = 'a'.repeat(64);
const FP2 = 'b'.repeat(64);
const K = (c: string, cls = 11, s = 'Physics') => `${cls}|${s}|${c}`;

const ncert = (over: Partial<NewBook> = {}): NewBook => ({
  title: 'Physics Part 1', kind: 'book', subject: 'Physics', classId: 11,
  cover: { design: 'spine', finish: 'ink' }, fingerprint: FP1, pages: 200, bytes: 9_000_000, ...over,
});

const withBook = (): Shelf => {
  const r = addBook(emptyShelf(), ncert(), 'book_1xxxx', T0);
  assert.equal(r.status, 'added');
  return r.shelf;
};

test('the same file twice is one book', () => {
  const s = withBook();
  const again = addBook(s, ncert({ title: 'Another name' }), 'book_2xxxx', T0 + 1);
  assert.equal(again.status, 'exists');
  assert.equal(liveBooks(again.shelf).length, 1);
});

test('a removed file comes back as the same book, marks and all', () => {
  let s = withBook();
  s = addBookMark(s, { bookId: 'book_1xxxx', kind: 'highlight', page: 3, quote: 'Newton', start: 0, end: 6 }, 'mark_1xxxx', T0 + 1);
  s = deleteBook(s, 'book_1xxxx', T0 + 2);
  assert.equal(liveBooks(s).length, 0);
  const back = addBook(s, ncert(), 'book_newxx', T0 + 3);
  assert.equal(back.status, 'restored');
  assert.equal(back.book.id, 'book_1xxxx');
  assert.equal(marksOf(back.shelf, 'book_1xxxx').length, 1);
});

test('a different file is a different book', () => {
  const r = addBook(withBook(), ncert({ fingerprint: FP2 }), 'book_2xxxx', T0 + 1);
  assert.equal(r.status, 'added');
  assert.equal(liveBooks(r.shelf).length, 2);
});

test('sections are sorted, clipped, de-overlapped and joined', () => {
  const out = cleanSections([
    { from: 50, to: 90, chapterKey: K('Laws of Motion') },
    { from: 1, to: 30, chapterKey: K('Units & Measurements') },
    { from: 25, to: 49, chapterKey: K('Motion in a Straight Line') },
    { from: 91, to: 400, chapterKey: K('Laws of Motion') },
    { from: 5, to: 9, chapterKey: 'not a key' },
  ], 200);
  assert.deepEqual(out, [
    { from: 1, to: 30, chapterKey: K('Units & Measurements') },
    { from: 31, to: 49, chapterKey: K('Motion in a Straight Line') },
    { from: 50, to: 200, chapterKey: K('Laws of Motion') },
  ]);
});

test('outline entries become page ranges running to the next entry', () => {
  const guess = (t: string) => (/units/i.test(t) ? K('Units & Measurements') : /straight/i.test(t) ? K('Motion in a Straight Line') : null);
  const out = proposeSections([
    { title: 'Foreword', page: 1 },
    { title: 'Chapter 1 Units and Measurement', page: 5 },
    { title: 'Chapter 2 Motion in a Straight Line', page: 25 },
    { title: 'Appendix', page: 180 },
  ], 200, guess);
  assert.deepEqual(out, [
    { from: 5, to: 24, chapterKey: K('Units & Measurements') },
    { from: 25, to: 179, chapterKey: K('Motion in a Straight Line') },
  ]);
});

test('a page knows its chapter, and a chapter knows its books', () => {
  let s = withBook();
  s = updateBook(s, 'book_1xxxx', { sections: [{ from: 10, to: 40, chapterKey: K('Units & Measurements') }] }, T0 + 1);
  const b = s.books.book_1xxxx;
  assert.equal(sectionAt(b, 12)?.chapterKey, K('Units & Measurements'));
  assert.equal(sectionAt(b, 41), undefined);
  assert.equal(sectionsFor(s, K('Units & Measurements')).length, 1);
  assert.equal(sectionsFor(s, K('Laws of Motion')).length, 0);
});

test('marks need words, sit in reading order, and delete as tombstones', () => {
  let s = withBook();
  const before = s;
  s = addBookMark(s, { bookId: 'book_1xxxx', kind: 'highlight', page: 3, quote: '   ' }, 'mark_bad1x', T0);
  assert.equal(s, before, 'a highlight with no words is refused');
  s = addBookMark(s, { bookId: 'book_1xxxx', kind: 'highlight', page: 9, quote: 'later', start: 4, end: 9 }, 'mark_2xxxx', T0);
  s = addBookMark(s, { bookId: 'book_1xxxx', kind: 'snip', page: 3, rects: [[0.1, 0.5, 0.3, 0.2]] }, 'mark_3xxxx', T0);
  s = addBookMark(s, { bookId: 'book_1xxxx', kind: 'highlight', page: 3, quote: 'earlier', start: 0, end: 7 }, 'mark_1xxxx', T0);
  assert.deepEqual(marksOf(s, 'book_1xxxx').map(m => m.id), ['mark_1xxxx', 'mark_3xxxx', 'mark_2xxxx']);
  s = updateBookMark(s, 'mark_1xxxx', { color: 'blue', note: 'Remember the units' }, T0 + 1);
  assert.equal(s.bookMarks.mark_1xxxx.color, 'blue');
  s = deleteBookMark(s, 'mark_1xxxx', T0 + 2);
  assert.equal(marksOf(s, 'book_1xxxx').length, 2);
  s = restoreBookMark(s, 'mark_1xxxx', T0 + 3);
  assert.equal(marksOf(s, 'book_1xxxx').length, 3);
});

test('a snip outside the page is refused', () => {
  assert.equal(normalizeBookMark({ id: 'mark_1xxxx', bookId: 'book_1xxxx', kind: 'snip', page: 1, rects: [[0.8, 0.1, 0.5, 0.1]], createdAt: T0 }), null);
});

test('reading progress merges runs and measures sections', () => {
  assert.deepEqual(mergeRuns([[1, 3], [8, 9]], [4, 6]), [[1, 6], [8, 9]]);
  let s = withBook();
  s = recordReading(s, 'book_1xxxx', { page: 12, offset: 0.4, seen: [10, 14] }, T0 + 1);
  s = recordReading(s, 'book_1xxxx', { page: 20, offset: 0.1, seen: [15, 19] }, T0 + 2);
  const p = s.bookProgress.book_1xxxx;
  assert.deepEqual(p.seen, [[10, 19]]);
  assert.equal(p.page, 20);
  assert.equal(fractionRead(p, 10, 29), 0.5);
});

test('pruning drops old tombstones and the marks of pruned books', () => {
  let s = withBook();
  s = addBookMark(s, { bookId: 'book_1xxxx', kind: 'bookmark', page: 2 }, 'mark_1xxxx', T0);
  s = deleteBook(s, 'book_1xxxx', T0 + 1);
  assert.equal(Object.keys(pruneShelf(s, T0 + 10).bookMarks).length, 1);
  const later = pruneShelf(s, T0 + 1 + BOOK_TOMBSTONE_MS + 1);
  assert.deepEqual(later, { books: {}, bookMarks: {}, bookProgress: {} });
});

test('records from disk are validated field by field', () => {
  const good = normalizeBook({ ...withBook().books.book_1xxxx });
  assert.ok(good);
  assert.equal(normalizeBook({ ...good, fingerprint: 'nope' }), null);
  assert.equal(normalizeBook({ ...good, pages: 0 }), null);
  assert.equal(normalizeBook({ ...good, cover: { design: '<script>', finish: 'gold' } })?.cover.design, '');
  const s = shelfFrom({ books: [good, { junk: true }], bookMarks: [null], bookProgress: [] });
  assert.equal(Object.keys(s.books).length, 1);
});
