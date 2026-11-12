import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { RigidSkin } from '../shared/rigidSkin';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { MotionGuard } from '../../core/collision';
import { approach, clamp } from '../../core/math';
import { MOTO, createMotoState, stepMotorcycle, type MotoControls, type MotoState } from '../../core/motorcyclePhysics';
import { BatchSet } from '../../world/geometry';
import type { LabMaterial, Materials } from '../../world/materials';
import { Character, RIDER_LOOK, type Pose } from '../shared/character';
import { ballPart, boxPart, discPart, ringPart, rodPart, tyrePart, type Xyz } from '../../world/modelParts';

/** Outer tyre radius (18" rim class). The simulation does not depend on it. */
const WHEEL_RADIUS = 0.31;
const AXLE = MOTO.wheelbase / 2;
/** Lean of the parked bike resting on its side stand (to the left). */
const STAND_LEAN = -0.13;
/** Lean while stopped with the rider's left foot down. */
const FOOT_LEAN = -0.05;
const MOUNT_TIME = 0.42;

export type MotorcycleLook = { paint: string; box: string; helmet: string; stripe?: string };
/** CORE-010 livery from the references: yellow bike and top box with black accents. */
export const PLAYER_LOOK: MotorcycleLook = { paint: '#ffcd16', box: '#ffcb12', helmet: '#26282c', stripe: '#16181a' };

export type MotorcycleOptions = { withRider?: boolean; static?: boolean };

/** Grip points in the upper-steering node space (x side, y up, z towards the front axle). */
const GRIP: Xyz = [0.36, 1.1, -0.36];
const PEG: Xyz = [0.21, 0.355, -0.03];

/**
 * Utility 150–160 cc style delivery motorcycle with a top box, built procedurally from primitives
 * merged per material and node. Presentation only: position, heading, speed, steering and lean
 * come from core/motorcyclePhysics; this class just reads them (suspension and rider animation
 * are visual reactions to that state).
 */
export class Motorcycle {
  readonly root: TransformNode;
  readonly state: MotoState;
  readonly meshes: AbstractMesh[] = [];
  private readonly leanNode: TransformNode;
  private readonly chassis: TransformNode;
  private readonly lowerSteer: TransformNode;
  private readonly upperSteer: TransformNode;
  private readonly wheels: TransformNode[] = [];
  private readonly stand: TransformNode;
  private readonly rider: Character | null;
  private ridden: boolean;
  private groundY = 0;
  private time = 0;
  // Visual suspension and rider state.
  private lastSpeed = 0;
  private accel = 0;
  private pitch = 0;
  private heave = 0;
  private heaveVelocity = 0;
  private lastGroundVelocity = 0;
  private footDown = 1;
  private mount = 1;
  private mountSide: -1 | 1 = -1;

