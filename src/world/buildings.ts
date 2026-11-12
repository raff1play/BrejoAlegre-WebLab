import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { Batch, BatchSet, type P3 } from './geometry';
import { ballPart, boxPart, rodPart } from './modelParts';
import type { LabMaterial, Materials } from './materials';
import {
  CURB_H, HOUSE_DEPTH, HOUSE_WALL_H, LOT_DEPTH, LOT_WIDTH, PORCH_DEPTH, SHOP, SIDEWALK, SHOWCASE_IDS, WALL_H, WALL_T,
  houseSpan, isShowcase, porchPillars, porchSpan, type Frame, type HouseSpec,
} from './layout';

/** The meshes of one building body: they cast shadows and fade when they hide the player. */
export type Building = { body: Mesh[] };

/** Batches shared by the whole street, so yards, boundary walls and gates cost no extra draw calls. */
export type SharedBatches = { flat: BatchSet; upright: BatchSet };

/** Lot coordinates (x along the frontage, z into the lot) to world, standing on the pavement level. */
function placement(frame: Frame): (p: P3) => P3 {
  return frame.side === 1
    ? ([x, y, z]) => [frame.ox + z, y + CURB_H, frame.oz - x]
    : ([x, y, z]) => [frame.ox - z, y + CURB_H, frame.oz + x];
}

/**
 * Hip roof over the rectangle [x0,x1]×[z0,z1] starting at height y. `along` is the ridge direction;
 * the ridge is inset so the four slopes have similar pitch.
 */
function hipRoof(
  batch: Batch, tile: number, x0: number, x1: number, z0: number, z1: number, y: number, rise: number, along: 'x' | 'z',
): void {
  // Work in (a, b): a runs along the ridge, b across it. For along='z' the axes are swapped,
  // which mirrors the shape, so the winding is reversed to keep faces pointing outwards.
  const swap = along === 'z';
  const [a0, a1, b0, b1] = swap ? [z0, z1, x0, x1] : [x0, x1, z0, z1];
  const length = a1 - a0;
  const span = b1 - b0;
  const inset = Math.min(span / 2, length / 2 - 0.5);
  const mid = (b0 + b1) / 2;
  const top = y + rise;
  const at = (a: number, yy: number, b: number): P3 => (swap ? [b, yy, a] : [a, yy, b]);
  const face = (points: P3[], uvs: [number, number][]) => {
    if (swap) { points.reverse(); uvs.reverse(); }
    batch.poly(points, uvs);
  };
  const slope = Math.hypot(span / 2, rise) / tile;
  const hipSlope = Math.hypot(inset, rise) / tile;
  const u = length / tile;
  const ui = inset / tile;
  face([at(a0, y, b0), at(a1, y, b0), at(a1 - inset, top, mid), at(a0 + inset, top, mid)], [[0, 0], [u, 0], [u - ui, slope], [ui, slope]]);
  face([at(a1, y, b1), at(a0, y, b1), at(a0 + inset, top, mid), at(a1 - inset, top, mid)], [[0, 0], [u, 0], [u - ui, slope], [ui, slope]]);
  const s = span / tile;
  face([at(a1, y, b0), at(a1, y, b1), at(a1 - inset, top, mid)], [[0, 0], [s, 0], [s / 2, hipSlope]]);
  face([at(a0, y, b1), at(a0, y, b0), at(a0 + inset, top, mid)], [[0, 0], [s, 0], [s / 2, hipSlope]]);
}

/** Quad on a facade looking towards local -z, texture stretched once over it. */
function facadeQuad(set: BatchSet, material: LabMaterial, x0: number, x1: number, y0: number, y1: number, z: number): void {
  set.of(material).quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], 1, 1);
}

