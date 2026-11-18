import test from 'node:test';
import assert from 'node:assert/strict';
import { LogisticsDay } from '../src/core/delivery/logisticsDay.ts';
import { CAREER_IDS, CHARACTERS, DEFAULT_CAREER, buildRoster, type CareerId } from '../src/core/career/careers.ts';
import { ACTORS } from '../src/core/delivery/dailyDemand.ts';
import { SECTORS, SECTOR_DATA } from '../src/core/delivery/sectors.ts';
import { depotWorld, depotYaw, CITY_BOUNDS } from '../src/world/city/cityPlan.ts';
import { solidPolygons } from '../src/world/city/cityLayout.ts';
import { createMotionGuard } from '../src/core/collision.ts';
import { baseSummary, progressSummary } from '../src/features/hud/hudContext.ts';
import { DEPOT_SPOTS } from '../src/core/delivery/workday.ts';

const guard = createMotionGuard(CITY_BOUNDS, [], solidPolygons());
const bike = { ...depotWorld(84, -111), yaw: depotYaw(0), moving: false };
const parking = { player: { ...depotWorld(84, -112.25), riding: false }, bike };
const receiving = { player: { ...depotWorld(97.8, -122.3), riding: false }, bike };

test('B1-01 F1: roster padrão reproduz exatamente a equipe legada (jogador Oeste, Rosa/Caio/Davi)', () => {
  const legacy = new LogisticsDay({ seed: 2026 });
  const explicit = new LogisticsDay({ seed: 2026, roster: buildRoster(DEFAULT_CAREER) });
  for (const d of [legacy, explicit]) {
    assert.equal(d.playerSector, 'Oeste');
    assert.deepEqual(d.couriers.map((c) => [c.id, c.name, c.sector]), [['npc1', 'Rosa', 'Norte'], ['npc2', 'Caio', 'Leste'], ['npc3', 'Davi', 'Sul']]);
  }
  legacy.start(11); explicit.start(11);
  assert.deepEqual(explicit.parcels.map((p) => [p.id, p.sector, p.collector]), legacy.parcels.map((p) => [p.id, p.sector, p.collector]), 'mesma demanda e IDs');
  legacy.phase = 'SACA';
  assert.equal(legacy.objective(16).title, 'Retirar a carga Oeste na D02', 'texto legado preservado');
  assert.match(baseSummary(legacy.parcels, 15, null)[0], /Sua carga D02/);
  assert.deepEqual({ ...legacy.playerDispatch }, { ...DEPOT_SPOTS.dispatch }, 'balcão Oeste = ponto de expedição legado');
  assert.equal(legacy.objective(16).target?.x, DEPOT_SPOTS.dispatch.x);
});

test('B1-01 F1: cada carreira joga o próprio setor; os outros três personagens são os NPCs, sem duplicar', () => {
  for (const careerId of CAREER_IDS) {
    const d = new LogisticsDay({ seed: 2026, roster: buildRoster(careerId) });
    const sector = CHARACTERS[careerId].sector;
    assert.equal(d.playerSector, sector);
    assert.equal(d.actorSector('jogador'), sector);
    assert.deepEqual(new Set(ACTORS.map((a) => d.actorSector(a))), new Set(SECTORS), 'quatro setores, um por ator');
    const npcNames = d.couriers.map((c) => c.name);
    assert.ok(!npcNames.includes(CHARACTERS[careerId].name), 'personagem ativo não aparece como NPC');
    assert.equal(new Set(npcNames).size, 3);
    for (const c of d.couriers) assert.equal(c.sector, CHARACTERS[d.roster[c.id]].sector);
    d.start(11);
    assert.ok(d.load('jogador').length > 0 && d.load('jogador').every((p) => p.sector === sector));
    d.phase = 'SACA';
    assert.equal(d.objective(16).title, `Retirar a carga ${sector} na ${SECTOR_DATA[sector].dock}`);
    assert.match(progressSummary(d.parcels, 'ENTREGAS', sector).mine, new RegExp(`/${d.load('jogador').length}$`));
    assert.match(baseSummary(d.parcels, 15, null, sector)[0], new RegExp(`Sua carga ${SECTOR_DATA[sector].dock}`));
  }
  assert.throws(() => new LogisticsDay({ roster: { ...buildRoster('personagem-norte'), npc2: 'personagem-norte' } }), /quatro personagens/);
});

/** Operação completa (coleta → base → triagem → saca → entregas) jogando uma carreira não-Oeste. */
for (const careerId of ['personagem-norte', 'personagem-sul'] as CareerId[]) test(`B1-01 F1: operação completa jogando ${careerId}, NPC em Oeste incluso`, () => {
  const d = new LogisticsDay({ seed: 2026, free: (x, z) => guard(x, z, 0.45), roster: buildRoster(careerId) });
  const sector = d.playerSector, dispatch = { player: { ...depotWorld(SECTOR_DATA[sector].x, -116.7), riding: false }, bike };
  const legacyCounter = { player: { ...DEPOT_SPOTS.dispatch, riding: false }, bike };
  assert.deepEqual({ ...d.playerDispatch }, depotWorld(SECTOR_DATA[sector].x, -116.7));
  d.start(11);
  const ids = d.parcels.map((p) => p.id);
  for (const kind of d.assigned) while (d.readyAt(kind).length) { assert.ok(d.collect(kind, 12) > 0); d.stow(12); }
  for (let t = 0; t < 1350; t += 0.1) {
    const hour = 12 + t / 150;
    if (d.trunkForDepot().length && !d.inHands().length) d.unloadForDepot(hour, false, parking);
    if (d.inHands().some((p) => p.state === 'EM_TRANSPORTE')) d.handOver(hour, receiving);
    d.update(hour, 0.1);
    for (const c of d.couriers) assert.notEqual(c.state, 'blocked', `${c.id}: ${c.error}`);
    if (d.canTakeSack(hour)) { assert.equal(d.takeSack(hour, legacyCounter), 0, 'balcão D02 não entrega carga de outro setor'); assert.ok(d.takeSack(hour, dispatch) > 0); d.stow(hour); }
    if (d.teamReady && !d.released) assert.ok(d.release(hour));
    if (d.released) for (const id of [...d.route]) { d.takeForAddress(id, hour); d.deliver(id, hour); }
    if (d.phase === 'CONCLUIDA') break;
  }
  assert.deepEqual(d.parcels.map((p) => p.id), ids, 'IDs estáveis, nenhum pacote criado ou perdido');
  assert.equal(d.count('ENTREGUE'), ids.length);
  assert.equal(d.phase, 'CONCLUIDA');
  assert.deepEqual(d.depot.errors, []);
  for (const p of d.parcels) {
    const deliverer = p.history.find((e) => e.state === 'EM_ROTA')!.holder;
    const actor = ACTORS.find((a) => a === deliverer)!;
    assert.equal(d.actorSector(actor), p.sector, `${p.id} entregue pelo dono do setor`);
  }
  const oesteNpc = d.couriers.find((c) => c.sector === 'Oeste')!;
  assert.equal(oesteNpc.state, 'complete', 'NPC no setor Oeste conclui a rota');
});
