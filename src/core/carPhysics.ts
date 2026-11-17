import { slideMove, type MotionGuard } from './collision.ts';
import { clamp, moveTowards } from './math.ts';
import { WALKER } from './walking.ts';

/**
 * B1-01 F2: arcade model of the player's old popular car (decisions 5–7, AC-05). Same family as
 * `motorcyclePhysics` (kinematic bicycle with a lateral-grip limit, predictable rather than
 * rigid-body), but with car dimensions: front-wheel steering, no lean, a slower steering wheel,
 * a heavier engine and a rectangular body. The motorcycle model is NOT touched by this file.
 * Heading convention: forward = (sin yaw, cos yaw); right = (cos yaw, -sin yaw); positive steer turns right.
 */
export type CarState = {
  x: number; z: number; yaw: number;
  /** Signed speed along the heading, m/s. Negative while reversing. */
  speed: number;
  /** Smoothed steering-wheel position in [-1, 1]. */
  steer: number;
  /** Reverse needs the brake released once at rest, so braking to a stop never rolls back. */
  reverseArmed: boolean;
  /** Smoothed pedals (0..1). */
  drive: number;
  braking: number;
  /** Handbrake set when the driver leaves the car: a parked car never moves by itself. */
  parked: boolean;
};
export type CarControls = { throttle: number; brake: number; steer: number };

export const CAR = Object.freeze({
  /** Body: 3.85 m × 1.62 m, a typical old Brazilian hatch class (no brand is modelled). */
  length: 3.85,
  width: 1.62,
  wheelbase: 2.44,
  maxSpeed: 16.7,          // ~60 km/h: town streets; the bike tops at ~55 km/h
  acceleration: 3.4,       // m/s² at standstill, fading to zero at top speed (1.0-litre class)
  brakeDeceleration: 8.6,
  coastDeceleration: 0.9,
  dragFactor: 0.01,
  reverseSpeed: 3.0,
  reverseAcceleration: 2.2,
  maxSteerAngle: 0.56,     // ~32°: low-speed turning radius ≈ wheelbase / tan(lock) ≈ 3.9 m
  maxLateralAccel: 7.0,    // less grip than the bike's 9.5, no lean
  steerSpeedRef: 10.0,     // lock shrinks as 1 / (1 + (v / ref)²)
  steerInRate: 4.2,        // a steering wheel: full lock in ~0.24 s
  steerOutRate: 6.5,
  throttleRise: 4.5,
  throttleFall: 9,
  brakeRise: 9,
  stopSpeed: 0.3,
});

/**
 * Collision footprint in car space (x right, z forward): circles whose union covers the body
 * rectangle within `FOOTPRINT_TOLERANCE` and never sticks out of it. Big circles along the centre
 * line give the width; small ones fill the four corners, so a corner cannot cut into a wall.
 * Verified numerically by tests/b1-01-car.test.ts.
 */
export type FootCircle = Readonly<{ x: number; z: number; r: number }>;
export const FOOTPRINT_TOLERANCE = 0.06;
export const CAR_FOOTPRINT: readonly FootCircle[] = (() => {
  const hw = CAR.width / 2; const hl = CAR.length / 2;
  const out: FootCircle[] = [];
  const spine = hl - hw;
  const n = 6;
  for (let i = 0; i < n; i++) out.push({ x: 0, z: -spine + (2 * spine * i) / (n - 1), r: hw });
  const c = 0.13;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (const [dx, dz] of [[c, c], [c, 0.36], [0.36, c], [c, 0.62]] as const) out.push({ x: sx * (hw - dx), z: sz * (hl - dz), r: c });
  }
  return Object.freeze(out);
})();

export function createCarState(x: number, z: number, yaw: number): CarState {
  return { x, z, yaw, speed: 0, steer: 0, reverseArmed: true, drive: 0, braking: 0, parked: true };
}

/** Local (right, forward) → world. */
export function carToWorld(s: { x: number; z: number; yaw: number }, right: number, forward: number): { x: number; z: number } {
  const c = Math.cos(s.yaw); const n = Math.sin(s.yaw);
  return { x: s.x + right * c + forward * n, z: s.z - right * n + forward * c };
}
/** World → local (right, forward). */
export function carLocal(s: { x: number; z: number; yaw: number }, x: number, z: number): { right: number; forward: number } {
  const dx = x - s.x; const dz = z - s.z; const c = Math.cos(s.yaw); const n = Math.sin(s.yaw);
  return { right: dx * c - dz * n, forward: dx * n + dz * c };
}

/** Whole body fits at (x, z, yaw): every footprint circle is accepted by the guard. */
export function carFits(guard: MotionGuard, x: number, z: number, yaw: number): boolean {
  const c = Math.cos(yaw); const n = Math.sin(yaw);
  for (const f of CAR_FOOTPRINT) if (!guard(x + f.x * c + f.z * n, z - f.x * n + f.z * c, f.r)) return false;
  return true;
}

/** Exact oriented-rectangle test: does a circle (x, z, r) touch the car body? Used for people. */
export function carBodyHits(s: { x: number; z: number; yaw: number }, x: number, z: number, r: number): boolean {
  const p = carLocal(s, x, z);
  const dx = Math.max(0, Math.abs(p.right) - CAR.width / 2);
  const dz = Math.max(0, Math.abs(p.forward) - CAR.length / 2);
  return dx * dx + dz * dz < r * r;
}

