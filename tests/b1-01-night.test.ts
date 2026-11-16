import test from 'node:test';
import assert from 'node:assert/strict';
import { VirtualClock, WORKDAY_END } from '../src/core/city/clock.ts';
import { LogisticsDay, absentByCalendar, ABSENT_PERCENT } from '../src/core/delivery/logisticsDay.ts';
import { DEPOT_SPOTS, releaseWithinReach, carBootSpot } from '../src/core/delivery/workday.ts';
import { attemptFailed, confirmReturn, createParcel, advance, move, isFinal, ParcelError, type Parcel } from '../src/core/delivery/parcels.ts';
import { CarTrunk } from '../src/core/delivery/carTrunk.ts';
import { ON_DUTY_ROLES } from '../src/core/delivery/depotOperations.ts';
import { buildRoster, type CareerId } from '../src/core/career/careers.ts';
import { ACTORS, type ActorId } from '../src/core/delivery/dailyDemand.ts';
import { SECTOR_DATA } from '../src/core/delivery/sectors.ts';
import { depotWorld, depotYaw, CITY_BOUNDS } from '../src/world/city/cityPlan.ts';
import { CAR_PARKING } from '../src/world/city/depotPlan.ts';
import { solidPolygons } from '../src/world/city/cityLayout.ts';
import { createMotionGuard } from '../src/core/collision.ts';
import { captureParcels, chooseStartingVehicle, defaultProfile, emptyShift, paymentEventIdOf, sealSave, shiftIdOf, vehicleIdOf } from '../src/core/career/snapshot.ts';

/**
 * B1-01 F5 — decisões 9, 13, 14, 17; AC-11, AC-12, AC-13, AC-14, AC-15, AC-24, AC-25, AC-26 (parte F5).
 * Checkpoints vivos e a finalização/troca de carreira em jogo são F6.
 */
const guard = createMotionGuard(CITY_BOUNDS, [], solidPolygons());
const bike = { ...depotWorld(84, -111), yaw: depotYaw(0), moving: false };
const parking = { player: { ...depotWorld(84, -112.25), riding: false }, bike };
const receiving = { player: { ...depotWorld(97.8, -122.3), riding: false }, bike };
const H = (hh: number, mm: number) => hh + mm / 60;

test('B1-01 F5 AC-15: relógio do expediente é monotônico — 00h01 é 24h01 do mesmo turno; o relógio visível dá a volta', () => {
  const c = new VirtualClock(20.98);
  c.advance(150 * 3.06);
  assert.ok(Math.abs(c.shiftHour - 24.04) < 1e-9); assert.equal(c.label, '00:02'); assert.ok(c.hour < 1); assert.equal(c.daysCrossed, 1);
  assert.equal(c.isWorkday, false, '21h passou: atraso, não expediente planejado');
  c.setShiftHour(H(24, 1)); assert.equal(c.label, '00:01'); assert.ok(c.shiftHour > 24);
  c.setShiftHour(99); assert.ok(c.shiftHour < 72, 'salto inválido ignorado');
  const k = new VirtualClock(); k.advance(150); assert.ok(k.shiftHour > 12.7 && k.shiftHour < 12.8, 'escala 150 s/h preservada');
});

