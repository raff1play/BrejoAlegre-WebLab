import { axesOf, framePoint, yawOf } from '../layout.ts';
import { CITY_LOTS, DEPOT_FRAME, LANE_OFFSET, NODES, ROADS, depotWorld, depotYaw, nearestRoad } from './cityPlan.ts';
import { cityTrees, streetLightPositions } from './cityLayout.ts';
import { TOWN_CENTRE } from '../geo/geoCity.ts';

/**
 * CORE-015 fixtures for the browser play-through (development builds only): picks, from the REAL
 * map, a straight approach to a four-way junction and a house lot fronting a street, and converts
 * the CORE-014 depot coordinates (kept in the depot's own frame) to world coordinates.
 */
export type Probe = {
  depot: (x: number, z: number) => { x: number; z: number };
  depotLocal: (x: number, z: number) => { x: number; z: number };
  depotYaw: (yaw: number) => number;
  junction: { x: number; z: number; startX: number; startZ: number; yaw: number; road: string | null };
  lot: { id: string; startX: number; startZ: number; yaw: number; ox: number; oz: number; ix: number; iz: number; width: number };
};

/** World → CORE-014 depot coordinates (inverse of depotWorld). */
export function depotLocal(x: number, z: number): { x: number; z: number } {
  const a = axesOf(DEPOT_FRAME);
  const dx = x - DEPOT_FRAME.ox; const dz = z - DEPOT_FRAME.oz;
  return { x: 139.8 - (dx * a.fx + dz * a.fz), z: -92.2 - (dx * a.ix + dz * a.iz) };
}

export function buildProbe(): Probe {
  const solids = [...cityTrees(), ...streetLightPositions()];
  const clearPath = (x0: number, z0: number, x1: number, z1: number, r: number) => solids.every((s) => {
    const dx = x1 - x0; const dz = z1 - z0; const L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((s.x - x0) * dx + (s.z - z0) * dz) / L2));
    return Math.hypot(x0 + dx * t - s.x, z0 + dz * t - s.z) > r;
  });
  const byDist = (x: number, z: number) => Math.hypot(x - TOWN_CENTRE[0], z - TOWN_CENTRE[1]);
  // Junction: four urban arms; approach along an arm whose first 40 m are straight.
  let junction: Probe['junction'] | null = null;
  for (const n of [...NODES].filter((q) => !q.exit).sort((a, b) => byDist(a.x, a.z) - byDist(b.x, b.z))) {
    const arms = ROADS.filter((r) => (r.a === n.id || r.b === n.id) && r.kind === 'urban');
    if (arms.length !== 4) continue;
    for (const r of arms) {
      const pts = r.a === n.id ? r.pts : [...r.pts].reverse();
      const p1 = pts[1]!;
      const L = Math.hypot(p1[0] - n.x, p1[1] - n.z);
      if (L < 45) continue;
      const ux = (p1[0] - n.x) / L; const uz = (p1[1] - n.z) / L; // outward along the arm
      // Travel towards the node: direction −u, right of travel = (−uz, ux)·… → right lane offset.
      const dx = -ux; const dz = -uz;
      const sx = n.x + ux * 40 + dz * LANE_OFFSET; const sz = n.z + uz * 40 - dx * LANE_OFFSET;
      junction = { x: n.x, z: n.z, startX: sx, startZ: sz, yaw: Math.atan2(dx, dz), road: r.name };
      break;
    }
    if (junction) break;
  }
  // Lot: a house lot whose frontage has a clear straight run from the lane to the lot line.
  let lot: Probe['lot'] | null = null;
  for (const l of [...CITY_LOTS].filter((q) => q.width >= 10).sort((a, b) => {
    const pa = framePoint(a.frame, a.width / 2, 0); const pb = framePoint(b.frame, b.width / 2, 0);
    return byDist(pa.x, pa.z) - byDist(pb.x, pb.z);
  })) {
    const s = framePoint(l.frame, l.width / 2, -4.6); const e = framePoint(l.frame, l.width / 2, 0);
    if (!clearPath(s.x, s.z, e.x, e.z, 2.2)) continue;
    const a = axesOf(l.frame);
    lot = { id: l.id, startX: s.x, startZ: s.z, yaw: yawOf(l.frame), ox: l.frame.ox, oz: l.frame.oz, ix: a.ix, iz: a.iz, width: l.width };
    break;
  }
  if (!junction || !lot) throw new Error('probe: no junction/lot found');
  return { depot: depotWorld, depotLocal, depotYaw, junction, lot };
}

/** A kerbside parking spot on the street nearest to (x, z): 2.6 m off the axis, kerb on the right. */
export function parkNear(x: number, z: number): { x: number; z: number; yaw: number } {
  const n = nearestRoad(x, z, (r) => r.kind === 'urban') ?? nearestRoad(x, z)!;
  const L = Math.hypot(x - n.x, z - n.z) || 1;
  const ux = (x - n.x) / L; const uz = (z - n.z) / L;
  return { x: n.x + ux * 2.6, z: n.z + uz * 2.6, yaw: Math.atan2(-uz, ux) };
}
