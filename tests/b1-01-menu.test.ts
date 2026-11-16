import test from 'node:test';
import assert from 'node:assert/strict';
import { CAREER_IDS, CHARACTERS, careerHome, type CareerId } from '../src/core/career/careers.ts';
import { ActivationError, enterCareer, mainScreen, menuModel } from '../src/core/career/careerMenu.ts';
import { ACTIVE_CAREER_KEY, CareerStore, MemoryStorage, previousKey, saveKey } from '../src/core/career/careerStore.ts';
import { chooseStartingVehicle, defaultProfile, emptyShift, shiftHourOf, shiftIdOf, SaveError } from '../src/core/career/snapshot.ts';
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
  store.commit('personagem-norte', profile, { ...emptyShift('personagem-norte', 3), elapsedVirtualMinutes: 200, shiftHour: shiftHourOf(200) }, -1);
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

// ------------------------------------------------------------------ auditoria F3.5 (comentário 6903050464)

/** Storage that refuses to write one key (disk full, quota, private mode…). */
class FailingStorage extends MemoryStorage {
  failKey: string | null = null;
  override setItem(key: string, value: string): void {
    if (key === this.failKey) throw new Error(`falha simulada ao gravar ${key}`);
    super.setItem(key, value);
  }
}
/** Oeste active and saved; Leste saved twice (main + previous copy, car chosen). */
function oesteActiveLesteSaved(storage: MemoryStorage): void {
  enterCareer(storage, 'personagem-leste', { appearance: 'masculino', equipment: 'kit-jaqueta', vehicle: 'carro-antigo' });
  enterCareer(storage, 'personagem-leste', { appearance: 'feminino', equipment: 'kit-jaqueta', vehicle: null });
  enterCareer(storage, 'personagem-oeste', { appearance: 'feminino', equipment: 'kit-jaqueta', vehicle: 'moto-antiga' });
  assert.equal(storage.getItem(ACTIVE_CAREER_KEY), 'personagem-oeste');
  assert.ok(storage.getItem(previousKey('personagem-leste')), 'Leste tem cópia anterior');
}

test('B1-01 F3.5 auditoria (a): veículo incompatível com o salvo falha SEM trocar a carreira ativa nem tocar em save algum', () => {
  const storage = new MemoryStorage(); oesteActiveLesteSaved(storage);
  const before = dump(storage);
  assert.throws(() => enterCareer(storage, 'personagem-leste', { appearance: 'masculino', equipment: 'kit-refletivo', vehicle: 'moto-antiga' }), /permanece fixo/);
  assert.deepEqual(dump(storage), before, 'carreira ativa, saves, cópias anteriores e calendário intactos');
  assert.equal(storage.getItem(ACTIVE_CAREER_KEY), 'personagem-oeste');
});

test('B1-01 F3.5 auditoria (b): falha ao gravar o save de Leste não troca a carreira ativa nem altera saves/cópias anteriores', () => {
  const storage = new FailingStorage(); oesteActiveLesteSaved(storage);
  const before = dump(storage);
  storage.failKey = saveKey('personagem-leste');
  assert.throws(() => enterCareer(storage, 'personagem-leste', { appearance: 'masculino', equipment: 'kit-refletivo', vehicle: null }), /falha simulada/);
  assert.deepEqual(dump(storage), before, 'nada mudou, inclusive a cópia anterior de Leste');
  assert.equal(storage.getItem(ACTIVE_CAREER_KEY), 'personagem-oeste');
  // Carreira nova (sem save) que não consegue ser gravada: também nada muda.
  storage.failKey = saveKey('personagem-sul');
  assert.throws(() => enterCareer(storage, 'personagem-sul', { appearance: 'masculino', equipment: 'kit-jaqueta', vehicle: 'moto-antiga' }), /falha simulada/);
  assert.deepEqual(dump(storage), before);
  // Depois que o armazenamento volta a funcionar, a mesma escolha entra normalmente.
  storage.failKey = null;
  const ok = enterCareer(storage, 'personagem-leste', { appearance: 'masculino', equipment: 'kit-refletivo', vehicle: null });
  assert.equal(ok.session.careerId, 'personagem-leste'); assert.equal(storage.getItem(ACTIVE_CAREER_KEY), 'personagem-leste');
  assert.equal(new CareerStore(storage).read('personagem-leste').save.profile.equipment, 'kit-refletivo');
  assert.equal(new CareerStore(storage).read('personagem-leste').save.profile.vehicle!.kind, 'carro-antigo');
  for (const id of ['personagem-oeste', 'personagem-norte', 'personagem-sul'] as const) {
    assert.equal(storage.getItem(saveKey(id)), before[saveKey(id)] ?? null); assert.equal(storage.getItem(previousKey(id)), before[previousKey(id)] ?? null);
  }
});

