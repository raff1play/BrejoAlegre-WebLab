import test from 'node:test';
import assert from 'node:assert/strict';
import { LogisticsDay } from '../src/core/delivery/logisticsDay.ts';
import { CarTrunk } from '../src/core/delivery/carTrunk.ts';
import { isFinal, type Parcel } from '../src/core/delivery/parcels.ts';
import { ACTORS } from '../src/core/delivery/dailyDemand.ts';
import { SECTOR_DATA } from '../src/core/delivery/sectors.ts';
import { CALENDAR_STORAGE_KEY, nextWorkday } from '../src/core/delivery/operatingCalendar.ts';
import { depotWorld, depotYaw, CITY_BOUNDS } from '../src/world/city/cityPlan.ts';
import { CAR_PARKING } from '../src/world/city/depotPlan.ts';
import { solidPolygons } from '../src/world/city/cityLayout.ts';
import { createMotionGuard } from '../src/core/collision.ts';
import { carBootSpot } from '../src/core/delivery/workday.ts';
import { CAREER_IDS, CHARACTERS, DEFAULT_CAREER, buildRoster, careerHome, type CareerId, type VehicleKind } from '../src/core/career/careers.ts';
import { CareerSession, CareerStore, LEGACY_DISMISSED_KEY, MemoryStorage, marksKey, previousKey, saveKey, type KeyValueStorage } from '../src/core/career/careerStore.ts';
import { SaveError, canonicalJson, captureParcels, checksumOf, chooseStartingVehicle, parseSave, sealSave, type CareerSave } from '../src/core/career/snapshot.ts';
import { dueEvents, ledgerTotal, rateCents, settle } from '../src/core/career/ledger.ts';
import {
  ShiftCheckpointer, captureShift, closeShiftAtHome, closureState, custodySignature, homeClosureCheck, restoreShift, type ShiftCapture,
} from '../src/core/career/shiftCheckpoint.ts';
import { LEASE_KEY, LEASE_MS, StorageLease, leaseFree } from '../src/core/career/tabLease.ts';
import { enterCareer, menuModel, mainScreen } from '../src/core/career/careerMenu.ts';

/**
 * B1-01 F6 — decisões 4, 8, 9, 10, 11, 12, 16; AC-13, AC-17, AC-18, AC-19, AC-20, AC-21, AC-22, AC-26.
 * Every interruption below throws the whole game state away and rebuilds it from the bytes in the
 * storage (new store, new session, new LogisticsDay), exactly like closing and reopening the tab.
 */
const guard = createMotionGuard(CITY_BOUNDS, [], solidPolygons());
const free = (x: number, z: number) => guard(x, z, 0.45);
const H = (hh: number, mm: number) => hh + mm / 60;
const bike = { ...depotWorld(84, -111), yaw: depotYaw(0), moving: false };
const bay = CAR_PARKING[1]!;
const car = { ...depotWorld((bay.minX + bay.maxX) / 2, (bay.minZ + bay.maxZ) / 2), yaw: depotYaw(0), moving: false };
const STEP = 0.1;
const hourAt = (i: number) => 12 + (i * STEP) / 150;

type Game = { storage: KeyValueStorage; store: CareerStore; session: CareerSession; day: LogisticsDay; trunk: CarTrunk | null; careerId: CareerId; vehicle: VehicleKind };

/** A career that already chose its vehicle (one checkpoint, no shift yet), as the menu leaves it. */
function newCareer(storage: KeyValueStorage, careerId: CareerId, vehicle: VehicleKind): void {
  enterCareer(storage, careerId, { appearance: CHARACTERS[careerId].defaultAppearance, equipment: CHARACTERS[careerId].defaultEquipment, vehicle });
}
/** Opens the game of the ACTIVE career from storage: restores the saved shift when there is one. */
function open(storage: KeyValueStorage): { game: Game; resumedAt: number | null } {
  const store = new CareerStore(storage);
  const session = new CareerSession(store);
  const careerId = session.careerId; const vehicle = session.profile.vehicle!.kind;
  const day = new LogisticsDay({ seed: 2026, free, roster: buildRoster(careerId) });
  day.vehicleKind = vehicle;
  const trunk = vehicle === 'carro-antigo' ? new CarTrunk(session.profile.vehicle!.vehicleId) : null;
  if (trunk) trunk.setOpen(true);
  const shift = session.save.shift;
  const resumed = shift ? restoreShift(day, shift) : false;
  return { game: { storage, store, session, day, trunk, careerId, vehicle }, resumedAt: resumed ? shift!.shiftHour : null };
}
const capture = (g: Game, hour: number): ShiftCapture => ({
  day: g.day, shiftHour: hour, vehicle: g.vehicle,
  player: { mode: 'walking', walker: { x: 1, z: 2, yaw: 0 }, vehicle: g.vehicle === 'carro-antigo' ? car : bike },
});
const checkpoint = (g: Game, hour: number): CareerSave => g.session.commit(g.careerId, (p, s) => captureShift(p, s, capture(g, hour)));

/**
 * The player's part of the day, decided ONLY from the current state (so a resumed game takes the
 * same decisions): collect, stow, hand over at the base, sack, release at 20h54, deliveries at
 * 20h59 / 21h01, one failed attempt at 21h30, the rest after 00h01, then the physical return.
 */
