import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import { solveTwoBone, type Vec3 } from '../../core/ik';
import { RigidSkin } from './rigidSkin';
import { BatchSet } from '../../world/geometry';
import type { Materials } from '../../world/materials';
import { ballPart, boxPart, ringPart, rodPart } from '../../world/modelParts';

/**
 * Articulated delivery rider shared by the riding and walking presentations. Limbs are rigid
 * segments placed every frame by two-bone IK from a pose (all points in the character root space,
 * +z forward, y up, ground at y = 0). Presentation only: the simulation never reads it.
 */
export type CharacterLook = { jacket: string; trim: string; jeans: string; boots: string; gloves: string; helmet: string; helmetStripe: string; skin: string };
export const RIDER_LOOK: CharacterLook = {
  jacket: '#24476b', trim: '#e7ecef', jeans: '#2b3a4f', boots: '#2b211a', gloves: '#1c1e20',
  helmet: '#f1f1ee', helmetStripe: '#c0262c', skin: '#c69874',
};

export const BODY = Object.freeze({
  upperArm: 0.29, foreArm: 0.29, thigh: 0.44, shin: 0.43,
  ankle: 0.085, hipHalf: 0.1, shoulderHalf: 0.19,
  /** Waist pivot above the pelvis origin, and shoulders above the waist (torso local). */
  shoulderUp: 0.47, neckUp: 0.5,
});

export type Pose = {
  /** Pelvis centre. */
  pelvis: Vec3;
  /** Torso rotation around the waist: pitch (+ leans forward), yaw (+ turns right), roll (+ leans right). */
  pitch: number; yaw: number; roll: number;
  headYaw: number; headPitch: number;
  hands: [Vec3, Vec3];
  feet: [Vec3, Vec3];
  /** Points the elbows and knees bend towards. */
  elbowPoles: [Vec3, Vec3];
  kneePoles: [Vec3, Vec3];
  /** Foot heading (yaw) and toe pitch, per side. */
  footYaw: [number, number];
  footPitch: [number, number];
};

const DOWN = new Vector3(0, -1, 0);
const tmpDir = new Vector3();

type Limb = { upper: TransformNode; lower: TransformNode; upperLength: number; lowerLength: number };

export class Character {
  readonly root: TransformNode;
  readonly meshes: AbstractMesh[] = [];
  private readonly pelvis: TransformNode;
  private readonly torso: TransformNode;
  private readonly head: TransformNode;
  private readonly arms: Limb[] = [];
  private readonly legs: Limb[] = [];
  private readonly feet: TransformNode[] = [];

