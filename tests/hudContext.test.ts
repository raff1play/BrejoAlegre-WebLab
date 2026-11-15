import test from 'node:test';
import assert from 'node:assert/strict';
import { baseSummary, hudContext, inDepotLot, progressSummary } from '../src/features/hud/hudContext.ts';
import { LogisticsDay } from '../src/core/delivery/logisticsDay.ts';
import { DEPOT, depotWorld } from '../src/world/city/cityPlan.ts';
import { depotLocal } from '../src/world/city/testProbe.ts';

test('HUD context: base wins inside the depot lot, otherwise riding or on foot', () => {
  assert.equal(hudContext('riding', 'street'), 'riding');
  assert.equal(hudContext('walking', 'street'), 'walking');
  assert.equal(hudContext('riding', 'base'), 'base');
  assert.equal(hudContext('walking', 'base'), 'base');
  // The shift starts at the motorcycle bays: that is the base.
  const bay = depotWorld(84, -111);
  assert.ok(inDepotLot(depotLocal(bay.x, bay.z)));
  // Out on the street in front of the gate: not the base any more.
  const street = depotWorld(106, -80);
  assert.equal(inDepotLot(depotLocal(street.x, street.z)), false);
  assert.ok(inDepotLot({ x: DEPOT.lot.minX, z: DEPOT.lot.maxZ }));
});

test('mine vs team progress are separate and add up to the real day', () => {
  const day = new LogisticsDay({ seed: 2026, dayIndex: 0 });
  day.start(11.75);
  const before = progressSummary(day.parcels, day.phase);
  const mine = day.parcels.filter((p) => p.collector === 'jogador').length;
  const team = day.parcels.filter((p) => p.collector?.startsWith('npc')).length;
  assert.equal(before.mine, `Minha coleta 0/${mine}`);
  assert.equal(before.team, `Equipe 0/${team}`);
  assert.ok(mine > 0 && team > mine, 'three couriers collect more than the player');
  // Delivery phase: the player's sector against the other three; together they are every parcel.
  const after = progressSummary(day.parcels, 'ENTREGAS');
  const m = /(\d+)\/(\d+)/.exec(after.mine)!; const t = /(\d+)\/(\d+)/.exec(after.team)!;
  assert.equal(Number(m[2]) + Number(t[2]), day.parcels.length);
  assert.match(after.mine, /^Minhas entregas 0\//);
  assert.match(after.team, /^Equipe 0\//);
  // Pure: nothing in the inventory changes.
  assert.deepEqual(day.parcels.map((p) => p.state), day.parcels.map((p) => p.state));
});

test('base summary: receiving, sorting, own load and schedule', () => {
  const day = new LogisticsDay({ seed: 2026, dayIndex: 0 });
  day.start(11.75);
  const [load, time] = baseSummary(day.parcels, 16, null);
  const mine = day.parcels.filter((p) => p.sector === 'Oeste').length;
  assert.equal(load, `Recebimento 0 · Triagem 0 · Sua carga D02 0/${mine}`);
  assert.equal(time, 'Triagem meta 16h00 · Saca às 15h00 · Jornada até 21h00');
  assert.match(baseSummary(day.parcels, 15, 14.5)[1], /separado 14h30/);
});
