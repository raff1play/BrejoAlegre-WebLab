import test from 'node:test';
import assert from 'node:assert/strict';
import { circleIntersectsPoly, createMotionGuard, pointInPoly } from '../src/core/collision.ts';
import { solidPolygons } from '../src/world/city/cityLayout.ts';
import { CITY_BOUNDS, STORES, storeLayout, storePlan } from '../src/world/city/cityPlan.ts';
import { MOTO } from '../src/core/motorcyclePhysics.ts';
import { WALKER } from '../src/core/walking.ts';

/**
 * CORE-015.1: the eight shops can be entered, walked and left. The floor plan (storePlan) is the
 * single source of the drawn furniture and of the colliders, so these checks cover both.
 */
const guard = createMotionGuard(CITY_BOUNDS, [], solidPolygons());

/** Flood fill on a 0.2 m grid for a body of radius r, limited to `limit` metres from the start. */
function reach(start: { x: number; z: number }, r: number, limit: number): (p: { x: number; z: number }) => boolean {
  const step = 0.2; const key = (i: number, j: number) => `${i},${j}`;
  const seen = new Set<string>([key(0, 0)]); const queue: [number, number][] = [[0, 0]];
  while (queue.length) {
    const [i, j] = queue.pop()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di; const nj = j + dj;
      if (seen.has(key(ni, nj)) || Math.hypot(ni, nj) * step > limit) continue;
      if (!guard(start.x + ni * step, start.z + nj * step, r)) continue;
      seen.add(key(ni, nj)); queue.push([ni, nj]);
    }
  }
  return (p) => {
    const i = Math.round((p.x - start.x) / step); const j = Math.round((p.z - start.z) / step);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (seen.has(key(i + a, j + b))) return true;
    return false;
  };
}

test('the eight shops: door → counter → out, with room to spare, and the staff side is reachable', () => {
  assert.equal(STORES.length, 8);
  for (const s of STORES) {
    const L = storeLayout(s);
    // From the pavement in front of the shop, on foot.
    const walk = reach(s.door, WALKER.radius, 30);
    assert.ok(walk(L.door), `${s.id}: forecourt reachable from the pavement`);
    assert.ok(walk(L.pickup), `${s.id}: pickup spot reachable from the street`);
    assert.ok(walk(L.employee) && walk(L.stock), `${s.id}: way round the counter (staff side) is open`);
    for (const q of L.queue) assert.ok(guard(q.x, q.z, 0.2), `${s.id}: queue spot free`);
    // A body twice as wide still gets from the door to the counter (no pinch points on the aisle).
    const wide = reach(s.door, WALKER.radius * 2, 30);
    assert.ok(wide(L.pickup), `${s.id}: 2× wide body reaches the counter`);
    // And back out: from the pickup spot to the pavement.
    assert.ok(reach(L.pickup, WALKER.radius, 30)(s.door), `${s.id}: way out`);
  }
});

test('shop furniture sits inside the shell, off the door line and off every interaction spot', () => {
  for (const s of STORES) {
    const L = storeLayout(s); const p = storePlan(s);
    for (const d of [...L.displays, ...L.shelves, L.counter]) {
      for (const q of d.pts) assert.ok(pointInPoly(L.floor.pts, q[0], q[1]), `${s.id}: furniture inside the shop`);
      for (const spot of [L.door, L.pickup, L.employee, L.stock, ...L.queue]) assert.equal(circleIntersectsPoly(spot.x, spot.z, 0.3, d), false, `${s.id}: spot clear of furniture`);
    }
    // The aisle between the window display and the signature fixture is wider than the door.
    assert.ok(p.feature.x0 - p.windowDisplay.x1 >= p.door1 - p.door0, `${s.id}: aisle ${(p.feature.x0 - p.windowDisplay.x1).toFixed(1)} m`);
    assert.ok(p.windowDisplay.x1 <= p.door0 - 0.5 && p.feature.x0 >= p.door1 + 0.3, `${s.id}: door line clear`);
    assert.ok(s.width - 3.2 - 0.25 >= 2, `${s.id}: passage beside the counter`);
  }
});

test('the bike does not fit through a shop door', () => {
  for (const s of STORES) {
    const L = storeLayout(s);
    // The doorway polygon covers the whole opening, so the rider guard (main.ts) refuses it.
    const mid = { x: (L.doorway.pts[0]![0] + L.doorway.pts[2]![0]) / 2, z: (L.doorway.pts[0]![1] + L.doorway.pts[2]![1]) / 2 };
    assert.ok(circleIntersectsPoly(mid.x, mid.z, MOTO.bodyRadius, L.doorway), `${s.id}: doorway covers the opening`);
    assert.ok(Math.hypot(L.doorway.pts[0]![0] - L.doorway.pts[1]![0], L.doorway.pts[0]![1] - L.doorway.pts[1]![1]) >= 2.5, `${s.id}: opening is 2.6 m`);
    assert.ok(pointInPoly(L.interior.pts, L.pickup.x, L.pickup.z), `${s.id}: counter is inside the shell`);
  }
});

test('GFX-001: staff route round the counter is clear, and the new fixtures keep the shops walkable', () => {
  for (const s of STORES) {
    const L = storeLayout(s);
    const route = [L.employee, ...L.staffPath, L.door];
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1]!; const b = route[i]!;
      for (let k = 0; k <= 20; k++) {
        const x = a.x + (b.x - a.x) * (k / 20); const z = a.z + (b.z - a.z) * (k / 20);
        assert.ok(guard(x, z, 0.25), `${s.id}: staff route leg ${i} blocked at ${x.toFixed(1)},${z.toFixed(1)}`);
      }
    }
    // Customers: door → every queue spot in a straight line without touching furniture.
    for (const q of L.queue) for (let k = 0; k <= 20; k++) {
      const x = L.door.x + (q.x - L.door.x) * (k / 20); const z = L.door.z + (q.z - L.door.z) * (k / 20);
      assert.ok(guard(x, z, 0.2), `${s.id}: customer line to the queue blocked at ${x.toFixed(1)},${z.toFixed(1)}`);
    }
  }
});
