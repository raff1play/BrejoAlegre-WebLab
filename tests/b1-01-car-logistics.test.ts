import test from 'node:test';
import assert from 'node:assert/strict';
import { LogisticsDay } from '../src/core/delivery/logisticsDay.ts';
import { CarTrunk, CAR_TRUNK, layoutProblem, parcelDims } from '../src/core/delivery/carTrunk.ts';
import { buildRoster, type CareerId } from '../src/core/career/careers.ts';
import { SECTOR_DATA } from '../src/core/delivery/sectors.ts';
import { depotWorld, depotYaw, CITY_BOUNDS } from '../src/world/city/cityPlan.ts';
import { CAR_PARKING, MOTO_PARKING } from '../src/world/city/depotPlan.ts';
import { solidPolygons } from '../src/world/city/cityLayout.ts';
import { createMotionGuard } from '../src/core/collision.ts';
import { carBootSpot, depotVisitAllowed } from '../src/core/delivery/workday.ts';
import { vehicleIdOf } from '../src/core/career/snapshot.ts';
import type { Parcel } from '../src/core/delivery/parcels.ts';

/**
 * B1-01 F4 (AC-08, AC-09, AC-10): the whole day with the player's own CAR through the same delivery
 * domain as the motorcycle: store counter → hands → boot (CarTrunk) → car bay at the base → hands →
 * receiving desk → depot pipeline → sector dock → hands → boot → route → hands → customer.
 */
const guard = createMotionGuard(CITY_BOUNDS, [], solidPolygons());
const bay = CAR_PARKING[1]!;
const car = { ...depotWorld((bay.minX + bay.maxX) / 2, (bay.minZ + bay.maxZ) / 2), yaw: depotYaw(0), moving: false };
const atBoot = (c = car) => ({ player: { ...carBootSpot(c), riding: false }, bike: c, car: true });
const receiving = { player: { ...depotWorld(97.8, -122.3), riding: false }, bike: car, car: true };
const ctx = { parked: true };
const bootOk = (d: LogisticsDay, t: CarTrunk) => assert.equal(t.problem(d.parcels), null, 'porta-malas fisicamente válido');

test('B1-01 F4: visita à base com o carro só vale com o carro numa vaga de CARRO e a pessoa no lugar certo', () => {
  assert.ok(depotVisitAllowed(atBoot(), 'parking'), 'traseira do carro na vaga');
  assert.ok(depotVisitAllowed(receiving, 'receiving'));
  const street = { ...depotWorld(106, -84), yaw: 0, moving: false };
  assert.ok(!depotVisitAllowed(atBoot(street), 'parking'), 'carro fora da vaga');
  assert.ok(!depotVisitAllowed({ ...receiving, bike: street }, 'receiving'));
  const motoBay = { ...depotWorld(MOTO_PARKING[0]!.x, MOTO_PARKING[0]!.z), yaw: depotYaw(0), moving: false };
  assert.ok(!depotVisitAllowed(atBoot(motoBay), 'parking'), 'vaga de moto não serve para o carro');
  assert.ok(!depotVisitAllowed({ ...atBoot(), bike: { ...car, moving: true } }, 'parking'), 'carro em movimento');
  assert.ok(!depotVisitAllowed({ ...receiving, player: { ...receiving.player, riding: true } }, 'receiving'), 'de dentro do carro não');
  assert.ok(!depotVisitAllowed({ player: atBoot().player, bike: car }, 'parking'), 'sem a marca de carro vale a regra da moto (vaga de moto)');
});

