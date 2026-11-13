import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionGuard } from '../src/core/collision.ts';
import { ROAD_HALF } from '../src/world/layout.ts';
import { treePolygons } from '../src/world/city/cityLayout.ts';
import { CITY_BOUNDS, STORES, cityPolygons, nearestRoad } from '../src/world/city/cityPlan.ts';
import { buildAddresses, DELIVERABLE_COUNT } from '../src/core/delivery/addresses.ts';
import { PARCEL_FLOW, advance, createParcel, ParcelError } from '../src/core/delivery/parcels.ts';
import { Workday, ROUTINE, DEPOT_SPOTS } from '../src/core/delivery/workday.ts';
import { createStoreOps, stepStore, joinQueue, isOpen, STORE_STAFF, STORE_HOURS } from '../src/core/delivery/stores.ts';
import { buildWalkGraph, nearestWalkPoint } from '../src/core/city/pedestrians.ts';

const guard = createMotionGuard(CITY_BOUNDS, [], [...cityPolygons(), ...treePolygons()]);

test('48 deliverable addresses on REAL streets, reachable from the pavement and the street', () => {
  const list = buildAddresses((x, z) => guard(x, z, 0.45));
  assert.equal(list.length, DELIVERABLE_COUNT);
  assert.equal(new Set(list.map((a) => a.id)).size, list.length);
  assert.equal(new Set(list.map((a) => `${a.street}#${a.number}`)).size, list.length, 'street + number unique');
  const walk = buildWalkGraph();
  for (const a of list) {
    assert.ok(guard(a.door.x, a.door.z, 0.35), `${a.id} door on free pavement`);
    const road = nearestRoad(a.stop.x, a.stop.z)!;
    assert.ok(road.d < ROAD_HALF, `${a.id} parking spot on the carriageway (${road.d.toFixed(2)} m)`);
    assert.ok(nearestWalkPoint(walk, a.door.x, a.door.z).d < 1.6, `${a.id} on the sidewalk network`);
    assert.ok(a.number > 0 && a.label.includes(String(a.number)) && a.estimated);
  }
  assert.ok(new Set(list.map((a) => a.street)).size >= 10, 'spread over many real streets');
});

test('parcels only move one stage forward', () => {
  const p = createParcel('X-1', 'farmacia', 'end-a', 'LOJA', 'Centro', 'NA_LOJA', 'farmacia', 11);
  assert.throws(() => advance(p, 'EM_TRANSPORTE', 'jogador', 12), ParcelError);
  for (const s of PARCEL_FLOW.slice(1)) advance(p, s, 'x', 12);
  assert.equal(p.state, 'ENTREGUE');
  assert.equal(p.history.length, PARCEL_FLOW.length);
  assert.throws(() => advance(p, 'NA_LOJA', 'x', 13), ParcelError);
});

test('stores: own hours, shutter, unique employee, queue served at the counter', () => {
  assert.equal(new Set(Object.values(STORE_STAFF).map((s) => s.name)).size, STORES.length);
  assert.equal(Object.keys(STORE_HOURS).length, 8);
  const s = createStoreOps('farmacia');
  assert.ok(!isOpen('farmacia', 7) && isOpen('farmacia', 12));
  stepStore(s, 7, 1);
  assert.equal(s.employee, 'fora');
  for (let i = 0; i < 10; i++) stepStore(s, 8.1, 0.5);
  assert.equal(s.shutter, 1);
  joinQueue(s, 1); joinQueue(s, 2); joinQueue(s, 1);
  assert.equal(s.queue.length, 2);
  const seen = new Set<string>();
  for (let i = 0; i < 200 && s.queue.length; i++) { stepStore(s, 10, 0.2); seen.add(s.employee); }
  assert.equal(s.queue.length, 0);
  assert.equal(s.served, 2);
  assert.ok(seen.has('buscando') && seen.has('atendendo'));
  for (let i = 0; i < 20; i++) stepStore(s, 22.5, 0.5);
  assert.equal(s.shutter, 0);
});

test('first workday: store → base → sorting → sack → home, every parcel traced, none duplicated', () => {
  const day = new Workday({ seed: 7, stores: 2, perStore: 2, marketplace: 4 });
  let hour = 10.9;
  const tick = (to: number) => { while (hour < to) { hour += 0.01; day.update(hour, 0.6); } };
  tick(11.05);
  assert.equal(day.phase, 'COLETA');
  assert.equal(day.parcels.length, 8);
  assert.equal(new Set(day.parcels.map((p) => p.id)).size, 8);
  const [s1, s2] = day.assigned;
  assert.equal(day.canCollect(s1!, hour), 'cedo', 'pickups start at 12h');
  tick(12.1);
  assert.equal(day.collect(s1!, hour), 2);
  assert.equal(day.collect(s1!, hour), 0, 'cannot collect twice');
  day.depart(hour);
  tick(12.5);
  assert.equal(day.collect(s2!, hour), 2);
  assert.equal(day.phase, 'RETORNO');
  assert.equal(day.objective(hour).target?.kind, 'galpao');
  tick(13.3);
  assert.equal(day.handOver(hour), 4);
  tick(13.95);
  assert.equal(day.count('RECEBIDO_BASE'), 8, 'checker counted player + truck parcels');
  assert.ok(day.staff.find((s) => s.role === 'separador-1')!.state.length > 0);
  tick(14.6);
  assert.equal(day.count('NA_SACA'), 8);
  assert.equal(day.takeSack(hour), 0, 'sack only from 15h');
  tick(15.05);
  assert.equal(day.takeSack(hour), 8);
  assert.equal(day.route.length, new Set(day.parcels.map((p) => p.destination)).size);
  tick(16);
  while (day.route.length) {
    const target = day.objective(hour).target!;
    assert.equal(target.kind, 'endereco');
    assert.ok(day.deliver(target.id, hour) >= 1);
    hour += 0.2;
  }
  assert.equal(day.phase, 'CONCLUIDA');
  assert.equal(day.count('ENTREGUE'), 8);
  for (const p of day.parcels) {
    assert.deepEqual(p.history.map((h) => h.state), PARCEL_FLOW.slice(PARCEL_FLOW.indexOf(p.history[0]!.state)));
  }
  const states = day.staff.map((s) => s.role);
  for (const r of ['porteiro', 'conferente', 'descarregador-1', 'separador-1', 'expedidor', 'supervisor']) assert.ok(states.includes(r as never));
  assert.ok(DEPOT_SPOTS.receiving && ROUTINE.end === 21);
});

test('house numbers do not depend on where the gate spot slides (plates match the job)', () => {
  const plain = buildAddresses();
  const slid = buildAddresses((x, z) => guard(x, z, 0.45));
  void STORES;
  assert.deepEqual(plain.map((a) => a.label), slid.map((a) => a.label));
});
