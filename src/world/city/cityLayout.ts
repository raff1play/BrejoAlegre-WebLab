import { makePoly, type Box2D, type Poly2D } from '../../core/collision.ts';
import type { Box3D } from '../../core/math.ts';
import { HOUSE_DEPTH, HOUSE_STYLES, ROAD_HALF, SIDEWALK, frameCorners, framePoint, houseSpan, yawOf, type TreeSpec } from '../layout.ts';
import { CITY_LOTS, DEPOT, ROADS, STORES, cityPolygons, depotWorld, depotYaw, nodeById, storeLayout, type CityRoad } from './cityPlan.ts';
import { GEO_WALLS, OPEN_SPACES, pointInPolygon } from '../geo/geoCity.ts';
import { PLAY_BOUNDS } from '../geo/network.ts';

/**
 * CORE-015 street furniture and solids along the REAL streets. Lamp posts and street trees are
 * generic infrastructure placed at regular spacing on real pavements (their exact real positions
 * are not mapped in OSM); they never stand in front of a shop, the depot gate or a delivery gate.
 */
type P = { x: number; z: number };

/** Walks a road polyline every `step` metres, skipping `margin` metres at both junction ends. */
function along(r: CityRoad, step: number, margin: number, visit: (p: P, dir: P, s: number) => void): void {
  const pts = r.pts;
  let acc = 0; let next = margin;
  const end = r.length - margin;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!; const b = pts[i]!;
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
    const dir = { x: (b[0] - a[0]) / L, z: (b[1] - a[1]) / L };
    while (next <= acc + L && next <= end) {
      const t = (next - acc) / L;
      visit({ x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t }, dir, next);
      next += step;
    }
    acc += L;
  }
}

const keepClear = (): P[] => [
  ...STORES.map((s) => s.door),
  depotWorld((DEPOT.gate.x0 + DEPOT.gate.x1) / 2, DEPOT.lot.maxZ),
];

const inPlay = (p: P) => p.x > PLAY_BOUNDS.minX && p.x < PLAY_BOUNDS.maxX && p.z > PLAY_BOUNDS.minZ && p.z < PLAY_BOUNDS.maxZ;

export function streetLightPositions(): { x: number; z: number; yaw: number }[] {
  const out: { x: number; z: number; yaw: number }[] = [];
  const clear = keepClear();
  for (const r of ROADS) {
    if (r.kind !== 'urban') continue;
    let k = 0;
    along(r, 32, 12, (p, d) => {
      const side = k++ % 2 === 0 ? 1 : -1;
      const off = ROAD_HALF + 0.45;
      const q = { x: p.x + d.z * off * side, z: p.z - d.x * off * side };
      if (!inPlay(q) || clear.some((c) => Math.hypot(c.x - q.x, c.z - q.z) < 7)) return;
      // The arm points over the road (towards the axis).
      out.push({ ...q, yaw: Math.atan2(-d.z * side, d.x * side) });
    });
  }
  return out;
}

export function cityTrees(): TreeSpec[] {
  const trees: TreeSpec[] = [];
  const lights = streetLightPositions();
  const clear = keepClear();
  const kinds: TreeSpec['kind'][] = ['oiti', 'oiti', 'ipe', 'oiti', 'ipe-roxo'];
  let k = 0;
  for (const r of ROADS) {
    if (r.kind !== 'urban') continue;
    let n = 0;
    along(r, 26, 14, (p, d) => {
      const side = n++ % 2 === 0 ? -1 : 1;
      const off = ROAD_HALF + 0.75;
      const q = { x: p.x + d.z * off * side, z: p.z - d.x * off * side };
      if (!inPlay(q)) return;
      if (lights.some((l) => Math.hypot(l.x - q.x, l.z - q.z) < 4)) return;
      if (clear.some((c) => Math.hypot(c.x - q.x, c.z - q.z) < 9)) return;
      trees.push({ x: q.x, z: q.z, kind: kinds[k++ % kinds.length]!, scale: 0.85 + (k % 4) * 0.08, solid: true });
    });
  }
  // Trees inside the real parks mapped in OSM.
  for (const a of OPEN_SPACES.filter((o) => o.kind === 'leisure:park')) {
    const xs = a.pts.map((q) => q[0]); const zs = a.pts.map((q) => q[1]);
    for (let x = Math.min(...xs) + 6; x < Math.max(...xs) - 4; x += 11) {
      for (let z = Math.min(...zs) + 6; z < Math.max(...zs) - 4; z += 13) {
        if (pointInPolygon(a.pts, x, z) && (Math.round(x + z) % 3 !== 0)) trees.push({ x, z, kind: kinds[k++ % kinds.length]!, scale: 1.1, solid: true });
      }
    }
  }
  return trees;
}

/** Frontage walls as oriented thin rectangles (closing every block edge between lots). */
export function frontageWalls(): typeof GEO_WALLS { return GEO_WALLS; }

/** Solids of the expansion that are not polygons already: none — kept for the old API. */
export function cityAllColliders(): Box2D[] { return []; }