function playerStep(g: Game, hour: number): void {
  const d = g.day; const t = g.trunk;
  const atVehicle = t ? { player: { ...carBootSpot(car), riding: false }, bike: car, car: true } : { player: { ...depotWorld(84, -112.25), riding: false }, bike };
  const desk = { player: { ...depotWorld(97.8, -122.3), riding: false }, bike: t ? car : bike, ...(t ? { car: true } : {}) };
  const dock = { player: { ...depotWorld(SECTOR_DATA[d.playerSector].x, -116.7), riding: false }, bike: t ? car : bike, ...(t ? { car: true } : {}) };
  const stow = () => { if (t) { t.stow(d.parcels, hour, { parked: true }); if (!d.inHands().length) d.sackInHands = false; } else d.stow(hour); };
  for (const kind of d.assigned) if (d.readyAt(kind).length && !d.inHands().length) { d.collect(kind, hour); stow(); return; }
  if (!d.released) {
    if (!d.inHands().length && (t ? d.carForDepot().length : d.trunkForDepot().length)) { if (t) d.unloadCarForDepot(t, hour, atVehicle); else d.unloadForDepot(hour, false, atVehicle); return; }
    if (d.inHands().some((p) => p.state === 'EM_TRANSPORTE')) { d.handOver(hour, desk); return; }
    if (d.canTakeSack(hour)) { d.takeSack(hour, dock); stow(); return; }
    if (d.teamReady && hour >= H(20, 54)) d.release(hour);
    return;
  }
  const mine = d.load('jogador');
  const delivered = new Set(mine.filter((p) => p.state === 'ENTREGUE').map((p) => p.destination)).size;
  const attempted = mine.some((p) => p.history.some((e) => e.operation === 'tentativa:frustrada'));
  const next = d.route[0];
  const slot = delivered === 0 ? H(20, 59) : delivered === 1 ? H(21, 1) : attempted ? H(24, 1) : H(21, 30);
  if (next && hour >= slot) {
    if (t) d.takeFromCarForAddress(t, next, hour, true); else d.takeForAddress(next, hour);
    if (d.recipientAbsent(next)) { d.registerAttempt(next, hour); stow(); } else d.deliver(next, hour);
    return;
  }
  if (!d.route.length && d.returnsPending().length) {
    if (!d.inHands().length) { if (t) d.unloadCarForDepot(t, hour, atVehicle); else d.unloadForDepot(hour, false, atVehicle); }
    else d.handOver(hour, desk);
  }
}
/** Absent recipients of the scenario: one address per courier (the 3rd of its sorted list). */
function markAbsent(d: LogisticsDay): void {
  for (const a of ACTORS) { const list = [...new Set(d.load(a).map((p) => p.destination))].sort(); d.absentAddresses.add(list[Math.min(2, list.length - 1)]!); }
}

/**
 * Plays the whole day. `interrupt(i, g)` may return true to checkpoint after step i and REOPEN the
 * game from storage (the in-memory world is dropped). Returns the final game and what happened.
 */
function playDay(careerId: CareerId, vehicle: VehicleKind, interrupt: (i: number, g: Game, hour: number) => boolean = () => false) {
  const storage = new MemoryStorage();
  newCareer(storage, careerId, vehicle);
  let g = open(storage).game;
  g.day.start(11.75); markAbsent(g.day);
  checkpoint(g, 11.75);
  const reopened: { i: number; hour: number; sequence: number }[] = [];
  let i = 0;
  for (; i < 30000 && !g.day.allResolved; i++) {
    const hour = hourAt(i);
    playerStep(g, hour);
    g.day.update(hour, STEP);
    if (interrupt(i, g, hour)) {
      const saved = checkpoint(g, hour);
      const before = canonicalJson(saved.shift!.parcels);
      const r = open(storage);
      g = r.game;
      assert.equal(r.resumedAt, saved.shift!.shiftHour, 'retomado exatamente no checkpoint');
      assert.equal(canonicalJson(captureParcels(g.day.parcels)), before, 'pacotes idênticos após reabrir');
      reopened.push({ i, hour, sequence: saved.checkpointSequence });
    }
  }
  return { g, i, reopened, hour: hourAt(i - 1), storage };
}
/** Comparable end state (parcels, ledger, couriers, report). */
const finalState = (g: Game, hour: number) => {
  const end = captureShift(g.session.profile, g.session.save.shift, capture(g, hour));
  // The ledger grows in settlement order (one event per checkpoint that found it); compare as a set.
  return { parcels: canonicalJson(end.shift.parcels), payments: canonicalJson([...end.shift.payments].sort((a, b) => (a.eventId < b.eventId ? -1 : 1))), balance: end.profile.balanceCents, couriers: canonicalJson(g.day.couriers.map((c) => c.toState().state)), report: canonicalJson(g.day.report(hour)), errors: [...g.day.depot.errors] };
};

