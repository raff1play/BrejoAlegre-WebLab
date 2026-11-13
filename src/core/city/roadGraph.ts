import { LANE_OFFSET, NODES, ROADS, nodeById, type CityNode, type CityRoad } from '../../world/city/cityPlan.ts';

/**
 * CORE-013 traffic network derived from the city plan (one source for traffic, pedestrians and
 * minimap). Right-hand traffic, one lane per direction offset LANE_OFFSET from the road axis.
 * Lanes end at the stop line; junction movements are short polylines (straight, quadratic Bézier
 * for turns, half circle for the dead-end U-turn) with a precomputed conflict matrix.
 */
export type Vec = { x: number; z: number };

export type Path = Readonly<{ points: readonly Vec[]; cum: readonly number[]; length: number }>;

export type Lane = Readonly<{
  index: number; id: string; road: CityRoad; from: string; to: string;
  /** Travel direction at the start and at the end of the lane (real roads bend). */
  dir: Vec; endDir: Vec; path: Path;
  /** Movements leaving the end of this lane. */
  out: number[];
  speedLimit: number;
}>;

export type Turn = 'straight' | 'left' | 'right' | 'uturn';
export type Movement = Readonly<{
  index: number; id: string; node: string; from: number; to: number; turn: Turn;
  path: Path; maxSpeed: number;
  conflicts: number[];
}>;

export const degree = (id: string): number => ROADS.filter((r) => r.a === id || r.b === id).length;

/**
 * Distance from a node centre to its stop lines (lanes end here). CORE-015: real junctions can be
 * a few metres apart (staggered crossings), so the setback is capped by the shortest arm.
 */
export function stopDistance(n: CityNode): number {
  if (n.exit) return 0;
  const arms = ROADS.filter((r) => r.a === n.id || r.b === n.id);
  const shortest = Math.min(...arms.map((r) => r.length));
  const want = arms.length === 1 ? 3 : arms.length === 2 ? 2.5 : 9;
  return Math.max(0.5, Math.min(want, shortest * 0.4));
}

/** Polyline shifted `d` to the right of its direction (mitred joints). */
function offsetRight(pts: Vec[], d: number): Vec[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]!; const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const r = { x: (b.z - a.z) / L, z: -(b.x - a.x) / L };
    return { x: p.x + r.x * d, z: p.z + r.z * d };
  });
}

/** Sub-polyline between arc lengths s0 and s1. */
function trim(pts: Vec[], s0: number, s1: number): Vec[] {
  const path = makePath(pts);
  const at = (s: number) => { const q = pathPose(path, s); return { x: q.x, z: q.z }; };
  const out = [at(s0)];
  for (let i = 1; i < pts.length - 1; i++) if (path.cum[i]! > s0 + 0.05 && path.cum[i]! < s1 - 0.05) out.push(pts[i]!);
  out.push(at(s1));
  return out;
}

export function makePath(points: Vec[]): Path {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.z - points[i - 1]!.z));
  return { points, cum, length: cum[cum.length - 1]! };
}

/** Point and heading (radians, atan2(dx, dz): 0 = north) at arc length s. */
export function pathPose(p: Path, s: number): { x: number; z: number; yaw: number } {
  const t = Math.min(p.length, Math.max(0, s));
  let i = 1;
  while (i < p.cum.length - 1 && p.cum[i]! < t) i++;
  const a = p.points[i - 1]!; const b = p.points[i]!;
  const seg = p.cum[i]! - p.cum[i - 1]!;
  const k = seg > 0 ? (t - p.cum[i - 1]!) / seg : 0;
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k, yaw: Math.atan2(b.x - a.x, b.z - a.z) };
}


function speedLimitFor(r: CityRoad): number {
  if (r.kind === 'yard') return 4;
  if (r.kind === 'rural') return 16; // ~58 km/h
  return r.priority >= 3 ? 11.5 : 10; // ~41 / 36 km/h in town
}

