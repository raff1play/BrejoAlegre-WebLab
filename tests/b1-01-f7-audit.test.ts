import test from 'node:test';
import assert from 'node:assert/strict';
import { LogisticsDay } from '../src/core/delivery/logisticsDay.ts';
import { buildRoster, CHARACTERS } from '../src/core/career/careers.ts';
import { CareerSession, CareerStore, MemoryStorage, saveKey, type KeyValueStorage } from '../src/core/career/careerStore.ts';
import { enterCareer } from '../src/core/career/careerMenu.ts';
import { canonicalJson, parseSave } from '../src/core/career/snapshot.ts';
import { ShiftCheckpointer, restoreShift, type ShiftCapture } from '../src/core/career/shiftCheckpoint.ts';
import { CITY_BOUNDS } from '../src/world/city/cityPlan.ts';
import { solidPolygons } from '../src/world/city/cityLayout.ts';
import { createMotionGuard } from '../src/core/collision.ts';
import { BIKE, markAbsent, motoPlayerStep } from './helpers/day.ts';
import type { Parcel } from '../src/core/delivery/parcels.ts';

/**
 * F7 audit (PR #15, comment 6918411665) — AC-18/AC-19: a custody event done by an NPC courier or a
 * depot worker must already be in the save when the tab dies abruptly right after it (no
 * `pagehide`, no `visibilitychange`, no next tick). Every step below reads the storage with a NEW
 * store/session, as a reopened tab would, in the very frame the event happened.
 */
const guard = createMotionGuard(CITY_BOUNDS, [], solidPolygons());
const free = (x: number, z: number) => guard(x, z, 0.45);
const STEP = 0.1; // real seconds per frame of the driver (the game's frame is ≤ 0.05 s)
const hourAt = (i: number) => 12 + (i * STEP) / 150;
type Seen = { label: string; id: string; op: string; frame: number };

/** Plays the Oeste moto day; `afterFrame` runs right after the frame's checkpoint tick. */
function playDay(storage: KeyValueStorage, afterFrame: (d: LogisticsDay, i: number, cp: ShiftCheckpointer) => boolean | void) {
  enterCareer(storage, 'personagem-oeste', { appearance: CHARACTERS['personagem-oeste'].defaultAppearance, equipment: 'kit-jaqueta', vehicle: 'moto-antiga' });
  const session = new CareerSession(new CareerStore(storage));
  const d = new LogisticsDay({ seed: 2026, free, roster: buildRoster('personagem-oeste') });
  let hour = 11.75, now = 0;
  const cap = (): ShiftCapture => ({ day: d, shiftHour: hour, vehicle: 'moto-antiga', player: { mode: 'walking', walker: { x: 1, z: 2, yaw: 0 }, vehicle: BIKE } });
  const cp = new ShiftCheckpointer(session, cap, { enabled: true, now: () => now }); // the GAME's own timings
  d.start(11.75); markAbsent(d); cp.tick();
  for (let i = 0; i < 30000 && !d.allResolved; i++) {
    hour = hourAt(i); now = i * STEP * 1000;
    // Same order as the render loop: player action (+ afterAction), world update, checkpoint tick.
    // afterAction only when the PLAYER really did something (as `contextAction` in main.ts).
    const before = d.parcels.reduce((t, p) => t + p.history.length, 0);
    motoPlayerStep(d, hour);
    if (d.parcels.reduce((t, p) => t + p.history.length, 0) !== before) cp.afterAction('ação');
    d.update(hour, STEP);
    cp.tick();
    if (afterFrame(d, i, cp)) break;
  }
  return { d, cp };
}
/** What a tab reopened NOW would get for one parcel. */
const reopened = (storage: KeyValueStorage, id: string) => {
  const save = new CareerStore(storage).read('personagem-oeste').save;
  return save.shift?.parcels.find((p) => p.id === id) ?? null;
};
const lastOp = (p: { history: readonly { operation: string; holder: string }[] }) => p.history.at(-1)!;

