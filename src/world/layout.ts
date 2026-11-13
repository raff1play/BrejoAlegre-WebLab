import type { Box2D } from '../core/collision.ts';
import type { Box3D } from '../core/math.ts';
import type { RaisedArea } from '../core/terrain.ts';

/**
 * FICTIONAL placeholder street plan. Pure data and geometry (no renderer imports) so collisions and
 * scene requirements can be unit-tested. It is NOT cartography of Brejo Alegre.
 *
 * Axes: +x east, +z north, units in metres. The main street runs north-south along x = 0 and a
 * cross street runs east-west along z = CROSS_Z.
 */
export const ROAD_HALF = 4;
export const SIDEWALK = 2.2;
export const CURB_H = 0.15;
/** Distance from the main street axis to the front of the lots. */
export const FRONT = ROAD_HALF + SIDEWALK;
export const CROSS_Z = -20;
export const CROSS_NORTH = CROSS_Z + ROAD_HALF;
export const CROSS_SOUTH = CROSS_Z - ROAD_HALF;
/** Lot fronts along the cross street. */
export const CROSS_FRONT_N = CROSS_NORTH + SIDEWALK;
export const CROSS_FRONT_S = CROSS_SOUTH - SIDEWALK;
/** How far the streets are drawn; the playable area ends earlier, at WORLD_BOUNDS. */
export const EXTENT = 63.8;
/**
 * Playable area. CORE-013 expanded it from the W009 core (±46 × ±56) to the whole re-imagined town
 * (see world/city/cityPlan.ts, which re-exports it as CITY_BOUNDS).
 */
export const WORLD_BOUNDS: Box2D = { minX: -158, maxX: 158, minZ: -166, maxZ: 160 };

export const LOT_WIDTH = 12;
export const LOT_DEPTH = 20;
export const WALL_T = 0.2;
export const WALL_H = 2.0;

/**
 * A building frame: local +x runs along the frontage, local +z goes into the lot, the facade is at
 * local z = 0. `side` says where the lot lies from its front line:
 *   1 → east of it (facade looks west), -1 → west (looks east),
 *   2 → north of it (facade looks south, toward -z), -2 → south (looks north).
 * All four are rotations (no mirroring), so the same lot plan works on every street.
 */
export type FrameSide = 1 | -1 | 2 | -2;
/** CORE-015: `yaw` (radians, inward direction = (sin yaw, cos yaw)) overrides `side` for real streets at any angle. */
export type Frame = Readonly<{ ox: number; oz: number; side: FrameSide; yaw?: number }>;

/** Frontage direction (local +x) and inward direction (local +z) in world x/z for each side. */
export function frameAxes(side: FrameSide): { fx: number; fz: number; ix: number; iz: number } {
  switch (side) {
    case 1: return { fx: 0, fz: -1, ix: 1, iz: 0 };
    case -1: return { fx: 0, fz: 1, ix: -1, iz: 0 };
    case 2: return { fx: 1, fz: 0, ix: 0, iz: 1 };
    default: return { fx: -1, fz: 0, ix: 0, iz: -1 };
  }
}

/** Axes of a frame: the four legacy sides, or any angle when `yaw` is set (frontage = inward turned −90°). */
export function axesOf(frame: Frame): { fx: number; fz: number; ix: number; iz: number } {
  if (frame.yaw === undefined) return frameAxes(frame.side);
  const ix = Math.sin(frame.yaw); const iz = Math.cos(frame.yaw);
  return { fx: iz, fz: -ix, ix, iz };
}

/** Lot coordinates to a world point on the ground plane (see frameRect). */
export function framePoint(frame: Frame, lx: number, lz: number): { x: number; z: number } {
  const a = axesOf(frame);
  return { x: frame.ox + a.fx * lx + a.ix * lz, z: frame.oz + a.fz * lx + a.iz * lz };
}

