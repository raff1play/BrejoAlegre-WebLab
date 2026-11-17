import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, careerHome, type CareerId } from '../src/core/career/careers.ts';
import { CareerSession, CareerStore, MemoryStorage, marksKey, saveKey, type KeyValueStorage } from '../src/core/career/careerStore.ts';
import { enterCareer } from '../src/core/career/careerMenu.ts';
import { commitNextDay } from '../src/core/career/careerBoot.ts';
import { SaveError, canonicalJson, chooseStartingVehicle, defaultProfile, emptyShift, sealSave } from '../src/core/career/snapshot.ts';
import { LogisticsDay } from '../src/core/delivery/logisticsDay.ts';
import { buildRoster } from '../src/core/career/careers.ts';
import { closeShiftAtHome, captureShift, type ShiftCapture } from '../src/core/career/shiftCheckpoint.ts';
import { isFinal } from '../src/core/delivery/parcels.ts';

/**
 * Regressions of the F6 audit (PR #15, comment 6916312263):
 * 1. a failed write of the anti-rollback marks must never let an old backup undo confirmed progress;
 * 2. while ANY career has an open shift, no save of any character may be imported or deleted.
 */
type Fail = { marks: boolean; saves: boolean };
function flaky(fail: Fail): { storage: KeyValueStorage; inner: MemoryStorage } {
  const inner = new MemoryStorage();
  const quota = () => { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; return e; };
  return {
    inner,
    storage: {
      getItem: (k) => inner.getItem(k),
      setItem: (k, v) => {
        if (fail.marks && k.startsWith('brejo-b1:marcas:')) throw quota();
        if (fail.saves && k.startsWith('brejo-b1:carreira:personagem-')) throw quota();
        inner.setItem(k, v);
      },
      removeItem: (k) => inner.removeItem(k),
    },
  };
}
const snapshotAll = (s: MemoryStorage): string => canonicalJson(Object.fromEntries(s.keys().map((k) => [k, s.getItem(k)])));
const newCareer = (storage: KeyValueStorage, id: CareerId, vehicle: 'moto-antiga' | 'carro-antigo' = 'moto-antiga') =>
  enterCareer(storage, id, { appearance: CHARACTERS[id].defaultAppearance, equipment: CHARACTERS[id].defaultEquipment, vehicle });

/** A real, fully resolved paid day of Oeste (moto) closed at the door of her own home. */
function playAndCloseDay(session: CareerSession): void {
  const d = new LogisticsDay({ seed: 2026, roster: buildRoster(session.careerId) });
  d.start(11.75);
  // Domain shortcut for the ledger only: the player's parcels delivered by the player (history-true
  // transitions are covered by the day tests); everything else resolved by NPC-equivalent states.
  for (const p of d.parcels) {
    const ev = (state: typeof p.state, place: typeof p.place, holder: string, op: string) => { p.state = state; p.place = place; p.holder = holder; p.history.push({ state, place, hour: 16, by: holder, holder, position: null, dock: null, load: null, operation: op }); };
    if (p.sector === d.playerSector) { ev('EM_ROTA', 'maos', 'jogador', 'transferência:maos'); ev('ENTREGUE', 'maos', 'destinatario', 'estado:ENTREGUE'); ev('ENTREGUE', 'destinatario', 'destinatario', 'transferência:destinatario'); }
    else { ev('ENTREGUE', 'destinatario', 'destinatario', 'estado:ENTREGUE'); }
  }
  for (const c of d.couriers) c.state = 'complete';
  d.update(22, 0.1);
  assert.ok(d.allResolved && d.parcels.every(isFinal));
  const h = careerHome(session.careerId);
  const cap: ShiftCapture = { day: d, shiftHour: 22, vehicle: 'moto-antiga', player: { mode: 'walking', walker: { ...h.door, yaw: 0 }, vehicle: { ...h.stop, yaw: 0 } } };
  session.commit(session.careerId, (p, s) => captureShift(p, s, cap));
  closeShiftAtHome(session, cap, session.profile.calendarIndex + 1, { vehicleStopped: true });
}

