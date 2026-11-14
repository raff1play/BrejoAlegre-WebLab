import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME_SIGNAL_IDS, NODES, ROADS } from '../src/world/city/cityPlan.ts';
import { armPose, streetPaint, zebraSites } from '../src/world/city/urbanDetail.ts';
import { roadDistance } from '../src/world/geo/geoCity.ts';
import { buildRoadGraph } from '../src/core/city/roadGraph.ts';
import { buildSignalPlans, laneAspect, signalState } from '../src/core/city/signals.ts';
import { ROAD_HALF } from '../src/world/layout.ts';

test('street preview: new paint follows the actual OSM streets with no stripes through lots', () => {
  const m = streetPaint();
  const zebra = m.filter((p) => p.kind === 'zebra');
  const stop = m.filter((p) => p.kind === 'stop');
  const local = m.filter((p) => p.kind === 'centre');
  assert.ok(zebra.length > 20 && zebra.length % 6 === 0, `zebra strokes: ${zebra.length}`);
  assert.ok(local.length > 10, `residential centre marks: ${local.length}`);
  assert.ok(stop.length > 0, `stop bars: ${stop.length}`);
  for (const p of m) {
    assert.ok(p.width > 0 && p.width < 0.5 && p.start.every(Number.isFinite) && p.end.every(Number.isFinite));
    assert.ok(ROADS.some((r) => r.id === p.roadId));
    const midpoint = { x: (p.start[0] + p.end[0]) / 2, z: (p.start[1] + p.end[1]) / 2 };
    assert.ok(roadDistance(midpoint.x, midpoint.z) <= ROAD_HALF + 0.25, `${p.kind}: painted mark off the carriageway`);
  }
  const sites = zebraSites();
  assert.equal(zebra.length, sites.length * 6, 'six bars per crossing');
  for (const z of sites) {
    assert.ok(roadDistance(z.x, z.z) < 0.2, `${z.roadId}: crosswalk must be on street axis`);
    assert.ok(Math.abs(Math.hypot(z.dirX, z.dirZ) - 1) < 1e-5);
  }
});

test('street preview: fictional traffic signals placed at separate, safe urban junctions', () => {
  assert.ok(GAME_SIGNAL_IDS.size >= 1 && GAME_SIGNAL_IDS.size <= 5, `signals: ${GAME_SIGNAL_IDS.size}`);
  const nodes = NODES.filter((n) => n.control === 'signal');
  assert.equal(nodes.length, GAME_SIGNAL_IDS.size);
  for (const n of nodes) {
    const arms = ROADS.filter((r) => r.a === n.id || r.b === n.id);
    assert.ok(!n.exit && arms.length >= 3);
    assert.ok(arms.every((r) => r.kind === 'urban' && r.length >= 20));
    for (const other of nodes) if (other.id !== n.id) assert.ok(Math.hypot(n.x - other.x, n.z - other.z) >= 95);
    for (const arm of arms) {
      const p = armPose(arm, n.id, 6);
      assert.ok(roadDistance(p.x, p.z) < 0.2);
    }
  }
  const plans = buildSignalPlans(buildRoadGraph());
  assert.equal(plans.size, GAME_SIGNAL_IDS.size, 'AI traffic controller is actually connected');
  for (const p of plans.values()) {
    assert.ok(p.approaches.length >= 3);
    for (const t of [0, 2, 7, 10, 15, 30, 50, 75, 110]) {
      const s = signalState(p, t);
      const green = p.approaches.filter((lane) => laneAspect(p, lane, t) === 'green');
      assert.ok(green.length <= 1, 'no conflicting greens');
      if (s.ped === 'walk') assert.equal(green.length, 0, 'pedestrian phase excludes car green');
    }
  }
});
