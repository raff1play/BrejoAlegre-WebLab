import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { MotionGuard } from '../../core/collision';
import { approach } from '../../core/math';
import { stepWalker, WALKER, type WalkControls, type WalkerState } from '../../core/walking';
import { BatchSet } from '../../world/geometry';
import type { Materials } from '../../world/materials';
import { ballPart, boxPart, rodPart } from '../shared/modelParts';

/** The rider on foot (helmet kept on). Presentation only: motion comes from core/walking. */
export class Pedestrian {
  readonly root: TransformNode;
  readonly state: WalkerState = { x: 0, z: 0, yaw: 0, moving: false };
  readonly meshes: AbstractMesh[] = [];
  private readonly legs: TransformNode[] = [];
  private readonly arms: TransformNode[] = [];
  private stride = 0;
  private swing = 0;
  private groundY = 0;

  constructor(scene: Scene, mats: Materials, helmetColor: string) {
    this.root = new TransformNode('pedestre', scene);
    const jacket = mats.paint('#2d5f8f', 0.1);
    const jeans = mats.paint('#2a3646', 0.05);
    const skin = mats.paint('#c69874', 0.08);
    const dark = mats.paint('#1b1d1f');
    const add = (parent: TransformNode, set: BatchSet, name: string) => this.meshes.push(...set.build(name, scene, parent));

    const body = new BatchSet();
    body.absorb(jacket, boxPart(scene, [0.4, 0.54, 0.23], [0, 1.17, 0]));
    body.absorb(jeans, boxPart(scene, [0.36, 0.16, 0.22], [0, 0.86, 0]));
    body.absorb(skin, rodPart(scene, [0, 1.42, 0], [0, 1.5, 0.01], 0.11));
    body.absorb(mats.paint(helmetColor, 0.6), ballPart(scene, [0.28, 0.29, 0.31], [0, 1.6, 0.01], 12));
    body.absorb(mats.paint('#15181b', 0.7), boxPart(scene, [0.2, 0.09, 0.05], [0, 1.6, 0.155]));
    add(this.root, body, 'pedestre-corpo');

    for (const side of [-1, 1]) {
      const leg = new TransformNode('perna', scene);
      leg.parent = this.root;
      leg.position.set(side * 0.1, 0.86, 0);
      const legSet = new BatchSet();
      legSet.absorb(jeans, rodPart(scene, [0, 0, 0], [0, -0.78, 0], 0.16, 0.11));
      legSet.absorb(dark, boxPart(scene, [0.1, 0.08, 0.26], [0, -0.82, 0.05]));
      add(leg, legSet, 'perna');
      this.legs.push(leg);

      const arm = new TransformNode('braco', scene);
      arm.parent = this.root;
      arm.position.set(side * 0.25, 1.4, 0);
      const armSet = new BatchSet();
      armSet.absorb(jacket, rodPart(scene, [0, 0, 0], [0, -0.56, 0], 0.11, 0.08));
      armSet.absorb(skin, ballPart(scene, [0.08, 0.1, 0.08], [0, -0.6, 0]));
      add(arm, armSet, 'braco');
      this.arms.push(arm);
    }
    this.root.setEnabled(false);
  }

  /** Puts the character on the ground at a spot, facing `yaw`. */
  place(x: number, z: number, yaw: number, groundHeight: number): void {
    Object.assign(this.state, { x, z, yaw, moving: false });
    this.groundY = groundHeight;
    this.swing = 0;
    this.sync();
  }

  update(dt: number, controls: WalkControls, viewYaw: number, guard: MotionGuard, groundHeight: number): void {
    stepWalker(this.state, controls, viewYaw, dt, guard);
    this.groundY = approach(this.groundY, groundHeight, 16, dt);
    this.swing = approach(this.swing, this.state.moving ? 1 : 0, 10, dt);
    if (this.state.moving) this.stride += dt * WALKER.speed * 3.1;
    this.sync();
  }

  private sync(): void {
    this.root.position.set(this.state.x, this.groundY + Math.abs(Math.sin(this.stride)) * 0.03 * this.swing, this.state.z);
    this.root.rotation.y = this.state.yaw;
    const angle = Math.sin(this.stride) * 0.62 * this.swing;
    this.legs[0]!.rotation.x = angle;
    this.legs[1]!.rotation.x = -angle;
    this.arms[0]!.rotation.x = -angle * 0.8;
    this.arms[1]!.rotation.x = angle * 0.8;
  }
}
