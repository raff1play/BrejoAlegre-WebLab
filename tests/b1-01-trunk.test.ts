import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAR_TRUNK, CarTrunk, PARCEL_SIZES, SUPPORT_MIN, arrange, arrangeAfterRemoval, insideCompartment, layoutProblem,
  parcelDims, parcelSizeClass, slotsIntersect, supportOf, type Slot,
} from '../src/core/delivery/carTrunk.ts';
import { createParcel, advance, move, restow, ParcelError, type Parcel } from '../src/core/delivery/parcels.ts';
import { LogisticsDay } from '../src/core/delivery/logisticsDay.ts';
import { calendarDay } from '../src/core/delivery/operatingCalendar.ts';
import { SECTORS } from '../src/core/delivery/sectors.ts';
import { rng } from '../src/core/city/traffic.ts';
import {
  SAVE_SCHEMA_VERSION, SaveError, canonicalJson, captureParcels, checksumOf, chooseStartingVehicle, defaultProfile,
  emptyShift, parseSave, sealSave, vehicleIdOf, type CareerProfile,
} from '../src/core/career/snapshot.ts';
import { CareerStore, MemoryStorage, saveKey } from '../src/core/career/careerStore.ts';

/**
 * B1-01 F3 — porta-malas do carro (decisões 7 e 15; AC-06 e AC-07 na parte que cabe à F3).
 * Coleta/base/entrega pelo carro (AC-08–AC-10) são da F4 e NÃO são testadas aqui como prontas.
 */
const VEH = vehicleIdOf('personagem-oeste');
const ctx = { parked: true };
const dimsOf = (p: Parcel) => parcelDims(p.id);
const slotOf = (p: Parcel): Slot => { const s = p.stowage!; return { x: s.x, y: s.y, z: s.z, w: s.w, h: s.h, d: s.d }; };

/** Parcels collected by the player at a store (real transitions), so they are in the hands. */
function collected(n: number, prefix = 'T', hour = 12.5): Parcel[] {
  return Array.from({ length: n }, (_, i) => {
    const p = createParcel(`${prefix}-${String(i + 1).padStart(3, '0')}`, 'farmacia', `end-${i}`, 'LOJA', 'Oeste', 'NA_LOJA', 'farmacia', 12);
    advance(p, 'COLETADO', 'jogador', hour); move(p, 'maos', 'jogador', hour);
    return p;
  });
}
/** Every parcel is in exactly one place, under one holder; the ID set never changes. */
function assertCustody(all: Parcel[], ids: readonly string[], trunk: CarTrunk): void {
  assert.deepEqual(all.map((p) => p.id).sort(), [...ids].sort(), 'nenhum ID perdido ou duplicado');
  assert.equal(new Set(all.map((p) => p.id)).size, all.length);
  for (const p of all) {
    assert.ok(p.place === 'maos' || p.place === 'porta-malas', `${p.id} em ${p.place}`);
    assert.equal(p.holder, 'jogador');
    assert.equal(p.stowage !== null, p.place === 'porta-malas', `${p.id}: slot só no porta-malas`);
  }
  assert.equal(trunk.problem(all), null);
}

test('B1-01 F3: tamanho de cada caixa vem só do ID estável (determinístico) e cabe no porta-malas', () => {
  for (const id of ['J2026-001', 'BA-0001', 'ML-0005']) {
    assert.equal(parcelSizeClass(id), parcelSizeClass(id));
    assert.deepEqual(parcelDims(id), PARCEL_SIZES[parcelSizeClass(id)]);
  }
  const counts = { P: 0, M: 0, G: 0 };
  for (let i = 0; i < 3000; i++) counts[parcelSizeClass(`J${i % 37}-${String(i).padStart(3, '0')}`)]++;
  // Distribuição pretendida 45/40/15 % (calibração de engenharia), com folga de amostra.
  assert.ok(Math.abs(counts.P / 3000 - 0.45) < 0.04 && Math.abs(counts.M / 3000 - 0.40) < 0.04 && Math.abs(counts.G / 3000 - 0.15) < 0.03, JSON.stringify(counts));
  for (const d of Object.values(PARCEL_SIZES)) assert.ok(d.w <= CAR_TRUNK.width && d.h <= CAR_TRUNK.height && d.d <= CAR_TRUNK.depth);
  const litres = CAR_TRUNK.width * CAR_TRUNK.height * CAR_TRUNK.depth * 1000;
  assert.ok(litres > 300 && litres < 360, `volume útil ${litres.toFixed(0)} L`);
});

