import type { RoadGraph } from '../../core/city/roadGraph.ts';
import type { SignalPlan } from '../../core/city/signals.ts';
import type { WalkGraph } from '../../core/city/pedestrians.ts';
import { ROAD_HALF } from '../layout.ts';
import { clearOfFixtures, validFixtureSite, type FixturePoint } from './fixturePlacement.ts';
import { shopFurniture, streetLightPositions } from './cityLayout.ts';

/** Drawable equipment belongs to the SAME geometric rules as the generated pavements. */
export type SignalFixture = Readonly<{
  x: number; z: number; yaw: number;
  faceX: number; faceZ: number;
  node: string; lane: number; ped: boolean;
}>;

export function signalFixturePositions(
  graph: RoadGraph, plans: Map<string, SignalPlan>, walk: WalkGraph,
): SignalFixture[] {
  const positions: SignalFixture[] = [];
  const occupied: FixturePoint[] = [
    ...shopFurniture().lamps,
    ...streetLightPositions(),
  ];
  const fits = (p: FixturePoint, radius: number): boolean =>
    validFixtureSite(p, radius) && clearOfFixtures(p, occupied, 2.0);
  const append = (p: SignalFixture) => { positions.push(p); occupied.push(p); };

  for (const plan of plans.values()) {
    for (const laneIndex of plan.approaches) {
      const lane = graph.lanes[laneIndex]!;
      const end = lane.path.points[lane.path.points.length - 1]!;
      const d = lane.endDir;
      // lane.path is shifted to the RIGHT of travel by 1.9 m in two-way
      // streets but only 0.4 m in one-way streets. The former hard-coded
      // compensation displaced one-way signals into the carriageway.
      const laneShift = lane.road.oneway ? 0.4 : 1.9;
      const rx = d.z, rz = -d.x;
      let found: SignalFixture | null = null;
      // Prefer the right kerb. Some irregular OSM junctions have no valid
      // pavement there, so a signal head may instead face traffic from the
      // opposite sidewalk rather than be drawn in the carriageway.
      for (const side of [1, -1]) {
        for (const back of [0, 1.5, 3, 5, 7, 9, 11, 13, 15]) {
          for (const outward of [0, 0.35, 0.75, -0.15, 1.25, -0.4, 2, 2.75, 3.5]) {
            const cross = side * (ROAD_HALF + 0.55 + outward) - laneShift;
            const p = {
              x: end.x - d.x * back + rx * cross,
              z: end.z - d.z * back + rz * cross,
            };
            if (!fits(p, 0.20)) continue;
            found = { ...p, yaw: Math.atan2(-d.x, -d.z), faceX: -d.x, faceZ: -d.z,
              node: plan.node, lane: laneIndex, ped: false };
            break;
          }
          if (found) break;
        }
        if (found) break;
      }
      if (found) append(found);
    }

    // Pedestrian heads: search along the REAL walk-graph endpoints, not by a
    // fixed global x/z offset (which went outside skewed corner pavements).
    for (const e of walk.edges) {
      if (!e.cross || e.cross.node !== plan.node) continue;
      const pa = walk.points[e.a]!; const pb = walk.points[e.b]!;
      const dx = pb.x - pa.x, dz = pb.z - pa.z, L = Math.hypot(dx, dz);
      if (L < 0.1) continue;
      const acrossX = dx / L, acrossZ = dz / L;
      const alongX = -acrossZ, alongZ = acrossX;
      for (const base of [pa, pb]) {
        let found: SignalFixture | null = null;
        for (const along of [-1.5, 1.5, -2.8, 2.8, 0]) {
          for (const near of [0, -0.25, 0.25]) {
            const p = { x: base.x + alongX * along + acrossX * near,
              z: base.z + alongZ * along + acrossZ * near };
            if (!fits(p, 0.17)) continue;
            const toward = base === pa ? 1 : -1;
            found = { ...p, yaw: Math.atan2(acrossX * toward, acrossZ * toward),
              faceX: acrossX * toward, faceZ: acrossZ * toward,
              node: plan.node, lane: -1, ped: true };
            break;
          }
          if (found) break;
        }
        if (found) append(found);
      }
    }
  }
  return positions;
}