  constructor(
    scene: Scene, mats: Materials, look: MotorcycleLook, x: number, z: number, yaw: number, groundHeight: number,
    options: MotorcycleOptions = {},
  ) {
    const withRider = options.withRider ?? true;
    this.state = createMotoState(x, z, yaw);
    this.root = new TransformNode('moto', scene);
    this.leanNode = this.child(scene, 'moto-inclinacao', this.root);
    this.chassis = this.child(scene, 'moto-chassi', this.leanNode);
    this.lowerSteer = this.child(scene, 'moto-garfo', this.leanNode);
    this.lowerSteer.position.set(0, 0, AXLE);
    this.upperSteer = this.child(scene, 'moto-guidao', this.chassis);
    this.upperSteer.position.set(0, 0, AXLE);
    this.stand = this.child(scene, 'moto-descanso', this.leanNode);

    const paint = mats.lacquer(look.paint);
    const parts = {
      paint,
      frame: mats.lacquer('#1b1d20'),
      plastic: mats.paint('#202225', 0.2),
      rubber: mats.paint('#151617'),
      seat: mats.paint('#19191a'),
      chrome: mats.chrome(),
      alloy: mats.chrome('#8e9398'),
      engine: mats.lacquer('#4b4f54'),
      white: mats.lacquer(look.stripe ?? '#ecebe6'),
      box: mats.lacquer(look.box),
    };
    // Moving parts are collected first: the player bike is merged with rigid GPU skinning (one mesh
    // per material), the static decoy bike is baked and merged instead.
    const pieces: { node: TransformNode; set: BatchSet; name: string }[] = [];
    const add = (node: TransformNode, set: BatchSet, name: string) => pieces.push({ node, set, name });

    for (const [name, front] of [['roda-traseira', false], ['roda-dianteira', true]] as const) {
      const wheel = this.child(scene, name, front ? this.lowerSteer : this.leanNode);
      wheel.position.set(0, WHEEL_RADIUS, front ? 0 : -AXLE);
      add(wheel, this.buildWheel(scene, mats, parts, front), name);
      this.wheels.push(wheel);
    }
    add(this.lowerSteer, this.buildLowerFork(scene, parts), 'moto-garfo');
    add(this.upperSteer, this.buildFrontEnd(scene, mats, parts), 'moto-frente');
    add(this.leanNode, this.buildSwingarm(scene, parts), 'moto-balanca');
    add(this.chassis, this.buildChassis(scene, mats, parts), 'moto-chassi');

    const stand = new BatchSet();
    stand.absorb(parts.frame, rodPart(scene, [-0.1, 0.33, -0.1], [-0.28, 0.015, -0.18], 0.028));
    stand.absorb(parts.frame, boxPart(scene, [0.05, 0.02, 0.07], [-0.28, 0.012, -0.18]));
    add(this.stand, stand, 'moto-descanso');

    if (options.static) {
      for (const piece of pieces) this.meshes.push(...piece.set.build(piece.name, scene, piece.node));
    } else {
      const skin = new RigidSkin(scene, 'moto', this.root);
      for (const piece of pieces) skin.add(piece.node, piece.set);
      this.meshes.push(...skin.build({ min: new Vector3(-0.9, -0.2, -1.4), max: new Vector3(0.9, 1.7, 1.2) }));
    }

    this.ridden = withRider;
    this.rider = withRider ? new Character(scene, mats, 'piloto', { ...RIDER_LOOK, helmet: look.helmet }) : null;
    if (this.rider) {
      this.rider.root.parent = this.chassis;
      this.meshes.push(...this.rider.meshes);
    }
    this.setRidden(withRider);
    this.footDown = withRider ? 1 : 0;
    this.groundY = groundHeight;
    this.syncVisuals(0, groundHeight);
    if (options.static) this.freeze();
  }

  get isRidden(): boolean { return this.ridden; }

  /** `fromSide` (-1 left, 1 right) animates the rider swinging on from that side. */
  setRidden(ridden: boolean, fromSide?: -1 | 1): void {
    this.ridden = ridden;
    this.rider?.root.setEnabled(ridden);
    // The stand is part of the skinned mesh: hide it by collapsing its bone.
    this.stand.scaling.setAll(ridden ? 0 : 1);
    if (ridden && fromSide !== undefined) {
      this.mount = 0;
      this.mountSide = fromSide;
      this.footDown = 1;
    } else {
      this.mount = 1;
    }
  }

  /** World position of the seat, where a dismounting rider starts from. */
  seatPosition(): { x: number; y: number; z: number } {
    const s = this.state;
    return { x: s.x - Math.sin(s.yaw) * 0.22, y: this.groundY + 0.95, z: s.z - Math.cos(s.yaw) * 0.22 };
  }

  /** Advances the simulation (zero controls while parked) and updates the model. */
  update(dt: number, controls: MotoControls, guard: MotionGuard, groundHeight: number): void {
    stepMotorcycle(this.state, controls, dt, guard);
    this.syncVisuals(dt, groundHeight);
  }

  private child(scene: Scene, name: string, parent: TransformNode): TransformNode {
    const node = new TransformNode(name, scene);
    node.parent = parent;
    return node;
  }