test('Auditoria F6 bloqueio 1 (reprodução): marca anti-reversão que não grava NÃO deixa o checkpoint passar; backup antigo continua recusado depois de apagar', () => {
  const fail: Fail = { marks: false, saves: false };
  const { storage, inner } = flaky(fail);
  newCareer(storage, 'personagem-oeste');
  const store = new CareerStore(storage);
  const oldBackup = store.exportBackup('personagem-oeste');
  const before = snapshotAll(inner);
  // The marks key starts failing: the day's paid checkpoints and its closing are NOT confirmed.
  fail.marks = true;
  const session = new CareerSession(new CareerStore(storage), 'personagem-oeste');
  assert.throws(() => playAndCloseDay(session), /marca anti-reversão.*checkpoint NÃO gravado/i, 'checkpoint recusado quando a marca não persiste');
  assert.equal(snapshotAll(inner), before, 'nada foi gravado: nem save principal, nem cópia anterior, nem marca');
  assert.equal(new CareerStore(storage).read('personagem-oeste').save.profile.balanceCents, 0, 'nenhum ganho declarado como confirmado');
  // Storage healthy again: the same day now closes, paid and on the next calendar day.
  fail.marks = false;
  const s2 = new CareerSession(new CareerStore(storage), 'personagem-oeste');
  playAndCloseDay(s2);
  const paid = new CareerStore(storage).read('personagem-oeste').save;
  assert.ok(paid.profile.balanceCents > 0); assert.equal(paid.profile.calendarIndex, 1);
  assert.equal(new CareerStore(storage).marks('personagem-oeste')[paid.profile.lineageId], paid.checkpointSequence, 'marca durável do checkpoint pago');
  // The mark fails again for the deletion and the old backup: delete + import never revert the paid day.
  fail.marks = true;
  new CareerStore(storage).deleteCareer('personagem-oeste', 'Lia');
  assert.throws(() => new CareerStore(storage).importBackup(oldBackup, 'personagem-oeste'), /desatualizado/, 'backup do checkpoint inicial recusado depois de apagar');
  assert.equal(inner.getItem(saveKey('personagem-oeste')), null, 'nada restaurado');
});

test('Auditoria F6 bloqueio 1: falha ANTES do save (marca), DEPOIS da marca (save) e na remoção — sempre fechada, nunca silenciosa', () => {
  const fail: Fail = { marks: false, saves: false };
  const { storage, inner } = flaky(fail);
  newCareer(storage, 'personagem-norte');
  const s = new CareerSession(new CareerStore(storage), 'personagem-norte');
  commitNextDay(s, 1);
  const lineage = s.profile.lineageId;
  // (a) before the save: the mark write fails → SaveError, the save is untouched, the session can retry.
  fail.marks = true;
  let bytes = snapshotAll(inner);
  assert.throws(() => commitNextDay(s, 2), (e: Error) => e instanceof SaveError && /marca anti-reversão/.test(e.message));
  assert.equal(snapshotAll(inner), bytes);
  fail.marks = false; commitNextDay(s, 2);
  assert.equal(new CareerStore(storage).read('personagem-norte').save.profile.calendarIndex, 2);
  // (b) after the mark: the save write fails → the mark is put back, principal and previous untouched.
  fail.saves = true;
  const marksBefore = inner.getItem(marksKey('personagem-norte'));
  bytes = snapshotAll(inner);
  assert.throws(() => commitNextDay(s, 3), /Falha ao gravar o save/);
  assert.equal(inner.getItem(marksKey('personagem-norte')), marksBefore, 'marca desfeita junto com o save que falhou');
  assert.equal(snapshotAll(inner), bytes);
  fail.saves = false;
  // (c) unreadable marks: no checkpoint, no import and no deletion trusts "no mark known".
  inner.setItem(marksKey('personagem-norte'), '{"quebrado":');
  bytes = snapshotAll(inner);
  assert.throws(() => commitNextDay(s, 3), /ilegíveis/);
  const exported = new CareerStore(storage).exportBackup('personagem-norte');
  assert.throws(() => new CareerStore(storage).importBackup(exported), /ilegíveis/);
  assert.throws(() => new CareerStore(storage).deleteCareer('personagem-norte', 'Rosa'), /NÃO apagada.*ilegíveis/);
  assert.equal(snapshotAll(inner), bytes, 'nada mudou com as marcas ilegíveis');
  // (d) a save whose mark was lost (e.g. written by the F6 build that ignored the failure): deleting
  // must first make it durable; if that write fails, nothing is deleted.
  inner.removeItem(marksKey('personagem-norte'));
  fail.marks = true;
  bytes = snapshotAll(inner);
  assert.throws(() => new CareerStore(storage).deleteCareer('personagem-norte', 'Rosa'), /NÃO apagada/);
  assert.equal(snapshotAll(inner), bytes, 'save preservado quando a marca não pôde ser gravada');
  fail.marks = false;
  const old = sealSave({ careerId: 'personagem-norte', checkpointSequence: 0, profile: { ...s.profile, calendarIndex: 0 }, shift: null });
  assert.throws(() => new CareerStore(storage).importBackup(canonicalJson(old)), /desatualizado/, 'o próprio save presente já protege contra o backup antigo');
  new CareerStore(storage).deleteCareer('personagem-norte', 'Rosa');
  assert.ok((new CareerStore(storage).marks('personagem-norte')[lineage] ?? -1) >= 2, 'a remoção gravou a marca que faltava antes de apagar');
  assert.throws(() => new CareerStore(storage).importBackup(canonicalJson(old)), /desatualizado/);
});

