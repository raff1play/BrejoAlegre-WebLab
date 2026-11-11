import test from 'node:test';
import assert from 'node:assert/strict';
import { circleIntersectsBox, createMotionGuard } from '../src/core/collision.ts';
import { createMotoState, motoFits, stepMotorcycle } from '../src/core/motorcyclePhysics.ts';
import { heightAt } from '../src/core/terrain.ts';
import { findDismountSpot } from '../src/core/mounting.ts';
import {
  buildColliders, buildOccluders, buildRaisedAreas, CROSS_Z, CURB_H, FRONT, frameRect, HOUSES, PLAZA,
  ROAD_HALF, SHOP, SPAWN, TREES, POLES, WORLD_BOUNDS,
} from '../src/world/layout.ts';

const colliders = buildColliders();
const guard = createMotionGuard(WORLD_BOUNDS, colliders);

test('scene plan has the elements required for 0.1', () => {
  assert.ok(HOUSES.length >= 5, 'at least five house fronts');
  assert.ok(new Set(HOUSES.map((h) => h.wallColor)).size >= 5, 'varied facades');
  assert.ok(HOUSES.some((h) => h.front === 'wall') && HOUSES.some((h) => h.front !== 'wall'));
  assert.ok(SHOP.width > 0 && TREES.length >= 5 && POLES.length >= 3);
  assert.equal(buildOccluders().length, HOUSES.length + 1);
});

test('frames map local lot coordinates to both sides of the street', () => {
  const east = frameRect({ ox: FRONT, oz: 10, side: 1 }, 0, 12, 0, 20);
  assert.deepEqual(east, { minX: FRONT, maxX: FRONT + 20, minZ: -2, maxZ: 10 });
  const west = frameRect({ ox: -FRONT, oz: 10, side: -1 }, 0, 12, 0, 20);
  assert.deepEqual(west, { minX: -FRONT - 20, maxX: -FRONT, minZ: 10, maxZ: 22 });
});

test('both roadways and pavements are free of obstacles end to end', () => {
  for (let z = WORLD_BOUNDS.minZ + 1; z <= WORLD_BOUNDS.maxZ - 1; z += 0.5) {
    for (const x of [-3.4, 0, 3.4]) assert.ok(guard(x, z, 0.45), `main street blocked at ${x},${z}`);
  }
  for (let x = WORLD_BOUNDS.minX + 1; x <= WORLD_BOUNDS.maxX - 1; x += 0.5) {
    for (const dz of [-3.4, 0, 3.4]) assert.ok(guard(x, CROSS_Z + dz, 0.45), `cross street blocked at ${x}`);
  }
  // A pedestrian fits past every street tree and pole on the lot side of the pavement.
  for (let z = WORLD_BOUNDS.minZ + 1; z <= WORLD_BOUNDS.maxZ - 1; z += 0.25) {
    for (const x of [FRONT - 0.4, -FRONT + 0.4]) assert.ok(guard(x, z, 0.3), `pavement blocked at ${x},${z}`);
  }
});

test('spawn bay is free, raised and allows dismounting', () => {
  assert.ok(motoFits(guard, SPAWN.x, SPAWN.z, SPAWN.yaw));
  assert.ok(findDismountSpot(SPAWN, guard));
  const areas = buildRaisedAreas();
  assert.equal(heightAt(SPAWN.x, SPAWN.z, areas), CURB_H);
  assert.equal(heightAt(0, 0, areas), 0);
  assert.equal(heightAt(0, CROSS_Z, areas), 0, 'the junction is roadway');
  assert.equal(heightAt(ROAD_HALF + 1, 10, areas), CURB_H);
  assert.equal(heightAt((PLAZA.minX + PLAZA.maxX) / 2, (PLAZA.minZ + PLAZA.maxZ) / 2, areas), CURB_H);
});

test('the playable area is sealed: nothing reachable lies outside streets, forecourt, square and open yards', () => {
  // Flood fill from the spawn on a 0.5 m grid with the pedestrian radius.
  const step = 0.5;
  const key = (x: number, z: number) => `${Math.round(x / step)},${Math.round(z / step)}`;
  const seen = new Set<string>([key(SPAWN.x, SPAWN.z)]);
  const queue: [number, number][] = [[Math.round(SPAWN.x / step) * step, Math.round(SPAWN.z / step) * step]];
  let reachedPlaza = false;
  let reachedNorthEnd = false;
  while (queue.length) {
    const [x, z] = queue.pop()!;
    if (x < PLAZA.maxX - 2 && x > PLAZA.minX && z < PLAZA.maxZ - 2 && z > PLAZA.minZ) reachedPlaza = true;
    if (z > WORLD_BOUNDS.maxZ - 2) reachedNorthEnd = true;
    for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]] as const) {
      const nx = x + dx;
      const nz = z + dz;
      if (seen.has(key(nx, nz)) || !guard(nx, nz, 0.3)) continue;
      seen.add(key(nx, nz));
      queue.push([nx, nz]);
    }
  }
  assert.ok(reachedPlaza && reachedNorthEnd, 'streets, square and street ends are connected');
  const total = ((WORLD_BOUNDS.maxX - WORLD_BOUNDS.minX) * (WORLD_BOUNDS.maxZ - WORLD_BOUNDS.minZ)) / (step * step);
  assert.ok(seen.size < total * 0.45, `walled blocks are not reachable (${seen.size}/${total})`);
  // No reachable cell is inside a house body.
  for (const house of HOUSES) {
    const body = frameRect(house.frame, 4, 8, house.setback + 1, house.setback + 8);
    const cx = (body.minX + body.maxX) / 2;
    const cz = (body.minZ + body.maxZ) / 2;
    assert.ok(!seen.has(key(cx, cz)), `${house.id} interior is reachable`);
    assert.ok(circleIntersectsBox(cx, cz, 0.3, colliders.find((c) => circleIntersectsBox(cx, cz, 0.3, c))!));
  }
});

test('riding flat out from the spawn into the houses across the street ends stopped outside them', () => {
  const s = createMotoState(SPAWN.x, SPAWN.z, SPAWN.yaw);
  for (let i = 0; i < 60 * 20; i++) stepMotorcycle(s, { throttle: 1, brake: 0, steer: 0 }, 1 / 60, guard);
  assert.ok(motoFits(guard, s.x, s.z, s.yaw));
  assert.ok(s.x > WORLD_BOUNDS.minX && s.x < SPAWN.x - 15, `crossed the street into the square: x=${s.x}`);
  assert.equal(s.speed, 0);
  const north = createMotoState(2, 0, 0);
  for (let i = 0; i < 60 * 20; i++) stepMotorcycle(north, { throttle: 1, brake: 0, steer: 0 }, 1 / 60, guard);
  assert.ok(north.z <= WORLD_BOUNDS.maxZ && north.z > WORLD_BOUNDS.maxZ - 2 && north.speed === 0, 'stops at the street end');
});
