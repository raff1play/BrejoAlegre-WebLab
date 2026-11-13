import test from 'node:test';
import assert from 'node:assert/strict';
import { behindHeadingAlpha, followAngle, safeCameraDistance, segmentBoxEntry } from '../src/core/cameraFollow.ts';
import { angleDelta } from '../src/core/math.ts';
import { cameraObstacles } from '../src/world/cameraObstacles.ts';
import { DEPOT, CITY_BOUNDS, CITY_LOTS } from '../src/world/city/cityPlan.ts';
import { framePoint } from '../src/world/layout.ts';

const wall = { minX: -1, maxX: 1, minY: 0, maxY: 4, minZ: -4, maxZ: -3 };

test('chase alpha stays behind vehicle heading at cardinal directions', () => {
  for (const yaw of [-Math.PI, -Math.PI / 2, 0, Math.PI / 2, Math.PI]) {
    const a = behindHeadingAlpha(yaw);
    const forwardX = -Math.cos(a);
    const forwardZ = -Math.sin(a);
    assert.ok(Math.abs(forwardX - Math.sin(yaw)) < 1e-8);
    assert.ok(Math.abs(forwardZ - Math.cos(yaw)) < 1e-8);
  }
});

test('following a yaw across the angular wrap uses the shortest arc', () => {
  const start = Math.PI - 0.02;
  const end = -Math.PI + 0.02;
  const after = followAngle(start, end, 3, 0.1);
  assert.ok(angleDelta(start, after) > 0);
  assert.ok(Math.abs(angleDelta(after, end)) < Math.abs(angleDelta(start, end)));
});

test('segment/AABB entry handles hits, misses and vertical clearance', () => {
  assert.ok(Math.abs(segmentBoxEntry({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: -6 }, wall) ! - 0.5) < 1e-9);
  assert.equal(segmentBoxEntry({ x: 3, y: 1, z: 0 }, { x: 3, y: 1, z: -6 }, wall), null);
  assert.equal(segmentBoxEntry({ x: 0, y: 6, z: 0 }, { x: 0, y: 6, z: -6 }, wall), null);
});

test('camera stays before an obstacle and recovers full radius in clear view', () => {
  const focus = { x: 0, y: 1.3, z: 0 };
  const blocked = safeCameraDistance(focus, { x: 0, y: 2.5, z: -6 }, [wall]);
  const clear = safeCameraDistance(focus, { x: 0, y: 2.5, z: 6 }, [wall]);
  assert.ok(blocked >= 0.7 && blocked < 3.5, `blocked ${blocked}`);
  assert.ok(clear > 5.9, `clear ${clear}`);
});

test('world camera obstacles include buildings and street furniture', () => {
  const solids = cameraObstacles();
  assert.ok(solids.length > 30);
  assert.ok(solids.every((b) => b.minX <= b.maxX && b.minY < b.maxY && b.minZ <= b.maxZ));
});


test('CORE-015: chase camera knows the real town (rotated houses, depot roof, shop ceilings)', () => {
  const solids = cameraObstacles();
  assert.ok(solids.some((box) => box.yaw !== undefined && box.maxY >= DEPOT.height && box.minY > 5), 'depot roof slab (oriented)');
  assert.ok(solids.filter((b) => b.yaw !== undefined).length > CITY_LOTS.length, 'every house is an oriented blocker');
  // A camera ray through a rotated house is blocked; one along the street in front of it is not.
  const lot = CITY_LOTS[0]!;
  const inside = framePoint(lot.frame, lot.width / 2, 9);
  const front = framePoint(lot.frame, lot.width / 2, -4);
  const sideways = framePoint(lot.frame, lot.width / 2 + 30, -4);
  assert.ok(safeCameraDistance({ x: front.x, y: 1.5, z: front.z }, { x: inside.x, y: 2, z: inside.z }, solids) < 12, 'blocked by the house');
  const along = safeCameraDistance({ x: front.x, y: 1.5, z: front.z }, { x: sideways.x, y: 1.5, z: sideways.z }, solids);
  assert.ok(along > 2, `free along the street (${along.toFixed(1)} m)`);
  void CITY_BOUNDS;
});
