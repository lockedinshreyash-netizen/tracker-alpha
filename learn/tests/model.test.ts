import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPLETE_FRACTION, LIMITS, TITLE_LIMIT_MS, TITLE_REFRESH_MS, TOMBSTONE_KEEP_MS,
  addLecture, addMark, catalogueCode, codeOf, coverArt, createCollection, deleteCollection, deleteLecture, deleteMark,
  displayTitle, emptyLibrary, exportLibrary, importLibrary, isComplete, libraryFrom, live, marksFor, mergeRanges,
  normalizeLecture, normalizeMark, prune, recordWatch, refreshTitle, setCollectionLectures, titleState, updateLecture,
  watchedSeconds, type Library, type NewLecture,
} from '../model';

const T0 = Date.parse('2026-11-04T06:00:00Z');
const DAY = 86_400_000;
const V1 = 'M7lc1UVf-VE';
const V2 = 'dQw4w9WgXcQ';
const V3 = 'aaaaaaaaaaa';

const phy = (videoId = V1, over: Partial<NewLecture> = {}): NewLecture =>
  ({ videoId, title: 'Rotational Motion · One Shot', titleSource: 'youtube', subject: 'Physics', chapterKey: '11|Physics|Rotational Motion', ...over });

const withLectures = (...inputs: NewLecture[]): Library =>
  inputs.reduce((lib, input, i) => addLecture(lib, input, `lec_${i + 1}xx`, T0 + i).lib, emptyLibrary());

test('catalogue numbers count up per subject and print with three digits', () => {
  const lib = withLectures(phy(V1), phy(V2), phy(V3, { subject: 'Chemistry', chapterKey: undefined }));
  assert.deepEqual(live(lib.lectures).map(codeOf), ['PHY-001', 'PHY-002', 'CHE-001']);
  assert.equal(catalogueCode('Biology', 1234), 'BIO-1234');
});

test('a number is never reused, even after the lecture is deleted and pruned', () => {
  let lib = withLectures(phy(V1), phy(V2));
  lib = deleteLecture(lib, 'lec_2xx', T0 + 10);
  lib = prune(lib, T0 + 10 + TOMBSTONE_KEEP_MS + 1);
  assert.equal(lib.lectures.lec_2xx, undefined);
  const { lecture } = addLecture(lib, phy(V3), 'lec_newxx', T0 + TOMBSTONE_KEEP_MS + 20);
  assert.equal(codeOf(lecture), 'PHY-003');
});

test('the same video is never added twice', () => {
  const lib = withLectures(phy(V1));
  const again = addLecture(lib, phy(V1, { title: 'Another title' }), 'lec_dupxx', T0 + 5);
  assert.equal(again.duplicate, true);
  assert.equal(again.lecture.id, 'lec_1xx');
  assert.equal(again.lib, lib);
});

test('editing the title makes it the student’s; moving subject gives a new number', () => {
  let lib = withLectures(phy(V1), phy(V2, { subject: 'Chemistry', chapterKey: undefined }));
  lib = updateLecture(lib, 'lec_1xx', { title: 'Torque, my notes' }, T0 + 50);
  assert.equal(lib.lectures.lec_1xx.titleSource, 'student');
  assert.equal(lib.lectures.lec_1xx.titleFetchedAt, undefined);
  // Saving the same title is not an edit.
  const same = updateLecture(withLectures(phy(V1)), 'lec_1xx', { title: 'Rotational Motion · One Shot' }, T0 + 50);
  assert.equal(same.lectures.lec_1xx.titleSource, 'youtube');

  lib = updateLecture(lib, 'lec_1xx', { subject: 'Chemistry' }, T0 + 60);
  assert.equal(codeOf(lib.lectures.lec_1xx), 'CHE-002');
  assert.equal(lib.lectures.lec_1xx.chapterKey, undefined, 'a Physics chapter does not follow it into Chemistry');
  // A chapter of another subject is refused.
  lib = updateLecture(lib, 'lec_1xx', { chapterKey: '11|Physics|Gravitation' }, T0 + 70);
  assert.equal(lib.lectures.lec_1xx.chapterKey, undefined);
  lib = updateLecture(lib, 'lec_1xx', { chapterKey: '11|Chemistry|Chemical Bonding' }, T0 + 80);
  assert.equal(lib.lectures.lec_1xx.chapterKey, '11|Chemistry|Chemical Bonding');
});

