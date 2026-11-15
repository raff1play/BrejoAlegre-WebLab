import test from 'node:test';
import assert from 'node:assert/strict';
import { REAL_SECONDS_PER_VIRTUAL_HOUR } from '../src/core/city/clock.ts';
import { Workday, DEPOT_SPOTS, ROUTINE } from '../src/core/delivery/workday.ts';
import { depotWorld, depotYaw } from '../src/world/city/cityPlan.ts';

const visit = (at: 'receiving' | 'parking') => ({
  player: { ...(at === 'parking' ? depotWorld(84, -112.25) : DEPOT_SPOTS.receiving), riding: false },
  bike: { ...depotWorld(84, -111), yaw: depotYaw(0), moving: false },
});

test('ART-002: deposited parcels start sorting before 14h, without an arbitrary time gate', () => {
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
  const ids = day.parcels.map(p => p.id);

  const guidance = day.objective(hour);
  assert.match(guidance.title, /Recebimento e triagem em andamento/);
  assert.match(guidance.detail, /4 na bancada/);
  assert.match(guidance.detail, /4 do caminhão \(chegada às 13h\)/);
  assert.doesNotMatch(guidance.detail, /aguarde.*14h|triagem às 14h/i);
  assert.equal(guidance.waitUntil, ROUTINE.sackFrom, 'optional time advance targets the 15h pickup, not the start of sorting');

  // Advance 80 real seconds at the new standard rate; game time is still before 14h.
  // Each step exercises the same worker-task controller as gameplay, not a direct state edit.
  let observedSorting = false;
  for (let i = 0; i < 1600; i++) {
    const at = hour + i * .05 / REAL_SECONDS_PER_VIRTUAL_HOUR;
    assert.ok(at < 14);
    day.update(at, .05);
    if (day.parcels.some(p => p.platform === 'LOJA' && p.history.some(e => e.place === 'triagem'))) observedSorting = true;
  }
  assert.ok(observedSorting, 'at least one collected package must reach sorting well before 14h');
  assert.deepEqual(day.parcels.map(p => p.id), ids, 'packages retain their IDs');
  assert.equal(day.depot.errors.length, 0, 'no worker-task errors');

  const later = day.objective(13.5);
  assert.doesNotMatch(later.title, /Aguardar a triagem/);
  assert.equal(day.parcels.length, 8);
});
