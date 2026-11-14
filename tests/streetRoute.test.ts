import test from 'node:test';
import assert from 'node:assert/strict';
import { streetRoute } from '../src/core/city/streetRoute.ts';
import { roadDistance } from '../src/world/geo/geoCity.ts';
import { ROADS, STORES, depotWorld } from '../src/world/city/cityPlan.ts';
import { buildAddresses } from '../src/core/delivery/addresses.ts';

/** CORE-015.1: the minimap route follows the real streets — it never cuts through a block. */
test('minimap route: along real road axes, continuous, never across blocks, one-way respected', () => {
  const depot = depotWorld(84, -111);
  const addresses = buildAddresses();
  const pairs: [{ x: number; z: number }, { x: number; z: number }][] = [];
  for (const s of STORES) pairs.push([depot, s.door], [s.door, depot]);
  for (let i = 0; i < addresses.length; i += 3) pairs.push([depot, addresses[i]!.door], [STORES[i % 8]!.door, addresses[i]!.door], [addresses[i]!.door, addresses[(i + 7) % addresses.length]!.door]);
  let checked = 0;
  for (const [a, b] of pairs) {
    const r = streetRoute(a, b);
    assert.ok(r, 'a route exists');
    const p = r.points;
    assert.deepEqual(p[0], [a.x, a.z]); assert.deepEqual(p[p.length - 1], [b.x, b.z]);
    assert.ok(r.length >= Math.hypot(a.x - b.x, a.z - b.z) - 1e-6, 'not shorter than the straight line');
    for (let i = 1; i < p.length - 1; i++) {
      assert.ok(roadDistance(p[i]![0], p[i]![1]) < 0.05, `point ${i} on a road axis`);
      if (i < p.length - 2) {
        // Between consecutive road points the line stays on the road (no shortcut over a block).
        for (const t of [0.25, 0.5, 0.75]) {
          const x = p[i]![0] + (p[i + 1]![0] - p[i]![0]) * t; const z = p[i]![1] + (p[i + 1]![1] - p[i]![1]) * t;
          assert.ok(roadDistance(x, z) < 0.3, `segment ${i} leaves the street at ${x.toFixed(1)},${z.toFixed(1)}`);
        }
      }
    }
    checked++;
  }
  assert.ok(checked >= 60);
  // One-way carriageway: never ridden against its direction.
  const oneway = ROADS.filter((r) => r.oneway && r.length > 30);
  assert.ok(oneway.length > 0, 'the dual carriageway is one-way in OSM');
  for (const r of oneway.slice(0, 6)) {
    const q = (s: number) => { const a = r.pts[0]!; const b = r.pts[r.pts.length - 1]!; return { x: a[0] + (b[0] - a[0]) * s, z: a[1] + (b[1] - a[1]) * s }; };
    if (r.pts.length !== 2) continue;
    const back = streetRoute(q(0.8), q(0.2));
    assert.ok(back && back.length > r.length * 0.6 + 1, `${r.id}: going back takes the long way round (${back?.length.toFixed(0)} m)`);
    const fwd = streetRoute(q(0.2), q(0.8))!;
    assert.ok(Math.abs(fwd.length - r.length * 0.6) < 0.5, `${r.id}: forward is direct`);
  }
});
