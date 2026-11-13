import { BUS_LOOP, BUS_STOPS, NODES, ROADS, SPEED_HUMPS, STORES, nodeById } from '../../world/city/cityPlan.ts';
import { nearestLane, pathPose, routeBetween, type Lane, type Movement, type RoadGraph } from './roadGraph.ts';
import { laneAspect, type SignalPlan } from './signals.ts';

/**
 * CORE-013 vehicle simulation: deterministic rules, no AI services. Car-following uses the
 * Intelligent Driver Model; junctions use admission (signal aspect, stop sign, right of way,
 * conflicting occupants, pedestrians, room on the exit lane). Routes are computed once per trip.
 */
export type VehicleKind = 'car' | 'moto' | 'bike' | 'van' | 'truck' | 'bus';
export type VehicleSpec = Readonly<{ length: number; width: number; vmax: number; accel: number; decel: number; headway: number; gap: number; kerb: number }>;

export const VEHICLE_SPECS: Readonly<Record<VehicleKind, VehicleSpec>> = {
  car: { length: 4.2, width: 1.8, vmax: 12.5, accel: 2.0, decel: 2.6, headway: 1.2, gap: 2.0, kerb: 0 },
  moto: { length: 2.1, width: 0.8, vmax: 13, accel: 2.8, decel: 3.0, headway: 1.0, gap: 1.6, kerb: 0.5 },
  bike: { length: 1.8, width: 0.6, vmax: 5, accel: 1.0, decel: 2.0, headway: 1.0, gap: 1.4, kerb: 0.9 },
  van: { length: 5.2, width: 2.0, vmax: 11, accel: 1.6, decel: 2.4, headway: 1.4, gap: 2.2, kerb: 0 },
  truck: { length: 9.5, width: 2.5, vmax: 9, accel: 0.9, decel: 2.0, headway: 1.8, gap: 3.0, kerb: 0 },
  bus: { length: 11, width: 2.55, vmax: 10, accel: 1.0, decel: 2.0, headway: 1.6, gap: 3.0, kerb: 0 },
};

export type Seg = { kind: 'lane' | 'move'; index: number };
export type Plan = 'wander' | 'bus' | 'van' | 'truck';
export type Target = { lane: number; s: number; dwell: number; what: 'stop' | 'store' | 'dock' };

export type Vehicle = {
  id: number; kind: VehicleKind; spec: VehicleSpec; colour: number; plan: Plan;
  seg: Seg; s: number; v: number; a: number;
  /** Movements still to take; route[0] is the next junction while on a lane. */
  route: number[];
  admitted: boolean; stoppedAtLine: boolean; wait: number;
  target: Target | null; dwell: number; trip: number;
  x: number; z: number; yaw: number; braking: boolean;
  active: boolean; skip: boolean;
  /** Last thing that limited the vehicle (debug/tests). */
  reason: string;
};

export type Obstacle = { x: number; z: number; radius: number };
export type TrafficContext = Readonly<{
  time: number;
  player: Obstacle;
  /** True while a pedestrian is on the crosswalk of `road` at `node`. */
  crosswalkBusy: (node: string, road: string) => boolean;
  /** Spawning target for general traffic (0–1 of capacity) and logistics on/off. */
  density: number;
  logistics: boolean;
}>;

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COMFORT_STOP = 3.0;
const LOOKAHEAD = 55;
const DOCK_LANE = 'patio:portao>docas';

export type TrafficOptions = Readonly<{ capacity: number; seed?: number; buses?: number; vans?: number; trucks?: number }>;

export class Traffic {
  readonly vehicles: Vehicle[] = [];
  private readonly random: () => number;
  private readonly onLane: number[][];
  private readonly onMove: number[][];
  /** Movements currently claimed per node: vehicle ids. */
  private readonly claims = new Map<string, Map<number, number>>();
  private readonly maxPriority = new Map<string, number>();
  private readonly busStopsOn = new Map<number, { s: number }[]>();
  private readonly humpsOn = new Map<number, number[]>();
  private readonly storeStops: { lane: number; s: number }[];
  private readonly exitsIn: number[];
  private readonly exitsOut: number[];
  private readonly heavyEntries: number[];
  private spawnClock = 0;
  private nextId = 1;
  frame = 0;