for (const [careerId, vehicle] of [['personagem-oeste', 'moto-antiga'], ['personagem-leste', 'carro-antigo']] as [CareerId, VehicleKind][]) {
  test(`B1-01 F6 AC-18/19/20: ${careerId} de ${vehicle} — fechar e reabrir antes/depois de transferências, após 21h e após 00h termina IGUAL ao dia sem interrupção`, () => {
    const straight = playDay(careerId, vehicle);
    assert.ok(straight.g.day.allResolved, `dia contínuo resolvido (${straight.hour.toFixed(2)}h)`);
    const expected = finalState(straight.g, straight.hour);
    // Interruption points: right before and right after the first desk hand-over, in the middle of the
    // depot work, just after the first delivery (20h59), after 21h01, with the failed attempt in the
    // vehicle, after 00h01 and with the return on the desk (on-duty checker).
    const seen = new Set<string>();
    // Every condition is evaluated each step (no short-circuit), so two points on the same step both count.
    const once = (key: string, cond: boolean) => (cond && !seen.has(key) ? (seen.add(key), true) : false);
    const any = (...flags: boolean[]) => flags.some(Boolean);
    let handedOver = -1;
    const run = playDay(careerId, vehicle, (i, g, hour) => {
      const d = g.day; const inVehicle = d.inVehicle().length; const atDesk = d.parcels.some((p) => p.place === 'recebimento' && p.collector === 'jogador');
      if (handedOver < 0 && atDesk) handedOver = i;
      return any(once('com carga no veículo, antes da 1ª transferência na base', inVehicle > 0 && !atDesk && d.phase === 'RETORNO'),
        once('logo depois da 1ª transferência ao conferente', handedOver === i),
        once('base trabalhando (transferência em mãos de um trabalhador)', d.parcels.some((p) => p.place === 'transferencia')),
        once('depois da entrega das 20h59 (no prazo)', hour < 21 && d.load('jogador').some((p) => p.state === 'ENTREGUE')),
        once('depois da entrega das 21h01 (atrasada)', hour < 21.4 && d.load('jogador').some((p) => p.history.some((e) => e.operation === 'estado:ENTREGUE' && e.hour > 21))),
        once('tentativa frustrada no veículo', d.returnsPending().some((p) => p.place === 'bau' || p.place === 'porta-malas')),
        once('depois de 00h01', hour > H(24, 1.5)),
        once('devolução na mesa do plantão', d.parcels.some((p) => p.state === 'TENTATIVA_FRUSTRADA' && (p.place === 'recebimento' || p.place === 'conferencia'))));
    });
    assert.equal(seen.size, 8, `todos os pontos de interrupção ocorreram: ${[...seen].join(' | ')}`);
    assert.ok(run.reopened.length >= 6 && run.reopened.length <= 8);
    assert.ok(run.g.day.allResolved);
    const got = finalState(run.g, run.hour);
    assert.equal(run.i, straight.i, 'mesmo número de passos até resolver tudo');
    assert.deepEqual(got, expected, 'mesmo resultado final: pacotes, custódia, histórico, razão, saldo, NPCs e relatório');
    // No regression and no duplication anywhere.
    const parcels = JSON.parse(got.parcels) as Parcel[];
    assert.equal(new Set(parcels.map((p) => p.id)).size, parcels.length);
    assert.ok(parcels.every(isFinal));
    assert.ok(parcels.every((p) => p.history.filter((e) => e.operation === 'estado:ENTREGUE').length <= 1), 'nenhuma entrega repetida');
    const seqs = run.reopened.map((r) => r.sequence);
    assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b), 'checkpoints só avançam');
    const hours = run.reopened.map((r) => r.hour);
    assert.ok(hours.every((h, k) => k === 0 || h > hours[k - 1]!), 'relógio do expediente nunca regrediu entre as retomadas');
    assert.ok(hours.some((h) => h > 24), 'retomado depois da meia-noite no MESMO expediente');
    assert.equal(run.g.session.save.shift!.shiftId, `${careerId}/dia-0`);
    assert.deepEqual(got.errors, []);
    if (vehicle === 'carro-antigo') assert.equal(run.g.trunk!.problem(run.g.day.parcels), null, 'porta-malas fisicamente válido após as retomadas');
  });
}