for (const careerId of ['personagem-oeste', 'personagem-leste'] as CareerId[]) test(`B1-01 F4 AC-08/09/10: jornada completa de CARRO jogando ${careerId} — mesmos IDs, custódia pelo porta-malas, nada duplicado`, () => {
  const d = new LogisticsDay({ seed: 2026, free: (x, z) => guard(x, z, 0.45), roster: buildRoster(careerId) });
  d.vehicleKind = 'carro-antigo';
  const trunk = new CarTrunk(vehicleIdOf(careerId));
  const sector = d.playerSector;
  const dispatch = { player: { ...depotWorld(SECTOR_DATA[sector].x, -116.7), riding: false }, bike: car, car: true };
  d.start(11);
  const ids = d.parcels.map((p) => p.id);
  const mine = new Set(d.parcels.filter((p) => p.collector === 'jogador').map((p) => p.id));
  const load = new Set(d.load('jogador').map((p) => p.id));
  // AC-08: store counter → hands (≤ 4) → boot, only with the tailgate open and the car parked.
  assert.match(trunk.stow(d.parcels, 12, ctx).refused!, /Abra o porta-malas/);
  for (const kind of d.assigned) while (d.readyAt(kind).length) {
    assert.ok(d.collect(kind, 12.1) > 0);
    if (d.phase === 'COLETA') assert.match(d.objective(12.1, car).title, /Guardar os volumes no porta-malas/);
    assert.match(trunk.stow(d.parcels, 12.1, ctx).refused!, /Abra o porta-malas/);
    trunk.setOpen(true);
    const r = trunk.stow(d.parcels, 12.1, ctx);
    assert.equal(r.rejected.length, 0); assert.ok(r.stowed.length > 0);
    trunk.setOpen(false); bootOk(d, trunk);
  }
  assert.equal(d.inCarBoot().length, mine.size, 'toda a coleta do jogador está no porta-malas');
  assert.ok(d.inCarBoot().every((p) => p.state === 'EM_TRANSPORTE' && p.stowage?.vehicleId === vehicleIdOf(careerId)));
  assert.equal(d.phase, 'RETORNO');
  assert.match(d.objective(12.5, car).title, /vaga de carro/);
  // AC-09: nothing leaves the boot outside a car bay, with the tailgate closed, or at the moto bays.
  trunk.setOpen(true);
  const street = { ...depotWorld(106, -84), yaw: 0, moving: false };
  assert.equal(d.unloadCarForDepot(trunk, 13, atBoot(street)), 0);
  assert.equal(d.unloadCarForDepot(trunk, 13, { player: atBoot().player, bike: car }), 0, 'visita sem a marca de carro');
  let maxBoot = 0; let released = false;
  for (let t = 0; t < 1350; t += 0.1) {
    const hour = 12.2 + t / 150;
    if (d.carForDepot().length && !d.inHands().length) { const n = d.unloadCarForDepot(trunk, hour, atBoot()); assert.ok(n > 0 && n <= 4); bootOk(d, trunk); }
    if (d.inHands().some((p) => p.state === 'EM_TRANSPORTE')) assert.ok(d.handOver(hour, receiving) > 0);
    d.update(hour, 0.1);
    if (d.canTakeSack(hour)) {
      // AC-10: the sector load comes to the hands at the sector dock and goes, box by box, into the boot.
      assert.ok(d.takeSack(hour, dispatch) > 0);
      const r = trunk.stow(d.parcels, hour, ctx);
      assert.deepEqual(r.rejected, [], 'a carga real do setor cabe no porta-malas');
      d.sackInHands = false; bootOk(d, trunk);
      maxBoot = Math.max(maxBoot, d.inCarBoot().length);
      assert.ok(d.playerReady, 'pronto para sair com a carga no porta-malas');
    }
    if (d.teamReady && !d.released) { assert.ok(d.release(hour)); released = true; }
    if (d.released) for (const id of [...d.route]) {
      if (!d.inHands().length && d.takeFromCarForAddress(trunk, id, hour, true) > 0) bootOk(d, trunk);
      d.deliver(id, hour);
    }
    if (d.phase === 'CONCLUIDA') break;
  }
  assert.ok(released);
  assert.deepEqual(d.parcels.map((p) => p.id), ids, 'IDs estáveis, nenhum pacote criado ou perdido');
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(d.count('ENTREGUE'), ids.length);
  assert.equal(d.phase, 'CONCLUIDA');
  assert.deepEqual(d.depot.errors, []);
  assert.equal(d.inCarBoot().length, 0, 'porta-malas vazio no fim'); assert.equal(d.inHands().length, 0);
  assert.equal(maxBoot, load.size);
  const ops = (p: Parcel) => p.history.map((e) => e.operation);
  for (const p of d.parcels) {
    if (mine.has(p.id)) {
      // Collected by the player: counter → hands → boot → hands → receiving desk (never teleported).
      const o = ops(p); const i = o.indexOf('estado:COLETADO');
      assert.deepEqual(o.slice(i, i + 5), ['estado:COLETADO', 'transferência:maos', 'estado:EM_TRANSPORTE', 'transferência:porta-malas', 'transferência:maos'], `${p.id}: ${o.join(' > ')}`);
      assert.equal(o[i + 5], 'transferência:recebimento');
    }
    if (load.has(p.id)) {
      // Delivered by the player: sack → hands → boot → hands → customer.
      const o = ops(p); const i = o.indexOf('estado:EM_ROTA');
      // Re-arrangements inside the boot are recorded too; apart from them the path is exact.
      const path = o.slice(i).filter((x) => x !== 'arrumação:porta-malas');
      assert.deepEqual(path, ['estado:EM_ROTA', 'transferência:maos', 'transferência:porta-malas', 'transferência:maos', 'estado:ENTREGUE', 'transferência:destinatario'], `${p.id}: ${o.slice(i).join(' > ')}`);
      assert.equal(p.history.filter((e) => e.operation === 'estado:ENTREGUE').length, 1, 'entregue uma única vez');
      assert.equal(p.holder, 'destinatario'); assert.equal(p.stowage, null);
    } else assert.notEqual(p.history.find((e) => e.state === 'EM_ROTA')!.holder, 'jogador', `${p.id}: não é do setor do jogador`);
  }
});

