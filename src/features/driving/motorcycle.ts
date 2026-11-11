import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { MotionGuard } from '../../core/collision';
import { approach } from '../../core/math';
import { MOTO, createMotoState, stepMotorcycle, type MotoControls, type MotoState } from '../../core/motorcyclePhysics';
import { BatchSet } from '../../world/geometry';
import type { Materials } from '../../world/materials';
import { ballPart, boxPart, rodPart, tyrePart, type Xyz } from '../shared/modelParts';

const WHEEL_RADIUS = 0.3;
const AXLE = MOTO.wheelbase / 2;
/** Lean of the parked bike resting on its side stand (to the left). */
const STAND_LEAN = -0.13;

export type MotorcycleLook = { paint: string; box: string; helmet: string };
export const PLAYER_LOOK: MotorcycleLook = { paint: '#b3262b', box: '#1d2023', helmet: '#f0f0ee' };

/**
 * Utility 125–160 cc style motorcycle with a top box, built from primitives merged per material.
 * Presentation only: the motion comes from core/motorcyclePhysics.
 */
export class Motorcycle {
  readonly root: TransformNode;
  readonly state: MotoState;
  readonly meshes: AbstractMesh[] = [];
  private readonly leanNode: TransformNode;
  private readonly steering: TransformNode;
  private readonly wheels: TransformNode[] = [];
  private readonly rider: TransformNode;
  private readonly stand: TransformNode;
  private ridden = true;
  private groundY = 0;

