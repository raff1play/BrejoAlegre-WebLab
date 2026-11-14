import test from 'node:test';
import assert from 'node:assert/strict';
import {circleIntersectsBox,createMotionGuard} from '../src/core/collision.ts';

const house={minX:5,maxX:10,minZ:5,maxZ:10};
test('circle hits house wall',()=>assert.equal(circleIntersectsBox(4.6,7,.6,house),true));
test('circle away from house does not hit',()=>assert.equal(circleIntersectsBox(0,0,.4,house),false));
test('circle exactly touching wall counts as collision',()=>assert.equal(circleIntersectsBox(4.5,7,.5,house),true));
test('movement inside bounds is allowed',()=>{
 const guard=createMotionGuard({minX:-20,maxX:20,minZ:-20,maxZ:20},[house]);
 assert.equal(guard(0,0,.4),true);
});
test('house and world edge block movement',()=>{
 const guard=createMotionGuard({minX:-20,maxX:20,minZ:-20,maxZ:20},[house]);
 assert.equal(guard(8,8,.5),false);
 assert.equal(guard(19.8,0,.5),false);
});
test('invalid position does not enter simulation',()=>{
 const guard=createMotionGuard({minX:-20,maxX:20,minZ:-20,maxZ:20},[]);
 assert.equal(guard(Number.NaN,0,.4),false);
 assert.equal(guard(0,0,-1),false);
});

// ------------------------------------------------------------------ CORE-015.1

test('CORE-015.1: bodies slide along walls at any angle instead of sticking (real streets are not axis-aligned)', async () => {
  const { makePoly, slideMove: slide, createMotionGuard: guardOf } = await import('../src/core/collision.ts');
  // A long thin wall rotated 35° through the origin.
  const a = (35 * Math.PI) / 180; const tx = Math.cos(a); const tz = Math.sin(a); const nx = -tz; const nz = tx;
  const wall = makePoly([[-30 * tx, -30 * tz], [30 * tx, 30 * tz], [30 * tx + nx * 0.22, 30 * tz + nz * 0.22], [-30 * tx + nx * 0.22, -30 * tz + nz * 0.22]]);
  const guard = guardOf({ minX: -100, maxX: 100, minZ: -100, maxZ: 100 }, [], [wall]);
  const allowed = (x: number, z: number) => guard(x, z, 0.3);
  // Start on the south-east side, 0.5 m off the wall, pushing diagonally into it (60° to the wall).
  let x = nx * -0.5; let z = nz * -0.5;
  const push = [Math.cos(a + Math.PI / 3), Math.sin(a + Math.PI / 3)];
  let stuck = 0;
  for (let i = 0; i < 100; i++) {
    const r = slide(x, z, push[0]! * 0.1, push[1]! * 0.1, allowed);
    if (r.stuck) stuck++;
    x = r.x; z = r.z;
    assert.ok(allowed(x, z), 'never inside the wall');
    assert.ok(x * nx + z * nz < 0, 'never crosses to the other side');
  }
  const along = x * tx + z * tz;
  assert.ok(along > 3, `slides along the wall (${along.toFixed(2)} m), stuck ${stuck} times`);
  // Pushing straight into the wall does not creep sideways.
  const still = slide(nx * -0.31, nz * -0.31, nx * 0.5, nz * 0.5, allowed);
  assert.ok(Math.hypot(still.x - nx * -0.31, still.z - nz * -0.31) < 0.25, 'head-on push stays put');
});

test('CORE-015.1: street furniture is solid and matches where it is drawn', async () => {
  const { furniturePolygons, shopFurniture, solidPolygons, streetLightPositions } = await import('../src/world/city/cityLayout.ts');
  const { CITY_BOUNDS, STORES, storeLayout } = await import('../src/world/city/cityPlan.ts');
  const { createMotionGuard: guardOf } = await import('../src/core/collision.ts');
  const guard = guardOf(CITY_BOUNDS, [], solidPolygons());
  const lights = streetLightPositions(); const f = shopFurniture();
  // Street preview now rejects unsafe positions: not every 32 m sample or
  // storefront has room for a pole. The geometric regression verifies every
  // accepted footprint, rather than requiring the former unsafe raw counts.
  assert.ok(lights.length >= 200 && f.lamps.length >= 4 && f.lamps.length <= 16 && f.planters.length === 8,
    `lights=${lights.length}, storefront lamps=${f.lamps.length}`);
  assert.equal(furniturePolygons().length, lights.length + 24);
  for (const l of [...lights, ...f.lamps, ...f.planters]) assert.equal(guard(l.x, l.z, 0.05), false, `solid at ${l.x.toFixed(1)},${l.z.toFixed(1)}`);
  // …and never blocks a shop door or the way to the counter.
  for (const s of STORES) {
    const L = storeLayout(s);
    for (const p of [L.door, L.pickup]) assert.ok(guard(p.x, p.z, 0.3), `${s.id}: door/pickup free`);
  }
});
