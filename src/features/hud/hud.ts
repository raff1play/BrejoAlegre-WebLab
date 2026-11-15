import type { HudContext, HudMode } from './hudContext';
import { formatDistance } from './minimap';

export type { HudMode } from './hudContext';

/** Thin DOM layer: writes only when a value changes, so the HUD costs nothing per frame. */
const TIPS: Record<HudMode, string> = {
  riding: 'W/S acelerar e frear · A/D virar · F descer (parado)',
  walking: 'WASD andar · F agir/montar perto da moto',
};
const CONTEXT_LABEL: Record<HudContext, string> = { riding: 'Pilotando', walking: 'A pé', base: 'Na base' };

/**
 * HUD-001 adaptive HUD. One set of elements; `data-context` on `#hud` (riding / walking / base)
 * decides in CSS which of them show, so a context switch is one attribute write:
 * - riding: objective, distance, clock, speed, minimap (+ next turn) and the pedals;
 * - walking: objective, the interaction button and what is in the hands and in the top box;
 * - base: receiving, sorting, the player's load and the schedule.
 * Instructions, version, FPS, logistics and the calendar live in the pause screen.
 */
export class Hud {
  private readonly cache = new Map<HTMLElement, string>();
  private readonly els: Record<string, HTMLElement>;
  private toastTimer = 0;
  private current: HudContext | null = null;
  private mode: HudMode | null = null;

  constructor(private readonly root: ParentNode) {
    const pick = (selector: string): HTMLElement => {
      const element = this.root.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`HUD: elemento ${selector} não encontrado`);
      return element;
    };
    this.els = {
      hud: pick('#hud'),
      speed: pick('#speed'), mode: pick('#mode'), tips: pick('#tips'), fps: pick('#fps'), toast: pick('#toast'),
      action: pick('[data-action="mount"]'), graphics: pick('[data-action="graphics"]'), version: pick('#version'),
      title: pick('#objective-title'), detail: pick('#objective-detail'), progress: pick('#parcel-progress'),
      team: pick('#team-progress'), base: pick('#base-status'), baseLoad: pick('#base-load'), baseTime: pick('#base-time'),
      wait: pick('#wait-button'), clock: pick('#clock'), pause: pick('#pause'),
      cargo: pick('#cargo-status'), distance: pick('#objective-distance'),
    };
  }

  private write(element: HTMLElement, text: string): void {
    if (this.cache.get(element) === text) return;
    this.cache.set(element, text);
    element.textContent = text;
  }

  get context(): HudContext | null { return this.current; }

  /** Presentation switch: two attributes on `#hud` (CSS shows/hides the pieces). */
  setContext(context: HudContext, mode: HudMode): void {
    if (mode !== this.mode) { this.mode = mode; this.els.hud!.dataset.mode = mode; }
    if (context === this.current) return;
    this.current = context;
    this.els.hud!.dataset.context = context;
    this.write(this.els.mode!, CONTEXT_LABEL[context]);
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
    this.write(this.els.tips!, TIPS[mode]);
    this.write(this.els.fps!, `${Math.round(fps)} FPS`);
    this.write(this.els.action!, action);
    this.els.action!.classList.toggle('unavailable', !actionAvailable);
  }

  /** `mine`/`team`: the player's progress and the team's, kept apart (see progressSummary). */
  setObjective(title: string, detail: string, mine: string, team: string, wait: string | null): void {
    this.write(this.els.title!, title);
    this.write(this.els.detail!, detail);
    this.write(this.els.progress!, mine);
    this.write(this.els.team!, team);
    const w = this.els.wait!;
    if (wait) this.write(w, wait);
    if (w.hidden === !!wait) w.hidden = !wait;
  }

  /** Base context lines (receiving/sorting/load, schedule). */
  setBase(lines: readonly [string, string]): void {
    this.write(this.els.baseLoad!, lines[0]);
    this.write(this.els.baseTime!, lines[1]);
  }

  /** CORE-015.1: where the parcels are ("2 volumes nas mãos · 4 no baú"); amber while the hands are full. */
  setCargo(label: string, handsFull: boolean): void {
    const el = this.els.cargo!;
    if (label) this.write(el, label);
    if (el.hidden === !!label) el.hidden = !label;
    el.classList.toggle('hands', handsFull);
  }

  /** Distance to the objective along the streets (null hides the chip). */
  setDistance(metres: number | null): void {
    const el = this.els.distance!;
    if (metres !== null) this.write(el, `➤ ${formatDistance(metres)}`);
    if (el.hidden === (metres !== null)) el.hidden = metres === null;
  }

  /** Virtual clock (1 h = 150 real seconds) and whether the 11h–21h working day is on. */
  setClock(label: string, workday: boolean, night: boolean): void {
    const el = this.els.clock!;
    this.write(el, `${night ? '☾' : '☀'} ${label}`);
    el.classList.toggle('off-shift', !workday);
    const title = workday ? 'Em jornada' : 'Fora da jornada';
    if (el.title !== title) el.title = title;
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