  constructor(scene: Scene, mats: Materials, look: MotorcycleLook, x: number, z: number, yaw: number, groundHeight: number, withRider = true) {
    this.state = createMotoState(x, z, yaw);
    this.root = new TransformNode('moto', scene);
    this.leanNode = new TransformNode('moto-inclinacao', scene);
    this.leanNode.parent = this.root;

    const black = mats.paint('#17191b', 0.12);
    const rubber = mats.paint('#141516', 0.04);
    const metal = mats.paint('#8d9398', 0.6);
    const darkMetal = mats.paint('#3a3e42', 0.35);
    const paint = mats.paint(look.paint, 0.55);
    const add = (parent: TransformNode, set: BatchSet, name: string) => {
      const meshes = set.build(name, scene, parent);
      this.meshes.push(...meshes);
    };

    // Wheels spin around their own axle node.
    for (const [name, z0] of [['roda-traseira', -AXLE], ['roda-dianteira', 0]] as const) {
      const wheel = new TransformNode(name, scene);
      const set = new BatchSet();
      set.absorb(rubber, tyrePart(scene, WHEEL_RADIUS, 0.11));
      set.absorb(metal, rodPart(scene, [-0.035, 0, 0], [0.035, 0, 0], 0.4, 0.4, 16));
      for (const turn of [0, Math.PI / 2]) set.absorb(darkMetal, boxPart(scene, [0.075, 0.42, 0.05], [0, 0, 0], [turn, 0, 0]));
      add(wheel, set, name);
      wheel.position.set(0, WHEEL_RADIUS, z0);
      this.wheels.push(wheel);
    }
    this.wheels[0]!.parent = this.leanNode;

    // Front end turns with the steering: wheel, fork, mudguard, headlight, handlebar and mirrors.
    this.steering = new TransformNode('moto-direcao', scene);
    this.steering.parent = this.leanNode;
    this.steering.position.set(0, 0, AXLE);
    this.wheels[1]!.parent = this.steering;
    const front = new BatchSet();
    for (const side of [-1, 1]) {
      front.absorb(metal, rodPart(scene, [side * 0.1, WHEEL_RADIUS, 0], [side * 0.1, 1.02, -0.2], 0.045));
      front.absorb(black, rodPart(scene, [side * 0.33, 1.06, -0.24], [side * 0.22, 1.08, -0.24], 0.05));
      front.absorb(darkMetal, rodPart(scene, [side * 0.26, 1.07, -0.24], [side * 0.34, 1.27, -0.27], 0.018));
      front.absorb(darkMetal, boxPart(scene, [0.12, 0.08, 0.02], [side * 0.35, 1.3, -0.27]));
    }
    front.absorb(darkMetal, rodPart(scene, [-0.3, 1.07, -0.24], [0.3, 1.07, -0.24], 0.03));
    front.absorb(paint, boxPart(scene, [0.15, 0.03, 0.46], [0, 0.635, 0.02], [0.12, 0, 0]));
    front.absorb(black, boxPart(scene, [0.22, 0.2, 0.14], [0, 0.98, -0.1]));
    front.absorb(mats.glow('#fff3c4'), rodPart(scene, [0, 0.98, -0.04], [0, 0.97, 0.03], 0.17, 0.15, 12));
    front.absorb(black, boxPart(scene, [0.2, 0.07, 0.1], [0, 1.12, -0.16], [-0.5, 0, 0]));
    add(this.steering, front, 'moto-frente');

    // Frame, engine, tank, seat, exhaust and tail.
    const body = new BatchSet();
    body.absorb(paint, ballPart(scene, [0.34, 0.27, 0.56], [0, 0.86, 0.2]));
    body.absorb(paint, boxPart(scene, [0.3, 0.2, 0.34], [0, 0.63, -0.22]));
    body.absorb(paint, boxPart(scene, [0.17, 0.035, 0.42], [0, 0.66, -0.72], [-0.22, 0, 0]));
    body.absorb(black, boxPart(scene, [0.29, 0.1, 0.66], [0, 0.83, -0.3]));
    body.absorb(darkMetal, boxPart(scene, [0.3, 0.3, 0.36], [0, 0.44, 0.05]));
    body.absorb(metal, rodPart(scene, [0, 0.52, 0.12], [0, 0.72, 0.2], 0.2, 0.18, 10));
    body.absorb(darkMetal, rodPart(scene, [0, 0.72, 0.36], [0, 0.42, 0.26], 0.05));
    body.absorb(darkMetal, rodPart(scene, [0, 0.74, -0.52], [0, 0.4, 0.0], 0.045));
    for (const side of [-1, 1]) body.absorb(darkMetal, rodPart(scene, [side * 0.09, 0.34, -0.1], [side * 0.09, WHEEL_RADIUS, -AXLE], 0.04));
    body.absorb(metal, rodPart(scene, [0.15, 0.34, 0.16], [0.17, 0.33, -0.32], 0.05));
    body.absorb(metal, rodPart(scene, [0.17, 0.33, -0.3], [0.19, 0.42, -0.92], 0.1, 0.085, 10));
    body.absorb(mats.glow('#d81f1f'), boxPart(scene, [0.14, 0.06, 0.04], [0, 0.74, -0.95]));
    body.absorb(mats.paint('#e8e6de'), boxPart(scene, [0.2, 0.12, 0.015], [0, 0.6, -0.97], [0.25, 0, 0]));
    for (const side of [-1, 1]) body.absorb(darkMetal, boxPart(scene, [0.1, 0.03, 0.06], [side * 0.2, 0.34, -0.02]));
    // Rear rack and the delivery top box, with reflective strips.
    const boxMat = mats.paint(look.box, 0.25);
    body.absorb(darkMetal, boxPart(scene, [0.3, 0.025, 0.46], [0, 0.885, -0.78]));
    body.absorb(boxMat, boxPart(scene, [0.48, 0.38, 0.46], [0, 1.09, -0.8]));
    body.absorb(mats.paint('#2c3034', 0.3), boxPart(scene, [0.5, 0.05, 0.48], [0, 1.3, -0.8]));
    body.absorb(mats.glow('#c9281e'), boxPart(scene, [0.4, 0.05, 0.01], [0, 1.0, -1.033]));
    for (const side of [-1, 1]) body.absorb(mats.paint('#e9e7df'), boxPart(scene, [0.01, 0.05, 0.36], [side * 0.243, 1.0, -0.8]));
    add(this.leanNode, body, 'moto-corpo');

    // Side stand, shown only while parked.
    this.stand = new TransformNode('moto-descanso', scene);
    this.stand.parent = this.leanNode;
    const stand = new BatchSet();
    stand.absorb(darkMetal, rodPart(scene, [-0.1, 0.32, -0.12], [-0.26, 0.015, -0.2], 0.03));
    add(this.stand, stand, 'moto-descanso');

    // Rider, seated with hands on the grips. Hidden while the player is on foot.
    this.rider = new TransformNode('piloto', scene);
    this.rider.parent = this.leanNode;
    const rider = new BatchSet();
    const jacket = mats.paint('#2d5f8f', 0.1);
    const jeans = mats.paint('#2a3646', 0.05);
    const skin = mats.paint('#c69874', 0.08);
    rider.absorb(jacket, boxPart(scene, [0.38, 0.52, 0.23], [0, 1.2, -0.2], [0.22, 0, 0]));
    rider.absorb(jeans, boxPart(scene, [0.34, 0.16, 0.26], [0, 0.93, -0.28]));
    rider.absorb(mats.paint(look.helmet, 0.6), ballPart(scene, [0.28, 0.29, 0.31], [0, 1.6, -0.1], 12));
    rider.absorb(mats.paint('#15181b', 0.7), boxPart(scene, [0.2, 0.09, 0.05], [0, 1.6, 0.045]));
    rider.absorb(skin, rodPart(scene, [0, 1.42, -0.13], [0, 1.5, -0.11], 0.11));
    for (const side of [-1, 1]) {
      const shoulder: Xyz = [side * 0.2, 1.38, -0.14];
      const elbow: Xyz = [side * 0.3, 1.16, 0.12];
      const grip: Xyz = [side * 0.29, 1.08, AXLE - 0.24];
      rider.absorb(jacket, rodPart(scene, shoulder, elbow, 0.11, 0.09));
      rider.absorb(jacket, rodPart(scene, elbow, grip, 0.09, 0.075));
      rider.absorb(mats.paint('#1b1d1f'), ballPart(scene, [0.09, 0.09, 0.11], grip));
      const hip: Xyz = [side * 0.11, 0.92, -0.26];
      const knee: Xyz = [side * 0.2, 0.74, 0.14];
      const foot: Xyz = [side * 0.21, 0.36, 0.0];
      rider.absorb(jeans, rodPart(scene, hip, knee, 0.15, 0.12));
      rider.absorb(jeans, rodPart(scene, knee, foot, 0.115, 0.095));
      rider.absorb(mats.paint('#1b1d1f'), boxPart(scene, [0.1, 0.08, 0.25], [side * 0.21, 0.32, 0.05]));
    }
    add(this.rider, rider, 'piloto');

    this.setRidden(withRider);
    this.syncVisuals(0, groundHeight, 1);
  }

