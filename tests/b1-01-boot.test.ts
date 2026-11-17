import test from 'node:test';
import assert from 'node:assert/strict';
import { bootCareer, commitNextDay } from '../src/core/career/careerBoot.ts';
import { ACTIVE_CAREER_KEY, CareerStore, MemoryStorage, saveKey } from '../src/core/career/careerStore.ts';
import { CAREER_IDS, CHARACTERS, DEFAULT_CAREER } from '../src/core/career/careers.ts';
import { CALENDAR_STORAGE_KEY, nextWorkday } from '../src/core/delivery/operatingCalendar.ts';
import { LogisticsDay } from '../src/core/delivery/logisticsDay.ts';

test('B1-01 F1 boot: jogador novo = carreira Oeste, dia 0, mesma equipe legada', () => {
  const storage = new MemoryStorage();
  const boot = bootCareer(storage);
  assert.equal(boot.session.careerId, DEFAULT_CAREER);
  assert.equal(boot.calendarIndex, 0);
  assert.equal(boot.home.id, 'casa-oeste');
  assert.deepEqual(storage.keys(), [], 'abrir o jogo sem progresso não grava nada');
  const d = new LogisticsDay({ roster: boot.roster, dayIndex: boot.calendarIndex });
  assert.equal(d.playerSector, 'Oeste');
  assert.deepEqual(d.couriers.map((c) => c.name), ['Rosa', 'Caio', 'Davi']);
});

test('B1-01 F1 boot: save legado continua no mesmo dia, é migrado e não é apagado', () => {
  const storage = new MemoryStorage();
  storage.setItem(CALENDAR_STORAGE_KEY, '12');
  const boot = bootCareer(storage);
  assert.equal(boot.calendarIndex, 12);
  assert.match(boot.notes.join(' '), /migrado/);
  assert.equal(storage.getItem(CALENDAR_STORAGE_KEY), '12');
  assert.ok(storage.getItem(saveKey(DEFAULT_CAREER)));
  const again = bootCareer(storage);
  assert.equal(again.session.loadSource, 'principal');
  assert.equal(again.calendarIndex, 12);
  // Avanço de dia: grava a carreira e espelha o índice legado (rollback para builds anteriores).
  const next = nextWorkday(12);
  commitNextDay(again.session, next.index);
  assert.equal(bootCareer(storage).calendarIndex, next.index);
  assert.equal(storage.getItem(CALENDAR_STORAGE_KEY), String(next.index));
  assert.throws(() => commitNextDay(again.session, 3), /não retrocede/);
  assert.throws(() => commitNextDay(again.session, -1), /inválido/);
});

test('B1-01 F1 boot: carreira ativa não-Oeste usa o próprio dia; avanço não toca as demais', () => {
  const storage = new MemoryStorage(), store = new CareerStore(storage);
  storage.setItem(CALENDAR_STORAGE_KEY, '20');
  store.setActiveCareer('personagem-leste');
  const boot = bootCareer(storage);
  assert.equal(boot.session.careerId, 'personagem-leste');
  assert.equal(boot.calendarIndex, 0, 'legado pertence só à carreira Oeste');
  assert.equal(boot.roster.jogador, 'personagem-leste');
  assert.equal(new LogisticsDay({ roster: boot.roster }).playerSector, CHARACTERS['personagem-leste'].sector);
  commitNextDay(boot.session, 1);
  for (const other of CAREER_IDS.filter((c) => c !== 'personagem-leste')) assert.equal(storage.getItem(saveKey(other)), null, `${other} intocado`);
  assert.equal(storage.getItem(CALENDAR_STORAGE_KEY), '20', 'índice legado da carreira Oeste intocado');
  assert.equal(storage.getItem(ACTIVE_CAREER_KEY), 'personagem-leste');
});

test('B1-01 F1 boot: save principal corrompido abre a última cópia íntegra e avisa', () => {
  const storage = new MemoryStorage();
  const s = bootCareer(storage).session;
  commitNextDay(s, 1); commitNextDay(s, 2);
  storage.setItem(saveKey(DEFAULT_CAREER), '{corrompido');
  const boot = bootCareer(storage);
  assert.equal(boot.session.loadSource, 'anterior');
  assert.equal(boot.calendarIndex, 1);
  assert.match(boot.notes[0]!, /rejeitado/);
});