test('B1-01 F6 AC-22: razão idempotente — valores D07, devolução e NPC não pagam, retomar nunca paga de novo', () => {
  assert.equal(rateCents('ENTREGA', 'moto-antiga', 'ML'), 700); assert.equal(rateCents('ENTREGA', 'moto-antiga', 'SHP'), 500);
  assert.equal(rateCents('ENTREGA', 'carro-antigo', 'ML'), 900); assert.equal(rateCents('ENTREGA', 'carro-antigo', 'SHP'), 500);
  assert.equal(rateCents('COLETA', 'moto-antiga', 'ML'), 50); assert.equal(rateCents('ENTREGA', 'moto-antiga', 'LOJA'), null, 'sem valor aprovado: nenhum evento inventado');
  for (const [careerId, vehicle] of [['personagem-oeste', 'moto-antiga'], ['personagem-leste', 'carro-antigo']] as [CareerId, VehicleKind][]) {
    const { g, hour } = playDay(careerId, vehicle, (i) => i % 4000 === 1999);
    const end = captureShift(g.session.profile, g.session.save.shift, capture(g, hour));
    const pay = end.shift.payments;
    const byParcel = new Map(g.day.parcels.map((p) => [p.id, p]));
    for (const q of pay) {
      const p = byParcel.get(q.parcelId)!;
      if (q.kind === 'ENTREGA') { assert.equal(p.state, 'ENTREGUE'); assert.equal(p.sector, g.day.playerSector, 'só entregas do próprio jogador'); assert.equal(q.amountCents, rateCents('ENTREGA', vehicle, p.platform)); }
      else { assert.equal(p.collector, 'jogador'); assert.ok(p.history.some((e) => e.operation === 'estado:RECEBIDO_BASE')); assert.equal(q.amountCents, 50); }
    }
    const mineDelivered = g.day.load('jogador').filter((p) => p.state === 'ENTREGUE');
    const mineReturned = g.day.load('jogador').filter((p) => p.state === 'DEVOLVIDO_E_CONFERIDO');
    assert.ok(mineReturned.length > 0, 'cenário com devolução conferida');
    assert.equal(pay.filter((q) => q.kind === 'ENTREGA').length, mineDelivered.length, 'cada entrega do jogador paga uma vez');
    assert.ok(mineReturned.every((p) => !pay.some((q) => q.parcelId === p.id && q.kind === 'ENTREGA')), 'devolução conferida não paga entrega (AC-12)');
    const npcDelivered = g.day.parcels.filter((p) => p.state === 'ENTREGUE' && p.sector !== g.day.playerSector);
    assert.ok(npcDelivered.length > 0 && npcDelivered.every((p) => !pay.some((q) => q.parcelId === p.id && q.kind === 'ENTREGA')), 'entregas dos NPCs não pagam o jogador (AC-16)');
    assert.equal(pay.filter((q) => q.kind === 'COLETA').length, g.day.parcels.filter((p) => p.collector === 'jogador').length, 'uma coleta por volume coletado pelo jogador e recebido na base');
    assert.equal(end.profile.balanceCents, ledgerTotal(pay));
    assert.equal(new Set(pay.map((q) => q.eventId)).size, pay.length);
    // Settling again (as after a reload) adds nothing.
    assert.deepEqual(settle(pay, end.shift.parcels, end.shift.shiftId, vehicle).added, []);
    assert.equal(dueEvents(end.shift.parcels, end.shift.shiftId, vehicle).length, pay.length);
  }
});

test('B1-01 F6 AC-18/21: estado parcial ou corrompido é rejeitado sem tocar no save íntegro; principal ruim usa a cópia anterior', () => {
  const storage = new MemoryStorage();
  newCareer(storage, 'personagem-oeste', 'moto-antiga');
  const g = open(storage).game;
  g.day.start(11.75); markAbsent(g.day);
  for (let i = 0; i < 1500; i++) { playerStep(g, hourAt(i)); g.day.update(hourAt(i), STEP); }
  const a = checkpoint(g, hourAt(1499));
  for (let i = 1500; i < 2500; i++) { playerStep(g, hourAt(i)); g.day.update(hourAt(i), STEP); }
  const b = checkpoint(g, hourAt(2499));
  const intact = storage.getItem(saveKey('personagem-oeste'));
  const forge = (f: (o: any) => void) => { const o = JSON.parse(canonicalJson(b)); f(o); delete o.checksum; return { ...o, checksum: checksumOf(o) }; };
  const worker = (o: any) => o.shift.world.logistics.depot.workers.find((w: any) => w.task) ?? o.shift.world.logistics.depot.workers[0];
  const cases: [string, (o: any) => void, RegExp][] = [
    ['sem mundo', (o) => { o.shift.world = null; }, /sem o estado do mundo/],
    ['NPC ausente', (o) => { o.shift.world.logistics.couriers.pop(); }, /NPC ausentes/],
    ['tarefa de pacote inexistente', (o) => { const w = worker(o); w.task = { id: 'X', kind: 'check', stage: 'process', route: [], timer: 0, origin: { x: 0, y: 0, z: 0 }, destination: { x: 0, y: 0, z: 0 }, to: { x: 0, z: 0 }, expected: 'conferencia', state: 'EM_TRANSPORTE' }; w.parcel = 'X'; }, /desconhecido/],
    ['pacote em transferência sem trabalhador', (o) => { const p = o.shift.parcels.find((q: any) => q.place === 'recebimento' || q.place === 'saca'); p.place = 'transferencia'; p.history[p.history.length - 1].place = 'transferencia'; for (const w of o.shift.world.logistics.depot.workers) if (w.task?.id === p.id) { w.task = null; w.parcel = null; } }, /sem trabalhador|diverge/],
    ['saldo sem lastro', (o) => { o.profile.balanceCents += 100; }, /Saldo inconsistente/],
    ['pagamento a mais', (o) => { const p = o.shift.parcels.find((q: any) => q.state !== 'ENTREGUE'); o.shift.payments.push({ eventId: `${o.shift.shiftId}/${p.id}/ENTREGA`, shiftId: o.shift.shiftId, parcelId: p.id, kind: 'ENTREGA', amountCents: 700, vehicle: 'moto-antiga', platform: p.platform }); o.profile.balanceCents += 700; }, /não entregue/],
    ['relógio incoerente', (o) => { o.shift.shiftHour += 1; }, /Hora do expediente/],
    ['fase divergente', (o) => { o.shift.phase = 'CONCLUIDA'; }, /Fase/],
  ];
  for (const [what, f, re] of cases) {
    const bad = forge(f);
    assert.throws(() => parseSave(bad), re, what);
    assert.throws(() => g.store.write(bad as CareerSave), SaveError, `${what}: escrita recusada`);
    assert.equal(storage.getItem(saveKey('personagem-oeste')), intact, `${what}: save íntegro intacto`);
  }
  // Principal corrompido → a cópia anterior íntegra (checkpoint a) é a usada; nada é resetado.
  assert.equal(JSON.parse(storage.getItem(previousKey('personagem-oeste'))!).checkpointSequence, a.checkpointSequence);
  storage.setItem(saveKey('personagem-oeste'), intact!.slice(0, 2000));
  const r = new CareerStore(storage).read('personagem-oeste');
  assert.equal(r.source, 'anterior'); assert.match(r.problem!, /rejeitado/); assert.equal(r.save.checkpointSequence, a.checkpointSequence);
  const reopened = open(storage);
  assert.equal(reopened.resumedAt, a.shift!.shiftHour, 'retoma do último ponto íntegro');
  // Both copies unreadable: never offered as a new game, never overwritten.
  storage.setItem(previousKey('personagem-oeste'), '{"x":');
  const m = menuModel(storage);
  const card = m.cards.find((c) => c.careerId === 'personagem-oeste')!;
  assert.equal(card.saved, false); assert.ok(card.blocked); assert.ok(!mainScreen(m).newGame.some((c) => c.careerId === 'personagem-oeste'));
});