test('B1-01 F5 AC-11/12: tentativa não é final; só devolução física + conferência a finaliza, com resultado distinto de ENTREGUE', () => {
  const p = createParcel('T-1', 'farmacia', 'end-1', 'LOJA', 'Oeste', 'NA_LOJA', 'farmacia', 12);
  for (const s of ['COLETADO', 'EM_TRANSPORTE', 'RECEBIDO_BASE', 'TRIADO', 'NA_SACA', 'EM_ROTA'] as const) p.state = s;
  p.place = 'maos'; p.holder = 'jogador';
  assert.throws(() => attemptFailed(p, 'npc1', 21), ParcelError, 'só quem está com o pacote');
  attemptFailed(p, 'jogador', H(21, 30));
  assert.equal(p.state, 'TENTATIVA_FRUSTRADA'); assert.equal(isFinal(p), false); assert.equal(p.place, 'maos'); assert.equal(p.holder, 'jogador');
  assert.throws(() => attemptFailed(p, 'jogador', 22), ParcelError, 'tentativa não se repete sobre o mesmo pacote');
  assert.throws(() => advance(p, 'ENTREGUE', 'destinatario', 22), ParcelError, 'nunca vira ENTREGUE depois da tentativa');
  assert.throws(() => advance(p, 'NA_LOJA', 'x', 22), ParcelError, 'nem volta ao começo do fluxo');
  assert.throws(() => move(p, 'destinatario', 'destinatario', 22), ParcelError);
  assert.throws(() => confirmReturn(p, 'conferente', 22, { x: 0, y: 0, z: 0 }), ParcelError, 'conferência só na mesa de conferência');
  move(p, 'recebimento', 'recebimento', 22, { x: 99, y: 1, z: -122 });
  move(p, 'conferencia', 'conferente', 22, { x: 99, y: 1, z: -122 });
  confirmReturn(p, 'conferente', H(24, 1), { x: 97, y: .4, z: -123.6 });
  assert.equal(p.state, 'DEVOLVIDO_E_CONFERIDO'); assert.equal(p.place, 'devolucoes'); assert.ok(isFinal(p));
  assert.throws(() => confirmReturn(p, 'conferente', 24.1, { x: 97, y: .4, z: -123.6 }), ParcelError, 'conferência idempotente: não confere duas vezes');
  assert.ok(!p.history.some((e) => e.state === 'ENTREGUE'));
});

test('B1-01 F5: ausências do dia são determinísticas pelo calendário (~10 % dos endereços), nenhuma sem calendário', () => {
  const a = new LogisticsDay({ dayIndex: 2 }); a.start(11);
  const b = new LogisticsDay({ dayIndex: 2 }); b.start(11);
  assert.deepEqual([...a.absentAddresses].sort(), [...b.absentAddresses].sort());
  let n = 0, tot = 0;
  for (let seed = 0; seed < 50; seed++) for (const id of a.addresses.map((x) => x.id)) { tot++; if (absentByCalendar(seed, id)) n++; }
  assert.ok(Math.abs(n / tot - ABSENT_PERCENT / 100) < 0.03, `${n}/${tot}`);
  const legacy = new LogisticsDay({ seed: 2026 }); legacy.start(11);
  assert.equal(legacy.absentAddresses.size, 0, 'cenário sem calendário (testes legados) não tem ausências');
});

test('B1-01 F5: liberação da equipe só no assento ou ao lado do veículo (correção da auditoria F4)', () => {
  const v = depotWorld(84, -111);
  assert.ok(releaseWithinReach({ ...v, riding: true }, v));
  assert.ok(releaseWithinReach({ x: v.x + 2, z: v.z, riding: false }, v));
  assert.ok(!releaseWithinReach({ ...depotWorld(97.8, -122.3), riding: false }, v), 'do balcão de recebimento não');
  assert.ok(!releaseWithinReach({ x: v.x + 3.2, z: v.z, riding: false }, v));
});

/**
 * Dia inteiro jogando `careerId` com a moto: a equipe só é liberada às 20h54, a 1ª entrega às
 * 20h59, a 2ª às 21h01, uma tentativa frustrada às 21h30, o resto depois de 00h01; as três NPCs
 * trabalham depois de 21h, cada uma com um endereço ausente, e o conferente de plantão confere.
 */
