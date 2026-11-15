import { STICK_TUNING, ZERO_STICK, followCenter, stickAxes, type StickAxes } from '../../core/analogStick.ts';

/**
 * CTRL-001 floating stick. The whole lower-left zone (`#movement-stick`) accepts the thumb: the
 * stick centre is placed where the thumb lands and follows it, within limits, when it goes past
 * the ring (inspired by the documented "dynamic"/"follow" joystick pattern; no library).
 *
 * One thumb, one pointer id; other fingers on the throttle/brake buttons are independent. Pointer
 * capture lets the thumb slide anywhere; pointerup/cancel/lostpointercapture, blur, page hide and
 * orientation changes all return it to neutral. One layout read per touch, none per frame.
 */
export class VirtualJoystick {
  private readonly zone: HTMLElement | null;
  private readonly base: HTMLElement | null;
  private readonly thumb: HTMLElement | null;
  private pointerId: number | null = null;
  private origin = { x: 0, y: 0 };
  private center = { x: 0, y: 0 };
  private zoneLeft = 0;
  private zoneTop = 0;
  private radius = 1;
  private value: StickAxes = ZERO_STICK;
  private horizontal = 0;

  constructor(root: ParentNode) {
    this.zone = root.querySelector<HTMLElement>('#movement-stick');
    this.base = root.querySelector<HTMLElement>('#movement-stick-base');
    this.thumb = root.querySelector<HTMLElement>('#movement-stick-thumb');
    if (!this.zone || !this.base || !this.thumb) return;
    const zone = this.zone;

    zone.addEventListener('pointerdown', (event) => {
      if (this.pointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      const rect = zone.getBoundingClientRect();
      this.zoneLeft = rect.left;
      this.zoneTop = rect.top;
      // The ring is 2.7 radii wide (CSS `--stick-r`), so the visual and the logic always agree.
      this.radius = Math.max(16, (this.base!.offsetWidth || 120) / 2.7);
      this.origin = { x: event.clientX, y: event.clientY };
      this.center = { ...this.origin };
      this.pointerId = event.pointerId;
      zone.classList.add('engaged');
      this.placeBase();
      try { zone.setPointerCapture(event.pointerId); } catch { /* fallback to window pointerup */ }
      this.move(event);
    });
    zone.addEventListener('pointermove', (event) => this.move(event));
    const done = (event: PointerEvent) => { if (event.pointerId === this.pointerId) this.reset(); };
    zone.addEventListener('pointerup', done);
    zone.addEventListener('pointercancel', done);
    zone.addEventListener('lostpointercapture', done);
    // If capture is unavailable, a released finger must still stop movement.
    window.addEventListener('pointerup', done);
    window.addEventListener('pointercancel', done);
    window.addEventListener('orientationchange', () => this.reset());
    window.addEventListener('resize', () => this.reset());
  }

  /** Radial axes with dead zone: 360° walking. */
  get axes(): StickAxes { return this.value; }
  /** Raw horizontal deflection (−1…1 of the radius), no dead zone: input of the riding curve. */
  get steerX(): number { return this.horizontal; }
  get engaged(): boolean { return this.pointerId !== null; }

  /** Read-only state for the browser tests. */
  debug(): { engaged: boolean; x: number; y: number; steerX: number; center: { x: number; y: number }; origin: { x: number; y: number }; radius: number } {
    return { engaged: this.engaged, x: this.value.x, y: this.value.y, steerX: this.horizontal, center: { ...this.center }, origin: { ...this.origin }, radius: this.radius };
  }

  private placeBase(): void {
    if (!this.base) return;
    this.base.style.left = `${(this.center.x - this.zoneLeft).toFixed(1)}px`;
    this.base.style.top = `${(this.center.y - this.zoneTop).toFixed(1)}px`;
  }

  private move(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    const finger = { x: event.clientX, y: event.clientY };
    const next = followCenter(this.center, finger, this.radius, this.origin, this.radius * STICK_TUNING.followTravel);
    if (next.x !== this.center.x || next.y !== this.center.y) { this.center = next; this.placeBase(); }
    const dx = finger.x - this.center.x;
    const dy = finger.y - this.center.y;
    this.value = stickAxes(dx, dy, this.radius, STICK_TUNING.walkDeadzone);
    const h = dx / this.radius;
    this.horizontal = Number.isFinite(h) ? Math.max(-1, Math.min(1, h)) : 0;
    const length = Math.hypot(dx, dy);
    const fraction = length > this.radius ? this.radius / length : 1;
    if (this.thumb) this.thumb.style.transform =
      `translate(-50%, -50%) translate(${(dx * fraction).toFixed(1)}px, ${(dy * fraction).toFixed(1)}px)`;
  }

  reset(): void {
    this.pointerId = null;
    this.value = ZERO_STICK;
    this.horizontal = 0;
    this.zone?.classList.remove('engaged');
    if (this.base) { this.base.style.left = ''; this.base.style.top = ''; }
    if (this.thumb) this.thumb.style.transform = 'translate(-50%, -50%)';
  }
}
