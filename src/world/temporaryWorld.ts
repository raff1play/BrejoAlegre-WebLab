import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { createMotionGuard, type Box2D, type MotionGuard } from '../core/collision';
import { heightAt } from '../core/terrain';
import type { Box3D } from '../core/math';
import type { RaisedArea } from '../core/terrain';
import type { GraphicsProfile } from '../config/graphics';
import { buildHouse, buildShop, type Building } from './buildings';
import { BatchSet } from './geometry';
import { Materials } from './materials';
import { buildBackdrop } from './backdrop';
import { buildCity } from './city/cityBuild';
import { cityAllColliders, cityTrees } from './city/cityLayout';
import { cityRaised } from './city/cityPlan';
import { buildBenches, buildPoles, buildShowcasePlants, buildSigns, buildStreetFurniture, buildTrees } from './props';
import { contactBlot } from './buildings';
import {
  TREES, CROSS_NORTH, CROSS_SOUTH, CROSS_Z, CURB_H, EXTENT, HOUSES, PARKING, PLAZA, PLAZA_BEDS, ROAD_HALF, SHOP, SHOP_PROPS,
  WALL_RUNS, WORLD_BOUNDS, buildColliders, buildOccluders, buildRaisedAreas, sidewalkStrips,
} from './layout';

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

function buildGround(set: BatchSet, mats: Materials): void {
  const far = 300;
  set.box(mats.grass, -far, far, -0.06, -0.03, -far, far, { sides: false });
  set.box(mats.asphalt, -ROAD_HALF, ROAD_HALF, -0.05, 0, -EXTENT, EXTENT, { sides: false });
  set.box(mats.asphalt, -EXTENT, -ROAD_HALF, -0.05, 0, CROSS_SOUTH, CROSS_NORTH, { sides: false });
  set.box(mats.asphalt, ROAD_HALF, EXTENT, -0.05, 0, CROSS_SOUTH, CROSS_NORTH, { sides: false });

  for (const s of sidewalkStrips()) set.box(mats.pavement, s.minX, s.maxX, 0, CURB_H, s.minZ, s.maxZ);
  // Kerb stones along every roadway edge.
  const k = 0.16;
  for (const sx of [-1, 1]) {
    const x0 = sx === 1 ? ROAD_HALF : -ROAD_HALF - k;
    set.box(mats.curb, x0, x0 + k, 0, CURB_H + 0.012, CROSS_NORTH, EXTENT);
    set.box(mats.curb, x0, x0 + k, 0, CURB_H + 0.012, -EXTENT, CROSS_SOUTH);
    const [a, b] = sx === 1 ? [ROAD_HALF, EXTENT] : [-EXTENT, -ROAD_HALF];
    set.box(mats.curb, a, b, 0, CURB_H + 0.012, CROSS_NORTH, CROSS_NORTH + k);
    set.box(mats.curb, a, b, 0, CURB_H + 0.012, CROSS_SOUTH - k, CROSS_SOUTH);
  }

  const lot = SHOP.lot;
  set.box(mats.plazaPaving, lot.minX, lot.maxX, 0, CURB_H, lot.minZ, lot.maxZ);
  set.box(mats.plazaPaving, PLAZA.minX, PLAZA.maxX, 0, CURB_H, PLAZA.minZ, PLAZA.maxZ);
  for (const bed of PLAZA_BEDS) {
    set.box(mats.curb, bed.minX - 0.12, bed.maxX + 0.12, CURB_H, CURB_H + 0.1, bed.minZ - 0.12, bed.maxZ + 0.12);
    set.box(mats.grass, bed.minX, bed.maxX, CURB_H, CURB_H + 0.115, bed.minZ, bed.maxZ, { sides: false });
  }
}

