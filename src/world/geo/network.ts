import type { Box2D } from '../../core/collision.ts';
import { GEO } from './brejoAlegreData.ts';
import type { GeoStreet, XZ } from './geoTypes.ts';

/**
 * CORE-015 real street network of Brejo Alegre/SP from OpenStreetMap (© OpenStreetMap
 * contributors, ODbL). 1 unit = 1 m, +x east, +z north, origin at the OSM place node of the town
 * (see `GEO.projection`). Roads are polylines between junction nodes; nothing here is invented:
 * the only synthetic points are where a real road is clipped at the network boundary (exits).
 */

/** The urban seat (main grid + the northern cluster) as mapped in OSM, with a margin. */
export const SEDE: Box2D = { minX: -510, maxX: 700, minZ: -380, maxZ: 680 };
/** Where the player can go: the seat plus the first metres of every approach road. */
export const PLAY_BOUNDS: Box2D = { minX: -590, maxX: 780, minZ: -460, maxZ: 760 };
/** Roads are drawn (and traffic enters/leaves) up to here, out of the player's reach. */
export const NET_BOUNDS: Box2D = { minX: -710, maxX: 900, minZ: -580, maxZ: 880 };

const DRIVABLE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link']);

export type NetNode = { id: string; x: number; z: number; exit: boolean; osm: number | null };
export type NetRoad = {
  id: string; name: string | null; a: string; b: string; pts: XZ[]; length: number;
  highway: string; osmWay: number; kind: 'urban' | 'rural'; priority: number; heavy: boolean; oneway: boolean;
};

const inside = (b: Box2D, p: XZ) => p[0] >= b.minX && p[0] <= b.maxX && p[1] >= b.minZ && p[1] <= b.maxZ;

/** Clips a polyline to a box; returns the inside pieces (boundary crossings are interpolated). */
function clip(pts: XZ[], ids: (number | null)[], box: Box2D): { pts: XZ[]; ids: (number | null)[] }[] {
  const out: { pts: XZ[]; ids: (number | null)[] }[] = [];
  let cur: { pts: XZ[]; ids: (number | null)[] } | null = null;
  const cross = (a: XZ, b: XZ): XZ => {
    // Liang–Barsky style: the parameter where segment a→b leaves/enters the box.
    let t0 = 0; let t1 = 1;
    const dx = b[0] - a[0]; const dz = b[1] - a[1];
    for (const [p, q] of [[-dx, a[0] - box.minX], [dx, box.maxX - a[0]], [-dz, a[1] - box.minZ], [dz, box.maxZ - a[1]]] as const) {
      if (p === 0) continue;
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
    }
    const t = inside(box, a) ? t1 : t0;
    return [Math.round((a[0] + dx * t) * 10) / 10, Math.round((a[1] + dz * t) * 10) / 10];
  };
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!; const isIn = inside(box, p);
    if (isIn) {
      if (!cur) { cur = { pts: [], ids: [] }; if (i > 0) { cur.pts.push(cross(pts[i - 1]!, p)); cur.ids.push(null); } }
      cur.pts.push(p); cur.ids.push(ids[i] ?? null);
    } else if (cur) {
      cur.pts.push(cross(pts[i - 1]!, p)); cur.ids.push(null);
      out.push(cur); cur = null;
    }
  }
  if (cur) out.push(cur);
  return out.filter((c) => c.pts.length >= 2);
}

const priorityOf = (h: string) => (h.startsWith('primary') ? 4 : h.startsWith('secondary') ? 3 : h.startsWith('tertiary') ? 2 : h === 'unclassified' ? 1 : 0);

export type Network = { nodes: NetNode[]; roads: NetRoad[]; byId: Map<string, NetNode> };

