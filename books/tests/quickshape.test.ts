import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveEnd, perfect, recognize, resample, scaleShape, shapePoints, type Pt } from '../quickshape';

/* A hand: a seeded wobble across the stroke, uneven spacing along it, and loops that don't quite close. */
const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

const draw = (path: Pt[], wobble: number, seed = 7, n = 90): number[] => {
  const r = rng(seed);
  const even = resample(path, n);
  const out: number[] = [];
  let drift = 0;
  even.forEach(([x, y], i) => {
    if (i % 3 === 0 && r() < 0.3) return; // uneven sampling
    drift = drift * 0.8 + (r() - 0.5) * wobble;
    out.push(x + drift, y + (r() - 0.5) * wobble, 0.5);
  });
  return out;
};

const circlePath = (cx: number, cy: number, rx: number, ry: number, from = 0, to = Math.PI * 2): Pt[] =>
  Array.from({ length: 80 }, (_, i) => { const t = from + ((to - from) * i) / 79; return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)] as Pt; });

const MIN = 16;

test('a slightly bent line becomes straight, from its first point to its last', () => {
  const bent: Pt[] = Array.from({ length: 40 }, (_, i) => [i * 8, 120 + Math.sin(i / 12) * 9] as Pt);
  const r = recognize(draw(bent, 3), MIN)!;
  assert.equal(r?.label, 'Line');
  assert.equal(r.shape.type, 'line');
});

test('a line drawn almost level is set exactly level', () => {
  const r = recognize(draw([[0, 0], [300, 12]], 2), MIN)!;
  assert.equal(r.shape.type, 'line');
  if (r.shape.type === 'line') assert.ok(Math.abs(r.shape.a[1] - r.shape.b[1]) < 1e-9);
});

test('a wobbly loop becomes a circle, a flat one an ellipse', () => {
  assert.equal(recognize(draw(circlePath(200, 200, 90, 90, 0, Math.PI * 1.95), 6), MIN)?.label, 'Circle');
  const e = recognize(draw(circlePath(200, 200, 160, 70, 0.3, 0.3 + Math.PI * 1.97), 6), MIN);
  assert.equal(e?.label, 'Ellipse');
});

test('four rough corners become a rectangle, square ones a square, always upright', () => {
  const rect = recognize(draw([[0, 0], [260, 6], [262, 130], [4, 128], [2, 8]], 4), MIN);
  assert.equal(rect?.label, 'Rectangle');
  const sq = recognize(draw([[0, 0], [150, 3], [148, 152], [2, 149], [1, 6]], 4, 3), MIN);
  assert.equal(sq?.label, 'Square');
  if (sq?.shape.type === 'poly') {
    const [a, b, c] = sq.shape.pts;
    assert.equal(a[1], b[1]);
    assert.equal(b[0], c[0]);
  }
});

test('three corners become a triangle', () => {
  const r = recognize(draw([[100, 0], [200, 170], [0, 170], [98, 6]], 4, 11), MIN);
  assert.equal(r?.label, 'Triangle');
  assert.equal(r?.shape.type === 'poly' && r.shape.pts.length, 3);
});

test('an open angle becomes two straight pieces', () => {
  const r = recognize(draw([[0, 0], [0, 200], [220, 200]], 3, 5), MIN);
  assert.equal(r?.label, 'Angle');
});

test('handwriting and curves are left alone', () => {
  // An S, an arc, a scribble, a dot.
  const s: Pt[] = Array.from({ length: 60 }, (_, i) => { const t = (i / 59) * Math.PI * 2; return [60 * Math.sin(t), i * 4] as Pt; });
  assert.equal(recognize(draw(s, 2), MIN), null);
  assert.equal(recognize(draw(circlePath(0, 0, 100, 100, 0, Math.PI * 0.9), 2), MIN), null);
  const r = rng(9);
  const scribble: Pt[] = Array.from({ length: 50 }, () => [r() * 200, r() * 200] as Pt);
  assert.equal(recognize(draw(scribble, 2), MIN), null);
  assert.equal(recognize([0, 0, 1, 2, 1, 1, 3, 2, 1, 4, 2, 1], MIN), null);
});

test('after the snap: a line end follows the finger, Shift holds 15° steps; shapes scale about their middle', () => {
  const line = { type: 'line' as const, a: [0, 0] as Pt, b: [100, 0] as Pt };
  const free = moveEnd(line, [100, 50], false);
  assert.deepEqual(free.type === 'line' && free.b, [100, 50]);
  const held = moveEnd(line, [100, 26], true);
  if (held.type === 'line') assert.ok(Math.abs(Math.atan2(held.b[1], held.b[0]) - Math.PI / 12) < 1e-9);
  const ring = scaleShape({ type: 'ellipse', cx: 10, cy: 10, rx: 5, ry: 3 }, 2);
  assert.deepEqual(ring, { type: 'ellipse', cx: 10, cy: 10, rx: 10, ry: 6 });
  assert.deepEqual(perfect({ type: 'ellipse', cx: 0, cy: 0, rx: 4, ry: 2 }), { type: 'ellipse', cx: 0, cy: 0, rx: 3, ry: 3 });
});

test('a shape goes back to the board as pen points, corners doubled so they stay sharp', () => {
  const pts = shapePoints({ type: 'poly', pts: [[0, 0], [10, 0], [10, 10]], closed: true }, 0.5);
  assert.equal(pts.length % 3, 0);
  // 0,0 · 10,0 ×2 · 10,10 ×2 · 0,0 ×2
  assert.deepEqual(pts.filter((_, i) => i % 3 !== 2), [0, 0, 10, 0, 10, 0, 10, 10, 10, 10, 0, 0, 0, 0]);
  assert.deepEqual(shapePoints({ type: 'line', a: [1, 2], b: [3, 4] }, 1), [1, 2, 1, 3, 4, 1]);
});