/** Tree trunks as small square polygons (solid for the player). */
export function treePolygons(): Poly2D[] {
  return cityTrees().map((t) => { const r = 0.24 * t.scale; return makePoly([[t.x - r, t.z - r], [t.x + r, t.z - r], [t.x + r, t.z + r], [t.x - r, t.z + r]]); });
}

/**
 * CORE-011 Poly Haven furniture at the shops: a colonial lamp at each end of the frontage (kerb
 * side of the pavement) and a planter box in the forecourt under the left window (off the public
 * pavement, where pedestrians walk). One source for the models AND their colliders.
 */
export function shopFurniture(): { lamps: { x: number; z: number; yaw: number }[]; planters: { x: number; z: number; yaw: number; poly: Poly2D }[] } {
  const lamps: { x: number; z: number; yaw: number }[] = []; const planters: { x: number; z: number; yaw: number; poly: Poly2D }[] = [];
  for (const s of STORES) {
    const yaw = yawOf(s.frame) + Math.PI; // models look out to the street
    for (const lx of [-0.9, s.width + 0.9]) { const p = framePoint(s.frame, lx, -SIDEWALK + 0.45); lamps.push({ x: p.x, z: p.z, yaw }); }
    const q = framePoint(s.frame, 1.7, 0.85);
    planters.push({ x: q.x, z: q.z, yaw, poly: makePoly(frameCorners(s.frame, 1.01, 2.39, 0.60, 1.10)) });
  }
  return { lamps, planters };
}

/** Solid street furniture: lamp posts (generic and colonial) and the shop planters. */
export function furniturePolygons(): Poly2D[] {
  const post = (x: number, z: number, r: number) => makePoly([[x - r, z - r], [x + r, z - r], [x + r, z + r], [x - r, z + r]]);
  const f = shopFurniture();
  return [...streetLightPositions().map((l) => post(l.x, l.z, 0.12)), ...f.lamps.map((l) => post(l.x, l.z, 0.14)), ...f.planters.map((q) => q.poly)];
}

/** Every static solid of the town for the player, the bike and the tests. */
export function solidPolygons(): Poly2D[] {
  return [...cityPolygons(), ...treePolygons(), ...furniturePolygons()];
}

/** Chase-camera blockers: houses, shop walls and ceilings, depot walls, frontage walls (oriented). */
export function cityCameraObstacles(): Box3D[] {
  const out: Box3D[] = [];
  const obox = (frame: { ox: number; oz: number }, yaw: number, lx0: number, lx1: number, lz0: number, lz1: number, y0: number, y1: number): Box3D =>
    ({ minX: lx0, maxX: lx1, minZ: lz0, maxZ: lz1, minY: y0, maxY: y1, yaw, cx: frame.ox, cz: frame.oz });
  for (const l of CITY_LOTS) {
    const style = HOUSE_STYLES[l.style % HOUSE_STYLES.length]!;
    const [x0, x1] = houseSpan({ garageSide: style.garageSide, lotWidth: l.width });
    const setback = Math.min(style.setback, Math.max(1.5, l.depth - HOUSE_DEPTH - 0.5));
    out.push(obox(l.frame, yawOf(l.frame), x0, x1, setback, setback + HOUSE_DEPTH, 0, 5.2));
  }
  for (const s of STORES) {
    const yaw = yawOf(s.frame);
    const L = storeLayout(s);
    // The first five are the shell; a sixth is the 2 m wall closing the rest of the lot.
    L.walls.forEach((w, i) => out.push(toBox(w, i < 5 ? s.height + 0.6 : 2.2)));
    out.push(obox(s.frame, yaw, 0, s.width, 1.5, s.depth, s.height - 0.45, s.height + 0.6));
  }
  for (const w of GEO_WALLS) out.push(obox(w.frame, yawOf(w.frame), 0, w.length, 0, 0.22, 0, 2.4));
  // Depot shed: walls 9.6 m, roof slab (the yard stays open).
  const shed = DEPOT.building;
  const o = depotWorld(139.8, -92.2);
  const yaw = depotYaw(Math.PI);
  out.push(obox({ ox: o.x, oz: o.z }, yaw, 139.8 - shed.maxX, 139.8 - shed.minX, -92.2 - shed.maxZ, -92.2 - shed.minZ, DEPOT.height - 0.6, DEPOT.height + 0.6));
  void framePoint; void nodeById; void SIDEWALK;
  return out;
}

function toBox(p: Poly2D, h: number): Box3D {
  // Thin oriented wall polygon → oriented box (yaw from its long edge).
  const [a, b, c] = [p.pts[0]!, p.pts[1]!, p.pts[2]!];
  const ex = b[0] - a[0]; const ez = b[1] - a[1]; const L = Math.hypot(ex, ez) || 1;
  const W = Math.hypot(c[0] - b[0], c[1] - b[1]);
  // Frame axes: fx along a→b, inward towards c; yaw = atan2(ix, iz) with fx = (iz, −ix).
  const yaw = Math.atan2(-ez / L, ex / L);
  return { minX: 0, maxX: L, minZ: 0, maxZ: W, minY: 0, maxY: h, yaw, cx: a[0], cz: a[1] };
}
