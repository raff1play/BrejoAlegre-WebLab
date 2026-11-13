/** Thin DOM layer: writes only when a value changes, so the HUD costs nothing per frame. */
export type HudMode = 'riding' | 'walking';

const TIPS: Record<HudMode, string> = {
  riding: 'W/S acelerar e frear · A/D virar · F descer (parado)',
  walking: 'WASD andar · F agir/montar perto da moto',
};

/**
 * CORE-014 minimal HUD: objective, parcel progress, speed, clock + minimap and one contextual
 * action button. Instructions, version, FPS and the fictional-area notice live in the pause screen.
 */
export class Hud {
  private readonly cache = new Map<HTMLElement, string>();
  private readonly els: Record<string, HTMLElement>;
  private toastTimer = 0;

  constructor(private readonly root: ParentNode) {
    const pick = (selector: string): HTMLElement => {
      const element = this.root.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`HUD: elemento ${selector} não encontrado`);
      return element;
    };
    this.els = {
      speed: pick('#speed'), mode: pick('#mode'), tips: pick('#tips'), fps: pick('#fps'), toast: pick('#toast'),
      action: pick('[data-action="mount"]'), graphics: pick('[data-action="graphics"]'), version: pick('#version'),
      title: pick('#objective-title'), detail: pick('#objective-detail'), progress: pick('#parcel-progress'),
      wait: pick('#wait-button'), clock: pick('#clock'), clockTag: pick('#clock-tag'), pause: pick('#pause'),
    };
  }

  private write(element: HTMLElement, text: string): void {
    if (this.cache.get(element) === text) return;
    this.cache.set(element, text);
    element.textContent = text;
  }

  setVersion(version: string, environment: string): void {
    this.write(this.els.version!, `WEB LAB / ${version}${environment === 'production' ? '' : ` · ${environment}`}`);
  }

  setGraphics(profile: string): void {
    this.write(this.els.graphics!, profile === 'mobile' ? 'Gráficos: leve' : 'Gráficos: alto');
  }

  /** Contextual action: label and whether it can be used now. */
  update(mode: HudMode, speedKmh: number, fps: number, action: string, actionAvailable: boolean): void {
    this.write(this.els.speed!, String(Math.round(speedKmh)));
    this.write(this.els.mode!, mode === 'riding' ? 'Pilotando' : 'A pé');
    this.write(this.els.tips!, TIPS[mode]);
    this.write(this.els.fps!, `${Math.round(fps)} FPS`);
    this.write(this.els.action!, action);
    this.els.action!.classList.toggle('unavailable', !actionAvailable);
  }

  setObjective(title: string, detail: string, progress: string, wait: string | null): void {
    this.write(this.els.title!, title);
    this.write(this.els.detail!, detail);
    this.write(this.els.progress!, progress);
    const w = this.els.wait!;
    if (wait) this.write(w, wait);
    if (w.hidden === !!wait) w.hidden = !wait;
  }

  /** Virtual clock (1 h = 4 real minutes) and whether the 11h–21h working day is on. */
  setClock(label: string, workday: boolean, night: boolean): void {
    this.write(this.els.clock!, `${night ? '☾' : '☀'} ${label}`);
    this.write(this.els.clockTag!, workday ? 'Em jornada' : 'Fora da jornada');
  }

  get paused(): boolean { return !this.els.pause!.hidden; }
  setPaused(on: boolean): void { this.els.pause!.hidden = !on; }

  toast(message: string): void {
    const t = this.els.toast!;
    t.textContent = message;
    t.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => t.classList.remove('visible'), 2600);
  }
}
