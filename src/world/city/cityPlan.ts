import { createMotionGuard, makePoly, type Box2D, type Poly2D } from '../../core/collision.ts';
import { CURB_H, SIDEWALK, frameCorners, framePoint, yawOf, type Frame } from '../layout.ts';
import { NETWORK, PLAY_BOUNDS, degreeOf, nearestOnPolyline, type NetRoad } from '../geo/network.ts';
import {
  DEPOT_SITE, GEO_BLOCKS, GEO_LOTS, OPEN_SPACES, SHOP_LOTS, TOWN_CENTRE, geoRaised, geoSolids, roadDistance, pointInPolygon, type GeoBlock, type GeoLot,
} from '../geo/geoCity.ts';
import { GEO } from '../geo/brejoAlegreData.ts';
import type { XZ } from '../geo/geoTypes.ts';

/**
 * CORE-015 city plan on the REAL street network of Brejo Alegre/SP (OpenStreetMap, ODbL; see
 * src/world/geo and docs/CITY_REFERENCE.md). Same exports as the CORE-013/014 plan so traffic,
 * pedestrians, deliveries and the minimap keep working, but every street is a real OSM way.
 * Shops, depot and house lots are GAME placements on real blocks (OSM has no lots/addresses here).
 */
export type NodeControl = 'signal' | 'stop' | 'free';
export type CityNode = Readonly<{ id: string; x: number; z: number; control: NodeControl; exit?: boolean }>;
export type RoadKind = 'urban' | 'rural' | 'yard';
export type CityRoad = Readonly<{
  id: string; name: string; a: string; b: string; kind: RoadKind;
  /** Higher wins at unsignalised junctions (secondary 3 > unclassified 1 > residential 0). */
  priority: number;
  /** Heavy vehicles (truck, bus) may use it. */
  heavy: boolean;
  /** Real polyline from node a to node b (metres). */
  pts: readonly XZ[];
  length: number;
  osmWay: number;
  highway: string;
  /** One-way in OSM (dual carriageways): a single lane in the way's direction a → b. */
  oneway: boolean;
}>;

export const CITY_BOUNDS: Box2D = PLAY_BOUNDS;
export const LANE_OFFSET = 1.9;

const roadName = (r: NetRoad) => r.name ?? (r.highway.startsWith('secondary') ? 'Estrada (sem nome no OSM)' : 'Via sem nome no OSM');

export const ROADS: readonly CityRoad[] = NETWORK.roads.map((r) => ({
  id: r.id, name: roadName(r), a: r.a, b: r.b, kind: r.kind, priority: r.priority, heavy: r.heavy, pts: r.pts, length: r.length, osmWay: r.osmWay, highway: r.highway, oneway: r.oneway,
}));

/**
 * Experimental street-furniture preview: traffic lights are FICTIONAL game infrastructure.
 * OSM provides the streets, not the physical signals. Select a few roomy urban intersections,
 * far apart, so the existing signal/AI/pedestrian state machines can actually control them.
 */
// A node with an excellent traffic score is still unsuitable for semaphores if
// one of its arms has NO safe paved corner. Select only sites with room for each
// approach; the later renderer performs finer collision and fixture checks.
const signalGeoFree = createMotionGuard(CITY_BOUNDS, [], geoSolids());
function armHasSignalPavement(n: (typeof NETWORK.nodes)[number], r: CityRoad): boolean {
  const pts = r.a === n.id ? r.pts : [...r.pts].reverse();
  for (const target of [8, 11, 14, 17, 20]) {
    if (target >= r.length - 2) continue;
    let travelled = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!, p = pts[i]!;
      const dx = p[0] - a[0], dz = p[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 0.001) continue;
      if (travelled + length < target) { travelled += length; continue; }
      const tx = dx / length, tz = dz / length, at = (target - travelled) / length;
      const x = a[0] + dx * at, z = a[1] + dz * at;
      for (const side of [-1, 1]) for (const off of [4.5, 5.0, 5.5]) {
        const qx = x + tz * off * side, qz = z - tx * off * side;
        const roadD = roadDistance(qx, qz);
        if (roadD < 4.35 || roadD > 5.85 || !signalGeoFree(qx, qz, 0.33)) continue;
        if (GEO_BLOCKS.some((block) => pointInPolygon(block.kerb, qx, qz))) return true;
      }
      break;
    }
  }
  return false;
}
const SIGNAL_CANDIDATES = NETWORK.nodes.filter((n) => !n.exit).map((n) => {
  const arms = ROADS.filter((r) => r.a === n.id || r.b === n.id);
  if (arms.length < 3 || arms.some((r) => r.kind !== 'urban' || r.length < 32)) return null;
  if (arms.some((r) => !armHasSignalPavement(n, r))) return null;
  return { n, score: arms.reduce((v, r) => v + r.priority * 3 + (r.heavy ? 6 : 0), 0) + arms.length };
}).filter((v): v is { n: (typeof NETWORK.nodes)[number]; score: number } => v !== null)
  .sort((a, b) => b.score - a.score || a.n.id.localeCompare(b.n.id));