  readonly graph: RoadGraph;
  readonly signals: Map<string, SignalPlan>;
  readonly options: TrafficOptions;

  constructor(graph: RoadGraph, signals: Map<string, SignalPlan>, options: TrafficOptions) {
    this.graph = graph; this.signals = signals; this.options = options;
    this.random = rng(options.seed ?? 1307);
    this.onLane = graph.lanes.map(() => []);
    this.onMove = graph.movements.map(() => []);
    for (const n of NODES) {
      this.claims.set(n.id, new Map());
      this.maxPriority.set(n.id, Math.max(...ROADS.filter((r) => r.a === n.id || r.b === n.id).map((r) => r.priority)));
    }
    for (const stop of BUS_STOPS) {
      const near = nearestLane(graph, stop.x, stop.z, (l) => l.road.id === stop.road)!;
      const list = this.busStopsOn.get(near.lane.index) ?? [];
      list.push({ s: near.s });
      this.busStopsOn.set(near.lane.index, list);
    }
    for (const h of SPEED_HUMPS) {
      for (const lane of graph.lanes) {
        const [a, b] = lane.path.points;
        const along = h.alongX ? Math.abs(a!.z - b!.z) < 0.01 && Math.abs(a!.z - h.z) < 4 : Math.abs(a!.x - b!.x) < 0.01 && Math.abs(a!.x - h.x) < 4;
        if (!along) continue;
        const near = nearestLane(graph, h.x, h.z, (l) => l === lane);
        if (near && near.distance < 3) this.humpsOn.set(lane.index, [...(this.humpsOn.get(lane.index) ?? []), near.s]);
      }
    }
    this.storeStops = STORES.map((st) => {
      const near = nearestLane(graph, st.stop.x, st.stop.z, (l) => l.road.kind !== 'rural')!;
      return { lane: near.lane.index, s: near.s };
    });
    this.exitsIn = graph.lanes.filter((l) => nodeById(l.from).exit).map((l) => l.index);
    this.exitsOut = graph.lanes.filter((l) => nodeById(l.to).exit).map((l) => l.index);
    this.heavyEntries = this.exitsIn.filter((i) => graph.lanes[i]!.road.heavy);
  }

  // ---------------------------------------------------------------- spawning

  private allowed(kind: VehicleKind, plan: Plan, lane: Lane): boolean {
    if (lane.road.kind === 'yard') return plan === 'van' || plan === 'truck';
    if (kind === 'truck' || kind === 'bus') return lane.road.heavy;
    return true;
  }

  private make(kind: VehicleKind, plan: Plan, lane: number, s: number): Vehicle {
    const v: Vehicle = {
      id: this.nextId++, kind, spec: VEHICLE_SPECS[kind], colour: Math.floor(this.random() * 8), plan,
      seg: { kind: 'lane', index: lane }, s, v: Math.min(VEHICLE_SPECS[kind].vmax, this.graph.lanes[lane]!.speedLimit) * 0.6, a: 0,
      route: [], admitted: false, stoppedAtLine: false, wait: 0, target: null, dwell: 0, trip: 0,
      x: 0, z: 0, yaw: 0, braking: false, active: true, skip: false, reason: '',
    };
    this.vehicles.push(v);
    this.onLane[lane]!.push(v.id);
    this.plan(v);
    this.pose(v);
    return v;
  }

  /** Free space on a lane around s (no vehicle within `clear` metres). */
  private laneFree(lane: number, s: number, clear: number): boolean {
    return this.onLane[lane]!.every((id) => Math.abs(this.byId(id)!.s - s) > clear);
  }

  private spawnFar(kind: VehicleKind, plan: Plan, ctx: TrafficContext, minDistance: number): Vehicle | null {
    for (let tries = 0; tries < 12; tries++) {
      const useExit = minDistance > 30 && this.random() < 0.6;
      const lane = useExit
        ? this.graph.lanes[this.exitsIn[Math.floor(this.random() * this.exitsIn.length)]!]!
        : this.graph.lanes[Math.floor(this.random() * this.graph.lanes.length)]!;
      if (!this.allowed(kind, plan, lane) || lane.path.length < 14) continue;
      const s = useExit ? 4 : 6 + this.random() * (lane.path.length - 12);
      const p = pathPose(lane.path, s);
      if (!useExit && Math.hypot(p.x - ctx.player.x, p.z - ctx.player.z) < minDistance) continue;
      if (!this.laneFree(lane.index, s, 14)) continue;
      return this.make(kind, plan, lane.index, s);
    }
    return null;
  }