function nightDay(careerId: CareerId) {
  const d = new LogisticsDay({ seed: 2026, free: (x, z) => guard(x, z, 0.45), roster: buildRoster(careerId) });
  const sector = d.playerSector;
  const dispatch = { player: { ...depotWorld(SECTOR_DATA[sector].x, -116.7), riding: false }, bike };
  d.start(11);
  const ids = d.parcels.map((p) => p.id);
  const firstDest = (a: ActorId) => [...new Set(d.load(a).map((p) => p.destination))].sort();
  const absent = new Map<ActorId, string>();
  for (const a of ACTORS) { const list = firstDest(a); absent.set(a, list[Math.min(2, list.length - 1)]!); d.absentAddresses.add(absent.get(a)!); }
  for (const kind of d.assigned) while (d.readyAt(kind).length) { assert.ok(d.collect(kind, 12) > 0); d.stow(12); }
  const log: string[] = [];
  let hour = 12, delivered = 0, attempt = false, returnsBack = false, phaseBefore: string[] = [];
  for (let t = 0; t < 2400 && d.phase !== 'CONCLUIDA'; t += 0.1) {
    hour = 12 + t / 150;
    if (d.trunkForDepot().length && !d.inHands().length && !d.released) d.unloadForDepot(hour, false, parking);
    if (d.inHands().some((p) => p.state === 'EM_TRANSPORTE')) d.handOver(hour, receiving);
    d.update(hour, 0.1);
    if (d.canTakeSack(hour)) { assert.ok(d.takeSack(hour, dispatch) > 0); d.stow(hour); }
    // The release is held back until 20h54 so that everybody works across 21h.
    if (d.teamReady && !d.released && hour >= H(20, 54)) { assert.ok(d.release(hour)); log.push(`liberada ${hour.toFixed(3)}`); }
    if (d.released) {
      const next = d.route[0];
      const slot = delivered === 0 ? H(20, 59) : delivered === 1 ? H(21, 1) : attempt ? H(24, 1) : H(21, 30);
      if (next && hour >= slot) {
        d.takeForAddress(next, hour);
        if (d.recipientAbsent(next)) { assert.equal(d.deliver(next, hour), 0, 'ausente: não entrega'); assert.ok(d.registerAttempt(next, hour) > 0); d.stow(hour); attempt = true; }
        else { const n = d.deliver(next, hour); assert.ok(n > 0); delivered++; }
      }
      // Back at the base with the failed attempt: top box → hands → receiving desk (on-duty checker).
      if (!d.route.length && d.returnsPending().length && !returnsBack) {
        if (!d.inHands().length) d.unloadForDepot(hour, false, parking);
        if (d.handOver(hour, receiving) > 0) { returnsBack = true; log.push(`devolvido ao balcão ${hour.toFixed(3)}`); }
      }
      if (hour > 21 && phaseBefore.length < 1) phaseBefore.push(d.phase);
    }
  }
  return { d, ids, absent, log, hour, phaseBefore };
}