function segmentsCross(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const o = (p: Vec, q: Vec, r: Vec) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
  const d1 = o(c, d, a); const d2 = o(c, d, b); const d3 = o(a, b, c); const d4 = o(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

export function pathsCross(p: Path, q: Path): boolean {
  for (let i = 1; i < p.points.length; i++) {
    for (let j = 1; j < q.points.length; j++) {
      if (segmentsCross(p.points[i - 1]!, p.points[i]!, q.points[j - 1]!, q.points[j]!)) return true;
    }
  }
  return false;
}

/** Turning radius estimate for a polyline: length / total heading change. */
function curveSpeed(path: Path, latAcc = 2.6): number {
  let turn = 0;
  for (let i = 2; i < path.points.length; i++) {
    const a = Math.atan2(path.points[i - 1]!.x - path.points[i - 2]!.x, path.points[i - 1]!.z - path.points[i - 2]!.z);
    const b = Math.atan2(path.points[i]!.x - path.points[i - 1]!.x, path.points[i]!.z - path.points[i - 1]!.z);
    let d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    turn += Math.abs(d);
  }
  if (turn < 0.05) return 30;
  return Math.max(2.2, Math.sqrt(latAcc * (path.length / turn)));
}

export type RoadGraph = Readonly<{ lanes: Lane[]; movements: Movement[]; byNode: Map<string, number[]>; laneById: Map<string, Lane> }>;

export function buildRoadGraph(): RoadGraph {
  const lanes: Lane[] = [];
  for (const road of ROADS) {
    const directions = road.oneway ? [[road.a, road.b]] as const : [[road.a, road.b], [road.b, road.a]] as const;
    for (const [from, to] of directions) {
      const A = nodeById(from); const B = nodeById(to);
      const axis = (from === road.a ? [...road.pts] : [...road.pts].reverse()).map(([x, z]) => ({ x, z }));
      // One-way carriageways (OSM dual roads): the lane follows the way's own axis.
      const shifted = offsetRight(axis, road.oneway ? 0.4 : LANE_OFFSET);
      const total = makePath(shifted).length;
      let ta = stopDistance(A); let tb = stopDistance(B);
      if (ta + tb > total - 1) { const k = (total - 1) / (ta + tb); ta *= k; tb *= k; }
      const pts = trim(shifted, ta, total - tb);
      const path = makePath(pts);
      const unit = (a: Vec, b: Vec) => { const L = Math.hypot(b.x - a.x, b.z - a.z) || 1; return { x: (b.x - a.x) / L, z: (b.z - a.z) / L }; };
      const dir = unit(pts[0]!, pts[1]!); const endDir = unit(pts[pts.length - 2]!, pts[pts.length - 1]!);
      lanes.push({ index: lanes.length, id: `${road.id}:${from}>${to}`, road, from, to, dir, endDir, path, out: [], speedLimit: speedLimitFor(road) });
    }
  }
  const movements: Movement[] = [];
  const byNode = new Map<string, number[]>();
  for (const n of NODES) {
    if (n.exit) continue;
    const ins = lanes.filter((l) => l.to === n.id);
    const outs = lanes.filter((l) => l.from === n.id);
    const list: number[] = [];
    for (const a of ins) {
      for (const b of outs) {
        const uturn = a.road === b.road;
        if (uturn && outs.length > 1) continue;
        const P0 = a.path.points[a.path.points.length - 1]!; const P2 = b.path.points[0]!;
        const cross = a.endDir.x * b.dir.z - a.endDir.z * b.dir.x;
        const dot = a.endDir.x * b.dir.x + a.endDir.z * b.dir.z;
        let pts: Vec[];
        let turn: Turn;
        if (uturn) {
          // Dead end: a wide turning loop (radius 6 m) beyond the lane ends, so long vehicles do
          // not sweep over the queue waiting on the inbound lane.
          turn = 'uturn';
          const f = a.endDir;
          const w = Math.hypot(P2.x - P0.x, P2.z - P0.z);
          const u = { x: (P2.x - P0.x) / w, z: (P2.z - P0.z) / w };
          const R = 6;
          const mid = { x: (P0.x + P2.x) / 2 + f.x * 2, z: (P0.z + P2.z) / 2 + f.z * 2 };
          const Q0 = { x: mid.x - u.x * R, z: mid.z - u.z * R };
          const Q1 = { x: mid.x + u.x * R, z: mid.z + u.z * R };
          const cubic = (A: Vec, B: Vec, C: Vec, D: Vec, k: number): Vec => {
            const m = 1 - k;
            return { x: m ** 3 * A.x + 3 * m * m * k * B.x + 3 * m * k * k * C.x + k ** 3 * D.x, z: m ** 3 * A.z + 3 * m * m * k * B.z + 3 * m * k * k * C.z + k ** 3 * D.z };
          };
          const lead = (d: number, from: Vec) => ({ x: from.x + f.x * d, z: from.z + f.z * d });
          pts = [];
          for (let i = 0; i < 6; i++) pts.push(cubic(P0, lead(1.2, P0), lead(-1.2, Q0), Q0, i / 6));
          for (let i = 0; i <= 12; i++) {
            const phi = (Math.PI * i) / 12;
            pts.push({ x: mid.x - u.x * R * Math.cos(phi) + f.x * R * Math.sin(phi), z: mid.z - u.z * R * Math.cos(phi) + f.z * R * Math.sin(phi) });
          }
          for (let i = 1; i <= 6; i++) pts.push(cubic(Q1, lead(-1.2, Q1), lead(1.2, P2), P2, i / 6));
        } else if (dot > 0.9) {
          turn = 'straight';
          pts = [P0, P2];
        } else {
          turn = cross < 0 ? 'right' : 'left';
          // Control point: where the inbound and outbound lane lines meet.
          const den = a.endDir.x * -b.dir.z + a.endDir.z * b.dir.x;
          const t = ((P2.x - P0.x) * -b.dir.z + (P2.z - P0.z) * b.dir.x) / den;
          const C = { x: P0.x + a.endDir.x * t, z: P0.z + a.endDir.z * t };
          pts = [];
          for (let i = 0; i <= 8; i++) {
            const u = i / 8;
            pts.push({ x: (1 - u) ** 2 * P0.x + 2 * (1 - u) * u * C.x + u * u * P2.x, z: (1 - u) ** 2 * P0.z + 2 * (1 - u) * u * C.z + u * u * P2.z });
          }
        }
        const path = makePath(pts);
        const m: Movement = { index: movements.length, id: `${n.id}:${a.id}>${b.id}`, node: n.id, from: a.index, to: b.index, turn, path, maxSpeed: curveSpeed(path), conflicts: [] };
        movements.push(m);
        a.out.push(m.index);
        list.push(m.index);
      }
    }
    byNode.set(n.id, list);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const p = movements[list[i]!]!; const q = movements[list[j]!]!;
        if (p.from === q.from) continue; // diverging from the same lane
        if (p.to === q.to || pathsCross(p.path, q.path)) { p.conflicts.push(q.index); q.conflicts.push(p.index); }
      }
    }
  }
  return { lanes, movements, byNode, laneById: new Map(lanes.map((l) => [l.id, l])) };
}

