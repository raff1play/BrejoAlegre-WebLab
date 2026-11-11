import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { approach, clamp } from '../../core/math';

export const CAMERA_LIMITS = Object.freeze({
  minRadius: 7, maxRadius: 44, minBeta: 0.55, maxBeta: 1.22,
  rotateSpeed: 1.9,   // rad/s while a rotate control is held
  zoomSpeed: 1.1,     // fraction of the distance per second while a zoom control is held
});

/**
 * Oblique "isometric" follow camera. It never rotates by itself: the player turns it (keys,
 * buttons or dragging on the canvas) and zooms it (keys, buttons, wheel or pinch). All motion is
 * eased so the view never jumps.
 */
export class IsometricCameraRig {
  readonly camera: ArcRotateCamera;
  private alpha = (-3 * Math.PI) / 4;
  private beta = 0.93;
  private radius: number;
  private readonly focus: Vector3;
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;

  constructor(scene: Scene, private readonly canvas: HTMLCanvasElement, start: Vector3, radius: number) {
    this.radius = radius;
    this.focus = start.clone();
    this.camera = new ArcRotateCamera('camera-isometrica', this.alpha, this.beta, radius, this.focus.clone(), scene);
    this.camera.minZ = 0.5;
    this.camera.maxZ = 2000;
    this.camera.fov = 0.62;
    this.camera.inputs.clear(); // input is handled here, so game buttons and camera never fight
    this.attachPointerControls();
  }

  rotate(deltaRadians: number): void { this.alpha += deltaRadians; }

  /** factor < 1 zooms in, > 1 zooms out. */
  zoom(factor: number): void {
    this.radius = clamp(this.radius * factor, CAMERA_LIMITS.minRadius, CAMERA_LIMITS.maxRadius);
  }

  tilt(deltaRadians: number): void {
    this.beta = clamp(this.beta + deltaRadians, CAMERA_LIMITS.minBeta, CAMERA_LIMITS.maxBeta);
  }

  /** Development aid: jump straight to a view. */
  debugSet(alpha: number, beta: number, radius: number): void {
    this.alpha = alpha;
    this.beta = clamp(beta, CAMERA_LIMITS.minBeta, CAMERA_LIMITS.maxBeta);
    this.radius = clamp(radius, CAMERA_LIMITS.minRadius, CAMERA_LIMITS.maxRadius);
  }

  /** Ground heading the camera looks towards (same convention as the vehicle yaw). */
  get viewYaw(): number {
    return Math.atan2(-Math.cos(this.camera.alpha), -Math.sin(this.camera.alpha));
  }

  get targetRadius(): number { return this.radius; }
  get targetAlpha(): number { return this.alpha; }

  /** `rotateAxis` and `zoomAxis` are -1, 0 or 1 from held controls. */
  update(dt: number, target: Vector3, rotateAxis: number, zoomAxis: number): void {
    if (rotateAxis !== 0) this.rotate(rotateAxis * CAMERA_LIMITS.rotateSpeed * dt);
    if (zoomAxis !== 0) this.zoom(Math.exp(zoomAxis * CAMERA_LIMITS.zoomSpeed * dt));
    this.focus.x = approach(this.focus.x, target.x, 7, dt);
    this.focus.y = approach(this.focus.y, target.y, 7, dt);
    this.focus.z = approach(this.focus.z, target.z, 7, dt);
    this.camera.target.copyFrom(this.focus);
    this.camera.alpha = approach(this.camera.alpha, this.alpha, 9, dt);
    this.camera.beta = approach(this.camera.beta, this.beta, 9, dt);
    this.camera.radius = approach(this.camera.radius, this.radius, 7, dt);
  }

  /** Drag on the scene to orbit, pinch or wheel to zoom. Buttons live in the HUD above the canvas. */
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
