import { slideMove, type MotionGuard } from './collision.ts';
import { approach, clamp, moveTowards } from './math.ts';

/**
 * Arcade motorcycle model for the web lab: a kinematic bicycle with a lateral-grip limit.
 * It is deliberately NOT rigid-body physics; the goal is predictable, pleasant handling.
 * Heading convention: forward = (sin yaw, cos yaw); positive steer turns right.
 */
export type MotoState = {
  x: number; z: number; yaw: number;
  /** Signed speed along the heading, m/s. Negative while backing up. */
  speed: number;
  /** Smoothed steering input in [-1, 1]. */
  steer: number;
  /** Visual lean angle in radians, positive leaning right. */
  lean: number;
  /** Reversing needs the brake to be released once at rest, so braking to a stop never rolls back. */
  reverseArmed: boolean;
  /** CORE-015.1: smoothed throttle and brake (0..1), so taps give small, controllable pushes. */
  drive?: number;
  braking?: number;
};
export type MotoControls = { throttle: number; brake: number; steer: number };

export const MOTO = Object.freeze({
  maxSpeed: 15.3,          // ~55 km/h, plenty for a residential street
  acceleration: 5.2,       // m/s² at standstill, fading to zero at top speed
  brakeDeceleration: 9.5,
  coastDeceleration: 1.1,  // engine braking + rolling resistance
  dragFactor: 0.012,       // aerodynamic term, × speed²
  reverseSpeed: 1.8,
  reverseAcceleration: 2.5,
  wheelbase: 1.32,
  maxSteerAngle: 0.67,     // rad, ~38° at walking pace for tighter low-speed turns
  maxLateralAccel: 8.0,    // m/s², agile arcade grip limit; still caps high-speed turning
  steerInRate: 5.0,        // quicker response to finger input (1/s)
  steerOutRate: 8.0,       // recentres promptly when thumb is released (1/s)
  maxLean: 0.42,           // ~24°, a moderate visual lean
  bodyRadius: 0.42,
  bodyOffset: 0.55,        // front/rear collision circles along the bike
  stopSpeed: 0.3,          // below this the bike counts as stopped
  // CORE-015.1 handling refinements (small, reversible: set steerSpeedRef to Infinity and the
  // rise rates to a large number to get the CORE-015 behaviour back).
  steerSpeedRef: 7.5,      // m/s: steering lock shrinks as 1 / (1 + (v / ref)²) → precise at speed
  throttleRise: 7,         // 1/s: full throttle 0.14 s after the press (was instantaneous)
  throttleFall: 14,
  brakeRise: 12,           // 1/s: full braking 0.08 s after the press
});

export function createMotoState(x: number, z: number, yaw: number): MotoState {
  return { x, z, yaw, speed: 0, steer: 0, lean: 0, reverseArmed: true };
}

/** The bike is tested as two circles (front and rear wheel area) so its length is respected. */
export function motoFits(guard: MotionGuard, x: number, z: number, yaw: number): boolean {
  const fx = Math.sin(yaw) * MOTO.bodyOffset;
  const fz = Math.cos(yaw) * MOTO.bodyOffset;
  return guard(x + fx, z + fz, MOTO.bodyRadius) && guard(x - fx, z - fz, MOTO.bodyRadius);
}

function nextSpeed(state: MotoState, controls: MotoControls, dt: number): number {
  const wantThrottle = clamp(controls.throttle, 0, 1);
  const wantBrake = clamp(controls.brake, 0, 1);
  state.drive = moveTowards(state.drive ?? 0, wantThrottle, (wantThrottle > (state.drive ?? 0) ? MOTO.throttleRise : MOTO.throttleFall) * dt);
  state.braking = wantBrake > 0 ? moveTowards(state.braking ?? 0, wantBrake, MOTO.brakeRise * dt) : 0;
  const throttle = state.drive;
  const brake = state.braking;
  let speed = state.speed;
  if (brake > 0) {
    if (speed > 0) return Math.max(0, speed - MOTO.brakeDeceleration * brake * dt);
    if (!state.reverseArmed) return 0;
    if (throttle === 0) return Math.max(-MOTO.reverseSpeed, speed - MOTO.reverseAcceleration * brake * dt);
  }
  if (throttle > 0) {
    if (speed < 0) return Math.min(0, speed + MOTO.brakeDeceleration * dt);
    speed += MOTO.acceleration * throttle * (1 - speed / MOTO.maxSpeed) * dt;
    return Math.min(MOTO.maxSpeed, speed);
  }
  const resistance = MOTO.coastDeceleration + MOTO.dragFactor * speed * speed;
  return moveTowards(speed, 0, resistance * dt);
}

/** Advances the simulation by dt seconds, mutating and returning `state`. */
export function stepMotorcycle(state: MotoState, controls: MotoControls, dt: number, guard: MotionGuard): MotoState {
  if (!(dt > 0) || !Number.isFinite(dt)) return state;
  const steerInput = clamp(controls.steer, -1, 1);
  const steerRate = Math.abs(steerInput) > Math.abs(state.steer) ? MOTO.steerInRate : MOTO.steerOutRate;
  state.steer = moveTowards(state.steer, steerInput, steerRate * dt);

  state.speed = nextSpeed(state, controls, dt);
  if (Math.abs(state.speed) < 0.02 && controls.throttle === 0) state.speed = 0;
  if (state.speed > 0) state.reverseArmed = false;
  else if (controls.brake <= 0) state.reverseArmed = true;

  // Bicycle model, limited so lateral acceleration never exceeds the grip budget.
  const speed = state.speed;
  const lock = MOTO.maxSteerAngle / (1 + (speed / MOTO.steerSpeedRef) ** 2);
  let yawRate = (speed / MOTO.wheelbase) * Math.tan(state.steer * lock);
  const gripLimit = MOTO.maxLateralAccel / Math.max(Math.abs(speed), 0.1);
  yawRate = clamp(yawRate, -gripLimit, gripLimit);

  let yaw = state.yaw + yawRate * dt;
  if (!motoFits(guard, state.x, state.z, yaw)) yaw = state.yaw;
  const dx = Math.sin(yaw) * speed * dt;
  const dz = Math.cos(yaw) * speed * dt;
  const moved = slideMove(state.x, state.z, dx, dz, (x, z) => motoFits(guard, x, z, yaw));
  state.x = moved.x;
  state.z = moved.z;
  state.yaw = yaw;
  if (moved.stuck) state.speed = 0;
  else if (moved.blocked) state.speed = moveTowards(state.speed, 0, 14 * dt);

  // Lean follows lateral acceleration; at rest it is zero, which is the low-speed balance assist.
  const leanTarget = clamp(Math.atan2(state.speed * yawRate, 9.81) * 0.85, -MOTO.maxLean, MOTO.maxLean);
  state.lean = approach(state.lean, leanTarget, 7, dt);
  return state;
}

export function isMotoStopped(state: MotoState): boolean {
  return Math.abs(state.speed) < MOTO.stopSpeed;
}
