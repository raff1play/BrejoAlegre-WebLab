import { MOTO } from './motorcyclePhysics.ts';

/** Pure, renderer-independent virtual stick math.
 * Screen delta Y points down; returned Y points forward/up.
 * The center dead-zone removes jitter; outside it displacement is proportional.
 */
export type StickAxes = Readonly<{ x: number; y: number }>;
export const STICK_DEADZONE = 0.12;
export const ZERO_STICK: StickAxes = Object.freeze({ x: 0, y: 0 });

/**
 * CTRL-001 tuning, all in one place and easy to revert. Distances are fractions of the stick
 * radius (the CSS ring sets the radius in pixels, see `.stick-base`).
 */
export const STICK_TUNING = Object.freeze({
  /** Walking: radial dead zone, unchanged from CORE-015 (360° movement). */
  walkDeadzone: STICK_DEADZONE,
  /** Riding: dead zone on the horizontal axis only, so vertical thumb drift never eats steering. */
  motoDeadzone: 0.06,
  /** Riding: horizontal deflection that already asks for the whole available turn. */
  motoSaturation: 0.62,
  /** Riding: ease-out exponent; > 1 gives more turn for short thumb moves, smooth at the centre.
   * Agile up to `motoEaseLowKmh`, calmer from `motoEaseHighKmh`, interpolated in between. */
  motoEaseLow: 2.5,
  motoEaseHigh: 1.9,
  motoEaseLowKmh: 25,
  motoEaseHighKmh: 40,
  /** Floating stick: how far (× radius) the centre may follow the thumb from the first touch. */
  followTravel: 1.6,
});

export function stickAxes(dx: number, dy: number, radius: number, deadzone = STICK_DEADZONE): StickAxes {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !(radius > 0) || !Number.isFinite(radius)) return ZERO_STICK;
  const x = dx / radius;
  const y = -dy / radius;
  const distance = Math.hypot(x, y);
  const d = Number.isFinite(deadzone) ? Math.max(0, Math.min(0.95, deadzone)) : STICK_DEADZONE;
  if (!Number.isFinite(distance) || distance <= d) return ZERO_STICK;
  const magnitude = (Math.min(1, distance) - d) / (1 - d);
  const factor = magnitude / distance;
  return { x: x * factor, y: y * factor };
}

/** Keyboard stays available; the analog input adds smoothly and clamps to valid movement. */
export function blendAxis(keyboard: number, analog: number): number {
  return Math.max(-1, Math.min(1, keyboard + analog));
}

/**
 * CTRL-001 riding curve: horizontal deflection (−1…1 of the radius) → fraction of the turn the
 * bike can make at its current speed `speed` (m/s) (−1…1). Axial dead zone, ease-out, full turn
 * at `motoSaturation`. CTRL-002: after real Android feedback, 25 % deflection asks for ~64 %
 * of available turn at low speed, ~55 % from 40 km/h; ≥ 62 % asks for full turn.
 * The physical yaw cap and speed response remain in motorcyclePhysics.ts.
 */
export function motoTurnFraction(x: number, speed = 0): number {
  if (!Number.isFinite(x)) return 0;
  const a = Math.min(1, Math.abs(x));
  const k = STICK_TUNING;
  if (a <= k.motoDeadzone) return 0;
  const kmh = Number.isFinite(speed) ? Math.abs(speed) * 3.6 : 0;
  const h = Math.max(0, Math.min(1, (kmh - k.motoEaseLowKmh) / (k.motoEaseHighKmh - k.motoEaseLowKmh)));
  const ease = k.motoEaseLow + (k.motoEaseHigh - k.motoEaseLow) * h;
  const t = Math.min(1, (a - k.motoDeadzone) / (k.motoSaturation - k.motoDeadzone));
  return Math.sign(x) * (1 - (1 - t) ** ease);
}

/**
 * CTRL-001: steering command that makes the bike turn at `fraction` of the yaw rate it can reach
 * at `speed` (the physics caps it by the speed-dependent lock and by the grip limit). The physics
 * limits themselves are untouched: full input still means the same maximum turn as before, but
 * the thumb travel is spread over the turn that is actually available — light at low speed,
 * calm at high speed. Inverse of the bicycle model in `stepMotorcycle`.
 */
export function steerForTurn(fraction: number, speed: number): number {
  if (!Number.isFinite(fraction) || fraction === 0) return 0;
  const f = Math.max(-1, Math.min(1, fraction));
  const v = Number.isFinite(speed) ? Math.abs(speed) : 0;
  const lock = MOTO.maxSteerAngle / (1 + (v / MOTO.steerSpeedRef) ** 2);
  // max yaw rate × wheelbase / v, written so that v → 0 stays finite.
  const reach = v > 1e-6 ? Math.min(Math.tan(lock), (MOTO.maxLateralAccel * MOTO.wheelbase) / (v * v)) : Math.tan(lock);
  return Math.sign(f) * Math.min(1, Math.atan(Math.abs(f) * reach) / lock);
}

/**
 * Floating stick (dynamic + limited follow): when the thumb goes past the radius the centre is
 * dragged behind it, so reversing the turn needs only a short move back. The centre never travels
 * more than `maxTravel` pixels from the first touch.
 */
export function followCenter(
  center: { x: number; y: number }, finger: { x: number; y: number }, radius: number,
  origin: { x: number; y: number }, maxTravel: number,
): { x: number; y: number } {
  if (![center.x, center.y, finger.x, finger.y, radius, origin.x, origin.y, maxTravel].every(Number.isFinite) || radius <= 0) return center;
  const dx = finger.x - center.x; const dy = finger.y - center.y;
  const d = Math.hypot(dx, dy);
  if (d <= radius) return center;
  let x = finger.x - (dx / d) * radius; let y = finger.y - (dy / d) * radius;
  const ox = x - origin.x; const oy = y - origin.y; const o = Math.hypot(ox, oy);
  if (o > maxTravel && o > 0) { x = origin.x + (ox / o) * maxTravel; y = origin.y + (oy / o) * maxTravel; }
  return { x, y };
}

/**
 * B1-01 F2: car steering from the same floating stick. Separate tuning, so the CTRL-002 motorcycle
 * curve above stays byte-for-byte the same. A steering wheel wants a calmer, more linear response
 * than handlebars: axial dead zone, saturation at 75 % of the radius, gentle ease-out. The physical
 * lock and grip limits live in carPhysics.ts (the lock already shrinks with speed).
 */
export const CAR_STICK = Object.freeze({ deadzone: 0.06, saturation: 0.75, ease: 1.6 });
export function carTurnFraction(x: number): number {
  if (!Number.isFinite(x)) return 0;
  const a = Math.min(1, Math.abs(x));
  if (a <= CAR_STICK.deadzone) return 0;
  const t = Math.min(1, (a - CAR_STICK.deadzone) / (CAR_STICK.saturation - CAR_STICK.deadzone));
  return Math.sign(x) * (1 - (1 - t) ** CAR_STICK.ease);
}
