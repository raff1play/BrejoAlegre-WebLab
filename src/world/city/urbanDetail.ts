import { NODES, ROADS, type CityRoad } from './cityPlan.ts';
import { ROAD_HALF } from '../layout.ts';
import { crossingDistance } from '../../core/city/pedestrians.ts';

/**
 * Road-paint plan shared by the visual build and deterministic regression tests.
 * Every mark belongs to the OSM-derived street axis; crosswalks and signals are
 * fictional visual/gameplay additions, NOT claims about real municipal signage.
 */
export type XZ = readonly [number, number];
export type PaintStroke = Readonly<{
  start: XZ;
  end: XZ;
  width: number;
  kind: 'zebra' | 'stop' | 'centre' | 'edge';
  roadId: string;
  nodeId?: string;
}>;
export type ZebraSite = Readonly<{ nodeId: string; roadId: string; x: number; z: number; dirX: number; dirZ: number }>;

const ARMS = new Map(NODES.map((n) => [n.id, ROADS.filter((r) => r.a === n.id || r.b === n.id)]));
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

/** Distance-along-polyline pose, facing outward from the selected junction. */
export function armPose(road: CityRoad, nodeId: string, distance: number): { x: number; z: number; dx: number; dz: number } {
  const pts = road.a === nodeId ? road.pts : [...road.pts].reverse();
  let left = clamp(distance, 0, road.length);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!; const b = pts[i]!;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-7) continue;
    const dx = (b[0] - a[0]) / L; const dz = (b[1] - a[1]) / L;
    if (left <= L || i === pts.length - 1) {
      return { x: a[0] + dx * Math.min(left, L), z: a[1] + dz * Math.min(left, L), dx, dz };
    }
    left -= L;
  }
  const a = pts[0]!;
  return { x: a[0], z: a[1], dx: 1, dz: 0 };
}

const line = (a: XZ, b: XZ, width: number, kind: PaintStroke['kind'], roadId: string, nodeId?: string): PaintStroke =>
  ({ start: a, end: b, width, kind, roadId, ...(nodeId ? { nodeId } : {}) });

/**
 * A crossing spans the carriageway, with bars laid across the road (not along it).
 * Limit to intersections with roomy approaches; tiny OSM offset junctions otherwise
 * produce overlapping markings. Pedestrian graph uses the same crossingDistance().
 */
export function zebraSites(): ZebraSite[] {
  const result: ZebraSite[] = [];
  for (const n of NODES) {
    const arms = ARMS.get(n.id)!;
    if (n.exit || arms.length < 3 || arms.filter((r) => r.kind === 'urban').length < 3) continue;
    if (Math.min(...arms.map((r) => r.length)) < 18) continue;
    const d = crossingDistance(n);
    for (const r of arms) {
      if (r.kind !== 'urban' || r.length < 18) continue;
      const p = armPose(r, n.id, d);
      result.push({ nodeId: n.id, roadId: r.id, x: p.x, z: p.z, dirX: p.dx, dirZ: p.dz });
    }
  }
  return result;
}

export function streetPaint(): PaintStroke[] {
  const result: PaintStroke[] = [];
  // Discreet white centre dashes on local residential streets; the main roads
  // already have their yellow centre and edge markings in cityBuild.ts.
  for (const r of ROADS) {
    if (r.kind !== 'urban' || r.highway.startsWith('secondary') || r.oneway || r.length < 34) continue;
    for (let at = 10; at + 2.4 < r.length - 9; at += 9) {
      const a = armPose(r, r.a, at);
      const b = armPose(r, r.a, at + 2.4);
      result.push(line([a.x, a.z], [b.x, b.z], 0.085, 'centre', r.id));
    }
  }
  // Zebra stripes: six stripes 0.34m wide, spaced 0.54m apart. All lie
  // inside the 8m carriageway and align with the actual pedestrian crossings.
  for (const z of zebraSites()) {
    const sideX = -z.dirZ, sideZ = z.dirX;
    for (let k = 0; k < 6; k++) {
      const along = (k - 2.5) * 0.54;
      const cx = z.x + z.dirX * along, cz = z.z + z.dirZ * along;
      const a: XZ = [cx - sideX * (ROAD_HALF - 0.48), cz - sideZ * (ROAD_HALF - 0.48)];
      const b: XZ = [cx + sideX * (ROAD_HALF - 0.48), cz + sideZ * (ROAD_HALF - 0.48)];
      result.push(line(a, b, 0.34, 'zebra', z.roadId, z.nodeId));
    }
  }
  // Stop bars on inbound half-lanes (not across opposing traffic).
  for (const n of NODES) {
    const arms = ARMS.get(n.id)!;
    if (arms.length < 3 || n.exit) continue;
    const bestPriority = Math.max(...arms.map((r) => r.priority));
    for (const r of arms) {
      if (r.kind !== 'urban' || r.length < 21) continue;
      if (n.control !== 'signal' && !(n.control === 'stop' && r.priority < bestPriority)) continue;
      const d = Math.min(10.3, r.length * 0.43);
      const p = armPose(r, n.id, d);
      const leftX = -p.dz, leftZ = p.dx;
      result.push(line(
        [p.x + leftX * 0.18, p.z + leftZ * 0.18],
        [p.x + leftX * (ROAD_HALF - 0.48), p.z + leftZ * (ROAD_HALF - 0.48)],
        0.30, 'stop', r.id, n.id,
      ));
    }
  }
  return result;
}