test('B1-01 F3 AC-07: capacidade calibrada contra a DEMANDA REAL — carga máxima de cada setor e coleta do jogador cabem, sem sobreposição', () => {
  let loads = 0; let worst = 0;
  for (let day = 0; day < 120; day++) {
    if (calendarDay(day).tier === 'folga') continue;
    for (const boundary of ['maximum', undefined] as const) {
      const d = new LogisticsDay({ dayIndex: day, boundary }); d.start(11);
      const groups = [...SECTORS.map((s) => d.parcels.filter((p) => p.sector === s)), d.parcels.filter((p) => p.collector === 'jogador')];
      for (const load of groups) {
        loads++;
        const r = arrange(CAR_TRUNK, [], load.map((p) => ({ id: p.id, dims: dimsOf(p) })));
        assert.deepEqual(r.rejected, [], `dia ${day} ${boundary ?? 'sorteado'}: ${load.length} volumes`);
        assert.equal(layoutProblem(CAR_TRUNK, r.placed), null);
        worst = Math.max(worst, load.reduce((a, p) => a + dimsOf(p).w * dimsOf(p).h * dimsOf(p).d, 0));
      }
    }
  }
  assert.ok(loads > 1000);
  console.log(`# F3 capacidade: ${loads} cargas reais (120 dias, máximo e sorteado), pior volume ${(worst * 1000).toFixed(0)} L de ${(CAR_TRUNK.width * CAR_TRUNK.height * CAR_TRUNK.depth * 1000).toFixed(0)} L`);
});

test('B1-01 F3 AC-06: abrir é obrigatório; carro em movimento recusa; guardar dá a cada ID uma posição física própria', () => {
  const all = collected(6); const ids = all.map((p) => p.id);
  const trunk = new CarTrunk(VEH);
  assert.match(trunk.stow(all, 12.6, ctx).refused!, /Abra o porta-malas/);
  trunk.setOpen(true);
  assert.match(trunk.stow(all, 12.6, { parked: false }).refused!, /estacione/i);
  assert.ok(all.every((p) => p.place === 'maos' && p.state === 'COLETADO'), 'recusa não altera nada');
  const r = trunk.stow(all, 12.6, ctx);
  assert.equal(r.refused, null); assert.deepEqual(r.rejected, []); assert.deepEqual([...r.stowed].sort(), [...ids].sort());
  for (const p of all) {
    assert.equal(p.place, 'porta-malas'); assert.equal(p.state, 'EM_TRANSPORTE', 'coletado vira em transporte ao guardar');
    assert.equal(p.stowage!.vehicleId, VEH); assert.ok(insideCompartment(CAR_TRUNK, slotOf(p)));
    assert.deepEqual(p.history.slice(-2).map((e) => e.operation), ['estado:EM_TRANSPORTE', 'transferência:porta-malas']);
  }
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(!slotsIntersect(slotOf(all[i]!), slotOf(all[j]!)), 'nenhuma caixa atravessa outra');
  assert.equal(trunk.contents(all).length, 6);
  assertCustody(all, ids, trunk);
  // Determinístico: a mesma sequência produz o mesmo arranjo.
  const again = collected(6); const t2 = new CarTrunk(VEH); t2.setOpen(true); t2.stow(again, 12.6, ctx);
  assert.deepEqual(again.map((p) => p.stowage), all.map((p) => p.stowage));
});

test('B1-01 F3 AC-07: sobrecarga é recusada — o excedente fica nas mãos sob custódia válida, nada se perde nem duplica', () => {
  const all = collected(60, 'X'); const ids = all.map((p) => p.id);
  const trunk = new CarTrunk(VEH); trunk.setOpen(true);
  const r = trunk.stow(all, 13, ctx);
  assert.ok(r.stowed.length > 10 && r.rejected.length > 0, `${r.stowed.length} guardados, ${r.rejected.length} recusados`);
  assert.equal(r.stowed.length + r.rejected.length, 60);
  for (const id of r.rejected) {
    const p = all.find((q) => q.id === id)!;
    assert.equal(p.place, 'maos'); assert.equal(p.holder, 'jogador'); assert.equal(p.state, 'COLETADO', 'recusado não muda de estado');
    assert.equal(p.stowage, null);
  }
  assertCustody(all, ids, trunk);
  // Cheio: uma nova tentativa não força caixa nenhuma para dentro.
  const before = canonicalJson(captureParcels(all));
  const again = trunk.stow(all, 13.1, ctx);
  assert.deepEqual(again.stowed, []); assert.equal(canonicalJson(captureParcels(all)), before, 'tentativa sem espaço não altera nada');
  const volume = trunk.contents(all).reduce((a, p) => a + p.stowage!.w * p.stowage!.h * p.stowage!.d, 0);
  assert.ok(volume <= CAR_TRUNK.width * CAR_TRUNK.height * CAR_TRUNK.depth);
});

