import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { ExtrudeShape } from '@babylonjs/core/Meshes/Builders/shapeBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Scene } from '@babylonjs/core/scene';
import type { MotionGuard } from '../../core/collision';
import { approach, clamp } from '../../core/math';
import { CAR, createCarState, stepCar, type CarControls, type CarState, type DoorSide } from '../../core/carPhysics';
import { CAR_TRUNK } from '../../core/delivery/carTrunk';
import { BatchSet } from '../../world/geometry';
import type { LabMaterial, Materials } from '../../world/materials';
import { boxPart, rodPart } from '../../world/modelParts';
import { RigidSkin } from '../shared/rigidSkin';
import { Character, RIDER_LOOK, type Pose } from '../shared/character';

/**
 * B1-01 F2: the player's own old popular car (generic boxy hatch, no real brand or model is
 * copied). Presentation only: position, heading, speed and steering come from core/carPhysics;
 * this class reads them, turns the front wheels, rolls the tyres, opens the door the driver uses,
 * shows the seated driver and drives the lamps. Built as one rigid skin (one mesh per material).
 * Local axes: +z forward, +x right, y up, ground at 0.
 */
const WHEEL_R = 0.29;
const HL = CAR.length / 2;
const HW = CAR.width / 2;
const AXLE_F = CAR.wheelbase / 2 + 0.06;
const AXLE_R = -CAR.wheelbase / 2 + 0.06;
/** Front hinge of the side doors, and their length. */
const DOOR_HINGE_Z = 0.66;
const DOOR_LEN = 1.12;
const DOOR_OPEN = 1.05;
const DOOR_TIME = 0.9;
/**
 * B1-01 F3: the boot. Its usable volume is exactly `CAR_TRUNK` (core/delivery/carTrunk): floor at
 * TRUNK_FLOOR_Y, between the walls at ±TRUNK_HALF_W, from the rear-seat back (SEAT_BACK_Z) to the
 * inside of the tailgate. The tailgate is hinged at the rear edge of the roof and swings up.
 */
export const TRUNK_FLOOR_Y = 0.42;
export const TRUNK_HALF_W = CAR_TRUNK.width / 2;
const TAILGATE_INNER_Z = -HL + 0.05;
export const SEAT_BACK_Z = TAILGATE_INNER_Z + CAR_TRUNK.depth;
const HINGE_Y = 1.36;
const HINGE_Z = -1.58;
const TAILGATE_OPEN = 1.25;

type ZY = readonly [number, number];
function prism(scene: Scene, set: BatchSet, mat: LabMaterial, profile: readonly ZY[], x0: number, x1: number): void {
  const shape = profile.map(([z, y]) => new Vector3(-z, y, 0));
  const m = ExtrudeShape('perfil-carro', {
    shape, path: [new Vector3(x0, 0, 0), new Vector3(x1, 0, 0)], cap: Mesh.CAP_ALL, closeShape: true, sideOrientation: Mesh.DOUBLESIDE,
  }, scene);
  set.absorb(mat, m);
}

export class PlayerCar {
  readonly root: TransformNode;
  readonly state: CarState;
  readonly meshes: AbstractMesh[] = [];
  private readonly body: TransformNode;
  private readonly steerNodes: TransformNode[] = [];
  private readonly wheels: TransformNode[] = [];
  private readonly doors: Record<'motorista' | 'passageiro', TransformNode>;
  private readonly doorOpen = { motorista: 0, passageiro: 0 };
  private readonly tailgate: TransformNode;
  private tailgateOpen = 0;
  private tailgateWanted = false;
  private doorTimer = 0;
  private doorSide: 'motorista' | 'passageiro' = 'motorista';
  private readonly driver: Character;
  private readonly brakeMat: StandardMaterial;
  private readonly beam: Mesh;
  private readonly beamMat: StandardMaterial;
  private brake = 0;
  private driven = false;
  private groundY = 0;
  private lastSpeed = 0;
  private pitch = 0;
  private accel = 0;

