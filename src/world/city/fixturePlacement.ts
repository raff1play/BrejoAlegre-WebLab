import { createMotionGuard, pointInPoly } from '../../core/collision.ts';
import { ROAD_HALF, SIDEWALK } from '../layout.ts';
import { CITY_BOUNDS, DEPOT, STORES, cityPolygons, depotWorld } from './cityPlan.ts';
import { geoRaised, roadDistance } from '../geo/geoCity.ts';

/**
 * Shared site validation for PROCEDURAL urban equipment.
 * The OSM data maps road axes, not actual street lights or signals. A virtual
 * fixture must sit on the generated raised pavement, clear of the carriageway,
 * buildings, gates and the other fixtures using the same selection rule.
 */
export type FixturePoint = Readonly<{ x: number; z: number }>;
const distance = (a: FixturePoint, b: FixturePoint): number => Math.hypot(a.x - b.x, a.z - b.z);
const entrance = [
  ...STORES.map((s) => s.door),
  depotWorld((DEPOT.gate.x0 + DEPOT.gate.x1) / 2, DEPOT.lot.maxZ),
];

// Cache only static geometry; building the guards for every candidate was
// previously expensive, especially on the mobile browser.
let allowedBySolids: ReturnType<typeof createMotionGuard> | undefined;
let raised: ReturnType<typeof geoRaised> | undefined;
const solids = () => (allowedBySolids ??= createMotionGuard(CITY_BOUNDS, [], cityPolygons()));
const pavements = () => (raised ??= geoRaised());

/** True only for a footprint on raised sidewalk, away from solid geometry. */
export function validFixtureSite(p: FixturePoint, radius = 0.17): boolean {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.z) || !Number.isFinite(radius) || radius <= 0) return false;
  const d = roadDistance(p.x, p.z);
  // The closest road matters: a point beside one street may be INSIDE another
  // street at a skewed junction or on a one-way separated carriageway.
  if (d < ROAD_HALF + radius + 0.08 || d > ROAD_HALF + SIDEWALK - radius - 0.10) return false;
  if (entrance.some((e) => distance(p, e) < 6.5 + radius)) return false;
  if (!solids()(p.x, p.z, radius + 0.12)) return false;
  // Avoid placing equipment on the unraised gap at corner joins or inside lots.
  // Check the actual footprint, not just its centre.
  const sample: FixturePoint[] = [p,
    { x: p.x + radius, z: p.z }, { x: p.x - radius, z: p.z },
    { x: p.x, z: p.z + radius }, { x: p.x, z: p.z - radius }];
  return sample.every((q) => pavements().some((s) =>
    q.x >= s.box.minX && q.x <= s.box.maxX && q.z >= s.box.minZ && q.z <= s.box.maxZ
      && pointInPoly(s.poly.pts, q.x, q.z)));
}

/** Apply this to combined sets (generic lights, storefront lights, signals and trees). */
export function clearOfFixtures(p: FixturePoint, others: readonly FixturePoint[], spacing: number): boolean {
  return others.every((other) => distance(p, other) >= spacing);
}
