import test from 'node:test';
import assert from 'node:assert/strict';
import { CAREER_IDS, CHARACTERS, DEFAULT_CAREER, buildRoster, type CareerId } from '../src/core/career/careers.ts';
import {
  SAVE_FORMAT, SAVE_SCHEMA_VERSION, SaveError, canonicalJson, captureParcels, checksumOf, chooseStartingVehicle,
  customize, defaultProfile, emptyShift, parseSave, sealSave, shiftIdOf, type CareerSave,
} from '../src/core/career/snapshot.ts';
import {
  ACTIVE_CAREER_KEY, CareerSession, CareerStore, MemoryStorage, previousKey, saveKey,
} from '../src/core/career/careerStore.ts';
import { CALENDAR_STORAGE_KEY } from '../src/core/delivery/operatingCalendar.ts';
import { createParcel, advance, move } from '../src/core/delivery/parcels.ts';

const fresh = () => { const storage = new MemoryStorage(); return { storage, store: new CareerStore(storage) }; };
const reparse = (s: CareerSave) => JSON.parse(canonicalJson(s)) as Record<string, unknown>;
const tamper = (s: CareerSave, f: (o: any) => void): any => { const o = reparse(s); f(o); return o; };

test('B1-01 F1 AC-01: perfis padrão independentes, sem dados mutáveis compartilhados', () => {
  const profiles = CAREER_IDS.map((c) => defaultProfile(c));
  for (const p of profiles) {
    assert.ok(Object.isFrozen(p));
    assert.equal(p.homeId, CHARACTERS[p.careerId].homeId);
    assert.equal(p.sectorId, CHARACTERS[p.careerId].sector);
    assert.equal(p.vehicle, null, 'veículo ainda não escolhido');
    assert.equal(p.balanceCents, 0); assert.equal(p.experience, 0); assert.equal(p.activeShiftId, null);
  }
  const { store } = fresh();
  const all = store.readAll();
  for (const a of CAREER_IDS) for (const b of CAREER_IDS) if (a !== b) assert.notEqual(all[a].save.profile, all[b].save.profile);
  assert.throws(() => { (profiles[0] as any).balanceCents = 99; }, TypeError);
});

test('B1-01 F1 AC-02: presets masculino/feminino e equipamentos preservados após reiniciar', () => {
  const { storage, store } = fresh();
  for (const id of CAREER_IDS) {
    store.setActiveCareer(id);
    const s = new CareerSession(store);
    const look = CHARACTERS[id].defaultAppearance === 'feminino' ? 'masculino' : 'feminino';
    s.commit(id, (p, sh) => ({ profile: customize(p, { appearance: look, equipment: 'kit-refletivo' }), shift: sh }));
  }
  const reopened = new CareerStore(storage);
  for (const id of CAREER_IDS) {
    const p = reopened.read(id).save.profile;
    assert.notEqual(p.appearance, CHARACTERS[id].defaultAppearance);
    assert.equal(p.equipment, 'kit-refletivo');
  }
  assert.throws(() => customize(defaultProfile(DEFAULT_CAREER), { appearance: 'outro' as any }), SaveError);
  assert.throws(() => customize(defaultProfile(DEFAULT_CAREER), { equipment: 'kit-inexistente' as any }), SaveError);
});

test('B1-01 F1 AC-03 (dados): veículo inicial por carreira, próprio, quitado e fixo', () => {
  const moto = chooseStartingVehicle(defaultProfile('personagem-norte', 3), 'moto-antiga');
  const carro = chooseStartingVehicle(defaultProfile('personagem-sul'), 'carro-antigo');
  assert.deepEqual({ ...moto.vehicle }, { vehicleId: 'veiculo-personagem-norte', kind: 'moto-antiga', owned: true, paidOff: true, chosenOnCalendarIndex: 3 });
  assert.equal(carro.vehicle!.kind, 'carro-antigo');
  assert.throws(() => chooseStartingVehicle(moto, 'carro-antigo'), /permanece fixo/);
  assert.throws(() => chooseStartingVehicle(moto, 'moto-antiga'), /permanece fixo/, 'nem a mesma escolha é repetida');
  assert.throws(() => chooseStartingVehicle(defaultProfile('personagem-sul'), 'patinete' as any), SaveError);
  // Persistido e não transferível: o veículo de uma carreira não valida em outra.
  const forged = tamper(sealSave({ careerId: 'personagem-sul', checkpointSequence: 0, profile: carro, shift: null }), (o) => { o.profile.vehicle.vehicleId = 'veiculo-personagem-norte'; });
  assert.throws(() => parseSave(forged), /Veículo pertence a outra carreira/);
});

