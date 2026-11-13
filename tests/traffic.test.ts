import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadGraph, pathPose, routeBetween, nearestLane } from '../src/core/city/roadGraph.ts';
import { buildSignalPlans, signalState, laneAspect, SIGNAL_TIMING } from '../src/core/city/signals.ts';
import { NODES, ROADS, STORES } from '../src/world/city/cityPlan.ts';

const g = buildRoadGraph();

test('road graph: two lanes per road, right-hand offset, every lane can continue', () => {
  assert.equal(g.lanes.length, ROADS.length * 2);
  for (const lane of g.lanes) {
    const mid = pathPose(lane.path, lane.path.length / 2);
    // Right of travel direction: cross(dir, offset) < 0.
    const a = NODES.find((n) => n.id === lane.from)!;
    const ox = mid.x - a.x; const oz = mid.z - a.z;
    const side = lane.dir.x * oz - lane.dir.z * ox;
    assert.ok(side < 0, `${lane.id} drives on the right`);
    const end = NODES.find((n) => n.id === lane.to)!;
    if (!end.exit) assert.ok(lane.out.length > 0, `${lane.id} has a way out`);
  }
  const docas = g.byNode.get('docas')!;
  assert.equal(docas.length, 1);
  assert.equal(g.movements[docas[0]!]!.turn, 'uturn');
  const uturn = g.movements[docas[0]!]!;
  const start = pathPose(uturn.path, 0.01);
  const dyaw = start.yaw - Math.atan2(g.lanes[uturn.from]!.dir.x, g.lanes[uturn.from]!.dir.z);
  assert.ok(Math.abs(Math.atan2(Math.sin(dyaw), Math.cos(dyaw))) < 0.7, 'U-turn starts forward');
});

test('conflicts: crossing and merging movements conflict, opposing straights do not', () => {
  const at = (node: string) => g.byNode.get(node)!.map((i) => g.movements[i]!);
  const centro = at('centro');
  assert.equal(centro.length, 12, '4 approaches × 3 movements');
  const find = (from: string, to: string) => centro.find((m) => g.lanes[m.from]!.id === from && g.lanes[m.to]!.id === to)!;
  const nsStraight = find('av-centro:norte>centro', 'av-sul:centro>sul');
  const snStraight = find('av-sul:sul>centro', 'av-centro:centro>norte');
  const weStraight = find('coroados-oeste:oeste>centro', 'coroados-leste:centro>leste');
  const snLeft = find('av-sul:sul>centro', 'coroados-oeste:centro>oeste');
  assert.ok(!nsStraight.conflicts.includes(snStraight.index));
  assert.ok(nsStraight.conflicts.includes(weStraight.index));
  assert.ok(snLeft.conflicts.includes(nsStraight.index));
  for (const m of g.movements) for (const c of m.conflicts) assert.ok(g.movements[c]!.conflicts.includes(m.index), 'symmetric');
  for (const m of g.movements) assert.ok(m.maxSpeed >= 2.2 && (m.turn === 'straight' ? m.maxSpeed > 20 : m.maxSpeed < 9));
});

test('signals never give green to conflicting movements, include yellow, all-red and a pedestrian phase', () => {
  const plans = buildSignalPlans(g);
  assert.deepEqual([...plans.keys()].sort(), NODES.filter((n) => n.control === 'signal').map((n) => n.id).sort());
  for (const plan of plans.values()) {
    const seen = new Set<string>();
    for (let t = 0; t < plan.cycle * 2; t += 0.25) {
      const s = signalState(plan, t);
      seen.add(s.aspect + '/' + s.ped);
      const open = plan.approaches.filter((l) => laneAspect(plan, l, t) !== 'red');
      assert.ok(open.length <= 1, 'one approach at a time');
      if (s.ped !== 'stop') assert.equal(open.length, 0, 'pedestrians cross with all vehicles red');
      const greens = g.movements.filter((m) => m.node === plan.node && open.includes(m.from));
      for (const a of greens) for (const b of greens) assert.ok(!a.conflicts.includes(b.index), 'no conflicting greens');
    }
    for (const k of ['green/stop', 'yellow/stop', 'red/stop', 'red/walk', 'red/flash']) assert.ok(seen.has(k), `${plan.node} has ${k}`);
    // All-red between consecutive greens.
    const t0 = (plan.cycle - plan.offset % plan.cycle) % plan.cycle + SIGNAL_TIMING.green + SIGNAL_TIMING.yellow + 0.5;
    assert.equal(signalState(plan, t0).approach, null);
  }
});

test('routing: vans reach every store lane and trucks reach the docks on heavy roads only', () => {
  const heavy = (l: { road: { heavy: boolean } }) => l.road.heavy;
  const start = g.laneById.get('av-saida-sul:saida-sul>sul')!;
  const dock = g.laneById.get('patio:portao>docas')!;
  const route = routeBetween(g, start.index, dock.index, heavy)!;
  assert.ok(route.length > 0);
  for (const mi of route) assert.ok(g.lanes[g.movements[mi]!.to]!.road.heavy);
  const back = routeBetween(g, g.laneById.get('patio:docas>portao')!.index, g.laneById.get('av-saida-norte:norte>saida-norte')!.index, heavy);
  assert.ok(back && back.length > 0);
  const out = g.laneById.get('patio:docas>portao')!;
  for (const { stop } of STORES) {
    const near = nearestLane(g, stop.x, stop.z, (l) => l.road.kind !== 'rural')!;
    assert.ok(near.distance < 0.6, `store stop on a lane (${near.distance.toFixed(2)})`);
    assert.ok(routeBetween(g, out.index, near.lane.index, (l) => l.road.kind !== 'rural'));
  }
});

