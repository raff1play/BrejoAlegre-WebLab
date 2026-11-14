import test from 'node:test';
import assert from 'node:assert/strict';
import { Workday, DEPOT_SPOTS, ROUTINE } from '../src/core/delivery/workday.ts';
import { depotWorld, depotYaw } from '../src/world/city/cityPlan.ts';

const visit = (at: 'receiving' | 'parking') => ({
  player: { ...(at === 'parking' ? depotWorld(84, -112.25) : DEPOT_SPOTS.receiving), riding: false },
  bike: { ...depotWorld(84, -111), yaw: depotYaw(0), moving: false },
});

test('ART-002: after unloading at 12:46, explain truck and sorting time and enable waiting', () => {
  const day = new Workday({ seed: 2026, stores: 2, perStore: 2, marketplace: 4 });
  day.update(11, 0);
  const hour = 12 + 46 / 60;
  for (const store of day.assigned) {
    assert.equal(day.collect(store, hour), 2);
    assert.equal(day.stow(hour), 2);
  }
  assert.equal(day.unloadForDepot(hour, false, visit('parking')), 4);
  assert.equal(day.handOver(hour, visit('receiving')), 4);
  assert.equal(day.phase, 'CONFERENCIA');

  const before = day.objective(hour);
  assert.equal(before.waitUntil, ROUTINE.sortFrom);
  assert.match(before.title, /triagem às 14h/);
  assert.match(before.detail, /4 na bancada/);
  assert.match(before.detail, /4 volume\\(s\\) do caminhão previstos às 13h/);
  assert.equal(day.parcels.filter(p => p.place === 'caminhao').length, 4);

  day.update(13.01, 0.1);
  const during = day.objective(13.01);
  assert.equal(during.waitUntil, ROUTINE.sortFrom);
  assert.match(during.detail, /caminhão em descarga/);

  day.update(14.01, 0.1);
  assert.equal(day.objective(14.01).waitUntil, null, 'waiting prompt ends at sorting time');
  assert.equal(day.parcels.length, 8, 'guidance never invents or removes parcels');
});