test('B1-01 F1 schema: envelope versionado, checksum determinístico e ida/volta exata', () => {
  const save = sealSave({ careerId: 'personagem-leste', checkpointSequence: 4, profile: defaultProfile('personagem-leste', 9), shift: null });
  assert.equal(save.format, SAVE_FORMAT); assert.equal(save.schemaVersion, SAVE_SCHEMA_VERSION); assert.equal(SAVE_SCHEMA_VERSION, 1);
  assert.match(save.checksum, /^fnv1a32:[0-9a-f]{8}$/);
  const back = parseSave(JSON.parse(canonicalJson(save)));
  assert.deepEqual(back, save);
  assert.equal(canonicalJson(back), canonicalJson(save));
  // Ordem das chaves não muda o checksum.
  const { checksum, ...body } = save;
  const reordered = Object.fromEntries(Object.entries(body).reverse()) as typeof body;
  assert.equal(checksumOf(reordered), checksum);
  assert.ok(Object.isFrozen(back.profile));
});

test('B1-01 F1 schema: rejeita versão futura/antiga, corrupção e dados de outra carreira', () => {
  const save = sealSave({ careerId: 'personagem-norte', checkpointSequence: 1, profile: defaultProfile('personagem-norte'), shift: null });
  assert.throws(() => parseSave(tamper(save, (o) => { o.schemaVersion = 2; })), /versão futura/);
  assert.throws(() => parseSave(tamper(save, (o) => { o.schemaVersion = 0; })), /não suportada/);
  assert.throws(() => parseSave(tamper(save, (o) => { o.profile.balanceCents = 100000; })), /Checksum inválido/);
  assert.throws(() => parseSave(tamper(save, (o) => { o.format = 'outro'; })), SaveError);
  assert.throws(() => parseSave(reparse(save), 'personagem-sul'), /esperado personagem-sul/);
  // Casa/setor são fixos: mesmo com checksum recalculado, reatribuir é inválido.
  const moved = tamper(save, (o) => { o.profile.sectorId = 'Sul'; delete o.checksum; });
  assert.throws(() => parseSave({ ...moved, checksum: 'x' }), /Casa\/setor/);
  assert.throws(() => sealSave({ careerId: 'personagem-norte', checkpointSequence: 1, profile: defaultProfile('personagem-sul'), shift: null }), /outra carreira/);
  assert.throws(() => parseSave('texto' as unknown), SaveError);
});

test('B1-01 F1 schema: expediente com ID estável, roster fixo, pacotes íntegros e pagamento único', () => {
  const careerId: CareerId = 'personagem-oeste';
  const p = createParcel('J1-001', 'mercearia', 'end-q1-l1', 'ML', 'Oeste', 'NA_LOJA', 'mercearia', 12);
  advance(p, 'COLETADO', 'jogador', 12.2); move(p, 'maos', 'jogador', 12.2);
  const parcels = captureParcels([p]);
  assert.notEqual(parcels[0]!.history, p.history, 'cópia profunda, sem referência ao objeto vivo');
  const shift = { ...emptyShift(careerId, 7), parcels, elapsedVirtualMinutes: 845, phase: 'COLETA' };
  assert.equal(shift.shiftId, shiftIdOf(careerId, 7));
  assert.equal(shift.shiftId, 'personagem-oeste/dia-7', 'ID depende do dia de calendário, não da hora: 00h não cria outro');
  const profile = { ...defaultProfile(careerId, 7), activeShiftId: shift.shiftId };
  const save = sealSave({ careerId, checkpointSequence: 2, profile, shift });
  assert.deepEqual(parseSave(reparse(save)).shift!.parcels[0]!.history.length, p.history.length);
  const reseal = (f: (o: any) => void) => { const o = tamper(save, f); delete o.checksum; return () => sealSave({ careerId, checkpointSequence: 2, profile: o.profile, shift: o.shift }); };
  assert.throws(reseal((o) => { o.shift.parcels.push(o.shift.parcels[0]); }), /duplicado/);
  assert.throws(reseal((o) => { o.shift.parcels[0].state = 'ENTREGUE'; }), /diverge do histórico/);
  assert.throws(reseal((o) => { o.shift.roster.npc1 = 'personagem-oeste'; }), /Roster/);
  assert.throws(reseal((o) => { o.shift.shiftId = 'personagem-oeste/dia-8'; }), /ID do expediente/);
  assert.throws(reseal((o) => { o.profile.activeShiftId = null; }), /não aponta/);
  const pay = (eventId: string) => ({ eventId, shiftId: shift.shiftId, parcelId: 'J1-001', kind: 'ENTREGA', amountCents: 0 });
  assert.doesNotThrow(reseal((o) => { o.shift.payments = [pay('a')]; }));
  assert.throws(reseal((o) => { o.shift.payments = [pay('a'), pay('b')]; }), /Pagamento duplicado/, 'um ID pago no máximo uma vez');
  assert.throws(reseal((o) => { o.shift.payments = [{ ...pay('a'), kind: 'DEVOLUCAO' }]; }), /Tipo de pagamento/, 'devolução não é pagamento');
  assert.throws(reseal((o) => { o.shift.payments = [{ ...pay('a'), parcelId: 'X' }]; }), /desconhecido/);
  assert.throws(() => sealSave({ careerId: 'personagem-norte', checkpointSequence: 0, profile: defaultProfile('personagem-norte'), shift: emptyShift('personagem-oeste', 1) }), SaveError);
  assert.equal(buildRoster(careerId).jogador, shift.roster.jogador);
});