/** Closest lane to a point (by distance to its centre line) among lanes accepted by the filter. */
export function nearestLane(g: RoadGraph, x: number, z: number, accept: (l: Lane) => boolean = () => true): { lane: Lane; s: number; distance: number } | null {
  let best: { lane: Lane; s: number; distance: number } | null = null;
  for (const lane of g.lanes) {
    if (!accept(lane)) continue;
    const pts = lane.path.points;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!; const b = pts[i]!;
      const L2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2 || 1;
      const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / L2));
      const px = a.x + (b.x - a.x) * t; const pz = a.z + (b.z - a.z) * t;
      const d = Math.hypot(px - x, pz - z);
      if (!best || d < best.distance) best = { lane, s: lane.path.cum[i - 1]! + Math.sqrt(L2) * t, distance: d };
    }
  }
  return best;
}

/**
 * Lane-level shortest route (Dijkstra over lanes, edges are movements). Called once per trip, never
 * per frame. Returns the list of movement indices to follow from the end of `fromLane`.
 */
export function routeBetween(g: RoadGraph, fromLane: number, toLane: number, allow: (l: Lane) => boolean): number[] | null {
  if (fromLane === toLane) return [];
  const dist = new Map<number, number>([[fromLane, 0]]);
  const via = new Map<number, number>();
  const open = new Set<number>([fromLane]);
  while (open.size) {
    let cur = -1; let best = Infinity;
    for (const l of open) { const d = dist.get(l)!; if (d < best) { best = d; cur = l; } }
    open.delete(cur);
    if (cur === toLane) break;
    for (const mi of g.lanes[cur]!.out) {
      const m = g.movements[mi]!;
      const next = g.lanes[m.to]!;
      if (!allow(next)) continue;
      const d = best + m.path.length + next.path.length + (m.turn === 'straight' ? 0 : 6) + (m.turn === 'uturn' ? 40 : 0);
      if (d < (dist.get(m.to) ?? Infinity)) { dist.set(m.to, d); via.set(m.to, mi); open.add(m.to); }
    }
  }
  if (!via.has(toLane)) return null;
  const out: number[] = [];
  let l = toLane;
  while (l !== fromLane) { const mi = via.get(l)!; out.unshift(mi); l = g.movements[mi]!.from; }
  return out;
}
