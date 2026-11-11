/** Pure, renderer-independent virtual stick math.
 * Screen delta Y points down; returned Y points forward/up.
 * The center dead-zone removes jitter; outside it displacement is proportional.
 */
export type StickAxes = Readonly<{ x: number; y: number }>;
export const STICK_DEADZONE = 0.12;
export const ZERO_STICK: StickAxes = Object.freeze({ x: 0, y: 0 });

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

/** More responsive MOTORCYCLE steering curve, preserving a smooth neutral center.
 * Walking and keyboard controls do not use this curve.
 * 25% physical stick deflection yields about 45% steering authority; 75% yields ~96%.
 */
export function responsiveMotoSteer(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const x = Math.max(-1, Math.min(1, value));
  if (x === 0) return 0;
  const shaped = Math.min(1, 1.18 * Math.pow(Math.abs(x), 0.7));
  return Math.sign(x) * shaped;
}
