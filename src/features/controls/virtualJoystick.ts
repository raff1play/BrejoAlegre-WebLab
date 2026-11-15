import { stickAxes, ZERO_STICK, type StickAxes } from '../../core/analogStick.ts';

/**
 * One thumb controls the left analog stick. No Babylon objects, physics or
 * per-frame layout reads. Pointer capture allows a finger to slide outside
 * the ring; pointercancel/blur/visibility reset it safely.
 */
export class VirtualJoystick {
  private readonly base: HTMLElement | null;
  private readonly thumb: HTMLElement | null;
  private pointerId: number | null = null;
  private centerX = 0;
  private centerY = 0;
  private radius = 1;
  private value: StickAxes = ZERO_STICK;

  constructor(root: ParentNode) {
    this.base = root.querySelector<HTMLElement>('#movement-stick');
    this.thumb = root.querySelector<HTMLElement>('#movement-stick-thumb');
    if (!this.base || !this.thumb) return;

    this.base.addEventListener('pointerdown', (event) => {
      if (this.pointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      const rect = this.base!.getBoundingClientRect();
      this.centerX = rect.left + rect.width / 2;
      this.centerY = rect.top + rect.height / 2;
      this.radius = Math.max(1, Math.min(rect.width, rect.height) * 0.36);
      this.pointerId = event.pointerId;
      this.base!.classList.add('engaged');
      try { this.base!.setPointerCapture(event.pointerId); } catch { /* fallback to window pointerup */ }
      this.move(event);
    });
    this.base.addEventListener('pointermove', (event) => this.move(event));
    const done = (event: PointerEvent) => {
      if (event.pointerId === this.pointerId) this.reset();
    };
    this.base.addEventListener('pointerup', done);
    this.base.addEventListener('pointercancel', done);
    this.base.addEventListener('lostpointercapture', done);
    // If capture is unavailable, a released finger must still stop movement.
    window.addEventListener('pointerup', done);
    window.addEventListener('pointercancel', done);
  }

  get axes(): StickAxes { return this.value; }

  private move(event: PointerEvent): void {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - this.centerX;
    const dy = event.clientY - this.centerY;
    this.value = stickAxes(dx, dy, this.radius);
    const length = Math.hypot(dx, dy);
    const distance = Math.min(1, length / this.radius);
    const fraction = length > 0 ? distance * this.radius / length : 0;
    // Visual thumb follows physical finger; game input uses the smooth dead zone.
    if (this.thumb) this.thumb.style.transform =
      `translate(-50%, -50%) translate(${(dx * fraction).toFixed(1)}px, ${(dy * fraction).toFixed(1)}px)`;
  }

  reset(): void {
    this.pointerId = null;
    this.value = ZERO_STICK;
    this.base?.classList.remove('engaged');
    if (this.thumb) this.thumb.style.transform = 'translate(-50%, -50%)';
  }
}
