import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionGuard } from '../src/core/collision.ts';
import { ROAD_HALF } from '../src/world/layout.ts';
import { treePolygons } from '../src/world/city/cityLayout.ts';
import { CITY_BOUNDS, STORES, cityPolygons, nearestRoad } from '../src/world/city/cityPlan.ts';
import { buildAddresses, DELIVERABLE_COUNT } from '../src/core/delivery/addresses.ts';
import { PARCEL_FLOW, PLACE_MOVES, advance, createParcel, move, ParcelError } from '../src/core/delivery/parcels.ts';
import { Workday, ROUTINE, DEPOT_SPOTS, HANDS_MAX } from '../src/core/delivery/workday.ts';
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

test('first workday with PHYSICAL parcels: shop → hands → top box → base → sack → top box → gate, none lost or duplicated', () => {
  const day = new Workday({ seed: 7, stores: 2, perStore: 2, marketplace: 4 });
  let hour = 10.9;
  const tick = (to: number) => { while (hour < to) { hour += 0.01; day.update(hour, 0.6); } };
  /** Conservation: 8 distinct parcels, each in exactly one valid place consistent with its state. */
  const audit = (where: string) => {
    assert.equal(day.parcels.length, 8, `${where}: 8 parcels`);
    assert.equal(new Set(day.parcels.map((p) => p.id)).size, 8, `${where}: unique ids`);
    const places = new Map<string, number>();
    for (const p of day.parcels) {
      places.set(p.place, (places.get(p.place) ?? 0) + 1);
      const ok: Record<string, string[]> = {
        NA_LOJA: ['loja'], COLETADO: ['maos'], EM_TRANSPORTE: ['caminhao', 'bau', 'maos', 'galpao'], RECEBIDO_BASE: ['galpao'], TRIADO: ['galpao'],
        NA_SACA: ['saca'], EM_ROTA: ['maos', 'bau'], ENTREGUE: ['destinatario'],
      };
      assert.ok(ok[p.state]!.includes(p.place), `${where}: ${p.id} ${p.state} cannot be ${p.place}`);
      for (let i = 1; i < p.history.length; i++) {
        const a = p.history[i - 1]!; const b = p.history[i]!;
        assert.ok(a.place === b.place || PLACE_MOVES[a.place].includes(b.place), `${where}: ${p.id} jumped ${a.place} → ${b.place}`);
      }
    }
    assert.equal([...places.values()].reduce((t, n) => t + n, 0), 8, `${where}: every parcel is somewhere`);
    for (const p of [...day.inHands(), ...day.inTrunk()]) assert.equal(p.holder, 'jogador', `${where}: what is in the hands or in the box is the rider's`);
  };
  tick(11.05);
  assert.equal(day.phase, 'COLETA');
  audit('start');
  const [s1, s2] = day.assigned;
  assert.equal(day.canCollect(s1!, hour), 'cedo', 'pickups start at 12h');
  tick(12.1);
  // Shop 1: into the hands, then into the top box (never while the bike moves).
  assert.equal(day.collect(s1!, hour), 2);
  assert.equal(day.collect(s1!, hour), 0, 'cannot collect twice');
  assert.equal(day.inHands().length, 2);
  assert.equal(day.objective(hour, { x: 0, z: 0 }).target?.kind, 'moto', 'next step: the top box');
  assert.equal(day.cargoLabel(), '2 volume(s) nas mãos');
  assert.equal(day.stow(hour, true), 0, 'no stowing while the bike moves');
  assert.equal(day.stow(hour), 2);
  assert.equal(day.inHands().length, 0); assert.equal(day.inTrunk().length, 2);
  assert.ok(day.inTrunk().every((p) => p.state === 'EM_TRANSPORTE'), 'in the box = in transport');
  audit('shop 1');
  tick(12.5);
  assert.equal(day.collect(s2!, hour), 2);
  assert.equal(day.phase, 'RETORNO');
  assert.equal(day.stow(hour), 2);
  assert.equal(day.cargoLabel(), '4 volume(s) no baú');
  assert.equal(day.objective(hour).target?.kind, 'galpao');
  audit('shop 2');
  tick(13.3);
  // Base: nothing can be handed over from the box; unload, then hand over.
  assert.equal(day.handOver(hour), 0, 'parcels in the box are not handed over');
  assert.equal(day.unloadForDepot(hour, true), 0, 'no unloading while moving');
  assert.equal(day.unloadForDepot(hour), 4);
  assert.equal(day.unloadForDepot(hour), 0);
  assert.equal(day.handOver(hour), 4);
  assert.equal(day.inHands().length + day.inTrunk().length, 0);
  assert.equal(day.phase, 'CONFERENCIA');
  audit('hand over');
  tick(13.95);
  assert.equal(day.count('RECEBIDO_BASE'), 8, 'checker counted player + truck parcels');
  assert.ok(day.parcels.every((p) => p.place === 'galpao'));
  tick(14.6);
  assert.equal(day.count('NA_SACA'), 8);
  assert.ok(day.parcels.every((p) => p.place === 'saca'));
  assert.equal(day.takeSack(hour), 0, 'sack only from 15h');
  tick(15.05);
  assert.equal(day.takeSack(hour), 8);
  assert.ok(day.sackInHands && day.inHands().length === 8);
  assert.equal(day.objective(hour, { x: 0, z: 0 }).target?.kind, 'moto', 'the sack goes in the box first');
  assert.equal(day.takeSack(hour), 0, 'no second sack');
  assert.equal(day.stow(hour), 8);
  assert.ok(!day.sackInHands && day.inTrunk().length === 8);
  assert.equal(day.route.length, new Set(day.parcels.map((p) => p.destination)).size);
  audit('sack');
  tick(16);
  let delivered = 0;
  while (day.route.length) {
    const target = day.objective(hour).target!;
    assert.equal(target.kind, 'endereco');
    // A parcel still in the box cannot be delivered.
    assert.equal(day.deliver(target.id, hour), 0, 'not from the box');
    assert.equal(day.takeForAddress(target.id, hour, true), 0, 'not while moving');
    const took = day.takeForAddress(target.id, hour);
    assert.ok(took >= 1);
    assert.equal(day.takeForAddress(day.route[day.route.length - 1]!, hour), 0, 'hands are full');
    // The wrong gate refuses it.
    const other = day.route.find((id) => id !== target.id);
    if (other) assert.equal(day.deliver(other, hour), 0, 'wrong address');
    assert.equal(day.deliver(target.id, hour), took);
    delivered += took;
    assert.equal(day.inHands().length, 0);
    assert.equal(day.inTrunk().length, 8 - delivered);
    audit(`delivery ${delivered}`);
    hour += 0.2;
  }
  assert.equal(day.phase, 'CONCLUIDA');
  assert.equal(day.count('ENTREGUE'), 8);
  assert.ok(day.parcels.every((p) => p.place === 'destinatario'));
  for (const p of day.parcels) {
    const states = p.history.map((h) => h.state).filter((st, i, all) => i === 0 || st !== all[i - 1]);
    assert.deepEqual(states, PARCEL_FLOW.slice(PARCEL_FLOW.indexOf(p.history[0]!.state)));
    const places = p.history.map((h) => h.place).filter((pl, i, all) => i === 0 || pl !== all[i - 1]);
    assert.deepEqual(places, p.platform === 'LOJA'
      ? ['loja', 'maos', 'bau', 'maos', 'galpao', 'saca', 'maos', 'bau', 'maos', 'destinatario']
      : ['caminhao', 'galpao', 'saca', 'maos', 'bau', 'maos', 'destinatario']);
  }
  const states = day.staff.map((s) => s.role);
  for (const r of ['porteiro', 'conferente', 'descarregador-1', 'separador-1', 'expedidor', 'supervisor']) assert.ok(states.includes(r as never));
  assert.ok(DEPOT_SPOTS.receiving && ROUTINE.end === 21);
});

