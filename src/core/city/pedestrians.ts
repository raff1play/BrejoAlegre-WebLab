import { ROAD_HALF, framePoint, type Frame } from '../../world/layout.ts';
import { NODES, ROADS, STORES, nodeById, type CityNode, type CityRoad } from '../../world/city/cityPlan.ts';
import { OPEN_SPACES, pointInPolygon } from '../../world/geo/geoCity.ts';
import { rng, type Obstacle } from './traffic.ts';
import type { PedAspect } from './signals.ts';

/**
 * CORE-013 pedestrians: a sidewalk graph built from the city plan (both sides of every urban
 * street, corners, crosswalks at the zebras) and a small deterministic state machine:
 * walk → wait at the kerb → cross → walk → visit (shop, church, school) / idle (square) / bus.
 */
export const PED_OFFSET = 5.6;
/** Where pedestrians cross an arm (CORE-015: capped on the short real arms between staggered junctions). */
export const crossingDistance = (n: CityNode): number => {
  const shortest = Math.min(...ROADS.filter((r) => r.a === n.id || r.b === n.id).map((r) => r.length));
  return Math.max(1, Math.min(ROAD_HALF + 2.1, shortest * 0.4));
};

/** Polyline of a road seen from node `from` (first point at the node). */
const fromNode = (r: CityRoad, from: string): P[] => (r.a === from ? r.pts : [...r.pts].reverse()).map(([x, z]) => ({ x, z }));
function offsetSide(pts: P[], d: number): P[] {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)]!; const b = pts[Math.min(pts.length - 1, i + 1)]!;
    const L = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: p.x + ((b.z - a.z) / L) * d, z: p.z - ((b.x - a.x) / L) * d };
  });
}

type P = { x: number; z: number };
export type WalkEdge = { a: number; b: number; length: number; cross: { node: string; road: string } | null };
export type WalkGraph = { points: P[]; edges: WalkEdge[]; adj: number[][] };

const arms = (n: CityNode) => ROADS.filter((r) => (r.a === n.id || r.b === n.id) && r.kind !== 'yard');

export function buildWalkGraph(): WalkGraph {
  const points: P[] = [];
  const edges: WalkEdge[] = [];
  const add = (p: P) => { points.push(p); return points.length - 1; };
  const link = (a: number, b: number, cross: WalkEdge['cross'] = null) => {
    edges.push({ a, b, length: Math.hypot(points[a]!.x - points[b]!.x, points[a]!.z - points[b]!.z), cross });
  };
  /** side point id per node/road/side (+1 = right of the outward direction). */
  const side = new Map<string, number>();
  for (const n of NODES) {
    if (n.exit) continue;
    const list = arms(n);
    if (!list.some((r) => r.kind === 'urban')) continue;
    const c = crossingDistance(n);
    const ring: { id: number; angle: number; road: string; d: P }[] = [];
    for (const r of list) {
      const line = fromNode(r, n.id);
      const L = Math.hypot(line[1]!.x - line[0]!.x, line[1]!.z - line[0]!.z) || 1;
      const d = { x: (line[1]!.x - line[0]!.x) / L, z: (line[1]!.z - line[0]!.z) / L };
      for (const s of [1, -1]) {
        const p = { x: n.x + d.x * c + d.z * PED_OFFSET * s, z: n.z + d.z * c - d.x * PED_OFFSET * s };
        const id = add(p);
        side.set(`${n.id}|${r.id}|${s}`, id);
        ring.push({ id, angle: Math.atan2(p.z - n.z, p.x - n.x), road: r.id, d });
      }
    }
    ring.sort((a, b) => a.angle - b.angle);
    for (let i = 0; i < ring.length; i++) {
      const A = ring[i]!; const B = ring[(i + 1) % ring.length]!;
      if (A.road === B.road) {
        link(A.id, B.id, { node: n.id, road: A.road });
        continue;
      }
      const pa = points[A.id]!; const pb = points[B.id]!;
      const den = A.d.x * B.d.z - A.d.z * B.d.x;
      if (Math.abs(den) < 1e-6) { link(A.id, B.id); continue; }
      const t = ((pb.x - pa.x) * B.d.z - (pb.z - pa.z) * B.d.x) / den;
      const corner = add({ x: pa.x + A.d.x * t, z: pa.z + A.d.z * t });
      link(A.id, corner);
      link(corner, B.id);
    }
  }
  for (const r of ROADS) {
    if (r.kind !== 'urban') continue;
    const axis = fromNode(r, r.a);
    for (const s of [1, -1]) {
      const a = side.get(`${r.a}|${r.id}|${s}`); const b = side.get(`${r.b}|${r.id}|${-s}`);
      if (a === undefined || b === undefined) continue;
      // Follow the real bends: interior vertices of the offset polyline become sidewalk points.
      const line = offsetSide(axis, PED_OFFSET * s);
      let prev = a;
      for (let i = 1; i < line.length - 1; i++) { const id = add(line[i]!); link(prev, id); prev = id; }
      link(prev, b);
    }
  }
  const adj = points.map(() => [] as number[]);
  edges.forEach((e, i) => { adj[e.a]!.push(i); adj[e.b]!.push(i); });
  return { points, edges, adj };
}