test('B1-01 F3: arrumação automática — caixas apoiadas, dentro dos limites, sem interpenetração, em sequências aleatórias de guardar/retirar', () => {
  for (let seed = 1; seed <= 120; seed++) {
    const random = rng(seed);
    const all = collected(30, `R${seed}`); const ids = all.map((p) => p.id);
    // Only a few in the hands at a time (as in play), the rest waits "at the store" in the hands list order.
    const trunk = new CarTrunk(VEH); trunk.setOpen(true);
    let hour = 12.5;
    for (let step = 0; step < 25; step++) {
      hour += 0.01;
      const inside = trunk.contents(all);
      if (random() < 0.65 || !inside.length) trunk.stow(all, hour, ctx);
      else {
        const pick = inside[Math.floor(random() * inside.length)]!;
        const out = trunk.take(all, [pick.id], hour, ctx, 1);
        assert.equal(out.refused, null);
        assert.equal(pick.place, 'maos'); assert.equal(pick.stowage, null);
      }
      const slots = trunk.contents(all).map(slotOf);
      for (const s of slots) { assert.ok(insideCompartment(CAR_TRUNK, s)); assert.ok(supportOf(s, slots) >= SUPPORT_MIN - 1e-9, 'caixa apoiada'); }
      assertCustody(all, ids, trunk);
    }
  }
});

test('B1-01 F3: retirar volumes acomoda o restante (gravidade ou nova arrumação) e mantém custódia', () => {
  const all = collected(14, 'S'); const trunk = new CarTrunk(VEH); trunk.setOpen(true);
  trunk.stow(all, 12.7, ctx);
  const inside = trunk.contents(all);
  const bottom = inside.filter((p) => p.stowage!.y === 0 && inside.some((q) => q.stowage!.y > 0 && Math.abs(q.stowage!.y - (p.stowage!.y + p.stowage!.h)) < 1e-4))[0];
  assert.ok(bottom, 'há uma caixa com outra em cima');
  assert.match(trunk.take(all, [bottom!.id], 12.8, ctx, 0).refused!, /Mãos cheias/);
  assert.match(trunk.take(all, ['NAO-EXISTE'], 12.8, ctx, 4).refused!, /não está neste porta-malas/);
  trunk.setOpen(false);
  assert.match(trunk.take(all, [bottom!.id], 12.8, ctx, 4).refused!, /Abra/);
  trunk.setOpen(true);
  const r = trunk.take(all, [bottom!.id], 12.8, ctx, 4);
  assert.deepEqual(r.taken, [bottom!.id]);
  assert.equal(bottom!.place, 'maos'); assert.equal(bottom!.state, 'EM_TRANSPORTE');
  assert.equal(trunk.problem(all), null, 'nenhuma caixa ficou flutuando');
});

test('B1-01 F3: transições de custódia do porta-malas — só pelas mãos, só com posição, nunca direto ao destinatário', () => {
  const [p] = collected(1, 'C');
  assert.throws(() => move(p!, 'porta-malas', 'jogador', 13), /obrigatória/);
  assert.throws(() => move(p!, 'bau', 'jogador', 13, null, { compartment: 'porta-malas', vehicleId: VEH, x: 0, y: 0, z: 0, w: 0.22, h: 0.09, d: 0.15 }), /só vale no porta-malas/);
  const trunk = new CarTrunk(VEH); trunk.setOpen(true); trunk.stow([p!], 13, ctx);
  assert.throws(() => move(p!, 'destinatario', 'destinatario', 13), ParcelError);
  assert.throws(() => move(p!, 'recebimento', 'jogador', 13, { x: 0, y: 0, z: 0 }), ParcelError);
  assert.throws(() => restow(p!, { ...p!.stowage!, vehicleId: 'veiculo-personagem-norte' }, 'jogador', 13), /outra custódia\/veículo/);
  // Moto: o baú continua exatamente como antes (sem posição de porta-malas).
  const [m] = collected(1, 'M'); advance(m!, 'EM_TRANSPORTE', 'jogador', 13); move(m!, 'bau', 'jogador', 13);
  assert.equal(m!.place, 'bau'); assert.equal(m!.stowage, null);
  // Volume de outro entregador nas mãos dele não entra no porta-malas do jogador.
  const other = createParcel('N-1', 'padaria', 'x', 'LOJA', 'Norte', 'NA_LOJA', 'padaria', 12);
  advance(other, 'COLETADO', 'npc1', 12.5); move(other, 'maos', 'npc1', 12.5);
  assert.equal(trunk.stow([other], 13, ctx).refused, 'Nenhum volume nas mãos');
  assert.equal(other.place, 'maos'); assert.equal(other.holder, 'npc1');
});