test('B1-01 F3.5 auditoria: calendário legado Oeste — falha de gravação não migra nem ativa; sucesso migra sem apagar a chave antiga', () => {
  const storage = new FailingStorage(); storage.setItem(CALENDAR_STORAGE_KEY, '5');
  const before = dump(storage);
  storage.failKey = saveKey('personagem-oeste');
  assert.throws(() => enterCareer(storage, 'personagem-oeste', { appearance: 'feminino', equipment: 'kit-jaqueta', vehicle: 'moto-antiga' }), /falha simulada/);
  assert.deepEqual(dump(storage), before, 'só a chave legada continua lá, intacta');
  storage.failKey = null;
  const boot = enterCareer(storage, 'personagem-oeste', { appearance: 'feminino', equipment: 'kit-jaqueta', vehicle: 'moto-antiga' });
  assert.equal(boot.calendarIndex, 5); assert.equal(storage.getItem(CALENDAR_STORAGE_KEY), '5');
  // Oeste is the default career: without a stored pointer `activeCareer()` already answers Oeste.
  assert.equal(new CareerStore(storage).activeCareer(), 'personagem-oeste');
  assert.ok(boot.notes.some((n) => /legado/i.test(n)));
});

test('B1-01 F3.5 auditoria: falha ao gravar o apontador ativo depois do save deixa a carreira anterior ativa', () => {
  const storage = new FailingStorage(); oesteActiveLesteSaved(storage);
  storage.failKey = ACTIVE_CAREER_KEY;
  assert.throws(() => enterCareer(storage, 'personagem-norte', { appearance: 'feminino', equipment: 'kit-jaqueta', vehicle: 'moto-antiga' }), /falha simulada/);
  assert.equal(storage.getItem(ACTIVE_CAREER_KEY), 'personagem-oeste');
  // O perfil de Norte pode ter sido gravado (dado válido da escolha), mas o jogo continua apontando para Oeste.
  assert.equal(menuModel(storage).active, 'personagem-oeste');
});

// ------------------------------------------------------------------ F3.5.1: tela principal

const pick = (appearance: 'masculino' | 'feminino' = 'masculino', vehicle: 'moto-antiga' | 'carro-antigo' | null = 'moto-antiga') => ({ appearance, equipment: 'kit-jaqueta' as const, vehicle });

test('B1-01 F3.5.1: armazenamento vazio — Continuar indisponível (nunca inicia Oeste sozinho), Novo jogo com os quatro, Carregar sem nada carregável, sem escrita', () => {
  const storage = new MemoryStorage();
  const m = mainScreen(menuModel(storage));
  assert.equal(keysOf(storage), 0);
  assert.equal(m.continueCard, null); assert.match(m.continueReason!, /Nenhuma carreira salva ativa/);
  assert.deepEqual(m.newGame.map((c) => c.careerId), [...CAREER_IDS]); assert.equal(m.newGameReason, null);
  assert.ok(m.load.every((l) => /Novo jogo/.test(l.reason!)));
});

test('B1-01 F3.5.1: Novo jogo só lista personagens sem save; com os quatro ocupados não há slot e nada é sobrescrito', () => {
  const storage = new MemoryStorage();
  enterCareer(storage, 'personagem-leste', pick('feminino', 'carro-antigo'));
  let m = mainScreen(menuModel(storage));
  assert.deepEqual(m.newGame.map((c) => c.careerId), ['personagem-norte', 'personagem-oeste', 'personagem-sul']);
  assert.equal(m.continueCard!.careerId, 'personagem-leste', 'Continuar = a carreira ativa salva');
  assert.equal(m.load.find((l) => l.card.careerId === 'personagem-leste')!.reason, null);
  for (const id of ['personagem-norte', 'personagem-oeste', 'personagem-sul'] as const) enterCareer(storage, id, pick());
  const before = dump(storage);
  m = mainScreen(menuModel(storage));
  assert.deepEqual(m.newGame, []); assert.match(m.newGameReason!, /não há personagem livre/);
  assert.ok(m.load.every((l) => l.reason === null));
  assert.deepEqual(dump(storage), before, 'calcular a tela não grava');
});