  constructor(scene: Scene, mats: Materials, name: string, look: CharacterLook = RIDER_LOOK) {
    const node = (n: string, parent: TransformNode | null) => {
      const t = new TransformNode(`${name}-${n}`, scene);
      t.parent = parent;
      t.rotationQuaternion = Quaternion.Identity();
      return t;
    };
    this.root = new TransformNode(name, scene);
    // Every segment is a bone of one rigid skin: one mesh per material for the whole body.
    const skin = new RigidSkin(scene, name, this.root);
    const build = (parent: TransformNode, set: BatchSet) => skin.add(parent, set);
    const jacket = mats.paint(look.jacket);
    const trim = mats.paint(look.trim, 0.3);
    const jeans = mats.paint(look.jeans);
    const boots = mats.paint(look.boots, 0.2);
    const gloves = mats.paint(look.gloves);
    const skinTone = mats.paint(look.skin);

    // Pelvis: hips and belt.
    this.pelvis = node('pelvis', this.root);
    const pelvis = new BatchSet();
    pelvis.absorb(jeans, ballPart(scene, [0.34, 0.2, 0.23], [0, 0.0, 0], 6));
    pelvis.absorb(mats.paint('#1a1a1a', 0.3), boxPart(scene, [0.33, 0.045, 0.22], [0, 0.07, 0]));
    build(this.pelvis, pelvis);

    // Torso: tapered jacket, shoulders, collar, zip and reflective bands.
    this.torso = node('tronco', this.pelvis);
    this.torso.position.y = 0.06;
    const torso = new BatchSet();
    // Round parts are squashed front-to-back (z × 0.62) before merging, for a human chest.
    const flat = <T extends { scaling: Vector3 }>(mesh: T): T => { mesh.scaling.z *= 0.62; return mesh; };
    torso.absorb(jacket, flat(rodPart(scene, [0, 0.0, 0], [0, 0.44, 0], 0.33, 0.42, 12)));
    for (const side of [-1, 1]) torso.absorb(jacket, ballPart(scene, [0.17, 0.15, 0.2], [side * BODY.shoulderHalf, BODY.shoulderUp - 0.02, 0], 5));
    torso.absorb(jacket, ringPart(scene, 0.075, 0.05, [0, 0.47, 0.01], 'y', 12));
    torso.absorb(trim, flat(rodPart(scene, [0, 0.27, 0], [0, 0.31, 0], 0.418, 0.426, 12)));
    torso.absorb(trim, flat(rodPart(scene, [0, 0.11, 0], [0, 0.145, 0], 0.37, 0.378, 12)));
    torso.absorb(mats.paint('#16191c'), boxPart(scene, [0.02, 0.4, 0.02], [0, 0.22, 0.125]));
    build(this.torso, torso);

    // Head: neck, full-face helmet with visor, stripe and chin bar.
    this.head = node('cabeca', this.torso);
    this.head.position.y = BODY.neckUp;
    const head = new BatchSet();
    head.absorb(skinTone, rodPart(scene, [0, -0.06, 0], [0, 0.06, 0], 0.11, 0.1, 8));
    head.absorb(mats.lacquer(look.helmet), ballPart(scene, [0.29, 0.3, 0.32], [0, 0.17, 0], 9));
    head.absorb(mats.lacquer(look.helmetStripe), ballPart(scene, [0.06, 0.305, 0.325], [0, 0.175, -0.002], 7));
    head.absorb(mats.lacquer('#121619'), ballPart(scene, [0.235, 0.115, 0.17], [0, 0.185, 0.085], 7));
    head.absorb(mats.lacquer(look.helmet), boxPart(scene, [0.17, 0.07, 0.07], [0, 0.07, 0.125], [0.25, 0, 0]));
    build(this.head, head);

    for (const side of [-1, 1] as const) {
      const upper = node(`braco-${side}`, this.root);
      const arm = new BatchSet();
      arm.absorb(jacket, rodPart(scene, [0, 0, 0], [0, -BODY.upperArm, 0], 0.115, 0.095, 8));
      build(upper, arm);
      const lower = node(`antebraco-${side}`, this.root);
      const fore = new BatchSet();
      fore.absorb(jacket, rodPart(scene, [0, 0, 0], [0, -BODY.foreArm + 0.06, 0], 0.095, 0.08, 8));
      fore.absorb(trim, rodPart(scene, [0, -0.15, 0], [0, -0.18, 0], 0.098, 0.096, 8));
      fore.absorb(gloves, ballPart(scene, [0.085, 0.11, 0.09], [0, -BODY.foreArm + 0.01, 0], 4));
      build(lower, fore);
      this.arms.push({ upper, lower, upperLength: BODY.upperArm, lowerLength: BODY.foreArm });

      const thigh = node(`coxa-${side}`, this.root);
      const t = new BatchSet();
      t.absorb(jeans, rodPart(scene, [0, 0.04, 0], [0, -BODY.thigh, 0], 0.17, 0.13, 10));
      build(thigh, t);
      const shin = node(`canela-${side}`, this.root);
      const s = new BatchSet();
      s.absorb(jeans, rodPart(scene, [0, 0.02, 0], [0, -BODY.shin + 0.1, 0], 0.125, 0.105, 8));
      s.absorb(jeans, ballPart(scene, [0.12, 0.1, 0.13], [0, 0, 0], 4));
      build(shin, s);
      this.legs.push({ upper: thigh, lower: shin, upperLength: BODY.thigh, lowerLength: BODY.shin });

      // Boot: built with the ankle at the origin, sole at y = -ankle, toe towards +z.
      const foot = new TransformNode(`${name}-pe-${side}`, scene);
      foot.parent = this.root;
      const f = new BatchSet();
      f.absorb(boots, rodPart(scene, [0, 0.09, -0.01], [0, -0.03, -0.01], 0.12, 0.115, 8));
      f.absorb(boots, boxPart(scene, [0.105, 0.075, 0.25], [0, -0.045, 0.045]));
      f.absorb(mats.paint('#151515'), boxPart(scene, [0.11, 0.022, 0.26], [0, -BODY.ankle + 0.011, 0.045]));
      build(foot, f);
      this.feet.push(foot);
    }
    this.meshes.push(...skin.build({ min: new Vector3(-1.2, -0.3, -1.2), max: new Vector3(1.2, 2.2, 1.2) }));
  }

  /** Pelvis-space shoulder (side -1 left / 1 right) after the torso rotation, in root space. */
  shoulder(pose: Pose, side: -1 | 1): Vec3 {
    return this.torsoPoint(pose, side * BODY.shoulderHalf, BODY.shoulderUp - 0.01, 0);
  }

  private torsoPoint(pose: Pose, x: number, y: number, z: number): Vec3 {
    // Same order as Babylon's YawPitchRoll: roll (z), then pitch (x), then yaw (y); the torso
    // pivot sits 0.06 above the pelvis origin.
    const cr = Math.cos(pose.roll); const sr = Math.sin(pose.roll);
    let px = x * cr - y * sr;
    let py = x * sr + y * cr;
    let pz = z;
    const cp = Math.cos(pose.pitch); const sp = Math.sin(pose.pitch);
    const qy = py * cp - pz * sp;
    const qz = py * sp + pz * cp;
    py = qy; pz = qz;
    const cy = Math.cos(pose.yaw); const sy = Math.sin(pose.yaw);
    const rx = px * cy + pz * sy;
    const rz = -px * sy + pz * cy;
    px = rx; pz = rz;
    return { x: pose.pelvis.x + px, y: pose.pelvis.y + 0.06 + py, z: pose.pelvis.z + pz };
  }