// ------------------------------------------------------------------ persistência estrutural (preparação F6)

function carProfile(day = 0): CareerProfile {
  return { ...chooseStartingVehicle(defaultProfile('personagem-oeste', day), 'carro-antigo'), activeShiftId: `personagem-oeste/dia-${day}` };
}
function shiftWith(parcels: Parcel[], day = 0) { return { ...emptyShift('personagem-oeste', day), parcels: captureParcels(parcels) }; }
const reseal = (o: any) => { delete o.checksum; return { ...o, checksum: checksumOf(o) }; };

test('B1-01 F3 persistência: snapshot v2 guarda e restaura cada posição de carga exatamente; layout reconstruído é idêntico', () => {
  const all = collected(12, 'P'); const trunk = new CarTrunk(VEH); trunk.setOpen(true); trunk.stow(all, 12.9, ctx);
  const save = sealSave({ careerId: 'personagem-oeste', checkpointSequence: 1, profile: carProfile(), shift: shiftWith(all) });
  assert.equal(save.schemaVersion, SAVE_SCHEMA_VERSION); assert.equal(SAVE_SCHEMA_VERSION, 2);
  const back = parseSave(JSON.parse(canonicalJson(save)));
  assert.deepEqual(back.shift!.parcels.map((p) => p.stowage), all.map((p) => p.stowage));
  // Rebuild live parcels from the save and check the boot is the same, physically valid one.
  const restored = back.shift!.parcels.map((r) => ({ ...r, collector: r.collector ?? undefined, sector: r.sector ?? undefined, history: r.history.map((e) => ({ ...e })), stowage: r.stowage ? { ...r.stowage } : null })) as unknown as Parcel[];
  const t2 = new CarTrunk(VEH);
  assert.equal(t2.problem(restored), null);
  assert.deepEqual(t2.contents(restored).map((p) => [p.id, p.stowage]), trunk.contents(all).map((p) => [p.id, p.stowage]));
  // Pelo CareerStore real: grava, relê e mantém as posições.
  const storage = new MemoryStorage(); const store = new CareerStore(storage);
  store.commit('personagem-oeste', carProfile(), shiftWith(all), -1);
  assert.deepEqual(store.read('personagem-oeste').save.shift!.parcels.map((p) => p.stowage), all.map((p) => p.stowage));
});

test('B1-01 F3 persistência: save com carga fisicamente impossível ou incoerente é rejeitado mesmo com checksum válido', () => {
  const all = collected(5, 'Q'); const trunk = new CarTrunk(VEH); trunk.setOpen(true); trunk.stow(all, 12.9, ctx);
  const good = sealSave({ careerId: 'personagem-oeste', checkpointSequence: 1, profile: carProfile(), shift: shiftWith(all) });
  const bad = (f: (o: any) => void) => { const o = JSON.parse(canonicalJson(good)); f(o); return reseal(o); };
  const st = (o: any, i = 0) => o.shift.parcels[i].stowage;
  assert.throws(() => parseSave(bad((o) => { Object.assign(st(o, 1), { x: st(o, 0).x, y: st(o, 0).y, z: st(o, 0).z, w: st(o, 0).w, h: st(o, 0).h, d: st(o, 0).d }); })), /se atravessando|dimensões/);
  assert.throws(() => parseSave(bad((o) => { st(o).x = 2; })), /fora dos limites/);
  assert.throws(() => parseSave(bad((o) => { st(o).w = 0.9; })), /dimensões/);
  assert.throws(() => parseSave(bad((o) => { st(o).y = 0.2; })), /sem apoio/);
  assert.throws(() => parseSave(bad((o) => { st(o).vehicleId = vehicleIdOf('personagem-norte'); })), /outro veículo/);
  assert.throws(() => parseSave(bad((o) => { o.shift.parcels[0].stowage = null; })), /inconsistente/);
  assert.throws(() => parseSave(bad((o) => { o.shift.parcels[0].holder = 'npc1'; })), /outra custódia/);
  assert.throws(() => parseSave(bad((o) => { o.profile.vehicle.kind = 'moto-antiga'; })), /sem carro próprio/);
  // Pacote fora do porta-malas não pode carregar posição de carga.
  const loose = collected(1, 'L');
  const withSlot = (o: any) => { o.shift.parcels.push({ ...captureParcels(loose)[0], stowage: { ...st(o) } }); };
  assert.throws(() => parseSave(bad(withSlot)), /inconsistente/);
  assert.doesNotThrow(() => parseSave(JSON.parse(canonicalJson(good))));
});