for (const careerId of ['personagem-oeste', 'personagem-norte'] as CareerId[]) test(`B1-01 F5 AC-13/14/15/24/25/26: dia atravessando 21h e 00h jogando ${careerId} — tudo finalizado, devoluções conferidas pelo plantão, atrasos por entregador`, () => {
  const { d, ids, absent, log, hour, phaseBefore } = nightDay(careerId);
  assert.equal(d.phase, 'CONCLUIDA', `dia não concluído até ${hour.toFixed(2)}h: ${log.join(' | ')} · ${d.couriers.map((c) => `${c.name}:${c.state}`).join(',')}`);
  assert.ok(hour > 24, 'o mesmo expediente atravessou a meia-noite');
  assert.ok(phaseBefore.every((p) => p !== 'ENCERRADA' && p !== 'CONCLUIDA'), '21h não encerrou nada');
  assert.deepEqual(d.parcels.map((p) => p.id), ids, 'IDs estáveis'); assert.equal(new Set(ids).size, ids.length);
  assert.ok(d.parcels.every(isFinal), 'todo pacote com resultado final válido');
  assert.deepEqual(d.depot.errors, []);
  for (const a of ACTORS) {
    const addr = absent.get(a)!;
    const back = d.parcels.filter((p) => p.destination === addr && p.sector === d.actorSector(a));
    assert.ok(back.length > 0);
    for (const p of back) {
      // AC-11/12/25: attempt → physical return to the desk → on-duty checker → returns shelf; never delivered.
      const ops = p.history.map((e) => e.operation);
      assert.equal(p.state, 'DEVOLVIDO_E_CONFERIDO', `${a} ${p.id}: ${ops.join('>')}`);
      assert.equal(p.place, 'devolucoes');
      assert.ok(!p.history.some((e) => e.state === 'ENTREGUE'));
      const tent = p.history.find((e) => e.operation === 'tentativa:frustrada')!;
      assert.equal(tent.holder, a, 'tentativa registrada pelo próprio entregador');
      const conf = p.history.find((e) => e.operation === 'estado:DEVOLVIDO_E_CONFERIDO')!;
      assert.ok(ON_DUTY_ROLES.includes(conf.holder), `conferido pelo plantão (${conf.holder})`);
      assert.ok(conf.hour > WORKDAY_END, 'conferência real depois das 21h');
      // (the morning intake also passed the desk: the return is the LAST pass, after the attempt)
      const t = ops.indexOf('tentativa:frustrada'), r = ops.lastIndexOf('transferência:recebimento'), c = ops.lastIndexOf('transferência:conferencia');
      assert.ok(t < r && r < c && c < ops.indexOf('estado:DEVOLVIDO_E_CONFERIDO'), ops.join('>'));
    }
  }
  // AC-24: the three NPCs kept working after 21h (deliveries recorded after the deadline).
  for (const c of d.couriers) {
    const late = d.load(c.id).filter((p) => p.history.some((e) => (e.state === 'ENTREGUE' || e.operation === 'tentativa:frustrada') && e.hour > WORKDAY_END));
    assert.ok(late.length > 0, `${c.name} trabalhou depois das 21h`);
    assert.equal(c.state, 'complete');
  }
  // AC-14: 20h59 on time, 21h01 late.
  const mine = d.load('jogador').filter((p) => p.state === 'ENTREGUE').map((p) => p.history.find((e) => e.state === 'ENTREGUE')!.hour).sort((a, b) => a - b);
  assert.ok(mine[0]! >= H(20, 59) && mine[0]! < WORKDAY_END, 'primeira entrega 20h59 sem atraso');
  assert.ok(mine.some((h) => h >= H(21, 1) && h < 22), 'entrega das 21h01 aceita');
  assert.ok(mine.some((h) => h >= H(24, 1)), 'entregas depois de 00h01 aceitas, mesmo expediente');
  // AC-26: report per courier.
  const rep = d.report(hour);
  assert.equal(rep.length, 4);
  for (const r of rep) {
    assert.equal(r.pending, 0); assert.ok(r.finishedAt !== null && r.finishedAt > WORKDAY_END); assert.ok(r.lateMinutes! > 0); assert.ok(r.returned > 0);
    assert.equal(r.delivered + r.returned, d.load(r.actor).length);
  }
  const me = rep.find((r) => r.actor === 'jogador')!;
  assert.ok(me.lateDeliveries >= 2 && me.lateDeliveries === mine.filter((h) => h > WORKDAY_END).length);
  // AC-22: a returned parcel is never payable (the save schema rejects a delivery payment for it).
  const returned = d.load('jogador').find((p) => p.state === 'DEVOLVIDO_E_CONFERIDO')!;
  const delivered = d.load('jogador').find((p) => p.state === 'ENTREGUE')!;
  const profile = { ...chooseStartingVehicle(defaultProfile(careerId, 0), 'moto-antiga'), activeShiftId: shiftIdOf(careerId, 0) };
  const shift = { ...emptyShift(careerId, 0), parcels: captureParcels(d.parcels), elapsedVirtualMinutes: Math.round((hour - 11.75) * 60) };
  const pay = (p: Parcel) => ({ eventId: paymentEventIdOf(shift.shiftId, p.id), shiftId: shift.shiftId, parcelId: p.id, kind: 'ENTREGA' as const, amountCents: 500 });
  assert.doesNotThrow(() => sealSave({ careerId, checkpointSequence: 0, profile, shift: { ...shift, payments: [pay(delivered)] } }), 'save do fim do dia, com devoluções reais, é válido');
  assert.throws(() => sealSave({ careerId, checkpointSequence: 0, profile, shift: { ...shift, payments: [pay(returned)] } }), /não entregue/);
});

test('B1-01 F5 AC-13: o expediente não conclui com pendência (tentativa sem devolução, NPC na rua, conferência por fazer)', () => {
  const d = new LogisticsDay({ seed: 2026, free: (x, z) => guard(x, z, 0.45), roster: buildRoster('personagem-oeste') });
  d.start(11);
  // Everything final except one parcel left in a failed attempt: never CONCLUIDA, also after 00h.
  for (const p of d.parcels) { p.state = 'ENTREGUE'; p.place = 'destinatario'; p.holder = 'destinatario'; }
  const left = d.load('jogador')[0]!; left.state = 'TENTATIVA_FRUSTRADA'; left.place = 'bau'; left.holder = 'jogador';
  for (const c of d.couriers) c.state = 'complete';
  for (const h of [20.99, 21.01, 23.99, H(24, 1), 30]) { d.update(h, 0.01); assert.notEqual(d.phase, 'CONCLUIDA', `às ${h}`); assert.notEqual(d.phase, 'ENCERRADA'); }
  assert.equal(d.finishedAt.jogador, null);
  assert.equal(d.allResolved, false);
});