/** Closest point on a non-crossing edge: where a pedestrian joins/leaves the graph. */
export function nearestWalkPoint(g: WalkGraph, x: number, z: number): { edge: number; t: number; x: number; z: number; d: number } {
  let best = { edge: 0, t: 0, x: 0, z: 0, d: Infinity };
  g.edges.forEach((e, i) => {
    if (e.cross) return;
    const a = g.points[e.a]!; const b = g.points[e.b]!;
    const L2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2 || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (z - a.z) * (b.z - a.z)) / L2));
    const px = a.x + (b.x - a.x) * t; const pz = a.z + (b.z - a.z) * t;
    const d = Math.hypot(px - x, pz - z);
    if (d < best.d) best = { edge: i, t, x: px, z: pz, d };
  });
  return best;
}

/** Shortest walk between two edge positions; returns graph point ids to visit in between. */
function walkRoute(g: WalkGraph, from: { edge: number }, to: { edge: number }): number[] | null {
  const fe = g.edges[from.edge]!; const te = g.edges[to.edge]!;
  if (from.edge === to.edge) return [];
  const dist = new Map<number, number>(); const via = new Map<number, number>();
  const open = new Set<number>();
  for (const p of [fe.a, fe.b]) { dist.set(p, 0); open.add(p); }
  const goals = new Set([te.a, te.b]);
  let reached = -1;
  while (open.size) {
    let cur = -1; let best = Infinity;
    for (const p of open) { const d = dist.get(p)!; if (d < best) { best = d; cur = p; } }
    open.delete(cur);
    if (goals.has(cur)) { reached = cur; break; }
    for (const ei of g.adj[cur]!) {
      const e = g.edges[ei]!;
      const nxt = e.a === cur ? e.b : e.a;
      const d = best + e.length + (e.cross ? 6 : 0);
      if (d < (dist.get(nxt) ?? Infinity)) { dist.set(nxt, d); via.set(nxt, cur); open.add(nxt); }
    }
  }
  if (reached < 0) return null;
  const out = [reached];
  while (via.has(out[0]!)) out.unshift(via.get(out[0]!)!);
  return out;
}

export type PedState = 'walk' | 'waitCross' | 'cross' | 'inside' | 'idle' | 'waitBus';
export type Pedestrian = {
  /** GFX-001D: current (smoothed) walking pace. */
  pace?: number;
  /** Rendered position = path position (bx, bz) + sideways courtesy offset. */
  id: number; x: number; z: number; bx: number; bz: number; yaw: number; speed: number; phase: number;
  state: PedState; timer: number; visible: boolean; active: boolean;
  /** Remaining waypoints; `cross` marks the crosswalk the next leg runs over. */
  legs: { x: number; z: number; cross: { node: string; road: string } | null }[];
  goal: Destination | null; shirt: number; pants: number; skin: number; scale: number; side: number;
};

export type Destination = Readonly<{ kind: 'shop' | 'visit' | 'square' | 'bus' | 'stroll'; x: number; z: number; hide?: P; join: { edge: number; x: number; z: number }; dwell: number; busStop?: string }>;

export type PedContext = Readonly<{
  time: number; hour: number; people: number; commerceOpen: boolean;
  player: Obstacle;
  pedAspect: (node: string) => PedAspect | null;
  armClear: (node: string, road: string) => boolean;
  busAt: (x: number, z: number) => boolean;
}>;

const doorOf = (frame: Frame, width: number, door: number, inside: number) => ({ door: framePoint(frame, width / 2, door), hide: framePoint(frame, width / 2, inside) });

export class Crowd {
  readonly people: Pedestrian[] = [];
  readonly graph: WalkGraph;
  private readonly random: () => number;
  private readonly busy = new Map<string, number>();
  private readonly shops: Destination[];
  private readonly visits: Destination[];
  private readonly square: Destination[];
  private readonly stops: Destination[];
  private nextId = 1;
  private frame = 0;
  readonly capacity: number;

