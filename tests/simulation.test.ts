import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionGuard, slideMove, type MotionGuard } from '../src/core/collision.ts';
import { MOTO, createMotoState, isMotoStopped, motoFits, stepMotorcycle } from '../src/core/motorcyclePhysics.ts';
import { stepWalker, WALKER, type WalkerState } from '../src/core/walking.ts';
import { canMount, findDismountSpot } from '../src/core/mounting.ts';
import { heightAt } from '../src/core/terrain.ts';
import { InputState } from '../src/core/inputState.ts';
import { angleDelta, approach, segmentIntersectsBox } from '../src/core/math.ts';

const open: MotionGuard = createMotionGuard({ minX: -500, maxX: 500, minZ: -500, maxZ: 500 }, []);
const idle = { throttle: 0, brake: 0, steer: 0 };
const run = (state: ReturnType<typeof createMotoState>, controls: typeof idle, seconds: number, guard = open, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) stepMotorcycle(state, controls, dt, guard);
  return state;
};

test('moto accelerates progressively and never exceeds top speed', () => {
  const s = createMotoState(0, 0, 0);
  run(s, { ...idle, throttle: 1 }, 1);
  const after1 = s.speed;
  assert.ok(after1 > 3 && after1 < 6, `speed after 1 s: ${after1}`);
  run(s, { ...idle, throttle: 1 }, 1);
  assert.ok(s.speed - after1 < after1, 'acceleration fades as speed builds');
  run(s, { ...idle, throttle: 1 }, 30);
  assert.ok(s.speed <= MOTO.maxSpeed && s.speed > MOTO.maxSpeed * 0.97);
  assert.ok(s.z > 100 && Math.abs(s.x) < 1e-6, 'drives straight ahead along +z');
});

test('moto brakes to a full stop and coasts down without input', () => {
  const s = run(createMotoState(0, 0, 0), { ...idle, throttle: 1 }, 6);
  const cruising = s.speed;
  run(s, idle, 2);
  assert.ok(s.speed < cruising && s.speed > 0, 'coasting slows the bike gently');
  run(s, { ...idle, brake: 1 }, 1.2);
  assert.equal(s.speed, 0);
  assert.equal(isMotoStopped(s), true);
  run(s, { ...idle, brake: 1 }, 3);
  assert.equal(s.speed, 0, 'holding the brake after stopping does not roll back');
  run(s, idle, 20);
  assert.equal(s.speed, 0, 'stays parked');
});

test('pressing brake again at rest backs up slowly; throttle recovers forward motion', () => {
  const s = createMotoState(0, 0, 0);
  run(s, { ...idle, brake: 1 }, 3);
  assert.ok(s.speed < 0 && s.speed >= -MOTO.reverseSpeed);
  assert.ok(s.z < 0);
  run(s, { ...idle, throttle: 1 }, 2);
  assert.ok(s.speed > 0);
});

test('steering turns right for positive input, only while moving, and leans into the curve', () => {
  const parked = run(createMotoState(0, 0, 0), { ...idle, steer: 1 }, 2);
  assert.equal(parked.yaw, 0, 'no rotation at rest');
  assert.ok(Math.abs(parked.lean) < 1e-6, 'upright at rest (balance assist)');
  const s = run(createMotoState(0, 0, 0), { throttle: 1, brake: 0, steer: 1 }, 2);
  assert.ok(s.yaw > 0.5, 'yaw grows to the right');
  assert.ok(s.x > 0, 'moves towards +x');
  assert.ok(s.lean > 0.05 && s.lean <= MOTO.maxLean, `moderate lean: ${s.lean}`);
  const left = run(createMotoState(0, 0, 0), { throttle: 1, brake: 0, steer: -1 }, 2);
  assert.ok(Math.abs(left.yaw + s.yaw) < 1e-9 && Math.abs(left.x + s.x) < 1e-9, 'left mirrors right');
  run(s, { throttle: 1, brake: 0, steer: 0 }, 1.5);
  assert.ok(Math.abs(s.lean) < 0.02, 'recovers upright after the curve');
});

test('simulation result is nearly independent of frame rate', () => {
  const controls = { throttle: 1, brake: 0, steer: 0.4 };
  const a = run(createMotoState(0, 0, 0), controls, 3, open, 1 / 30);
  const b = run(createMotoState(0, 0, 0), controls, 3, open, 1 / 120);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.8, `30 vs 120 Hz drift ${Math.hypot(a.x - b.x, a.z - b.z)}`);
});

test('moto cannot cross a wall or leave the bounds, even at top speed and low frame rate', () => {
  const wall = { minX: -20, maxX: 20, minZ: 60, maxZ: 60.2 };
  const guard = createMotionGuard({ minX: -30, maxX: 30, minZ: -30, maxZ: 100 }, [wall]);
  for (const dt of [1 / 60, 1 / 20]) {
    const s = run(createMotoState(0, 0, 0), { ...idle, throttle: 1 }, 15, guard, dt);
    assert.ok(s.z + MOTO.bodyOffset + MOTO.bodyRadius <= 60, `stopped before wall at dt=${dt}: z=${s.z}`);
    assert.equal(s.speed, 0);
  }
  const edge = run(createMotoState(0, 0, Math.PI / 2), { ...idle, throttle: 1 }, 15, guard);
  assert.ok(edge.x < 30 && motoFits(guard, edge.x, edge.z, edge.yaw));
});