test('B1-01 F5 AC-11/12: com o CARRO a devolução volta pelo porta-malas e passa pelo mesmo balcão', () => {
  const d = new LogisticsDay({ seed: 2026, free: (x, z) => guard(x, z, 0.45), roster: buildRoster('personagem-leste') });
  d.vehicleKind = 'carro-antigo';
  const trunk = new CarTrunk(vehicleIdOf('personagem-leste')); trunk.setOpen(true);
  const bay = CAR_PARKING[0]!; const car = { ...depotWorld((bay.minX + bay.maxX) / 2, (bay.minZ + bay.maxZ) / 2), yaw: depotYaw(0), moving: false };
  d.start(11); d.released = true;
  const p = d.load('jogador')[0]!;
  p.state = 'EM_ROTA'; p.place = 'maos'; p.holder = 'jogador';
  d.absentAddresses.add(p.destination);
  assert.equal(d.deliver(p.destination, 21.5), 0);
  assert.ok(d.registerAttempt(p.destination, 21.5) > 0);
  assert.deepEqual(trunk.stow(d.parcels, 21.6, { parked: true }).rejected, []);
  assert.equal(p.place, 'porta-malas'); assert.equal(p.state, 'TENTATIVA_FRUSTRADA');
  d.update(21.7, 0.01);
  assert.match(d.objective(21.7, car).title, /Devolver 1 volume\(s\) na base/);
  assert.ok(d.unloadCarForDepot(trunk, 22, { player: { ...carBootSpot(car), riding: false }, bike: car, car: true }) > 0);
  assert.ok(d.handOver(22, { player: { ...DEPOT_SPOTS.receiving, riding: false }, bike: car, car: true }) > 0);
  assert.equal(p.place, 'recebimento');
  for (let t = 0; t < 30 && p.state !== 'DEVOLVIDO_E_CONFERIDO'; t += 0.1) d.update(H(24, 1) + t / 150, 0.1);
  assert.equal(p.state, 'DEVOLVIDO_E_CONFERIDO', 'conferido pelo plantão depois de 00h01');
  assert.equal(p.history.find((e) => e.state === 'DEVOLVIDO_E_CONFERIDO')!.holder, 'conferente');
});

// ------------------------------------------------------------------ auditoria F5 (comentário 6905901610)

/**
 * Lote que só chega à base DEPOIS das 21h (ou de 00h01): coleta real ao meio-dia, mas descarga e
 * entrega ao conferente tarde. A base tem de continuar recebimento → conferência → triagem →
 * gaiola → doca → saca com trabalhadores reais (retidos só enquanto há trabalho), sem bloqueio.
 */
function lateIntake(handOverAt: number) {
  const d = new LogisticsDay({ seed: 2026, free: (x, z) => guard(x, z, 0.45), roster: buildRoster('personagem-oeste') });
  d.start(11);
  for (const kind of d.assigned) while (d.readyAt(kind).length) { assert.ok(d.collect(kind, 12) > 0); d.stow(12); }
  const mine = d.parcels.filter((p) => p.collector === 'jogador').map((p) => p.id);
  let delivered = false;
  for (let t = 0; t < 1800; t += 0.1) {
    const hour = handOverAt + t / 150;
    if (d.trunkForDepot().length && !d.inHands().length) d.unloadForDepot(hour, false, parking);
    if (d.inHands().some((p) => p.state === 'EM_TRANSPORTE')) { d.handOver(hour, receiving); delivered = true; }
    d.update(hour, 0.1);
    if (delivered && mine.every((id) => { const p = d.parcels.find((q) => q.id === id)!; return p.state === 'NA_SACA' && p.place === 'saca'; })) return { d, mine, hour, ok: true };
  }
  return { d, mine, hour: handOverAt + 12, ok: false };
}