  get isRidden(): boolean { return this.ridden; }

  setRidden(ridden: boolean): void {
    this.ridden = ridden;
    this.rider.setEnabled(ridden);
    this.stand.setEnabled(!ridden);
  }

  /** Advances the simulation (zero controls while parked) and updates the model. */
  update(dt: number, controls: MotoControls, guard: MotionGuard, groundHeight: number): void {
    stepMotorcycle(this.state, controls, dt, guard);
    this.syncVisuals(dt, groundHeight, 0);
  }

  private syncVisuals(dt: number, groundHeight: number, snap: number): void {
    const s = this.state;
    this.groundY = snap ? groundHeight : approach(this.groundY, groundHeight, 14, dt);
    this.root.position.set(s.x, this.groundY, s.z);
    this.root.rotation.y = s.yaw;
    const parked = !this.ridden && s.speed === 0;
    const targetLean = parked ? STAND_LEAN : s.lean;
    // Positive lean = to the right, which is a negative rotation around the forward axis.
    const current = -this.leanNode.rotation.z;
    this.leanNode.rotation.z = -(snap ? targetLean : approach(current, targetLean, 10, dt));
    const steerTarget = s.steer * 0.5 * (1 - Math.min(1, Math.abs(s.speed) / MOTO.maxSpeed) * 0.75);
    this.steering.rotation.y = snap ? steerTarget : approach(this.steering.rotation.y, steerTarget, 14, dt);
    for (const wheel of this.wheels) wheel.rotation.x += (s.speed * dt) / WHEEL_RADIUS;
  }
}