test('B1-01 F6 AC-18: falha de gravação (QuotaExceeded) mantém o save anterior, o jogo continua e a próxima tentativa grava', () => {
  const inner = new MemoryStorage();
  let full = false;
  const storage: KeyValueStorage = {
    getItem: (k) => inner.getItem(k), removeItem: (k) => inner.removeItem(k),
    setItem: (k, v) => { if (full && k.startsWith('brejo-b1:carreira:')) { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; } inner.setItem(k, v); },
  };
  newCareer(storage, 'personagem-norte', 'moto-antiga');
  const g = open(storage).game;
  g.day.start(11.75);
  let now = 0;
  const cp = new ShiftCheckpointer(g.session, () => capture(g, 12), { enabled: true, now: () => now, retryMs: 5000 });
  const results: boolean[] = []; cp.onResult = (ok) => results.push(ok);
  cp.tick();
  assert.equal(cp.status.writes, 1, 'abre o expediente gravando');
  const good = inner.getItem(saveKey('personagem-norte'));
  const prev = inner.getItem(previousKey('personagem-norte'));
  full = true;
  g.day.collect(g.day.assigned[0]!, 12); g.day.stow(12);
  assert.equal(cp.afterAction('coleta'), false);
  assert.match(cp.status.error!, /Falha ao gravar.*quota/i);
  assert.equal(inner.getItem(saveKey('personagem-norte')), good, 'principal intacto'); assert.equal(inner.getItem(previousKey('personagem-norte')), prev, 'cópia anterior intacta');
  assert.ok(g.day.inTrunk().length > 0, 'o jogo seguiu com os volumes no baú');
  now = 1000; cp.tick(); assert.equal(cp.status.failures, 1, 'espera o intervalo de nova tentativa');
  full = false; now = 6000; cp.tick();
  assert.equal(cp.status.error, null); assert.equal(cp.status.writes, 2);
  assert.deepEqual(results, [true, false, true]);
  const saved = new CareerStore(storage).read('personagem-norte').save;
  assert.ok(saved.shift!.parcels.some((p) => p.place === 'bau'), 'a coleta guardada no baú foi gravada na nova tentativa');
  assert.equal(saved.checkpointSequence, 2, 'sequência sem salto');
});

test('B1-01 F6: agendamento — ação do jogador grava na hora, NPC/base no máximo a cada intervalo, periódico, nada com o dia antes do início', () => {
  const storage = new MemoryStorage();
  newCareer(storage, 'personagem-sul', 'moto-antiga');
  const g = open(storage).game;
  let now = 0, hour = 11.75;
  const cp = new ShiftCheckpointer(g.session, () => capture(g, hour), { enabled: true, now: () => now, minGapMs: 4000, periodicMs: 30000 });
  cp.tick(); assert.equal(cp.status.writes, 0, 'antes da designação (ANTES) não abre expediente');
  g.day.start(11.75); cp.tick(); assert.equal(cp.status.writes, 1);
  assert.equal(new CareerStore(storage).read('personagem-sul').save.profile.activeShiftId, 'personagem-sul/dia-0', 'expediente aberto gravado (AC-17)');
  hour = 12; g.day.collect(g.day.assigned[0]!, 12);
  assert.equal(cp.afterAction('coleta'), true, 'custódia mudou: grava na hora'); assert.equal(cp.afterAction('nada'), false, 'sem mudança não grava');
  const sig = custodySignature(g.day);
  for (let k = 0; k < 20000 && custodySignature(g.day) === sig; k++) { hour += 0.1 / 150; g.day.update(hour, 0.1); }
  assert.notEqual(custodySignature(g.day), sig, 'um NPC/a base mudou a custódia');
  now = 1000; cp.tick(); assert.equal(cp.status.writes, 2, 'evento de NPC espera o intervalo mínimo');
  now = 4500; cp.tick(); assert.equal(cp.status.writes, 3);
  now = 20000; cp.tick(); assert.equal(cp.status.writes, 3);
  now = 34600; cp.tick(); assert.equal(cp.status.writes, 4, 'periódico');
  hour = 11.9; now = 70000; cp.tick();
  assert.match(cp.status.error!, /regrediu/, 'relógio do expediente não regride'); assert.equal(cp.status.writes, 4);
  const disabled = new ShiftCheckpointer(g.session, () => capture(g, 12.5), { enabled: false });
  assert.equal(disabled.checkpoint('x'), false, 'cenário de desenvolvimento sem persistência não grava');
});

