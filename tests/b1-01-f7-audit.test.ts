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
  let failedAt: { id: string; before: number; bytes: string | null; frame: number } | null = null;
  let recovered = false;
  const known = new Map<string, number>();
  playDay(storage, (day, i, cp) => {
    if (recovered) return true;
    if (failedAt) {
      // Storage is back: the retry (≤ 5 s later) writes the event.
      if (i === failedAt.frame + 1) full = false;
      const saved = reopened(storage, failedAt.id);
      if (cp.status.error === null && saved && saved.history.length > failedAt.before) recovered = true;
      return false;
    }
    for (const p of day.parcels) {
      const n = known.get(p.id) ?? 0;
      if (p.history.length === n) continue;
      known.set(p.id, p.history.length);
      if (failedAt || lastOp(p).operation !== 'transferência:triagem') continue;
      // Next autonomous step of THIS parcel fails to save: arm the failure, keep the bytes.
      full = true;
      failedAt = { id: p.id, before: p.history.length, bytes: inner.getItem(saveKey('personagem-oeste')), frame: -1 };
    }
    if (failedAt && failedAt.frame === -1) {
      const p = day.parcels.find((q) => q.id === failedAt!.id)!;
      if (p.history.length > failedAt.before) {
        failedAt.frame = i;
        assert.match(cp.status.error ?? '', /quota/i, 'a falha é registrada e avisada');
        assert.equal(inner.getItem(saveKey('personagem-oeste')), failedAt.bytes, 'save íntegro intacto, nada parcial');
        // A tab reopened now resumes from that intact checkpoint: valid, same IDs, the step not confirmed.
        const save = parseSave(JSON.parse(failedAt.bytes!));
        const again = new LogisticsDay({ seed: 2026, free, roster: buildRoster('personagem-oeste') });
        assert.ok(restoreShift(again, save.shift!));
        assert.equal(new Set(again.parcels.map((q) => q.id)).size, day.parcels.length);
        assert.ok(again.parcels.find((q) => q.id === p.id)!.history.length <= failedAt.before);
        failedAt.before = again.parcels.find((q) => q.id === p.id)!.history.length;
      } else full = false; // nothing happened to it this frame: let other writes through
      if (failedAt.frame === -1) { full = false; failedAt = null; }
    }
  });
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