test('Auditoria F7 (AC-18/19): entrega de NPC, devolução conferida pelo plantão e cada etapa da base já estão no save no MESMO quadro — fechar a aba logo depois não regride nada', () => {
  const storage = new MemoryStorage();
  const seen: Seen[] = [];
  const known = new Map<string, number>();
  let checked = 0;
  const { d, cp } = playDay(storage, (day, i) => {
    for (const p of day.parcels) {
      const n = known.get(p.id) ?? 0;
      if (p.history.length === n) continue;
      known.set(p.id, p.history.length);
      const ev = lastOp(p);
      const npcDelivery = ev.operation === 'transferência:destinatario' && p.sector !== day.playerSector;
      const checkedReturn = ev.operation === 'transferência:devolucoes';
      const depotStep = ['transferência:triagem', 'transferência:gaiola', 'estado:NA_SACA', 'transferência:saca', 'estado:RECEBIDO_BASE'].some((o) => p.history.slice(n).some((e) => e.operation === o));
      if (!npcDelivery && !checkedReturn && !depotStep) continue;
      // Abrupt end of the tab here: no exit hook, no further tick. A new tab reads the storage.
      const saved = reopened(storage, p.id);
      checked++;
      assert.ok(saved, `${p.id} no save`);
      assert.equal(saved!.history.length, p.history.length, `${p.id}: ${ev.operation} por ${ev.holder} no quadro ${i} já está no save`);
      assert.equal(saved!.state, p.state); assert.equal(saved!.place, p.place); assert.equal(saved!.holder, p.holder);
      if (npcDelivery && !seen.some((s) => s.label === 'npc')) seen.push({ label: 'npc', id: p.id, op: ev.operation, frame: i });
      if (checkedReturn && !seen.some((s) => s.label === 'devolução')) seen.push({ label: 'devolução', id: p.id, op: ev.operation, frame: i });
      if (depotStep && !seen.some((s) => s.label === 'base')) seen.push({ label: 'base', id: p.id, op: ev.operation, frame: i });
    }
  });
  assert.ok(d.allResolved, 'dia completo');
  assert.deepEqual(seen.map((s) => s.label).sort(), ['base', 'devolução', 'npc'], 'os três tipos de evento autônomo ocorreram e foram conferidos');
  assert.ok(checked > 100, `todas as etapas autônomas conferidas (${checked})`);
  assert.equal(cp.status.error, null);
  // And the reopened tab really resumes from it: the NPC's delivered parcel is ENTREGUE in the world.
  const npc = seen.find((s) => s.label === 'npc')!;
  const save = new CareerStore(storage).read('personagem-oeste').save;
  const again = new LogisticsDay({ seed: 2026, free, roster: buildRoster('personagem-oeste') });
  assert.ok(restoreShift(again, save.shift!));
  assert.equal(again.parcels.find((p) => p.id === npc.id)!.state, 'ENTREGUE');
});

