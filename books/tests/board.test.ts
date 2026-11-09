import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  boxFrom, commit, constrain, emptyBoard, inkIn, erasedBy, fitView, hits, historyOf, normalizeBoard, panBy, pushPoint, redo, simplify,
  speedPressure, STAMPS, stampBox, stampById, stampStrokes, toScreen, toWorld, undo, zoomAt, type Stroke,
} from '../board';

const pen = (id: string, pts: number[], w = 2): Stroke => ({ id, kind: 'pen', color: 'ink', w, pts });
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test('world and screen are inverses, and zooming keeps the point under the cursor still', () => {
  const v = { x: 10, y: -20, z: 2 };
  const [sx, sy] = toScreen(v, 50, 60);
  const [wx, wy] = toWorld(v, sx, sy);
  close(wx, 50); close(wy, 60);
  const z = zoomAt(v, 120, 80, 1.5);
  const before = toWorld(v, 120, 80), after = toWorld(z, 120, 80);
  close(before[0], after[0]); close(before[1], after[1]);
  assert.equal(zoomAt(v, 0, 0, 1000).z, 8);
  assert.equal(zoomAt(v, 0, 0, 0.0001).z, 0.1);
});

test('panning moves the sheet with the hand', () => {
  const v = panBy({ x: 0, y: 0, z: 2 }, 40, -20);
  assert.deepEqual(v, { x: -20, y: 10, z: 2 });
});

test('the eraser touches a stroke it passes over, even on a fast swipe', () => {
  const line = pen('a', [0, 0, 1, 100, 0, 1]);
  const far = pen('b', [0, 200, 1, 100, 200, 1]);
  assert.equal(hits(line, 50, 3, 2), true);
  assert.equal(hits(line, 50, 20, 2), false);
  // From above the line to below it in one event: no sample lands on it, the sweep does.
  assert.deepEqual(erasedBy([line, far], 50, -60, 50, 60, 4, new Set()), ['a']);
  assert.deepEqual(erasedBy([line], 50, -60, 50, 60, 4, new Set(['a'])), []);
});

test('shapes are hit on their outline, not inside', () => {
  const rect: Stroke = { id: 'r', kind: 'rect', color: '#1c7ed6', w: 2, pts: [0, 0, 100, 100] };
  assert.equal(hits(rect, 100, 50, 3), true);
  assert.equal(hits(rect, 50, 50, 3), false);
  const ring: Stroke = { id: 'e', kind: 'ellipse', color: 'ink', w: 2, pts: [0, 0, 100, 100] };
  assert.equal(hits(ring, 100, 50, 3), true);
  assert.equal(hits(ring, 50, 50, 3), false);
});

test('Shift makes a square, a circle, or a 45° line', () => {
  assert.deepEqual(constrain('rect', 0, 0, 30, -80), [80, -80]);
  const [x, y] = constrain('line', 0, 0, 100, 8);
  close(y, 0); close(x, Math.hypot(100, 8));
});

test('points closer than the minimum are dropped', () => {
  const pts: number[] = [];
  assert.equal(pushPoint(pts, 0, 0, 1, 1), true);
  assert.equal(pushPoint(pts, 0.5, 0, 1, 1), false);
  assert.equal(pushPoint(pts, 2, 0, 1, 1), true);
  assert.deepEqual(pts, [0, 0, 1, 2, 0, 1]);
});

test('simplify keeps the corners of a stroke and drops points on a straight run', () => {
  const pts = [0, 0, 1, 10, 0, 1, 20, 0, 1, 30, 0, 1, 30, 10, 1, 30, 20, 1];
  assert.deepEqual(simplify(pts, 0.5), [0, 0, 1, 30, 0, 1, 30, 20, 1]);
});

test('a faster hand makes a thinner brush, within bounds', () => {
  assert.ok(speedPressure(0) > speedPressure(2));
  assert.equal(speedPressure(100), 0.25);
  assert.equal(speedPressure(0), 1);
});

test('undo and redo walk the history; a new stroke after undo drops the redo', () => {
  const a = pen('a', [0, 0, 1]);
  const b = pen('b', [1, 1, 1]);
  let h = historyOf([]);
  h = commit(h, [a]);
  h = commit(h, [a, b]);
  h = undo(h);
  assert.deepEqual(h.present.map(s => s.id), ['a']);
  h = redo(h);
  assert.deepEqual(h.present.map(s => s.id), ['a', 'b']);
  h = undo(h);
  h = commit(h, [a, pen('c', [2, 2, 1])]);
  assert.equal(h.future.length, 0);
  assert.equal(undo(undo(undo(h))).present.length, 0);
});

