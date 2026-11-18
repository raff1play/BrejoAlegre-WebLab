import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import { solveTwoBone, type Vec3 } from '../../core/ik';
import { loadSkinnedGlb } from '../../world/externalAssets';
import type { Pose } from './character';

/**
 * EXPERIMENTO kit: drives a Mixamo-rigged GLB (no riding animation needed) from the SAME `Pose`
 * the procedural rider uses — pelvis, torso yaw/pitch/roll, head, hands, feet and IK poles — so
 * the model rides the bike, walks, works and drives exactly like the built-in character.
 *
 * All maths runs in the glTF root's space ("g"), which is right-handed and unmirrored; the
 * character root space ("c", Babylon, +z forward) differs from it by the loader's handedness root.
 * Bones are aimed from joint to child joint; limbs use the model's own bone lengths.
 */
const B = (n: string) => `mixamorig:${n}`;
const SPINE = [B('Spine'), B('Spine1'), B('Spine2')] as const;
const SPINE_SHARE = [0.4, 0.7, 1] as const;

type Chain = { upper: TransformNode; lower: TransformNode; end: TransformNode; l1: number; l2: number };

const tmpM = Matrix.Identity(); const tmpM2 = Matrix.Identity(); const tmpS = new Vector3(); const tmpT = new Vector3();
const tmpQ = new Quaternion(); const tmpQ2 = new Quaternion();

function localMatrix(n: TransformNode, out: Matrix): Matrix {
  const q = n.rotationQuaternion ?? Quaternion.FromEulerVector(n.rotation);
  return Matrix.ComposeToRef(n.scaling, q, n.position, out);
}

export class GlbRig {
  private readonly rest = new Map<TransformNode, Quaternion>();
  private readonly c2g: Matrix; private readonly g2c: Matrix;
  private readonly hips: TransformNode;
  private readonly spine: TransformNode[];
  private readonly neck: TransformNode; private readonly head: TransformNode;
  private readonly arms: Chain[]; private readonly legs: Chain[];
  private readonly toes: TransformNode[];
  private readonly restToe: Vector3[] = [];
  private readonly hipsRestY: number;

  private constructor(private readonly root: TransformNode, nodes: Map<string, TransformNode>, readonly meshes: AbstractMesh[]) {
    const get = (n: string) => { const t = nodes.get(n); if (!t) throw new Error(`osso ausente: ${n}`); return t; };
    this.g2c = localMatrix(root, Matrix.Identity());
    this.c2g = this.g2c.clone().invert();
    for (const t of nodes.values()) {
      t.rotationQuaternion ??= Quaternion.FromEulerVector(t.rotation);
      this.rest.set(t, t.rotationQuaternion.clone());
    }
    this.hips = get(B('Hips'));
    this.spine = SPINE.map(get);
    this.neck = get(B('Neck')); this.head = get(B('Head'));
    const chain = (a: string, b: string, c: string): Chain => {
      const upper = get(a), lower = get(b), end = get(c);
      return { upper, lower, end, l1: this.posG(lower).subtract(this.posG(upper)).length(), l2: this.posG(end).subtract(this.posG(lower)).length() };
    };
    // Index 0 = left (pose side -1), 1 = right.
    this.arms = [chain(B('LeftArm'), B('LeftForeArm'), B('LeftHand')), chain(B('RightArm'), B('RightForeArm'), B('RightHand'))];
    this.legs = [chain(B('LeftUpLeg'), B('LeftLeg'), B('LeftFoot')), chain(B('RightUpLeg'), B('RightLeg'), B('RightFoot'))];
    this.toes = [get(B('LeftToeBase')), get(B('RightToeBase'))];
    for (let i = 0; i < 2; i++) this.restToe.push(this.toC(this.posG(this.toes[i]!).subtract(this.posG(this.legs[i]!.end)), true).normalize());
    this.hipsRestY = this.toC(this.posG(this.hips)).y;
  }

  static async load(scene: Scene, url: string, parent: TransformNode): Promise<GlbRig> {
    const { root, nodes, meshes } = await loadSkinnedGlb(scene, url);
    root.parent = parent;
    const byName = new Map(nodes.filter((n) => n.name.startsWith('mixamorig:')).map((n) => [n.name, n]));
    return new GlbRig(root, byName, meshes);
  }

  /** Height of the model's hips above its feet in the rest pose (metres). */
  get hipHeight(): number { return this.hipsRestY; }

  /** Matrix of a node relative to the glTF root (row-vector convention: world = local × parent). */
  private rel(n: TransformNode, out = Matrix.Identity()): Matrix {
    if (n === this.root) { Matrix.IdentityToRef(out); return out; }
    localMatrix(n, out);
    let p = n.parent as TransformNode | null;
    while (p && p !== this.root) { out.multiplyToRef(localMatrix(p, tmpM2), out); p = p.parent as TransformNode | null; }
    return out;
  }
  private relRot(n: TransformNode): Quaternion { const q = new Quaternion(); this.rel(n, tmpM).decompose(tmpS, q, tmpT); return q; }
  private posG(n: TransformNode): Vector3 { this.rel(n, tmpM).decompose(tmpS, tmpQ, tmpT); return tmpT.clone(); }
  private toG(v: Vec3, dir = false): Vector3 { const p = new Vector3(v.x, v.y, v.z); return dir ? Vector3.TransformNormal(p, this.c2g) : Vector3.TransformCoordinates(p, this.c2g); }
  private toC(v: Vector3, dir = false): Vector3 { return dir ? Vector3.TransformNormal(v, this.g2c) : Vector3.TransformCoordinates(v, this.g2c); }