  private readonly free: (x: number, z: number) => boolean;

  constructor(capacity: number, free: (x: number, z: number) => boolean, seed = 99) {
    this.capacity = capacity;
    this.free = free;
    this.graph = buildWalkGraph();
    this.random = rng(seed);
    const dest = (kind: Destination['kind'], x: number, z: number, dwell: number, hide?: P, busStop?: string): Destination => {
      const j = nearestWalkPoint(this.graph, x, z);
      return { kind, x, z, hide, join: { edge: j.edge, x: j.x, z: j.z }, dwell, busStop };
    };
    this.shops = STORES.map((s) => {
      const { door, hide } = doorOf(s.frame, s.width, 1.2, 1.8);
      return dest('shop', door.x, door.z, 25, hide);
    });
    // CORE-015: no church/school/bus stop is confirmed in OSM, so visits are the shops only.
    this.visits = [];
    this.stops = [];
    // Idle spots on the REAL open spaces (OSM parks/pitch), kept where a straight walk is clear.
    this.square = [];
    const r = rng(5);
    for (const area of OPEN_SPACES.filter((a) => a.kind.startsWith('leisure:'))) {
      const xs = area.pts.map((q) => q[0]); const zs = area.pts.map((q) => q[1]);
      let found = 0;
      for (let i = 0; i < 120 && found < 6; i++) {
        const x = Math.min(...xs) + r() * (Math.max(...xs) - Math.min(...xs));
        const z = Math.min(...zs) + r() * (Math.max(...zs) - Math.min(...zs));
        if (!pointInPolygon(area.pts, x, z)) continue;
        const d = dest('square', x, z, 20);
        if (Math.hypot(d.join.x - x, d.join.z - z) > 40) continue;
        let clear = free(x, z);
        for (let k = 0; clear && k <= 12; k++) clear = free(d.join.x + (x - d.join.x) * (k / 12), d.join.z + (z - d.join.z) * (k / 12));
        if (clear) { this.square.push(d); found++; }
      }
    }
  }

  crosswalkBusy(node: string, road: string): boolean { return (this.busy.get(`${node}|${road}`) ?? 0) > 0; }

  private pick(ctx: PedContext): Destination {
    const r = this.random();
    if (ctx.commerceOpen && r < 0.38) return this.shops[Math.floor(this.random() * this.shops.length)]!;
    if (r < 0.5 && this.visits.length) return this.visits[Math.floor(this.random() * this.visits.length)]!;
    if (r < 0.72 && this.square.length) return this.square[Math.floor(this.random() * this.square.length)]!;
    if (r < 0.84 && this.stops.length) return this.stops[Math.floor(this.random() * this.stops.length)]!;
    const e = Math.floor(this.random() * this.graph.edges.length);
    const edge = this.graph.edges[e]!;
    if (edge.cross) return this.square[0] ?? this.shops[0]!;
    const a = this.graph.points[edge.a]!; const b = this.graph.points[edge.b]!;
    const t = this.random();
    const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    return { kind: 'stroll', x: p.x, z: p.z, join: { edge: e, x: p.x, z: p.z }, dwell: 2 };
  }

  /** Plans the legs from the current position (on or next to the graph) to a destination. */
  private go(p: Pedestrian, goal: Destination): void {
    const here = nearestWalkPoint(this.graph, p.bx, p.bz);
    const route = walkRoute(this.graph, here, goal.join);
    if (!route) { p.goal = null; p.legs = []; return; }
    const legs: Pedestrian['legs'] = [{ x: here.x, z: here.z, cross: null }];
    let prev = -1;
    const at = (id: number) => this.graph.points[id]!;
    for (const id of route) {
      let cross: Pedestrian['legs'][number]['cross'] = null;
      if (prev >= 0) {
        const e = this.graph.adj[prev]!.map((i) => this.graph.edges[i]!).find((q) => (q.a === prev && q.b === id) || (q.b === prev && q.a === id));
        cross = e?.cross ?? null;
      }
      legs.push({ x: at(id).x, z: at(id).z, cross });
      prev = id;
    }
    legs.push({ x: goal.join.x, z: goal.join.z, cross: null });
    if (goal.kind !== 'stroll') legs.push({ x: goal.x, z: goal.z, cross: null });
    if (goal.hide) legs.push({ x: goal.hide.x, z: goal.hide.z, cross: null });
    p.legs = legs;
    p.goal = goal;
    p.state = 'walk';
  }

