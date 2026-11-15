import test from 'node:test';
import assert from 'node:assert/strict';
import { CAREER_IDS, CHARACTERS, careerHome, type CareerId } from '../src/core/career/careers.ts';
import { enterCareer, menuModel } from '../src/core/career/careerMenu.ts';
import { ACTIVE_CAREER_KEY, CareerStore, MemoryStorage, previousKey, saveKey } from '../src/core/career/careerStore.ts';
import { chooseStartingVehicle, defaultProfile, emptyShift, shiftIdOf, SaveError } from '../src/core/career/snapshot.ts';
import { CALENDAR_STORAGE_KEY } from '../src/core/delivery/operatingCalendar.ts';
import { EQUIPMENT_LOOK, careerLook } from '../src/features/career/characterPresets.ts';

/** B1-01 F3.5 — menu principal, quatro carreiras, presets e veículo (AC-01/02/03/16/17, parte da F3.5). */
const dump = (s: MemoryStorage): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const k of ['brejo-b1:carreira-ativa', CALENDAR_STORAGE_KEY, ...CAREER_IDS.flatMap((id) => [saveKey(id), previousKey(id)])]) {
    const v = s.getItem(k); if (v !== null) out[k] = v;
  }
  return out;
};
const keysOf = (s: MemoryStorage) => Object.keys(dump(s)).length;

test('B1-01 F3.5 AC-01: menu mostra exatamente os quatro personagens, setores e casas distintos, sem escrever nada', () => {
  const storage = new MemoryStorage();
  const m = menuModel(storage);
  assert.equal(keysOf(storage), 0, 'abrir o menu não cria saves');
  assert.deepEqual(m.cards.map((c) => c.careerId), [...CAREER_IDS]);
  assert.deepEqual(m.cards.map((c) => c.name), ['Rosa', 'Lia', 'Caio', 'Davi']);
  assert.equal(new Set(m.cards.map((c) => c.sector)).size, 4);
  assert.equal(new Set(m.cards.map((c) => c.homeId)).size, 4);
  for (const c of m.cards) {
    assert.equal(c.homeStreet, careerHome(c.careerId).street);
    assert.equal(c.vehicle, null); assert.equal(c.saved, false); assert.equal(c.checkpoint, null);
    assert.equal(c.balanceCents, null, 'sem save não se inventa saldo');
    assert.equal(c.blocked, null);
  }
  assert.equal(m.active, 'personagem-oeste'); assert.equal(m.lockedBy, null);
});

test('B1-01 F3.5: calendário legado aparece no card Oeste por leitura pura; entrar migra sem apagar a chave antiga', () => {
  const storage = new MemoryStorage(); storage.setItem(CALENDAR_STORAGE_KEY, '4');
  const before = dump(storage);
  const m = menuModel(storage);
  const oeste = m.cards.find((c) => c.careerId === 'personagem-oeste')!;
  assert.equal(oeste.calendarIndex, 4); assert.equal(oeste.source, 'legado'); assert.equal(oeste.saved, false);
  assert.deepEqual(dump(storage), before, 'ver o menu não migra nem grava');
  const boot = enterCareer(storage, 'personagem-oeste', { appearance: 'feminino', equipment: 'kit-jaqueta', vehicle: 'moto-antiga' });
  assert.equal(boot.calendarIndex, 4);
  assert.equal(storage.getItem(CALENDAR_STORAGE_KEY), '4', 'chave legada preservada');
  const saved = new CareerStore(storage).read('personagem-oeste').save;
  assert.equal(saved.profile.calendarIndex, 4); assert.equal(saved.profile.vehicle!.kind, 'moto-antiga');
});