/** Axis box around a lot rectangle (exact for the legacy sides, a bound for rotated frames). */
export function frameRect(frame: Frame, lx0: number, lx1: number, lz0: number, lz1: number): Box2D {
  const c = frameCorners(frame, lx0, lx1, lz0, lz1);
  const xs = c.map((p) => p[0]); const zs = c.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

/** The four world corners of a lot rectangle (convex, in order). */
export function frameCorners(frame: Frame, lx0: number, lx1: number, lz0: number, lz1: number): [number, number][] {
  return ([[lx0, lz0], [lx1, lz0], [lx1, lz1], [lx0, lz1]] as const).map(([a, b]) => { const p = framePoint(frame, a, b); return [p.x, p.z] as [number, number]; });
}

/** Yaw of a frame (inward direction), for any frame. */
export function yawOf(frame: Frame): number {
  const a = axesOf(frame);
  return Math.atan2(a.ix, a.iz);
}

/** Yaw (Babylon rotation.y) that turns local +z (into the lot) to the frame's inward direction. */
export function frameYaw(side: FrameSide): number {
  const a = frameAxes(side);
  return Math.atan2(a.ix, a.iz);
}

export type RoofKind = 'hip-x' | 'hip-z' | 'parapet' | 'shed';
export type FrontKind = 'wall' | 'railing' | 'open';

export type HouseSpec = Readonly<{
  id: string;
  frame: Frame;
  wallColor: string;
  bandColor: string;
  gateColor: string;
  roof: RoofKind;
  front: FrontKind;
  /** -1: garage on the low-x side of the lot, 1: on the high-x side. */
  garageSide: 1 | -1;
  setback: number;
  carport: boolean;
  waterTank: boolean;
}>;

export const HOUSE_WIDTH = 8;
export const HOUSE_DEPTH = 9.5;
export const HOUSE_WALL_H = 3;

/** Local x-range of the house body inside its lot. */
export function houseSpan(spec: HouseSpec): [number, number] {
  return spec.garageSide === -1 ? [LOT_WIDTH - 0.7 - HOUSE_WIDTH, LOT_WIDTH - 0.7] : [0.7, 0.7 + HOUSE_WIDTH];
}

type Style = Omit<HouseSpec, 'id' | 'frame'>;
/** House styles, reused by the CORE-013 expansion (index into HOUSE_STYLES). */
export type HouseStyle = Omit<HouseSpec, 'id' | 'frame'>;
const EAST_STYLES: Style[] = [
  { wallColor: '#e9d8a6', bandColor: '#b98d55', gateColor: '#7d8389', roof: 'hip-x', front: 'wall', garageSide: -1, setback: 4.2, carport: true, waterTank: false },
  { wallColor: '#a9c6d3', bandColor: '#5f8498', gateColor: '#e8e6df', roof: 'parapet', front: 'railing', garageSide: 1, setback: 3.6, carport: false, waterTank: true },
  { wallColor: '#e3a98f', bandColor: '#a8644d', gateColor: '#5a4636', roof: 'hip-z', front: 'open', garageSide: -1, setback: 5, carport: true, waterTank: false },
  { wallColor: '#ece7dc', bandColor: '#8a9a6b', gateColor: '#3f6b4f', roof: 'hip-x', front: 'wall', garageSide: 1, setback: 4, carport: false, waterTank: true },
  { wallColor: '#b9d3b0', bandColor: '#6f9068', gateColor: '#8b8f93', roof: 'shed', front: 'wall', garageSide: -1, setback: 3.4, carport: true, waterTank: true },
];
const WEST_STYLES: Style[] = [
  { wallColor: '#e7c27a', bandColor: '#a9743a', gateColor: '#4a4f55', roof: 'hip-z', front: 'railing', garageSide: 1, setback: 4.4, carport: true, waterTank: false },
  { wallColor: '#d9d2c5', bandColor: '#8d5b4a', gateColor: '#7a3b32', roof: 'hip-x', front: 'wall', garageSide: -1, setback: 3.8, carport: false, waterTank: true },
  { wallColor: '#c9b8d8', bandColor: '#80699a', gateColor: '#e8e6df', roof: 'parapet', front: 'wall', garageSide: 1, setback: 3.5, carport: true, waterTank: true },
  { wallColor: '#f0dcc0', bandColor: '#c18f5c', gateColor: '#3f6b4f', roof: 'hip-x', front: 'open', garageSide: -1, setback: 5, carport: true, waterTank: false },
  { wallColor: '#9fc0c9', bandColor: '#53808c', gateColor: '#7d8389', roof: 'hip-z', front: 'wall', garageSide: 1, setback: 4.1, carport: false, waterTank: true },
];

const FIRST_LOT_Z = CROSS_FRONT_N;
export const HOUSES: readonly HouseSpec[] = [
  ...EAST_STYLES.map((style, i): HouseSpec => ({
    ...style, id: `casa-leste-${i + 1}`,
    frame: { ox: FRONT, oz: FIRST_LOT_Z + (i + 1) * LOT_WIDTH, side: 1 },
  })),
  ...WEST_STYLES.map((style, i): HouseSpec => ({
    ...style, id: `casa-oeste-${i + 1}`,
    frame: { ox: -FRONT, oz: FIRST_LOT_Z + i * LOT_WIDTH, side: -1 },
  })),
];
export const HOUSE_STYLES: readonly HouseStyle[] = [...EAST_STYLES, ...WEST_STYLES];
export const LOTS_END_Z = FIRST_LOT_Z + EAST_STYLES.length * LOT_WIDTH;

/** Generic corner shop, set back from the main street behind a forecourt with motorcycle bays. */
export const SHOP = Object.freeze({
  frame: { ox: 13, oz: -30, side: 1 } as Frame,
  width: 14,
  depth: 14,
  height: 4.4,
  lot: { minX: FRONT, maxX: 30, minZ: -46, maxZ: CROSS_FRONT_S } as Box2D,
});

/** Motorcycle bays on the forecourt, bikes parked nose-out towards the street. */
export const PARKING = Object.freeze({
  x: 11.4,
  bayZ: [-40.2, -41.6, -43.0] as readonly number[],
  bayWidth: 1.4,
  bayLength: 2.6,
  yaw: -Math.PI / 2,
});
export const SPAWN = Object.freeze({ x: PARKING.x, z: PARKING.bayZ[0]!, yaw: PARKING.yaw });
/** A second, static bike parked two bays away, purely decorative but solid. */
export const PARKED_PROP = Object.freeze({ x: PARKING.x, z: PARKING.bayZ[2]!, yaw: PARKING.yaw });

export const PLAZA: Box2D = { minX: -34, maxX: -FRONT, minZ: -50, maxZ: CROSS_FRONT_S };

export type TreeSpec = Readonly<{ x: number; z: number; kind: 'oiti' | 'ipe' | 'ipe-roxo'; scale: number; solid: boolean }>;
export type PoleSpec = Readonly<{ x: number; z: number; lamp: 1 | -1; transformer: boolean; axis: 'z' | 'x' }>;
export type BenchSpec = Readonly<{ x: number; z: number; alongX: boolean }>;
export type WallRun = Readonly<{ box: Box2D; color: string; raw: boolean }>;
export type Occluder = Readonly<{ id: string; box: Box3D }>;

const TREE_X = ROAD_HALF + 0.75;
export const TREES: readonly TreeSpec[] = [
  // Street trees in front of some lots, clear of the gates.
  { x: TREE_X, z: 2.2, kind: 'oiti', scale: 1.0, solid: true },
  { x: TREE_X, z: 26.4, kind: 'ipe', scale: 1.05, solid: true },
  { x: TREE_X, z: 39.6, kind: 'oiti', scale: 0.9, solid: true },
  { x: -TREE_X, z: -6.4, kind: 'ipe-roxo', scale: 1.1, solid: true },
  { x: -TREE_X, z: 17.8, kind: 'oiti', scale: 0.95, solid: true },
  { x: -TREE_X, z: 41.6, kind: 'ipe', scale: 1.0, solid: true },
  // Square.
  { x: -11, z: -31, kind: 'ipe', scale: 1.25, solid: true },
  { x: -22, z: -30.5, kind: 'oiti', scale: 1.2, solid: true },
  { x: -29.5, z: -38, kind: 'ipe', scale: 1.1, solid: true },
  { x: -12, z: -45, kind: 'oiti', scale: 1.3, solid: true },
  { x: -23, z: -46, kind: 'ipe', scale: 1.15, solid: true },
  { x: -18, z: -38.5, kind: 'ipe-roxo', scale: 1.0, solid: true },
  // Backdrop behind walls, unreachable.
  { x: 34, z: -6, kind: 'oiti', scale: 1.5, solid: false },
  { x: 44, z: 6, kind: 'ipe-roxo', scale: 1.4, solid: false },
  { x: 33, z: 30, kind: 'oiti', scale: 1.6, solid: false },
  { x: 40, z: 50, kind: 'oiti', scale: 1.4, solid: false },
  { x: -33, z: 4, kind: 'oiti', scale: 1.6, solid: false },
  { x: -42, z: 24, kind: 'ipe-roxo', scale: 1.3, solid: false },
  { x: -34, z: 48, kind: 'oiti', scale: 1.5, solid: false },
  { x: 14, z: 58, kind: 'oiti', scale: 1.5, solid: false },
  { x: -15, z: 62, kind: 'ipe', scale: 1.4, solid: false },
  { x: 40, z: -36, kind: 'oiti', scale: 1.6, solid: false },
  { x: 36, z: -52, kind: 'ipe', scale: 1.3, solid: false },
  { x: 16, z: -56, kind: 'oiti', scale: 1.5, solid: false },
  { x: -42, z: -34, kind: 'oiti', scale: 1.5, solid: false },
  { x: -40, z: -52, kind: 'oiti', scale: 1.4, solid: false },
  { x: -18, z: -60, kind: 'ipe', scale: 1.4, solid: false },
  { x: -52, z: -8, kind: 'oiti', scale: 1.6, solid: false },
  { x: 54, z: -8, kind: 'oiti', scale: 1.5, solid: false },
];

const POLE_X = ROAD_HALF + 0.45;
export const POLES: readonly PoleSpec[] = [
  { x: POLE_X, z: -52, lamp: -1, transformer: false, axis: 'z' },
  { x: POLE_X, z: -27.6, lamp: -1, transformer: false, axis: 'z' },
  { x: POLE_X, z: -9.6, lamp: -1, transformer: true, axis: 'z' },
  { x: POLE_X, z: 20.4, lamp: -1, transformer: false, axis: 'z' },
  { x: POLE_X, z: 50, lamp: -1, transformer: false, axis: 'z' },
  { x: 32, z: CROSS_NORTH + 0.45, lamp: -1, transformer: false, axis: 'x' },
  { x: -30, z: CROSS_NORTH + 0.45, lamp: -1, transformer: false, axis: 'x' },
];

export const BENCHES: readonly BenchSpec[] = [
  { x: -14.5, z: -35, alongX: true },
  { x: -26, z: -34, alongX: false },
  { x: -17, z: -42.5, alongX: true },
];

/** Blank boundary walls of the unbuilt lots that close the playable area. */
/**
 * Walls inside the core blocks. Since CORE-013 the walls along block frontages are generated from
 * the gaps between buildings (world/city/cityBuild.ts), so only interior dividers stay here.
 */
export const WALL_RUNS: readonly WallRun[] = [
  { box: { minX: 30, maxX: 30 + WALL_T, minZ: -46, maxZ: CROSS_FRONT_S }, color: '#d5cbb9', raw: false },
  { box: { minX: FRONT, maxX: 30 + WALL_T, minZ: -46 - WALL_T, maxZ: -46 }, color: '#c9b79c', raw: true },
  { box: { minX: -34 - WALL_T, maxX: -34, minZ: -50 - WALL_T, maxZ: CROSS_FRONT_S }, color: '#c9b79c', raw: true },
  // Square's south wall, open in front of the church (CORE-013: x -29..-15).
  { box: { minX: -34, maxX: -29, minZ: -50 - WALL_T, maxZ: -50 }, color: '#e4dccb', raw: false },
  { box: { minX: -15, maxX: -FRONT, minZ: -50 - WALL_T, maxZ: -50 }, color: '#e4dccb', raw: false },
];

/** Crates and a freezer by the shop door. Solid. */
export const SHOP_PROPS: readonly Box2D[] = [
  { minX: 12.1, maxX: 12.9, minZ: -37.4, maxZ: -36.1 },
  { minX: 12.2, maxX: 12.9, minZ: -31.4, maxZ: -30.5 },
];

function around(x: number, z: number, half: number): Box2D {
  return { minX: x - half, maxX: x + half, minZ: z - half, maxZ: z + half };
}

/**
 * W009 showcase: the five facades nearest the junction get extra detail (porch, cobogó, shutters,
 * plants, individual pavements). Visual only, except the solid porch pillars and plants below.
 */
export const SHOWCASE_IDS: readonly string[] = ['casa-leste-1', 'casa-leste-2', 'casa-leste-3', 'casa-oeste-1', 'casa-oeste-2'];
export const isShowcase = (spec: HouseSpec): boolean => SHOWCASE_IDS.includes(spec.id);

export const PORCH_DEPTH = 1.8;
/** Local x-range of the front porch (covers the door and the first window). */
export function porchSpan(spec: HouseSpec): [number, number] {
  const [hx0, hx1] = houseSpan(spec);
  return spec.garageSide === -1 ? [hx0 + 0.2, hx0 + 4.5] : [hx1 - 4.5, hx1 - 0.2];
}
/** Porch pillar centres in lot coordinates. */
export function porchPillars(spec: HouseSpec): [number, number][] {
  const [p0, p1] = porchSpan(spec);
  const z = spec.setback - PORCH_DEPTH + 0.17;
  return [[p0 + 0.17, z], [p1 - 0.17, z]];
}

export type PlantKind = 'arbusto' | 'palmeira' | 'vaso' | 'buganvilia';
export type PlantSpec = Readonly<{ x: number; z: number; kind: PlantKind; scale: number; turn: number; base: number }>;

/** Flower bed just inside the street front, clear of the gates, plus a palm and porch pots. */
function yardPlantsLocal(spec: HouseSpec, index: number): { lx: number; lz: number; kind: PlantKind; scale: number }[] {
  const mirror = (lx: number) => (spec.garageSide === -1 ? lx : LOT_WIDTH - lx);
  const list: { lx: number; lz: number; kind: PlantKind; scale: number }[] = [];
  for (const [i, lx] of [5.3, 6.6, 7.9, 9.2, 10.5].entries()) {
    list.push({ lx: mirror(lx), lz: 0.65, kind: 'arbusto', scale: 0.85 + ((i * 37 + index * 11) % 5) * 0.08 });
  }
  if (index % 2 === 0) list.push({ lx: mirror(11.1), lz: 1.6, kind: 'palmeira', scale: 0.9 + index * 0.05 });
  const [p0, p1] = porchSpan(spec);
  const pz = spec.setback - 0.45;
  list.push({ lx: p0 + 0.6, lz: pz, kind: 'vaso', scale: 1 }, { lx: p1 - 0.6, lz: pz, kind: 'vaso', scale: 1.1 });
  // CORE-010: bougainvillea draped over the street wall (or climbing the railing).
  if (spec.front !== 'open') {
    for (const lx of index % 2 === 0 ? [6.2, 10.6] : [7.4]) list.push({ lx: mirror(lx), lz: 0.1, kind: 'buganvilia', scale: 0.9 + (index % 3) * 0.12 });
  }
  return list;
}

export function showcasePlants(): PlantSpec[] {
  return HOUSES.filter(isShowcase).flatMap((spec, index) => yardPlantsLocal(spec, index).map((p, i) => {
    const w = framePoint(spec.frame, p.lx, p.lz);
    return { x: w.x, z: w.z, kind: p.kind, scale: p.scale, turn: p.kind === 'buganvilia' ? frameYaw(spec.frame.side) : (i * 1.7 + index) % (Math.PI * 2), base: plantBase(spec, p.kind) };
  }));
}

const PLANT_RADIUS: Record<PlantKind, number> = { arbusto: 0.38, palmeira: 0.2, vaso: 0.22, buganvilia: 0 };

/** Height the plant stands on, above the lot level (bougainvillea sits on the wall top or railing). */
export function plantBase(spec: HouseSpec | undefined, kind: PlantKind): number {
  if (kind === 'vaso') return 0.07;
  if (kind !== 'buganvilia') return 0.02;
  return spec?.front === 'railing' ? 0.72 : WALL_H;
}

/**
 * CORE-010 street furniture on the showcase pavements, near the kerb so the walking strip along the
 * lot fronts stays clear: concrete flower planters, cast-iron "colonial" lamp posts and litter bins.
 */
export type StreetItemKind = 'floreira' | 'poste-colonial' | 'lixeira';
export type StreetItem = Readonly<{ x: number; z: number; kind: StreetItemKind; alongZ: boolean }>;
const ITEM_HALF: Record<StreetItemKind, [number, number]> = { floreira: [0.25, 0.7], 'poste-colonial': [0.13, 0.13], lixeira: [0.2, 0.2] };

export function showcaseStreetItems(): StreetItem[] {
  const blockers = [...TREES.filter((t) => t.solid), ...POLES].map((o) => ({ x: o.x, z: o.z }));
  const items: StreetItem[] = [];
  HOUSES.filter(isShowcase).forEach((spec, index) => {
    const plan: [number, StreetItemKind][] = [[2.3, 'floreira'], [5.9, 'poste-colonial'], [9.6, 'floreira'], [11.2, index % 2 ? 'lixeira' : 'floreira']];
    for (const [lx, kind] of plan) {
      const p = framePoint(spec.frame, lx, -SIDEWALK + 0.62);
      if (blockers.some((b) => Math.hypot(b.x - p.x, b.z - p.z) < 1.6)) continue;
      items.push({ x: p.x, z: p.z, kind, alongZ: true });
    }
  });
  return items;
}

export function streetItemBox(item: StreetItem): Box2D {
  const [hx, hz] = ITEM_HALF[item.kind];
  return { minX: item.x - hx, maxX: item.x + hx, minZ: item.z - hz, maxZ: item.z + hz };
}

function houseColliders(spec: HouseSpec): Box2D[] {
  const f = spec.frame;
  if (spec.front !== 'open') return [frameRect(f, 0, LOT_WIDTH, 0, LOT_DEPTH)];
  const [x0, x1] = houseSpan(spec);
  const pillars = isShowcase(spec) ? porchPillars(spec).map(([px, pz]) => frameRect(f, px - 0.17, px + 0.17, pz - 0.17, pz + 0.17)) : [];
  return [
    ...pillars,
    frameRect(f, x0, x1, spec.setback, spec.setback + HOUSE_DEPTH),
    frameRect(f, 0, WALL_T, 0, LOT_DEPTH),
    frameRect(f, LOT_WIDTH - WALL_T, LOT_WIDTH, 0, LOT_DEPTH),
    frameRect(f, 0, LOT_WIDTH, LOT_DEPTH - WALL_T, LOT_DEPTH),
  ];
}

export function parkedPropCollider(): Box2D {
  return { minX: PARKED_PROP.x - 1.05, maxX: PARKED_PROP.x + 1.05, minZ: PARKED_PROP.z - 0.4, maxZ: PARKED_PROP.z + 0.4 };
}

export function buildColliders(): Box2D[] {
  const shop = SHOP.frame;
  return [
    ...HOUSES.flatMap(houseColliders),
    frameRect(shop, 0, SHOP.width, 0, SHOP.depth),
    ...WALL_RUNS.map((w) => w.box),
    ...SHOP_PROPS,
    parkedPropCollider(),
    ...TREES.filter((t) => t.solid).map((t) => around(t.x, t.z, 0.24 * t.scale)),
    ...showcasePlants().filter((p) => PLANT_RADIUS[p.kind] > 0).map((p) => around(p.x, p.z, PLANT_RADIUS[p.kind] * p.scale)),
    ...showcaseStreetItems().map(streetItemBox),
    ...POLES.map((p) => around(p.x, p.z, 0.17)),
    ...BENCHES.map((b) => (b.alongX
      ? { minX: b.x - 0.9, maxX: b.x + 0.9, minZ: b.z - 0.28, maxZ: b.z + 0.28 }
      : { minX: b.x - 0.28, maxX: b.x + 0.28, minZ: b.z - 0.9, maxZ: b.z + 0.9 })),
  ];
}

/** Pavement strips beside both streets, interrupted by the junction. */
export function sidewalkStrips(): Box2D[] {
  const strips: Box2D[] = [];
  for (const sx of [-1, 1]) {
    const minX = sx === 1 ? ROAD_HALF : -FRONT;
    const maxX = sx === 1 ? FRONT : -ROAD_HALF;
    strips.push({ minX, maxX, minZ: CROSS_NORTH, maxZ: EXTENT }, { minX, maxX, minZ: -EXTENT, maxZ: CROSS_SOUTH });
    const outerMin = sx === 1 ? FRONT : -EXTENT;
    const outerMax = sx === 1 ? EXTENT : -FRONT;
    strips.push(
      { minX: outerMin, maxX: outerMax, minZ: CROSS_NORTH, maxZ: CROSS_FRONT_N },
      { minX: outerMin, maxX: outerMax, minZ: CROSS_FRONT_S, maxZ: CROSS_SOUTH },
    );
  }
  return strips;
}

/** Grass beds of the square (visual only; trees stand in them). */
export const PLAZA_BEDS: readonly Box2D[] = [
  { minX: -33.5, maxX: -27, minZ: -49.5, maxZ: -27 },
  { minX: -25, maxX: -8, minZ: -33, maxZ: -27.2 },
  { minX: -26, maxX: -8, minZ: -49.5, maxZ: -44 },
  { minX: -20, maxX: -16, minZ: -40.5, maxZ: -36.5 },
];

export function buildRaisedAreas(): RaisedArea[] {
  // Lots sit at pavement level too, so walking into an open front yard has no step.
  const lots = HOUSES.map((house) => frameRect(house.frame, 0, LOT_WIDTH, 0, LOT_DEPTH));
  return [...sidewalkStrips(), SHOP.lot, PLAZA, ...lots].map((box) => ({ box, height: CURB_H }));
}

/** Volumes that may hide the player from the camera; the renderer fades whatever is in the way. */
export function buildOccluders(): Occluder[] {
  const list: Occluder[] = HOUSES.map((spec) => {
    const [x0, x1] = houseSpan(spec);
    const b = frameRect(spec.frame, x0, x1, spec.setback, spec.setback + HOUSE_DEPTH);
    return { id: spec.id, box: { ...b, minY: 0, maxY: HOUSE_WALL_H + 1.6 } };
  });
  const s = frameRect(SHOP.frame, 0, SHOP.width, 0, SHOP.depth);
  list.push({ id: 'loja', box: { ...s, minY: 0, maxY: SHOP.height + 0.8 } });
  return list;
}
