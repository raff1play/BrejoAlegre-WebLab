import { slideMove, type MotionGuard } from './collision.ts';
import { angleDelta } from './math.ts';

export type WalkerState = { x: number; z: number; yaw: number; moving: boolean };
export type WalkControls = { forward: number; right: number };

export const WALKER = Object.freeze({ speed: 3.1, radius: 0.3, turnRate: 12 });

/**
 * Moves the pedestrian relative to the camera: `viewYaw` is the ground heading the camera looks
 * towards, so "forward" always means "away from the viewer" whatever the camera rotation is.
 */
export function stepWalker(
  state: WalkerState, controls: WalkControls, viewYaw: number, dt: number, guard: MotionGuard,
): WalkerState {
  if (!(dt > 0) || !Number.isFinite(dt)) return state;
  const fx = Math.sin(viewYaw);
  const fz = Math.cos(viewYaw);
  // In Babylon's left-handed system the camera's right is (fz, -fx).
  let dx = fx * controls.forward + fz * controls.right;
  let dz = fz * controls.forward - fx * controls.right;
  const length = Math.hypot(dx, dz);
  state.moving = length > 0.01;
  if (!state.moving) return state;
  dx /= length;
  dz /= length;
  const step = WALKER.speed * Math.min(1, length) * dt;
  const moved = slideMove(state.x, state.z, dx * step, dz * step, (x, z) => guard(x, z, WALKER.radius));
  state.x = moved.x;
  state.z = moved.z;
  const turn = angleDelta(state.yaw, Math.atan2(dx, dz));
  state.yaw += turn * Math.min(1, WALKER.turnRate * dt);
  return state;
}
