import type { Box3D } from '../core/math.ts';
import { buildOccluders, CURB_H, POLES, SHOP_PROPS, TREES, WALL_RUNS, showcaseStreetItems } from './layout';

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
  ];
}