  /** Fills the city at start-up (behind the loading screen) and keeps the population in step with the hour. */
  populate(ctx: TrafficContext, initial: boolean): void {
    const o = this.options;
    const count = (k: VehicleKind) => this.vehicles.filter((v) => v.active && v.kind === k).length;
    const busesWanted = o.buses ?? 2;
    for (let i = count('bus'); i < busesWanted; i++) {
      // Buses start on their loop.
      const from = BUS_LOOP[(i * 3) % (BUS_LOOP.length - 1)]!; const to = BUS_LOOP[(i * 3) % (BUS_LOOP.length - 1) + 1]!;
      const lane = this.graph.lanes.find((l) => l.from === from && l.to === to)!;
      const s = lane.path.length * 0.3;
      const p = pathPose(lane.path, s);
      if (!initial && Math.hypot(p.x - ctx.player.x, p.z - ctx.player.z) < 90) continue;
      if (this.laneFree(lane.index, s, 16)) this.make('bus', 'bus', lane.index, s);
    }
    if (ctx.logistics) {
      for (let i = count('van'); i < (o.vans ?? 3); i++) {
        const dock = this.graph.laneById.get(DOCK_LANE)!;
        const s = Math.min(dock.path.length - 3, 6 + i * 6);
        const p = pathPose(dock.path, s);
        if ((initial || Math.hypot(p.x - ctx.player.x, p.z - ctx.player.z) > 45) && this.laneFree(dock.index, s, 6)) {
          const v = this.make('van', 'van', dock.index, s);
          v.v = 0;
        }
      }
      if (this.spawnClock <= 0 && count('truck') < (o.trucks ?? 2)) {
        const lane = this.heavyEntries[Math.floor(this.random() * this.heavyEntries.length)]!;
        if (this.laneFree(lane, 4, 18)) { this.make('truck', 'truck', lane, 4); this.spawnClock = 45; }
      }
    }
    const general = this.vehicles.filter((v) => v.active && v.plan === 'wander').length;
    const wanted = Math.round(o.capacity * Math.max(0.3, ctx.density));
    const add = Math.min(initial ? wanted : 2, wanted - general);
    for (let i = 0; i < add; i++) {
      const r = this.random();
      const kind: VehicleKind = r < 0.62 ? 'car' : r < 0.84 ? 'moto' : 'bike';
      this.spawnFar(kind, 'wander', ctx, initial ? 18 : 115);
    }
  }

  // ---------------------------------------------------------------- planning