/** Quad on a wall looking along local x (dir = -1 looks towards -x). */
function sideQuad(set: BatchSet, material: LabMaterial, x: number, z0: number, z1: number, y0: number, y1: number, dir: 1 | -1): void {
  if (dir === 1) set.of(material).quad([x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0], 1, 1);
  else set.of(material).quad([x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1], 1, 1);
}

function waterTank(scene: Scene, set: BatchSet, mats: Materials, x: number, y: number, z: number): void {
  const blue = mats.paint('#2f6fb4', 0.2);
  const body = CreateCylinder('caixa-dagua', { diameterTop: 1.15, diameterBottom: 0.95, height: 0.8, tessellation: 14 }, scene);
  body.position.set(x, y + 0.4, z);
  set.absorb(blue, body);
  const lid = CreateCylinder('caixa-dagua-tampa', { diameterTop: 0.5, diameterBottom: 1.22, height: 0.16, tessellation: 14 }, scene);
  lid.position.set(x, y + 0.88, z);
  set.absorb(blue, lid);
}

/**
 * Soft darkening on the ground along an edge (wall bases): a strip of `width` from the edge line at
 * local z = `edge`, extending towards `dir` (+1 / -1), over x0..x1. Uses the left half of the atlas.
 */
function contactStripX(set: BatchSet, mats: Materials, x0: number, x1: number, edge: number, dir: 1 | -1, width: number, y = 0.012): void {
  const b = set.of(mats.contact);
  const far = edge + dir * width;
  if (dir === -1) b.poly([[x0, y, far], [x1, y, far], [x1, y, edge], [x0, y, edge]], [[0.05, 0], [0.45, 0], [0.45, 1], [0.05, 1]]);
  else b.poly([[x1, y, far], [x0, y, far], [x0, y, edge], [x1, y, edge]], [[0.05, 0], [0.45, 0], [0.45, 1], [0.05, 1]]);
}

/** Same along an edge at local x = `edge`, over z0..z1. */
function contactStripZ(set: BatchSet, mats: Materials, z0: number, z1: number, edge: number, dir: 1 | -1, width: number, y = 0.012): void {
  const b = set.of(mats.contact);
  const far = edge + dir * width;
  if (dir === 1) b.poly([[far, y, z0], [far, y, z1], [edge, y, z1], [edge, y, z0]], [[0.05, 0], [0.45, 0], [0.45, 1], [0.05, 1]]);
  else b.poly([[far, y, z1], [far, y, z0], [edge, y, z0], [edge, y, z1]], [[0.05, 0], [0.45, 0], [0.45, 1], [0.05, 1]]);
}

/** Round soft blot (oil stain, footprint) of radius r centred at (x, z), right half of the atlas. */
export function contactBlot(set: BatchSet, mats: Materials, x: number, z: number, rx: number, rz: number, y = 0.012): void {
  set.of(mats.contact).poly([[x - rx, y, z - rz], [x + rx, y, z - rz], [x + rx, y, z + rz], [x - rx, y, z + rz]], [[0.52, 0], [0.98, 0], [0.98, 1], [0.52, 1]]);
}

/** Electricity entry ("padrão"): concrete post, grey meter box with window and a mast with the weatherhead. */
function meterEntry(scene: Scene, set: BatchSet, mats: Materials, x: number, z: number): void {
  set.box(mats.paint('#b3aea4'), x - 0.13, x + 0.13, 0, 2.1, z, z + 0.26);
  set.box(mats.paint('#9ea3a6', 0.2), x - 0.2, x + 0.2, 1.05, 1.6, z - 0.2, z);
  set.box(mats.paint('#2a3238', 0.5), x - 0.08, x + 0.08, 1.3, 1.45, z - 0.205, z - 0.19);
  set.absorb(mats.paint('#8d9194', 0.3), rodPart(scene, [x, 1.6, z - 0.1], [x, 3.7, z - 0.1], 0.06, 0.06, 8));
  set.absorb(mats.paint('#3a3d40'), rodPart(scene, [x, 3.7, z - 0.1], [x, 3.82, z - 0.26], 0.07, 0.05, 8));
}