function buildRoadPaint(set: BatchSet, mats: Materials): void {
  const y = 0.008;
  const flat = { sides: false } as const;
  const white = mats.lineWhite;
  const yellow = mats.lineYellow;
  // Dashed centre lines, interrupted around the junction.
  for (let z = -EXTENT + 2; z < EXTENT - 3; z += 6) {
    if (z > CROSS_SOUTH - 9.5 && z < CROSS_NORTH + 7) continue;
    set.box(yellow, -0.06, 0.06, 0, y, z, z + 3, flat);
  }
  for (let x = -EXTENT + 2; x < EXTENT - 3; x += 6) {
    if (x > -ROAD_HALF - 5 && x < ROAD_HALF + 2) continue;
    set.box(yellow, x, x + 3, 0, y, CROSS_Z - 0.06, CROSS_Z + 0.06, flat);
  }
  // CORE-010: continuous white edge lines along the main street (interrupted at the junction).
  for (const ex of [-(ROAD_HALF - 0.55), ROAD_HALF - 0.55]) {
    for (const [z0, z1] of [[CROSS_NORTH + 0.5, EXTENT - 2], [-EXTENT + 2, CROSS_SOUTH - 0.5]] as const) {
      set.box(white, ex - 0.06, ex + 0.06, 0, y, z0, z1, flat);
    }
  }
  // Zebra crossings and stop lines on the main street, which yields to the cross street.
  for (const z0 of [CROSS_NORTH + 2.6, CROSS_SOUTH - 5.6]) {
    for (let x = -3.6; x <= 3.61; x += 0.8) set.box(white, x - 0.2, x + 0.2, 0, y, z0, z0 + 3, flat);
  }
  set.box(white, 0.15, ROAD_HALF - 0.2, 0, y, CROSS_SOUTH - 6.6, CROSS_SOUTH - 6.25, flat);
  set.box(white, -ROAD_HALF + 0.2, -0.15, 0, y, CROSS_NORTH + 6.25, CROSS_NORTH + 6.6, flat);
  // Motorcycle bays on the shop forecourt.
  const half = PARKING.bayWidth / 2;
  const [x0, x1] = [PARKING.x - PARKING.bayLength / 2, PARKING.x + PARKING.bayLength / 2];
  const edges = [...PARKING.bayZ.map((z) => z + half), PARKING.bayZ[PARKING.bayZ.length - 1]! - half];
  for (const z of edges) set.box(white, x0, x1, CURB_H, CURB_H + y, z - 0.04, z + 0.04, flat);
  set.box(white, x1 - 0.08, x1, CURB_H, CURB_H + y, edges[edges.length - 1]!, edges[0]!, flat);
  // Darker asphalt repairs, as found on any neighbourhood street.
  const patch = mats.asphaltPatch;
  for (const [x, z, w, d] of [[-1.8, 12, 1.6, 2.4], [2.2, 31, 1.2, 3.2], [-2.6, -38, 1.8, 1.4], [1.4, 47, 2.0, 1.2], [18, CROSS_Z + 1.5, 3.0, 1.3], [-24, CROSS_Z - 2, 2.2, 1.6]] as const) {
    set.box(patch, x - w / 2, x + w / 2, 0, 0.004, z - d / 2, z + d / 2, flat);
  }
}

/**
 * Concrete gutters ("sarjeta") along every kerb, storm drains ("boca de lobo") in the kerb face,
 * square grass pits around street trees, a manhole cover and a few oil stains on the lanes.
 */
function buildStreetDetails(flat: BatchSet, upright: BatchSet, mats: Materials): void {
  const g = 0.38;
  const y = 0.004;
  const flatOnly = { sides: false } as const;
  for (const sx of [-1, 1]) {
    const [a, b] = sx === 1 ? [ROAD_HALF - g, ROAD_HALF] : [-ROAD_HALF, -ROAD_HALF + g];
    flat.box(mats.gutter, a, b, 0, y, CROSS_NORTH, EXTENT, flatOnly);
    flat.box(mats.gutter, a, b, 0, y, -EXTENT, CROSS_SOUTH, flatOnly);
    const [c, d] = sx === 1 ? [ROAD_HALF, EXTENT] : [-EXTENT, -ROAD_HALF];
    flat.box(mats.gutter, c, d, 0, y, CROSS_NORTH - g, CROSS_NORTH, flatOnly);
    flat.box(mats.gutter, c, d, 0, y, CROSS_SOUTH, CROSS_SOUTH + g, flatOnly);
  }
  const dark = mats.paint('#1d1e20');
  const grate = mats.paint('#4a4b4c', 0.3);
  for (const [x, z] of [[ROAD_HALF, -8], [-ROAD_HALF, 4], [ROAD_HALF, 16], [-ROAD_HALF, -30], [ROAD_HALF, CROSS_NORTH + 1.4]] as const) {
    const s = Math.sign(x);
    // Opening in the kerb face plus a grate on the gutter in front of it.
    upright.box(dark, x - s * 0.02, x + s * 0.005, 0.02, 0.13, z - 0.6, z + 0.6, { top: false });
    flat.box(grate, x - s * 0.36, x - s * 0.02, 0, 0.012, z - 0.45, z + 0.45, flatOnly);
    for (let k = -0.4; k <= 0.41; k += 0.1) flat.box(dark, x - s * 0.34, x - s * 0.04, 0, 0.014, z + k - 0.015, z + k + 0.015, flatOnly);
  }
  flat.box(mats.paint('#3c3d3f', 0.3), -1.95, -1.25, 0, 0.01, 9.0, 9.7, flatOnly);
  for (const [x, z, rx, rz] of [[1.9, -2, 0.5, 0.9], [-2.1, 12, 0.6, 1.1], [2.2, 24, 0.45, 0.8], [11.2, -41, 0.5, 0.6], [-1.9, -6.5, 0.4, 0.7], [0.4, CROSS_Z, 1.2, 1.0]] as const) {
    contactBlot(flat, mats, x, z, rx, rz, 0.006);
  }
  // Tree pits on the pavement: a grass square inside a low concrete rim.
  for (const tree of TREES.filter((t) => t.solid && Math.abs(Math.abs(t.x) - (ROAD_HALF + 0.75)) < 0.01)) {
    const h = 0.55;
    flat.box(mats.grass, tree.x - h, tree.x + h, CURB_H, CURB_H + 0.03, tree.z - h, tree.z + h, flatOnly);
    for (const [x0, x1, z0, z1] of [[-h, h, -h - 0.06, -h], [-h, h, h, h + 0.06], [-h - 0.06, -h, -h, h], [h, h + 0.06, -h, h]] as const) {
      upright.box(mats.curb, tree.x + x0, tree.x + x1, CURB_H, CURB_H + 0.07, tree.z + z0, tree.z + z1);
    }
  }
}