test('Auditoria F6 bloqueio 2: com o expediente de Lia aberto, importar e apagar QUALQUER personagem é recusado no domínio, sem mudar nenhum byte', () => {
  const inner = new MemoryStorage();
  newCareer(inner, 'personagem-norte');
  const rosaOld = new CareerStore(inner).exportBackup('personagem-norte');
  commitNextDay(new CareerSession(new CareerStore(inner), 'personagem-norte'), 1);
  const rosaNow = new CareerStore(inner).exportBackup('personagem-norte');
  // A NEWER Rosa from another browser (would normally be accepted).
  const elsewhere = new MemoryStorage();
  new CareerStore(elsewhere).importBackup(rosaNow);
  commitNextDay(new CareerSession(new CareerStore(elsewhere), 'personagem-norte'), 2);
  const rosaNewer = new CareerStore(elsewhere).exportBackup('personagem-norte');
  const daviOther = (() => { const m = new MemoryStorage(); const st = new CareerStore(m); st.commit('personagem-sul', chooseStartingVehicle(defaultProfile('personagem-sul', 4), 'carro-antigo'), null, -1); return st.exportBackup('personagem-sul'); })();
  // Lia enters and her shift opens (the real first checkpoint of the day).
  const boot = newCareer(inner, 'personagem-oeste');
  const shift = { ...emptyShift('personagem-oeste', 0) };
  boot.session.commit('personagem-oeste', (p) => ({ profile: { ...p, activeShiftId: shift.shiftId }, shift }));
  const store = new CareerStore(inner);
  assert.deepEqual(store.openShift(), { careerId: 'personagem-oeste', shiftId: 'personagem-oeste/dia-0' });
  const bytes = snapshotAll(inner);
  for (const [what, f] of [
    ['apagar Rosa', () => store.deleteCareer('personagem-norte', 'Rosa')],
    ['importar Rosa mais nova', () => store.importBackup(rosaNewer, 'personagem-norte')],
    ['prévia de Rosa', () => store.previewBackup(rosaNewer, 'personagem-norte')],
    ['importar Davi num slot livre', () => store.importBackup(daviOther, 'personagem-sul')],
    ['importar Rosa antiga', () => store.importBackup(rosaOld, 'personagem-norte', { replace: true })],
    ['apagar a própria Lia', () => store.deleteCareer('personagem-oeste', 'Lia')],
  ] as [string, () => unknown][]) {
    assert.throws(f, /Expediente personagem-oeste\/dia-0 (de Lia )?aberto/, what);
    assert.equal(snapshotAll(inner), bytes, `${what}: nenhum byte de nenhuma carreira mudou`);
  }
  // Exporting a CLOSED career is read-only and stays possible; Lia's own export waits for the closing.
  assert.equal(store.exportBackup('personagem-norte'), rosaNow);
  assert.throws(() => store.exportBackup('personagem-oeste'), /entre expedientes/);
  // After a valid closing at home everything works again.
  boot.session.commit('personagem-oeste', (p) => ({ profile: { ...p, activeShiftId: null }, shift: null }));
  assert.equal(store.openShift(), null);
  assert.equal(store.importBackup(rosaNewer, 'personagem-norte').profile.calendarIndex, 2);
  store.importBackup(daviOther, 'personagem-sul');
  store.deleteCareer('personagem-sul', 'Davi');
  assert.equal(inner.getItem(saveKey('personagem-sul')), null);
  assert.ok(inner.getItem(saveKey('personagem-norte')) && inner.getItem(saveKey('personagem-oeste')), 'Rosa e Lia continuam');
});
