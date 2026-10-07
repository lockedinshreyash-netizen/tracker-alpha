import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDLE, transition, isBusy, type AcqState } from '../store/PackAcquisition';
import { EDGE_SPEED, MAX_OVER, TAU, edgeHit, glideAt, planRelease, releaseVelocity, rubber, snap, springStep, atRest, swayStep, SWAY } from '../store/physics';
import { geometry } from '../store/geometry';

const b = { min: -1000, max: 0 };

test('rack: a slow drag places, a fast swipe throws farther', () => {
  const slow = planRelease(-200, -0.05, 200, b, 0);
  assert.equal(slow.kind, 'spring');
  assert.equal(slow.to, -200);
  const fast = planRelease(-200, -1.5, 200, b, 0);
  const medium = planRelease(-200, -0.8, 200, b, 0);
  assert.ok(fast.to < medium.to, `${fast.to} < ${medium.to}`);
  assert.ok(Math.abs(fast.to - -200) >= 400);
});

test('rack: a glide leaves at the finger\'s speed and lands on a hook', () => {
  const m = planRelease(-130, -1.0, 200, b, 1000);
  assert.equal(m.kind, 'glide');
  if (m.kind !== 'glide') return;
  assert.equal(Math.abs(m.to % 200), 0);
  const v0 = (glideAt(m, 1001) - glideAt(m, 1000)) / 1;
  assert.ok(Math.abs(v0 - -1.0) < 0.01, `v0 ${v0}`);
  assert.ok(Math.abs(glideAt(m, 1000 + 10 * m.tau) - m.to) < 0.35, "within the landing snap");
  // Monotonic: no overshoot, no bounce.
  let prev = -130;
  for (let t = 1000; t < 1000 + 6 * m.tau; t += 16) { const x = glideAt(m, t); assert.ok(x <= prev + 1e-9); prev = x; }
});

test('rack: a throw past the end glides on toward it, at full speed', () => {
  const m = planRelease(-900, -2.5, 200, b, 0);
  assert.equal(m.kind, 'glide');
  if (m.kind !== 'glide') return;
  assert.ok(m.to < -1000);
  assert.ok(Math.abs((glideAt(m, 1) - glideAt(m, 0)) - -2.5) < 0.05, 'leaves at the finger\'s speed');
});

test('rack: hitting an end is one short, firm bump, settled fast', () => {
  // Even a wild flick arrives capped, overshoots a little, and is home in under 250ms.
  const m = edgeHit(b, -2.6);
  assert.equal(m.to, -1000);
  if (m.kind !== 'spring') return;
  let x = -1000, v = m.v, worst = 0, t = 0;
  while (!atRest(x, v, m.to) && t < 2000) { ({ x, v } = springStep(x, v, m.to, 8, true)); worst = Math.max(worst, Math.abs(x - m.to)); t += 8; }
  assert.ok(Math.abs(m.v) <= EDGE_SPEED);
  assert.ok(worst <= 16, `overshoot ${worst.toFixed(1)}px`);
  assert.ok(t <= 400, `settled in ${t}ms`);
});

test('rack: let go past an end, it springs back firmly and without bouncing', () => {
  let x = 40, v = 0, t = 0;
  let maxBack = 0;
  while (!atRest(x, v, 0) && t < 2000) { ({ x, v } = springStep(x, v, 0, 8, true)); maxBack = Math.min(maxBack, x); t += 8; }
  assert.ok(maxBack > -0.5, `overshoot ${maxBack}`);
  assert.ok(t <= 400, `back in ${t}ms`);
  // A fling further out is not honoured.
  const m = planRelease(40, 1.5, 200, b, 0);
  assert.equal(m.kind, 'spring');
  if (m.kind === 'spring') { assert.equal(m.v, 0); assert.equal(m.stiff, true); }
});

