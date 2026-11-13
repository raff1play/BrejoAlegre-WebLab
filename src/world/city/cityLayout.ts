import type { Box2D } from '../../core/collision.ts';
import { CROSS_Z, HOUSES, LOT_DEPTH, LOT_WIDTH, ROAD_HALF, SHOP, SIDEWALK, WALL_T, frameRect, type TreeSpec } from '../layout.ts';
import {
  BLOCKS, BUS_STOPS, CHURCH, CITY_LOTS, CORE_EXTENT, ROADS, SCHOOL, SERVICES, STORES, cityColliders, roadSpan, walkableAreas,
  type CityRoad,
} from './cityPlan.ts';

/**
 * CORE-013 pure placement helpers for the expansion (no renderer): street lights, trees, frontage
 * walls and the complete collider list. Shared by cityBuild.ts and the unit tests.
 */
const E = ROAD_HALF + SIDEWALK;

/** Portion of a road the W009 core already draws (avenue and R. Coroados up to ±CORE_EXTENT). */
export function coreClip(r: CityRoad): [number, number] | null {
  const s = roadSpan(r);
  const isAvenue = s.axis === 'z' && s.c === 0;
  const isCross = s.axis === 'x' && s.c === CROSS_Z;
  return isAvenue || isCross ? [-CORE_EXTENT, CORE_EXTENT] : null;
}

/** Splits [lo, hi] into the parts outside the clip interval. */
export function outside(lo: number, hi: number, clip: [number, number] | null): [number, number][] {
  if (!clip) return [[lo, hi]];
  const parts: [number, number][] = [];
  if (lo < clip[0]) parts.push([lo, Math.min(hi, clip[0])]);
  if (hi > clip[1]) parts.push([Math.max(lo, clip[1]), hi]);
  return parts.filter(([a, b]) => b - a > 0.01);
}