  private spawn(x: number, z: number, ctx: PedContext, hidden = false): Pedestrian {
    const p: Pedestrian = {
      id: this.nextId++, x, z, bx: x, bz: z, yaw: 0, speed: 1.05 + this.random() * 0.45, phase: this.random() * 6, state: 'walk', timer: 0,
      visible: !hidden, active: true, legs: [], goal: null,
      shirt: Math.floor(this.random() * 10), pants: Math.floor(this.random() * 5), skin: Math.floor(this.random() * 4), scale: 0.92 + this.random() * 0.16, side: 0,
    };
    this.people.push(p);
    this.go(p, this.pick(ctx));
    return p;
  }

  populate(ctx: PedContext, initial: boolean): void {
    const wanted = Math.round(this.capacity * ctx.people);
    const active = this.people.filter((p) => p.active).length;
    const add = Math.min(initial ? wanted : 1, wanted - active);
    for (let i = 0; i < add; i++) {
      if (initial || this.random() < 0.4) {
        // Anywhere on the pavement, away from the player once the game is running.
        for (let k = 0; k < 8; k++) {
          const e = this.graph.edges[Math.floor(this.random() * this.graph.edges.length)]!;
          if (e.cross) continue;
          const a = this.graph.points[e.a]!; const b = this.graph.points[e.b]!;
          const t = this.random();
          const x = a.x + (b.x - a.x) * t; const z = a.z + (b.z - a.z) * t;
          if (!initial && Math.hypot(x - ctx.player.x, z - ctx.player.z) < 70) continue;
          this.spawn(x, z, ctx);
          break;
        }
      } else {
        // Someone steps out of a door (a shop only while open).
        const pool = ctx.commerceOpen ? [...this.shops, ...this.visits] : this.visits.length ? this.visits : this.shops;
        const d = pool[Math.floor(this.random() * pool.length)]!;
        const p = this.spawn(d.x, d.z, ctx);
        p.x = p.bx = d.hide?.x ?? d.x; p.z = p.bz = d.hide?.z ?? d.z;
        p.visible = false;
        p.legs.unshift({ x: d.x, z: d.z, cross: null });
      }
    }
  }

  private release(p: Pedestrian): void {
    const leg = p.legs[0];
    if (p.state === 'cross' && leg?.cross) {
      const key = `${leg.cross.node}|${leg.cross.road}`;
      this.busy.set(key, Math.max(0, (this.busy.get(key) ?? 1) - 1));
    }
  }

  private arrive(p: Pedestrian, ctx: PedContext): void {
    const goal = p.goal;
    if (!goal) { this.go(p, this.pick(ctx)); return; }
    if (goal.kind === 'shop' || goal.kind === 'visit') { p.state = 'inside'; p.visible = false; p.timer = goal.dwell * (0.6 + this.random()); }
    else if (goal.kind === 'bus') { p.state = 'waitBus'; p.timer = goal.dwell; }
    else { p.state = 'idle'; p.timer = goal.dwell * (0.5 + this.random()); }
  }