test('B1-01 F3.5.1: calendário legado e save corrompido não aparecem como personagem livre (nunca sobrescritos por Novo jogo)', () => {
  const storage = new MemoryStorage(); storage.setItem(CALENDAR_STORAGE_KEY, '2'); storage.setItem(saveKey('personagem-sul'), '{');
  const m = mainScreen(menuModel(storage));
  assert.deepEqual(m.newGame.map((c) => c.careerId), ['personagem-norte', 'personagem-leste']);
  assert.equal(m.continueCard, null, 'calendário legado sem save não vira Continuar automático');
  const oeste = m.load.find((l) => l.card.careerId === 'personagem-oeste')!;
  assert.equal(oeste.reason, null, 'o Oeste legado é carregável');
  assert.match(m.load.find((l) => l.card.careerId === 'personagem-sul')!.reason!, /Save inválido/);
});

test('B1-01 F3.5.1 AC-17: expediente aberto — Continuar abre só a carreira travada; Novo jogo e as outras ficam bloqueados', () => {
  const storage = new MemoryStorage(); const store = new CareerStore(storage);
  const profile = { ...chooseStartingVehicle(defaultProfile('personagem-norte', 3), 'moto-antiga'), activeShiftId: shiftIdOf('personagem-norte', 3) };
  store.commit('personagem-norte', profile, { ...emptyShift('personagem-norte', 3), elapsedVirtualMinutes: 90, shiftHour: shiftHourOf(90) }, -1);
  store.setActiveCareer('personagem-norte');
  const m = mainScreen(menuModel(storage));
  assert.equal(m.continueCard!.careerId, 'personagem-norte'); assert.equal(m.continueCard!.activeShiftId, 'personagem-norte/dia-3');
  assert.ok(m.newGame.every((c) => /Expediente aberto de Rosa/.test(c.blocked!)));
  assert.match(m.newGameReason!, /Expediente aberto de Rosa/);
  assert.ok(m.load.filter((l) => l.card.careerId !== 'personagem-norte').every((l) => l.reason !== null));
});

test('B1-01 F3.5.1: cópia anterior utilizável permite Continuar; carreira ativa com save corrompido sem cópia não', () => {
  const storage = new MemoryStorage();
  enterCareer(storage, 'personagem-sul', pick()); enterCareer(storage, 'personagem-sul', pick('feminino', null));
  storage.setItem(saveKey('personagem-sul'), 'x');
  let m = mainScreen(menuModel(storage));
  assert.equal(m.continueCard!.source, 'anterior');
  storage.removeItem(previousKey('personagem-sul'));
  m = mainScreen(menuModel(storage));
  assert.equal(m.continueCard, null); assert.match(m.continueReason!, /Nenhuma carreira salva ativa/);
});

test('B1-01 F3.5.1 (ressalva da auditoria): perfil gravado mas apontador ativo falhou — erro próprio, mensagem verdadeira, carreira anterior ativa', () => {
  const storage = new FailingStorage(); oesteActiveLesteSaved(storage);
  storage.failKey = ACTIVE_CAREER_KEY;
  let err: unknown = null;
  try { enterCareer(storage, 'personagem-leste', { appearance: 'masculino', equipment: 'kit-refletivo', vehicle: null }); } catch (e) { err = e; }
  assert.ok(err instanceof ActivationError, 'erro de ativação distinto de "não gravado"');
  const a = err as ActivationError;
  assert.equal(a.profileSaved, true); assert.equal(a.careerId, 'personagem-leste'); assert.equal(a.stillActive, 'personagem-oeste');
  assert.match(a.message, /O perfil de Caio foi gravado, mas não foi possível torná-la a carreira ativa/);
  assert.match(a.message, /A carreira ativa continua Lia/);
  assert.equal(new CareerStore(storage).read('personagem-leste').save.profile.equipment, 'kit-refletivo', 'o perfil realmente foi gravado');
  assert.equal(new CareerStore(storage).activeCareer(), 'personagem-oeste');
  assert.equal(mainScreen(menuModel(storage)).continueCard!.careerId, 'personagem-oeste');
  // Other failures keep saying the choice was NOT saved.
  storage.failKey = saveKey('personagem-norte');
  try { enterCareer(storage, 'personagem-norte', pick()); } catch (e) { assert.ok(!(e instanceof ActivationError)); assert.ok(e instanceof SaveError); }
});

// ------------------------------------------------------------------ auditoria F3.5.1 (comentário 6903966725): cópia anterior órfã/inválida