  constructor(scene: Scene, mats: Materials, x: number, z: number, yaw: number, groundHeight: number, paint = '#8e2b26') {
    this.state = createCarState(x, z, yaw);
    this.root = new TransformNode('carro-jogador', scene);
    this.body = this.child(scene, 'carro-carroceria', this.root);
    const lacquer = mats.lacquer(paint);
    const glass = mats.lacquer('#26323c');
    const trim = mats.paint('#1d1f22', 0.25);
    const chrome = mats.chrome('#b9bcc0');
    const plate = mats.paint('#f1f1ec');
    const head = mats.glow('#fff4d6');
    const amber = mats.glow('#ffb43a');
    const interior = mats.paint('#3a3631');

    const shell = new BatchSet();
    // Boxy hatch: short bonnet, upright glasshouse, near-vertical tailgate.
    prism(scene, shell, lacquer, [[HL, 0.32], [HL + 0.02, 0.66], [HL - 0.1, 0.75], [0.66, 0.86], [SEAT_BACK_Z, 0.885], [SEAT_BACK_Z, 0.3]], -HW, HW);
    prism(scene, shell, glass, [[0.66, 0.86], [0.04, 1.33], [-1.56, 1.36], [-1.56, 0.925], [SEAT_BACK_Z, 0.925]], -HW + 0.07, HW - 0.07);
    // B1-01 F3 boot (open compartment, closed by the tailgate): floor, rear sill, quarter panels,
    // rear-seat back, quarter windows. Its inside is exactly CAR_TRUNK.
    shell.box(trim, -HW, HW, 0.3, TRUNK_FLOOR_Y, -HL, SEAT_BACK_Z);
    shell.box(lacquer, -HW, HW, 0.3, 0.47, -HL - 0.01, TAILGATE_INNER_Z);
    shell.box(interior, -TRUNK_HALF_W, TRUNK_HALF_W, TRUNK_FLOOR_Y, TRUNK_FLOOR_Y + 0.01, TAILGATE_INNER_Z, SEAT_BACK_Z);
    shell.box(interior, -TRUNK_HALF_W, TRUNK_HALF_W, TRUNK_FLOOR_Y, 0.9, SEAT_BACK_Z, SEAT_BACK_Z + 0.08);
    for (const sx of [-1, 1]) {
      shell.box(lacquer, sx > 0 ? TRUNK_HALF_W : -HW, sx > 0 ? HW : -TRUNK_HALF_W, TRUNK_FLOOR_Y, 0.9, -HL, SEAT_BACK_Z);
      prism(scene, shell, glass, [[-1.56, 1.36], [-1.56, 0.9], [-HL + 0.07, 0.9]], sx * (HW - 0.09), sx * (HW - 0.07));
      // D pillar beside the tailgate opening.
      prism(scene, shell, lacquer, [[-1.56, 1.38], [-HL + 0.05, 0.9], [-HL - 0.005, 0.9], [-1.6, 1.4]], sx > 0 ? TRUNK_HALF_W : -(HW - 0.07), sx > 0 ? HW - 0.07 : -TRUNK_HALF_W);
    }
    prism(scene, shell, lacquer, [[0.08, 1.31], [0.03, 1.38], [-1.56, 1.4], [-1.62, 1.33]], -HW + 0.09, HW - 0.09);
    for (const sx of [-1, 1]) {
      const px = sx * (HW - 0.09);
      shell.absorb(lacquer, rodPart(scene, [px, 0.86, 0.64], [px, 1.33, 0.06], 0.07, 0.06, 6));   // A pillar
      shell.box(lacquer, px - 0.04, px + 0.04, 0.88, 1.36, -0.6, -0.5);                          // B pillar
      shell.box(lacquer, px - 0.04, px + 0.04, 0.9, 1.36, -1.6, -1.42);                          // C pillar
      shell.absorb(lacquer, boxPart(scene, [0.1, 0.08, 0.14], [sx * (HW + 0.05), 0.96, 0.6]));   // mirrors
      shell.box(trim, sx * HW - 0.02, sx * HW + 0.02, 0.4, 0.5, -HL + 0.3, HL - 0.3);           // rubbing strip
      shell.box(head, sx * (HW - 0.36) - 0.22, sx * (HW - 0.36) + 0.22, 0.56, 0.7, HL - 0.01, HL + 0.03);
      shell.box(amber, sx * (HW - 0.1) - 0.06, sx * (HW - 0.1) + 0.06, 0.58, 0.68, HL - 0.02, HL + 0.025);
      // Wheel arches (dark), so the tyres read clearly under the body.
      for (const az of [AXLE_F, AXLE_R]) shell.box(trim, sx * HW - 0.015, sx * HW + 0.015, 0.3, 0.62, az - 0.36, az + 0.36);
    }
    shell.box(trim, -0.5, 0.5, 0.44, 0.6, HL - 0.01, HL + 0.035);           // grille
    shell.box(trim, -HW + 0.02, HW - 0.02, 0.26, 0.42, HL - 0.05, HL + 0.09); // bumpers
    shell.box(trim, -HW + 0.02, HW - 0.02, 0.26, 0.44, -HL - 0.09, -HL + 0.05);
    shell.box(plate, -0.25, 0.25, 0.44, 0.55, HL + 0.09, HL + 0.1);
    // Cabin: seats, dashboard, steering wheel (seen through the glass).
    shell.box(interior, -HW + 0.12, HW - 0.12, 0.3, 0.52, SEAT_BACK_Z + 0.08, 0.6);
    for (const sx of [-1, 1]) shell.box(interior, sx * 0.36 - 0.24, sx * 0.36 + 0.24, 0.52, 1.08, -0.42, -0.3);
    shell.box(interior, -0.4, 0.4, 0.52, 0.92, SEAT_BACK_Z + 0.08, SEAT_BACK_Z + 0.22);
    shell.box(trim, -HW + 0.1, HW - 0.1, 0.78, 0.9, 0.45, 0.66);
    shell.absorb(trim, rodPart(scene, [-0.36, 0.88, 0.42], [-0.36, 0.79, 0.52], 0.05, 0.05, 6));
    const wheelRing = CreateCylinder('carro-volante', { diameter: 0.38, height: 0.035, tessellation: 14 }, scene);
    wheelRing.rotation.x = Math.PI / 2 - 0.45; wheelRing.position.set(-0.36, 0.9, 0.4);
    shell.absorb(trim, wheelRing);

    const skin = new RigidSkin(scene, 'carro-jogador', this.root);
    skin.add(this.body, shell);

    // Side doors: own nodes hinged at their front edge, outer skin + window frame + handle.
    const door = (side: -1 | 1, name: string): TransformNode => {
      const node = this.child(scene, name, this.body);
      node.position.set(side * (HW + 0.012), 0, DOOR_HINGE_Z);
      const set = new BatchSet();
      set.box(lacquer, -0.012, 0.012, 0.34, 0.86, -DOOR_LEN, 0);
      set.box(trim, -0.014, 0.014, 0.42, 0.48, -DOOR_LEN + 0.02, -0.02);
      set.box(chrome, side * 0.016 - 0.01, side * 0.016 + 0.01, 0.68, 0.71, -DOOR_LEN + 0.1, -DOOR_LEN + 0.25);
      set.box(lacquer, -0.02, 0.02, 0.86, 1.3, -DOOR_LEN + 0.02, -DOOR_LEN + 0.07);
      skin.add(node, set);
      return node;
    };
    this.doors = { motorista: door(-1, 'carro-porta-motorista'), passageiro: door(1, 'carro-porta-passageiro') };

    // B1-01 F3: tailgate (rear window + lower panel + plate + latch), hinged at the roof's rear edge.
    this.tailgate = this.child(scene, 'carro-tampa-traseira', this.body);
    this.tailgate.position.set(0, HINGE_Y, HINGE_Z);
    const gate = new BatchSet();
    const rel = (pts: readonly ZY[]): ZY[] => pts.map(([z, y]) => [z - HINGE_Z, y - HINGE_Y] as const);
    prism(scene, gate, glass, rel([[-1.575, 1.365], [-HL + 0.03, 0.93], [-HL - 0.005, 0.93], [-1.605, 1.38]]), -TRUNK_HALF_W + 0.04, TRUNK_HALF_W - 0.04);
    prism(scene, gate, lacquer, rel([[-1.56, 1.4], [-1.575, 1.365], [-1.605, 1.38], [-1.6, 1.41]]), -TRUNK_HALF_W, TRUNK_HALF_W);
    for (const sx of [-1, 1]) prism(scene, gate, lacquer, rel([[-1.575, 1.365], [-HL + 0.03, 0.93], [-HL - 0.005, 0.93], [-1.605, 1.38]]), sx > 0 ? TRUNK_HALF_W - 0.04 : -TRUNK_HALF_W, sx > 0 ? TRUNK_HALF_W : -TRUNK_HALF_W + 0.04);
    const gz = (z: number) => z - HINGE_Z; const gy = (y: number) => y - HINGE_Y;
    gate.box(lacquer, -TRUNK_HALF_W, TRUNK_HALF_W, gy(0.47), gy(0.935), gz(-HL - 0.01), gz(-HL + 0.03));
    gate.box(plate, -0.25, 0.25, gy(0.52), gy(0.63), gz(-HL - 0.025), gz(-HL - 0.01));
    gate.box(chrome, -0.05, 0.05, gy(0.68), gy(0.73), gz(-HL - 0.03), gz(-HL - 0.01));
    skin.add(this.tailgate, gate);

    for (const [i, [z, sx]] of ([[AXLE_F, -1], [AXLE_F, 1], [AXLE_R, -1], [AXLE_R, 1]] as const).entries()) {
      const front = i < 2;
      const hub = this.child(scene, `carro-cubo-${i}`, this.root);
      hub.position.set(sx * (HW - 0.14), WHEEL_R, z);
      const wheel = this.child(scene, `carro-roda-${i}`, hub);
      const set = new BatchSet();
      const tyre = CreateCylinder('pneu', { diameter: WHEEL_R * 2, height: 0.19, tessellation: 18 }, scene);
      tyre.rotation.z = Math.PI / 2;
      set.absorb(mats.paint('#161718'), tyre);
      const rim = CreateCylinder('aro', { diameter: WHEEL_R * 1.2, height: 0.02, tessellation: 12 }, scene);
      rim.rotation.z = Math.PI / 2; rim.position.x = sx * 0.1;
      set.absorb(chrome, rim);
      set.box(mats.paint('#55595e', 0.3), sx * 0.1 - 0.012, sx * 0.1 + 0.012, -0.05, 0.05, -0.15, 0.15); // spoke: shows rolling
      skin.add(wheel, set);
      this.wheels.push(wheel);
      if (front) this.steerNodes.push(hub);
    }
    this.meshes.push(...skin.build({ min: new Vector3(-HW - 1.3, -0.2, -HL - 0.3), max: new Vector3(HW + 1.3, 1.6, HL + 0.3) }));

    // Brake lights: own unlit material so they can brighten without rebuilding the skin.
    this.brakeMat = new StandardMaterial('carro-luz-freio', scene);
    this.brakeMat.disableLighting = true; this.brakeMat.emissiveColor = new Color3(0.45, 0.04, 0.03);
    const tail = new BatchSet();
    for (const sx of [-1, 1]) tail.box(mats.paint('#ffffff'), sx * (HW - 0.14) - 0.12, sx * (HW - 0.14) + 0.12, 0.6, 0.86, -HL - 0.035, -HL + 0.005);
    for (const m of tail.build('carro-lanternas', scene, this.body)) { m.material = this.brakeMat; this.meshes.push(m); }
    // Headlights: additive pool of light on the road ahead, from dusk, only with a driver.
    this.beamMat = new StandardMaterial('carro-farol-feixe', scene);
    const glow = new DynamicTexture('tx-farol-carro', { width: 64, height: 64 }, scene, false);
    const g2 = glow.getContext() as unknown as CanvasRenderingContext2D;
    const grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.5, 'rgba(255,255,255,0.45)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g2.fillStyle = grad; g2.fillRect(0, 0, 64, 64); glow.update();
    this.beamMat.disableLighting = true; this.beamMat.emissiveColor = new Color3(1, 0.9, 0.62);
    this.beamMat.emissiveTexture = glow; this.beamMat.opacityTexture = glow;
    this.beamMat.alpha = 0; this.beamMat.alphaMode = 1; this.beamMat.fogEnabled = false; this.beamMat.zOffset = -4;
    this.beam = CreateGround('carro-farol', { width: 5.2, height: 10 }, scene);
    this.beam.material = this.beamMat; this.beam.parent = this.root; this.beam.position.set(0, 0.04, HL + 5);
    this.beam.isPickable = false; this.beam.setEnabled(false);

    // Seated driver (same articulated character as the rider), hidden while the car is parked.
    this.driver = new Character(scene, mats, 'motorista', { ...RIDER_LOOK });
    this.driver.root.parent = this.body;
    this.driver.root.position.set(-0.36, 0.25, 0);
    this.meshes.push(...this.driver.meshes);
    this.driver.apply(SEATED);
    this.driver.root.setEnabled(false);

    this.groundY = groundHeight;
    this.sync(0, groundHeight);
  }