  update(dt: number, ctx: PedContext): void {
    if (!(dt > 0)) return;
    this.frame++;
    const wanted = Math.round(this.capacity * ctx.people);
    let active = 0;
    for (const p of this.people) if (p.active) active++;
    for (const p of this.people) {
      if (!p.active) continue;
      const far = Math.hypot(p.x - ctx.player.x, p.z - ctx.player.z) > 90;
      if (far && (p.id + this.frame) % 3 !== 0) continue;
      const step = far ? dt * 3 : dt;
      if (p.state === 'inside') {
        p.timer -= step;
        if (p.timer <= 0) {
          if (active > wanted) { p.active = false; active--; continue; } // stays home: population shrinks
          const back = p.goal!;
          p.bx = back.x; p.bz = back.z; // plan from the door, then walk out to it
          this.go(p, this.pick(ctx));
          p.legs.unshift({ x: back.x, z: back.z, cross: null });
        }
        continue;
      }
      if (p.state === 'idle' || p.state === 'waitBus') {
        p.timer -= step;
        if (p.state === 'waitBus' && p.goal && ctx.busAt(p.goal.x, p.goal.z)) { p.active = false; active--; continue; }
        if (p.timer <= 0) this.go(p, this.pick(ctx));
        continue;
      }
      const leg = p.legs[0];
      if (!leg) { this.arrive(p, ctx); continue; }
      if (leg.cross && p.state === 'walk') {
        const node = nodeById(leg.cross.node);
        const aspect = ctx.pedAspect(node.id);
        const ok = aspect ? aspect === 'walk' : ctx.armClear(leg.cross.node, leg.cross.road);
        if (!ok) { p.state = 'waitCross'; continue; }
        p.state = 'cross';
        const key = `${leg.cross.node}|${leg.cross.road}`;
        this.busy.set(key, (this.busy.get(key) ?? 0) + 1);
      } else if (p.state === 'waitCross' && leg.cross) {
        const aspect = ctx.pedAspect(leg.cross.node);
        const ok = aspect ? aspect === 'walk' : ctx.armClear(leg.cross.node, leg.cross.road);
        if (!ok) continue;
        p.state = 'cross';
        const key = `${leg.cross.node}|${leg.cross.road}`;
        this.busy.set(key, (this.busy.get(key) ?? 0) + 1);
      }
      let dx = leg.x - p.bx; let dz = leg.z - p.bz;
      const dist = Math.hypot(dx, dz);
      let speed = p.speed * (p.state === 'cross' ? 1.15 : 1);
      // GFX-001D courtesy: slow down and step aside for the player ahead (a full stop only when
      // the player is right in the way); keep right and fall in behind slower walkers.
      const px = ctx.player.x - p.x; const pz = ctx.player.z - p.z;
      const pd2 = px * px + pz * pz;
      let aside = 0;
      if (dist > 0.01 && p.state !== 'cross' && pd2 < 3.2 * 3.2 && (px * dx + pz * dz) / dist > 0.3) {
        const lateral = Math.abs(px * dz - pz * dx) / dist;
        if (pd2 < 1.1 * 1.1 && lateral < 0.5) speed = 0;
        else { speed *= 0.55; aside = 0.6; }
      }
      p.side += ((aside || 0) - p.side) * Math.min(1, step * 2.5) * (aside ? 1 : 0.4);
      if (this.frame % 2 === 0 && dist > 0.01) {
        for (const o of this.people) {
          if (o === p || !o.active || !o.visible) continue;
          const ox = o.x - p.x; const oz = o.z - p.z;
          const d2 = ox * ox + oz * oz;
          const ahead = (ox * dx + oz * dz) / dist;
          if (d2 > 2.6 || ahead < 0.2) continue;
          p.side = Math.min(0.5, p.side + 0.1);
          // Same way and slower, close ahead: do not walk through, follow at their pace.
          if (d2 < 1.0 && Math.abs(Math.sin(o.yaw - p.yaw)) < 0.5 && Math.cos(o.yaw - p.yaw) > 0.5) speed = Math.min(speed, o.speed * 0.9);
        }
      }
      // Never side-step into a pole, planter or wall: fall back to the centre of the pavement.
      if (p.side > 0.05 && dist > 0.01 && !this.free(p.bx + (dz / dist) * p.side, p.bz - (dx / dist) * p.side)) p.side = 0;
      // Walking pace changes gradually (no instant stop/start).
      const pace = p.pace ?? speed;
      p.pace = pace + (speed - pace) * Math.min(1, step * 4);
      speed = p.pace;
      if (dist < 0.05 || speed * step >= dist) {
        p.bx = leg.x; p.bz = leg.z; p.x = leg.x; p.z = leg.z;
        if (p.state === 'cross') { this.release(p); p.state = 'walk'; }
        p.legs.shift();
        p.visible = true;
        if (p.legs.length === 1 && p.goal?.hide) p.visible = false; // steps through the door
        if (p.legs.length === 0) this.arrive(p, ctx);
        continue;
      }
      dx /= dist; dz /= dist;
      const move = speed * step;
      p.bx += dx * move; p.bz += dz * move;
      // Keep right: the offset is to the right of the walking direction, never accumulated.
      const side = p.state === 'cross' ? 0 : p.side;
      p.x = p.bx + dz * side; p.z = p.bz - dx * side;
      if (speed > 0.02) {
        // Turn the body over a few frames instead of snapping to the new heading at corners.
        let turn = Math.atan2(dx, dz) - p.yaw;
        while (turn > Math.PI) turn -= Math.PI * 2;
        while (turn < -Math.PI) turn += Math.PI * 2;
        p.yaw += turn * Math.min(1, step * 7);
        p.phase += move * 3.2;
      }
    }
    if (this.frame % 40 === 0) {
      for (let i = this.people.length - 1; i >= 0; i--) if (!this.people[i]!.active) this.people.splice(i, 1);
      this.populate(ctx, false);
    }
  }
}