export const GAME_SIGNAL_IDS: ReadonlySet<string> = (() => {
  const picked: typeof SIGNAL_CANDIDATES = [];
  for (const c of SIGNAL_CANDIDATES) {
    if (picked.every((p) => Math.hypot(c.n.x - p.n.x, c.n.z - p.n.z) >= 95)) picked.push(c);
    if (picked.length === 5) break;
  }
  return new Set(picked.map((v) => v.n.id));
})();

export const NODES: readonly CityNode[] = NETWORK.nodes.map((n) => {
  const arms = ROADS.filter((r) => r.a === n.id || r.b === n.id);
  const prio = arms.map((r) => r.priority);
  const control: NodeControl = GAME_SIGNAL_IDS.has(n.id) ? 'signal'
    : arms.length >= 3 && Math.max(...prio) > Math.min(...prio) ? 'stop' : 'free';
  return { id: n.id, x: n.x, z: n.z, control, exit: n.exit };
});
const nodeIndex = new Map(NODES.map((n) => [n.id, n]));
export const nodeById = (id: string): CityNode => {
  const n = nodeIndex.get(id);
  if (!n) throw new Error(`nó ${id} inexistente`);
  return n;
};
export const nodeDegree = (id: string) => degreeOf(NETWORK, id);

/** Real blocks (faces of the OSM street graph). */
export type Sector = 'centro' | 'residencial' | 'comercial' | 'logistico' | 'periferia';
export type Block = GeoBlock & { sector: Sector };
export const BLOCKS: readonly Block[] = GEO_BLOCKS.map((b) => ({
  ...b, sector: b.id === DEPOT_SITE.block ? 'logistico' : Math.hypot(b.centre[0] - TOWN_CENTRE[0], b.centre[1] - TOWN_CENTRE[1]) < 160 ? 'centro' : 'residencial',
}));

// ------------------------------------------------------------------ depot (fictional, on a real block)

/**
 * Depot data keep the CORE-014 layout in its original "legacy" coordinates (yard on the street,
 * shed behind) and are placed on the real block by `depotWorld` (a rigid rotation + translation).
 */
export const DEPOT = Object.freeze({
  lot: { minX: 76.2, maxX: 139.8, minZ: -150, maxZ: -92.2 } as Box2D,
  building: { minX: 92, maxX: 136, minZ: -142, maxZ: -118 } as Box2D,
  yard: { minX: 76.2, maxX: 139.8, minZ: -118, maxZ: -92.2 } as Box2D,
  gate: { x0: 100, x1: 112 },
  docks: [96, 104, 112, 120, 128] as readonly number[],
  motoBays: { x0: 79, x1: 89, z: -112 },
  height: 9,
  name: 'Galpão Logístico (fictício)',
});
export const DEPOT_FRAME: Frame = DEPOT_SITE.frame;
/** Legacy depot coordinates → world (the old frontage z = −92.2 lies on the real street). */
export function depotWorld(x: number, z: number): { x: number; z: number } {
  return framePoint(DEPOT_FRAME, 139.8 - x, -92.2 - z);
}
/** Legacy yaw (old frame faced north) → world yaw on the real block. */
export const depotYaw = (yaw: number) => yaw + yawOf(DEPOT_FRAME) - Math.PI;
export const depotPoly = (b: Box2D): Poly2D => makePoly([[b.minX, b.minZ], [b.maxX, b.minZ], [b.maxX, b.maxZ], [b.minX, b.maxZ]].map(([x, z]) => { const p = depotWorld(x!, z!); return [p.x, p.z] as [number, number]; }));

