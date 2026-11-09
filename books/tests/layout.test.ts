import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitView, swipeTurns, viewIndexOf, viewsOf } from '../layout';

test('scroll and flip show one page per view', () => {
  assert.deepEqual(viewsOf(3, 'flip'), [[1], [2], [3]]);
  assert.deepEqual(viewsOf(3, 'scroll'), [[1], [2], [3]]);
});

test('a spread stands page 1 alone, then pairs 2–3, 4–5, and a last odd page alone', () => {
  assert.deepEqual(viewsOf(6, 'spread'), [[1], [2, 3], [4, 5], [6]]);
  assert.deepEqual(viewsOf(5, 'spread'), [[1], [2, 3], [4, 5]]);
  assert.deepEqual(viewsOf(1, 'spread'), [[1]]);
});

test('a page is found in its view, and out-of-range pages clamp', () => {
  const v = viewsOf(6, 'spread');
  assert.equal(viewIndexOf(v, 3), 1);
  assert.equal(viewIndexOf(v, 4), 2);
  assert.equal(viewIndexOf(v, 0), 0);
  assert.equal(viewIndexOf(v, 99), 3);
});

test('a view fits whole inside the stage and scales with the zoom', () => {
  const a4 = 842 / 595;
  const one = fitView([a4], 1200, 800, 1);
  assert.equal(one.height, 752);
  assert.ok(one.total <= 1200 - 48);
  const two = fitView([a4, a4], 900, 800, 1);
  assert.ok(two.total <= 900 - 48, 'two pages fit the width');
  assert.equal(two.widths[0], two.widths[1]);
  const zoomed = fitView([a4], 1200, 800, 1.5);
  assert.equal(zoomed.height, Math.round(752 * 1.5));
});

test('a swipe turns when far or quick, and springs back otherwise', () => {
  assert.equal(swipeTurns(-300, 1000, 500), 1);
  assert.equal(swipeTurns(250, 1000, 500), -1);
  assert.equal(swipeTurns(-60, 1000, 150), 1);
  assert.equal(swipeTurns(-60, 1000, 600), 0);
  assert.equal(swipeTurns(-10, 1000, 50), 0);
});