test('B1-01 F6: duas abas — a segunda sessão fica desatualizada e para de gravar; o lease protege o mesmo navegador', () => {
  const storage = new MemoryStorage();
  newCareer(storage, 'personagem-leste', 'carro-antigo');
  const a = open(storage).game; const b = open(storage).game;
  a.day.start(11.75); b.day.start(11.75);
  const ca = new ShiftCheckpointer(a.session, () => capture(a, 12), { enabled: true });
  const cb = new ShiftCheckpointer(b.session, () => capture(b, 12.1), { enabled: true });
  assert.ok(ca.checkpoint('a'));
  assert.equal(cb.checkpoint('b'), false); assert.ok(cb.status.stale, 'sessão desatualizada'); assert.equal(cb.enabled, false, 'para de gravar');
  assert.equal(new CareerStore(storage).read('personagem-leste').save.shift!.shiftHour, 12, 'o save é o da primeira aba');
  // Lease (fallback sem Web Locks): uma aba por vez; lease vencido é retomado.
  let now = 1000;
  const l1 = new StorageLease(storage, 'aba-1', () => now), l2 = new StorageLease(storage, 'aba-2', () => now);
  assert.ok(l1.acquire()); assert.equal(l2.acquire(), false, 'segunda aba recusada'); assert.ok(l1.acquire(), 'renovação');
  now += LEASE_MS + 1; assert.ok(l2.acquire(), 'aba fechada/travada: lease vencido é livre'); assert.equal(l1.held(), false);
  l2.release(); assert.equal(storage.getItem(LEASE_KEY), null);
  storage.setItem(LEASE_KEY, '{lixo'); assert.ok(leaseFree(null, 'x', 0)); assert.ok(l1.acquire(), 'lease ilegível é livre');
});

test('B1-01 F6 AC-21/22: backup só entre expedientes; desatualizado ou de outra encarnação não reverte; apagar exige confirmação', () => {
  const storage = new MemoryStorage();
  newCareer(storage, 'personagem-oeste', 'moto-antiga');
  const store = new CareerStore(storage);
  const fresh = store.exportBackup('personagem-oeste');
  const g = open(storage).game; g.day.start(11.75); checkpoint(g, 11.75);
  assert.throws(() => store.exportBackup('personagem-oeste'), /entre expedientes/, 'não exporta com expediente aberto');
  assert.throws(() => store.importBackup(fresh), /expediente aberto/, 'não importa sobre expediente aberto');
  assert.throws(() => store.deleteCareer('personagem-oeste', 'Lia'), /aberto/, 'não apaga com expediente aberto');
  // Closed day (fast-forwarded by the real script), closed at home.
  const { g: done, hour } = playDay('personagem-oeste', 'moto-antiga');
  done.day.closedAtHome = null;
  const s2 = done.storage;
  closeShiftAtHome(done.session, capture(done, hour), nextWorkday(0).index);
  const st2 = new CareerStore(s2);
  const closed = st2.read('personagem-oeste').save;
  const paid = closed.profile.balanceCents;
  assert.ok(paid > 0, 'ganhos do dia no saldo');
  const backup = st2.exportBackup('personagem-oeste');
  // Same incarnation, an OLDER checkpoint of it: refused (would undo the paid day).
  const older = sealSave({ careerId: 'personagem-oeste', checkpointSequence: 0, profile: { ...closed.profile, balanceCents: 0, calendarIndex: 0, lastClosedShift: null }, shift: null });
  assert.throws(() => st2.importBackup(canonicalJson(older)), /desatualizado/);
  assert.throws(() => st2.importBackup(backup), /já é o save atual/);
  assert.throws(() => st2.importBackup(canonicalJson({ ...JSON.parse(backup), profile: { ...JSON.parse(backup).profile, balanceCents: paid * 2 } })), /Checksum/);
  // Delete (explicit name), the other careers untouched, the marks kept.
  newCareer(s2, 'personagem-sul', 'carro-antigo');
  new CareerStore(s2).setActiveCareer('personagem-oeste');
  const sul = s2.getItem(saveKey('personagem-sul'));
  assert.throws(() => st2.deleteCareer('personagem-oeste', 'lia'), /Confirmação inválida/);
  s2.setItem(CALENDAR_STORAGE_KEY, '4');
  st2.deleteCareer('personagem-oeste', 'Lia');
  assert.equal(s2.getItem(saveKey('personagem-oeste')), null); assert.equal(s2.getItem(previousKey('personagem-oeste')), null);
  assert.equal(s2.getItem(CALENDAR_STORAGE_KEY), '4', 'chave legada preservada (builds antigos)'); assert.equal(s2.getItem(LEGACY_DISMISSED_KEY), '1');
  assert.equal(st2.read('personagem-oeste').source, 'novo', 'o legado não volta como carreira Oeste depois de apagar');
  assert.equal(s2.getItem(saveKey('personagem-sul')), sul, 'Sul intacto');
  assert.ok(s2.getItem(marksKey('personagem-oeste')), 'marcas da linhagem mantidas');
  // The old checkpoint of the deleted incarnation is still refused; its final export is accepted.
  assert.throws(() => st2.importBackup(canonicalJson(older)), /desatualizado/);
  const back = st2.importBackup(backup, 'personagem-oeste');
  assert.equal(back.profile.balanceCents, paid); assert.equal(back.checkpointSequence, closed.checkpointSequence);
  // A different incarnation in the slot needs explicit confirmation.
  st2.deleteCareer('personagem-oeste', 'Lia');
  newCareer(s2, 'personagem-oeste', 'carro-antigo');
  assert.throws(() => st2.importBackup(backup), /confirme a substituição/);
  const replaced = st2.importBackup(backup, 'personagem-oeste', { replace: true });
  assert.equal(replaced.profile.vehicle!.kind, 'moto-antiga');
  assert.equal(JSON.parse(s2.getItem(previousKey('personagem-oeste'))!).profile.vehicle.kind, 'carro-antigo', 'a carreira substituída fica como cópia anterior');
  assert.equal(s2.getItem(saveKey('personagem-sul')), sul);
});

