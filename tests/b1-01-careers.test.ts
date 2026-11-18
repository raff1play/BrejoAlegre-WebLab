import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CAREER_IDS, CHARACTERS, DEFAULT_CAREER, HOME_IDS, HOME_LOTS, actorOfCareer, actorSector, assertRoster,
  buildRoster, careerHome, careerOfSector, homeOf, type CareerId,
} from '../src/core/career/careers.ts';
import { ACTORS } from '../src/core/delivery/dailyDemand.ts';
import { SECTORS, SECTOR_DATA, sectorOf } from '../src/core/delivery/sectors.ts';
import { buildAddresses } from '../src/core/delivery/addresses.ts';
import { streetRoute } from '../src/core/city/streetRoute.ts';
import { nearestRoad } from '../src/world/city/cityPlan.ts';
import { ROAD_HALF } from '../src/world/layout.ts';
import { DEPOT_SPOTS } from '../src/core/delivery/workday.ts';

test('B1-01 F1 AC-01: quatro personagens com IDs, setores e casas distintos', () => {
  assert.equal(CAREER_IDS.length, 4);
  assert.equal(new Set(CAREER_IDS).size, 4);
  assert.deepEqual(new Set(CAREER_IDS.map((c) => CHARACTERS[c].sector)), new Set(SECTORS));
  assert.equal(new Set(CAREER_IDS.map((c) => CHARACTERS[c].homeId)).size, 4);
  assert.deepEqual(new Set(CAREER_IDS.map((c) => CHARACTERS[c].homeId)), new Set(HOME_IDS));
  for (const c of CAREER_IDS) {
    assert.equal(CHARACTERS[c].careerId, c);
    assert.equal(careerOfSector(CHARACTERS[c].sector), c, 'um personagem por setor');
    assert.ok(Object.isFrozen(CHARACTERS), 'definições imutáveis');
  }
  // Os NPCs existentes mantêm nome e setor (Rosa=Norte, Caio=Leste, Davi=Sul).
  assert.equal(CHARACTERS['personagem-norte'].name, 'Rosa');
  assert.equal(CHARACTERS['personagem-leste'].name, 'Caio');
  assert.equal(CHARACTERS['personagem-sul'].name, 'Davi');
  assert.equal(CHARACTERS[DEFAULT_CAREER].sector, 'Oeste', 'save legado = jogador Oeste');
});

test('B1-01 F1 casas fixas: lote real, no próprio setor, fora dos endereços de entrega e navegável', () => {
  const deliverable = new Set(buildAddresses().map((a) => a.lot));
  const lots = new Set<string>();
  for (const id of HOME_IDS) {
    const h = homeOf(id);
    assert.equal(h.lot, HOME_LOTS[id]);
    assert.ok(!lots.has(h.lot)); lots.add(h.lot);
    assert.ok(!deliverable.has(h.lot), `${id} não é destino de entrega`);
    assert.equal(sectorOf(h.door), h.sector, `${id} dentro do setor ${h.sector}`);
    assert.equal(CHARACTERS[h.careerId].homeId, id);
    assert.equal(careerHome(h.careerId), h);
    const road = nearestRoad(h.stop.x, h.stop.z)!;
    assert.ok(road.d < ROAD_HALF, `${id}: parada no leito da rua (${road.d.toFixed(2)} m)`);
    const route = streetRoute(DEPOT_SPOTS.entry, h.stop);
    assert.ok(route && Number.isFinite(route.length) && route.length > 0, `${id}: rota pela malha viária até a base`);
  }
});

test('B1-01 F1 roster: um e somente um personagem como jogador, os outros três como NPCs', () => {
  for (const active of CAREER_IDS) {
    const r = buildRoster(active);
    assertRoster(r);
    assert.equal(r.jogador, active);
    assert.equal(ACTORS.filter((a) => r[a] === active).length, 1, 'jogador não duplica como NPC');
    assert.equal(actorOfCareer(r, active), 'jogador');
    assert.equal(actorSector(r, 'jogador'), CHARACTERS[active].sector);
    assert.deepEqual(new Set(ACTORS.map((a) => actorSector(r, a))), new Set(SECTORS), 'quatro setores cobertos');
    assert.ok(Object.isFrozen(r));
  }
  // Legado preservado: jogando Oeste, npc1/2/3 = Norte/Leste/Sul (mesmas vagas e docas de hoje).
  const legacy = buildRoster(DEFAULT_CAREER);
  assert.deepEqual({ ...legacy }, { jogador: 'personagem-oeste', npc1: 'personagem-norte', npc2: 'personagem-leste', npc3: 'personagem-sul' });
  for (const s of SECTORS) assert.equal(actorOfCareer(legacy, careerOfSector(s)), SECTOR_DATA[s].actor);
  assert.throws(() => buildRoster('personagem-centro' as CareerId));
  assert.throws(() => assertRoster({ ...legacy, npc1: 'personagem-oeste' }));
});