  get isDriven(): boolean { return this.driven; }
  /** How open the tailgate is (0 closed … 1 fully up). */
  get trunk01(): number { return this.tailgateOpen; }
  /** Node of the car body that boot contents are parented to (car-local frame). */
  get cargoParent(): TransformNode { return this.body; }
  /** B1-01 F3: animate the tailgate towards open/closed (the domain decides whether it may). */
  setTrunkOpen(open: boolean): void { this.tailgateWanted = open; }
  /** How open each front door is (0 closed … 1 open). */
  get doors01(): { motorista: number; passageiro: number } { return { ...this.doorOpen }; }

  /** Getting in releases the handbrake; getting out sets it. `side` animates that door. */
  setDriven(driven: boolean, side: DoorSide = 'motorista'): void {
    this.driven = driven;
    this.state.parked = !driven;
    if (!driven) { this.state.speed = 0; this.state.drive = 0; this.state.braking = 0; }
    this.driver.root.setEnabled(driven);
    if (side !== 'traseira') { this.doorSide = side; this.doorTimer = DOOR_TIME; }
    else { this.doorSide = 'motorista'; this.doorTimer = DOOR_TIME; }
  }

  /** World position of the driver's seat (where a person getting out starts from). */
  seatPosition(): { x: number; y: number; z: number } {
    const s = this.state; const c = Math.cos(s.yaw); const n = Math.sin(s.yaw);
    return { x: s.x - 0.36 * c, y: this.groundY + 0.7, z: s.z + 0.36 * n };
  }