test('B1-01 F6 AC-13/17/26: encerramento só depois de tudo resolvido E de voltar à própria casa; dia avança uma vez; troca liberada só então', () => {
  const careerId: CareerId = 'personagem-norte';
  const storage = new MemoryStorage();
  newCareer(storage, careerId, 'moto-antiga');
  newCareer(storage, 'personagem-sul', 'moto-antiga');
  new CareerStore(storage).setActiveCareer(careerId);
  const others = CAREER_IDS.filter((c) => c !== careerId).map((c) => [c, storage.getItem(saveKey(c)), storage.getItem(previousKey(c))]);
  const g = open(storage).game;
  g.day.start(11.75); markAbsent(g.day); checkpoint(g, 11.75);
  const home = careerHome(careerId), alien = careerHome('personagem-sul');
  const atDoor = { ...home.door, riding: false }; const parked = { ...home.stop, stopped: true };
  let i = 0, lastDelivery: number | null = null;
  for (; i < 30000 && !g.day.allResolved; i++) {
    const hour = hourAt(i);
    const delivered = g.day.load('jogador').filter((p) => p.state === 'ENTREGUE').length;
    playerStep(g, hour); g.day.update(hour, STEP);
    if (g.day.load('jogador').filter((p) => p.state === 'ENTREGUE').length > delivered) lastDelivery = hour;
    if (i % 997 === 0 || (hour > 21 && hour < 21.01)) {
      assert.equal(closureState(g.day), 'operacoes_pendentes');
      assert.equal(homeClosureCheck(g.day, home, atDoor, parked).ok, false, `não encerra com pendências (${hour.toFixed(2)}h)`);
      assert.throws(() => closeShiftAtHome(g.session, capture(g, hour), 1), /pendências/);
      checkpoint(g, hour);
      assert.throws(() => new CareerStore(storage).setActiveCareer('personagem-sul'), /troca de carreira só após finalizar/, 'troca bloqueada durante o expediente (AC-17)');
    }
  }
  const hour = hourAt(i - 1);
  assert.ok(lastDelivery !== null && hour >= lastDelivery);
  assert.equal(closureState(g.day), 'retorno_pendente', 'tudo resolvido: falta voltar para casa');
  assert.equal(g.day.phase, 'CONCLUIDA');
  assert.match(g.day.objective(hour).title, /Voltar para casa/);
  checkpoint(g, hour);
  assert.notEqual(new CareerStore(storage).read(careerId).save.profile.activeShiftId, null, 'CONCLUIDA ainda é expediente aberto');
  assert.throws(() => new CareerStore(storage).setActiveCareer('personagem-sul'), /troca de carreira/);
  // Wrong places: on the bike, far from the door, vehicle far away, another career's house.
  assert.match((homeClosureCheck(g.day, home, { ...home.door, riding: true }, parked) as { reason: string }).reason, /desça/);
  assert.match((homeClosureCheck(g.day, home, { x: home.door.x + 10, z: home.door.z, riding: false }, parked) as { reason: string }).reason, /porta/);
  assert.match((homeClosureCheck(g.day, home, atDoor, { x: home.stop.x + 200, z: home.stop.z, stopped: true }) as { reason: string }).reason, /veículo/);
  assert.equal(homeClosureCheck(g.day, home, { ...alien.door, riding: false }, { ...alien.stop, stopped: true }).ok, false, 'casa de outro personagem não serve');
  assert.ok(homeClosureCheck(g.day, home, atDoor, parked).ok);
  const nextIndex = nextWorkday(0).index;
  const closed = closeShiftAtHome(g.session, capture(g, hour), nextIndex);
  g.day.closedAtHome = hour;
  assert.equal(closureState(g.day), 'expediente_encerrado');
  assert.equal(closed.shift, null); assert.equal(closed.profile.activeShiftId, null); assert.equal(closed.profile.calendarIndex, nextIndex);
  const sum = closed.profile.lastClosedShift!;
  assert.equal(sum.shiftId, `${careerId}/dia-0`); assert.equal(sum.delivered + sum.returned, g.day.load('jogador').length);
  assert.equal(sum.earnedCents, closed.profile.balanceCents);
  assert.throws(() => closeShiftAtHome(g.session, capture(g, hour), nextIndex), /não retrocede/, 'não encerra duas vezes nem avança o dia de novo');
  for (const [c, main, prev] of others) { assert.equal(storage.getItem(saveKey(c as CareerId)), main, `${c} intacto`); assert.equal(storage.getItem(previousKey(c as CareerId)), prev); }
  new CareerStore(storage).setActiveCareer('personagem-sul');
  assert.equal(new CareerStore(storage).activeCareer(), 'personagem-sul', 'troca liberada depois do encerramento válido');
  // The next day of Norte starts fresh (no shift), from the new calendar day.
  new CareerStore(storage).setActiveCareer(careerId);
  const reopened = open(storage);
  assert.equal(reopened.resumedAt, null); assert.equal(reopened.game.session.profile.calendarIndex, nextIndex);
});

