import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRoadGraph, pathPose, routeBetween, nearestLane } from '../src/core/city/roadGraph.ts';
import { buildSignalPlans, signalState, laneAspect, SIGNAL_TIMING } from '../src/core/city/signals.ts';
import { CITY_LOTS, DEPOT, LANE_OFFSET, NODES, ROADS, STORES, depotWorld } from '../src/world/city/cityPlan.ts';
import { framePoint } from '../src/world/layout.ts';

const g = buildRoadGraph();

test('road graph on the real OSM network: two lanes per road, right-hand offset, every lane can continue', () => {
  assert.equal(g.lanes.length, ROADS.reduce((t, r) => t + (r.oneway ? 1 : 2), 0));
  for (const lane of g.lanes) {
    // Right of travel direction: the lane lies on the right of its road axis at its middle.
    const mid = pathPose(lane.path, lane.path.length / 2);
    const axis = lane.from === lane.road.a ? lane.road.pts : [...lane.road.pts].reverse();
    let best = { d: Infinity, side: 0 };
    for (let i = 1; i < axis.length; i++) {
      const a = axis[i - 1]!; const b = axis[i]!;
      const dx = b[0] - a[0]; const dz = b[1] - a[1]; const L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((mid.x - a[0]) * dx + (mid.z - a[1]) * dz) / L2));
      const px = a[0] + dx * t; const pz = a[1] + dz * t;
      const d = Math.hypot(mid.x - px, mid.z - pz);
      if (d < best.d) best = { d, side: dx * (mid.z - pz) - dz * (mid.x - px) };
    }
    const want = lane.road.oneway ? 0.4 : LANE_OFFSET;
    assert.ok(best.side < 0 && Math.abs(best.d - want) < 0.6, `${lane.id} drives on the right (${best.d.toFixed(2)} m)`);
    const end = NODES.find((n) => n.id === lane.to)!;
    if (!end.exit) assert.ok(lane.out.length > 0, `${lane.id} has a way out`);
    assert.ok(lane.path.length > 0.5);
  }
});

test('conflicts at real junctions: crossing and merging movements conflict, the matrix is symmetric', () => {
  const four = NODES.filter((n) => (g.byNode.get(n.id)?.length ?? 0) >= 12);
  assert.ok(four.length >= 20, `${four.length} four-way junctions`);
  for (const m of g.movements) for (const c of m.conflicts) assert.ok(g.movements[c]!.conflicts.includes(m.index), 'symmetric');
  let crossingPairs = 0;
  for (const n of four) {
    const ms = g.byNode.get(n.id)!.map((i) => g.movements[i]!);
    const straights = ms.filter((m) => m.turn === 'straight');
    for (const a of straights) for (const b of straights) if (a !== b && a.conflicts.includes(b.index)) crossingPairs++;
  }
  assert.ok(crossingPairs > 0, 'perpendicular straights conflict');
  for (const m of g.movements) assert.ok(m.maxSpeed >= 2.2);
});

test('urban-preview signals control selected junctions while unsignalled PARE still works', () => {
  const plans = buildSignalPlans(g);
  assert.ok(plans.size >= 1 && plans.size <= 5, `fictional signal sites: ${plans.size}`);
  assert.ok(NODES.some((n) => n.control === 'stop'), 'minor arms still obey PARE');
  for (const plan of plans.values()) for (let i = 0; i < 240; i++) {
    const t = i * 0.5;
    const state = signalState(plan, t);
    assert.ok(plan.approaches.filter((l) => laneAspect(plan, l, t) === 'green').length <= 1, 'at most one green');
    if (state.ped === 'walk') assert.equal(state.approach, null, 'pedestrian WALK excludes green vehicles');
  }
  assert.ok(SIGNAL_TIMING.green > 0 && SIGNAL_TIMING.walk > 0);
});

test('routing on the real network: every shop is reachable and trucks reach the depot on heavy roads', () => {
  const heavy = (l: { road: { heavy: boolean } }) => l.road.heavy;
  const entries = g.lanes.filter((l) => NODES.find((n) => n.id === l.from)!.exit && l.road.heavy);
  assert.ok(entries.length > 0);
  const gate = depotWorld((DEPOT.gate.x0 + DEPOT.gate.x1) / 2, DEPOT.lot.maxZ);
  const dock = nearestLane(g, gate.x, gate.z, (l) => l.road.kind !== 'rural')!;
  assert.ok(dock.distance < 8, `depot gate on a street (${dock.distance.toFixed(1)} m)`);
  assert.ok(entries.some((e) => routeBetween(g, e.index, dock.lane.index, heavy)), 'a truck can reach the depot');
  for (const { stop } of STORES) {
    const near = nearestLane(g, stop.x, stop.z, (l) => l.road.kind !== 'rural')!;
    assert.ok(near.distance < 1.5, `store stop on a lane (${near.distance.toFixed(2)})`);
    assert.ok(near.lane.index === dock.lane.index || routeBetween(g, dock.lane.index, near.lane.index, (l) => l.road.kind !== 'rural'), 'van route depot → shop');
  }
});

