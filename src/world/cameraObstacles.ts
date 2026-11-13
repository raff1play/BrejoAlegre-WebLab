import type { Box3D } from '../core/math.ts';
import { cityCameraObstacles, cityTrees, streetLightPositions } from './city/cityLayout.ts';

/** Static blockers for the chase camera (CORE-015: the real town, oriented boxes). */
export function cameraObstacles(): Box3D[] {
  const box = (minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): Box3D =>
    ({ minX, maxX, minY, maxY, minZ, maxZ });
  return [
    ...cityCameraObstacles(),
    ...cityTrees().map((tree) => {
      const radius = 0.26 * tree.scale;
      return box(tree.x - radius, tree.x + radius, 0, 4.2 * tree.scale, tree.z - radius, tree.z + radius);
    }),
    ...streetLightPositions().map((p) => box(p.x - 0.2, p.x + 0.2, 0, 6.5, p.z - 0.2, p.z + 0.2)),
  ];
}