test('B1-01 F1 AC-16 base: sessão grava só a carreira ativa; os três saves inativos ficam byte a byte intactos', () => {
  const { storage, store } = fresh();
  // Os quatro perfis já existem e têm progresso próprio.
  for (const id of CAREER_IDS) store.commit(id, { ...defaultProfile(id, 2), experience: 10 }, null);
  const before = new Map(CAREER_IDS.map((id) => [id, [storage.getItem(saveKey(id)), storage.getItem(previousKey(id))]]));
  const session = new CareerSession(store, 'personagem-leste');
  for (let day = 3; day < 8; day++) session.commit('personagem-leste', (p) => ({ profile: { ...p, calendarIndex: day, experience: p.experience + 5, balanceCents: p.balanceCents + 100 }, shift: null }));
  for (const npc of CAREER_IDS.filter((c) => c !== 'personagem-leste')) {
    assert.deepEqual([storage.getItem(saveKey(npc)), storage.getItem(previousKey(npc))], before.get(npc), `${npc} não foi gravado`);
    assert.throws(() => session.commit(npc, (p, s) => ({ profile: { ...p, balanceCents: 1 }, shift: s })), /não é a carreira ativa/);
    const view = session.peek(npc);
    assert.equal(view.calendarIndex, 2); assert.equal(view.experience, 10);
    assert.throws(() => { (view as any).balanceCents = 5; }, TypeError, 'NPC somente leitura');
  }
  assert.throws(() => session.commit('personagem-leste', (_p, s) => ({ profile: defaultProfile('personagem-sul'), shift: s })), /outra carreira/);
  const leste = new CareerStore(storage).read('personagem-leste').save;
  assert.equal(leste.profile.calendarIndex, 7); assert.equal(leste.profile.experience, 35); assert.equal(leste.checkpointSequence, 5);
});

test('B1-01 F1 isolamento: uma chave por carreira, sequência monotônica e cópia anterior íntegra', () => {
  const { storage, store } = fresh();
  const a = store.commit('personagem-norte', defaultProfile('personagem-norte', 1), null);
  const b = store.commit('personagem-norte', defaultProfile('personagem-norte', 2), null);
  assert.deepEqual([a.checkpointSequence, b.checkpointSequence], [0, 1]);
  assert.equal(parseSave(JSON.parse(storage.getItem(previousKey('personagem-norte'))!)).profile.calendarIndex, 1);
  assert.throws(() => store.write(a), /não é mais novo/, 'checkpoint antigo não sobrescreve o novo');
  assert.deepEqual(storage.keys().filter((k) => k.includes('personagem-')), [saveKey('personagem-norte'), previousKey('personagem-norte')]);
  // Principal corrompido: lê a cópia anterior, e a próxima gravação não a destrói.
  storage.setItem(saveKey('personagem-norte'), '{"quebrado":');
  const r = store.read('personagem-norte');
  assert.equal(r.source, 'anterior'); assert.match(r.problem!, /rejeitado/); assert.equal(r.save.profile.calendarIndex, 1);
  store.commit('personagem-norte', defaultProfile('personagem-norte', 3), null);
  assert.equal(store.read('personagem-norte').save.profile.calendarIndex, 3);
  assert.equal(parseSave(JSON.parse(storage.getItem(previousKey('personagem-norte'))!)).profile.calendarIndex, 1);
  // Falha do armazenamento vira SaveError (o chamador decide), sem perder o save anterior.
  const full = new MemoryStorage(); const s2 = new CareerStore(full);
  s2.commit('personagem-sul', defaultProfile('personagem-sul', 4), null);
  const failing = new CareerStore({ getItem: (k) => full.getItem(k), setItem: () => { throw new Error('QuotaExceededError'); }, removeItem: () => {} });
  assert.throws(() => failing.commit('personagem-sul', defaultProfile('personagem-sul', 5), null), /Falha ao gravar/);
  assert.equal(s2.read('personagem-sul').save.profile.calendarIndex, 4);
});

