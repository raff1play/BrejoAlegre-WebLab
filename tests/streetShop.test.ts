import test from 'node:test';
import assert from 'node:assert/strict';
import { STORES, STORE_SETBACK, storePlan } from '../src/world/city/cityPlan.ts';

test('shop base cladding stays on side/back walls and leaves the entrance and windows open', () => {
  for (const s of STORES) {
    const p = storePlan(s);
    for (const r of p.baseWalls) {
      assert.ok(r.x0 >= 0 && r.x1 <= s.width && r.z1 <= s.depth);
      assert.ok(r.x1 > r.x0 && r.z1 > r.z0);
      assert.ok(r.x1 <= 0.27 || r.x0 >= s.width - 0.27 || r.z0 >= s.depth - 0.27);
      assert.ok(!(r.x0 < p.door1 && r.x1 > p.door0 && r.z0 <= STORE_SETBACK + 0.3));
    }
  }
});

import { shopFurniture } from '../src/world/city/cityLayout.ts';
import { framePoint, yawOf } from '../src/world/layout.ts';
test('planter long axis follows the window and its collider encloses the shipped GLB', () => {
  const f = shopFurniture();
  STORES.forEach((s, i) => {
    const p = f.planters[i]!;
    assert.ok(Math.abs(p.yaw - yawOf(s.frame) - Math.PI) < 1e-8);
    for (const x of [1.7 - 0.624 * 1.1, 1.7 + 0.624 * 1.1]) {
      for (const z of [0.85 - 0.232 * 1.05, 0.85 + 0.232 * 1.05]) {
        const q = framePoint(s.frame, x, z);
        assert.ok(q.x >= p.poly.box.minX - 1e-8 && q.x <= p.poly.box.maxX + 1e-8);
        assert.ok(q.z >= p.poly.box.minZ - 1e-8 && q.z <= p.poly.box.maxZ + 1e-8);
      }
    }
  });
});