/** Street lights every ~26 m on the new urban roads (lamp heads glow; brighter at night). */
export function streetLightPositions(): { x: number; z: number; yaw: number }[] {
  const out: { x: number; z: number; yaw: number }[] = [];
  for (const r of ROADS) {
    if (r.kind !== 'urban') continue;
    const s = roadSpan(r);
    for (const [lo, hi] of outside(s.lo + E + 4, s.hi - E - 4, coreClip(r))) {
      for (let t = lo + 5; t < hi - 3; t += 26) {
        const side = Math.round(t / 26) % 2 === 0 ? 1 : -1;
        const c = s.c + side * (ROAD_HALF + 0.45);
        out.push(s.axis === 'x' ? { x: t, z: c, yaw: side > 0 ? Math.PI : 0 } : { x: c, z: t, yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
      }
    }
  }
  return out.filter((p) => !BUS_STOPS.some((b) => Math.hypot(b.shelter.x - p.x, b.shelter.z - p.z) < 3));
}

/** Walls filling the frontage gaps of every block, so no block shows an open edge. */
export function frontageWalls(): Box2D[] {
  const covers: Box2D[] = [
    ...HOUSES.map((h) => frameRect(h.frame, 0, LOT_WIDTH, 0, LOT_DEPTH)),
    ...CITY_LOTS.map((l) => frameRect(l.frame, 0, LOT_WIDTH, 0, LOT_DEPTH)),
    ...STORES.slice(1).map((s) => frameRect(s.frame, 0, s.width, 0, s.depth)),
    SHOP.lot,
    frameRect(CHURCH.frame, 0, CHURCH.width, 0, CHURCH.depth),
    frameRect(SCHOOL.frame, 0, SCHOOL.width, 0, SCHOOL.depth),
    frameRect(SERVICES.frame, 0, SERVICES.width, 0, SERVICES.depth),
    ...walkableAreas(),
  ];
  const walls: Box2D[] = [];
  for (const block of BLOCKS) {
    const b = block.box;
    const edges: { axis: 'x' | 'z'; c: number; lo: number; hi: number; inward: number }[] = [
      { axis: 'x', c: b.minZ, lo: b.minX, hi: b.maxX, inward: 1 }, { axis: 'x', c: b.maxZ, lo: b.minX, hi: b.maxX, inward: -1 },
      { axis: 'z', c: b.minX, lo: b.minZ, hi: b.maxZ, inward: 1 }, { axis: 'z', c: b.maxX, lo: b.minZ, hi: b.maxZ, inward: -1 },
    ];
    for (const e of edges) {
      const covered = covers.filter((c) => e.axis === 'x'
        ? (Math.abs(c.minZ - e.c) < 0.05 || Math.abs(c.maxZ - e.c) < 0.05) && c.maxX > e.lo && c.minX < e.hi
        : (Math.abs(c.minX - e.c) < 0.05 || Math.abs(c.maxX - e.c) < 0.05) && c.maxZ > e.lo && c.minZ < e.hi)
        .map((c) => (e.axis === 'x' ? [c.minX, c.maxX] : [c.minZ, c.maxZ]) as [number, number])
        .sort((p, q) => p[0] - q[0]);
      let cursor = e.lo;
      const flush = (to: number) => {
        if (to - cursor > 0.3) {
          const t0 = e.c; const t1 = e.c + e.inward * WALL_T;
          walls.push(e.axis === 'x' ? { minX: cursor, maxX: to, minZ: Math.min(t0, t1), maxZ: Math.max(t0, t1) } : { minX: Math.min(t0, t1), maxX: Math.max(t0, t1), minZ: cursor, maxZ: to });
        }
      };
      for (const [c0, c1] of covered) { if (c0 > cursor) flush(c0); cursor = Math.max(cursor, c1); }
      flush(e.hi);
    }
  }
  return walls;
}

/** Street trees on the new urban pavements, clear of lights, stops and junctions (pure; colliders too). */
export function cityTrees(): TreeSpec[] {
  const trees: TreeSpec[] = [];
  const lights = streetLightPositions();
  const kinds: TreeSpec['kind'][] = ['oiti', 'oiti', 'ipe', 'oiti', 'ipe-roxo'];
  let k = 0;
  for (const r of ROADS) {
    if (r.kind !== 'urban') continue;
    const s = roadSpan(r);
    for (const [lo, hi] of outside(s.lo + E + 3, s.hi - E - 3, coreClip(r))) {
      for (let t = lo + 14; t < hi - 2; t += 22) {
        for (const side of [-1, 1]) {
          const c = s.c + side * (ROAD_HALF + 0.75);
          const [x, z] = s.axis === 'x' ? [t, c] : [c, t];
          if (lights.some((l) => Math.hypot(l.x - x, l.z - z) < 3)) continue;
          if (BUS_STOPS.some((b) => Math.hypot(b.shelter.x - x, b.shelter.z - z) < 4)) continue;
          if (STORES.some((st) => Math.hypot(st.stop.x - x, st.stop.z - z) < 5)) continue;
          trees.push({ x, z, kind: kinds[k++ % kinds.length]!, scale: 0.85 + (k % 4) * 0.08, solid: true });
        }
      }
    }
  }
  // Rural edge: groves along the exits and around the fields.
  const rural: [number, number, TreeSpec['kind']][] = [
    [-14, 100, 'oiti'], [12, 112, 'ipe'], [-20, 128, 'oiti'], [16, 138, 'oiti'], [-90, -2, 'oiti'], [-110, -40, 'ipe'],
    [-130, 2, 'oiti'], [-96, -60, 'oiti'], [-14, -110, 'oiti'], [14, -130, 'ipe-roxo'], [-30, -150, 'oiti'], [40, -120, 'oiti'],
    [90, 20, 'oiti'], [120, 40, 'ipe'], [100, 70, 'oiti'], [150, 10, 'oiti'], [-100, 60, 'ipe'], [-140, 100, 'oiti'],
  ];
  for (const [x, z, kind] of rural) trees.push({ x, z, kind, scale: 1.3, solid: true });
  return trees;
}

/** Everything solid in the expansion: block fills, depot, shelters and the street/rural trees. */
export function cityAllColliders(): Box2D[] {
  return [
    ...cityColliders(),
    ...cityTrees().map((t) => ({ minX: t.x - 0.24 * t.scale, maxX: t.x + 0.24 * t.scale, minZ: t.z - 0.24 * t.scale, maxZ: t.z + 0.24 * t.scale })),
  ];
}