test('B1-01 F3.5 AC-02/03/16: cada carreira grava aparência, equipamento e veículo só no PRÓPRIO save; as outras ficam byte a byte intactas', () => {
  const storage = new MemoryStorage();
  const plan: Record<CareerId, { appearance: 'masculino' | 'feminino'; equipment: 'kit-jaqueta' | 'kit-refletivo'; vehicle: 'moto-antiga' | 'carro-antigo' }> = {
    'personagem-norte': { appearance: 'masculino', equipment: 'kit-refletivo', vehicle: 'carro-antigo' },
    'personagem-oeste': { appearance: 'feminino', equipment: 'kit-refletivo', vehicle: 'moto-antiga' },
    'personagem-leste': { appearance: 'feminino', equipment: 'kit-jaqueta', vehicle: 'carro-antigo' },
    'personagem-sul': { appearance: 'masculino', equipment: 'kit-jaqueta', vehicle: 'moto-antiga' },
  };
  for (const id of CAREER_IDS) {
    const others = CAREER_IDS.filter((o) => o !== id).map((o) => [storage.getItem(saveKey(o)), storage.getItem(previousKey(o))]);
    const boot = enterCareer(storage, id, plan[id]);
    assert.equal(boot.session.careerId, id); assert.equal(boot.roster.jogador, id);
    assert.equal(new Set(Object.values(boot.roster)).size, 4, 'três NPCs, nenhum quinto ator');
    assert.deepEqual(CAREER_IDS.filter((o) => o !== id).map((o) => [storage.getItem(saveKey(o)), storage.getItem(previousKey(o))]), others, 'saves inativos intactos');
    assert.equal(storage.getItem(ACTIVE_CAREER_KEY), id);
  }
  const m = menuModel(storage);
  for (const c of m.cards) {
    assert.equal(c.appearance, plan[c.careerId].appearance); assert.equal(c.equipment, plan[c.careerId].equipment);
    assert.equal(c.vehicle, plan[c.careerId].vehicle); assert.equal(c.saved, true); assert.equal(c.balanceCents, 0);
    assert.equal(c.calendarIndex, 0, 'NPCs não avançam o calendário de ninguém');
  }
});

test('B1-01 F3.5 AC-03: veículo fica fixo — outra escolha é recusada sem gravar; presets mudam; sem mudança não há checkpoint novo', () => {
  const storage = new MemoryStorage();
  enterCareer(storage, 'personagem-leste', { appearance: 'masculino', equipment: 'kit-jaqueta', vehicle: 'carro-antigo' });
  const before = storage.getItem(saveKey('personagem-leste'));
  assert.throws(() => enterCareer(storage, 'personagem-leste', { appearance: 'masculino', equipment: 'kit-jaqueta', vehicle: 'moto-antiga' }), /permanece fixo/);
  assert.equal(storage.getItem(saveKey('personagem-leste')), before, 'recusa não grava');
  const same = enterCareer(storage, 'personagem-leste', { appearance: 'masculino', equipment: 'kit-jaqueta', vehicle: null });
  assert.equal(same.session.save.checkpointSequence, 0); assert.equal(storage.getItem(saveKey('personagem-leste')), before, 'nada mudou, nada gravado');
  const changed = enterCareer(storage, 'personagem-leste', { appearance: 'feminino', equipment: 'kit-refletivo', vehicle: 'carro-antigo' });
  assert.equal(changed.session.profile.appearance, 'feminino'); assert.equal(changed.session.profile.equipment, 'kit-refletivo');
  assert.equal(changed.session.profile.vehicle!.kind, 'carro-antigo'); assert.equal(changed.session.save.checkpointSequence, 1);
  assert.throws(() => enterCareer(new MemoryStorage(), 'personagem-sul', { appearance: 'masculino', equipment: 'kit-jaqueta', vehicle: null }), /Escolha o veículo/);
  assert.throws(() => enterCareer(storage, 'personagem-sul', { appearance: 'robô' as any, equipment: 'kit-jaqueta', vehicle: 'moto-antiga' }), SaveError);
  assert.throws(() => enterCareer(storage, 'personagem-quinto' as any, { appearance: 'masculino', equipment: 'kit-jaqueta', vehicle: 'moto-antiga' }), /Carreira inválida/);
});