/** GFX-001B: two regional dispatch cages at the end of the sorting belt (solid). */
export const DEPOT_REGION_CAGES: readonly Box2D[] = [
  { minX: 118.4, maxX: 119.8, minZ: -130.7, maxZ: -129.3 }, { minX: 120.6, maxX: 122, minZ: -130.7, maxZ: -129.3 },
];
export function depotLayout(): { walls: Box2D[]; furniture: Box2D[]; floor: Box2D } {
  const b = DEPOT.building; const t = 0.3;
  const walls: Box2D[] = [
    { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.minZ + t },
    { minX: b.maxX - t, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ },
    { minX: b.minX, maxX: b.minX + t, minZ: b.minZ, maxZ: -123.4 }, { minX: b.minX, maxX: b.minX + t, minZ: -121, maxZ: b.maxZ },
  ];
  let x = b.minX;
  for (const d of DEPOT.docks) { walls.push({ minX: x, maxX: d - 1.6, minZ: b.maxZ - t, maxZ: b.maxZ }); x = d + 1.6; }
  walls.push({ minX: x, maxX: b.maxX, minZ: b.maxZ - t, maxZ: b.maxZ });
  const furniture: Box2D[] = [
    { minX: 93.2, maxX: 94.4, minZ: -124.4, maxZ: -120.6 }, { minX: 93.2, maxX: 94.4, minZ: -133, maxZ: -129 },
    { minX: 105, maxX: 117, minZ: -130.4, maxZ: -128.6 }, { minX: 100, maxX: 134, minZ: -141.6, maxZ: -140.2 },
    { minX: 124, maxX: 134, minZ: -137, maxZ: -136.4 }, { minX: 100, maxX: 103, minZ: -126, maxZ: -124 },
    { minX: 120, maxX: 123, minZ: -126, maxZ: -124 }, { minX: 127, maxX: 129.5, minZ: -131, maxZ: -128.6 },
  ];
  furniture.push(...DEPOT_REGION_CAGES);
  return { walls, furniture, floor: b };
}

// ------------------------------------------------------------------ house lots and shops

export type CityLot = Readonly<{ id: string; frame: Frame; style: number; width: number; depth: number; street: string | null; block: string }>;
export const CITY_LOTS: readonly CityLot[] = GEO_LOTS.filter((l: GeoLot) => l.use === 'casa')
  .map((l) => ({ id: l.id, frame: l.frame, style: l.style, width: l.width, depth: l.depth, street: l.street, block: l.block }));

export type StoreKind = 'mercearia' | 'farmacia' | 'papelaria' | 'supermercado' | 'padaria' | 'variedades' | 'construcao' | 'hortifruti';
export type Store = Readonly<{
  id: StoreKind; name: string; subtitle: string;
  frame: Frame; width: number; depth: number; height: number;
  wall: string; band: string; sign: [string, string];
  stop: { x: number; z: number }; door: { x: number; z: number };
  sector: Sector; street: string | null;
  /** Width of the real lot the shop stands on (≥ width); the gap is closed by a wall. */
  lotWidth: number;
}>;
const SHOP_CONFIG: [StoreKind, string, string, { wall: string; band: string; sign: [string, string] }, number][] = [
  ['mercearia', 'Mercearia do Bairro', 'Padaria · Bebidas · Hortifruti', { wall: '#eadfc4', band: '#2f6688', sign: ['#f4c531', '#a3211c'] }, 4.4],
  ['farmacia', 'Farmácia Popular', 'Medicamentos · Perfumaria', { wall: '#eef3f0', band: '#1f8a5b', sign: ['#ffffff', '#1f8a5b'] }, 4.4],
  ['papelaria', 'Papelaria Central', 'Escolar · Xerox · Presentes', { wall: '#f2ead9', band: '#2b5aa8', sign: ['#2b5aa8', '#f2c230'] }, 4.4],
  ['supermercado', 'Supermercado Boa Vista', 'Açougue · Frios · Mercearia', { wall: '#f4efe4', band: '#c9302c', sign: ['#c9302c', '#ffffff'] }, 5.2],
  ['padaria', 'Padaria Pão Quente', 'Pães · Lanches · Café', { wall: '#f6e3c4', band: '#a4622e', sign: ['#7a3e1d', '#f6d27a'] }, 4.4],
  ['variedades', 'Casa & Lar Variedades', 'Utilidades · Presentes', { wall: '#f0e6f0', band: '#7a3f8f', sign: ['#ffffff', '#7a3f8f'] }, 4.4],
  ['construcao', 'Depósito de Construção', 'Material de Construção', { wall: '#e9e3d6', band: '#d0761f', sign: ['#d0761f', '#ffffff'] }, 5.2],
  ['hortifruti', 'Hortifruti da Praça', 'Frutas · Verduras · Ovos', { wall: '#eef0d9', band: '#4f8a2f', sign: ['#4f8a2f', '#fff7d6'] }, 4.4],
];
/** The eight CORE-014 shops, all FICTIONAL businesses, on lots of the real commercial core. */
export const STORES: readonly Store[] = SHOP_LOTS.map((lot, i) => {
  const [id, name, subtitle, colours, height] = SHOP_CONFIG[i]!;
  const width = Math.min(lot.width, 14); const depth = Math.min(lot.depth, 18);
  return {
    id, name, subtitle, frame: lot.frame, width, depth, height, ...colours, sector: 'comercial' as Sector, street: lot.street, lotWidth: lot.width,
    door: framePoint(lot.frame, width / 2, -0.6), stop: framePoint(lot.frame, width / 2, -SIDEWALK - LANE_OFFSET - 0.2),
  };
});

