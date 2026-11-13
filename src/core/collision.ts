export type Box2D = Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
export type MotionGuard = (x: number, z: number, radius: number) => boolean;

/** Pure, deterministic, axis-aligned collision approximation for the disposable web lab. */
export function circleIntersectsBox(x: number, z: number, radius: number, box: Box2D): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radius) || radius < 0) return true;
  const closestX = Math.max(box.minX, Math.min(x, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
  return (x - closestX) ** 2 + (z - closestZ) ** 2 <= radius ** 2;
}

/** CORE-015: convex polygon obstacle (real street grid is not axis-aligned). */
export type Poly2D = Readonly<{ pts: readonly (readonly [number, number])[]; box: Box2D }>;

export function makePoly(pts: readonly (readonly [number, number])[]): Poly2D {
  const xs = pts.map((p) => p[0]); const zs = pts.map((p) => p[1]);
  return { pts, box: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) } };
}

/** Point in any simple polygon (even–odd rule). */
export function pointInPoly(pts: readonly (readonly [number, number])[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!; const b = pts[j]!;
    if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

/** Circle against a convex polygon (any winding). */
export function circleIntersectsPoly(x: number, z: number, r: number, poly: Poly2D): boolean {
  const b = poly.box;
  if (x + r < b.minX || x - r > b.maxX || z + r < b.minZ || z - r > b.maxZ) return false;
  const p = poly.pts;
  let inside = true; let sign = 0; let nearest = Infinity;
  for (let i = 0; i < p.length; i++) {
    const a = p[i]!; const c = p[(i + 1) % p.length]!;
    const ex = c[0] - a[0]; const ez = c[1] - a[1];
    const cross = ex * (z - a[1]) - ez * (x - a[0]);
    if (cross !== 0) { const sg = Math.sign(cross); if (sign === 0) sign = sg; else if (sg !== sign) inside = false; }
    const L2 = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((x - a[0]) * ex + (z - a[1]) * ez) / L2));
    nearest = Math.min(nearest, Math.hypot(a[0] + ex * t - x, a[1] + ez * t - z));
  }
  return inside || nearest <= r;
}

/** Uniform grid over obstacle bounding boxes, so a query only tests nearby obstacles. */
export class SpatialIndex<T> {
  private readonly cells = new Map<number, T[]>();
  private readonly cell: number;
  constructor(cell: number) { this.cell = cell; }
  private key(i: number, j: number): number { return (i + 4096) * 8192 + (j + 4096); }
  add(item: T, b: Box2D): void {
    for (let i = Math.floor(b.minX / this.cell); i <= Math.floor(b.maxX / this.cell); i++) {
      for (let j = Math.floor(b.minZ / this.cell); j <= Math.floor(b.maxZ / this.cell); j++) {
        const k = this.key(i, j);
        const list = this.cells.get(k);
        if (list) list.push(item); else this.cells.set(k, [item]);
      }
    }
  }
  near(x: number, z: number, r: number, visit: (item: T) => boolean): boolean {
    for (let i = Math.floor((x - r) / this.cell); i <= Math.floor((x + r) / this.cell); i++) {
      for (let j = Math.floor((z - r) / this.cell); j <= Math.floor((z + r) / this.cell); j++) {
        const list = this.cells.get(this.key(i, j));
        if (list) for (const item of list) if (visit(item)) return true;
      }
    }
    return false;
  }
}

/** Returns true when a circle may stand at (x, z): inside the bounds and touching no obstacle. */
export function createMotionGuard(bounds: Box2D, obstacles: readonly Box2D[], polygons: readonly Poly2D[] = []): MotionGuard {
  const index = new SpatialIndex<{ box?: Box2D; poly?: Poly2D }>(16);
  for (const o of obstacles) index.add({ box: o }, o);
  for (const p of polygons) index.add({ poly: p }, p.box);
  return (x, z, r) => {
    if (![x, z, r].every(Number.isFinite) || r < 0) return false;
    if (x - r < bounds.minX || x + r > bounds.maxX || z - r < bounds.minZ || z + r > bounds.maxZ) return false;
    return !index.near(x, z, r, (o) => (o.box ? circleIntersectsBox(x, z, r, o.box) : circleIntersectsPoly(x, z, r, o.poly!)));
  };
}

export type SlideResult = { x: number; z: number; blocked: boolean; stuck: boolean };

/** Longest step tested at once; smaller than any wall thickness plus body radius, so nothing tunnels. */
const MAX_SUBSTEP = 0.2;

/**
 * Moves a body by (dx, dz) in small sub-steps. When the direct path is blocked it slides along
 * whichever axis is free. `allowed` receives a candidate position and decides if the body fits.
 */
export function slideMove(
  x: number, z: number, dx: number, dz: number,
  allowed: (x: number, z: number) => boolean,
): SlideResult {
  const distance = Math.hypot(dx, dz);
  if (!Number.isFinite(distance) || distance === 0) return { x, z, blocked: false, stuck: false };
  const steps = Math.max(1, Math.ceil(distance / MAX_SUBSTEP));
  const sx = dx / steps;
  const sz = dz / steps;
  let blocked = false;
  let stuck = false;
  for (let i = 0; i < steps; i++) {
    if (allowed(x + sx, z + sz)) { x += sx; z += sz; continue; }
    blocked = true;
    if (sx !== 0 && allowed(x + sx, z)) { x += sx; continue; }
    if (sz !== 0 && allowed(x, z + sz)) { z += sz; continue; }
    stuck = true;
    break;
  }
  return { x, z, blocked, stuck };
}
