import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { approach, clamp, type Box3D } from '../../core/math';
import { behindHeadingAlpha, followAngle, safeCameraDistance } from '../../core/cameraFollow';

export type CameraMode = 'isometric' | 'third-person';

export const CAMERA_LIMITS = Object.freeze({
  minRadius: 7, maxRadius: 44, minBeta: 0.55, maxBeta: 1.22,
  rotateSpeed: 1.9,
  zoomSpeed: 1.1,
});

const CHASE = Object.freeze({
  ridingRadius: 5.6, walkingRadius: 3.6,
  minRadius: 2.2, maxRadius: 9,
  ridingBeta: 1.27, walkingBeta: 1.23,
  minBeta: 1.03, maxBeta: 1.48,
  fov: 1.05, recenterDelay: 2.5,
});

/**
 * One Babylon camera, two reversible perspectives. The isometric view retains its original orbit
 * and zoom; the GTA-style view follows the bike's yaw, allows independent free-look, and retracts
 * before static buildings, walls, poles and trunks. No changes to vehicle/walking physics.
 */
export class IsometricCameraRig {
  readonly camera: ArcRotateCamera;
  private alpha = (-3 * Math.PI) / 4;
  private beta = 0.93;
  private radius: number;
  private readonly focus: Vector3;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private modeValue: CameraMode = 'isometric';
  private savedIsometric: { alpha: number; beta: number; radius: number } | null = null;
  private manualLook = 0;
  private wasRiding = true;

  constructor(
    scene: Scene, private readonly canvas: HTMLCanvasElement, start: Vector3, radius: number,
    private readonly obstacles: readonly Box3D[] = [],
  ) {
    this.radius = radius;
    this.focus = start.clone();
    this.camera = new ArcRotateCamera('camera-jogo', this.alpha, this.beta, radius, this.focus.clone(), scene);
    this.camera.minZ = 0.5;
    this.camera.maxZ = 2000;
    this.camera.fov = 0.62;
    this.camera.inputs.clear();
    this.attachPointerControls();
  }

  get mode(): CameraMode { return this.modeValue; }

  /** Called by the camera toggle button (or C on a keyboard). */
  toggleMode(heading: number, riding: boolean): CameraMode {
    if (this.modeValue === 'third-person') {
      this.modeValue = 'isometric';
      const old = this.savedIsometric;
      if (old) { this.alpha = old.alpha; this.beta = old.beta; this.radius = old.radius; }
      this.savedIsometric = null;
    } else {
      this.savedIsometric = { alpha: this.alpha, beta: this.beta, radius: this.radius };
      this.modeValue = 'third-person';
      this.alpha = behindHeadingAlpha(heading);
      this.beta = riding ? CHASE.ridingBeta : CHASE.walkingBeta;
      this.radius = riding ? CHASE.ridingRadius : CHASE.walkingRadius;
      this.wasRiding = riding;
      this.manualLook = 0;
    }
    this.camera.minZ = this.modeValue === 'third-person' ? 0.15 : 0.5;
    return this.modeValue;
  }

  rotate(deltaRadians: number): void {
    this.alpha += deltaRadians;
    if (this.modeValue === 'third-person') this.manualLook = CHASE.recenterDelay;
  }

  zoom(factor: number): void {
    const min = this.modeValue === 'isometric' ? CAMERA_LIMITS.minRadius : CHASE.minRadius;
    const max = this.modeValue === 'isometric' ? CAMERA_LIMITS.maxRadius : CHASE.maxRadius;
    this.radius = clamp(this.radius * factor, min, max);
  }

  tilt(deltaRadians: number): void {
    const min = this.modeValue === 'isometric' ? CAMERA_LIMITS.minBeta : CHASE.minBeta;
    const max = this.modeValue === 'isometric' ? CAMERA_LIMITS.maxBeta : CHASE.maxBeta;
    this.beta = clamp(this.beta + deltaRadians, min, max);
    if (this.modeValue === 'third-person') this.manualLook = CHASE.recenterDelay;
  }

  /** Development aid: jump straight to a view. */
  debugSet(alpha: number, beta: number, radius: number): void {
    this.alpha = alpha;
    const chase = this.modeValue === 'third-person';
    this.beta = clamp(beta, chase ? CHASE.minBeta : CAMERA_LIMITS.minBeta,
      chase ? CHASE.maxBeta : CAMERA_LIMITS.maxBeta);
    this.radius = clamp(radius, chase ? CHASE.minRadius : CAMERA_LIMITS.minRadius,
      chase ? CHASE.maxRadius : CAMERA_LIMITS.maxRadius);
    if (chase) this.manualLook = CHASE.recenterDelay;
  }

