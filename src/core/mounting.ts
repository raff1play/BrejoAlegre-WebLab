import type { MotionGuard } from './collision.ts';
import { WALKER } from './walking.ts';

export const MOUNT = Object.freeze({ reach: 2.2, sideOffset: 1.0 });

export type Spot = { x: number; z: number };

/** Looks for free ground beside the parked bike: left first (kerb side habit), then right, then behind. */
export function findDismountSpot(moto: { x: number; z: number; yaw: number }, guard: MotionGuard): Spot | null {
  const fx = Math.sin(moto.yaw);
  const fz = Math.cos(moto.yaw);
  const rx = fz;
  const rz = -fx;
  const d = MOUNT.sideOffset;
  const candidates: Spot[] = [
    { x: moto.x - rx * d, z: moto.z - rz * d },
    { x: moto.x + rx * d, z: moto.z + rz * d },
    { x: moto.x - fx * 1.7, z: moto.z - fz * 1.7 },
    { x: moto.x + fx * 1.7, z: moto.z + fz * 1.7 },
  ];
  return candidates.find((c) => guard(c.x, c.z, WALKER.radius)) ?? null;
}

export function canMount(walker: Spot, moto: Spot): boolean {
  return Math.hypot(walker.x - moto.x, walker.z - moto.z) <= MOUNT.reach;
}