function nextSpeed(state: CarState, controls: CarControls, dt: number): number {
  const wantThrottle = clamp(controls.throttle, 0, 1);
  const wantBrake = clamp(controls.brake, 0, 1);
  state.drive = moveTowards(state.drive, wantThrottle, (wantThrottle > state.drive ? CAR.throttleRise : CAR.throttleFall) * dt);
  state.braking = wantBrake > 0 ? moveTowards(state.braking, wantBrake, CAR.brakeRise * dt) : 0;
  const throttle = state.drive; const brake = state.braking;
  let speed = state.speed;
  if (brake > 0) {
    if (speed > 0) return Math.max(0, speed - CAR.brakeDeceleration * brake * dt);
    if (!state.reverseArmed) return 0;
    if (throttle === 0) return Math.max(-CAR.reverseSpeed, speed - CAR.reverseAcceleration * brake * dt);
  }
  if (throttle > 0) {
    if (speed < 0) return Math.min(0, speed + CAR.brakeDeceleration * dt);
    speed += CAR.acceleration * throttle * (1 - speed / CAR.maxSpeed) * dt;
    return Math.min(CAR.maxSpeed, speed);
  }
  return moveTowards(speed, 0, (CAR.coastDeceleration + CAR.dragFactor * speed * speed) * dt);
}

/** Advances the car by dt seconds, mutating and returning `state`. A parked car does not move. */
export function stepCar(state: CarState, controls: CarControls, dt: number, guard: MotionGuard): CarState {
  if (!(dt > 0) || !Number.isFinite(dt)) return state;
  if (state.parked) {
    state.speed = 0; state.drive = 0; state.braking = 0;
    state.steer = moveTowards(state.steer, 0, CAR.steerOutRate * dt);
    return state;
  }
  const steerInput = clamp(controls.steer, -1, 1);
  const rate = Math.abs(steerInput) > Math.abs(state.steer) ? CAR.steerInRate : CAR.steerOutRate;
  state.steer = moveTowards(state.steer, steerInput, rate * dt);
  state.speed = nextSpeed(state, controls, dt);
  if (Math.abs(state.speed) < 0.02 && controls.throttle === 0) state.speed = 0;

  const speed = state.speed;
  const lock = CAR.maxSteerAngle / (1 + (speed / CAR.steerSpeedRef) ** 2);
  let yawRate = (speed / CAR.wheelbase) * Math.tan(state.steer * lock);
  const grip = CAR.maxLateralAccel / Math.max(Math.abs(speed), 0.1);
  yawRate = clamp(yawRate, -grip, grip);

  // The pivot of a car is its rear axle; rotating the body about its centre is close enough at
  // these speeds, but the rotation is only applied when the whole rectangle fits.
  let yaw = state.yaw + yawRate * dt;
  if (!carFits(guard, state.x, state.z, yaw)) yaw = state.yaw;
  const moved = slideMove(state.x, state.z, Math.sin(yaw) * speed * dt, Math.cos(yaw) * speed * dt, (x, z) => carFits(guard, x, z, yaw));
  state.x = moved.x; state.z = moved.z; state.yaw = yaw;
  if (moved.stuck) state.speed = 0;
  else if (moved.blocked) state.speed = moveTowards(state.speed, 0, 12 * dt);
  // Reverse is armed after real forward motion has stopped and the brake was released once, so
  // braking to a stop never rolls back; a car pinned against a wall (speed forced to 0 by the
  // collision) arms as soon as the throttle is released, so it can always back out.
  if (state.speed > 0) state.reverseArmed = false;
  else if (controls.brake <= 0) state.reverseArmed = true;
  return state;
}

export function isCarStopped(state: { speed: number }): boolean {
  return Math.abs(state.speed) < CAR.stopSpeed;
}

/** Doors: driver on the left (Brazilian traffic), passenger on the right; both at the front seats. */
export const CAR_DOORS = Object.freeze({
  seatForward: 0.05,
  /** How far from the body side the driver stands after getting out. */
  stepOut: 0.5,
  /** Max distance from a door point to get in. */
  reach: 1.35,
});
export type DoorSide = 'motorista' | 'passageiro' | 'traseira';

/** Spot just outside the door on `side`, in world coordinates. */
export function doorSpot(s: { x: number; z: number; yaw: number }, side: DoorSide): { x: number; z: number } {
  const off = CAR.width / 2 + CAR_DOORS.stepOut;
  if (side === 'traseira') return carToWorld(s, 0, -(CAR.length / 2 + 0.55));
  return carToWorld(s, side === 'motorista' ? -off : off, CAR_DOORS.seatForward);
}

/**
 * Valid place to get out: the car is stopped and the spot beside a door is free (driver's side
 * first, then the passenger side, then behind the car, e.g. when parked against a wall).
 * `guard` must NOT include the car itself.
 */
export function findCarExit(s: CarState, guard: MotionGuard): { x: number; z: number; side: DoorSide } | null {
  if (!isCarStopped(s)) return null;
  for (const side of ['motorista', 'passageiro', 'traseira'] as const) {
    const p = doorSpot(s, side);
    if (guard(p.x, p.z, WALKER.radius) && !carBodyHits(s, p.x, p.z, WALKER.radius)) return { ...p, side };
  }
  return null;
}

/** A person can get in when standing by one of the two front doors. */
export function canEnterCar(walker: { x: number; z: number }, s: { x: number; z: number; yaw: number }): DoorSide | null {
  for (const side of ['motorista', 'passageiro'] as const) {
    const p = doorSpot(s, side);
    if (Math.hypot(walker.x - p.x, walker.z - p.z) <= CAR_DOORS.reach) return side;
  }
  return null;
}

/** Bounding radius for systems that only know circles (traffic yielding to the player). */
export const CAR_RADIUS = Math.hypot(CAR.length / 2, CAR.width / 2);