  /** Ground heading the camera looks towards (same convention as vehicle yaw). */
  get viewYaw(): number {
    return Math.atan2(-Math.cos(this.camera.alpha), -Math.sin(this.camera.alpha));
  }

  get targetRadius(): number { return this.radius; }
  get targetAlpha(): number { return this.alpha; }

  /** Heading and body state are presentation inputs; they never modify player simulation. */
  update(
    dt: number, target: Vector3, rotateAxis: number, zoomAxis: number,
    heading = 0, riding = true,
  ): void {
    if (this.modeValue === 'third-person' && riding !== this.wasRiding) {
      // Smoothly adapt distance when mounting/dismounting. Reframe without a sudden camera cut.
      this.radius = riding ? CHASE.ridingRadius : CHASE.walkingRadius;
      this.beta = riding ? CHASE.ridingBeta : CHASE.walkingBeta;
      if (riding) this.alpha = behindHeadingAlpha(heading);
      this.manualLook = 0;
    }
    this.wasRiding = riding;
    if (rotateAxis !== 0) this.rotate(rotateAxis * CAMERA_LIMITS.rotateSpeed * dt);
    if (zoomAxis !== 0) this.zoom(Math.exp(zoomAxis * CAMERA_LIMITS.zoomSpeed * dt));
    if (this.modeValue === 'third-person' && riding && this.manualLook <= 0 && rotateAxis === 0) {
      // Recenter after manual orbiting, using the shortest arc when yaw crosses ±PI.
      this.alpha = followAngle(this.alpha, behindHeadingAlpha(heading), 2.7, dt);
    }
    this.manualLook = Math.max(0, this.manualLook - dt);

    this.focus.x = approach(this.focus.x, target.x, 7, dt);
    this.focus.y = approach(this.focus.y, target.y, 7, dt);
    this.focus.z = approach(this.focus.z, target.z, 7, dt);
    this.camera.target.copyFrom(this.focus);
    this.camera.alpha = followAngle(this.camera.alpha, this.alpha, 9, dt);
    this.camera.beta = approach(this.camera.beta, this.beta, 9, dt);
    this.camera.fov = approach(this.camera.fov, this.modeValue === 'third-person' ? CHASE.fov : 0.62, 6, dt);
    this.camera.radius = approach(this.camera.radius, this.radius, 7, dt);

    if (this.modeValue === 'third-person') {
      const distance = this.camera.radius;
      const horizontal = Math.sin(this.camera.beta) * distance;
      const eye = {
        x: this.focus.x + Math.cos(this.camera.alpha) * horizontal,
        y: this.focus.y + Math.cos(this.camera.beta) * distance,
        z: this.focus.z + Math.sin(this.camera.alpha) * horizontal,
      };
      // Retract immediately when obstructed; restore distance gradually after clearance.
      this.camera.radius = Math.min(distance, safeCameraDistance(this.focus, eye, this.obstacles));
    }
  }

  /** Drag to free-look, pinch/wheel to zoom; touch controls and the scene never share pointers. */
  private attachPointerControls(): void {
    const canvas = this.canvas;
    const forget = (event: PointerEvent) => {
      this.pointers.delete(event.pointerId);
      this.pinchDistance = 0;
    };
    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.pinchDistance = 0;
    });
    canvas.addEventListener('pointermove', (event) => {
      const previous = this.pointers.get(event.pointerId);
      if (!previous) return;
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      previous.x = event.clientX;
      previous.y = event.clientY;
      if (this.pointers.size === 1) {
        this.rotate(-dx * 0.006);
        this.tilt(-dy * 0.004);
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
        if (this.pinchDistance > 0 && distance > 0) this.zoom(this.pinchDistance / distance);
        this.pinchDistance = distance;
      }
    });
    canvas.addEventListener('pointerup', forget);
    canvas.addEventListener('pointercancel', forget);
    canvas.addEventListener('lostpointercapture', forget);
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      this.zoom(Math.exp(clamp(event.deltaY, -240, 240) * 0.0012));
    }, { passive: false });
  }
}