test('fit shows everything, never closer than 100%', () => {
  const v = fitView([pen('a', [0, 0, 1, 100, 50, 1])], 400, 300)!;
  assert.equal(v.z, 1);
  const big = fitView([pen('a', [0, 0, 1, 4000, 50, 1])], 400, 300)!;
  assert.equal(big.z, 0.1);
  assert.equal(fitView([], 400, 300), null);
});

test('a saved board is read back defensively', () => {
  const b = normalizeBoard({
    view: { x: 'no', y: 4, z: 99 },
    bg: 'grid',
    strokes: [
      pen('ok', [0, 0, 1, 5, 5, 1]),
      { id: 'badkind', kind: 'laser', color: 'ink', w: 2, pts: [0, 0, 1] },
      { id: 'badpts', kind: 'pen', color: 'ink', w: 2, pts: [0, 0] },
      { id: 'shape', kind: 'rect', color: 'javascript:alert(1)', w: 2, pts: [0, 0, 5, 5] },
    ],
  }, 'book1');
  assert.deepEqual(b.view, { x: 0, y: 4, z: 8 });
  assert.equal(b.bg, 'grid');
  assert.deepEqual(b.strokes.map(s => s.id), ['ok', 'shape']);
  assert.equal(b.strokes[1].color, 'ink');
  assert.deepEqual(normalizeBoard(null, 'x'), emptyBoard('x'));
});

test('stamps fit the box they are dragged to, keep their shape, and are one stroke per bond', () => {
  const benzene = stampById('benzene')!;
  const strokes = stampStrokes(benzene, 0, 0, 200, 100, 'ink', 2, i => `s${i}`);
  assert.equal(strokes.length, 9); // six sides, three inner double-bond lines
  assert.equal(new Set(strokes.map(s => s.id)).size, 9);
  const xs = strokes.flatMap(s => [s.pts[0], s.pts[2]]);
  const ys = strokes.flatMap(s => [s.pts[1], s.pts[3]]);
  // A hexagon is taller than wide: fitted by height, centred across.
  close(Math.min(...ys), 0); close(Math.max(...ys), 100);
  close((Math.min(...xs) + Math.max(...xs)) / 2, 100);
  assert.ok(Math.max(...xs) - Math.min(...xs) < 100);
  // Dragged up and to the left lands in the same place.
  assert.deepEqual(stampStrokes(benzene, 200, 100, 0, 0, 'ink', 2, i => `s${i}`).map(s => s.pts), strokes.map(s => s.pts));
});

test('naphthalene has 11 ring bonds and 5 double bonds, every carbon in exactly one', () => {
  const n = stampById('naphthalene')!;
  assert.equal(n.lines.length, 16);
  const r = (v: number) => Math.round(v * 1000) + 0;
  const key = (x: number, y: number) => `${r(x)},${r(y)}`;
  const ring = n.lines.slice(0, 11);
  const carbons = [...new Set(ring.flatMap(l => [key(l[0], l[1]), key(l[2], l[3])]))].map(k => k.split(',').map(Number));
  assert.equal(carbons.length, 10);
  // Each inner line sits beside one ring bond; its two carbons are the ones nearest its ends.
  const nearest = (x: number, y: number) => carbons.reduce((best, c, i) => (Math.hypot(c[0] / 1000 - x, c[1] / 1000 - y) < Math.hypot(carbons[best][0] / 1000 - x, carbons[best][1] / 1000 - y) ? i : best), 0);
  const used = n.lines.slice(11).flatMap(l => [nearest(l[0], l[1]), nearest(l[2], l[3])]);
  assert.deepEqual([...used].sort((a, b) => a - b), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('every stamp has a size and a label', () => {
  for (const s of STAMPS) {
    const b = stampBox(s);
    assert.ok(b.x1 > b.x0 && b.y1 > b.y0, s.id);
    assert.ok(s.label);
  }
  assert.ok(STAMPS.some(s => s.group === 'chem') && STAMPS.some(s => s.group === 'shape'));
});

test('a snip is the box between the corners, and knows whether it holds any ink', () => {
  assert.deepEqual(boxFrom(50, 10, 0, 40), { x0: 0, y0: 10, x1: 50, y1: 40 });
  const line = pen('a', [0, 0, 1, 100, 0, 1]);
  assert.equal(inkIn([line], boxFrom(40, -5, 60, 5)), true);
  assert.equal(inkIn([line], boxFrom(40, 50, 60, 80)), false);
  assert.equal(inkIn([], boxFrom(0, 0, 10, 10)), false);
});