test('B1-01 F1 migração legada: calendário antigo vira carreira Oeste sem ser apagado', () => {
  const { storage, store } = fresh();
  storage.setItem(CALENDAR_STORAGE_KEY, '9');
  const r = store.read(DEFAULT_CAREER);
  assert.equal(r.source, 'legado'); assert.equal(r.persisted, false); assert.equal(r.save.profile.calendarIndex, 9);
  for (const other of CAREER_IDS.filter((c) => c !== DEFAULT_CAREER)) assert.equal(store.read(other).save.profile.calendarIndex, 0, `${other} não herda o legado`);
  assert.equal(storage.getItem(CALENDAR_STORAGE_KEY), '9', 'leitura não destrói o legado');
  const session = new CareerSession(store);
  assert.equal(session.careerId, DEFAULT_CAREER); assert.equal(session.loadSource, 'legado');
  session.commit(DEFAULT_CAREER, (p, s) => ({ profile: { ...p, calendarIndex: 10 }, shift: s }));
  assert.equal(storage.getItem(CALENDAR_STORAGE_KEY), '10', 'espelho legado para rollback');
  assert.equal(new CareerStore(storage).read(DEFAULT_CAREER).source, 'principal');
  storage.setItem(CALENDAR_STORAGE_KEY, '1');
  assert.equal(new CareerStore(storage).read(DEFAULT_CAREER).save.profile.calendarIndex, 10, 'save novo prevalece sobre o legado');
  const bad = fresh(); bad.storage.setItem(CALENDAR_STORAGE_KEY, 'abc');
  assert.equal(bad.store.read(DEFAULT_CAREER).source, 'novo');
  // Carreira não-Oeste não escreve o índice legado.
  const other = fresh(); new CareerSession(other.store, 'personagem-sul').commit('personagem-sul', (p, s) => ({ profile: { ...p, calendarIndex: 4 }, shift: s }));
  assert.equal(other.storage.getItem(CALENDAR_STORAGE_KEY), null);
});

test('B1-01 F1 AC-17 base: troca de carreira bloqueada com expediente aberto', () => {
  const { storage, store } = fresh();
  assert.equal(store.activeCareer(), DEFAULT_CAREER);
  store.setActiveCareer('personagem-norte');
  assert.equal(storage.getItem(ACTIVE_CAREER_KEY), 'personagem-norte');
  const shift = emptyShift('personagem-norte', 0);
  new CareerSession(store).commit('personagem-norte', (p) => ({ profile: { ...p, activeShiftId: shift.shiftId }, shift }));
  assert.throws(() => store.setActiveCareer('personagem-sul'), /troca de carreira só após finalizar/);
  assert.equal(store.activeCareer(), 'personagem-norte');
  new CareerSession(store).commit('personagem-norte', (p) => ({ profile: { ...p, activeShiftId: null }, shift: null }));
  store.setActiveCareer('personagem-sul');
  assert.equal(store.activeCareer(), 'personagem-sul');
  storage.setItem(ACTIVE_CAREER_KEY, 'lixo');
  assert.equal(store.activeCareer(), DEFAULT_CAREER, 'ponteiro inválido não cria quinto personagem');
});

test('B1-01 F1 AC-21 base: backup reabre a carreira correta; corrompido/versão inválida não sobrescreve', () => {
  const { storage, store } = fresh();
  store.commit('personagem-leste', { ...defaultProfile('personagem-leste', 5), experience: 7 }, null);
  const backup = store.exportBackup('personagem-leste');
  store.commit('personagem-leste', { ...defaultProfile('personagem-leste', 6), experience: 9 }, null);
  const intact = storage.getItem(saveKey('personagem-leste'));
  for (const broken of [backup.slice(0, -5), backup.replace('"experience":7', '"experience":700'), backup.replace('"schemaVersion":1', '"schemaVersion":99'), '[]']) {
    assert.throws(() => store.importBackup(broken), SaveError);
    assert.equal(storage.getItem(saveKey('personagem-leste')), intact, 'save íntegro preservado');
  }
  assert.throws(() => store.importBackup(backup, 'personagem-norte'), /esperado personagem-norte/);
  assert.equal(storage.getItem(saveKey('personagem-norte')), null, 'backup de outra carreira não cria/mistura perfil');
  const restored = store.importBackup(backup, 'personagem-leste');
  assert.equal(restored.profile.calendarIndex, 5); assert.equal(restored.profile.experience, 7);
  assert.equal(restored.checkpointSequence, 2, 'restauração entra como checkpoint novo, sequência não retrocede');
  for (const other of CAREER_IDS.filter((c) => c !== 'personagem-leste')) assert.equal(storage.getItem(saveKey(other)), null);
});