  private syncVisuals(dt: number, groundHeight: number): void {
    const s = this.state;
    this.time += dt;
    const previousGround = this.groundY;
    this.groundY = dt > 0 ? approach(this.groundY, groundHeight, 14, dt) : groundHeight;
    this.root.position.set(s.x, this.groundY, s.z);
    this.root.rotation.y = s.yaw;

    if (dt > 0) {
      // Suspension: pitch follows filtered longitudinal acceleration (dive when braking, squat when
      // accelerating); heave is a damped spring excited by vertical motion such as the kerb.
      this.accel = approach(this.accel, (s.speed - this.lastSpeed) / dt, 10, dt);
      const groundVelocity = (this.groundY - previousGround) / dt;
      const verticalAccel = (groundVelocity - this.lastGroundVelocity) / dt;
      this.lastGroundVelocity = groundVelocity;
      this.heaveVelocity += (-190 * this.heave - 17 * this.heaveVelocity - clamp(verticalAccel, -60, 60) * 0.5) * dt;
      this.heave = clamp(this.heave + this.heaveVelocity * dt, -0.05, 0.05);
      this.pitch = approach(this.pitch, clamp(-this.accel * 0.006, -0.035, 0.05), 8, dt);
    }
    this.lastSpeed = s.speed;
    const idle = this.ridden && s.speed === 0 ? Math.sin(this.time * 52) * 0.0012 : 0;
    this.chassis.position.y = this.heave - Math.abs(this.pitch) * 0.12 + idle;
    this.chassis.rotation.x = this.pitch;

    const stopped = Math.abs(s.speed) < 0.6;
    this.footDown = dt > 0 ? approach(this.footDown, this.ridden && stopped ? 1 : 0, 7, dt) : this.footDown;
    if (this.mount < 1) this.mount = Math.min(1, this.mount + dt / MOUNT_TIME);
    const parked = !this.ridden && s.speed === 0;
    const targetLean = parked ? STAND_LEAN : s.lean + FOOT_LEAN * this.footDown;
    // Positive lean = to the right, which is a negative rotation around the forward axis.
    const current = -this.leanNode.rotation.z;
    this.leanNode.rotation.z = -(dt > 0 ? approach(current, targetLean, 10, dt) : targetLean);

    const steerTarget = s.steer * 0.5 * (1 - Math.min(1, Math.abs(s.speed) / MOTO.maxSpeed) * 0.75);
    const steer = dt > 0 ? approach(this.lowerSteer.rotation.y, steerTarget, 14, dt) : steerTarget;
    this.lowerSteer.rotation.y = steer;
    this.upperSteer.rotation.y = steer;
    for (const wheel of this.wheels) wheel.rotation.x += (s.speed * dt) / WHEEL_RADIUS;
    if (this.rider && this.ridden) this.rider.apply(this.ridingPose(steer));
  }

  /** Rider pose in chassis space: hands on the grips, feet on the pegs or the left foot down. */
  private ridingPose(steer: number): Pose {
    const s = this.state;
    const grip = (side: -1 | 1) => {
      const [gx, gy, gz] = [side * GRIP[0], GRIP[1], GRIP[2]];
      const c = Math.cos(steer);
      const n = Math.sin(steer);
      return { x: gx * c + gz * n, y: gy, z: AXLE - gx * n + gz * c };
    };
    const lean = clamp(this.accel * 0.012, -0.06, 0.08);
    const k = this.mount * this.mount * (3 - 2 * this.mount);
    const arc = Math.sin(this.mount * Math.PI);
    const side = this.mountSide;
    const pelvis = { x: side * 0.5 * (1 - k), y: 1.0 - 0.3 * (1 - k) + arc * 0.1, z: -0.22 - 0.1 * (1 - k) };
    const footDown = Math.max(this.footDown, 1 - k);
    const peg = (i: 0 | 1) => ({ x: (i === 0 ? -1 : 1) * PEG[0], y: PEG[1], z: PEG[2] });
    const ground = { x: -0.4, y: 0.03, z: -0.08 };
    const left = peg(0);
    const feet: Pose['feet'] = [
      { x: left.x + (ground.x - left.x) * footDown, y: left.y + (ground.y - left.y) * footDown, z: left.z + (ground.z - left.z) * footDown },
      peg(1),
    ];
    if (k < 1) {
      // Swinging the far leg over the seat while getting on.
      const far = side === -1 ? 1 : 0;
      feet[far] = { x: (far === 0 ? -1 : 1) * (0.25 + 0.35 * (1 - k)), y: PEG[1] + arc * 0.75, z: -0.4 + 0.37 * k };
    }
    return {
      pelvis,
      pitch: 0.42 + lean - 0.25 * (1 - k), yaw: steer * 0.35, roll: s.lean * 0.25,
      headYaw: steer * 0.5, headPitch: 0.05,
      hands: k < 0.6 ? [grip(-1), grip(1)].map((g) => ({ x: g.x * 0.8, y: g.y - 0.15, z: g.z - 0.3 })) as Pose['hands'] : [grip(-1), grip(1)],
      feet,
      elbowPoles: [{ x: -0.8, y: 0.9, z: -0.4 }, { x: 0.8, y: 0.9, z: -0.4 }],
      kneePoles: [{ x: -0.5 - footDown * 0.4, y: 0.9, z: 1.2 }, { x: 0.5, y: 0.9, z: 1.2 }],
      footYaw: [-0.15 - footDown * 0.2, 0.15], footPitch: [0.15 * (1 - footDown), 0.15],
    };
  }

