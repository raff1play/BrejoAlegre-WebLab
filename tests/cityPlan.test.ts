import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOCKS, BUS_STOPS, CHURCH, CITY_BOUNDS, CITY_LOTS, DEPOT, NODES, ROADS, SCHOOL, SERVICES, STORES,
  cityColliders, nodeById, pointsOfInterest, roadSpan, subtractBoxes, walkableAreas, storeLayout } from '../src/world/city/cityPlan.ts';
import { frameRect, HOUSES, ROAD_HALF, SHOP, LOT_WIDTH, LOT_DEPTH } from '../src/world/layout.ts';
import type { Box2D } from '../src/core/collision.ts';

const overlap = (a: Box2D, b: Box2D, eps = 0.01) => a.minX < b.maxX - eps && b.minX < a.maxX - eps && a.minZ < b.maxZ - eps && b.minZ < a.maxZ - eps;
const inside = (a: Box2D, b: Box2D, eps = 0.01) => a.minX >= b.minX - eps && a.maxX <= b.maxX + eps && a.minZ >= b.minZ - eps && a.maxZ <= b.maxZ + eps;

test('CORE-013 road network is consistent and axis-aligned', () => {
  for (const r of ROADS) {
    const a = nodeById(r.a); const b = nodeById(r.b);
    assert.ok(a.x === b.x || a.z === b.z, `${r.id} is straight`);
    const s = roadSpan(r);
    assert.ok(s.hi > s.lo, `${r.id} runs west→east or south→north`);
  }
  for (const n of NODES) assert.ok(ROADS.some((r) => r.a === n.id || r.b === n.id), `${n.id} is connected`);
  assert.equal(NODES.filter((n) => n.control === 'signal').length, 3);
});

test('CORE-013 eight stores, depot, landmarks and lots never overlap each other or the roads', () => {
  assert.equal(STORES.length, 8);
  assert.equal(new Set(STORES.map((s) => s.id)).size, 8);
  const footprints: [string, Box2D][] = [
    ...STORES.slice(1).map((s): [string, Box2D] => [s.id, frameRect(s.frame, 0, s.width, 0, s.depth)]),
    ['mercearia', SHOP.lot],
    ...CITY_LOTS.map((l): [string, Box2D] => [l.id, frameRect(l.frame, 0, LOT_WIDTH, 0, LOT_DEPTH)]),
    ...HOUSES.map((h): [string, Box2D] => [h.id, frameRect(h.frame, 0, LOT_WIDTH, 0, LOT_DEPTH)]),
    ['igreja', frameRect(CHURCH.frame, 0, CHURCH.width, 0, CHURCH.depth)],
    ['escola', frameRect(SCHOOL.frame, 0, SCHOOL.width, 0, SCHOOL.depth)],
    ['servicos', frameRect(SERVICES.frame, 0, SERVICES.width, 0, SERVICES.depth)],
  ];
  for (let i = 0; i < footprints.length; i++) {
    const [id, box] = footprints[i]!;
    assert.ok(BLOCKS.some((b) => inside(box, b.box)), `${id} sits inside an urban block`);
    for (let j = i + 1; j < footprints.length; j++) assert.ok(!overlap(box, footprints[j]![1]), `${id} overlaps ${footprints[j]![0]}`);
  }
  assert.ok(inside(DEPOT.building, DEPOT.lot) && inside(DEPOT.yard, DEPOT.lot));
});

test('CORE-013 store stop points are on the carriageway and doors face a pavement', () => {
  for (const s of STORES) {
    const onRoad = ROADS.some((r) => {
      const span = roadSpan(r);
      const along = span.axis === 'x' ? s.stop.x : s.stop.z;
      const across = span.axis === 'x' ? s.stop.z : s.stop.x;
      return along >= span.lo && along <= span.hi && Math.abs(across - span.c) <= ROAD_HALF;
    });
    assert.ok(onRoad, `${s.id} stop point lies on a road`);
  }
  assert.equal(pointsOfInterest().filter((p) => p.kind === 'loja').length, 8);
  assert.equal(BUS_STOPS.length, 4);
});

test('box subtraction keeps area and leaves holes open', () => {
  const box = { minX: 0, maxX: 10, minZ: 0, maxZ: 10 };
  const holes = [{ minX: 2, maxX: 4, minZ: 2, maxZ: 4 }, { minX: 8, maxX: 12, minZ: -1, maxZ: 3 }];
  const pieces = subtractBoxes(box, holes);
  const area = pieces.reduce((a, p) => a + (p.maxX - p.minX) * (p.maxZ - p.minZ), 0);
  assert.ok(Math.abs(area - (100 - 4 - 6)) < 1e-9);
  for (const p of pieces) for (const h of holes) assert.ok(!overlap(p, h));
  // Walkable areas are not covered by the block fill.
  const solid = cityColliders();
  // Shop floors have a counter in the middle: their customer spot (pickup) is checked instead.
  const floors = STORES.filter((st) => st.id !== 'mercearia').map((st) => storeLayout(st));
  for (const w of walkableAreas()) {
    const shop = floors.find((f) => f.floor === w || (f.floor.minX === w.minX && f.floor.maxZ === w.maxZ && f.floor.minZ === w.minZ));
    const cx = shop ? shop.pickup.x : (w.minX + w.maxX) / 2; const cz = shop ? shop.pickup.z : (w.minZ + w.maxZ) / 2;
    assert.ok(!solid.some((c) => cx > c.minX && cx < c.maxX && cz > c.minZ && cz < c.maxZ), 'walkable centre is free');
  }
  assert.ok(CITY_BOUNDS.maxX > 140 && CITY_BOUNDS.minZ < -150);
});