export type Rect = Readonly<{ x0: number; x1: number; z0: number; z1: number }>;
/**
 * CORE-015.1 shop floor plan in LOT coordinates — the single source for what is drawn
 * (cityBuild.buildStore) and what is solid (storeLayout), so models and colliders cannot drift.
 * A 3.9 m aisle runs from the door to the counter; displays hug the walls and the windows.
 */
export function storePlan(s: Pick<Store, 'width' | 'depth' | 'lotWidth'>): {
  cz: number; door0: number; door1: number; counter: Rect; backShelf: Rect; sideShelf: Rect;
  displayLeft: Rect; displayRight: Rect; windowDisplay: Rect; feature: Rect; sideWall: Rect | null; baseWalls: Rect[];
  /** GFX-001: goods island on the shop floor (only where the shop is wide enough) and the
   *  typical item each shop keeps on its forecourt, both solid. */
  island: Rect | null; forecourt: Rect;
} {
  const W = s.width; const D = s.depth; const t = 0.25; const L = STORE_SETBACK;
  const cz = D * 0.52; const door0 = W / 2 - 1.3; const door1 = W / 2 + 1.3;
  return {
    cz, door0, door1,
    baseWalls: [
      { x0: 0, x1: t + 0.02, z0: L + t, z1: D },
      { x0: W - t - 0.02, x1: W, z0: L + t, z1: D },
      { x0: t + 0.02, x1: W - t - 0.02, z0: D - t - 0.02, z1: D },
    ],
    counter: { x0: 1.2, x1: W - 3.2, z0: cz - 0.35, z1: cz + 0.35 },
    backShelf: { x0: 0.6, x1: W - 0.6, z0: D - 1.0, z1: D - t },
    sideShelf: { x0: t, x1: t + 0.6, z0: cz + 1.2, z1: D - 1.6 },
    displayLeft: { x0: t, x1: t + 0.75, z0: L + t + 1.5, z1: cz - 1.7 },
    displayRight: { x0: W - t - 0.75, x1: W - t, z0: L + t + 1.5, z1: cz - 1.9 },
    windowDisplay: { x0: 1.0, x1: Math.min(2.8, door0 - 0.6), z0: L + t + 0.2, z1: L + t + 1.0 },
    feature: { x0: Math.max(door1 + 0.4, W - 3.3), x1: W - 1.5, z0: L + t + 0.2, z1: L + t + 1.1 },
    // Right of the aisle, 1.3 m clear of the wall display and of the pickup spot.
    island: W / 2 - 4.7 >= 1.0 ? { x0: W / 2 + 2.4, x1: W - 2.3, z0: L + t + 2.3, z1: cz - 2.3 } : null,
    forecourt: { x0: W - 2.5, x1: W - 0.7, z0: 0.5, z1: 1.2 },
    sideWall: s.lotWidth - W > 0.3 ? { x0: W, x1: s.lotWidth, z0: L, z1: L + 0.2 } : null,
  };
}