for (const [label, at] of [['21h01', H(21, 1)], ['00h01', H(24, 1)]] as const) test(`B1-01 F5 auditoria 1: lote recebido às ${label} percorre conferência, triagem e expedição até a saca, sem bloqueio permanente`, () => {
  const { d, mine, hour, ok } = lateIntake(at);
  const where = mine.map((id) => { const p = d.parcels.find((q) => q.id === id)!; return `${id}:${p.state}@${p.place}`; });
  assert.ok(ok, `lote parado depois das 21h (${hour.toFixed(2)}h): ${where.join(' ')}`);
  assert.deepEqual(d.depot.errors, []);
  for (const id of mine) {
    const p = d.parcels.find((q) => q.id === id)!;
    const ops = p.history.map((e) => e.operation);
    // Every stage was a real worker task after the late hand-over (no teleport, no forced state).
    for (const op of ['transferência:recebimento', 'transferência:conferencia', 'estado:RECEBIDO_BASE', 'transferência:triagem', 'estado:TRIADO', 'transferência:gaiola', 'transferência:doca', 'estado:NA_SACA'])
      assert.ok(ops.includes(op), `${id} sem ${op}: ${ops.join('>')}`);
    const sorted = p.history.find((e) => e.state === 'TRIADO')!;
    assert.ok(sorted.hour >= at, `${id} triado depois da entrega tardia`);
  }
  // Once nothing is pending, the regular team stops again; the on-duty checker stays.
  for (let t = 0; t < 120; t += 0.1) d.update(hour + 0.5 + t / 150, 0.1);
  const busy = d.depot.workers.filter((w) => w.task);
  assert.ok(busy.every((w) => ON_DUTY_ROLES.includes(w.role)), `sem trabalho pendente só o plantão: ${busy.map((w) => w.role).join(',')}`);
  const staff = new Map(d.staff.map((s) => [s.role, s.state]));
  assert.equal(staff.get('separador-1'), 'fora do turno');
  assert.match(staff.get('conferente')!, /plantão|aguardando|check/);
});

test('B1-01 F5 auditoria 1: em dia normal, depois das 21h sem pendências, a equipe regular não pega trabalho novo e o plantão continua disponível', () => {
  const { d } = nightDay('personagem-oeste');
  assert.equal(d.phase, 'CONCLUIDA');
  const late = d.parcels.flatMap((p) => p.history.filter((e) => e.hour > WORKDAY_END && /^(estado:TRIADO|transferência:triagem|transferência:gaiola)$/.test(e.operation)).map((e) => e.holder));
  assert.deepEqual(late, [], 'sem lote atrasado, ninguém fez triagem depois das 21h');
  const conf = d.parcels.filter((p) => p.state === 'DEVOLVIDO_E_CONFERIDO').map((p) => p.history.find((e) => e.state === 'DEVOLVIDO_E_CONFERIDO')!.holder);
  assert.ok(conf.length > 0 && conf.every((h) => ON_DUTY_ROLES.includes(h)), 'devoluções após 21h só pelo plantão');
});

test('B1-01 F5 auditoria 2: a última entrega do jogador com um NPC ainda na rua NÃO conclui nem anuncia o fim do expediente', () => {
  const d = new LogisticsDay({ seed: 2026, free: (x, z) => guard(x, z, 0.45), roster: buildRoster('personagem-oeste') });
  d.start(11); d.released = true;
  for (const p of d.parcels) { p.state = 'ENTREGUE'; p.place = 'destinatario'; p.holder = 'destinatario'; }
  const last = d.load('jogador')[0]!;
  last.state = 'EM_ROTA'; last.place = 'maos'; last.holder = 'jogador';
  for (const c of d.couriers) c.state = 'complete';
  d.couriers[1]!.state = 'return-address';     // Caio is still walking back to his bike
  d.update(22, 0.01);
  d.events.length = 0;
  assert.ok(d.deliver(last.destination, 22) > 0, 'última entrega do jogador acontece');
  assert.ok(d.parcels.every(isFinal), 'todos os pacotes têm resultado final');
  assert.notEqual(d.phase, 'CONCLUIDA', 'ainda falta um entregador terminar');
  assert.ok(!d.events.some((e) => /Jornada encerrada|concluído/i.test(e) && !/Você concluiu|setor/.test(e)), d.events.join(' | '));
  d.update(22.01, 0.01);
  assert.notEqual(d.phase, 'CONCLUIDA');
  d.couriers[1]!.state = 'complete';
  d.update(22.02, 0.01);
  assert.equal(d.phase, 'CONCLUIDA', 'só depois que os quatro terminam');
  assert.ok(d.events.some((e) => /Expediente concluído/.test(e)));
});