test('moto hitting a wall at an angle slides along it and can back away', () => {
  const guard = createMotionGuard({ minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, [{ minX: 5, maxX: 6, minZ: -100, maxZ: 100 }]);
  const s = run(createMotoState(0, 0, 0.5), { ...idle, throttle: 1 }, 4, guard);
  assert.ok(motoFits(guard, s.x, s.z, s.yaw));
  assert.ok(s.z > 3, 'kept moving along the wall instead of sticking');
  const before = s.x;
  run(s, idle, 3, guard);
  run(s, { ...idle, brake: 1 }, 3, guard);
  assert.ok(s.x < before, 'reverse frees the bike');
});

test('slideMove blocks head-on and reports it', () => {
  const allowed = (x: number) => x < 1;
  const r = slideMove(0, 0, 5, 0, allowed);
  assert.ok(r.x < 1 && r.stuck && r.blocked);
});

test('pedestrian walks relative to the camera heading and is stopped by walls', () => {
  const guard = createMotionGuard({ minX: -50, maxX: 50, minZ: -50, maxZ: 50 }, [{ minX: -50, maxX: 50, minZ: 4, maxZ: 5 }]);
  const w: WalkerState = { x: 0, z: 0, yaw: 0, moving: false };
  for (let i = 0; i < 60; i++) stepWalker(w, { forward: 1, right: 0 }, Math.PI / 2, 1 / 60, guard);
  assert.ok(Math.abs(w.x - WALKER.speed) < 0.05 && Math.abs(w.z) < 1e-6, 'forward follows the view heading');
  for (let i = 0; i < 60; i++) stepWalker(w, { forward: 0, right: 1 }, Math.PI / 2, 1 / 60, guard);
  assert.ok(w.z < -WALKER.speed + 0.05, 'right of an east-looking camera is south');
  for (let i = 0; i < 600; i++) stepWalker(w, { forward: 1, right: 0 }, 0, 1 / 60, guard);
  assert.ok(w.z <= 4 - WALKER.radius + 1e-6 && w.z > 3.4, `stopped at wall: ${w.z}`);
  stepWalker(w, { forward: 0, right: 0 }, 0, 1 / 60, guard);
  assert.equal(w.moving, false);
  const diag: WalkerState = { x: 0, z: 0, yaw: 0, moving: false };
  for (let i = 0; i < 60; i++) stepWalker(diag, { forward: 1, right: 1 }, 0, 1 / 60, open);
  assert.ok(Math.abs(Math.hypot(diag.x, diag.z) - WALKER.speed) < 0.05, 'diagonals are not faster');
});

test('dismount picks a free side and mounting needs proximity', () => {
  const moto = { x: 0, z: 0, yaw: 0 };
  const left = findDismountSpot(moto, open);
  assert.ok(left && left.x < 0, 'left side by default');
  const wallOnLeft = createMotionGuard({ minX: -50, maxX: 50, minZ: -50, maxZ: 50 }, [{ minX: -2, maxX: -0.6, minZ: -5, maxZ: 5 }]);
  const right = findDismountSpot(moto, wallOnLeft);
  assert.ok(right && right.x > 0, 'falls back to the right side');
  assert.equal(findDismountSpot(moto, () => false), null);
  assert.equal(canMount({ x: 1.5, z: 0 }, moto), true);
  assert.equal(canMount({ x: 4, z: 0 }, moto), false);
});

test('terrain height is the kerb height on raised areas only', () => {
  const areas = [{ box: { minX: 4, maxX: 6, minZ: -10, maxZ: 10 }, height: 0.15 }];
  assert.equal(heightAt(0, 0, areas), 0);
  assert.equal(heightAt(5, 0, areas), 0.15);
  assert.equal(heightAt(5, 11, areas), 0);
});

test('input state never leaves a control stuck', () => {
  const input = new InputState<'left' | 'right' | 'accelerate'>();
  input.press('keyboard', 'left');
  input.press('pointer-1', 'left');
  input.release('keyboard', 'left');
  assert.equal(input.isDown('left'), true, 'still held by the finger');
  input.releaseSource('pointer-1');
  assert.equal(input.isDown('left'), false);
  input.press('pointer-2', 'right');
  assert.equal(input.axis('right', 'left'), 1);
  input.press('keyboard', 'left');
  assert.equal(input.axis('right', 'left'), 0, 'opposites cancel');
  input.clear();
  assert.equal(input.isDown('right') || input.isDown('left'), false);
  input.release('ghost', 'left');
});

test('math helpers', () => {
  assert.ok(Math.abs(angleDelta(3, -3) - (2 * Math.PI - 6)) < 1e-9);
  assert.ok(approach(0, 10, 5, 10) > 9.99);
  const box = { minX: 0, maxX: 2, minY: 0, maxY: 4, minZ: 0, maxZ: 2 };
  assert.equal(segmentIntersectsBox({ x: -5, y: 6, z: 1 }, { x: 5, y: 1, z: 1 }, box), true);
  assert.equal(segmentIntersectsBox({ x: -5, y: 9, z: 1 }, { x: 5, y: 6, z: 1 }, box), false);
  assert.equal(segmentIntersectsBox({ x: -5, y: 1, z: 1 }, { x: -1, y: 1, z: 1 }, box), false);
});