test('a YouTube title refreshes at 25 days and stops being shown at 30', () => {
  let lib = withLectures(phy(V1));
  const l = () => lib.lectures.lec_1xx;
  assert.equal(titleState(l(), T0 + 24 * DAY), 'fresh');
  assert.equal(titleState(l(), T0 + TITLE_REFRESH_MS), 'stale');
  assert.equal(titleState(l(), T0 + TITLE_LIMIT_MS), 'expired');
  assert.equal(displayTitle(l(), T0 + TITLE_LIMIT_MS), 'PHY-001');

  lib = refreshTitle(lib, 'lec_1xx', 'Rotational Motion · Updated', T0 + 29 * DAY);
  assert.equal(titleState(l(), T0 + 40 * DAY), 'fresh');
  assert.equal(displayTitle(l(), T0 + 40 * DAY), 'Rotational Motion · Updated');

  // Gone or private on YouTube: the title goes, the number stays.
  lib = refreshTitle(lib, 'lec_1xx', null, T0 + 41 * DAY);
  assert.equal(displayTitle(l(), T0 + 41 * DAY), 'PHY-001');

  // A title the student wrote is never refreshed and never expires.
  lib = updateLecture(lib, 'lec_1xx', { title: 'Mine' }, T0 + 42 * DAY);
  lib = refreshTitle(lib, 'lec_1xx', 'From YouTube', T0 + 43 * DAY);
  assert.equal(l().title, 'Mine');
  assert.equal(titleState(l(), T0 + 400 * DAY), 'own');
});

test('marks sort by time, need text when they are notes, and delete as tombstones', () => {
  let lib = withLectures(phy(V1));
  lib = addMark(lib, { lectureId: 'lec_1xx', t: 754.33, kind: 'note', text: 'Parallel axis: I = Icm + Md²' }, 'mark_bxx', T0 + 1);
  lib = addMark(lib, { lectureId: 'lec_1xx', t: 95, kind: 'bookmark' }, 'mark_axx', T0 + 2);
  lib = addMark(lib, { lectureId: 'lec_1xx', t: 100, kind: 'note', text: '   ' }, 'mark_cxx', T0 + 3);
  lib = addMark(lib, { lectureId: 'lec_nope', t: 1, kind: 'bookmark' }, 'mark_dxx', T0 + 4);
  assert.deepEqual(marksFor(lib, 'lec_1xx').map(m => [m.id, m.t]), [['mark_axx', 95], ['mark_bxx', 754.3]]);
  lib = deleteMark(lib, 'mark_bxx', T0 + 5);
  assert.equal(lib.marks.mark_bxx.text, undefined, 'a deleted note keeps no words');
  assert.deepEqual(marksFor(lib, 'lec_1xx').map(m => m.id), ['mark_axx']);
});

test('deleting a lecture takes its marks and progress and lifts it off every shelf', () => {
  let lib = withLectures(phy(V1), phy(V2));
  lib = addMark(lib, { lectureId: 'lec_1xx', t: 5, kind: 'bookmark' }, 'mark_axx', T0);
  lib = recordWatch(lib, 'lec_1xx', { from: 0, to: 60, position: 60, duration: 600 }, T0);
  lib = createCollection(lib, 'Mechanics', 'col_1xx', T0);
  lib = setCollectionLectures(lib, 'col_1xx', ['lec_2xx', 'lec_1xx', 'lec_1xx', 'lec_ghost'], T0);
  assert.deepEqual(lib.collections.col_1xx.lectureIds, ['lec_2xx', 'lec_1xx']);
  lib = deleteLecture(lib, 'lec_1xx', T0 + 1);
  assert.equal(live(lib.lectures).length, 1);
  assert.equal(marksFor(lib, 'lec_1xx').length, 0);
  assert.ok(lib.progress.lec_1xx.deletedAt);
  assert.deepEqual(lib.collections.col_1xx.lectureIds, ['lec_2xx']);
  lib = deleteCollection(lib, 'col_1xx', T0 + 2);
  assert.equal(live(lib.collections).length, 0);
});