  private byId(id: number): Vehicle | undefined {
    // Ids are dense and only grow; inactive vehicles are compacted away.
    let lo = 0; let hi = this.vehicles.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const v = this.vehicles[mid]!;
      if (v.id === id) return v;
      if (v.id < id) lo = mid + 1; else hi = mid - 1;
    }
    return undefined;
  }

  private laneOf(v: Vehicle): Lane | null {
    return v.seg.kind === 'lane' ? this.graph.lanes[v.seg.index]! : null;
  }

  /** Ensures route[0] exists while on a lane (unless the lane leaves the map). */
  private plan(v: Vehicle): void {
    const lane = this.laneOf(v);
    if (!lane) return;
    if (v.plan === 'bus') {
      v.route = [];
      const at = BUS_LOOP.indexOf(lane.to);
      const next = BUS_LOOP[at + 1] ?? BUS_LOOP[1]!;
      const m = lane.out.map((i) => this.graph.movements[i]!).find((mv) => this.graph.lanes[mv.to]!.to === next);
      if (m) v.route = [m.index];
      const stops = this.busStopsOn.get(lane.index);
      if (stops && !v.target) { const st = stops.find((q) => q.s > v.s + 3); if (st) v.target = { lane: lane.index, s: st.s, dwell: 9, what: 'stop' }; }
    } else if ((v.plan === 'van' || v.plan === 'truck') && v.route.length === 0 && !v.target) {
      this.newTrip(v);
    }
    if (v.route.length === 0 && !nodeById(lane.to).exit) {
      const options = lane.out.map((i) => this.graph.movements[i]!).filter((m) => this.allowed(v.kind, v.plan, this.graph.lanes[m.to]!));
      if (options.length === 0) { v.route = [lane.out[0]!]; return; }
      const weight = (m: Movement) => {
        const exitLane = this.exitsOut.includes(m.to);
        return (m.turn === 'straight' ? 2 : m.turn === 'uturn' ? 0.05 : 1.1) * (exitLane ? 0.35 : 1);
      };
      const total = options.reduce((t, m) => t + weight(m), 0);
      let pick = this.random() * total;
      for (const m of options) { pick -= weight(m); if (pick <= 0) { v.route = [m.index]; return; } }
      v.route = [options[options.length - 1]!.index];
    }
  }

  /** Vans: dock → store → dock. Trucks: entry → dock → exit. One Dijkstra per trip. */
  private newTrip(v: Vehicle): void {
    const lane = this.laneOf(v);
    if (!lane) return;
    const allow = (l: Lane) => this.allowed(v.kind, v.plan, l) && (v.plan !== 'van' || l.road.kind !== 'rural');
    const dock = this.graph.laneById.get(DOCK_LANE)!;
    let goal: Target;
    if (v.plan === 'van') {
      goal = v.trip % 2 === 0
        ? { ...this.storeStops[Math.floor(this.random() * this.storeStops.length)]!, dwell: 10 + this.random() * 8, what: 'store' }
        : { lane: dock.index, s: dock.path.length - 4 - this.random() * 8, dwell: 14, what: 'dock' };
    } else {
      goal = v.trip === 0
        ? { lane: dock.index, s: dock.path.length - 8, dwell: 25, what: 'dock' }
        : { lane: this.exitsOut.filter((i) => this.graph.lanes[i]!.road.heavy)[Math.floor(this.random() * 2)]!, s: 1e9, dwell: 0, what: 'stop' };
    }
    let route: number[] | null = goal.lane === lane.index && goal.s > v.s + 2 ? [] : null;
    if (!route) {
      // Leave this lane first (the goal may be behind us on the same lane).
      let best = Infinity;
      for (const mi of lane.out) {
        const m = this.graph.movements[mi]!;
        if (!allow(this.graph.lanes[m.to]!)) continue;
        const rest = routeBetween(this.graph, m.to, goal.lane, allow);
        const cost = rest ? rest.reduce((t, i) => t + this.graph.movements[i]!.path.length + this.graph.lanes[this.graph.movements[i]!.to]!.path.length, 0) + (m.turn === 'uturn' ? 40 : 0) : Infinity;
        if (rest && cost < best) { best = cost; route = [mi, ...rest]; }
      }
    }
    if (!route) { v.plan = 'wander'; return; }
    v.route = route;
    if (goal.s < 1e8) {
      const L = this.graph.lanes[goal.lane]!.path.length;
      goal.s = Math.min(L - 1, Math.max(v.spec.length / 2 + 0.5, goal.s));
      v.target = goal;
    } else v.target = null;
    v.trip++;
  }

  // ---------------------------------------------------------------- junction admission

  private claim(m: Movement, v: Vehicle): void { this.claims.get(m.node)!.set(v.id, m.index); }

  private release(v: Vehicle): void {
    for (const set of this.claims.values()) set.delete(v.id);
  }


  private rank(m: Movement): number {
    const lane = this.graph.lanes[m.from]!;
    const node = nodeById(m.node);
    const minor = node.control === 'stop' && lane.road.priority < this.maxPriority.get(node.id)!;
    return lane.road.priority - (minor ? 10 : 0);
  }

  /** True when `other` has right of way over `mine` (both unsignalised, conflicting). */
  private yieldsTo(mine: Movement, other: Movement): boolean {
    const a = this.rank(mine); const b = this.rank(other);
    if (a !== b) return b > a;
    if (mine.turn === 'left' && other.turn !== 'left') return true;
    if (other.turn === 'left' && mine.turn !== 'left') return false;
    const d1 = this.graph.lanes[mine.from]!.dir; const d2 = this.graph.lanes[other.from]!.dir;
    return d1.x * d2.z - d1.z * d2.x > 0; // the other comes from my right
  }

  canEnter(v: Vehicle, m: Movement, distance: number, ctx: TrafficContext): boolean {
    const node = nodeById(m.node);
    const lane = this.graph.lanes[m.from]!;
    const plan = this.signals.get(node.id);
    if (plan) {
      const aspect = laneAspect(plan, lane.index, ctx.time);
      if (aspect === 'red') return false;
      if (aspect === 'yellow' && distance > (v.v * v.v) / (2 * COMFORT_STOP) + 1) return false;
    } else if (this.rank(m) < -5 && !v.stoppedAtLine) {
      return false;
    }
    const claims = this.claims.get(node.id)!;
    for (const [id, other] of claims) {
      if (id !== v.id && m.conflicts.includes(other)) return false;
    }
    if (!plan && v.wait < 7) {
      for (const ci of m.conflicts) {
        const c = this.graph.movements[ci]!;
        if (!this.yieldsTo(m, c)) continue;
        for (const id of this.onLane[c.from]!) {
          const o = this.byId(id)!;
          if (o.route[0] !== c.index) continue;
          const d = this.graph.lanes[c.from]!.path.length - o.s;
          if (d < 35 && (d < 8 || d / Math.max(o.v, 0.5) < 4.5) && !(o.v < 0.5 && this.rank(c) < -5 && !o.stoppedAtLine)) return false;
        }
      }
    }
    const to = this.graph.lanes[m.to]!;
    if (ctx.crosswalkBusy(node.id, lane.road.id) || ctx.crosswalkBusy(node.id, to.road.id)) return false;
    for (const id of this.onLane[m.to]!) {
      const o = this.byId(id)!;
      if (o.s - o.spec.length / 2 < v.spec.length + 2.5) return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- simulation

  private segPath(seg: Seg) {
    return seg.kind === 'lane' ? this.graph.lanes[seg.index]!.path : this.graph.movements[seg.index]!.path;
  }

  private segLimit(v: Vehicle, seg: Seg): number {
    const limit = seg.kind === 'lane' ? this.graph.lanes[seg.index]!.speedLimit : this.graph.movements[seg.index]!.maxSpeed;
    return Math.min(limit, v.spec.vmax);
  }

  private pose(v: Vehicle): void {
    const p = pathPose(this.segPath(v.seg), v.s);
    const k = v.spec.kerb;
    v.x = p.x + Math.cos(p.yaw) * k;
    v.z = p.z - Math.sin(p.yaw) * k;
    v.yaw = p.yaw;
  }

  /** IDM acceleration with a free-road speed `v0` and an obstacle `gap` metres ahead moving at `vl`. */
  private idm(v: Vehicle, v0: number, gap: number, vl: number): number {
    const sp = v.spec;
    const free = 1 - (v.v / Math.max(v0, 0.1)) ** 4;
    if (!Number.isFinite(gap)) return sp.accel * free;
    const desired = sp.gap + Math.max(0, v.v * sp.headway + (v.v * (v.v - vl)) / (2 * Math.sqrt(sp.accel * sp.decel)));
    return sp.accel * (free - (desired / Math.max(gap, 0.1)) ** 2);
  }

  private step(v: Vehicle, dt: number, ctx: TrafficContext): void {
    if (v.dwell > 0) {
      v.dwell -= dt;
      v.v = 0; v.a = 0; v.braking = true;
      if (v.dwell <= 0) { v.target = null; if (v.plan === 'van' || v.plan === 'truck') { v.route = []; this.newTrip(v); if (v.seg.kind === 'lane') this.plan(v); } }
      return;
    }
    let v0 = this.segLimit(v, v.seg);
    let gap = Infinity; let vl = 0;
    let why = 'free';
    const consider = (g: number, speed: number, what: string) => { if (g < gap) { gap = g; vl = speed; why = what; } };
    const limitAt = (d: number, speed: number) => { v0 = Math.min(v0, Math.sqrt(speed * speed + 2 * v.spec.decel * Math.max(0, d))); };
    // Walk the segments ahead.
    let seg: Seg = v.seg;
    let offset = -v.s; // distance from the vehicle to the start of `seg`
    let routeAt = 0;
    const playerNear = Math.hypot(ctx.player.x - v.x, ctx.player.z - v.z) < LOOKAHEAD;
    for (let depth = 0; depth < 4 && offset < LOOKAHEAD; depth++) {
      const path = this.segPath(seg);
      // Vehicles on this segment ahead of us.
      const list = seg.kind === 'lane' ? this.onLane[seg.index]! : this.onMove[seg.index]!;
      let best: Vehicle | null = null;
      for (const id of list) {
        if (id === v.id) continue;
        const o = this.byId(id)!;
        const d = offset + o.s;
        if (d <= 0.01) continue;
        if (!best || d < offset + best.s) best = o;
      }
      if (best) consider(offset + best.s - (best.spec.length + v.spec.length) / 2, best.v, `leader ${best.id}`);
      if (depth > 0) limitAt(offset, this.segLimit(v, seg));
      if (seg.kind === 'lane') {
        for (const hs of this.humpsOn.get(seg.index) ?? []) { const d = offset + hs - v.spec.length / 2; if (d > -2) limitAt(Math.max(0, d), 3.2); }
        if (v.target && v.target.lane === seg.index && offset + v.target.s > -1) consider(offset + v.target.s + v.spec.gap, 0, 'target');
      }
      if (playerNear) {
        const clear = v.spec.width / 2 + ctx.player.radius + 0.5;
        for (let s = Math.max(0, -offset + v.spec.length / 2); s < path.length; s += 1.5) {
          const p = pathPose(path, s);
          if (Math.hypot(p.x - ctx.player.x, p.z - ctx.player.z) < clear) { consider(offset + s - v.spec.length / 2 - 0.4, 0, 'player'); break; }
        }
      }
      if (best) break;
      // Next segment.
      if (seg.kind === 'lane') {
        const lane = this.graph.lanes[seg.index]!;
        const mi = v.route[routeAt];
        if (mi === undefined) break; // exit lane: drive off the map
        const m = this.graph.movements[mi]!;
        const d = offset + lane.path.length - v.spec.length / 2;
        if (depth === 0 && !v.admitted) {
          if (d < 1.6 && v.v < 0.3) v.stoppedAtLine = true;
          if (d < 30 && this.canEnter(v, m, d, ctx) && (d < 5 || d / Math.max(v.v, 0.5) < 3)) {
            v.admitted = true;
            this.claim(m, v);
          }
        }
        if (depth === 0 && !v.admitted) { consider(d + v.spec.gap - 0.4, 0, 'junction'); break; }
        seg = { kind: 'move', index: mi };
        routeAt++;
      } else {
        seg = { kind: 'lane', index: this.graph.movements[seg.index]!.to };
      }
      offset += path.length;
    }
    v.reason = why;
    let a = this.idm(v, v0, gap, vl);
    a = Math.max(-8, Math.min(v.spec.accel, a));
    v.a = a;
    v.braking = a < -0.4 || v.v < 0.2;
    v.v = Math.max(0, v.v + a * dt);
    if (v.v < 0.05 && gap < 6) v.wait += dt; else v.wait = 0;
    v.s += v.v * dt;
    // Arrival at a dwell target.
    if (v.target && v.seg.kind === 'lane' && v.seg.index === v.target.lane && Math.abs(v.s - v.target.s) < 2.5 && v.v < 0.6) {
      v.dwell = v.target.dwell;
      if (v.plan === 'bus') v.target = null;
    }
    this.advance(v);
  }

  private advance(v: Vehicle): void {
    let path = this.segPath(v.seg);
    while (v.s > path.length) {
      if (v.seg.kind === 'lane') {
        const lane = this.graph.lanes[v.seg.index]!;
        if (nodeById(lane.to).exit) { this.despawn(v); return; }
        const mi = v.route[0];
        if (mi === undefined || !v.admitted) { v.s = path.length; v.v = 0; break; }
        this.move(v, { kind: 'move', index: mi }, v.s - path.length);
        v.route.shift();
      } else {
        const m = this.graph.movements[v.seg.index]!;
        this.move(v, { kind: 'lane', index: m.to }, v.s - path.length);
        v.admitted = false; v.stoppedAtLine = false;
        this.plan(v);
      }
      path = this.segPath(v.seg);
    }
    // The junction claim is held until the tail has left the box.
    if (v.seg.kind === 'lane' && v.s > v.spec.length) {
      const lane = this.graph.lanes[v.seg.index]!;
      const claims = this.claims.get(lane.from)!;
      const held = claims.get(v.id);
      if (held !== undefined && this.graph.movements[held]!.to === lane.index) claims.delete(v.id);
    }
  }

  private move(v: Vehicle, seg: Seg, s: number): void {
    const from = v.seg.kind === 'lane' ? this.onLane[v.seg.index]! : this.onMove[v.seg.index]!;
    from.splice(from.indexOf(v.id), 1);
    (seg.kind === 'lane' ? this.onLane[seg.index]! : this.onMove[seg.index]!).push(v.id);
    v.seg = seg;
    v.s = s;
  }

  private despawn(v: Vehicle): void {
    const list = v.seg.kind === 'lane' ? this.onLane[v.seg.index]! : this.onMove[v.seg.index]!;
    const i = list.indexOf(v.id);
    if (i >= 0) list.splice(i, 1);
    this.release(v);
    v.active = false;
  }

  update(dt: number, ctx: TrafficContext): void {
    if (!(dt > 0)) return;
    this.frame++;
    this.spawnClock -= dt;
    for (const v of this.vehicles) {
      if (!v.active) continue;
      // Far vehicles update every other frame with a doubled step (invisible in the haze).
      const far = Math.hypot(v.x - ctx.player.x, v.z - ctx.player.z) > 110;
      if (far && (v.id + this.frame) % 2 === 1) continue;
      this.step(v, far ? dt * 2 : dt, ctx);
      if (v.active) this.pose(v);
      // Surplus general traffic leaves quietly when far from the player.
      if (v.active && v.plan === 'wander' && far && this.frame % 60 === v.id % 60) {
        const general = this.vehicles.filter((q) => q.active && q.plan === 'wander').length;
        if (general > Math.round(this.options.capacity * Math.max(0.3, ctx.density)) + 2) this.despawn(v);
      }
    }
    if (this.frame % 30 === 0) {
      for (let i = this.vehicles.length - 1; i >= 0; i--) if (!this.vehicles[i]!.active) this.vehicles.splice(i, 1);
      this.populate(ctx, false);
    }
  }

  /** Circle (the player) against vehicle footprints; used to block the player's motion. */
  blocks(x: number, z: number, r: number): boolean {
    for (const v of this.vehicles) {
      if (!v.active) continue;
      const dx = x - v.x; const dz = z - v.z;
      if (dx * dx + dz * dz > 64) continue;
      const c = Math.cos(v.yaw); const s = Math.sin(v.yaw);
      const along = dx * s + dz * c; const across = dx * c - dz * s;
      const hx = v.spec.length / 2; const hz = v.spec.width / 2;
      const qx = Math.max(-hx, Math.min(along, hx)); const qz = Math.max(-hz, Math.min(across, hz));
      if ((along - qx) ** 2 + (across - qz) ** 2 < r * r) return true;
    }
    return false;
  }

  /** True when no vehicle is using or about to use the crosswalk on `road` at `node`. */
  armClear(node: string, road: string): boolean {
    for (const mi of this.claims.get(node)?.values() ?? []) {
      const m = this.graph.movements[mi]!;
      if (this.graph.lanes[m.from]!.road.id === road || this.graph.lanes[m.to]!.road.id === road) return false;
    }
    for (const lane of this.graph.lanes) {
      if (lane.to !== node || lane.road.id !== road) continue;
      for (const id of this.onLane[lane.index]!) {
        const o = this.byId(id)!;
        const d = lane.path.length - o.s;
        if (d < 16 && o.v > 1.5 && d / o.v < 3) return false;
      }
    }
    return true;
  }

  /** A bus dwelling at the stop nearest (x, z), if any. */
  busAt(x: number, z: number): Vehicle | null {
    return this.vehicles.find((v) => v.active && v.kind === 'bus' && v.dwell > 0 && Math.hypot(v.x - x, v.z - z) < 9) ?? null;
  }
}