  setLights(braking: boolean, night: number, dt: number): void {
    this.brake = approach(this.brake, braking ? 1 : 0, 18, dt);
    const k = (this.driven ? 0.35 + 0.3 * night : 0.12) + 0.6 * this.brake;
    this.brakeMat.emissiveColor.set(Math.min(1, k * 1.05), 0.04 + 0.1 * this.brake, 0.03 + 0.06 * this.brake);
    const on = night > 0.3 && this.driven;
    if (this.beam.isEnabled() !== on) this.beam.setEnabled(on);
    this.beamMat.alpha = 0.5 * Math.min(1, (night - 0.3) * 3);
  }

  update(dt: number, controls: CarControls, guard: MotionGuard, groundHeight: number): void {
    stepCar(this.state, this.driven ? controls : IDLE, dt, guard);
    this.sync(dt, groundHeight);
  }

  private child(scene: Scene, name: string, parent: TransformNode): TransformNode {
    const node = new TransformNode(name, scene);
    node.parent = parent;
    return node;
  }

  private sync(dt: number, groundHeight: number): void {
    const s = this.state;
    this.groundY = dt > 0 ? approach(this.groundY, groundHeight, 12, dt) : groundHeight;
    this.root.position.set(s.x, this.groundY, s.z);
    this.root.rotation.y = s.yaw;
    if (dt > 0) {
      // Body pitch: dives when braking, squats when accelerating (visual only).
      this.accel = approach(this.accel, (s.speed - this.lastSpeed) / dt, 8, dt);
      this.pitch = approach(this.pitch, clamp(-this.accel * 0.005, -0.03, 0.04), 7, dt);
    }
    this.lastSpeed = s.speed;
    this.body.rotation.x = this.pitch;
    this.body.position.y = -Math.abs(this.pitch) * 0.1;
    const lock = CAR.maxSteerAngle / (1 + (s.speed / CAR.steerSpeedRef) ** 2);
    for (const hub of this.steerNodes) hub.rotation.y = s.steer * lock;
    for (const w of this.wheels) w.rotation.x += (s.speed * dt) / WHEEL_R;
    this.doorTimer = Math.max(0, this.doorTimer - dt);
    for (const side of ['motorista', 'passageiro'] as const) {
      const want = this.doorTimer > 0 && side === this.doorSide ? 1 : 0;
      this.doorOpen[side] = dt > 0 ? approach(this.doorOpen[side], want, 10, dt) : want;
      // Hinge at the front edge: the rear of the door swings outwards.
      this.doors[side].rotation.y = (side === 'motorista' ? 1 : -1) * this.doorOpen[side] * DOOR_OPEN;
    }
    this.tailgateOpen = dt > 0 ? approach(this.tailgateOpen, this.tailgateWanted ? 1 : 0, 5, dt) : (this.tailgateWanted ? 1 : 0);
    this.tailgate.rotation.x = this.tailgateOpen * TAILGATE_OPEN;
    if (this.driven) this.driver.apply({ ...SEATED, yaw: s.steer * 0.1, headYaw: s.steer * 0.25, hands: steeringHands(s.steer) });
  }
}