export type StoreLayout = Readonly<{
  floor: Poly2D; walls: Poly2D[]; counter: Poly2D; shelves: Poly2D[];
  /** Wall and window displays in the customer area (solid). */
  displays: Poly2D[];
  /** The door opening (2.6 m): never ridden through; closed for walkers while the shutter is down. */
  doorway: Poly2D;
  /** Inside the shell (the customer and staff floor). */
  interior: Poly2D;
  door: { x: number; z: number }; pickup: { x: number; z: number }; employee: { x: number; z: number };
  stock: { x: number; z: number }; queue: { x: number; z: number }[]; facing: number;
}>;
export const STORE_SETBACK = 1.5;
/** Shop floor plan as world polygons and interaction spots. */
export function storeLayout(s: Store): StoreLayout {
  const f = s.frame; const W = s.width; const D = s.depth; const t = 0.25;
  const P = (lx: number, lz: number) => framePoint(f, lx, lz);
  const R = (x0: number, x1: number, z0: number, z1: number) => makePoly(frameCorners(f, x0, x1, z0, z1));
  const Q = (r: Rect) => R(r.x0, r.x1, r.z0, r.z1);
  const p = storePlan(s); const cz = p.cz;
  const walls = [
    R(0, t, STORE_SETBACK, D), R(W - t, W, STORE_SETBACK, D), R(0, W, D - t, D),
    R(0, p.door0, STORE_SETBACK, STORE_SETBACK + t), R(p.door1, W, STORE_SETBACK, STORE_SETBACK + t),
  ];
  if (p.sideWall) walls.push(Q(p.sideWall));
  return {
    floor: R(0, W, 0, D),
    walls,
    counter: Q(p.counter),
    shelves: [Q(p.backShelf), Q(p.sideShelf)],
    displays: [Q(p.displayLeft), Q(p.displayRight), Q(p.windowDisplay), Q(p.feature), Q(p.forecourt), ...(p.island ? [Q(p.island)] : [])],
    doorway: R(p.door0, p.door1, STORE_SETBACK, STORE_SETBACK + t),
    interior: R(t, W - t, STORE_SETBACK + t, D - t),
    door: P(W / 2, STORE_SETBACK - 0.6), pickup: P(W / 2 + 1.0, cz - 1.0), employee: P(W / 2 - 0.5, cz + 0.9),
    stock: P(W / 2 + 1.5, D - 1.6),
    queue: [P(W / 2 - 1.6, cz - 1.0), P(W / 2 - 1.6, cz - 2.0), P(W / 2 - 2.6, cz - 2.6), P(W / 2 - 3.4, cz - 3.2)],
    facing: yawOf(f),
  };
}

// ------------------------------------------------------------------ collision, ground, open spaces

/** Real open spaces (OSM parks/pitch/cemetery) stay walkable; shop floors and the depot too. */
export function walkablePolys(): Poly2D[] {
  return [...OPEN_SPACES.map((a) => makePoly(a.pts)), ...STORES.map((s) => storeLayout(s).floor), depotPoly(DEPOT.lot)];
}

/** Everything solid in the town as convex polygons (houses, walls, shop shells, depot). */
export function cityPolygons(): Poly2D[] {
  const out = geoSolids();
  for (const s of STORES) { const L = storeLayout(s); out.push(...L.walls, L.counter, ...L.shelves, ...L.displays); }
  const dl = depotLayout();
  out.push(...dl.walls.map(depotPoly), ...dl.furniture.map(depotPoly));
  // Depot fence on the street with the gate opening, and its side/back fences.
  const d = DEPOT; const fz = d.lot.maxZ; const f = 0.15;
  for (const b of [
    { minX: d.lot.minX, maxX: d.gate.x0, minZ: fz - f, maxZ: fz }, { minX: d.gate.x1, maxX: d.lot.maxX, minZ: fz - f, maxZ: fz },
    { minX: d.lot.minX, maxX: d.lot.minX + f, minZ: d.lot.minZ, maxZ: fz }, { minX: d.lot.maxX - f, maxX: d.lot.maxX, minZ: d.lot.minZ, maxZ: fz },
    { minX: d.lot.minX, maxX: d.lot.maxX, minZ: d.lot.minZ, maxZ: d.lot.minZ + f },
  ]) out.push(depotPoly(b));
  return out;
}
/** Kept for the CORE-013 API: axis boxes (none since CORE-015, everything is a polygon). */
export function cityColliders(): Box2D[] { return []; }

export function cityRaised(): { box: Box2D; height: number; poly?: Poly2D }[] {
  const lot = depotPoly(DEPOT.lot);
  return [...geoRaised(), { box: lot.box, height: CURB_H, poly: lot }];
}