test('B1-01 F3 migração: save v1 (F1/F2, como o laboratório publicado) abre na v2 sem perder dados; v1 adulterado é recusado', () => {
  const parcel = collected(1, 'V')[0]!;
  // A v1 body, byte-for-byte as F2 wrote it: no `stowage` field, checksum over the v1 content.
  const v1Parcel = (() => { const { stowage: _s, ...rest } = captureParcels([parcel])[0]!; return rest; })();
  const profile = carProfile(3);
  const body = { format: 'brejo-alegre-carreira', schemaVersion: 1, careerId: 'personagem-oeste', checkpointSequence: 7, profile, shift: { ...emptyShift('personagem-oeste', 3), parcels: [v1Parcel] } };
  const v1 = { ...body, checksum: checksumOf(body as any) };
  const migrated = parseSave(JSON.parse(JSON.stringify(v1)));
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.checkpointSequence, 7); assert.deepEqual({ ...migrated.profile }, { ...profile });
  assert.equal(migrated.shift!.parcels[0]!.stowage, null);
  assert.deepEqual({ ...migrated.shift!.parcels[0]!, stowage: undefined }, { ...v1Parcel, stowage: undefined });
  assert.equal(migrated.checksum, checksumOf((({ checksum: _c, ...b }) => b)(migrated) as any), 'checksum do conteúdo migrado');
  // Perfil sem expediente (o caso real do laboratório F2) também migra.
  const bare = { format: 'brejo-alegre-carreira', schemaVersion: 1, careerId: 'personagem-oeste', checkpointSequence: 2, profile: chooseStartingVehicle(defaultProfile('personagem-oeste'), 'carro-antigo'), shift: null };
  assert.equal(parseSave({ ...bare, checksum: checksumOf(bare as any) }).schemaVersion, 2);
  // Adulterar a v1 (checksum antigo não confere) é recusado ANTES da migração.
  assert.throws(() => parseSave({ ...v1, checkpointSequence: 8 }), /Checksum inválido/);
  // Pelo store: o save v1 gravado continua legível, e o próximo checkpoint sai em v2 sem retroceder.
  const storage = new MemoryStorage(); storage.setItem(saveKey('personagem-oeste'), JSON.stringify(v1));
  const store = new CareerStore(storage);
  const read = store.read('personagem-oeste');
  assert.equal(read.source, 'principal'); assert.equal(read.save.checkpointSequence, 7);
  assert.equal(JSON.parse(storage.getItem(saveKey('personagem-oeste'))!).schemaVersion, 1, 'ler não reescreve o save');
  const next = store.commit('personagem-oeste', read.save.profile, read.save.shift, 7);
  assert.equal(next.checkpointSequence, 8); assert.equal(JSON.parse(storage.getItem(saveKey('personagem-oeste'))!).schemaVersion, 2);
  assert.throws(() => parseSave({ ...v1, schemaVersion: SAVE_SCHEMA_VERSION + 1 }), SaveError);
});

test('B1-01 F3: arranjo após retirada nunca devolve caixas sobrepostas (validação do resultado)', () => {
  const boxes = collected(18, 'W').map((p) => ({ id: p.id, dims: dimsOf(p) }));
  const full = arrange(CAR_TRUNK, [], boxes);
  for (let i = 0; i < full.placed.length; i++) {
    const rest = arrangeAfterRemoval(CAR_TRUNK, full.placed, new Set([full.placed[i]!.box.id]));
    assert.ok(rest); assert.equal(layoutProblem(CAR_TRUNK, rest!.placed), null);
    assert.equal(rest!.placed.length, full.placed.length - 1);
  }
});
