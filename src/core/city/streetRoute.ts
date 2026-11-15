import { NODES, ROADS, nearestRoad, type CityRoad } from '../../world/city/cityPlan.ts';

/**
 * CORE-015.1 guidance line for the minimap: the shortest way ALONG THE REAL STREETS (OSM network)
 * between two points, respecting one-way carriageways. It never cuts through a block: every point
 * but the first and the last lies on a road axis. Pure and cheap (≈ 180 roads): the minimap asks
 * again only when the player has moved or the objective changed.
 */
export type XZ = readonly [number, number];
export type StreetRoute = { points: XZ[]; length: number };

/** Part of a polyline between two arc lengths (reversed when s1 < s0). */
function slice(pts: readonly XZ[], s0: number, s1: number): XZ[] {
  if (s1 < s0) return slice(pts, s1, s0).reverse();
  const out: XZ[] = [];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!; const b = pts[i]!;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const at = (s: number): XZ => { const t = L > 0 ? (s - acc) / L : 0; return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; };
    if (acc + L >= s0 && acc <= s1) {
      if (!out.length) out.push(at(Math.max(s0, acc)));
      out.push(at(Math.min(s1, acc + L)));
    }
    acc += L;
  }
  return out;
}

type Arc = { to: string; road: CityRoad; forward: boolean };
const ARCS: Map<string, Arc[]> = (() => {
  const m = new Map<string, Arc[]>(NODES.map((n) => [n.id, []]));
  for (const r of ROADS) {
    m.get(r.a)?.push({ to: r.b, road: r, forward: true });
    if (!r.oneway) m.get(r.b)?.push({ to: r.a, road: r, forward: false });
  }
  return m;
})();

export function streetRoute(from: { x: number; z: number }, to: { x: number; z: number }): StreetRoute | null {
  const f = nearestRoad(from.x, from.z); const t = nearestRoad(to.x, to.z);
  if (!f || !t) return null;
  const wrap = (mid: XZ[]): StreetRoute => {
    const points: XZ[] = [[from.x, from.z], ...mid, [to.x, to.z]];
    let length = 0;
    for (let i = 1; i < points.length; i++) length += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
    return { points, length };
  };
  // Same road, reachable in the allowed direction: straight along it.
  if (f.road.id === t.road.id && (!f.road.oneway || t.s >= f.s)) return wrap(slice(f.road.pts, f.s, t.s));
  // Dijkstra from the two ends of the start road to the two ends of the target road.
  const dist = new Map<string, number>(); const via = new Map<string, { from: string; arc: Arc }>();
  const open = new Set<string>();
  const seed = (id: string, d: number) => { if (d < (dist.get(id) ?? Infinity)) { dist.set(id, d); open.add(id); } };
  seed(f.road.b, f.road.length - f.s);
  if (!f.road.oneway) seed(f.road.a, f.s);
  // Leaving costs at the target road (entering at a → ride s; entering at b → ride length − s).
  const exit = new Map<string, number>([[t.road.a, t.s]]);
  if (!t.road.oneway) exit.set(t.road.b, Math.min(exit.get(t.road.b) ?? Infinity, t.road.length - t.s));
  let best: { node: string; total: number } | null = null;
  while (open.size) {
    let cur = ''; let d = Infinity;
    for (const id of open) { const v = dist.get(id)!; if (v < d) { d = v; cur = id; } }
    open.delete(cur);
    if (best && d >= best.total) break;
    const out = exit.get(cur);
    if (out !== undefined && (!best || d + out < best.total)) best = { node: cur, total: d + out };
    for (const arc of ARCS.get(cur) ?? []) {
      const nd = d + arc.road.length;
      if (nd < (dist.get(arc.to) ?? Infinity)) { dist.set(arc.to, nd); via.set(arc.to, { from: cur, arc }); open.add(arc.to); }
    }
  }
  if (!best) return null;
  const chain: Arc[] = [];
  let node = best.node;
  while (via.has(node)) { const v = via.get(node)!; chain.unshift(v.arc); node = v.from; }
  // `node` is now the end of the start road where the route leaves it.
  const mid: XZ[] = [...slice(f.road.pts, f.s, node === f.road.b ? f.road.length : 0)];
  for (const arc of chain) mid.push(...(arc.forward ? arc.road.pts : [...arc.road.pts].reverse()).slice(1));
  mid.push(...slice(t.road.pts, best.node === t.road.a ? 0 : t.road.length, t.s).slice(1));
  return wrap(mid);
}