  apply(pose: Pose): void {
    this.pelvis.position.set(pose.pelvis.x, pose.pelvis.y, pose.pelvis.z);
    Quaternion.RotationYawPitchRollToRef(pose.yaw, pose.pitch, pose.roll, this.torso.rotationQuaternion!);
    Quaternion.RotationYawPitchRollToRef(pose.headYaw, pose.headPitch - pose.pitch * 0.6, -pose.roll * 0.5, this.head.rotationQuaternion!);
    for (const i of [0, 1] as const) {
      const side = i === 0 ? -1 : 1;
      this.placeLimb(this.arms[i]!, this.shoulder(pose, side), pose.hands[i], pose.elbowPoles[i]);
      const hip = { x: pose.pelvis.x + side * BODY.hipHalf, y: pose.pelvis.y - 0.04, z: pose.pelvis.z };
      const ankle = { x: pose.feet[i].x, y: pose.feet[i].y + BODY.ankle, z: pose.feet[i].z };
      const end = this.placeLimb(this.legs[i]!, hip, ankle, pose.kneePoles[i]);
      const foot = this.feet[i]!;
      foot.position.set(end.x, end.y, end.z);
      foot.rotation.set(pose.footPitch[i], pose.footYaw[i], 0);
    }
  }

  private placeLimb(limb: Limb, root: Vec3, target: Vec3, pole: Vec3): Vec3 {
    const { joint, end } = solveTwoBone(root, target, limb.upperLength, limb.lowerLength, pole);
    this.orient(limb.upper, root, joint);
    this.orient(limb.lower, joint, end);
    return end;
  }

  private orient(node: TransformNode, from: Vec3, to: Vec3): void {
    node.position.set(from.x, from.y, from.z);
    tmpDir.set(to.x - from.x, to.y - from.y, to.z - from.z).normalize();
    // Segments are modelled pointing down; limbs never point straight up, so no flip is needed.
    Quaternion.FromUnitVectorsToRef(DOWN, tmpDir, node.rotationQuaternion!);
  }
}

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** Relaxed standing pose with a breathing cycle; `t` in seconds. */
export function standingPose(t: number): Pose {
  const breathe = Math.sin(t * 2.1) * 0.012;
  return {
    pelvis: v(0, 0.985, 0), pitch: 0.03 + breathe, yaw: 0, roll: 0, headYaw: Math.sin(t * 0.5) * 0.12, headPitch: 0,
    hands: [v(-0.25, 0.73, 0.02), v(0.25, 0.73, 0.02)],
    feet: [v(-0.11, 0, 0.02), v(0.11, 0, 0.02)],
    elbowPoles: [v(-0.4, 1.1, -0.6), v(0.4, 1.1, -0.6)],
    kneePoles: [v(-0.12, 0.5, 1), v(0.12, 0.5, 1)],
    footYaw: [-0.12, 0.12], footPitch: [0, 0],
  };
}

/**
 * Walk cycle driven by `phase` (radians, advanced by distance walked) and `amount` 0..1 (stride
 * scale proportional to speed). Feet lift on the forward swing; arms swing against the legs.
 */
export function walkingPose(phase: number, amount: number, t: number): Pose {
  const pose = standingPose(t);
  if (amount <= 0.001) return pose;
  const stride = 0.3 * amount;
  const lift = 0.13 * Math.min(1, amount * 1.3);
  for (const i of [0, 1] as const) {
    const p = phase + (i === 0 ? 0 : Math.PI);
    const swing = Math.sin(p);
    const up = Math.max(0, Math.cos(p));
    pose.feet[i] = v(i === 0 ? -0.1 : 0.1, up * lift, swing * stride);
    pose.footPitch[i] = -up * 0.35 * amount + Math.max(0, -swing) * 0.2 * amount;
    pose.footYaw[i] = (i === 0 ? -0.06 : 0.06);
    pose.hands[i] = v(i === 0 ? -0.24 : 0.24, 0.74 + Math.max(0, -swing) * 0.04 * amount, 0.03 - swing * 0.26 * amount);
    pose.elbowPoles[i] = v(i === 0 ? -0.35 : 0.35, 1.0, -0.8);
  }
  pose.pelvis = v(Math.sin(phase) * 0.02 * amount, 0.975 - Math.abs(Math.cos(phase)) * 0.035 * amount, 0);
  pose.pitch = 0.05 + 0.06 * amount;
  pose.yaw = -Math.sin(phase) * 0.12 * amount;
  pose.roll = Math.sin(phase) * 0.025 * amount;
  pose.headYaw = Math.sin(phase) * 0.06 * amount;
  return pose;
}
