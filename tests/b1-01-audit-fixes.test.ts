import test from 'node:test';
import assert from 'node:assert/strict';
import { CareerSession, CareerStore, MemoryStorage, saveKey } from '../src/core/career/careerStore.ts';
import { commitNextDay } from '../src/core/career/careerBoot.ts';
import { DEFAULT_CAREER, type CareerId } from '../src/core/career/careers.ts';
import { SaveError, captureParcels, defaultProfile, emptyShift, sealSave, type PaymentRecord } from '../src/core/career/snapshot.ts';
import { advance, createParcel, move, type Parcel } from '../src/core/delivery/parcels.ts';

/**
 * Reauditoria F1 (PR #15, comentário 6899479417): reproduz os três defeitos apontados.
 * Antes das correções, todos estes cenários eram ACEITOS pelo código.
 */

// ---------------------------------------------------------------- 1. sessão desatualizada

test('Auditoria 1: sessão desatualizada (outra aba) não sobrescreve progresso mais novo', () => {
  const storage = new MemoryStorage(), store = new CareerStore(storage);
  const seed = new CareerSession(store, 'personagem-norte');
  commitNextDay(seed, 2);
  const a = new CareerSession(store, 'personagem-norte');
  const b = new CareerSession(store, 'personagem-norte');
  assert.equal(a.profile.calendarIndex, 2); assert.equal(b.profile.calendarIndex, 2);
  commitNextDay(a, 5);
  // B ainda acha que está no dia 2: gravar dia 4 com checkpoint "maior" apagaria o dia 5.
  assert.throws(() => commitNextDay(b, 4), (e: unknown) => e instanceof SaveError && /desatualizada/.test((e as Error).message));
  assert.equal(new CareerStore(storage).read('personagem-norte').save.profile.calendarIndex, 5, 'progresso mais novo preservado');
  assert.throws(() => b.commit('personagem-norte', (p, s) => ({ profile: { ...p, experience: 99 }, shift: s })), /desatualizada/, 'qualquer escrita da sessão velha é recusada');
  // Política de múltiplas abas: a sessão recusada recarrega explicitamente e só então continua.
  b.reload();
  assert.equal(b.profile.calendarIndex, 5);
  commitNextDay(b, 6);
  assert.equal(new CareerStore(storage).read('personagem-norte').save.profile.calendarIndex, 6);
  assert.throws(() => commitNextDay(a, 7), /desatualizada/, 'agora A é que ficou para trás');
});

test('Auditoria 1: restauração de backup também invalida a sessão aberta', () => {
  const storage = new MemoryStorage(), store = new CareerStore(storage);
  const s = new CareerSession(store, 'personagem-sul');
  commitNextDay(s, 1);
  const backup = store.exportBackup('personagem-sul');
  commitNextDay(s, 3);
  const other = new CareerSession(store, 'personagem-sul');
  store.importBackup(backup, 'personagem-sul');
  assert.throws(() => commitNextDay(other, 4), /desatualizada/);
  const seqs = [store.read('personagem-sul').save.checkpointSequence];
  assert.deepEqual(seqs, [2], 'sequência monotônica: 0 (dia 1), 1 (dia 3), 2 (backup restaurado)');
});

test('Auditoria 1: gravação direta com checkpoint fora da sequência é recusada', () => {
  const storage = new MemoryStorage(), store = new CareerStore(storage);
  const s = new CareerSession(store, 'personagem-leste');
  commitNextDay(s, 1); commitNextDay(s, 2);
  const jump = sealSave({ careerId: 'personagem-leste', checkpointSequence: 9, profile: defaultProfile('personagem-leste', 1), shift: null });
  assert.throws(() => store.write(jump), /desatualizada|fora da sequência/);
  assert.equal(store.read('personagem-leste').save.profile.calendarIndex, 2);
  const before = storage.getItem(saveKey('personagem-leste'));
  const stale = sealSave({ careerId: 'personagem-leste', checkpointSequence: 2, profile: defaultProfile('personagem-leste', 1), shift: null });
  assert.throws(() => store.commit('personagem-leste', stale.profile, null, 0), /desatualizada/, 'base 0 quando o gravado já é 1');
  assert.equal(storage.getItem(saveKey('personagem-leste')), before);
});