import { Traffic, type Vehicle } from '../src/core/city/traffic.ts';

function obbOverlap(a: Vehicle, b: Vehicle): boolean {
  const axes = [a.yaw, a.yaw + Math.PI / 2, b.yaw, b.yaw + Math.PI / 2].map((y) => [Math.sin(y), Math.cos(y)] as const);
  const corners = (v: Vehicle) => {
    const f = [Math.sin(v.yaw), Math.cos(v.yaw)]; const r = [Math.cos(v.yaw), -Math.sin(v.yaw)];
    // 0.35 m tolerance: rigid footprints of long vehicles cut the inside of real road bends.
    const hl = v.spec.length / 2 - 0.35; const hw = v.spec.width / 2 - 0.2;
    return [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([i, j]) => [v.x + f[0]! * hl * i! + r[0]! * hw * j!, v.z + f[1]! * hl * i! + r[1]! * hw * j!]);
  };
  const ca = corners(a); const cb = corners(b);
  return axes.every(([ax, az]) => {
    const pa = ca.map(([x, z]) => x! * ax + z! * az); const pb = cb.map(([x, z]) => x! * ax + z! * az);
    return Math.max(...pa) > Math.min(...pb) && Math.max(...pb) > Math.min(...pa);
  });
}

const OFF_ROAD = (() => { const l = CITY_LOTS[0]!; const p = framePoint(l.frame, l.width / 2, l.depth / 2); return { x: p.x, z: p.z, radius: 0.6 }; })();

function simulate(seconds: number, onFrame: (t: Traffic, time: number) => void, ctxPatch: Partial<{ player: { x: number; z: number; radius: number }; busy: (n: string, r: string) => boolean }> = {}) {
  const plans = buildSignalPlans(g);
  const traffic = new Traffic(g, plans, { capacity: 26, seed: 7 });
  let time = 0;
  const ctx = () => ({ time, player: ctxPatch.player ?? OFF_ROAD, crosswalkBusy: ctxPatch.busy ?? (() => false), density: 1, logistics: true });
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
  for (const k of ['van:store', 'van:dock']) assert.ok(served.has(k), `${k} served (${[...served].join(',')})`);
});

test('vehicles brake for the player standing on the lane and keep a safety gap', () => {
  // The busiest real street: the secondary road through the town (Rua Quinze de Novembro).
  const lane = [...g.lanes].filter((l) => l.road.highway === 'secondary' && l.road.kind === 'urban').sort((a, b) => b.path.length - a.path.length)[0]!;
  const p = pathPose(lane.path, lane.path.length * 0.7);
  const block = { x: p.x, z: p.z, radius: 0.6 };
  let closest = Infinity;
  simulate(120, (t) => {
    for (const v of t.vehicles) {
      if (!v.active || v.seg.kind !== 'lane' || v.seg.index !== lane.index || v.s > lane.path.length * 0.7) continue;
      closest = Math.min(closest, Math.hypot(v.x - p.x, v.z - p.z) - v.spec.length / 2);
    }
  }, { player: block });
  assert.ok(closest > 0.4, `front bumper stops ${closest.toFixed(2)} m from the player`);
});

test('PARE arms force a full stop and pedestrians on a crosswalk hold traffic', () => {
  const stopNode = NODES.find((n) => n.control === 'stop')!;
  const arms = ROADS.filter((r) => r.a === stopNode.id || r.b === stopNode.id);
  const minor = Math.min(...arms.map((r) => r.priority));
  const held = arms[0]!.id;
  let entered = 0; let rolled = 0;
  const last = new Map<number, string>();
  simulate(200, (t) => {
    for (const v of t.vehicles) {
      if (!v.active) continue;
      const key = `${v.seg.kind}${v.seg.index}`;
      if (v.seg.kind === 'move' && last.get(v.id) !== key) {
        const m = g.movements[v.seg.index]!;
        const lane = g.lanes[m.from]!;
        if (m.node === stopNode.id && (lane.road.id === held || g.lanes[m.to]!.road.id === held)) entered++;
        if (m.node !== stopNode.id) {
          const node = NODES.find((n) => n.id === m.node)!;
          const prio = ROADS.filter((r) => r.a === node.id || r.b === node.id).map((r) => r.priority);
          if (node.control === 'stop' && lane.road.priority < Math.max(...prio) && !v.stoppedAtLine) rolled++;
        }
      }
      last.set(v.id, key);
    }
  }, { busy: (n, r) => n === stopNode.id && r === held });
  assert.equal(entered, 0, 'nobody drives over the occupied crosswalk');
  assert.equal(rolled, 0, 'minor approaches stop at the PARE line');
  void minor;
});