export function buildNetwork(): Network {
  const ways: { street: GeoStreet; pts: XZ[]; ids: (number | null)[] }[] = [];
  for (const s of GEO.streets) {
    if (!DRIVABLE.has(s.highway)) continue;
    for (const piece of clip(s.pts, s.nodes, NET_BOUNDS)) ways.push({ street: s, ...piece });
  }
  // Vertex keys: OSM node id when known, otherwise the rounded coordinate (boundary cuts).
  const key = (id: number | null, p: XZ) => (id !== null ? `n${id}` : `p${p[0]},${p[1]}`);
  const uses = new Map<string, number>();
  for (const w of ways) w.pts.forEach((p, i) => {
    const k = key(w.ids[i]!, p);
    const endpoint = i === 0 || i === w.pts.length - 1;
    uses.set(k, (uses.get(k) ?? 0) + (endpoint ? 1 : 2));
  });
  const nodes = new Map<string, NetNode>();
  const roads: NetRoad[] = [];
  const nodeAt = (k: string, p: XZ, id: number | null) => {
    let n = nodes.get(k);
    if (!n) {
      const onEdge = Math.abs(p[0] - NET_BOUNDS.minX) < 0.2 || Math.abs(p[0] - NET_BOUNDS.maxX) < 0.2 || Math.abs(p[1] - NET_BOUNDS.minZ) < 0.2 || Math.abs(p[1] - NET_BOUNDS.maxZ) < 0.2;
      n = { id: k, x: p[0], z: p[1], exit: onEdge, osm: id };
      nodes.set(k, n);
    }
    return n;
  };
  for (const w of ways) {
    let start = 0;
    for (let i = 1; i < w.pts.length; i++) {
      const k = key(w.ids[i]!, w.pts[i]!);
      const junction = i === w.pts.length - 1 || (uses.get(k) ?? 0) >= 3;
      if (!junction) continue;
      const a = nodeAt(key(w.ids[start]!, w.pts[start]!), w.pts[start]!, w.ids[start]!);
      const b = nodeAt(k, w.pts[i]!, w.ids[i]!);
      const pts = w.pts.slice(start, i + 1);
      const length = pts.slice(1).reduce((t, p, j) => t + Math.hypot(p[0] - pts[j]![0], p[1] - pts[j]![1]), 0);
      if (a !== b && length > 0.5) {
        const h = w.street.highway;
        // Urban: the stretch lies in the seat (by its middle point); slip roads stay rural.
        const mid = pts[Math.floor(pts.length / 2)]!;
        const urban = (h === 'residential' || h === 'living_street' || (inside(SEDE, mid) && inside(SEDE, pts[0]!) && inside(SEDE, pts[pts.length - 1]!))) && h !== 'secondary_link';
        roads.push({
          id: `r${roads.length}`, name: w.street.name, a: a.id, b: b.id, pts, length, highway: h, osmWay: w.street.id,
          kind: urban ? 'urban' : 'rural',
          priority: priorityOf(h), heavy: priorityOf(h) >= 1, oneway: w.street.oneway,
        });
      }
      start = i;
    }
  }
  const used = new Set(roads.flatMap((r) => [r.a, r.b]));
  const list = [...nodes.values()].filter((n) => used.has(n.id));
  return { nodes: list, roads, byId: new Map(list.map((n) => [n.id, n])) };
}

export const NETWORK = buildNetwork();

/** Degree of a node in the network. */
export function degreeOf(net: Network, id: string): number {
  return net.roads.filter((r) => r.a === id || r.b === id).length;
}

/** Distance from a point to a polyline and the closest point with its arc length. */
export function nearestOnPolyline(pts: readonly XZ[], x: number, z: number): { d: number; x: number; z: number; s: number; seg: number } {
  let best = { d: Infinity, x: 0, z: 0, s: 0, seg: 0 };
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!; const b = pts[i]!;
    const dx = b[0] - a[0]; const dz = b[1] - a[1]; const L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L2));
    const px = a[0] + dx * t; const pz = a[1] + dz * t;
    const d = Math.hypot(px - x, pz - z);
    const L = Math.sqrt(L2);
    if (d < best.d) best = { d, x: px, z: pz, s: acc + L * t, seg: i - 1 };
    acc += L;
  }
  return best;
}
