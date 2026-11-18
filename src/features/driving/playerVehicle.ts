import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { VehicleKind } from '../../core/career/careers';
import type { MotionGuard } from '../../core/collision';
import { CAR, CAR_RADIUS, canEnterCar, carBodyHits, carFits, findCarExit, isCarStopped, type DoorSide } from '../../core/carPhysics';
import { canMount, findDismountSpot } from '../../core/mounting';
import { MOTO, isMotoStopped } from '../../core/motorcyclePhysics';
import type { Motorcycle } from './motorcycle';
import type { PlayerCar } from './playerCar';

/**
 * B1-01 F2 (contract "veículo ativo neutro"): what the composition root needs from the player's
 * own vehicle, whichever it is. The career decides the kind (decisions 5–6); the game loop, the
 * camera, the HUD and the people around only talk to this interface. Parcel custody is NOT here:
 * the cargo compartments stay in the delivery domain (moto top box today; the car boot is F3).
 *
 * The motorcycle adapter only forwards to the existing Motorcycle / motorcyclePhysics / mounting
 * code with the same expressions main.ts used before F2, so CTRL-002 handling is unchanged.
 */
export type VehicleView = Readonly<{ x: number; z: number; yaw: number; speed: number; steer: number }>;
export type PedalInput = { throttle: number; brake: number; steer: number };
export type ExitResult = { ok: true; x: number; z: number; from: { x: number; y: number; z: number }; side: DoorSide | 'moto' } | { ok: false; reason: string };

export interface PlayerVehicle {
  readonly kind: VehicleKind;
  readonly root: TransformNode;
  readonly meshes: readonly AbstractMesh[];
  /** Live simulation state (read-only for callers). */
  readonly view: VehicleView;
  readonly driven: boolean;
  /** Labels for the contextual button and the HUD. */
  readonly words: Readonly<{ exit: string; enter: string; stopFirst: string; noRoom: string; tooFar: string; driving: string; tip: string }>;
  /** Radius used by systems that only know circles (traffic yielding, gate safety). */
  readonly trafficRadius: number;
  /** Camera: chase distance/pitch while driving and the look-at height above the ground. */
  readonly camera: Readonly<{ radius: number; beta: number; height: number }>;
  stopped(): boolean;
  /** One simulation step: with a driver it takes the pedals, without one it stays parked. */
  step(dt: number, input: PedalInput, guard: MotionGuard, ground: number): void;
  /** Get out: only stopped, and only onto free ground (`guard` excludes this vehicle). */
  exit(guard: MotionGuard): ExitResult;
  /** Get in from where the person stands; null when too far. */
  enterSide(walker: { x: number; z: number }): DoorSide | 'moto' | null;
  enter(walker: { x: number; z: number }): void;
  /** Does a person's circle touch the parked vehicle? (it is solid on foot). */
  blocksPerson(x: number, z: number, r: number): boolean;
  /** Does the whole body fit at a pose? (spawn and parking checks). */
  fitsAt(guard: MotionGuard, x: number, z: number, yaw: number): boolean;
  setLights(braking: boolean, night: number, dt: number): void;
}

