import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { createMotionGuard, type Box2D, type MotionGuard } from '../core/collision';
import { heightAt } from '../core/terrain';
import type { Box3D } from '../core/math';
import type { RaisedArea } from '../core/terrain';
import type { GraphicsProfile } from '../config/graphics';
import { BatchSet } from './geometry';
import { Materials } from './materials';
import { buildBackdrop } from './backdrop';
import { buildCity } from './city/cityBuild';
import { cityTrees, solidPolygons } from './city/cityLayout';
import { CITY_BOUNDS, cityRaised } from './city/cityPlan';
import { NET_BOUNDS } from './geo/network';
import { buildTrees } from './props';

export type World = {
  materials: Materials;
  bounds: Box2D;
  colliders: Box2D[];
  guard: MotionGuard;
  raised: RaisedArea[];
  /** Buildings that are faded when they stand between the camera and the player. */
  occluders: { box: Box3D; meshes: Mesh[] }[];
  shadowCasters: AbstractMesh[];
  /** CORE-014 roll-up shutters of the shops, animated by the store operations. */
  shutters: Map<string, Mesh>;
};

/**
 * CORE-015: builds the REAL street network of Brejo Alegre/SP (OpenStreetMap, ODbL) at 1:1 scale.
 * Shops, depot and house lots are estimated/fictional placements on real blocks; detailed houses
 * are streamed by sector (features/city/houseStreamer.ts).
 */
export function buildTemporaryWorld(scene: Scene, profile: GraphicsProfile): World {
  const materials = new Materials(scene, profile);
  const flat = new BatchSet();
  const upright = new BatchSet();
  const m = 220;
  // 6 cm under the carriageways: resolvable by a 24-bit depth buffer up to ~390 m (3 cm was not
  // beyond ~270 m), while the rider on open fields still looks grounded.
  flat.box(materials.grass, NET_BOUNDS.minX - m, NET_BOUNDS.maxX + m, -0.09, -0.06, NET_BOUNDS.minZ - m, NET_BOUNDS.maxZ + m, { sides: false });
  const city = buildCity(scene, materials, { flat, upright });
  const flatMeshes = flat.build('chao', scene);
  const uprightMeshes = upright.build('urbano', scene);
  const raised = cityRaised();
  const trees = buildTrees(scene, materials, profile.backdropDensity, cityTrees(), (x, z) => heightAt(x, z, raised), false);
  buildBackdrop(scene, materials);
  const animated = new Set<Mesh>(city.shutters.values());
  for (const mesh of [...flatMeshes, ...uprightMeshes, ...city.bodies]) {
    if (animated.has(mesh)) continue;
    mesh.computeWorldMatrix(true);
    mesh.freezeWorldMatrix();
    mesh.isPickable = false;
  }
  const polygons = solidPolygons();
  return {
    materials,
    bounds: CITY_BOUNDS,
    colliders: [],
    guard: createMotionGuard(CITY_BOUNDS, [], polygons),
    raised,
    occluders: [],
    shutters: city.shutters,
    shadowCasters: [...uprightMeshes, ...city.bodies, ...trees],
  };
}
