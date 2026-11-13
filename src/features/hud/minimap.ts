import { BLOCKS, CITY_BOUNDS, DEPOT, ROADS, nodeById, pointsOfInterest, walkableAreas, type Poi } from '../../world/city/cityPlan';
import { ROAD_HALF } from '../../world/layout';

/**
 * CORE-013 minimap drawn from the same city plan as the 3D world (no external map tiles).
 * North-up; the player is the arrow. The static layer is painted once; the visible window is
 * redrawn at ~8 Hz, never per frame. Tap/click (or M) toggles the expanded map with a legend.
 */
const PX_PER_M = 2;
const VIEW_RADIUS = 70;
/** Expanded view: the built-up town (grid, depot, exits' first metres). */
const EXPANDED = { cx: 34, cz: -37, radius: 125 };
const ICON: Record<Poi['kind'], { color: string; glyph: string }> = {
  loja: { color: '#e8b348', glyph: 'L' },
  galpao: { color: '#f2c230', glyph: 'G' },
  igreja: { color: '#f4f1ea', glyph: '✝' },
  escola: { color: '#8fc1e3', glyph: 'E' },
  servicos: { color: '#b9a5d6', glyph: 'S' },
  onibus: { color: '#58c27d', glyph: 'B' },
  praca: { color: '#7fc46a', glyph: 'P' },
};
const SECTOR_FILL: Record<string, string> = {
  centro: '#4b5b44', residencial: '#465a3f', comercial: '#5a5547', logistico: '#56503f', periferia: '#3f5136',
};

export class Minimap {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly base: HTMLCanvasElement;
  private readonly pois = pointsOfInterest();
  private last = -1;
  private expanded = false;
  private x = 0; private z = 0; private yaw = 0;

