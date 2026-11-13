import test from 'node:test';
import assert from 'node:assert/strict';
import { behindHeadingAlpha, followAngle, safeCameraDistance, segmentBoxEntry } from '../src/core/cameraFollow.ts';
import { angleDelta } from '../src/core/math.ts';
import { cameraObstacles } from '../src/world/cameraObstacles.ts';
import { DEPOT, CITY_BOUNDS } from '../src/world/city/cityPlan.ts';

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


test('CORE-013: chase camera knows the new depot and town boundaries', () => {
  const solids = cameraObstacles();
  const d = DEPOT.building;
  assert.ok(solids.some((box) =>
    box.minX <= d.minX && box.maxX >= d.maxX &&
    box.minZ <= d.minZ && box.maxZ >= d.maxZ && box.maxY >= DEPOT.height),
  'galpão logístico should obstruct the GTA camera at its full height');
  assert.ok(solids.some((box) => box.maxX > 70 && box.minX < CITY_BOUNDS.maxX && box.maxZ > -80),
    'new eastern town blocks should be covered');
  assert.ok(solids.some((box) => box.minX < -70 && box.maxZ > 60),
    'new northern/western street furniture should be covered');
});