test('Auditoria F7 (AC-18/19): se a gravação do evento autônomo FALHA, nada parcial é gravado, o jogo avisa, e a retomada é o checkpoint íntegro anterior (sem duplicar nem perder pacote); a nova tentativa grava', () => {
  const inner = new MemoryStorage();
  let full = false;
  const storage: KeyValueStorage = {
    getItem: (k) => inner.getItem(k), removeItem: (k) => inner.removeItem(k),
    setItem: (k, v) => { if (full && k.startsWith('brejo-b1:')) { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; } inner.setItem(k, v); },
  };
  let phase: 'antes' | 'armado' | 'falhou' | 'ok' = 'antes';
  let armedBytes: string | null = null, failFrame = -1, lastEvents = 0;
  const events = (day: LogisticsDay) => day.parcels.reduce((t, p) => t + p.history.length, 0);
  playDay(storage, (day, i, cp) => {
    const n = events(day);
    if (phase === 'antes' && day.parcels.some((p) => p.history.some((e) => e.operation === 'transferência:triagem'))) {
      // From now on the storage refuses writes (quota): the next autonomous event cannot be saved.
      phase = 'armado'; full = true; armedBytes = inner.getItem(saveKey('personagem-oeste')); lastEvents = n;
    } else if (phase === 'armado' && n !== lastEvents) {
      phase = 'falhou'; failFrame = i;
      assert.match(cp.status.error ?? '', /quota/i, 'a falha do evento autônomo é registrada (o jogo avisa)');
      assert.equal(inner.getItem(saveKey('personagem-oeste')), armedBytes, 'save íntegro intacto, nada parcial');
      // A tab reopened now resumes from that intact checkpoint: valid, same IDs, nothing lost or duplicated.
      const save = parseSave(JSON.parse(armedBytes!));
      const again = new LogisticsDay({ seed: 2026, free, roster: buildRoster('personagem-oeste') });
      assert.ok(restoreShift(again, save.shift!));
      assert.deepEqual(again.parcels.map((q) => q.id), day.parcels.map((q) => q.id));
      assert.ok(events(again) < n, 'o passo não confirmado não aparece como feito');
      full = false; // storage healthy again
    } else if (phase === 'falhou') {
      const saved = new CareerStore(storage).read('personagem-oeste').save;
      const savedEvents = saved.shift!.parcels.reduce((t, p) => t + p.history.length, 0);
      if (cp.status.error === null && savedEvents === n) { phase = 'ok'; assert.ok(i - failFrame <= 51, `nova tentativa em ≤ 5 s (${i - failFrame} quadros)`); return true; }
    }
    return false;
  });
  const recovered = phase === 'ok';
  assert.ok(recovered, 'depois da falha, a nova tentativa gravou o evento');
});

test('Auditoria F7: desempenho — o dia inteiro grava um checkpoint por quadro com evento (nunca mais que um por quadro) e o custo médio fica medido', () => {
  const storage = new MemoryStorage();
  let frames = 0, changed = 0;
  const seen = new Map<string, number>();
  let ms = 0;
  const t0 = performance.now();
  const { cp } = playDay(storage, (day) => {
    frames++;
    let any = false;
    for (const p of day.parcels) { if ((seen.get(p.id) ?? 0) !== p.history.length) { any = true; seen.set(p.id, p.history.length); } }
    if (any) changed++;
  });
  ms = performance.now() - t0;
  assert.ok(cp.status.writes <= frames + 1, 'no máximo um checkpoint por quadro');
  assert.ok(cp.status.writes >= changed, 'todo quadro com evento gravou');
  console.log(`[F7] ${cp.status.writes} checkpoints em ${frames} quadros (${changed} com evento); ${(ms / frames).toFixed(2)} ms/quadro no Node, incluindo a simulação`);
  void canonicalJson; void ({} as Parcel);
});

test('Auditoria F7: o texto gravado pelo caminho rápido é byte a byte o JSON canônico do save, relido e validado inteiro', () => {
  const storage = new MemoryStorage();
  let saved: string | null = null;
  playDay(storage, (_d, i) => { if (i === 6000) { saved = storage.getItem(saveKey('personagem-oeste')); return true; } return false; });
  assert.ok(saved);
  const parsed = parseSave(JSON.parse(saved!));
  assert.equal(canonicalJson(parsed), saved, 'texto gravado = JSON canônico (checksum na posição ordenada)');
  assert.ok(parsed.shift!.world, 'com o mundo do expediente');
  // Per-write cost on this machine (Node, desktop CPU) for a mid-day save — measured, not assumed.
  const session = new CareerSession(new CareerStore(storage));
  const t = performance.now();
  for (let k = 0; k < 10; k++) session.commit(session.careerId, (p, s) => ({ profile: p, shift: s }));
  console.log(`[F7] checkpoint de ${(saved!.length / 1024).toFixed(0)} kB: ${((performance.now() - t) / 10).toFixed(1)} ms por gravação (Node desktop)`);
});
