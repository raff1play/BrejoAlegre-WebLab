import { angleDelta, clamp, type Box3D, type Point3 } from './math.ts';

/** Babylon ArcRotateCamera uses alpha around the target, so the eye must sit opposite the heading. */
export function behindHeadingAlpha(yaw: number): number {
  return Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
}

/** Frame-rate independent, shortest-arc angular follow (no 2π jump at north). */
export function followAngle(from: number, to: number, rate: number, dt: number): number {
  return from + angleDelta(from, to) * (1 - Math.exp(-rate * Math.max(0, dt)));
}

/** Earliest segment entry into an expanded solid AABB, as a 0..1 fraction. */
export function segmentBoxEntry(from: Point3, to: Point3, box: Box3D, padding = 0): number | null {
  let enter = 0;
  let leave = 1;
  const axes: readonly (readonly [number, number, number, number])[] = [
    [from.x, to.x - from.x, box.minX - padding, box.maxX + padding],
    [from.y, to.y - from.y, box.minY - padding, box.maxY + padding],
    [from.z, to.z - from.z, box.minZ - padding, box.maxZ + padding],
  ];
  for (const [origin, delta, min, max] of axes) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < min || origin > max) return null;
      continue;
    }
    const a = (min - origin) / delta;
    const b = (max - origin) / delta;
    enter = Math.max(enter, Math.min(a, b));
    leave = Math.min(leave, Math.max(a, b));
    if (enter > leave) return null;
  }
  return clamp(enter, 0, 1);
}

/** Pull a chase camera in front of nearby walls/buildings/trunks, never modifying player collisions. */
export function safeCameraDistance(
  focus: Point3, eye: Point3, obstacles: readonly Box3D[],
  padding = 0.25, minimum = 0.7,
): number {
  const length = Math.hypot(eye.x - focus.x, eye.y - focus.y, eye.z - focus.z);
  if (length < 1e-6) return minimum;
  let allowed = length;
  for (const solid of obstacles) {
    const entry = segmentBoxEntry(focus, eye, solid, padding);
    if (entry !== null) allowed = Math.min(allowed, length * entry - 0.06);
  }
  return clamp(allowed, minimum, length);
}