test('rack: past the ends it follows less and less, never more than MAX_OVER', () => {
  assert.equal(rubber(-500, b), -500);
  const a = rubber(50, b);
  const c = rubber(400, b);
  const z = rubber(100000, b);
  assert.ok(a > 0 && a < 50);
  assert.ok(c > a && c < MAX_OVER);
  assert.ok(z < MAX_OVER);
  assert.ok(rubber(-1300, b) > -1000 - MAX_OVER);
});

test('rack: snap stays within the ends', () => {
  assert.equal(snap(-1180, 200, b), -1000);
  assert.equal(snap(90, 200, b), 0);
  assert.equal(snap(-310, 200, b), -400);
});

test('rack: a finger that stopped before lifting throws nothing', () => {
  const s = [{ t: 0, x: 0 }, { t: 16, x: -20 }, { t: 32, x: -40 }];
  assert.ok(releaseVelocity(s, 40) < -1);
  assert.equal(releaseVelocity(s, 200), 0);
});

test('sway: a rack accelerating left leans the foot right, then settles', () => {
  let theta = 0, w = 0, peak = 0;
  for (let i = 0; i < 10; i += 1) ({ theta, w } = swayStep(theta, w, -0.006, 16));
  peak = theta;
  assert.ok(peak < 0, 'leans');
  for (let i = 0; i < 400; i += 1) ({ theta, w } = swayStep(theta, w, 0, 16));
  assert.ok(Math.abs(theta) < 0.001, 'settles');
  for (let i = 0; i < 200; i += 1) ({ theta, w } = swayStep(theta, w, -1, 16));
  assert.ok(Math.abs(theta) <= SWAY.max + 1e-9, 'capped');
  assert.ok(TAU > 0);
});

test('acquire: the pack comes off the hook only after the server says yes', () => {
  let s: AcqState = transition(IDLE, { type: 'SELECT', packId: 'p' });
  s = transition(s, { type: 'ACQUIRE' });
  assert.equal(s.phase, 'acquiring');
  assert.equal(transition(s, { type: 'STEP' }), s, 'no animation before confirmation');
  const failed = transition(s, { type: 'FAILED', error: 'nope' });
  assert.equal(failed.phase, 'selected');
  assert.equal(failed.error, 'nope');
  s = transition(s, { type: 'CONFIRMED' });
  const seen = [s.phase];
  for (let i = 0; i < 10; i += 1) { s = transition(s, { type: 'STEP' }); seen.push(s.phase); }
  assert.deepEqual(seen.slice(0, 6), ['detaching', 'centering', 'tearing', 'revealing', 'transitioning', 'acquired']);
  assert.equal(transition(s, { type: 'FINISH' }), IDLE);
});

test('acquire: a second tap, a second pack or a stray close changes nothing mid-flight', () => {
  let s: AcqState = transition(transition(IDLE, { type: 'SELECT', packId: 'p' }), { type: 'ACQUIRE' });
  assert.equal(transition(s, { type: 'ACQUIRE' }), s);
  assert.equal(transition(s, { type: 'SELECT', packId: 'q' }), s);
  assert.equal(transition(s, { type: 'DESELECT' }), s);
  assert.ok(isBusy(s));
  s = transition(s, { type: 'CONFIRMED' });
  assert.equal(transition(s, { type: 'CONFIRMED' }), s);
  assert.equal(transition(s, { type: 'FINISH' }), s);
});

test('geometry: the rod rests at the top of the slot, the tear starts below it', () => {
  const g = geometry(200, 300, 7);
  assert.equal(g.pivot.x, 100);
  assert.ok(g.pivot.y < g.hole.cy && g.hole.cy < g.tab.h && g.tab.h < g.perf && g.perf < 300);
  assert.equal(g.edge[0].x, 0);
  assert.equal(g.edge[g.edge.length - 1].x, 200);
  assert.ok(g.edge.every(p => Math.abs(p.y - g.perf) <= 1.4));
  assert.deepEqual(geometry(200, 300, 7).edge, g.edge, 'the same pack tears the same way');
  assert.notDeepEqual(geometry(200, 300, 8).edge, g.edge);
});
