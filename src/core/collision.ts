export type Box2D = Readonly<{ minX: number; maxX: number; minZ: number; maxZ: number }>;
export type MotionGuard = (x: number, z: number, radius: number) => boolean;

/** Pure, deterministic, axis-aligned collision approximation for the disposable web lab. */
export function circleIntersectsBox(x: number, z: number, radius: number, box: Box2D): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(radius) || radius < 0) return true;
  const closestX = Math.max(box.minX, Math.min(x, box.maxX));
  const closestZ = Math.max(box.minZ, Math.min(z, box.maxZ));
  return (x - closestX) ** 2 + (z - closestZ) ** 2 <= radius ** 2;
}

/** Returns true when a circle may stand at (x, z): inside the bounds and touching no obstacle. */
export function createMotionGuard(bounds: Box2D, obstacles: readonly Box2D[]): MotionGuard {
  return (x, z, r) => {
    if (![x, z, r].every(Number.isFinite) || r < 0) return false;
    if (x - r < bounds.minX || x + r > bounds.maxX || z - r < bounds.minZ || z + r > bounds.maxZ) return false;
    return !obstacles.some((o) => circleIntersectsBox(x, z, r, o));
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
