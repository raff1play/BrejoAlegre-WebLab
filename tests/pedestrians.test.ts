import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionGuard } from '../src/core/collision.ts';
import { WORLD_BOUNDS, buildColliders } from '../src/world/layout.ts';
import { cityAllColliders } from '../src/world/city/cityLayout.ts';
import { Crowd, buildWalkGraph } from '../src/core/city/pedestrians.ts';
import { buildRoadGraph } from '../src/core/city/roadGraph.ts';
import { buildSignalPlans, signalState } from '../src/core/city/signals.ts';
import { Traffic } from '../src/core/city/traffic.ts';

const guard = createMotionGuard(WORLD_BOUNDS, [...buildColliders(), ...cityAllColliders()]);
const free = (x: number, z: number) => guard(x, z, 0.3);

test('sidewalk graph is connected, stays on walkable ground and has crosswalks at the zebras', () => {
  const g = buildWalkGraph();
  const seen = new Set([0]); const stack = [0];
  while (stack.length) { const p = stack.pop()!; for (const ei of g.adj[p]!) { const e = g.edges[ei]!; const q = e.a === p ? e.b : e.a; if (!seen.has(q)) { seen.add(q); stack.push(q); } } }
  assert.equal(seen.size, g.points.length, 'one connected network');
  assert.ok(g.edges.filter((e) => e.cross).length >= 20);
  for (const e of g.edges) {
    if (e.cross) continue;
    const a = g.points[e.a]!; const b = g.points[e.b]!;
    for (let k = 0; k <= 10; k++) {
      const x = a.x + (b.x - a.x) * (k / 10); const z = a.z + (b.z - a.z) * (k / 10);
      assert.ok(guard(x, z, 0.2), `pavement free at ${x.toFixed(1)},${z.toFixed(1)}`);
    }
  }
});

test('pedestrians walk to shops, the square and bus stops, crossing only on walk or when clear', () => {
  const rg = buildRoadGraph();
  const plans = buildSignalPlans(rg);
  const traffic = new Traffic(rg, plans, { capacity: 20, seed: 3 });
  const crowd = new Crowd(40, free, 11);
  let time = 0;
  const player = { x: 20, z: -40, radius: 0.6 };
  const pctx = () => ({
    time, hour: 12, people: 1, commerceOpen: true, player,
    pedAspect: (n: string) => { const p = plans.get(n); return p ? signalState(p, time).ped : null; },
    armClear: (n: string, r: string) => traffic.armClear(n, r),
    busAt: (x: number, z: number) => traffic.busAt(x, z) !== null,
  });
  const tctx = () => ({ time, player, crosswalkBusy: (n: string, r: string) => crowd.crosswalkBusy(n, r), density: 1, logistics: true });
  traffic.populate(tctx(), true);
  crowd.populate(pctx(), true);
  const states = new Set<string>();
  let badCross = 0; let offWorld = 0; let samples = 0;
  const prev = new Map<number, string>();
  for (let i = 0; i < 30 * 240; i++) {
    time += 1 / 30;
    traffic.update(1 / 30, tctx());
    crowd.update(1 / 30, pctx());
    for (const p of crowd.people) {
      if (!p.active) continue;
      states.add(p.state + (p.goal ? ':' + p.goal.kind : ''));
      if (prev.get(p.id) !== 'cross' && p.state === 'cross') {
        const c = p.legs[0]!.cross!;
        const plan = plans.get(c.node);
        if (plan && signalState(plan, time).ped !== 'walk') badCross++;
      }
      prev.set(p.id, p.state);
      const entering = (p.goal?.kind === 'shop' || p.goal?.kind === 'visit') && p.legs.length <= 2;
      if (p.visible) samples++;
      if (p.visible && p.state !== 'cross' && !entering && !guard(p.x, p.z, 0.05)) offWorld++;
    }
  }
  assert.equal(badCross, 0, 'signalised crossings start only on the walk aspect');
  for (const s of ['walk', 'waitCross', 'cross', 'inside:shop', 'idle:square', 'waitBus:bus']) {
    assert.ok([...states].some((k) => k.startsWith(s)), `${s} reached (${[...states].join(',')})`);
  }
  // Tolerance: door thresholds inside store setbacks and brushing past bus shelters.
  assert.ok(offWorld < samples * 0.01, `pedestrians stay out of walls (${offWorld}/${samples})`);
});
