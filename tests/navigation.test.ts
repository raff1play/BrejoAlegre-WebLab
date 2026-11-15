import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NAV, arcLengths, nextInstruction, nextZoomTarget, pointAt, projectOnRoute, routeManeuvers, shouldReroute, turnAngle, zoomForSpeed,
  type RerouteState,
} from '../src/core/city/navigation.ts';
import { NODE_DEGREE, streetRoute, type StreetRoute } from '../src/core/city/streetRoute.ts';
import { NODES, STORES, depotWorld } from '../src/world/city/cityPlan.ts';
import { buildAddresses } from '../src/core/delivery/addresses.ts';

/** Heading of the bike after turning: positive steer turns right and grows the yaw. */
const yawOf = (dx: number, dz: number) => Math.atan2(dx, dz);

test('turn sign matches the bike: north → east is a right turn, north → west a left turn', () => {
  assert.ok(turnAngle(0, 1, 1, 0) < 0, 'right is negative');
  assert.ok(turnAngle(0, 1, -1, 0) > 0, 'left is positive');
  assert.ok(Math.abs(turnAngle(0, 1, 0, 1)) < 1e-12);
  // Same convention as the motorcycle: a right turn increases the yaw.
  assert.ok(yawOf(1, 0) > yawOf(0, 1));
});

/** Synthetic plus-shaped junction "J" (degree 4) with a 100 m route through it. */
function route(points: [number, number][], junctionIndex: number): StreetRoute {
  const arcs = arcLengths(points);
  return { points, length: arcs[arcs.length - 1]!, junctions: [{ index: junctionIndex, node: 'J' }] };
}
const DEGREE = new Map([['J', 4], ['B', 2]]);

test('manoeuvres: left/right at real junctions only, straight-on and bends are not announced', () => {
  const right = routeManeuvers(route([[0, -50], [0, 0], [50, 0]], 1), DEGREE);
  assert.equal(right.length, 1);
  assert.equal(right[0]!.kind, 'right');
  assert.equal(right[0]!.s, 50);
  const left = routeManeuvers(route([[0, -50], [0, 0], [-50, 0]], 1), DEGREE);
  assert.equal(left[0]!.kind, 'left');
  // Straight across the junction: nothing to announce.
  assert.equal(routeManeuvers(route([[0, -50], [0, 0], [0, 50]], 1), DEGREE).length, 0);
  // A gentle 20° fork is not a turn.
  assert.equal(routeManeuvers(route([[0, -50], [0, 0], [Math.sin(0.35) * 50, Math.cos(0.35) * 50]], 1), DEGREE).length, 0);
  // A sharp bend where only two streets meet is the road itself, not a decision.
  const bend: StreetRoute = { ...route([[0, -50], [0, 0], [50, 0]], 1), junctions: [{ index: 1, node: 'B' }] };
  assert.equal(routeManeuvers(bend, DEGREE).length, 0);
});

test('next instruction: distance to the next turn, then straight on to the destination', () => {
  const r = route([[0, -50], [0, 0], [50, 0]], 1);
  const m = routeManeuvers(r, DEGREE);
  const arcs = arcLengths(r.points);
  const at = projectOnRoute(r.points, arcs, 1.5, -20);
  assert.ok(Math.abs(at.s - 30) < 1e-9 && Math.abs(at.d - 1.5) < 1e-9);
  assert.deepEqual(nextInstruction(m, at.s, r.length), { kind: 'right', distance: 20 });
  // Past the turn: straight on, distance to the end.
  const after = projectOnRoute(r.points, arcs, 20, 0.5);
  assert.deepEqual(nextInstruction(m, after.s, r.length), { kind: 'straight', distance: 30 });
  assert.deepEqual(pointAt(r.points, arcs, 75), [25, 0]);
});

test('real network: every announced turn is at a junction of 3+ streets and agrees with the geometry', () => {
  const depot = depotWorld(84, -111);
  const addresses = buildAddresses();
  const ids = new Set(NODES.map((n) => n.id));
  let turns = 0; let routes = 0;
  for (let i = 0; i < addresses.length; i += 4) {
    for (const [a, b] of [[depot, addresses[i]!.door], [STORES[i % 8]!.door, addresses[i]!.door]] as const) {
      const r = streetRoute(a, b);
      assert.ok(r, 'a route exists');
      routes++;
      for (const j of r.junctions) {
        assert.ok(ids.has(j.node), 'junctions are network nodes');
        assert.ok(j.index > 0 && j.index < r.points.length - 1);
        const n = NODES.find((q) => q.id === j.node)!;
        assert.ok(Math.hypot(r.points[j.index]![0] - n.x, r.points[j.index]![1] - n.z) < 0.05, 'junction index points at the node');
      }
      for (const m of routeManeuvers(r)) {
        turns++;
        assert.ok((NODE_DEGREE.get(m.node) ?? 0) >= 3);
        assert.ok(Math.abs(m.angle) >= (NAV.turnMinDeg * Math.PI) / 180);
        assert.equal(m.kind, m.angle > 0 ? 'left' : 'right');
      }
    }
  }
  assert.ok(routes >= 20 && turns > 10, `${routes} routes, ${turns} turns`);
});

test('rerouting: only after riding clearly off the route for a while, with a cooldown', () => {
  const st: RerouteState = { offSince: null, lastRoute: 0 };
  // On the route (lane offset, a pavement): never.
  for (let t = 0; t < 10000; t += 100) assert.equal(shouldReroute(st, 6, t), false);
  // Briefly off (overtaking, a parking manoeuvre): not yet.
  assert.equal(shouldReroute(st, NAV.offRouteM + 5, 10000), false);
  assert.equal(shouldReroute(st, NAV.offRouteM + 5, 10000 + NAV.offRouteMs - 100), false);
  assert.equal(shouldReroute(st, 4, 10000 + NAV.offRouteMs), false, 'back on the route resets the timer');
  // Clearly off for long enough: yes.
  assert.equal(shouldReroute(st, 40, 20000), false);
  assert.equal(shouldReroute(st, 40, 20000 + NAV.offRouteMs), true);
  // Cooldown: right after a new route, even far off, no new one.
  const fresh: RerouteState = { offSince: null, lastRoute: 50000 };
  assert.equal(shouldReroute(fresh, 80, 50100), false);
  assert.equal(shouldReroute(fresh, 80, 50100 + NAV.offRouteMs), false);
  assert.equal(shouldReroute(fresh, 80, 50000 + NAV.rerouteCooldownMs), true);
});

test('speed zoom: bounded, monotonic, smooth, no shimmer at steady speed', () => {
  assert.equal(zoomForSpeed(0), NAV.zoomNear);
  assert.equal(zoomForSpeed(5), NAV.zoomNear);
  assert.equal(zoomForSpeed(80), NAV.zoomFar);
  assert.equal(zoomForSpeed(Number.NaN), NAV.zoomNear);
  let prev = 0;
  for (let v = 0; v <= 60; v += 1) { const z = zoomForSpeed(v); assert.ok(z >= prev && z >= NAV.zoomNear && z <= NAV.zoomFar); prev = z; }
  // Dead band: speed wobbling ±2 km/h around 28 km/h keeps one target.
  let target = zoomForSpeed(28);
  const targets = new Set<number>();
  for (let i = 0; i < 200; i++) { target = nextZoomTarget(target, 28 + Math.sin(i) * 2); targets.add(target); }
  assert.equal(targets.size, 1);
  // A real change of speed does move the target, and the limits are reached exactly.
  assert.ok(nextZoomTarget(target, 45) > target);
  assert.equal(nextZoomTarget(target, 0), NAV.zoomNear);
});