/** Satellite dish ("parabólica") standing on a roof slope at (x, y, z), facing the northern sky. */
function satelliteDish(scene: Scene, set: BatchSet, mats: Materials, x: number, y: number, z: number): void {
  const grey = mats.paint('#c9cbcb', 0.2);
  set.absorb(grey, rodPart(scene, [x, y - 0.2, z], [x, y + 0.5, z], 0.05, 0.05, 6));
  const dish = ballPart(scene, [0.85, 0.85, 0.2], [x, y + 0.75, z - 0.05], 8);
  dish.rotation.x = -0.6;
  set.absorb(grey, dish);
  set.absorb(mats.paint('#55595c'), rodPart(scene, [x, y + 0.75, z - 0.12], [x, y + 0.98, z - 0.45], 0.025, 0.025, 4));
  set.absorb(mats.paint('#2b2d2f'), boxPart(scene, [0.07, 0.07, 0.1], [x, y + 0.99, z - 0.47]));
}

export function buildHouse(scene: Scene, mats: Materials, spec: HouseSpec, shared: SharedBatches): Building {
  const place = placement(spec.frame);
  const solid = new BatchSet();
  solid.setTransform(place);
  const { flat, upright } = shared;
  flat.setTransform(place);
  upright.setTransform(place);
  const W = LOT_WIDTH;
  const D = LOT_DEPTH;
  const wall = mats.plaster(spec.wallColor);
  const band = mats.plaster(spec.bandColor);
  const trim = mats.paint('#ece8de');
  const [hx0, hx1] = houseSpan(spec);
  const sb = spec.setback;
  const back = sb + HOUSE_DEPTH;
  const garage: [number, number] = spec.garageSide === -1 ? [0.4, 3.2] : [W - 3.2, W - 0.4];
  const gateDoor: [number, number] = spec.garageSide === -1 ? [3.55, 4.45] : [W - 4.45, W - 3.55];

  // Yard: grass with a concrete driveway and front path.
  flat.box(mats.grass, 0, W, -0.02, 0, 0, D, { sides: false });
  flat.of(mats.plazaPaving).box(garage[0] - 0.2, garage[1] + 0.2, 0, 0.012, 0, back, mats.plazaPaving.tileU, mats.plazaPaving.tileV, { sides: false });
  flat.of(mats.plazaPaving).box(hx0, hx1, 0, 0.012, 0, sb, mats.plazaPaving.tileU, mats.plazaPaving.tileV, { sides: false });

  // Side and back boundary walls, left unplastered as is common.
  upright.box(mats.blockwork, 0, WALL_T, 0, WALL_H, 0, D);
  upright.box(mats.blockwork, W - WALL_T, W, 0, WALL_H, 0, D);
  upright.box(mats.blockwork, 0, W, 0, WALL_H, D - WALL_T, D);

  // Street front: full wall, low wall with railing, or open yard.
  const gateMat = mats.ribbed(spec.gateColor);
  const openings = [garage, gateDoor].sort((a, b) => a[0] - b[0]);
  if (spec.front !== 'open') {
    const lowWall = spec.front === 'railing';
    const wallTop = lowWall ? 0.7 : WALL_H;
    let cursor = 0;
    for (const [g0, g1] of [...openings, [W, W] as [number, number]]) {
      if (g0 - cursor > 0.01) {
        upright.box(wall, cursor, g0, 0, wallTop, 0, WALL_T, { fitV: true });
        upright.box(trim, cursor - 0.02, g0 + 0.02, wallTop, wallTop + 0.06, -0.03, WALL_T + 0.03);
        if (lowWall) upright.of(mats.railing).quad([cursor, wallTop, 0.1], [g0, wallTop, 0.1], [g0, WALL_H - 0.1, 0.1], [cursor, WALL_H - 0.1, 0.1], g0 - cursor, 1);
      }
      cursor = g1;
    }
    for (const [g0, g1] of openings) {
      for (const px of [g0, g1]) upright.box(wall, px - 0.14, px + 0.14, 0, WALL_H + 0.18, -0.04, WALL_T + 0.04, { fitV: true });
      if (lowWall) upright.of(mats.railing).quad([g0, 0.08, 0.1], [g1, 0.08, 0.1], [g1, WALL_H - 0.1, 0.1], [g0, WALL_H - 0.1, 0.1], g1 - g0, 1);
      else upright.box(gateMat, g0 + 0.14, g1 - 0.14, 0.06, WALL_H - 0.08, 0.07, 0.13);
    }
  }

  // House body with the darker painted band ("barrado") near the ground.
  const parapet = spec.roof === 'parapet';
  const bodyTop = parapet ? HOUSE_WALL_H + 0.7 : HOUSE_WALL_H;
  solid.box(wall, hx0, hx1, 0, bodyTop, sb, back, { fitV: true, top: false });
  solid.box(band, hx0 - 0.025, hx1 + 0.025, 0, 0.95, sb - 0.025, back + 0.025, { fitV: true });

  // Door and windows on the street facade, plus one window towards the garage.
  const z = sb - 0.035;
  const doorX = spec.garageSide === -1 ? hx0 + 0.7 : hx1 - 1.6;
  facadeQuad(solid, mats.door, doorX, doorX + 0.9, 0, 2.1, z);
  solid.box(trim, doorX - 0.08, doorX + 0.98, 2.1, 2.18, sb - 0.06, sb);
  const windowsX = spec.garageSide === -1 ? [hx0 + 2.5, hx0 + 5.3] : [hx0 + 1.0, hx0 + 3.8];
  for (const wx of windowsX) {
    facadeQuad(solid, mats.window, wx, wx + 1.6, 1.0, 2.2, z);
    // Granite-like sill, lintel ("verga") and jambs framing the opening.
    solid.box(trim, wx - 0.1, wx + 1.7, 0.93, 1.0, sb - 0.12, sb);
    solid.box(trim, wx - 0.08, wx + 1.68, 2.2, 2.29, sb - 0.06, sb);
    for (const jx of [wx - 0.08, wx + 1.6]) solid.box(trim, jx, jx + 0.08, 1.0, 2.2, sb - 0.06, sb);
  }
  const sideX = spec.garageSide === -1 ? hx0 - 0.035 : hx1 + 0.035;
  sideQuad(solid, mats.window, sideX, sb + 2.2, sb + 3.6, 1.1, 2.2, spec.garageSide);
  sideQuad(solid, mats.door, sideX, sb + 5.4, sb + 6.25, 0, 2.1, spec.garageSide);

  // Roof.
  const eave = 0.55;
  const roofY = HOUSE_WALL_H + 0.12;
  if (spec.roof === 'hip-x' || spec.roof === 'hip-z') {
    solid.box(trim, hx0 - eave, hx1 + eave, HOUSE_WALL_H, roofY, sb - eave, back + eave, { bottom: true });
    hipRoof(solid.of(mats.roofTiles), mats.roofTiles.tileU, hx0 - eave, hx1 + eave, sb - eave, back + eave, roofY, 1.55, spec.roof === 'hip-x' ? 'x' : 'z');
    // Ridge and hip caps ("cumeeira" and "espigões") in darker clay, plus a fascia board.
    const [rx0, rx1, rz0, rz1] = [hx0 - eave, hx1 + eave, sb - eave, back + eave];
    const alongX = spec.roof === 'hip-x';
    const half = alongX ? (rz1 - rz0) / 2 : (rx1 - rx0) / 2;
    const inset = Math.min(half, (alongX ? rx1 - rx0 : rz1 - rz0) / 2 - 0.5);
    const top = roofY + 1.55 + 0.03;
    const ends: [P3, P3] = alongX
      ? [[rx0 + inset, top, (rz0 + rz1) / 2], [rx1 - inset, top, (rz0 + rz1) / 2]]
      : [[(rx0 + rx1) / 2, top, rz0 + inset], [(rx0 + rx1) / 2, top, rz1 - inset]];
    const cap = mats.paint('#8c4527');
    solid.absorb(cap, rodPart(scene, ends[0], ends[1], 0.15, 0.15, 6));
    const corners: P3[] = [[rx0, roofY + 0.04, rz0], [rx1, roofY + 0.04, rz0], [rx0, roofY + 0.04, rz1], [rx1, roofY + 0.04, rz1]];
    for (const c of corners) {
      const nearest = alongX ? (c[0] < (rx0 + rx1) / 2 ? ends[0] : ends[1]) : (c[2] < (rz0 + rz1) / 2 ? ends[0] : ends[1]);
      solid.absorb(cap, rodPart(scene, c, nearest, 0.13, 0.13, 6));
    }
    solid.box(mats.paint('#f2efe7'), rx0 - 0.03, rx1 + 0.03, roofY - 0.16, roofY + 0.02, rz0 - 0.03, rz0, { bottom: true });
  } else if (parapet) {
    solid.box(trim, hx0 - 0.06, hx1 + 0.06, bodyTop, bodyTop + 0.08, sb - 0.06, back + 0.06);
    solid.box(mats.paint('#8f8b84'), hx0 + 0.2, hx1 - 0.2, bodyTop - 0.35, bodyTop - 0.3, sb + 0.2, back - 0.2, { sides: false });
    solid.box(trim, doorX - 0.6, doorX + 1.5, 2.4, 2.52, sb - 1.0, sb, { bottom: true });
  } else {
    // "Meia-água": a single slope of fibre-cement sheets falling to the back.
    const sheet = mats.ribbed('#a9a8a1');
    const [x0, x1, zf, zb, yf, yb] = [hx0 - 0.35, hx1 + 0.35, sb - 0.5, back + 0.45, HOUSE_WALL_H + 1.05, HOUSE_WALL_H - 0.02];
    const [u, v] = [(x1 - x0) / sheet.tileU, (zb - zf) / sheet.tileV];
    solid.of(sheet).quad([x0, yf, zf], [x1, yf, zf], [x1, yb, zb], [x0, yb, zb], u, v);
    solid.of(sheet).quad([x0, yb - 0.03, zb], [x1, yb - 0.03, zb], [x1, yf - 0.03, zf], [x0, yf - 0.03, zf], u, v);
    const ridge = HOUSE_WALL_H + 1.0;
    solid.box(wall, hx0, hx1, HOUSE_WALL_H, ridge, sb, sb + 0.2, { fitV: true });
    const gable = solid.of(wall);
    gable.poly([[hx0, HOUSE_WALL_H, back], [hx0, HOUSE_WALL_H, sb], [hx0, ridge, sb]], [[0, 0], [3, 0], [3, 0.4]]);
    gable.poly([[hx1, HOUSE_WALL_H, sb], [hx1, HOUSE_WALL_H, back], [hx1, ridge, sb]], [[0, 0], [3, 0], [0, 0.4]]);
  }

  if (spec.carport) {
    const sheet = mats.ribbed('#b9b7ae');
    const [c0, c1] = spec.garageSide === -1 ? [WALL_T, hx0] : [hx1, W - WALL_T];
    solid.box(sheet, c0, c1, 2.62, 2.7, sb + 0.3, sb + 5.8, { bottom: true });
    solid.box(trim, c0, c1, 2.5, 2.62, sb + 0.3, sb + 0.42, { bottom: true });
  }

  if (spec.waterTank) {
    if (parapet) waterTank(scene, solid, mats, hx0 + 1.6, bodyTop - 0.3, back - 1.8);
    else {
      // Masonry tower in the back yard, taller than the eaves for water pressure.
      const tx = spec.garageSide === -1 ? hx1 - 1.2 : hx0 + 1.2;
      solid.box(mats.blockwork, tx - 0.7, tx + 0.7, 0, 4.4, back + 1.6, back + 3.0);
      solid.box(trim, tx - 0.8, tx + 0.8, 4.4, 4.5, back + 1.5, back + 3.1, { bottom: true });
      waterTank(scene, solid, mats, tx, 4.5, back + 2.3);
    }
  }

  // Contact shadows where walls meet the ground: house body and the street side of the front wall.
  contactStripX(flat, mats, hx0, hx1, sb, -1, 0.7);
  contactStripZ(flat, mats, sb, back, hx0, -1, 0.6);
  contactStripZ(flat, mats, sb, back, hx1, 1, 0.6);
  if (spec.front !== 'open') contactStripX(flat, mats, 0, W, 0, -1, 0.75);
  // Electricity entry on the street front, on the side away from the garage.
  meterEntry(scene, upright, mats, spec.garageSide === -1 ? W - 0.9 : 0.9, spec.front === 'open' ? 0.2 : 0);

  if (isShowcase(spec)) showcaseFront(scene, mats, spec, { solid, flat, upright }, SHOWCASE_IDS.indexOf(spec.id));

  flat.setTransform(null);
  upright.setTransform(null);
  return { body: solid.build(spec.id, scene) };
}

