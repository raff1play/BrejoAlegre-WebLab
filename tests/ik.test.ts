import test from 'node:test';
import assert from 'node:assert/strict';
import { solveTwoBone } from '../src/core/ik.ts';

const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('two-bone IK keeps bone lengths and reaches a reachable target', () => {
  const root = { x: 0, y: 1, z: 0 };
  const target = { x: 0, y: 0.3, z: 0.3 };
  const r = solveTwoBone(root, target, 0.44, 0.43, { x: 0, y: 0.6, z: 1 });
  assert.ok(r.reached);
  assert.ok(Math.abs(dist(root, r.joint) - 0.44) < 1e-6);
  assert.ok(Math.abs(dist(r.joint, r.end) - 0.43) < 1e-6);
  assert.ok(dist(r.end, target) < 1e-6);
  assert.ok(r.joint.z > 0.3, 'knee bends towards the pole (forward)');
});

test('two-bone IK stretches towards an unreachable target without breaking lengths', () => {
  const root = { x: 0, y: 0, z: 0 };
  const r = solveTwoBone(root, { x: 0, y: -5, z: 0 }, 0.3, 0.3, { x: 0, y: 0, z: 1 });
  assert.equal(r.reached, false);
  assert.ok(Math.abs(dist(root, r.joint) - 0.3) < 1e-6 && Math.abs(dist(r.joint, r.end) - 0.3) < 1e-6);
  assert.ok(r.end.y < -0.59);
});

test('two-bone IK is finite when the pole lies on the limb or the target is at the root', () => {
  for (const [target, pole] of [[{ x: 0, y: -0.4, z: 0 }, { x: 0, y: -1, z: 0 }], [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }]] as const) {
    const r = solveTwoBone({ x: 0, y: 0, z: 0 }, target, 0.3, 0.28, pole);
    for (const v of [r.joint.x, r.joint.y, r.joint.z, r.end.x, r.end.y, r.end.z]) assert.ok(Number.isFinite(v));
  }
});
