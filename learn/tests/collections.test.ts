import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addLecture, collectionsFor, collectionsInOrder, createCollection, deleteCollection, deleteLecture, emptyLibrary,
  exportLibrary, importLibrary, live, moveInCollection, normalizeCollection, prune, renameCollection, setInCollection,
  TOMBSTONE_KEEP_MS, type Library,
} from '../model';

const T0 = Date.parse('2026-11-04T06:00:00Z');
const vids = ['M7lc1UVf-VE', 'dQw4w9WgXcQ', 'aaaaaaaaaaa'];

const shelfOf3 = (): Library => {
  let lib = vids.reduce((l, v, i) => addLecture(l, { videoId: v, title: `L${i + 1}`, titleSource: 'student', subject: 'Physics' }, `lec_${i + 1}xx`, T0).lib, emptyLibrary());
  lib = createCollection(lib, 'Before the mock', 'col_axx', T0 + 1);
  lib = createCollection(lib, 'Weak: rotation', 'col_bxx', T0 + 2);
  return lib;
};

test('shelves list oldest first, and renaming one never moves it', () => {
  let lib = shelfOf3();
  lib = renameCollection(lib, 'col_axx', 'Mock week', T0 + 50);
  assert.deepEqual(collectionsInOrder(lib).map(c => c.name), ['Mock week', 'Weak: rotation']);
});

test('putting a lecture on a shelf appends it once; taking it off removes it', () => {
  let lib = shelfOf3();
  lib = setInCollection(lib, 'col_axx', 'lec_2xx', true, T0 + 3);
  lib = setInCollection(lib, 'col_axx', 'lec_1xx', true, T0 + 4);
  const same = setInCollection(lib, 'col_axx', 'lec_1xx', true, T0 + 5);
  assert.equal(same, lib, 'already on it: nothing changes');
  assert.deepEqual(lib.collections.col_axx.lectureIds, ['lec_2xx', 'lec_1xx']);
  lib = setInCollection(lib, 'col_bxx', 'lec_1xx', true, T0 + 6);
  assert.deepEqual(collectionsFor(lib, 'lec_1xx').map(c => c.id), ['col_axx', 'col_bxx']);
  lib = setInCollection(lib, 'col_axx', 'lec_2xx', false, T0 + 7);
  assert.deepEqual(lib.collections.col_axx.lectureIds, ['lec_1xx']);
});

test('a lecture moves one place at a time and stops at the ends', () => {
  let lib = shelfOf3();
  for (const id of ['lec_1xx', 'lec_2xx', 'lec_3xx']) lib = setInCollection(lib, 'col_axx', id, true, T0 + 3);
  lib = moveInCollection(lib, 'col_axx', 'lec_3xx', -1, T0 + 4);
  assert.deepEqual(lib.collections.col_axx.lectureIds, ['lec_1xx', 'lec_3xx', 'lec_2xx']);
  const atStart = moveInCollection(lib, 'col_axx', 'lec_1xx', -1, T0 + 5);
  assert.equal(atStart, lib);
  const notThere = moveInCollection(lib, 'col_bxx', 'lec_1xx', 1, T0 + 5);
  assert.equal(notThere, lib);
});

test('deleting a shelf keeps its lectures; deleting a lecture lifts it off every shelf', () => {
  let lib = shelfOf3();
  lib = setInCollection(lib, 'col_axx', 'lec_1xx', true, T0 + 3);
  lib = setInCollection(lib, 'col_bxx', 'lec_1xx', true, T0 + 3);
  lib = deleteCollection(lib, 'col_axx', T0 + 4);
  assert.equal(live(lib.lectures).length, 3);
  assert.deepEqual(collectionsInOrder(lib).map(c => c.id), ['col_bxx']);
  lib = deleteLecture(lib, 'lec_1xx', T0 + 5);
  assert.deepEqual(lib.collections.col_bxx.lectureIds, []);
  // Nothing comes back: not on the shelf list, not through an import of an older export.
  const old = exportLibrary(shelfOf3(), T0);
  const res = importLibrary(lib, JSON.parse(JSON.stringify(old)), T0 + 6);
  assert.ok(res.ok);
  if (!res.ok) return;
  assert.equal(res.lib.collections.col_axx.deletedAt, T0 + 4, 'a deleted shelf stays deleted');
  assert.ok(!live(res.lib.lectures).some(l => l.id === 'lec_1xx'), 'a deleted lecture stays deleted');
  assert.equal(prune(res.lib, T0 + 4 + TOMBSTONE_KEEP_MS).collections.col_axx, undefined);
});

test('an import never brings back a shelf or a note deleted here, even a newer copy', () => {
  let here = shelfOf3();
  here = deleteCollection(here, 'col_axx', T0 + 10);
  let there = shelfOf3();
  there = renameCollection(there, 'col_axx', 'Edited later on the phone', T0 + 99);
  const res = importLibrary(here, JSON.parse(JSON.stringify(exportLibrary(there, T0 + 100))), T0 + 101);
  assert.ok(res.ok && !!res.lib.collections.col_axx.deletedAt);
});

test('a shelf saved before createdAt existed reads its updatedAt as its age', () => {
  const c = normalizeCollection({ id: 'col_oldxx', name: 'Old', lectureIds: [], updatedAt: T0 });
  assert.equal(c?.createdAt, T0);
});