test('B1-01 F4 AC-10: na rota só sai do porta-malas o pacote do endereço, só com a equipe liberada, só parado, mãos vazias', () => {
  const d = new LogisticsDay({ seed: 7, free: (x, z) => guard(x, z, 0.45), roster: buildRoster('personagem-oeste') });
  d.vehicleKind = 'carro-antigo';
  const trunk = new CarTrunk(vehicleIdOf('personagem-oeste')); trunk.setOpen(true);
  d.start(11);
  // Put the Oeste load straight on the route state through the real transitions (dock → hands → boot).
  const loadIds = d.load('jogador').map((p) => p.id);
  for (const p of d.load('jogador')) { p.state = 'NA_SACA'; p.place = 'saca'; p.history.push({ ...p.history.at(-1)!, state: 'NA_SACA', place: 'saca', operation: 'fixture:saca' }); }
  for (const p of d.load('jogador')) { p.state = 'EM_ROTA'; p.place = 'maos'; p.holder = 'jogador'; p.history.push({ ...p.history.at(-1)!, state: 'EM_ROTA', place: 'maos', holder: 'jogador', operation: 'fixture:maos' }); }
  assert.deepEqual(trunk.stow(d.parcels, 16, ctx).rejected, []);
  const first = d.carForRoute()[0]!; const addr = first.destination;
  assert.equal(d.takeFromCarForAddress(trunk, addr, 16, true), 0, 'antes da liberação da equipe');
  d.released = true;
  assert.equal(d.takeFromCarForAddress(trunk, addr, 16, false), 0, 'carro sem freio de mão');
  assert.equal(d.takeFromCarForAddress(trunk, 'endereco-que-nao-existe', 16, true), 0);
  trunk.setOpen(false);
  assert.equal(d.takeFromCarForAddress(trunk, addr, 16, true), 0, 'tampa fechada');
  trunk.setOpen(true);
  const n = d.takeFromCarForAddress(trunk, addr, 16, true);
  assert.ok(n > 0); assert.ok(d.inHands().every((p) => p.destination === addr));
  assert.equal(d.takeFromCarForAddress(trunk, d.carForRoute()[0]?.destination ?? addr, 16, true), 0, 'mãos ocupadas');
  assert.equal(d.route[0], addr);
  assert.equal(d.deliver(addr, 16), n);
  assert.equal(trunk.problem(d.parcels), null);
  assert.equal(d.parcels.filter((p) => loadIds.includes(p.id)).length, loadIds.length);
  assert.ok(layoutProblem(CAR_TRUNK, d.carForRoute().map((p) => ({ box: { id: p.id, dims: parcelDims(p.id) }, slot: p.stowage! }))) === null);
});

test('B1-01 F4: a moto continua com o mesmo fluxo (baú, vagas de moto) e textos', () => {
  const d = new LogisticsDay({ seed: 2026 });
  assert.equal(d.vehicleKind, 'moto-antiga');
  d.start(11);
  const kind = d.assigned[0]!;
  d.collect(kind, 12.1);
  assert.match(d.objective(12.1, { x: 0, z: 0 }).title, /Guardar os volumes no baú/);
  assert.match(d.objective(12.1, { x: 0, z: 0 }).target!.label, /Baú da moto/);
  d.stow(12.1);
  assert.ok(d.inTrunk().length > 0 && d.inCarBoot().length === 0);
  const bike = { ...depotWorld(84, -111), yaw: depotYaw(0), moving: false };
  assert.ok(d.unloadForDepot(12.5, false, { player: { ...depotWorld(84, -112.25), riding: false }, bike }) > 0);
});