/** A sealed, valid Leste save (to tamper with) as stored text. */
function lesteSaveText(): string {
  const st = new MemoryStorage();
  enterCareer(st, 'personagem-leste', pick('feminino', 'carro-antigo'));
  return st.getItem(saveKey('personagem-leste'))!;
}
const orphanCases: [string, () => string][] = [
  ['JSON inválido', () => '{json-invalido'],
  ['checksum inválido', () => { const o = JSON.parse(lesteSaveText()); o.profile.experience = 99; return JSON.stringify(o); }],
  ['schema incompatível', () => { const o = JSON.parse(lesteSaveText()); o.schemaVersion = 99; return JSON.stringify(o); }],
];

for (const [label, make] of orphanCases) {
  test(`B1-01 F3.5.1 auditoria: só cópia anterior com ${label} (sem principal) — slot OCUPADO por erro, nunca livre; entrar recusado; nada apagado`, () => {
    const storage = new MemoryStorage(); storage.setItem(previousKey('personagem-leste'), make());
    const before = dump(storage);
    const r = new CareerStore(storage).read('personagem-leste');
    assert.equal(r.persisted, false); assert.match(r.problem!, /Cópia anterior rejeitada/);
    const model = menuModel(storage);
    const card = model.cards.find((c) => c.careerId === 'personagem-leste')!;
    assert.match(card.blocked!, /Save inválido/);
    const screen = mainScreen(model);
    assert.ok(!screen.newGame.some((c) => c.careerId === 'personagem-leste'), 'não aparece em Novo jogo');
    assert.match(screen.load.find((l) => l.card.careerId === 'personagem-leste')!.reason!, /Save inválido.*Cópia anterior rejeitada/);
    assert.throws(() => enterCareer(storage, 'personagem-leste', pick('feminino', 'carro-antigo')), /Save inválido de Caio/);
    assert.deepEqual(dump(storage), before, 'leitura pura: nenhuma chave criada, alterada ou apagada');
  });
}

test('B1-01 F3.5.1 auditoria: principal E cópia anterior inválidos — erro dos dois, slot ocupado, nada gravado', () => {
  const storage = new MemoryStorage();
  storage.setItem(saveKey('personagem-sul'), '{'); storage.setItem(previousKey('personagem-sul'), 'lixo');
  const before = dump(storage);
  const r = new CareerStore(storage).read('personagem-sul');
  assert.match(r.problem!, /Save principal rejeitado/); assert.match(r.problem!, /Cópia anterior rejeitada/);
  assert.ok(!mainScreen(menuModel(storage)).newGame.some((c) => c.careerId === 'personagem-sul'));
  assert.throws(() => enterCareer(storage, 'personagem-sul', pick()), /Save inválido de Davi/);
  assert.deepEqual(dump(storage), before);
});

test('B1-01 F3.5.1 auditoria: calendário legado Oeste com cópia anterior inválida também não vira slot livre nem é migrado por cima', () => {
  const storage = new MemoryStorage(); storage.setItem(CALENDAR_STORAGE_KEY, '3'); storage.setItem(previousKey('personagem-oeste'), '{x');
  const before = dump(storage);
  const m = mainScreen(menuModel(storage));
  assert.ok(!m.newGame.some((c) => c.careerId === 'personagem-oeste'));
  assert.match(m.load.find((l) => l.card.careerId === 'personagem-oeste')!.reason!, /Save inválido/);
  assert.throws(() => enterCareer(storage, 'personagem-oeste', pick()), /Save inválido de Lia/);
  assert.deepEqual(dump(storage), before);
});

test('B1-01 F3.5.1 auditoria: principal inválido com cópia anterior ÍNTEGRA continua recuperável (Carregar/Continuar com aviso)', () => {
  const storage = new MemoryStorage();
  enterCareer(storage, 'personagem-leste', pick('feminino', 'carro-antigo')); enterCareer(storage, 'personagem-leste', pick('masculino', null));
  storage.setItem(saveKey('personagem-leste'), '{quebrado');
  const m = mainScreen(menuModel(storage));
  const load = m.load.find((l) => l.card.careerId === 'personagem-leste')!;
  assert.equal(load.reason, null); assert.equal(load.card.source, 'anterior'); assert.match(load.card.problem!, /Save principal rejeitado/);
  assert.equal(m.continueCard!.careerId, 'personagem-leste');
  assert.ok(!m.newGame.some((c) => c.careerId === 'personagem-leste'));
  const boot = enterCareer(storage, 'personagem-leste', pick('feminino', null));
  assert.equal(boot.session.profile.vehicle!.kind, 'carro-antigo');
});