const IDLE: CarControls = { throttle: 0, brake: 0, steer: 0 };

/** Hands on the steering wheel rim, rotated with the wheel (driver space). */
function steeringHands(steer: number): Pose['hands'] {
  const a = steer * 1.2; const r = 0.17;
  const at = (base: number) => ({ x: Math.cos(base - a) * r, y: 0.66 + Math.sin(base - a) * r * 0.9, z: 0.4 });
  return [at(Math.PI), at(0)];
}

/** Driver seated: pelvis on the cushion, back against the seat, feet on the pedals. */
const SEATED: Pose = {
  pelvis: { x: 0, y: 0.32, z: -0.2 },
  pitch: -0.12, yaw: 0, roll: 0, headYaw: 0, headPitch: 0.05,
  hands: steeringHands(0),
  feet: [{ x: -0.13, y: 0.06, z: 0.62 }, { x: 0.13, y: 0.06, z: 0.62 }],
  elbowPoles: [{ x: -0.7, y: 0.1, z: 0 }, { x: 0.7, y: 0.1, z: 0 }],
  kneePoles: [{ x: -0.2, y: 1.2, z: 0.6 }, { x: 0.2, y: 1.2, z: 0.6 }],
  footYaw: [0, 0], footPitch: [0.2, 0.2],
};
