import type { CameraMode } from '../camera/isometricCamera';

/** Thin DOM layer: writes only when a value changes, so the HUD costs nothing per frame. */
export type HudMode = 'riding' | 'walking';

const TIPS: Record<HudMode, string> = {
  riding: 'W/S acelerar e frear · A/D virar · F descer (parado)',
  walking: 'WASD andar · F montar perto da moto',
};

export class Hud {
  private readonly cache = new Map<HTMLElement, string>();
  private readonly speed: HTMLElement;
  private readonly mode: HTMLElement;
  private readonly tips: HTMLElement;
  private readonly fps: HTMLElement;
  private readonly toastEl: HTMLElement;
  private readonly mountButton: HTMLElement;
  private readonly graphicsButton: HTMLElement;
  private readonly cameraButton: HTMLElement;
  private toastTimer = 0;

  constructor(private readonly root: ParentNode) {
    this.speed = this.find('#speed');
    this.mode = this.find('#mode');
    this.tips = this.find('#tips');
    this.fps = this.find('#fps');
    this.toastEl = this.find('#toast');
    this.mountButton = this.find('[data-action="mount"]');
    this.graphicsButton = this.find('[data-action="graphics"]');
    this.cameraButton = this.find('[data-action="camera-mode"]');
  }

  private find(selector: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(selector);
    if (!element) throw new Error(`HUD: elemento ${selector} não encontrado`);
    return element;
  }

  private write(element: HTMLElement, text: string): void {
    if (this.cache.get(element) === text) return;
    this.cache.set(element, text);
    element.textContent = text;
  }

  setVersion(version: string, environment: string): void {
    this.write(this.find('#version'), `WEB LAB / ${version}${environment === 'production' ? '' : ` · ${environment}`}`);
  }

  setGraphics(profile: string): void {
    this.write(this.graphicsButton, profile === 'mobile' ? 'Gráficos: leve' : 'Gráficos: alto');
  }

  setCameraMode(mode: CameraMode): void {
    const isGta = mode === 'third-person';
    this.write(this.cameraButton, isGta ? 'ISO' : 'GTA');
    this.cameraButton.setAttribute('aria-label', isGta ? 'Mudar para câmera isométrica' : 'Mudar para câmera em terceira pessoa');
    this.cameraButton.setAttribute('aria-pressed', String(isGta));
    this.cameraButton.title = isGta ? 'Mudar para isométrica (C)' : 'Mudar para terceira pessoa (C)';
  }

  update(mode: HudMode, speedKmh: number, fps: number, actionAvailable: boolean): void {
    this.write(this.speed, String(Math.round(speedKmh)));
    this.write(this.mode, mode === 'riding' ? 'Pilotando' : 'A pé');
    this.write(this.tips, TIPS[mode]);
    this.write(this.fps, `${Math.round(fps)} FPS`);
    this.write(this.mountButton, mode === 'riding' ? 'Descer' : 'Montar');
    this.mountButton.classList.toggle('unavailable', !actionAvailable);
  }

  toast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('visible'), 2200);
  }
}