export function motoVehicle(moto: Motorcycle): PlayerVehicle {
  return {
    kind: 'moto-antiga', root: moto.root, meshes: moto.meshes,
    get view() { return moto.state; },
    get driven() { return moto.isRidden; },
    words: { exit: 'Descer', enter: 'Montar', stopFirst: 'Pare a moto para descer', noRoom: 'Sem espaço para descer aqui', tooFar: 'Chegue mais perto da moto', driving: 'Pilotando', tip: 'W/S acelerar e frear · A/D virar · F descer (parado)' },
    trafficRadius: 1.1,
    camera: { radius: 5.6, beta: 1.27, height: 0.95 },
    stopped: () => isMotoStopped(moto.state),
    step: (dt, input, guard, ground) => moto.update(dt, moto.isRidden ? input : { throttle: 0, brake: 0, steer: 0 }, guard, ground),
    exit(guard) {
      if (!isMotoStopped(moto.state)) return { ok: false, reason: 'Pare a moto para descer' };
      const spot = findDismountSpot(moto.state, guard);
      if (!spot) return { ok: false, reason: 'Sem espaço para descer aqui' };
      moto.state.speed = 0;
      moto.state.steer = 0;
      const from = moto.seatPosition();
      moto.setRidden(false);
      return { ok: true, x: spot.x, z: spot.z, from, side: 'moto' };
    },
    enterSide: (w) => (canMount(w, moto.state) ? 'moto' : null),
    enter(w) {
      // Which side of the bike the rider gets on from (visual only).
      const m = moto.state;
      const side = (w.x - m.x) * Math.cos(m.yaw) - (w.z - m.z) * Math.sin(m.yaw) < 0 ? -1 : 1;
      moto.setRidden(true, side);
    },
    blocksPerson(x, z, r) {
      const s = moto.state;
      const ox = Math.sin(s.yaw) * MOTO.bodyOffset;
      const oz = Math.cos(s.yaw) * MOTO.bodyOffset;
      const reach = r + MOTO.bodyRadius - 0.08;
      return !(Math.hypot(x - s.x - ox, z - s.z - oz) > reach && Math.hypot(x - s.x + ox, z - s.z + oz) > reach
        && Math.hypot(x - s.x, z - s.z) > reach);
    },
    fitsAt: (guard, x, z, yaw) => {
      const fx = Math.sin(yaw) * MOTO.bodyOffset; const fz = Math.cos(yaw) * MOTO.bodyOffset;
      return guard(x + fx, z + fz, MOTO.bodyRadius) && guard(x - fx, z - fz, MOTO.bodyRadius);
    },
    setLights: (braking, night, dt) => moto.setLights(braking, night, dt),
  };
}

export function carVehicle(car: PlayerCar): PlayerVehicle {
  return {
    kind: 'carro-antigo', root: car.root, meshes: car.meshes,
    get view() { return car.state; },
    get driven() { return car.isDriven; },
    words: { exit: 'Sair do carro', enter: 'Entrar no carro', stopFirst: 'Pare o carro para sair', noRoom: 'Sem espaço para abrir a porta aqui', tooFar: 'Chegue perto de uma porta do carro', driving: 'Dirigindo', tip: 'W/S acelerar e frear/ré · A/D esterçar · F sair (parado)' },
    trafficRadius: CAR_RADIUS,
    camera: { radius: 7.4, beta: 1.22, height: 1.15 },
    stopped: () => isCarStopped(car.state),
    step: (dt, input, guard, ground) => car.update(dt, input, guard, ground),
    exit(guard) {
      if (!isCarStopped(car.state)) return { ok: false, reason: 'Pare o carro para sair' };
      const spot = findCarExit(car.state, guard);
      if (!spot) return { ok: false, reason: 'Sem espaço para abrir a porta aqui' };
      const from = car.seatPosition();
      car.setDriven(false, spot.side);
      return { ok: true, x: spot.x, z: spot.z, from, side: spot.side };
    },
    enterSide: (w) => canEnterCar(w, car.state),
    enter(w) { car.setDriven(true, canEnterCar(w, car.state) ?? 'motorista'); },
    blocksPerson: (x, z, r) => carBodyHits(car.state, x, z, r),
    fitsAt: (guard, x, z, yaw) => carFits(guard, x, z, yaw),
    setLights: (braking, night, dt) => car.setLights(braking, night, dt),
  };
}

/** Half-length of the vehicle along its heading (used to keep the camera target on the body). */
export const vehicleHalfLength = (kind: VehicleKind): number => (kind === 'carro-antigo' ? CAR.length / 2 : MOTO.bodyOffset + MOTO.bodyRadius);