test('watched stretches merge, and skipping to the end is not finishing', () => {
  assert.deepEqual(mergeRanges([[0, 10], [10.5, 20], [30, 40]], [39, 50]), [[0, 20], [30, 50]]);
  assert.deepEqual(mergeRanges([[5, 1], [NaN, 3]]), []);
  let lib = withLectures(phy(V1));
  lib = recordWatch(lib, 'lec_1xx', { from: 0, to: 30, position: 30, duration: 1000 }, T0);
  lib = recordWatch(lib, 'lec_1xx', { from: 950, to: 1000, position: 1000 }, T0 + 1);
  assert.equal(isComplete(lib, 'lec_1xx'), false);
  lib = recordWatch(lib, 'lec_1xx', { from: 30, to: 30 + 1000 * COMPLETE_FRACTION, position: 900, rate: 1.5 }, T0 + 2);
  assert.equal(isComplete(lib, 'lec_1xx'), true);
  assert.equal(lib.progress.lec_1xx.rate, 1.5);
  const done = lib.progress.lec_1xx.completedAt;
  lib = recordWatch(lib, 'lec_1xx', { from: 0, to: 1, position: 1 }, T0 + 3);
  assert.equal(lib.progress.lec_1xx.completedAt, done, 'complete stays complete');
});

test('a fragmented history is closed up to fit, keeping the total close', () => {
  const ranges = Array.from({ length: LIMITS.ranges + 50 }, (_, i) => [i * 10, i * 10 + 5] as [number, number]);
  const merged = mergeRanges(ranges);
  assert.equal(merged.length, LIMITS.ranges);
  assert.ok(watchedSeconds(merged) >= watchedSeconds(ranges));
});

test('cover art is fixed per lecture', () => {
  assert.equal(coverArt('lec_abc123'), coverArt('lec_abc123'));
  const arts = new Set(Array.from({ length: 50 }, (_, i) => coverArt(`lec_${i}xyz`)));
  assert.equal(arts.size, 5);
});

test('validation drops anything that could reach an iframe or the shelf malformed', () => {
  const ok = { id: 'lec_1xx', videoId: V1, title: 'T', titleSource: 'youtube', titleFetchedAt: T0, subject: 'Physics', catalogueNo: 1, addedAt: T0, updatedAt: T0 };
  assert.ok(normalizeLecture(ok));
  assert.equal(normalizeLecture({ ...ok, videoId: 'x"><script>' }), null);
  assert.equal(normalizeLecture({ ...ok, subject: 'History' }), null);
  assert.equal(normalizeLecture({ ...ok, id: '../../etc' }), null);
  assert.equal(normalizeLecture({ ...ok, catalogueNo: 0 }), null);
  assert.equal(normalizeLecture({ ...ok, title: '', titleSource: 'student' }), null);
  assert.equal(normalizeLecture({ ...ok, chapterKey: '11|Chemistry|Mole Concept' })?.chapterKey, undefined);
  assert.equal(normalizeLecture({ ...ok, title: 'x'.repeat(500) })?.title.length, LIMITS.title);
  assert.equal(normalizeMark({ id: 'mark_1xx', lectureId: 'lec_1xx', t: -1, kind: 'bookmark', createdAt: T0 }), null);
  assert.equal(normalizeMark({ id: 'mark_1xx', lectureId: 'lec_1xx', t: 5, kind: 'pin', createdAt: T0 }), null);
});