  /** Sets a node's rotation so that its rotation relative to the glTF root is `want`. */
  private setRel(n: TransformNode, want: Quaternion): void {
    const parent = this.relRot(n.parent as TransformNode);
    Quaternion.InverseToRef(parent, tmpQ2);
    // Row-vector matrices: rel = local × parentRel ⇒ local = rel × parentRel⁻¹ (quaternions: parent⁻¹ ⊗ rel).
    tmpQ2.multiplyToRef(want, n.rotationQuaternion!);
  }

  /** Character-space rotation (yaw/pitch/roll, Babylon order) expressed in glTF space. */
  private rotToG(yaw: number, pitch: number, roll: number, share = 1): Quaternion {
    const q = Quaternion.Slerp(Quaternion.Identity(), Quaternion.RotationYawPitchRoll(yaw, pitch, roll), share);
    const m = Matrix.Identity(); q.toRotationMatrix(m);
    this.g2c.multiplyToRef(m, tmpM).multiplyToRef(this.c2g, tmpM);
    const out = new Quaternion(); tmpM.decompose(tmpS, out, tmpT); return out;
  }

  /** Turns bone `n` (minimal rotation) so its joint→child direction points along `dirG`. */
  private aim(n: TransformNode, child: TransformNode, dirG: Vector3): void {
    const cur = this.relRot(n);
    const from = child.position.clone().rotateByQuaternionToRef(cur, new Vector3()).normalize();
    const to = dirG.clone().normalize();
    if (Vector3.Dot(from, to) > 0.99999) return;
    const delta = new Quaternion(); Quaternion.FromUnitVectorsToRef(from, to, delta);
    this.setRel(n, delta.multiply(cur));
  }

  private limb(c: Chain, rootC: Vector3, target: Vec3, pole: Vec3): void {
    const { joint, end } = solveTwoBone({ x: rootC.x, y: rootC.y, z: rootC.z }, target, c.l1, c.l2, pole);
    this.aim(c.upper, c.lower, this.toG({ x: joint.x - rootC.x, y: joint.y - rootC.y, z: joint.z - rootC.z }, true));
    this.aim(c.lower, c.end, this.toG({ x: end.x - joint.x, y: end.y - joint.y, z: end.z - joint.z }, true));
  }

  apply(pose: Pose): void {
    for (const [n, q] of this.rest) n.rotationQuaternion!.copyFrom(q);
    // Pelvis: the model's legs are shorter than the procedural rider's; lower the pelvis just enough
    // for the farther foot to stay reachable (standing/walking), never on the seat (riding).
    const legLen = (this.legs[0]!.l1 + this.legs[0]!.l2) * 0.995;
    let py = pose.pelvis.y;
    for (const i of [0, 1] as const) {
      const f = pose.feet[i]; const ankleY = f.y + 0.08;
      const dx = f.x - (pose.pelvis.x + (i === 0 ? -0.09 : 0.09)), dz = f.z - pose.pelvis.z;
      const h = legLen * legLen - dx * dx - dz * dz;
      if (h > 0) py = Math.min(py, ankleY + Math.sqrt(h));
    }
    const hipsParent = this.rel(this.hips.parent as TransformNode).clone().invert();
    this.hips.position.copyFrom(Vector3.TransformCoordinates(this.toG({ x: pose.pelvis.x, y: py, z: pose.pelvis.z }), hipsParent));
    // Torso shared over the three spine bones; neck follows the chest, head adds its own turn.
    const restRel = new Map<TransformNode, Quaternion>();
    for (const n of [...this.spine, this.neck, this.head]) restRel.set(n, this.relRot(n));
    this.spine.forEach((n, k) => this.setRel(n, this.rotToG(pose.yaw, pose.pitch, pose.roll, SPINE_SHARE[k]).multiply(restRel.get(n)!)));
    const torso = this.rotToG(pose.yaw, pose.pitch, pose.roll);
    this.setRel(this.neck, torso.multiply(restRel.get(this.neck)!));
    const head = Quaternion.RotationYawPitchRoll(pose.yaw + pose.headYaw, pose.pitch + pose.headPitch - pose.pitch * 0.6, pose.roll * 0.5);
    const hm = Matrix.Identity(); head.toRotationMatrix(hm);
    this.g2c.multiplyToRef(hm, tmpM).multiplyToRef(this.c2g, tmpM); const hq = new Quaternion(); tmpM.decompose(tmpS, hq, tmpT);
    this.setRel(this.head, hq.multiply(restRel.get(this.head)!));
    // Limbs from the model's real shoulders/hips to the pose's hands/ankles.
    for (const i of [0, 1] as const) {
      const arm = this.arms[i]!;
      this.limb(arm, this.toC(this.posG(arm.upper)), pose.hands[i], pose.elbowPoles[i]);
      const leg = this.legs[i]!;
      const f = pose.feet[i];
      this.limb(leg, this.toC(this.posG(leg.upper)), { x: f.x, y: f.y + 0.08, z: f.z }, pose.kneePoles[i]);
      const toe = Vector3.TransformNormal(this.restToe[i]!, Matrix.RotationYawPitchRoll(pose.footYaw[i], pose.footPitch[i], 0));
      this.aim(leg.end, this.toes[i]!, this.toG(toe, true));
    }
  }
}