/** Closest road to a point, with distance and arc position. */
export function nearestRoad(x: number, z: number, accept: (r: CityRoad) => boolean = () => true): { road: CityRoad; d: number; s: number; x: number; z: number } | null {
  let best: { road: CityRoad; d: number; s: number; x: number; z: number } | null = null;
  for (const r of ROADS) {
    if (!accept(r)) continue;
    const n = nearestOnPolyline(r.pts, x, z);
    if (!best || n.d < best.d) best = { road: r, d: n.d, s: n.s, x: n.x, z: n.z };
  }
  return best;
}

// ------------------------------------------------------------------ points of interest

export type Poi = Readonly<{ id: string; label: string; kind: 'loja' | 'galpao' | 'praca' | 'esporte' | 'cemiterio' | 'lugar'; x: number; z: number; real: boolean }>;
export function pointsOfInterest(): Poi[] {
  const pois: Poi[] = STORES.map((s) => ({ id: s.id, label: s.name, kind: 'loja' as const, x: s.door.x, z: s.door.z, real: false }));
  const gate = depotWorld((DEPOT.gate.x0 + DEPOT.gate.x1) / 2, DEPOT.yard.maxZ - 6);
  pois.push({ id: 'galpao', label: DEPOT.name, kind: 'galpao', x: gate.x, z: gate.z, real: false });
  for (const a of OPEN_SPACES) {
    const cx = a.pts.reduce((t, p) => t + p[0], 0) / a.pts.length; const cz = a.pts.reduce((t, p) => t + p[1], 0) / a.pts.length;
    const kind = a.kind === 'leisure:pitch' ? 'esporte' : a.kind === 'landuse:cemetery' ? 'cemiterio' : 'praca';
    const label = a.name ?? (kind === 'esporte' ? 'Campo esportivo (OSM)' : kind === 'cemiterio' ? 'Cemitério (OSM)' : 'Praça/área verde (OSM)');
    pois.push({ id: `osm-${a.id}`, label, kind, x: cx, z: cz, real: true });
  }
  const place = GEO.pois.find((p) => p.kind.startsWith('place:') && p.name === 'Brejo Alegre');
  if (place) pois.push({ id: 'osm-place', label: 'Brejo Alegre (nó do lugar no OSM)', kind: 'lugar', x: place.x, z: place.z, real: true });
  return pois;
}

// ------------------------------------------------------------------ metrics

/**
 * Navigable area in m²: carriageways (8 m) and pavements of every road inside the playable
 * bounds, plus walkable shop floors, open spaces and the depot, rasterised at `cell` metres.
 */
export function navigableArea(cell = 2): number {
  const polys = walkablePolys();
  let count = 0;
  for (let x = CITY_BOUNDS.minX + cell / 2; x < CITY_BOUNDS.maxX; x += cell) {
    for (let z = CITY_BOUNDS.minZ + cell / 2; z < CITY_BOUNDS.maxZ; z += cell) {
      const near = nearestRoad(x, z);
      const half = near && near.road.kind === 'urban' ? 6.2 : 4;
      if ((near && near.d <= half) || polys.some((p) => x >= p.box.minX && x <= p.box.maxX && z >= p.box.minZ && z <= p.box.maxZ && pointIn(p, x, z))) count++;
    }
  }
  return count * cell * cell;
}
function pointIn(p: Poly2D, x: number, z: number): boolean {
  let inside = false; const pts = p.pts;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!; const b = pts[j]!;
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Inclusive rectangle subtraction (kept for tools/tests). */
export function subtractBoxes(box: Box2D, holes: readonly Box2D[]): Box2D[] {
  let pieces: Box2D[] = [box];
  for (const h of holes) {
    const next: Box2D[] = [];
    for (const p of pieces) {
      if (h.maxX <= p.minX || h.minX >= p.maxX || h.maxZ <= p.minZ || h.minZ >= p.maxZ) { next.push(p); continue; }
      const ix0 = Math.max(p.minX, h.minX); const ix1 = Math.min(p.maxX, h.maxX);
      if (h.minX > p.minX) next.push({ ...p, maxX: h.minX });
      if (h.maxX < p.maxX) next.push({ ...p, minX: h.maxX });
      if (h.minZ > p.minZ) next.push({ minX: ix0, maxX: ix1, minZ: p.minZ, maxZ: h.minZ });
      if (h.maxZ < p.maxZ) next.push({ minX: ix0, maxX: ix1, minZ: h.maxZ, maxZ: p.maxZ });
    }
    pieces = next;
  }
  return pieces.filter((p) => p.maxX - p.minX > 1e-6 && p.maxZ - p.minZ > 1e-6);
}