/**
 * W009 showcase details for five facades: porch with stone-clad pillars and red cement floor,
 * cobogó screen, wooden shutters, stone gate posts, wall lamp, roof dish, flower bed and an
 * individual pavement in front of the lot, as each owner paves their own stretch.
 */
function showcaseFront(scene: Scene, mats: Materials, spec: HouseSpec, sets: { solid: BatchSet; flat: BatchSet; upright: BatchSet }, index: number): void {
  const { solid, flat, upright } = sets;
  const W = LOT_WIDTH;
  const sb = spec.setback;
  const [hx0, hx1] = houseSpan(spec);
  const [p0, p1] = porchSpan(spec);
  const pz0 = sb - PORCH_DEPTH;
  const slab = 2.62;
  const trim = mats.paint('#f2efe7');

  // Porch ("varanda"): polished red cement floor with a step, concrete slab roof with fascia.
  flat.box(mats.paint('#9a3b2c', 0.35), p0, p1, 0, 0.07, pz0, sb);
  flat.box(mats.paint('#7e3024', 0.35), p0, p1, 0, 0.035, pz0 - 0.3, pz0);
  solid.box(trim, p0 - 0.1, p1 + 0.1, slab, slab + 0.16, pz0 - 0.12, sb, { bottom: true });
  solid.box(mats.paint('#d9d4ca'), p0 - 0.1, p1 + 0.1, slab - 0.02, slab, pz0 - 0.12, sb, { top: false });
  for (const [px, pz] of porchPillars(spec)) {
    upright.box(mats.stone, px - 0.17, px + 0.17, 0, slab, pz - 0.17, pz + 0.17);
    contactBlot(flat, mats, px, pz, 0.45, 0.45, 0.075);
  }
  contactStripX(flat, mats, p0, p1, pz0, -1, 0.45, 0.04);
  // Cobogó screen at the porch end away from the door, on two of the houses.
  if (index === 1 || index === 3) {
    const sx = spec.garageSide === -1 ? p1 - 0.17 : p0 + 0.17;
    const cz0 = pz0 + 0.34;
    const u = (sb - cz0) / mats.cobogo.tileU;
    const v = (slab - 0.08) / mats.cobogo.tileV;
    upright.of(mats.cobogo).quad([sx, 0.07, cz0], [sx, 0.07, sb], [sx, slab, sb], [sx, slab, cz0], u, v);
  }
  // Wooden shutters ("venezianas") opened against the facade on three houses.
  if (index % 2 === 0) {
    const shutter = mats.ribbed(['#3f6b4f', '#7a4b2a', '#2f5d86'][index / 2] ?? '#7a4b2a');
    const windowsX = spec.garageSide === -1 ? [hx0 + 2.5, hx0 + 5.3] : [hx0 + 1.0, hx0 + 3.8];
    for (const wx of windowsX) {
      for (const [s0, s1] of [[wx - 0.62, wx - 0.08], [wx + 1.68, wx + 2.22]] as const) {
        solid.box(shutter, s0, s1, 1.0, 2.2, sb - 0.07, sb - 0.025);
      }
    }
  }
  // Wall lamp beside the door.
  const lampX = spec.garageSide === -1 ? hx0 + 1.85 : hx1 - 1.85;
  upright.box(mats.paint('#2a2c2e', 0.3), lampX - 0.06, lampX + 0.06, 2.05, 2.25, sb - 0.12, sb);
  upright.box(mats.glow('#ffe7b0'), lampX - 0.05, lampX + 0.05, 1.98, 2.08, sb - 0.11, sb - 0.01);
  // Stone-clad gate posts on walled fronts.
  if (spec.front !== 'open') {
    const garage: [number, number] = spec.garageSide === -1 ? [0.4, 3.2] : [W - 3.2, W - 0.4];
    const gateDoor: [number, number] = spec.garageSide === -1 ? [3.55, 4.45] : [W - 4.45, W - 3.55];
    for (const g of [garage, gateDoor]) {
      for (const px of g) upright.box(mats.stone, px - 0.16, px + 0.16, 0, WALL_H + 0.2, -0.06, WALL_T + 0.06);
    }
  }
  // Flower bed inside the front with a low kerb; the plants themselves are instanced in props.ts.
  const [b0, b1] = spec.garageSide === -1 ? [4.8, W - 0.3] : [0.3, W - 4.8];
  flat.box(mats.dirt, b0, b1, 0, 0.03, 0.28, 1.05);
  upright.box(trim, b0, b1, 0, 0.14, 1.05, 1.12);
  // Satellite dish on the back slope of two roofs.
  if (index === 0 || index === 4) {
    if (spec.roof === 'hip-x' || spec.roof === 'hip-z') satelliteDish(scene, solid, mats, (hx0 + hx1) / 2 + 1.4, HOUSE_WALL_H + 0.9, sb + HOUSE_DEPTH - 1.6);
  }
  // Individual pavement in front of the lot (local z < 0 is the pavement), kept off the kerb stone.
  const z0 = -SIDEWALK + 0.2;
  if (index === 3) {
    // Grass service strip next to the kerb, common on residential streets.
    flat.box(mats.grass, 0, W, 0, 0.012, z0, z0 + 0.9, { sides: false });
    atlasPaving(flat, mats, 3, 0, W, z0 + 0.9, 0);
  } else {
    atlasPaving(flat, mats, index % 3, 0, W, z0, 0);
  }
}