test('B1-01 F6: quatro carreiras isoladas — o expediente de uma grava só o save dela; menu bloqueia as outras durante o expediente', () => {
  const storage = new MemoryStorage();
  for (const c of CAREER_IDS) newCareer(storage, c, c === 'personagem-leste' ? 'carro-antigo' : 'moto-antiga');
  new CareerStore(storage).setActiveCareer(DEFAULT_CAREER);
  const before = new Map(CAREER_IDS.map((c) => [c, [storage.getItem(saveKey(c)), storage.getItem(previousKey(c))]]));
  const g = open(storage).game;
  g.day.start(11.75); markAbsent(g.day);
  for (let i = 0; i < 3000; i++) { playerStep(g, hourAt(i)); g.day.update(hourAt(i), STEP); if (i % 500 === 0) checkpoint(g, hourAt(i)); }
  for (const c of CAREER_IDS.filter((x) => x !== DEFAULT_CAREER)) assert.deepEqual([storage.getItem(saveKey(c)), storage.getItem(previousKey(c))], before.get(c), `${c} byte a byte`);
  const m = menuModel(storage);
  assert.equal(m.lockedBy, DEFAULT_CAREER);
  assert.ok(m.cards.filter((c) => c.careerId !== DEFAULT_CAREER).every((c) => /Expediente aberto de Lia/.test(c.blocked ?? '')));
  assert.throws(() => enterCareer(storage, 'personagem-norte', { appearance: 'feminino', equipment: 'kit-jaqueta', vehicle: null }), /troca de carreira só após finalizar/);
  const cont = mainScreen(m).continueCard!;
  assert.equal(cont.careerId, DEFAULT_CAREER); assert.ok(cont.activeShiftId);
  // Continue = same career, same shift, nothing written by entering.
  const text = storage.getItem(saveKey(DEFAULT_CAREER));
  enterCareer(storage, DEFAULT_CAREER, { appearance: cont.appearance, equipment: cont.equipment, vehicle: null });
  assert.equal(storage.getItem(saveKey(DEFAULT_CAREER)), text);
});

test('B1-01 F6: migração v2 → v3 de um save gravado pela F3–F5 (expediente aberto sem pacotes) e checksum conferido antes', () => {
  const v2profile = (({ lineageId: _l, lastClosedShift: _c, ...r }) => r)(chooseStartingVehicle(new CareerStore(new MemoryStorage()).read('personagem-norte').save.profile, 'moto-antiga'));
  const shift = { shiftId: 'personagem-norte/dia-3', careerId: 'personagem-norte', calendarIndex: 3, elapsedVirtualMinutes: 200, phase: 'ANTES', roster: buildRoster('personagem-norte'), parcels: [], payments: [], lateByActor: { jogador: null, npc1: null, npc2: null, npc3: null }, safePoint: null };
  const body = { format: 'brejo-alegre-carreira', schemaVersion: 2, careerId: 'personagem-norte', checkpointSequence: 4, profile: { ...v2profile, calendarIndex: 3, activeShiftId: shift.shiftId }, shift };
  const v2 = { ...body, checksum: checksumOf(body as any) };
  const s = parseSave(JSON.parse(JSON.stringify(v2)));
  assert.equal(s.schemaVersion, 3); assert.equal(s.shift!.shiftHour, 11.75 + 200 / 60); assert.equal(s.shift!.world, null);
  assert.equal(s.profile.lineageId, parseSave(JSON.parse(JSON.stringify(v2))).profile.lineageId, 'linhagem derivada estável');
  assert.throws(() => parseSave({ ...v2, checkpointSequence: 5 }), /Checksum/);
  // In the game such a shift starts from its beginning (nothing confirmed) with the same id.
  const storage = new MemoryStorage(); storage.setItem(saveKey('personagem-norte'), JSON.stringify(v2)); new CareerStore(storage).setActiveCareer('personagem-norte');
  const r = open(storage);
  assert.equal(r.resumedAt, null); assert.equal(r.game.session.save.shift!.shiftId, 'personagem-norte/dia-3');
});