// ---------------------------------------------------------------- 2. dia do perfil × dia do expediente

const openShift = (careerId: CareerId, day: number, minutes = 0) => {
  const shift = { ...emptyShift(careerId, day), elapsedVirtualMinutes: minutes, phase: 'ENTREGAS' };
  return { profile: { ...defaultProfile(careerId, day), activeShiftId: shift.shiftId }, shift };
};

test('Auditoria 2: schema exige o mesmo dia no perfil e no expediente aberto', () => {
  const { profile, shift } = openShift(DEFAULT_CAREER, 7);
  assert.doesNotThrow(() => sealSave({ careerId: DEFAULT_CAREER, checkpointSequence: 0, profile, shift }));
  assert.throws(() => sealSave({ careerId: DEFAULT_CAREER, checkpointSequence: 0, profile: { ...profile, calendarIndex: 8 }, shift }), /mesmo dia/);
  assert.throws(() => sealSave({ careerId: DEFAULT_CAREER, checkpointSequence: 0, profile: { ...profile, calendarIndex: 6 }, shift }), /mesmo dia/);
});

test('Auditoria 2: não avança o calendário com expediente aberto, nem depois da meia-noite', () => {
  const storage = new MemoryStorage(), store = new CareerStore(storage);
  const s = new CareerSession(store, DEFAULT_CAREER);
  // 11h45 → 00h30 do dia seguinte: 765 minutos virtuais no MESMO expediente.
  const { profile, shift } = openShift(DEFAULT_CAREER, 0, 765);
  s.commit(DEFAULT_CAREER, () => ({ profile, shift }));
  assert.throws(() => commitNextDay(s, 1), /Expediente .*aberto/);
  const saved = store.read(DEFAULT_CAREER).save;
  assert.equal(saved.profile.calendarIndex, 0, 'meia-noite não vira novo dia de carreira');
  assert.equal(saved.shift!.shiftId, 'personagem-oeste/dia-0');
  // Mesmo por fora do helper, gravar perfil de outro dia com o expediente aberto é rejeitado pelo schema.
  assert.throws(() => s.commit(DEFAULT_CAREER, (p, sh) => ({ profile: { ...p, calendarIndex: 1 }, shift: sh })), /mesmo dia/);
  // Expediente encerrado: avanço liberado e o expediente não é carregado para o dia seguinte.
  s.commit(DEFAULT_CAREER, (p) => ({ profile: { ...p, activeShiftId: null }, shift: null }));
  commitNextDay(s, 1);
  const next = store.read(DEFAULT_CAREER).save;
  assert.equal(next.profile.calendarIndex, 1); assert.equal(next.shift, null); assert.equal(next.profile.activeShiftId, null);
});

// ---------------------------------------------------------------- 3. pagamento sem entrega