test('physical places: a parcel cannot jump (box → customer, shop → box) and hands hold at most 4 loose volumes', () => {
  const p = createParcel('X-2', 'farmacia', 'end-a', 'LOJA', 'Centro', 'NA_LOJA', 'farmacia', 11);
  assert.equal(p.place, 'loja');
  assert.throws(() => move(p, 'bau', 'jogador', 12), ParcelError);
  move(p, 'maos', 'jogador', 12); move(p, 'bau', 'jogador', 12);
  assert.throws(() => move(p, 'destinatario', 'x', 12), ParcelError);
  assert.throws(() => move(p, 'galpao', 'x', 12), ParcelError);
  assert.equal(p.history.length, 3);
  // Three shops × 2 volumes: the third pickup needs the hands emptied first.
  const day = new Workday({ seed: 3, stores: 3, perStore: 2, marketplace: 0 });
  day.update(11.01, 1); day.update(12.2, 1);
  const [a, b, c] = day.assigned;
  assert.equal(day.collect(a!, 12.2), 2); assert.equal(day.collect(b!, 12.2), 2);
  assert.equal(day.canCollect(c!, 12.2), 'cheio');
  assert.equal(day.collect(c!, 12.2), 0);
  assert.equal(day.stow(12.2), 4);
  assert.equal(day.collect(c!, 12.2), 2);
  assert.equal(HANDS_MAX, 4);
  // Six in the box: the base takes them in two hands-full trips.
  assert.equal(day.stow(12.3), 2);
  assert.equal(day.unloadForDepot(13), 4); assert.equal(day.handOver(13), 4);
  assert.equal(day.phase, 'RETORNO', 'still two volumes in the box');
  assert.equal(day.unloadForDepot(13), 2); assert.equal(day.handOver(13), 2);
  assert.equal(day.phase, 'CONFERENCIA');
});

test('house numbers do not depend on where the gate spot slides (plates match the job)', () => {
  const plain = buildAddresses();
  const slid = buildAddresses((x, z) => guard(x, z, 0.45));
  void STORES;
  assert.deepEqual(plain.map((a) => a.label), slid.map((a) => a.label));
});
