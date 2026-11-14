import test from 'node:test';
import assert from 'node:assert/strict';
import { ROAD_HALF } from '../src/world/layout.ts';
import { roadDistance, OPEN_SPACES, pointInPolygon } from '../src/world/geo/geoCity.ts';
import { NODES } from '../src/world/city/cityPlan.ts';
import { clearOfFixtures, validFixtureSite } from '../src/world/city/fixturePlacement.ts';
import { cityTrees, shopFurniture, streetLightPositions } from '../src/world/city/cityLayout.ts';
import { signalFixturePositions } from '../src/world/city/signalFixtures.ts';
import { buildRoadGraph } from '../src/core/city/roadGraph.ts';
import { buildSignalPlans } from '../src/core/city/signals.ts';
import { buildWalkGraph } from '../src/core/city/pedestrians.ts';

test('urban equipment: every lamp sits on actual raised sidewalk, not in a lane or a house', () => {
  const lights = streetLightPositions();
  const deco = shopFurniture();
  const trees = cityTrees();
  console.log('urban-placement census', JSON.stringify({ regular: lights.length, decorative: deco.lamps.length, trees: trees.length }));
  assert.ok(lights.length > 0, 'must still illuminate town');
  assert.equal(deco.planters.length, 8, 'all storefront planter assets remain');
  for (const p of [...lights, ...deco.lamps]) {
    assert.ok(validFixtureSite(p, 0.17), `post outside sidewalk: ${p.x.toFixed(1)},${p.z.toFixed(1)} distance ${roadDistance(p.x, p.z).toFixed(2)}`);
  }
  for (const p of lights) {
    assert.ok(clearOfFixtures(p, deco.lamps, 3.39), 'common pole vs colonial shop lamp');
    assert.ok(clearOfFixtures(p, NODES.filter((n) => n.control === 'signal'), 14.99), 'common pole vs signal junction');
  }
  const parks = OPEN_SPACES.filter((a) => a.kind === 'leisure:park');
  for (const t of trees) {
    if (parks.some((a) => pointInPolygon(a.pts, t.x, t.z))) continue;
    assert.ok(validFixtureSite(t, 0.27), 'street tree must stand on a raised pavement');
  }
});

test('urban equipment: traffic signals use pavement offsets including one-way lanes', () => {
  const graph = buildRoadGraph();
  const plans = buildSignalPlans(graph);
  const fixtures = signalFixturePositions(graph, plans, buildWalkGraph());
  const veh = fixtures.filter((f) => !f.ped), ped = fixtures.filter((f) => f.ped);
  console.log('signal-placement census', JSON.stringify({ plans: plans.size, inbound: [...plans.values()].reduce((t,p)=>t+p.approaches.length,0), veh: veh.length, ped: ped.length, oneWay: veh.filter((f) => graph.lanes[f.lane]?.road.oneway).length }));
  assert.ok(plans.size > 0, 'traffic lights remain active');
  assert.ok(veh.length > 0, 'at least one signal head is visible');
  for (const f of fixtures) {
    assert.ok(validFixtureSite(f, f.ped ? 0.17 : 0.20), 'signal pole must be on a walkable pavement');
    assert.ok(roadDistance(f.x, f.z) > ROAD_HALF, 'never install a signal in traffic');
    assert.ok(clearOfFixtures(f, streetLightPositions(), 1.99), 'signal separated from public lighting');
    assert.ok(clearOfFixtures(f, shopFurniture().lamps, 1.99), 'signal separated from shop lighting');
    assert.ok(plans.has(f.node));
  }
});
