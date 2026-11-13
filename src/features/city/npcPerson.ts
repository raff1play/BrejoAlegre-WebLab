import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { approach } from '../../core/math';
import { BatchSet } from '../../world/geometry';
import type { Materials } from '../../world/materials';
import { Character, RIDER_LOOK, carryingPose, standingPose, walkingPose, workingPose, type CharacterLook } from '../shared/character';

/**
 * CORE-014 articulated NPC (shop staff, depot staff, nearby passers-by): the same IK character as
 * the player (CORE-009/012 quality) with a civilian look. Presentation only; logic lives in core/.
 */
export type NpcActivity = 'idle' | 'work' | 'carry';

export type NpcLookInput = { shirt: string; trousers: string; skin: string; hair: string; cap?: string; apron?: string; vest?: string; longHair?: boolean; shoes?: string };

export function civilianLook(l: NpcLookInput): CharacterLook {
  return {
    ...RIDER_LOOK, jacket: l.shirt, vest: l.vest, trim: l.shirt, jeans: l.trousers, boots: l.shoes ?? '#2a2522', gloves: l.skin, skin: l.skin,
    headwear: l.cap ? 'cap' : 'hair', hair: l.hair, cap: l.cap, apron: l.apron, longHair: l.longHair,
  };
}

export class NpcPerson {
  readonly root: TransformNode;
  x = 0; z = 0; yaw = 0;
  activity: NpcActivity = 'idle';
  speed = 1.25;
  private target: { x: number; z: number } | null = null;
  private face: number | null = null;
  private readonly body: Character;
  private readonly box: Mesh;
  private phase = 0; private amount = 0; private time = Math.random() * 10;
  private enabled = true;

  constructor(scene: Scene, mats: Materials, name: string, look: CharacterLook, shadows?: ShadowGenerator) {
    this.body = new Character(scene, mats, name, look);
    this.root = this.body.root;
    const cargo = new BatchSet();
    cargo.box(mats.paint('#b88a55'), -0.2, 0.2, -0.15, 0.15, -0.16, 0.16);
    cargo.box(mats.paint('#d9c9a6'), -0.205, 0.205, -0.02, 0.02, -0.165, 0.165);
    this.box = cargo.build(`${name}-caixa`, scene, this.root)[0]!;
    this.box.position.set(0, 1.08, 0.36);
    this.box.isVisible = false;
    if (shadows) for (const m of [...this.body.meshes, this.box]) shadows.addShadowCaster(m, false);
  }

  get meshes() { return [...this.body.meshes, this.box]; }
  get moving(): boolean { return this.target !== null; }

  place(x: number, z: number, yaw: number): void { this.x = x; this.z = z; this.yaw = yaw; this.target = null; }
  walkTo(x: number, z: number): void {
    if (Math.hypot(x - this.x, z - this.z) < 0.05) { this.target = null; return; }
    this.target = { x, z };
  }
  lookAt(yaw: number | null): void { this.face = yaw; }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    this.root.setEnabled(on);
  }

  /** `near` false skips the IK pose update (far LOD: position only). */
  update(dt: number, groundY: number, near = true): void {
    this.time += dt;
    let moved = 0;
    if (this.target) {
      const dx = this.target.x - this.x; const dz = this.target.z - this.z;
      const d = Math.hypot(dx, dz);
      const step = Math.min(d, this.speed * dt);
      if (d < 0.03) this.target = null;
      else {
        this.x += (dx / d) * step; this.z += (dz / d) * step; moved = step;
        const want = Math.atan2(dx, dz);
        let diff = want - this.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.yaw += diff * Math.min(1, dt * 8);
      }
    } else if (this.face !== null) {
      let diff = this.face - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 5);
    }
    this.animate(dt, moved, groundY, near);
  }

  /** Mirrors an externally simulated walker (crowd pedestrian) at (x, z). */
  follow(x: number, z: number, yaw: number, dt: number, groundY: number): void {
    let moved = Math.hypot(x - this.x, z - this.z);
    if (moved > 2) moved = 0; // newly assigned: no stride from the old spot
    this.x = x; this.z = z; this.yaw = yaw; this.target = null;
    this.time += dt;
    this.animate(dt, moved, groundY, true);
  }

  private animate(dt: number, moved: number, groundY: number, near: boolean): void {
    this.phase += (moved / 1.5) * Math.PI * 2;
    this.amount = approach(this.amount, dt > 0 ? Math.min(1, moved / dt / 1.4) : 0, 8, dt);
    this.root.position.set(this.x, groundY, this.z);
    this.root.rotation.y = this.yaw;
    this.box.isVisible = this.activity === 'carry';
    if (!near) return;
    const pose = this.activity === 'carry' ? carryingPose(this.phase, this.amount, this.time)
      : this.activity === 'work' && this.amount < 0.2 ? workingPose(this.time)
        : this.amount > 0.02 ? walkingPose(this.phase, this.amount, this.time) : standingPose(this.time);
    this.body.apply(pose);
  }
}