import { Traffic, type Vehicle } from '../src/core/city/traffic.ts';

function obbOverlap(a: Vehicle, b: Vehicle): boolean {
  const axes = [a.yaw, a.yaw + Math.PI / 2, b.yaw, b.yaw + Math.PI / 2].map((y) => [Math.sin(y), Math.cos(y)] as const);
  const corners = (v: Vehicle) => {
    const f = [Math.sin(v.yaw), Math.cos(v.yaw)]; const r = [Math.cos(v.yaw), -Math.sin(v.yaw)];
    const hl = v.spec.length / 2 - 0.15; const hw = v.spec.width / 2 - 0.1;
    return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => [v.x + f[0]! * hl * i! + r[0]! * hw * j!, v.z + f[1]! * hl * i! + r[1]! * hw * j!]);
  };
  const ca = corners(a); const cb = corners(b);
  return axes.every(([ax, az]) => {
    const pa = ca.map(([x, z]) => x! * ax + z! * az); const pb = cb.map(([x, z]) => x! * ax + z! * az);
    return Math.max(...pa) > Math.min(...pb) && Math.max(...pb) > Math.min(...pa);
  });
}

function simulate(seconds: number, onFrame: (t: Traffic, time: number) => void, ctxPatch: Partial<{ player: { x: number; z: number; radius: number }; busy: (n: string, r: string) => boolean }> = {}) {
  const plans = buildSignalPlans(g);
  const traffic = new Traffic(g, plans, { capacity: 26, seed: 7 });
  let time = 0;
  const ctx = () => ({ time, player: ctxPatch.player ?? { x: 20, z: -40, radius: 0.6 }, crosswalkBusy: ctxPatch.busy ?? (() => false), density: 1, logistics: true });
  traffic.populate(ctx(), true);
  for (let i = 0; i < seconds * 30; i++) { time += 1 / 30; traffic.update(1 / 30, ctx()); onFrame(traffic, time); }
  return { traffic, plans };
}

test('vehicles: no collisions, no gridlock, buses/vans/trucks serve their stops (5 virtual-free minutes)', () => {
  const plans = buildSignalPlans(g);
  let collisions = 0; let maxWait = 0; let frame = 0;
  const served = new Set<string>();
  const seg = new Map<number, string>();
  let redRuns = 0;
  simulate(300, (t, time) => {
    frame++;
    const act = t.vehicles.filter((v) => v.active);
    for (const v of act) {
      maxWait = Math.max(maxWait, v.wait);
      if (v.dwell > 0) served.add(`${v.kind}:${v.target?.what ?? 'stop'}`);
      const key = `${v.seg.kind}${v.seg.index}`;
      if (seg.get(v.id) !== key && v.seg.kind === 'move') {
        const m = g.movements[v.seg.index]!;
        const plan = plans.get(m.node);
        if (plan) { const st = signalState(plan, time); if (st.approach !== null && st.approach !== m.from) redRuns++; }
      }
      seg.set(v.id, key);
    }
    if (frame % 10 === 0) for (let a = 0; a < act.length; a++) for (let b = a + 1; b < act.length; b++) if (obbOverlap(act[a]!, act[b]!)) collisions++;
  });
  assert.equal(collisions, 0, 'vehicle footprints never overlap');
  assert.equal(redRuns, 0, 'nobody enters while another approach has green');
  assert.ok(maxWait < 90, `longest wait ${maxWait.toFixed(0)} s`);
  for (const k of ['bus:stop', 'van:store', 'van:dock', 'truck:dock']) assert.ok(served.has(k), `${k} served`);
});

test('vehicles brake for the player standing on the lane and keep a safety gap', () => {
  const lane = g.laneById.get('nove-leste:norte>ne')!;
  const block = { x: 40, z: lane.path.points[0]!.z, radius: 0.6 };
  let closest = Infinity;
  simulate(90, (t) => {
    for (const v of t.vehicles) {
      if (!v.active || v.seg.kind !== 'lane' || v.seg.index !== lane.index) continue;
      if (v.x < block.x) closest = Math.min(closest, block.x - (v.x + v.spec.length / 2));
    }
  }, { player: block });
  assert.ok(closest > 0.4 && closest < 30, `front bumper stops ${closest.toFixed(2)} m from the player`);
});

test('stop signs force a full stop and pedestrians on a crosswalk hold traffic', () => {
  const plans = buildSignalPlans(g);
  void plans;
  let entered = 0; let rolled = 0;
  const last = new Map<number, string>();
  simulate(200, (t) => {
    for (const v of t.vehicles) {
      if (!v.active) continue;
      const key = `${v.seg.kind}${v.seg.index}`;
      if (v.seg.kind === 'move' && last.get(v.id) !== key) {
        const m = g.movements[v.seg.index]!;
        const lane = g.lanes[m.from]!;
        if (m.node === 'oeste' && (lane.road.id === 'coroados-oeste' || g.lanes[m.to]!.road.id === 'coroados-oeste')) entered++;
        if (m.node === 'norte' && lane.road.id.startsWith('nove') && !v.stoppedAtLine) rolled++;
      }
      last.set(v.id, key);
    }
  }, { busy: (n, r) => n === 'oeste' && r === 'coroados-oeste' });
  assert.equal(entered, 0, 'nobody drives over the occupied crosswalk');
  assert.equal(rolled, 0, 'minor approaches stop at the PARE line');
});
