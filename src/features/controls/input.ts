export type DriveKey = 'accelerate' | 'brake' | 'left' | 'right';

export class GameInput {
  private readonly keyboard = new Set<DriveKey>();
  private readonly touch = new Set<DriveKey>();
  private keyMap: Record<string, DriveKey> = {
    arrowup: 'accelerate', w: 'accelerate',
    arrowdown: 'brake', s: 'brake',
    arrowleft: 'left', a: 'left',
    arrowright: 'right', d: 'right',
  };

  constructor() {
    window.addEventListener('keydown', (event) => {
      const key = this.keyMap[event.key.toLowerCase()];
      if (key) { event.preventDefault(); this.keyboard.add(key); }
    });
    window.addEventListener('keyup', (event) => {
      const key = this.keyMap[event.key.toLowerCase()];
      if (key) { event.preventDefault(); this.keyboard.delete(key); }
    });
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
    for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-control]')) {
      const action = btn.dataset.control as DriveKey;
      const release = () => { this.touch.delete(action); btn.classList.remove('active'); };
      btn.addEventListener('pointerdown', (event) => {
        event.preventDefault(); btn.setPointerCapture(event.pointerId);
        this.touch.add(action); btn.classList.add('active');
      });
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
    }
  }

  pressed(key: DriveKey): boolean { return this.keyboard.has(key) || this.touch.has(key); }
  reset(): void { this.keyboard.clear(); this.touch.clear(); document.querySelectorAll('[data-control]').forEach(e => e.classList.remove('active')); }
}
