/**
 * Analytic two-bone IK (shoulder→elbow→hand, hip→knee→foot) used only to POSE the character
 * models: it never feeds back into the simulation. Pure maths, no renderer.
 */
export type Vec3 = { x: number; y: number; z: number };

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });

export type TwoBoneResult = { joint: Vec3; end: Vec3; reached: boolean };

/**
 * Places the middle joint so that |root→joint| = upper and |joint→end| = lower, with `end` as
 * close to `target` as the limb allows, bending towards `pole` (a point, not a direction).
 */
export function solveTwoBone(root: Vec3, target: Vec3, upper: number, lower: number, pole: Vec3): TwoBoneResult {
  const toTarget = sub(target, root);
  const distance = len(toTarget);
  const min = Math.abs(upper - lower) + 1e-4;
  const max = upper + lower - 1e-4;
  const d = Math.min(max, Math.max(min, distance));
  const dir = distance > 1e-6 ? scale(toTarget, 1 / distance) : { x: 0, y: -1, z: 0 };
  const end = add(root, scale(dir, d));
  // Distance from root along dir to the joint's projection, and the joint's offset from that line.
  const a = (upper * upper - lower * lower + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  let bend = sub(pole, root);
  bend = sub(bend, scale(dir, dot(bend, dir)));
  let bendLength = len(bend);
  if (bendLength < 1e-6) {
    // Pole on the limb line: pick any perpendicular, preferring "forward" (+z).
    bend = Math.abs(dir.z) < 0.9 ? sub({ x: 0, y: 0, z: 1 }, scale(dir, dir.z)) : sub({ x: 1, y: 0, z: 0 }, scale(dir, dir.x));
    bendLength = len(bend);
  }
  const joint = add(add(root, scale(dir, a)), scale(bend, h / bendLength));
  return { joint, end, reached: distance <= max && distance >= min };
}