function buildWallsAndProps(set: BatchSet, mats: Materials): void {
  for (const run of WALL_RUNS) {
    const b = run.box;
    if (run.raw) set.box(mats.blockwork, b.minX, b.maxX, 0, 2.3, b.minZ, b.maxZ);
    else set.box(mats.plaster(run.color), b.minX, b.maxX, 0, 2.3, b.minZ, b.maxZ, { fitV: true });
  }
  // Ice freezer and stacked drink crates outside the shop.
  const [freezer, crates] = [SHOP_PROPS[0]!, SHOP_PROPS[1]!];
  set.box(mats.paint('#eef1f2', 0.3), freezer.minX, freezer.maxX, CURB_H, CURB_H + 0.92, freezer.minZ, freezer.maxZ);
  set.box(mats.paint('#2a66a8', 0.3), freezer.minX - 0.02, freezer.maxX + 0.02, CURB_H + 0.92, CURB_H + 0.98, freezer.minZ - 0.02, freezer.maxZ + 0.02);
  const colors = ['#c23b2e', '#e0a422', '#c23b2e'];
  colors.forEach((color, i) => {
    set.box(mats.paint(color), crates.minX + 0.04, crates.maxX - 0.04, CURB_H + i * 0.32, CURB_H + i * 0.32 + 0.3, crates.minZ + 0.04, crates.maxZ - 0.04);
  });
}

/** Builds the FICTIONAL test street. It does not represent Brejo Alegre. */
export function buildTemporaryWorld(scene: Scene, profile: GraphicsProfile): World {
  const materials = new Materials(scene, profile);
  const flat = new BatchSet();
  const upright = new BatchSet();
  buildGround(flat, materials);
  buildRoadPaint(flat, materials);
  buildStreetDetails(flat, upright, materials);
  buildWallsAndProps(upright, materials);
  buildPoles(scene, upright, materials);
  buildBenches(upright, materials);
  // CORE-011: lamp posts and planter boxes come from external models (see externalAssets.ts).
  const furniture = buildStreetFurniture(scene, upright, materials, { planterBoxes: false, lamps: false, flowers: true });
  buildSigns(scene, upright, materials);

  const occluderBoxes = buildOccluders();
  const shared = { flat, upright };
  const buildings: Building[] = [...HOUSES.map((spec) => buildHouse(scene, materials, spec, shared)), buildShop(scene, materials)];
  const occluders = buildings.map((building, i) => ({ box: occluderBoxes[i]!.box, meshes: building.body }));
  // CORE-013 expansion: roads, blocks, shops, depot, church, school, walls, street furniture. It
  // writes into the shared batches, so it runs before they are built.
  const city = buildCity(scene, materials, shared);
  const flatMeshes = flat.build('chao', scene);
  const uprightMeshes = upright.build('urbano', scene);
  const bodies = [...buildings.flatMap((b) => b.body), ...city.bodies];
  const raised = [...buildRaisedAreas(), ...cityRaised()];
  const extraTrees = cityTrees();
  const trees = buildTrees(scene, materials, profile.backdropDensity, extraTrees, (x, z) => heightAt(x, z, raised));
  const plants = buildShowcasePlants(scene, materials);
  buildBackdrop(scene, materials);

  const animated = new Set<Mesh>(city.shutters.values());
  for (const mesh of [...flatMeshes, ...uprightMeshes, ...bodies]) {
    if (animated.has(mesh)) continue;
    mesh.computeWorldMatrix(true);
    mesh.freezeWorldMatrix();
    mesh.doNotSyncBoundingInfo = true;
  }

  const colliders = [
    ...buildColliders(), ...cityAllColliders(),
  ];
  return {
    materials,
    bounds: WORLD_BOUNDS,
    colliders,
    guard: createMotionGuard(WORLD_BOUNDS, colliders),
    raised,
    occluders,
    shutters: city.shutters,
    shadowCasters: [...uprightMeshes, ...bodies, ...trees, ...(profile.detailShadows ? [...plants, ...furniture] : [])],
  };
}