test('B1-01 F3.5 AC-17: expediente aberto bloqueia as outras carreiras e permite continuar a mesma, sem reiniciar dia/expediente', () => {
  const storage = new MemoryStorage(); const store = new CareerStore(storage);
  const profile = { ...chooseStartingVehicle(defaultProfile('personagem-norte', 3), 'moto-antiga'), activeShiftId: shiftIdOf('personagem-norte', 3) };
  store.commit('personagem-norte', profile, { ...emptyShift('personagem-norte', 3), elapsedVirtualMinutes: 200 }, -1);
  store.setActiveCareer('personagem-norte');
  const before = dump(storage);
  const m = menuModel(storage);
  assert.equal(m.lockedBy, 'personagem-norte');
  for (const c of m.cards) {
    if (c.careerId === 'personagem-norte') { assert.equal(c.blocked, null); assert.equal(c.activeShiftId, 'personagem-norte/dia-3'); }
    else assert.match(c.blocked!, /Expediente aberto de Rosa/);
  }
  assert.throws(() => enterCareer(storage, 'personagem-sul', { appearance: 'masculino', equipment: 'kit-jaqueta', vehicle: 'moto-antiga' }), /troca de carreira só após finalizar/);
  assert.deepEqual(dump(storage), before, 'troca recusada não grava nada');
  const boot = enterCareer(storage, 'personagem-norte', { appearance: 'feminino', equipment: 'kit-jaqueta', vehicle: null });
  assert.equal(boot.calendarIndex, 3); assert.equal(boot.session.profile.activeShiftId, 'personagem-norte/dia-3');
  assert.equal(boot.session.save.shift!.elapsedVirtualMinutes, 200, 'expediente preservado');
});

test('B1-01 F3.5: save inválido aparece com o erro real e não é resetado; cópia anterior íntegra é usada com aviso', () => {
  const storage = new MemoryStorage();
  enterCareer(storage, 'personagem-sul', { appearance: 'masculino', equipment: 'kit-jaqueta', vehicle: 'moto-antiga' });
  storage.setItem(saveKey('personagem-sul'), '{"lixo":');
  const corrupt = dump(storage);
  let card = menuModel(storage).cards.find((c) => c.careerId === 'personagem-sul')!;
  assert.match(card.blocked!, /Save inválido/); assert.match(card.problem!, /JSON inválido/); assert.equal(card.saved, false);
  assert.throws(() => enterCareer(storage, 'personagem-sul', { appearance: 'masculino', equipment: 'kit-jaqueta', vehicle: 'moto-antiga' }), /Save inválido de Davi/);
  assert.deepEqual(dump(storage), corrupt, 'nenhum reset silencioso');
  // With an intact previous copy the career stays playable, and the problem is shown.
  enterCareer(storage, 'personagem-leste', { appearance: 'masculino', equipment: 'kit-jaqueta', vehicle: 'moto-antiga' });
  enterCareer(storage, 'personagem-leste', { appearance: 'feminino', equipment: 'kit-jaqueta', vehicle: null });
  storage.setItem(saveKey('personagem-leste'), 'x');
  card = menuModel(storage).cards.find((c) => c.careerId === 'personagem-leste')!;
  assert.equal(card.blocked, null); assert.equal(card.saved, true); assert.equal(card.source, 'anterior'); assert.match(card.problem!, /rejeitado/);
});

test('B1-01 F3.5 AC-02: presets viram a aparência real do avatar (mesmo mapeamento para pedestre, piloto e motorista)', () => {
  const looks = (['masculino', 'feminino'] as const).flatMap((a) => (['kit-jaqueta', 'kit-refletivo'] as const).map((e) => careerLook(a, e)));
  assert.equal(new Set(looks.map((l) => JSON.stringify(l))).size, 4, 'as quatro combinações são visualmente diferentes');
  assert.equal(careerLook('feminino', 'kit-jaqueta').figure, 'feminino');
  assert.equal(careerLook('masculino', 'kit-refletivo').figure, 'masculino');
  assert.equal(careerLook('masculino', 'kit-jaqueta').vest, undefined, 'jaqueta sem colete');
  assert.equal(careerLook('masculino', 'kit-refletivo').vest, EQUIPMENT_LOOK['kit-refletivo'].vest);
  assert.notEqual(careerLook('masculino', 'kit-jaqueta').helmet, careerLook('masculino', 'kit-refletivo').helmet);
  for (const id of CAREER_IDS) assert.ok(CHARACTERS[id].defaultAppearance && CHARACTERS[id].defaultEquipment);
});