test('export and import round-trip into an empty library', () => {
  let lib = withLectures(phy(V1), phy(V2, { subject: 'Maths', chapterKey: '12|Maths|Integrals', titleSource: 'student', title: 'By parts' }));
  lib = addMark(lib, { lectureId: 'lec_1xx', t: 12, kind: 'note', text: 'τ = r × F' }, 'mark_1xx', T0);
  lib = recordWatch(lib, 'lec_1xx', { from: 0, to: 100, position: 100, duration: 1000 }, T0);
  lib = createCollection(lib, 'Before the mock', 'col_1xx', T0);
  lib = setCollectionLectures(lib, 'col_1xx', ['lec_2xx', 'lec_1xx'], T0);
  const file = JSON.parse(JSON.stringify(exportLibrary(lib, T0 + 1)));
  const res = importLibrary(emptyLibrary(), file, T0 + 2);
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.deepEqual(res.report, { added: 2, updated: 0, merged: 0, renumbered: 0, rejected: 0 });
  assert.deepEqual(live(res.lib.lectures).map(codeOf).sort(), ['MAT-001', 'PHY-001']);
  assert.equal(marksFor(res.lib, 'lec_1xx')[0].text, 'τ = r × F');
  assert.deepEqual(res.lib.collections.col_1xx.lectureIds, ['lec_2xx', 'lec_1xx']);
  assert.deepEqual(res.lib.counters, lib.counters);
});

test('import merges a video already here, renumbers a clash, and never deletes', () => {
  // This device: PHY-001 is V1 (as lec_hereA).
  let here = addLecture(emptyLibrary(), phy(V1), 'lec_hereA', T0).lib;
  here = addMark(here, { lectureId: 'lec_hereA', t: 1, kind: 'bookmark' }, 'mark_here', T0);
  // Another device: PHY-001 is V2, PHY-002 is V1, with a note on V1.
  let there = addLecture(emptyLibrary(), phy(V2), 'lec_thereA', T0).lib;
  there = addLecture(there, phy(V1), 'lec_thereB', T0).lib;
  there = addMark(there, { lectureId: 'lec_thereB', t: 50, kind: 'note', text: 'from the phone' }, 'mark_there', T0);
  there = recordWatch(there, 'lec_thereB', { from: 0, to: 300, position: 300, duration: 1000 }, T0 + 5);

  const res = importLibrary(here, exportLibrary(there, T0 + 9), T0 + 10);
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.deepEqual(res.report, { added: 1, updated: 0, merged: 1, renumbered: 1, rejected: 0 });
  // V2 arrives as PHY-003, not a second PHY-001.
  assert.equal(codeOf(res.lib.lectures.lec_thereA), 'PHY-003');
  // V1 stays one case, and its note and progress came with it.
  assert.equal(live(res.lib.lectures).filter(l => l.videoId === V1).length, 1);
  assert.deepEqual(marksFor(res.lib, 'lec_hereA').map(m => m.id), ['mark_here', 'mark_there']);
  assert.deepEqual(res.lib.progress.lec_hereA.watched, [[0, 300]]);
});

test('a file that is not an Alpha Learn export is refused whole; bad rows are counted', () => {
  assert.deepEqual(importLibrary(emptyLibrary(), { lectures: [] }, T0), { ok: false, reason: 'format' });
  assert.deepEqual(importLibrary(emptyLibrary(), 'nope', T0), { ok: false, reason: 'format' });
  const res = importLibrary(emptyLibrary(), { format: 'alpha-learn/1', lectures: [{ id: 'x' }, 7], marks: [null] }, T0);
  assert.ok(res.ok && res.report.rejected === 3);
});

test('a library rebuilt from stored rows drops what does not validate', () => {
  const lib = libraryFrom({
    lectures: [{ id: 'lec_1xx', videoId: V1, title: 'T', titleSource: 'student', subject: 'Physics', catalogueNo: 4, addedAt: T0, updatedAt: T0 }, { bad: true }],
    collections: [],
    marks: [],
    progress: [],
    counters: { PHY: 9, CHE: -1, MAT: 'x' },
  });
  assert.deepEqual(Object.keys(lib.lectures), ['lec_1xx']);
  assert.deepEqual(lib.counters, { PHY: 9, CHE: 0, MAT: 0, BIO: 0 });
});