  /** Static props (the parked decoy bike) are merged into one mesh per material. */
  private freeze(): void {
    const groups = new Map<unknown, Mesh[]>();
    for (const mesh of this.meshes) {
      if (!(mesh instanceof Mesh) || !mesh.isEnabled()) continue;
      mesh.computeWorldMatrix(true);
      const list = groups.get(mesh.material) ?? [];
      list.push(mesh);
      groups.set(mesh.material, list);
    }
    const merged: AbstractMesh[] = [];
    for (const list of groups.values()) {
      const mesh = list.length > 1 ? Mesh.MergeMeshes(list, true, true) : list[0]!;
      if (!mesh) continue;
      if (mesh.parent) mesh.setParent(null);
      mesh.receiveShadows = true;
      mesh.isPickable = false;
      mesh.freezeWorldMatrix();
      merged.push(mesh);
    }
    for (const mesh of this.meshes) if (!mesh.isDisposed() && !merged.includes(mesh)) mesh.dispose();
    this.meshes.length = 0;
    this.meshes.push(...merged);
  }

  private buildWheel(scene: Scene, mats: Materials, p: Parts, front: boolean): BatchSet {
    const set = new BatchSet();
    set.absorb(p.rubber, tyrePart(scene, WHEEL_RADIUS, 0.1));
    // Tread blocks: a ring of small bumps reads as a real tyre when it spins.
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      set.absorb(p.rubber, boxPart(scene, [0.085, 0.026, 0.05], [0, Math.cos(a) * (WHEEL_RADIUS - 0.006), Math.sin(a) * (WHEEL_RADIUS - 0.006)], [a, 0, 0]));
    }
    set.absorb(p.frame, ringPart(scene, 0.212, 0.04, [0, 0, 0], 'x', 18));
    set.absorb(p.chrome, ringPart(scene, 0.232, 0.012, [0.022, 0, 0], 'x', 18));
    set.absorb(p.chrome, ringPart(scene, 0.232, 0.012, [-0.022, 0, 0], 'x', 18));
    // Five-spoke cast wheel.
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      set.absorb(p.frame, boxPart(scene, [0.028, 0.16, 0.034], [0, Math.cos(a) * 0.12, Math.sin(a) * 0.12], [a, 0, 0]));
    }
    set.absorb(p.alloy, discPart(scene, 0.1, 0.14, [0, 0, 0], 12));
    if (front) {
      set.absorb(p.chrome, discPart(scene, 0.24, 0.008, [0.07, 0, 0], 20));
      set.absorb(p.frame, discPart(scene, 0.09, 0.012, [0.072, 0, 0], 10));
    } else {
      set.absorb(p.alloy, discPart(scene, 0.17, 0.08, [0.06, 0, 0], 16));
      set.absorb(mats.paint('#2a2b2d', 0.3), discPart(scene, 0.2, 0.012, [-0.08, 0, 0], 20));
    }
    return set;
  }

  /** Fork sliders, front mudguard and brake caliper: turn with the steering, do not pitch. */
  private buildLowerFork(scene: Scene, p: Parts): BatchSet {
    const set = new BatchSet();
    for (const side of [-1, 1]) {
      set.absorb(p.alloy, rodPart(scene, [side * 0.088, WHEEL_RADIUS - 0.03, 0.01], [side * 0.088, 0.66, -0.095], 0.058, 0.054, 10));
      set.absorb(p.alloy, ballPart(scene, [0.06, 0.06, 0.06], [side * 0.088, WHEEL_RADIUS - 0.03, 0.01], 4));
    }
    set.absorb(p.frame, boxPart(scene, [0.03, 0.09, 0.07], [0.088, WHEEL_RADIUS + 0.08, -0.03]));
    this.mudguard(scene, set, p.paint, 0, WHEEL_RADIUS, 0, 0.6, 2.35, 4);
    return set;
  }

  private mudguard(scene: Scene, set: BatchSet, material: LabMaterial, x: number, cy: number, cz: number, from: number, to: number, segments: number): void {
    const r = WHEEL_RADIUS + 0.045;
    for (let i = 0; i < segments; i++) {
      const t = from + ((i + 0.5) / segments) * (to - from);
      const length = r * ((to - from) / segments) + 0.01;
      set.absorb(material, boxPart(scene, [0.13, 0.012, length], [x, cy + Math.sin(t) * r, cz + Math.cos(t) * r], [Math.PI / 2 - t, 0, 0]));
    }
  }

  /** Fork tubes, headlight, cowl, dashboard, handlebar, levers, mirrors and front indicators. */
  private buildFrontEnd(scene: Scene, mats: Materials, p: Parts): BatchSet {
    const set = new BatchSet();
    for (const side of [-1, 1]) set.absorb(p.frame, rodPart(scene, [side * 0.088, 0.6, -0.078], [side * 0.088, 1.0, -0.19], 0.05, 0.05, 10));
    set.absorb(p.frame, boxPart(scene, [0.27, 0.05, 0.09], [0, 0.82, -0.14], [-0.27, 0, 0]));
    set.absorb(p.alloy, boxPart(scene, [0.26, 0.035, 0.1], [0, 1.0, -0.19], [-0.27, 0, 0]));
    // Round headlight with chrome bezel under a small painted cowl.
    set.absorb(p.frame, rodPart(scene, [0, 0.88, -0.12], [0, 0.885, 0.01], 0.2, 0.19, 16));
    set.absorb(p.chrome, ringPart(scene, 0.093, 0.022, [0, 0.885, 0.018], 'z', 16));
    set.absorb(mats.glow('#fff4d2'), rodPart(scene, [0, 0.885, 0.0], [0, 0.885, 0.024], 0.168, 0.168, 16));
    set.absorb(p.paint, boxPart(scene, [0.25, 0.03, 0.2], [0, 0.995, -0.04], [-0.2, 0, 0]));
    set.absorb(p.paint, boxPart(scene, [0.03, 0.15, 0.17], [-0.125, 0.93, -0.05], [-0.2, 0, 0]));
    set.absorb(p.paint, boxPart(scene, [0.03, 0.15, 0.17], [0.125, 0.93, -0.05], [-0.2, 0, 0]));
    // Instrument cluster.
    set.absorb(p.plastic, boxPart(scene, [0.22, 0.09, 0.09], [0, 1.065, -0.17], [-0.6, 0, 0]));
    set.absorb(mats.glow('#cfe9ff'), boxPart(scene, [0.15, 0.004, 0.05], [0, 1.1, -0.17], [-0.6, 0, 0]));
    // Handlebar with a slight rise and pull-back, rubber grips and levers.
    set.absorb(p.frame, rodPart(scene, [-0.2, 1.08, -0.24], [0.2, 1.08, -0.24], 0.03, 0.03, 8));
    for (const side of [-1, 1]) {
      set.absorb(p.frame, rodPart(scene, [side * 0.2, 1.08, -0.24], [side * GRIP[0] * 0.86, GRIP[1] - 0.006, GRIP[2] + 0.04], 0.03, 0.03, 8));
      set.absorb(p.rubber, rodPart(scene, [side * 0.29, GRIP[1] - 0.008, GRIP[2] + 0.06], [side * 0.41, GRIP[1] + 0.004, GRIP[2] - 0.02], 0.043, 0.043, 8));
      set.absorb(p.alloy, rodPart(scene, [side * 0.27, GRIP[1] + 0.01, GRIP[2] + 0.1], [side * 0.39, GRIP[1] + 0.01, GRIP[2] + 0.03], 0.014));
      set.absorb(p.frame, boxPart(scene, [0.06, 0.05, 0.05], [side * 0.26, GRIP[1], GRIP[2] + 0.06]));
      // Mirror on a thin stem.
      set.absorb(p.chrome, rodPart(scene, [side * 0.24, 1.09, -0.25], [side * 0.31, 1.33, -0.27], 0.014));
      set.absorb(p.frame, rodPart(scene, [side * 0.31, 1.34, -0.26], [side * 0.31, 1.34, -0.3], 0.12, 0.11, 14));
      set.absorb(p.chrome, rodPart(scene, [side * 0.31, 1.34, -0.3], [side * 0.31, 1.34, -0.305], 0.1, 0.1, 14));
      // Front indicators.
      set.absorb(p.frame, rodPart(scene, [side * 0.1, 0.92, -0.08], [side * 0.19, 0.93, -0.07], 0.018));
      set.absorb(mats.glow('#f29a1e'), rodPart(scene, [side * 0.2, 0.93, -0.095], [side * 0.2, 0.93, -0.03], 0.05, 0.06, 8));
    }
    return set;
  }

  private buildSwingarm(scene: Scene, p: Parts): BatchSet {
    const set = new BatchSet();
    for (const side of [-1, 1]) {
      set.absorb(p.frame, rodPart(scene, [side * 0.1, 0.38, -0.13], [side * 0.105, WHEEL_RADIUS, -AXLE], 0.05, 0.04, 8));
      set.absorb(p.alloy, discPart(scene, 0.05, 0.03, [side * 0.12, WHEEL_RADIUS, -AXLE], 8));
    }
    set.absorb(p.frame, rodPart(scene, [-0.1, 0.36, -0.3], [0.1, 0.36, -0.3], 0.035));
    return set;
  }

  /** Frame, engine, exhaust, tank, seat, tail, rack and top box: everything the suspension carries. */
  private buildChassis(scene: Scene, mats: Materials, p: Parts): BatchSet {
    const set = new BatchSet();
    // Frame: steering head, backbone, down tube and seat rails.
    set.absorb(p.frame, rodPart(scene, [0, 0.84, 0.5], [0, 1.0, 0.455], 0.075, 0.075, 10));
    set.absorb(p.frame, rodPart(scene, [0, 0.95, 0.46], [0, 0.76, -0.15], 0.06));
    set.absorb(p.frame, rodPart(scene, [0, 0.88, 0.48], [0, 0.42, 0.3], 0.055));
    set.absorb(p.frame, rodPart(scene, [0, 0.76, -0.15], [0, 0.4, -0.14], 0.055));
    for (const side of [-1, 1]) set.absorb(p.frame, rodPart(scene, [side * 0.1, 0.76, -0.12], [side * 0.11, 0.86, -0.78], 0.032));

    // Single-cylinder air-cooled engine, inclined forward, with cooling fins.
    set.absorb(p.engine, rodPart(scene, [-0.15, 0.37, 0.04], [0.15, 0.37, 0.04], 0.3, 0.3, 16));
    set.absorb(p.engine, boxPart(scene, [0.26, 0.13, 0.36], [0, 0.27, 0.04]));
    set.absorb(p.alloy, discPart(scene, 0.23, 0.05, [0.165, 0.38, 0.09], 16));
    set.absorb(p.engine, discPart(scene, 0.2, 0.05, [-0.165, 0.38, 0.03], 16));
    const tilt = 0.35;
    const axis = (t: number): Xyz => [0, 0.48 + t * Math.cos(tilt), 0.15 + t * Math.sin(tilt)];
    set.absorb(p.engine, rodPart(scene, axis(0), axis(0.28), 0.15, 0.15, 12));
    for (let i = 0; i < 6; i++) {
      set.absorb(p.alloy, boxPart(scene, [0.25, 0.013, 0.2], axis(0.05 + i * 0.038), [tilt, 0, 0]));
    }
    set.absorb(p.alloy, boxPart(scene, [0.22, 0.09, 0.19], axis(0.3), [tilt, 0, 0]));
    set.absorb(p.frame, boxPart(scene, [0.16, 0.05, 0.13], axis(0.36), [tilt, 0, 0]));
    // Carburettor and air box under the seat.
    set.absorb(p.alloy, rodPart(scene, [0, 0.6, 0.0], [0, 0.6, -0.13], 0.08, 0.07, 10));
    set.absorb(p.plastic, boxPart(scene, [0.22, 0.17, 0.2], [0, 0.62, -0.24]));

    // Exhaust: header from the cylinder head, under the engine, to a chrome muffler with heat shield.
    const header: Xyz[] = [[0.03, 0.71, 0.33], [0.09, 0.55, 0.38], [0.13, 0.31, 0.31], [0.16, 0.22, 0.06], [0.19, 0.29, -0.3]];
    for (let i = 0; i < header.length - 1; i++) {
      set.absorb(p.chrome, rodPart(scene, header[i]!, header[i + 1]!, 0.046, 0.046, 10));
      set.absorb(p.chrome, ballPart(scene, [0.047, 0.047, 0.047], header[i + 1]!, 4));
    }
    set.absorb(p.chrome, rodPart(scene, [0.19, 0.3, -0.27], [0.205, 0.42, -0.9], 0.12, 0.1, 14));
    set.absorb(p.frame, ringPart(scene, 0.047, 0.016, [0.205, 0.42, -0.9], 'z', 12));
    set.absorb(p.frame, boxPart(scene, [0.016, 0.085, 0.36], [0.27, 0.37, -0.52], [-0.18, 0, 0]));

    // Chain, sprockets and chain guard on the left.
    set.absorb(p.frame, rodPart(scene, [-0.11, 0.42, 0.02], [-0.11, 0.405, -AXLE], 0.02, 0.02, 6));
    set.absorb(p.frame, rodPart(scene, [-0.11, 0.3, 0.02], [-0.11, 0.215, -AXLE], 0.02, 0.02, 6));
    set.absorb(p.plastic, boxPart(scene, [0.02, 0.05, 0.56], [-0.135, 0.44, -0.33], [0.02, 0, 0]));

    // Fuel tank: lacquered teardrop with a white side stripe and chrome cap.
    const tank = ballPart(scene, [0.35, 0.25, 0.6], [0, 0.89, 0.2], 10);
    tank.rotation.x = -0.12;
    set.absorb(p.paint, tank);
    const stripe = ballPart(scene, [0.356, 0.045, 0.5], [0, 0.865, 0.2], 8);
    stripe.rotation.x = -0.12;
    set.absorb(p.white, stripe);
    set.absorb(p.chrome, rodPart(scene, [0, 1.0, 0.17], [0, 1.017, 0.17], 0.075, 0.07, 12));
    for (const side of [-1, 1]) set.absorb(p.paint, boxPart(scene, [0.03, 0.14, 0.18], [side * 0.15, 0.78, 0.4], [-0.3, 0, 0]));

    // Long dual seat with rounded ends.
    set.absorb(p.seat, boxPart(scene, [0.27, 0.085, 0.6], [0, 0.865, -0.37]));
    set.absorb(p.seat, ballPart(scene, [0.27, 0.11, 0.2], [0, 0.865, -0.07], 6));
    set.absorb(p.seat, ballPart(scene, [0.25, 0.1, 0.14], [0, 0.865, -0.67], 6));
    set.absorb(mats.paint('#5a5c60'), boxPart(scene, [0.275, 0.012, 0.62], [0, 0.825, -0.37]));
    // Side covers and tail.
    set.absorb(p.paint, boxPart(scene, [0.3, 0.17, 0.27], [0, 0.69, -0.32], [0.08, 0, 0]));
    for (const side of [-1, 1]) set.absorb(p.white, boxPart(scene, [0.004, 0.025, 0.18], [side * 0.152, 0.72, -0.32], [0.08, 0, 0]));
    set.absorb(p.plastic, boxPart(scene, [0.2, 0.05, 0.36], [0, 0.79, -0.88], [-0.22, 0, 0]));
    set.absorb(p.alloy, boxPart(scene, [0.15, 0.08, 0.06], [0, 0.76, -1.06]));
    set.absorb(mats.glow('#d11b1b'), boxPart(scene, [0.13, 0.06, 0.012], [0, 0.76, -1.093]));
    // Rear mudguard and Mercosur-style plate (blank, no real registration).
    this.mudguard(scene, set, p.plastic, 0, WHEEL_RADIUS, -AXLE, 1.75, 2.75, 4);
    set.absorb(p.frame, rodPart(scene, [0, 0.74, -1.04], [0, 0.66, -1.07], 0.02));
    set.absorb(mats.paint('#f2f2ee', 0.3), boxPart(scene, [0.2, 0.135, 0.008], [0, 0.6, -1.08], [-0.15, 0, 0]));
    set.absorb(mats.paint('#1d4f9c', 0.3), boxPart(scene, [0.2, 0.03, 0.01], [0, 0.657, -1.072], [-0.15, 0, 0]));
    for (const side of [-1, 1]) {
      set.absorb(p.frame, rodPart(scene, [side * 0.05, 0.72, -1.03], [side * 0.17, 0.72, -1.03], 0.018));
      set.absorb(mats.glow('#f29a1e'), rodPart(scene, [side * 0.18, 0.72, -1.0], [side * 0.18, 0.72, -1.065], 0.045, 0.055, 8));
      // Twin rear shocks with red springs.
      const bottom: Xyz = [side * 0.125, 0.36, -0.6];
      const top: Xyz = [side * 0.125, 0.85, -0.5];
      set.absorb(p.chrome, rodPart(scene, bottom, top, 0.026));
      set.absorb(p.frame, rodPart(scene, bottom, [side * 0.125, 0.47, -0.578], 0.05));
      set.absorb(p.frame, rodPart(scene, [side * 0.125, 0.78, -0.514], top, 0.05));
      for (let i = 0; i < 6; i++) {
        const f = 0.27 + i * 0.085;
        const ring = ringPart(scene, 0.03, 0.012, [side * 0.125, 0.36 + f * 0.49, -0.6 + f * 0.1], 'y', 8);
        ring.rotation.x = 0.2;
        set.absorb(p.paint, ring);
      }
      // Foot pegs, passenger pegs.
      set.absorb(p.rubber, rodPart(scene, [side * 0.12, PEG[1] - 0.02, PEG[2]], [side * 0.25, PEG[1] - 0.02, PEG[2] - 0.02], 0.035));
      set.absorb(p.rubber, rodPart(scene, [side * 0.13, 0.43, -0.52], [side * 0.23, 0.43, -0.54], 0.03));
    }
    set.absorb(p.alloy, boxPart(scene, [0.02, 0.02, 0.2], [0.22, 0.31, 0.1], [0.3, 0, 0]));
    set.absorb(p.alloy, boxPart(scene, [0.02, 0.02, 0.16], [-0.22, 0.36, 0.1], [-0.2, 0, 0]));

    // Cargo rack and delivery top box with rounded vertical edges, reflective strips and latch.
    for (const side of [-1, 1]) {
      set.absorb(p.frame, rodPart(scene, [side * 0.17, 0.9, -0.52], [side * 0.17, 0.92, -1.06], 0.025));
      set.absorb(p.frame, rodPart(scene, [side * 0.17, 0.9, -0.62], [side * 0.11, 0.8, -0.6], 0.022));
      set.absorb(p.frame, rodPart(scene, [side * 0.17, 0.92, -1.0], [side * 0.1, 0.78, -0.98], 0.022));
    }
    for (const z of [-0.55, -1.05]) set.absorb(p.frame, rodPart(scene, [-0.17, 0.915, z], [0.17, 0.915, z], 0.022));
    const bz = -0.8;
    const [hw, hd, y0, y1] = [0.23, 0.22, 0.95, 1.27];
    set.absorb(p.plastic, boxPart(scene, [0.44, 0.03, 0.42], [0, 0.935, bz]));
    set.absorb(p.box, boxPart(scene, [hw * 2, y1 - y0, hd * 2 - 0.08], [0, (y0 + y1) / 2, bz]));
    set.absorb(p.box, boxPart(scene, [hw * 2 - 0.08, y1 - y0, hd * 2], [0, (y0 + y1) / 2, bz]));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      set.absorb(p.box, rodPart(scene, [sx * (hw - 0.04), y0, bz + sz * (hd - 0.04)], [sx * (hw - 0.04), y1, bz + sz * (hd - 0.04)], 0.08, 0.08, 10));
    }
    set.absorb(p.box, boxPart(scene, [hw * 2 + 0.02, 0.07, hd * 2 + 0.02], [0, y1 + 0.02, bz]));
    set.absorb(mats.paint('#0f1011', 0.2), boxPart(scene, [hw * 2 + 0.025, 0.012, hd * 2 + 0.025], [0, y1 - 0.015, bz]));
    set.absorb(mats.glow('#c9281e'), boxPart(scene, [0.34, 0.035, 0.006], [0, 1.05, bz - hd - 0.003]));
    // Black band around the top box (livery).
    set.absorb(p.white, boxPart(scene, [hw * 2 + 0.012, 0.06, hd * 2 + 0.012], [0, 1.15, bz]));
    for (const sx of [-1, 1]) set.absorb(mats.paint('#e5e7e8', 0.4), boxPart(scene, [0.006, 0.035, 0.3], [sx * (hw + 0.003), 1.05, bz]));
    set.absorb(p.chrome, boxPart(scene, [0.07, 0.04, 0.02], [0, y1 - 0.04, bz - hd - 0.01]));
    return set;
  }
}

type Parts = Record<'paint' | 'frame' | 'plastic' | 'rubber' | 'seat' | 'chrome' | 'alloy' | 'engine' | 'white' | 'box', LabMaterial>;