const AT = { x: 1, y: 0, z: 1 };
function parcelUpTo(stage: 'COLETADO' | 'EM_ROTA' | 'ENTREGUE'): Parcel {
  const p = createParcel('J7-001', 'mercearia', 'end-q1-l1', 'ML', 'Oeste', 'NA_LOJA', 'mercearia', 12);
  advance(p, 'COLETADO', 'jogador', 12.1); move(p, 'maos', 'jogador', 12.1);
  if (stage === 'COLETADO') return p;
  advance(p, 'EM_TRANSPORTE', 'jogador', 12.2); move(p, 'recebimento', 'conferente', 13, AT); move(p, 'conferencia', 'conferente', 13.1, AT);
  advance(p, 'RECEBIDO_BASE', 'conferente', 13.2); move(p, 'transferencia', 'separador', 13.3, AT); move(p, 'triagem', 'separador', 13.4, AT);
  advance(p, 'TRIADO', 'separador', 13.5); move(p, 'transferencia', 'separador', 13.6, AT);
  p.dock = 'D02'; p.load = 'ROTA-O'; move(p, 'doca', 'expedidor', 13.7, AT);
  advance(p, 'NA_SACA', 'expedidor', 13.8); move(p, 'saca', 'expedidor', 13.9, AT);
  advance(p, 'EM_ROTA', 'jogador', 15); move(p, 'maos', 'jogador', 15);
  if (stage === 'EM_ROTA') return p; // tentativa frustrada: continua sob custódia, pendente
  advance(p, 'ENTREGUE', 'jogador', 16); move(p, 'destinatario', 'jogador', 16);
  return p;
}
const withPayment = (p: Parcel, payment: Partial<PaymentRecord> = {}) => {
  const { profile, shift } = openShift(DEFAULT_CAREER, 7);
  const pay: PaymentRecord = { eventId: `${shift.shiftId}/${p.id}/ENTREGA`, shiftId: shift.shiftId, parcelId: p.id, kind: 'ENTREGA', amountCents: 450, ...payment };
  return () => sealSave({ careerId: DEFAULT_CAREER, checkpointSequence: 0, profile, shift: { ...shift, parcels: captureParcels([p]), payments: [pay] } });
};

test('Auditoria 3: pagamento de entrega só para pacote ENTREGUE ao destinatário', () => {
  assert.doesNotThrow(withPayment(parcelUpTo('ENTREGUE')), 'entregue: remunerável');
  assert.throws(withPayment(parcelUpTo('COLETADO')), /não entregue/, 'coletado não paga entrega');
  assert.throws(withPayment(parcelUpTo('EM_ROTA')), /não entregue/, 'tentativa frustrada/pendente não paga');
  const delivered = parcelUpTo('ENTREGUE');
  assert.throws(withPayment(delivered, { eventId: 'outro-id' }), /evento de pagamento/, 'eventId determinístico: um por pacote/expediente');
  const twice = () => {
    const { profile, shift } = openShift(DEFAULT_CAREER, 7);
    const pay: PaymentRecord = { eventId: `${shift.shiftId}/${delivered.id}/ENTREGA`, shiftId: shift.shiftId, parcelId: delivered.id, kind: 'ENTREGA', amountCents: 450 };
    return sealSave({ careerId: DEFAULT_CAREER, checkpointSequence: 0, profile, shift: { ...shift, parcels: captureParcels([delivered]), payments: [pay, { ...pay }] } });
  };
  assert.throws(twice, /Pagamento duplicado/, 'o mesmo ID entregue não paga duas vezes (AC-22)');
  assert.throws(withPayment(delivered, { kind: 'COLETA' as 'ENTREGA' }), /Tipo de pagamento/, 'coleta não é evento remunerado aprovado');
  assert.throws(withPayment(delivered, { kind: 'DEVOLUCAO' as 'ENTREGA' }), /Tipo de pagamento/, 'devolução nunca paga');
});

test('Auditoria 3: estado DEVOLVIDO_E_CONFERIDO forjado é rejeitado até a F5 definir o fluxo (nunca pago)', () => {
  // Um save com estado final DEVOLVIDO_E_CONFERIDO forjado é rejeitado inteiro até a F5 definir o fluxo.
  const forged = JSON.parse(JSON.stringify(captureParcels([parcelUpTo('ENTREGUE')])));
  forged[0].state = 'DEVOLVIDO_E_CONFERIDO'; forged[0].history[forged[0].history.length - 1].state = 'DEVOLVIDO_E_CONFERIDO';
  const { profile, shift } = openShift(DEFAULT_CAREER, 7);
  assert.throws(() => sealSave({ careerId: DEFAULT_CAREER, checkpointSequence: 0, profile, shift: { ...shift, parcels: forged, payments: [] } }), /Estado do pacote inválido/);
});