/**
 * Covers the rectangle with quads of one atlas quadrant, each quad at most one pattern repeat,
 * so the pattern tiles at its real size without needing a texture per pattern.
 */
function atlasPaving(set: BatchSet, mats: Materials, quadrant: number, x0: number, x1: number, z0: number, z1: number): void {
  const tile = mats.sidewalkTiles[quadrant]!;
  const qu = (quadrant % 2) * 0.5;
  // Atlas row 0 is painted at the top of the canvas, which is v = 1 after upload.
  const qv = quadrant < 2 ? 0.5 : 0;
  const pad = 0.004;
  const batch = set.of(mats.sidewalkAtlas);
  const y = 0.006;
  for (let x = x0; x < x1 - 1e-6; x += tile) {
    for (let z = z0; z < z1 - 1e-6; z += tile) {
      const xe = Math.min(x1, x + tile);
      const ze = Math.min(z1, z + tile);
      const u0 = qu + pad;
      const u1 = qu + pad + ((xe - x) / tile) * (0.5 - 2 * pad);
      const v0 = qv + pad;
      const v1 = qv + pad + ((ze - z) / tile) * (0.5 - 2 * pad);
      batch.poly([[x, y, z], [xe, y, z], [xe, y, ze], [x, y, ze]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
    }
  }
}

/** Generic neighbourhood grocery. The name on the sign is invented and refers to no real business. */
export function buildShop(scene: Scene, mats: Materials): Building {
  const solid = new BatchSet();
  solid.setTransform(placement(SHOP.frame));
  const W = SHOP.width;
  const H = SHOP.height;
  const wall = mats.plaster('#eadfc4');
  const band = mats.plaster('#2f6688');
  const trim = mats.paint('#cfc5ab');
  solid.box(wall, 0, W, 0, H, 0, SHOP.depth, { fitV: true });
  solid.box(band, -0.025, W + 0.025, 0, 1.05, -0.025, SHOP.depth + 0.025, { fitV: true });
  solid.box(trim, -0.08, W + 0.08, H, H + 0.12, -0.08, SHOP.depth + 0.08);

  // One roll-up door open (dark interior), one closed.
  const dark = mats.paint('#14171a');
  const steel = mats.ribbed('#9ea4a9');
  facadeQuad(solid, dark, 1.5, 4.5, 0, 3.0, -0.03);
  solid.box(mats.paint('#c8a25a'), 2.0, 4.0, 0, 0.95, -0.028, -0.02);
  solid.of(steel).quad([5.5, 0, -0.035], [8.5, 0, -0.035], [8.5, 3, -0.035], [5.5, 3, -0.035], 3 / steel.tileU, 3 / steel.tileV);
  for (const [x0, x1] of [[1.5, 4.5], [5.5, 8.5]] as const) solid.box(mats.paint('#6d7379', 0.2), x0 - 0.1, x1 + 0.1, 3.0, 3.28, -0.2, 0, { bottom: true });

  const sign = mats.sign('placa-loja', '#f4c531', '#a3211c', [
    { text: 'MERCEARIA DO BAIRRO', size: 0.5, color: '#8e1814' },
    { text: 'PADARIA · BEBIDAS · HORTIFRUTI', size: 0.2, color: '#3a2a12', weight: '700' },
  ], 13 / 0.95, 128);
  facadeQuad(solid, sign, 0.5, 13.5, 3.38, 4.33, -0.045);
  const bays = mats.sign('placa-motos', '#1f5fa8', '#f2f2f2', [
    { text: 'ESTACIONAMENTO', size: 0.26, color: '#ffffff' },
    { text: 'MOTOS', size: 0.42, color: '#ffffff' },
  ], 2.2, 128);
  facadeQuad(solid, bays, 9.7, 12.8, 1.45, 2.85, -0.04);

  // Striped canvas awning over the doors.
  const canvas = mats.stripes('toldo', '#2f7d4f', '#f1efe6', 8, false, 3.2);
  const [a0, a1, yWall, yEdge, zEdge] = [1.0, 9.0, 3.3, 2.75, -1.7];
  const u = (a1 - a0) / canvas.tileU;
  solid.of(canvas).quad([a0, yEdge, zEdge], [a1, yEdge, zEdge], [a1, yWall, 0], [a0, yWall, 0], u, 1);
  solid.of(canvas).quad([a0, yWall - 0.03, 0], [a1, yWall - 0.03, 0], [a1, yEdge - 0.03, zEdge], [a0, yEdge - 0.03, zEdge], u, 1);
  solid.of(canvas).quad([a0, yEdge - 0.28, zEdge], [a1, yEdge - 0.28, zEdge], [a1, yEdge, zEdge], [a0, yEdge, zEdge], u, 0.3);

  return { body: solid.build('loja', scene) };
}
