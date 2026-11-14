import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { MotionGuard } from '../../core/collision';
import { approach } from '../../core/math';
import { stepWalker, WALKER, type WalkControls, type WalkerState } from '../../core/walking';
import type { Materials } from '../../world/materials';
import { Character, RIDER_LOOK, carryingPose, walkingPose } from '../shared/character';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { BatchSet } from '../../world/geometry';

const STEP_OFF_TIME = 0.38;
/** Distance covered by one full gait cycle (two steps) at full speed. */
const CYCLE_LENGTH = 1.5;

/**
 * The rider on foot (helmet kept on). Presentation only: motion comes from core/walking; the walk
 * cycle advances with the distance actually covered, so it never slides when blocked by a wall.
 */
export class Pedestrian {
  readonly root: TransformNode;
  readonly state: WalkerState = { x: 0, z: 0, yaw: 0, moving: false };
  readonly meshes: AbstractMesh[];
  private readonly body: Character;
  private phase = 0;
  private amount = 0;
  private time = 0;
  private groundY = 0;
  /** Visual-only offset that eases to zero after stepping off the bike. */
  private from = { x: 0, y: 0, z: 0 };
  private transition = 1;
  /** CORE-014: parcels in the hands (between the shop counter and the bike, or at a gate). */
  carrying = false;
  private readonly parcel: Mesh;
  /** CORE-015.1: what is shown in the hands — up to three stacked boxes, or the mixed sack. */
  private readonly extra: Mesh[] = [];
  private readonly sack: Mesh;
  private load = { count: 0, sack: false };
  private shown = { count: 0, sack: false };
  /** Reaching into the top box (seconds left); the hands' content switches halfway. */
  private reach = 0;

  constructor(scene: Scene, mats: Materials, helmetColor: string) {
    this.body = new Character(scene, mats, 'pedestre', { ...RIDER_LOOK, helmet: helmetColor });
    this.root = this.body.root;
    const box = new BatchSet();
    box.box(mats.paint('#b88a55'), -0.2, 0.2, -0.14, 0.14, -0.15, 0.15);
    box.box(mats.paint('#d9c9a6'), -0.205, 0.205, -0.02, 0.02, -0.155, 0.155);
    this.parcel = box.build('pedestre-pacote', scene, this.root)[0]!;
    this.parcel.position.set(0, 1.08, 0.36);
    this.parcel.isVisible = false;
    for (const [i, c] of (['#c69a5f', '#d2ab73'] as const).entries()) {
      const b = new BatchSet();
      const w = 0.17 - i * 0.02;
      b.box(mats.paint(c), -w, w, -0.1, 0.1, -0.13, 0.13);
      b.box(mats.paint('#e9dcc0'), -w - 0.004, w + 0.004, -0.015, 0.015, -0.134, 0.134);
      const m = b.build(`pedestre-pacote-${i + 2}`, scene, this.root)[0]!;
      m.position.set(i ? 0.03 : -0.02, 1.08 + 0.14 + 0.1 + i * 0.2, 0.36);
      m.isVisible = false;
      this.extra.push(m);
    }
    const bag = new BatchSet();
    bag.box(mats.paint('#b9a57c', 0.02), -0.26, 0.26, -0.2, 0.2, -0.17, 0.17);
    bag.box(mats.paint('#a8946c', 0.02), -0.2, 0.2, 0.2, 0.3, -0.12, 0.12);
    bag.box(mats.paint('#1d4f9c', 0.1), -0.262, 0.262, -0.06, 0.06, -0.172, 0.172);
    this.sack = bag.build('pedestre-saca', scene, this.root)[0]!;
    this.sack.position.set(0, 1.04, 0.38);
    this.sack.isVisible = false;
    this.meshes = [...this.body.meshes, this.parcel, ...this.extra, this.sack];
    this.root.setEnabled(false);
  }

  /** What the rider holds: `count` loose volumes or the mixed sack. */
  setLoad(count: number, sack: boolean): void { this.load = { count, sack }; }
  /** Plays the short "reach into the top box" gesture. */
  reachTrunk(seconds = 0.55): void { this.reach = seconds; }
  get reaching(): boolean { return this.reach > 0; }

  /** Puts the character on the ground at a spot, facing `yaw`; `from` animates stepping off the seat. */
  place(x: number, z: number, yaw: number, groundHeight: number, from?: { x: number; y: number; z: number }): void {
    Object.assign(this.state, { x, z, yaw, moving: false });
    this.groundY = groundHeight;
    this.amount = 0;
    if (from) {
      this.from = { x: from.x - x, y: from.y - 0.95 - groundHeight, z: from.z - z };
      this.transition = 0;
    } else {
      this.transition = 1;
    }
    this.sync(0);
  }

  update(dt: number, controls: WalkControls, viewYaw: number, guard: MotionGuard, groundHeight: number): void {
    const x0 = this.state.x;
    const z0 = this.state.z;
    stepWalker(this.state, controls, viewYaw, dt, guard);
    const moved = Math.hypot(this.state.x - x0, this.state.z - z0);
    this.phase += (moved / CYCLE_LENGTH) * Math.PI * 2;
    const speed = dt > 0 ? moved / dt : 0;
    this.amount = approach(this.amount, Math.min(1, speed / WALKER.speed), 10, dt);
    this.groundY = approach(this.groundY, groundHeight, 16, dt);
    this.sync(dt);
  }

  private sync(dt: number): void {
    this.time += dt;
    if (this.transition < 1) this.transition = Math.min(1, this.transition + dt / STEP_OFF_TIME);
    const k = 1 - (1 - this.transition) * (1 - this.transition);
    const rest = 1 - k;
    const hop = Math.sin(this.transition * Math.PI) * 0.08;
    this.root.position.set(
      this.state.x + this.from.x * rest,
      this.groundY + this.from.y * rest + hop,
      this.state.z + this.from.z * rest,
    );
    this.root.rotation.y = this.state.yaw;
    // The content of the hands changes in the middle of the reach gesture, not at its start.
    this.reach = Math.max(0, this.reach - dt);
    if (this.reach < 0.28) this.shown = this.load;
    const holding = this.shown.count > 0;
    this.carrying = holding;
    const pose = holding || this.reach > 0 ? carryingPose(this.phase, this.amount, this.time) : walkingPose(this.phase, this.amount, this.time);
    if (this.reach > 0) {
      // Lean in and lower the hands into the box, then back.
      const k = Math.sin(Math.min(1, this.reach / 0.55) * Math.PI);
      pose.pitch += 0.3 * k;
      for (const hand of pose.hands) { hand.z += 0.2 * k; hand.y += 0.08 * k; }
    }
    this.parcel.isVisible = holding && !this.shown.sack;
    this.extra[0]!.isVisible = holding && !this.shown.sack && this.shown.count >= 2;
    this.extra[1]!.isVisible = holding && !this.shown.sack && this.shown.count >= 3;
    this.sack.isVisible = holding && this.shown.sack;
    if (rest > 0) {
      // Landing: knees absorb the step, arms come off the handlebar.
      pose.pelvis.y -= Math.sin(this.transition * Math.PI) * 0.12;
      pose.pitch += rest * 0.3;
      for (const hand of pose.hands) { hand.z += rest * 0.25; hand.y += rest * 0.2; }
    }
    this.body.apply(pose);
  }
}