  constructor(doc: Document) {
    const root = doc.querySelector<HTMLElement>('#minimap');
    const canvas = doc.querySelector<HTMLCanvasElement>('#minimap-canvas');
    if (!root || !canvas) throw new Error('HUD: minimapa não encontrado');
    this.root = root; this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.base = doc.createElement('canvas');
    this.paintBase();
    const toggle = (e: Event) => { e.preventDefault(); e.stopPropagation(); this.setExpanded(!this.expanded); };
    root.addEventListener('pointerup', toggle);
    root.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e); });
    doc.addEventListener('keydown', (e) => { if (e.code === 'KeyM' && !e.repeat) this.setExpanded(!this.expanded); });
  }

  get isExpanded(): boolean { return this.expanded; }

  setExpanded(on: boolean): void {
    this.expanded = on;
    this.root.classList.toggle('expanded', on);
    this.root.setAttribute('aria-expanded', String(on));
    this.root.setAttribute('aria-label', on ? 'Mapa ampliado — toque para fechar' : 'Minimapa — toque para ampliar');
    this.last = -1;
  }

  private sx(x: number): number { return (x - CITY_BOUNDS.minX) * PX_PER_M; }
  private sz(z: number): number { return (CITY_BOUNDS.maxZ - z) * PX_PER_M; }

  private paintBase(): void {
    const w = (CITY_BOUNDS.maxX - CITY_BOUNDS.minX) * PX_PER_M;
    const h = (CITY_BOUNDS.maxZ - CITY_BOUNDS.minZ) * PX_PER_M;
    this.base.width = w; this.base.height = h;
    const c = this.base.getContext('2d')!;
    c.fillStyle = '#3d4f35';
    c.fillRect(0, 0, w, h);
    const rect = (b: { minX: number; maxX: number; minZ: number; maxZ: number }, fill: string) => {
      c.fillStyle = fill;
      c.fillRect(this.sx(b.minX), this.sz(b.maxZ), (b.maxX - b.minX) * PX_PER_M, (b.maxZ - b.minZ) * PX_PER_M);
    };
    for (const b of BLOCKS) rect(b.box, SECTOR_FILL[b.sector] ?? '#4b5b44');
    for (const a of walkableAreas()) rect(a, '#6f8a58');
    rect(DEPOT.lot, '#6a6455');
    rect({ minX: DEPOT.building.minX, maxX: DEPOT.building.maxX, minZ: DEPOT.building.minZ, maxZ: DEPOT.building.maxZ }, '#9a9488');
    c.lineCap = 'square';
    for (const r of ROADS) {
      const a = nodeById(r.a); const b = nodeById(r.b);
      c.strokeStyle = r.kind === 'rural' ? '#a08a66' : r.kind === 'yard' ? '#77736a' : '#d8d4ca';
      c.lineWidth = (r.kind === 'urban' ? ROAD_HALF * 2 + 2 : ROAD_HALF * 2 - 1) * PX_PER_M;
      c.beginPath(); c.moveTo(this.sx(a.x), this.sz(a.z)); c.lineTo(this.sx(b.x), this.sz(b.z)); c.stroke();
    }
    for (const r of ROADS) {
      if (r.kind !== 'urban') continue;
      const a = nodeById(r.a); const b = nodeById(r.b);
      c.strokeStyle = r.priority >= 2 ? '#f0c75e' : '#ffffff';
      c.lineWidth = PX_PER_M * 1.2;
      c.beginPath(); c.moveTo(this.sx(a.x), this.sz(a.z)); c.lineTo(this.sx(b.x), this.sz(b.z)); c.stroke();
    }
  }

  update(x: number, z: number, yaw: number, now: number): void {
    this.x = x; this.z = z; this.yaw = yaw;
    if (now - this.last < 120) return;
    this.last = now;
    const css = this.canvas.clientWidth || 120;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = Math.round(css * dpr);
    if (this.canvas.width !== size) { this.canvas.width = size; this.canvas.height = size; }
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#2e3c29';
    c.fillRect(0, 0, size, size);
    let cx: number; let cz: number; let radius: number;
    if (this.expanded) {
      ({ cx, cz, radius } = EXPANDED);
    } else { cx = this.x; cz = this.z; radius = VIEW_RADIUS; }
    const k = size / (radius * 2); // screen px per metre
    const toX = (wx: number) => (wx - cx) * k + size / 2;
    const toY = (wz: number) => (cz - wz) * k + size / 2;
    c.imageSmoothingEnabled = true;
    c.drawImage(this.base, this.sx(cx - radius), this.sz(cz + radius), radius * 2 * PX_PER_M, radius * 2 * PX_PER_M, 0, 0, size, size);
    const r = Math.max(6, Math.round(size * (this.expanded ? 0.018 : 0.06)));
    c.font = `800 ${Math.round(r * 1.25)}px system-ui, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const p of this.pois) {
      const px = toX(p.x); const py = toY(p.z);
      if (px < -r || py < -r || px > size + r || py > size + r) continue;
      const icon = ICON[p.kind];
      c.fillStyle = 'rgba(16, 24, 32, .85)';
      c.beginPath(); c.arc(px, py, r + 1.5 * dpr, 0, Math.PI * 2); c.fill();
      c.fillStyle = icon.color;
      c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#152230';
      c.fillText(icon.glyph, px, py + 0.5);
      if (this.expanded && p.kind !== 'onibus' && p.kind !== 'loja') {
        c.font = `700 ${Math.round(r * 1.1)}px system-ui, sans-serif`;
        c.fillStyle = '#f8fafc';
        c.strokeStyle = 'rgba(10, 16, 24, .9)'; c.lineWidth = 3 * dpr;
        c.strokeText(p.label, px, py - r * 2);
        c.fillText(p.label, px, py - r * 2);
        c.font = `800 ${Math.round(r * 1.25)}px system-ui, sans-serif`;
      }
    }
    // Player arrow (north-up map, so it turns with the heading).
    const ax = toX(this.x); const ay = toY(this.z);
    const a = Math.max(8, size * (this.expanded ? 0.025 : 0.075));
    c.translate(ax, ay);
    c.rotate(this.yaw);
    c.fillStyle = '#ff5a3c'; c.strokeStyle = '#ffffff'; c.lineWidth = 2 * dpr;
    c.beginPath(); c.moveTo(0, -a); c.lineTo(a * 0.62, a * 0.7); c.lineTo(0, a * 0.35); c.lineTo(-a * 0.62, a * 0.7); c.closePath();
    c.fill(); c.stroke();
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (!this.expanded) {
      c.fillStyle = 'rgba(248, 250, 252, .85)'; c.font = `800 ${Math.round(size * 0.08)}px system-ui, sans-serif`;
      c.fillText('N', size / 2, size * 0.07);
    }
  }

  /** Player arrow in the canvas as fractions (0–1) of its size, independent of resolution (tests). */
  arrowAt(): { x: number; y: number } {
    if (!this.expanded) return { x: 0.5, y: 0.5 };
    const { cx, cz, radius } = EXPANDED;
    return { x: (this.x - cx) / (radius * 2) + 0.5, y: (cz - this.z) / (radius * 2) + 0.5 };
  }
}
