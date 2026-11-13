import type { Box3D } from '../core/math.ts';
import { buildOccluders, CURB_H, POLES, SHOP_PROPS, TREES, WALL_RUNS, showcaseStreetItems } from './layout.ts';
import { cityColliders, DEPOT, STORES, storeLayout } from './city/cityPlan.ts';
import { cityCameraObstacles, cityTrees, streetLightPositions } from './city/cityLayout.ts';

const walkIn = [DEPOT.building, ...STORES.filter((s) => s.id !== 'mercearia').map((s) => storeLayout(s).floor)];
/** True for a box fully inside a walk-in building (its furniture and walls). */
const inside = (b: { minX: number; maxX: number; minZ: number; maxZ: number }) =>
  walkIn.some((w) => b.minX >= w.minX - 0.01 && b.maxX <= w.maxX + 0.01 && b.minZ >= w.minZ - 0.01 && b.maxZ <= w.maxZ + 0.01);

/** Static blockers for the chase camera; far cheaper than ray-testing the detailed render meshes. */
export function cameraObstacles(): Box3D[] {
  const box = (minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): Box3D =>
    ({ minX, maxX, minY, maxY, minZ, maxZ });
  return [
    ...buildOccluders().map((o) => o.box),
    ...WALL_RUNS.map((run) => ({ ...run.box, minY: 0, maxY: 2.35 })),
    ...TREES.filter((tree) => tree.solid).map((t) => {
      const r = 0.26 * t.scale;
      return box(t.x - r, t.x + r, 0, 4.2 * t.scale, t.z - r, t.z + r);
    }),
    ...POLES.map((p) => box(p.x - 0.2, p.x + 0.2, 0, 8, p.z - 0.2, p.z + 0.2)),
    ...showcaseStreetItems().filter((i) => i.kind === 'poste-colonial')
      .map((i) => box(i.x - 0.2, i.x + 0.2, CURB_H, 4.2, i.z - 0.2, i.z + 0.2)),
    ...SHOP_PROPS.map((p) => ({ ...p, minY: CURB_H, maxY: 1.25 })),
    // CORE-013: new town blocks, shelters, trees and street lights (solid simplified volumes).
    // CORE-014: shops and the depot are walk-in, so what lies inside them (counters, shelves,
    // desks) is left out here; their walls and ceilings come from cityCameraObstacles().
    ...cityColliders().filter((b) => !inside(b)).map((b) => ({ ...b, minY: 0, maxY: 5 })),
    ...cityTrees().map((tree) => {
      const radius = 0.26 * tree.scale;
      return box(tree.x - radius, tree.x + radius, 0, 4.2 * tree.scale, tree.z - radius, tree.z + radius);
    }),
    ...streetLightPositions().map((p) => box(p.x - 0.2, p.x + 0.2, 0, 6.5, p.z - 0.2, p.z + 0.2)),
    ...cityCameraObstacles(),
  ];
}
