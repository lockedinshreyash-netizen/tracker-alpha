import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WatchTracker } from '../watch';
import { emptyLibrary, addLecture, recordWatch, watchedSeconds, type Library } from '../model';

const play = (w: WatchTracker, from: number, to: number, rate = 1) => {
  for (let t = from; t <= to; t += rate) w.tick(t, 1, rate, 1000);
};

const apply = (lib: Library, w: WatchTracker, now: number) =>
  w.take().reduce((l, u) => recordWatch(l, 'lec_1xx', u, now), lib);

const lib0 = () => addLecture(emptyLibrary(), { videoId: 'M7lc1UVf-VE', title: 'T', titleSource: 'student', subject: 'Physics' }, 'lec_1xx', 1).lib;

test('steady playback is one stretch, taken in pieces without gaps or double counting', () => {
  const w = new WatchTracker();
  let lib = lib0();
  play(w, 0, 30);
  lib = apply(lib, w, 2);
  play(w, 31, 60);
  lib = apply(lib, w, 3);
  assert.deepEqual(lib.progress.lec_1xx.watched, [[0, 60]]);
  assert.equal(lib.progress.lec_1xx.position, 60);
});

test('a seek closes the stretch, so skipping ahead is not watching', () => {
  const w = new WatchTracker();
  play(w, 0, 20);
  play(w, 900, 920);
  const ups = w.take();
  assert.deepEqual(ups.map(u => [u.from, u.to]), [[0, 20], [900, 920]]);
  assert.equal(ups[0].position, 920);
});

test('going back to rewatch is a new stretch that merges with the old', () => {
  const w = new WatchTracker();
  let lib = lib0();
  play(w, 0, 100);
  play(w, 50, 80);
  lib = apply(lib, w, 2);
  assert.deepEqual(lib.progress.lec_1xx.watched, [[0, 100]]);
});

test('faster playback is expected to move faster, and is still one stretch', () => {
  const w = new WatchTracker();
  play(w, 0, 60, 2);
  assert.deepEqual(w.take().map(u => [u.from, u.to]), [[0, 60]]);
});

test('pause ends the stretch; a seek while paused moves the resume point only', () => {
  const w = new WatchTracker();
  play(w, 0, 40);
  w.stop(40.6);
  w.moved(300);
  const ups = w.take();
  assert.deepEqual(ups.map(u => [u.from, u.to]), [[0, 40.6]]);
  assert.equal(ups[0].position, 300);
  // Nothing new: nothing to write.
  assert.deepEqual(w.take(), []);
  w.moved(310);
  assert.deepEqual(w.take(), [{ position: 310, duration: 1000, rate: 1 }]);
});

test('a single reading counts no time', () => {
  const w = new WatchTracker();
  w.tick(10, 1, 1, 1000);
  const ups = w.take();
  assert.equal(ups.length, 1);
  assert.equal(ups[0].from, undefined);
  let lib = recordWatch(lib0(), 'lec_1xx', ups[0], 2);
  assert.equal(watchedSeconds(lib.progress.lec_1xx.watched), 0);
});
