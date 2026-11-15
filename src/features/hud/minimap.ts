import {
  NAV, arcLengths, nextInstruction, nextZoomTarget, pointAt, projectOnRoute, routeManeuvers, shouldReroute,
  type Instruction, type Maneuver, type RerouteState,
} from '../../core/city/navigation';
import { streetRoute, type StreetRoute } from '../../core/city/streetRoute';
import { SECTORS, SECTOR_CENTRE, SECTOR_DATA, type Sector } from '../../core/delivery/sectors';
import { approach } from '../../core/math';
import { BLOCKS, CITY_BOUNDS, CITY_LOTS, DEPOT, ROADS, STORES, depotPoly, pointsOfInterest, type Poi } from '../../world/city/cityPlan';
import { OPEN_SPACES } from '../../world/geo/geoCity';
import { HOUSE_DEPTH, HOUSE_STYLES, frameCorners, houseSpan } from '../../world/layout';

/**
 * Minimap drawn from the same OpenStreetMap-derived data as the 3D world and the traffic (no
 * external map tiles, no paid API).
 *
 * MAP-001: while riding the map turns with the bike (heading up, rider a little below the centre,
 * north badge), zooms out with speed and keeps only what matters for the delivery: the route along
 * the streets, the objective, the next stop and the depot. The next left/right turn and its
 * distance are shown only where the street network has a real junction on the route. Leaving the
 * route for a while recalculates it (with a cooldown). On foot and on the expanded map it is
 * north-up; the expanded map also shows the sectors, every remaining stop (numbered), the shops,
 * the depot and the parked bike.
 *
 * Cost: the static layer is painted once and cached; the window is redrawn at ~11 Hz riding and
 * ~8 Hz otherwise (never per frame) with one drawImage plus a few dozen primitives; a street route
 * is computed only when the objective changes or the rider has clearly left the route.
 */
const PX_PER_M = 1.2;
const WALK_RADIUS = 60;
/** Rider position while heading up (fraction of the height): more road ahead than behind. */
const RIDE_ANCHOR_Y = 0.62;
/** Expanded view: the urban seat (blocks + depot) with a margin — not the empty fields around it. */
const EXPANDED = (() => {
  let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
  for (const b of BLOCKS) for (const p of b.kerb) { minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]); }
  const m = 45;
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, radius: Math.max(maxX - minX, maxZ - minZ) / 2 + m };
})();
const ICON: Record<Poi['kind'], { color: string; glyph: string }> = {
  loja: { color: '#f2b233', glyph: 'L' },
  galpao: { color: '#ffd84a', glyph: 'G' },
  praca: { color: '#7fd06a', glyph: 'P' },
  esporte: { color: '#8fc1e3', glyph: 'C' },
  cemiterio: { color: '#c9c2b2', glyph: '✝' },
  lugar: { color: '#f4f1ea', glyph: '•' },
};
const COLOR = {
  field: '#222b26', block: '#39453b', blockCentre: '#3f4a3c', park: '#4f8f4d', cemetery: '#7d796f',
  depotLot: '#5a554a', depot: '#c9c0aa', house: '#8f958a', shop: '#d9a441',
  casing: '#141a18', road: '#f1eee4', rural: '#b69c6e', main: '#ffcf5e',
  route: '#2fd3ff', routeCasing: '#032b3d', target: '#ff5a3c', stop: '#6fb7ff', bike: '#ffd84a',
};
const ARROW: Record<Instruction['kind'], string> = { left: '↰', right: '↱', straight: '↑' };
const TURN_LABEL: Record<Instruction['kind'], string> = { left: 'Vire à esquerda', right: 'Vire à direita', straight: 'Siga em frente' };

export type MapTarget = Readonly<{ x: number; z: number; kind?: string }>;
export type MapStop = Readonly<{ x: number; z: number; next: boolean }>;

export function formatDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(m / 10) * 10)} m`;
}

export class Minimap {
  /** B1-01: the active career's sector (legacy default Oeste), highlighted on the expanded map. */
  playerSector: Sector = 'Oeste';
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly base: HTMLCanvasElement;
  private readonly nav: HTMLElement | null;
  private readonly stopsLegend: HTMLElement | null;
  private readonly pois = pointsOfInterest();
  private readonly names: { text: string; x: number; z: number; angle: number }[] = [];
  private last = -1;
  private expanded = false;
  private x = 0; private z = 0; private yaw = 0;
  private riding = false;
  private radius = WALK_RADIUS; private zoomTarget = WALK_RADIUS;
  private target: MapTarget | null = null;
  private stops: readonly MapStop[] = [];
  private bike: { x: number; z: number } | null = null;
  // Route and guidance.
  private route: StreetRoute | null = null;
  private arcs: number[] = [];
  private maneuvers: Maneuver[] = [];
  private routeTarget: { x: number; z: number } | null = null;
  private near = false;
  private progress = { s: 0, d: 0, index: 0 };
  private reroute: RerouteState = { offSince: null, lastRoute: -Infinity };
  private routeVersion = 0;
  private instruction: Instruction | null = null;
  private navText = '';
  private drawMs = 0;
  private draws = 0;

  /** Current objective (star; pointer at the edge with the distance when off the window). */
  setTarget(t: MapTarget | null): void { this.target = t; }
  /** Delivery stops still to do (the next one is highlighted). */
  setStops(stops: readonly MapStop[]): void { this.stops = stops; }
  /** The parked bike while the rider is on foot (null while riding). */
  setBike(bike: { x: number; z: number } | null): void { this.bike = bike; }

  constructor(doc: Document) {
    const root = doc.querySelector<HTMLElement>('#minimap');
    const canvas = doc.querySelector<HTMLCanvasElement>('#minimap-canvas');
    if (!root || !canvas) throw new Error('HUD: minimapa não encontrado');
    this.root = root; this.canvas = canvas;
    this.nav = doc.querySelector<HTMLElement>('#nav-turn');
    this.stopsLegend = doc.querySelector<HTMLElement>('#legend-stops');
    this.ctx = canvas.getContext('2d')!;
    this.base = doc.createElement('canvas');
    this.paintBase();
    this.placeNames();
    const toggle = (e: Event) => { e.preventDefault(); e.stopPropagation(); this.setExpanded(!this.expanded); };
    root.addEventListener('pointerup', toggle);
    root.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e); });
    doc.addEventListener('keydown', (e) => { if (e.code === 'KeyM' && !e.repeat) this.setExpanded(!this.expanded); });
  }

  get isExpanded(): boolean { return this.expanded; }

  /** Static layer as PNG (1.2 px/m, north up, CITY_BOUNDS) — used for the CORE-015 map comparison. */
  baseImage(): { url: string; pxPerM: number } { return { url: this.base.toDataURL('image/png'), pxPerM: PX_PER_M }; }

  setExpanded(on: boolean): void {
    this.expanded = on;
    this.root.classList.toggle('expanded', on);
    this.root.setAttribute('aria-expanded', String(on));
    this.root.setAttribute('aria-label', on ? 'Mapa ampliado — toque para fechar' : 'Minimapa — toque para ampliar');
    this.last = -1;
  }

  /** Distance to the objective along the streets (metres), or the straight distance. */
  targetDistance(): number | null {
    if (!this.target) return null;
    if (!this.route) return Math.hypot(this.target.x - this.x, this.target.z - this.z);
    const left = Math.max(0, this.route.length - this.progress.s);
    return left + (this.progress.d > NAV.offRouteM ? this.progress.d : 0);
  }

  private sx(x: number): number { return (x - CITY_BOUNDS.minX) * PX_PER_M; }
  private sz(z: number): number { return (CITY_BOUNDS.maxZ - z) * PX_PER_M; }

  private paintBase(): void {
    const w = (CITY_BOUNDS.maxX - CITY_BOUNDS.minX) * PX_PER_M;
    const h = (CITY_BOUNDS.maxZ - CITY_BOUNDS.minZ) * PX_PER_M;
    this.base.width = w; this.base.height = h;
    const c = this.base.getContext('2d')!;
    c.fillStyle = COLOR.field;
    c.fillRect(0, 0, w, h);
    const poly = (pts: readonly (readonly [number, number])[], fill: string) => {
      c.fillStyle = fill; c.beginPath();
      pts.forEach((p, i) => (i ? c.lineTo(this.sx(p[0]), this.sz(p[1])) : c.moveTo(this.sx(p[0]), this.sz(p[1]))));
      c.closePath(); c.fill();
    };
    for (const b of BLOCKS) poly(b.kerb, b.sector === 'centro' ? COLOR.blockCentre : COLOR.block);
    for (const a of OPEN_SPACES) poly(a.pts, a.kind === 'landuse:cemetery' ? COLOR.cemetery : COLOR.park);
    poly(depotPoly(DEPOT.lot).pts, COLOR.depotLot);
    // Buildings: estimated house bodies, the (fictional) shops and the depot shed.
    for (const l of CITY_LOTS) {
      const style = HOUSE_STYLES[l.style % HOUSE_STYLES.length]!;
      const [x0, x1] = houseSpan({ garageSide: style.garageSide, lotWidth: l.width });
      const sb = Math.min(style.setback, Math.max(1.5, l.depth - HOUSE_DEPTH - 0.5));
      poly(frameCorners(l.frame, x0, x1, sb, sb + HOUSE_DEPTH), COLOR.house);
    }
    for (const s of STORES) poly(frameCorners(s.frame, 0, s.width, 1.5, s.depth), COLOR.shop);
    poly(depotPoly(DEPOT.building).pts, COLOR.depot);
    // Streets: dark casing first, then the light fill, so every street reads against any ground.
    c.lineCap = 'round'; c.lineJoin = 'round';
    const line = (pts: readonly (readonly [number, number])[]) => {
      c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(this.sx(p[0]), this.sz(p[1])) : c.moveTo(this.sx(p[0]), this.sz(p[1])))); c.stroke();
    };
    const width = (r: (typeof ROADS)[number]) => (r.kind === 'urban' ? 8 : 6.5) * PX_PER_M;
    c.strokeStyle = COLOR.casing;
    for (const r of ROADS) { c.lineWidth = width(r) + 3.2; line(r.pts); }
    for (const r of ROADS) { c.strokeStyle = r.kind === 'rural' ? COLOR.rural : COLOR.road; c.lineWidth = width(r); line(r.pts); }
    for (const r of ROADS) {
      if (!r.highway.startsWith('secondary')) continue;
      c.strokeStyle = COLOR.main; c.lineWidth = PX_PER_M * 2.4;
      line(r.pts);
    }
  }

  /** One label per named street, on its longest stretch (drawn only on the expanded map). */
  private placeNames(): void {
    const best = new Map<string, { len: number; x: number; z: number; angle: number }>();
    for (const r of ROADS) {
      if (/sem nome/i.test(r.name)) continue;
      for (let i = 1; i < r.pts.length; i++) {
        const a = r.pts[i - 1]!; const b = r.pts[i]!;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 60 || len <= (best.get(r.name)?.len ?? 0)) continue;
        let angle = Math.atan2(-(b[1] - a[1]), b[0] - a[0]); // screen angle (north-up, y down)
        if (angle > Math.PI / 2) angle -= Math.PI; else if (angle < -Math.PI / 2) angle += Math.PI;
        best.set(r.name, { len, x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, angle });
      }
    }
    for (const [text, v] of best) this.names.push({ text: text.replace(/^Rua /, 'R. ').replace(/^Avenida /, 'Av. ').replace(/^Estrada Municipal /, 'Estr. '), x: v.x, z: v.z, angle: v.angle });
  }

  private computeRoute(now: number, t: MapTarget): void {
    this.route = streetRoute({ x: this.x, z: this.z }, t);
    this.arcs = this.route ? arcLengths(this.route.points) : [];
    this.maneuvers = this.route ? routeManeuvers(this.route) : [];
    this.reroute = { offSince: null, lastRoute: now };
    this.routeVersion++;
  }

  /** Objective changed → new route; rider clearly off the route for a while → new route; else keep. */
  private refreshRoute(now: number): void {
    const t = this.target;
    if (!t) { this.route = null; this.routeTarget = null; this.instruction = null; return; }
    const straight = Math.hypot(t.x - this.x, t.z - this.z);
    const moved = !this.routeTarget || Math.hypot(t.x - this.routeTarget.x, t.z - this.routeTarget.z) > 4;
    if (moved) this.routeTarget = { x: t.x, z: t.z };
    // Close by (inside a shop, across the pavement, the next gate) a street route would only
    // confuse: the straight distance is shown instead. Hysteresis avoids flicker at the limit.
    this.near = straight < (this.near ? NAV.nearLeaveM : NAV.nearEnterM);
    if (this.near) { this.route = null; this.instruction = null; return; }
    if (moved || (!this.route && now - this.reroute.lastRoute >= NAV.rerouteCooldownMs)) this.computeRoute(now, t);
    else if (this.route) {
      this.progress = projectOnRoute(this.route.points, this.arcs, this.x, this.z);
      if (shouldReroute(this.reroute, this.progress.d, now)) this.computeRoute(now, t);
    }
    if (this.route) {
      this.progress = projectOnRoute(this.route.points, this.arcs, this.x, this.z);
      // Guidance only while the rider is on the route: a wrong arrow is worse than none.
      this.instruction = this.progress.d <= NAV.offRouteM ? nextInstruction(this.maneuvers, this.progress.s, this.route.length) : null;
    } else this.instruction = null;
  }

  private writeNav(): void {
    if (!this.nav) return;
    const show = this.riding && !this.expanded && this.instruction !== null;
    const text = show ? `${ARROW[this.instruction!.kind]} ${formatDistance(this.instruction!.distance)}` : '';
    if (text !== this.navText) {
      this.navText = text;
      this.nav.textContent = text;
      this.nav.dataset.kind = show ? this.instruction!.kind : '';
      this.nav.setAttribute('aria-label', show ? `${TURN_LABEL[this.instruction!.kind]} em ${formatDistance(this.instruction!.distance)}` : '');
    }
    if (this.nav.hidden === show) this.nav.hidden = !show;
  }

  /** `riding`/`speed` (m/s) select heading-up and the speed zoom. */
  update(x: number, z: number, yaw: number, now: number, riding = false, speed = 0): void {
    this.x = x; this.z = z; this.yaw = yaw; this.riding = riding;
    const interval = riding && !this.expanded ? 90 : 120;
    if (now - this.last < interval) return;
    const dt = this.last < 0 ? 1 : Math.min(1, (now - this.last) / 1000);
    this.last = now;
    const t0 = performance.now();
    // Speed zoom (riding) with a dead band and a smooth approach; on foot a fixed close view.
    this.zoomTarget = riding ? nextZoomTarget(this.zoomTarget, Math.abs(speed) * 3.6) : WALK_RADIUS;
    this.radius = approach(this.radius, this.zoomTarget, NAV.zoomRate, dt);
    this.refreshRoute(now);
    this.writeNav();
    if (this.stopsLegend) {
      const text = `${this.stops.length} parada${this.stops.length === 1 ? '' : 's'} restante${this.stops.length === 1 ? '' : 's'}`;
      if (this.stopsLegend.textContent !== text) this.stopsLegend.textContent = text;
    }
    this.draw(now);
    this.drawMs = this.draws ? this.drawMs * 0.9 + (performance.now() - t0) * 0.1 : performance.now() - t0;
    this.draws++;
  }

  /** Copies the part of the cached static layer around (cx, cz) into the current transform. */
  private blitBase(c: CanvasRenderingContext2D, cx: number, cz: number, ext: number, k: number): void {
    const sx0 = this.sx(cx - ext); const sy0 = this.sz(cz + ext); const sw = 2 * ext * PX_PER_M;
    const x0 = Math.max(0, sx0); const y0 = Math.max(0, sy0);
    const x1 = Math.min(this.base.width, sx0 + sw); const y1 = Math.min(this.base.height, sy0 + sw);
    if (x1 <= x0 || y1 <= y0) return;
    const scale = k / PX_PER_M;
    c.drawImage(this.base, x0, y0, x1 - x0, y1 - y0, -ext * k + (x0 - sx0) * scale, -ext * k + (y0 - sy0) * scale, (x1 - x0) * scale, (y1 - y0) * scale);
  }

  private draw(now: number): void {
    const css = this.canvas.clientWidth || 120;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = Math.round(css * dpr);
    if (this.canvas.width !== size) { this.canvas.width = size; this.canvas.height = size; }
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = COLOR.field;
    c.fillRect(0, 0, size, size);
    const expanded = this.expanded;
    const headingUp = !expanded && this.riding;
    const cx = expanded ? EXPANDED.cx : this.x;
    const cz = expanded ? EXPANDED.cz : this.z;
    const radius = expanded ? EXPANDED.radius : this.radius;
    const rotation = headingUp ? this.yaw : 0;
    const ax = size / 2; const ay = headingUp ? size * RIDE_ANCHOR_Y : size / 2;
    const k = size / (radius * 2); // screen px per metre
    const cos = Math.cos(-rotation); const sin = Math.sin(-rotation);
    /** World → canvas, rotated so the heading points up while riding. */
    const proj = (wx: number, wz: number): [number, number] => {
      const dx = (wx - cx) * k; const dy = (cz - wz) * k;
      return [ax + dx * cos - dy * sin, ay + dx * sin + dy * cos];
    };
    const inView = (p: [number, number], m: number) => p[0] > -m && p[1] > -m && p[0] < size + m && p[1] < size + m;
    // Rotated world layer: cached streets/blocks, sectors (expanded) and the route.
    c.setTransform(cos, sin, -sin, cos, ax, ay);
    c.imageSmoothingEnabled = true;
    this.blitBase(c, cx, cz, headingUp ? radius * 1.7 : radius, k);
    const local = (wx: number, wz: number): [number, number] => [(wx - cx) * k, (cz - wz) * k];
    if (expanded) this.drawSectors(c, local, size);
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (this.route && this.route.points.length > 1) {
      const pts = this.route.points;
      const from = pointAt(pts, this.arcs, this.progress.s);
      const path = () => {
        c.beginPath(); c.moveTo(...local(from[0], from[1]));
        for (let i = this.progress.index + 1; i < pts.length; i++) c.lineTo(...local(pts[i]![0], pts[i]![1]));
        c.stroke();
      };
      c.strokeStyle = COLOR.routeCasing; c.lineWidth = (expanded ? 5.5 : 8) * dpr; path();
      c.strokeStyle = COLOR.route; c.lineWidth = (expanded ? 3 : 4.6) * dpr; path();
      // Next turn: a white tick on the route so the arrow above has a place on the map.
      const turn = this.instruction && this.instruction.kind !== 'straight' ? this.maneuvers.find((m) => m.s > this.progress.s + 2) : null;
      if (turn && !expanded) {
        const [tx, ty] = local(turn.x, turn.z);
        c.fillStyle = '#ffffff'; c.strokeStyle = COLOR.routeCasing; c.lineWidth = 1.5 * dpr;
        c.beginPath(); c.arc(tx, ty, 3.2 * dpr, 0, Math.PI * 2); c.fill(); c.stroke();
      }
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    const r = Math.max(6, Math.round(size * (expanded ? 0.017 : 0.058)));
    const disc = (px: number, py: number, rad: number, fill: string, glyph?: string, ink = '#152230') => {
      c.fillStyle = 'rgba(12, 18, 24, .9)'; c.beginPath(); c.arc(px, py, rad + 1.5 * dpr, 0, Math.PI * 2); c.fill();
      c.fillStyle = fill; c.beginPath(); c.arc(px, py, rad, 0, Math.PI * 2); c.fill();
      if (glyph) { c.fillStyle = ink; c.font = `800 ${Math.round(rad * 1.25)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(glyph, px, py + 0.5); }
    };
    if (expanded) this.drawNames(c, proj, size, dpr);
    // Places: riding shows only the depot (secondary icons hidden); on foot the shops too.
    for (const p of this.pois) {
      const secondary = p.kind === 'praca' || p.kind === 'esporte' || p.kind === 'cemiterio' || p.kind === 'lugar';
      if (!expanded && (secondary || (this.riding && p.kind === 'loja'))) continue;
      const q = proj(p.x, p.z);
      if (!inView(q, r)) continue;
      const icon = ICON[p.kind];
      disc(q[0], q[1], p.kind === 'galpao' ? r * (this.riding && !expanded ? 0.8 : 1.15) : r, icon.color, icon.glyph);
      if (expanded && p.kind !== 'loja' && p.kind !== 'lugar') {
        c.font = `700 ${Math.round(r * 1.1)}px system-ui, sans-serif`;
        c.fillStyle = '#f8fafc'; c.strokeStyle = 'rgba(10, 16, 24, .9)'; c.lineWidth = 3 * dpr;
        c.strokeText(p.label, q[0], q[1] - r * 2); c.fillText(p.label, q[0], q[1] - r * 2);
      }
    }
    this.drawStops(c, proj, inView, r, dpr, expanded);
    if (this.bike) { const q = proj(this.bike.x, this.bike.z); if (inView(q, r)) disc(q[0], q[1], r * 0.95, COLOR.bike, 'M'); }
    this.drawTarget(c, proj, size, r, dpr, now, disc);
    // Player: halo + arrow (up while heading-up, turning with the heading on a north-up map).
    const me = proj(this.x, this.z);
    const px = Math.min(size - 6, Math.max(6, me[0])); const py = Math.min(size - 6, Math.max(6, me[1]));
    const a = Math.max(9, size * (expanded ? 0.028 : 0.075));
    c.fillStyle = 'rgba(255, 255, 255, .22)'; c.beginPath(); c.arc(px, py, a * 1.25, 0, Math.PI * 2); c.fill();
    c.translate(px, py);
    c.rotate(headingUp ? 0 : this.yaw);
    c.fillStyle = '#ff4d2e'; c.strokeStyle = '#ffffff'; c.lineWidth = 2.2 * dpr;
    c.beginPath(); c.moveTo(0, -a); c.lineTo(a * 0.66, a * 0.72); c.lineTo(0, a * 0.34); c.lineTo(-a * 0.66, a * 0.72); c.closePath();
    c.fill(); c.stroke();
    c.setTransform(1, 0, 0, 1, 0, 0);
    this.drawNorth(c, proj, size, dpr, k, expanded, headingUp, cx, cz);
  }

  /** The four delivery sectors (dominant-axis wedges around the town centre), expanded map only. */
  private drawSectors(c: CanvasRenderingContext2D, local: (x: number, z: number) => [number, number], size: number): void {
    const o = SECTOR_CENTRE; const R = 4000;
    const wedge: Record<(typeof SECTORS)[number], [number, number][]> = {
      Norte: [[-R, R], [R, R]], Sul: [[R, -R], [-R, -R]], Leste: [[R, R], [R, -R]], Oeste: [[-R, -R], [-R, R]],
    };
    c.save();
    c.globalAlpha = 0.16;
    for (const s of SECTORS) {
      c.fillStyle = SECTOR_DATA[s].color;
      c.beginPath(); c.moveTo(...local(o.x, o.z));
      for (const [dx, dz] of wedge[s]) c.lineTo(...local(o.x + dx, o.z + dz));
      c.closePath(); c.fill();
    }
    c.globalAlpha = 0.5; c.strokeStyle = '#e8eef5'; c.lineWidth = Math.max(1, size / 400); c.setLineDash([size / 80, size / 80]);
    c.beginPath(); c.moveTo(...local(o.x - R, o.z - R)); c.lineTo(...local(o.x + R, o.z + R));
    c.moveTo(...local(o.x - R, o.z + R)); c.lineTo(...local(o.x + R, o.z - R)); c.stroke();
    c.restore();
    // Labels a little inside each wedge.
    const d = EXPANDED.radius * 0.78;
    const at: Record<(typeof SECTORS)[number], [number, number]> = { Norte: [0, d], Sul: [0, -d], Leste: [d, 0], Oeste: [-d, 0] };
    c.save();
    c.font = `800 ${Math.round(size * 0.024)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const pad = size * 0.02;
    for (const s of SECTORS) {
      const text = s === this.playerSector ? `${s.toUpperCase()} · seu setor` : s.toUpperCase();
      const half = c.measureText(text).width / 2 + pad;
      // Kept inside the window (local coordinates are centred on it).
      const [rx, ry] = local(o.x + at[s][0], o.z + at[s][1]);
      const lx = Math.max(-size / 2 + half, Math.min(size / 2 - half, rx));
      const ly = Math.max(-size / 2 + pad * 2, Math.min(size / 2 - pad * 2, ry));
      c.strokeStyle = 'rgba(10, 16, 24, .9)'; c.lineWidth = size / 160; c.strokeText(text, lx, ly);
      c.fillStyle = SECTOR_DATA[s].color; c.fillText(text, lx, ly);
    }
    c.restore();
  }

  private drawNames(c: CanvasRenderingContext2D, proj: (x: number, z: number) => [number, number], size: number, dpr: number): void {
    const fs = Math.max(10 * dpr, Math.round(size * 0.021));
    c.font = `700 ${fs}px system-ui, sans-serif`;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const placed: [number, number][] = [];
    for (const n of this.names) {
      const [nx, ny] = proj(n.x, n.z);
      // Skip a name that would sit on top of another one.
      if (placed.some((q) => Math.hypot(q[0] - nx, q[1] - ny) < fs * 2.6)) continue;
      placed.push([nx, ny]);
      c.save(); c.translate(nx, ny); c.rotate(n.angle);
      c.strokeStyle = 'rgba(241, 238, 228, .92)'; c.lineWidth = 3 * dpr; c.strokeText(n.text, 0, 0);
      c.fillStyle = '#1b2430'; c.fillText(n.text, 0, 0);
      c.restore();
    }
  }

  /**
   * Delivery stops. Expanded: every remaining stop numbered in route order, the next one white.
   * Riding: the next stop as a house, the others as small dots. On foot: house markers.
   */
  private drawStops(c: CanvasRenderingContext2D, proj: (x: number, z: number) => [number, number], inView: (p: [number, number], m: number) => boolean, r: number, dpr: number, expanded: boolean): void {
    this.stops.forEach((s, i) => {
      const [px, py] = proj(s.x, s.z);
      if (!inView([px, py], r)) return;
      if (!expanded && this.riding && !s.next) {
        c.fillStyle = 'rgba(12, 18, 24, .85)'; c.beginPath(); c.arc(px, py, r * 0.38 + dpr, 0, Math.PI * 2); c.fill();
        c.fillStyle = COLOR.stop; c.beginPath(); c.arc(px, py, r * 0.38, 0, Math.PI * 2); c.fill();
        return;
      }
      const q = (s.next ? 0.95 : 0.7) * r * (expanded ? 1.15 : 1);
      c.fillStyle = s.next ? COLOR.target : 'rgba(12, 18, 24, .9)';
      c.fillRect(px - q - 1.5 * dpr, py - q - 1.5 * dpr, 2 * q + 3 * dpr, 2 * q + 3 * dpr);
      c.fillStyle = s.next ? '#ffffff' : COLOR.stop; c.fillRect(px - q, py - q, 2 * q, 2 * q);
      if (expanded) {
        c.fillStyle = s.next ? COLOR.target : '#0f2a44';
        c.font = `800 ${Math.round(q * 1.3)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(i + 1), px, py + 0.5);
        return;
      }
      c.fillStyle = s.next ? COLOR.target : '#0f2a44';
      c.beginPath(); c.moveTo(px, py - q * 0.75); c.lineTo(px + q * 0.75, py); c.lineTo(px + q * 0.45, py); c.lineTo(px + q * 0.45, py + q * 0.65);
      c.lineTo(px - q * 0.45, py + q * 0.65); c.lineTo(px - q * 0.45, py); c.lineTo(px - q * 0.75, py); c.closePath(); c.fill();
    });
  }

  /** Objective: pulsing star; when it is off the window, a pointer at the edge with the distance. */
  private drawTarget(c: CanvasRenderingContext2D, proj: (x: number, z: number) => [number, number], size: number, r: number, dpr: number, now: number,
    disc: (px: number, py: number, rad: number, fill: string, glyph?: string, ink?: string) => void): void {
    if (!this.target) return;
    const [tx0, ty0] = proj(this.target.x, this.target.z);
    const m = r * 1.9;
    const off = tx0 < m || ty0 < m || tx0 > size - m || ty0 > size - m;
    const tx = Math.min(size - m, Math.max(m, tx0)); const ty = Math.min(size - m, Math.max(m, ty0));
    const pulse = 0.5 + 0.5 * Math.sin(now / 260);
    c.strokeStyle = `rgba(255, 90, 60, ${0.25 + 0.45 * pulse})`; c.lineWidth = 2 * dpr;
    c.beginPath(); c.arc(tx, ty, r * (1.5 + 0.6 * pulse), 0, Math.PI * 2); c.stroke();
    const ang = Math.atan2(ty0 - size / 2, tx0 - size / 2);
    if (off) {
      c.save(); c.translate(tx, ty); c.rotate(ang);
      c.fillStyle = COLOR.target; c.strokeStyle = '#ffffff'; c.lineWidth = 1.5 * dpr;
      c.beginPath(); c.moveTo(r * 2.1, 0); c.lineTo(r * 0.9, -r * 0.95); c.lineTo(r * 0.9, r * 0.95); c.closePath(); c.fill(); c.stroke();
      c.restore();
    }
    disc(tx, ty, r * 1.1, COLOR.target, '★', '#ffffff');
    const d = this.targetDistance();
    if (off && d !== null && !this.expanded) {
      const text = formatDistance(d);
      c.font = `800 ${Math.round(r * 1.15)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      const lx = Math.min(size - r * 3.2, Math.max(r * 3.2, tx - Math.cos(ang) * r * 3.4));
      const ly = Math.min(size - r * 1.6, Math.max(r * 1.6, ty - Math.sin(ang) * r * 3.4));
      c.strokeStyle = 'rgba(10, 16, 24, .95)'; c.lineWidth = 3.5 * dpr; c.strokeText(text, lx, ly);
      c.fillStyle = '#ffffff'; c.fillText(text, lx, ly);
    }
  }

  /** North: a badge on the rim that turns with the map (heading-up), or "N" at the top. */
  private drawNorth(c: CanvasRenderingContext2D, proj: (x: number, z: number) => [number, number], size: number, dpr: number, k: number,
    expanded: boolean, headingUp: boolean, cx: number, cz: number): void {
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (expanded) {
      // Scale bar (100 m) and north mark.
      const bar = 100 * k; const bx = size * 0.04; const by = size * 0.965;
      c.fillStyle = 'rgba(10, 16, 24, .85)'; c.fillRect(bx - 4 * dpr, by - 14 * dpr, bar + 8 * dpr, 20 * dpr);
      c.fillStyle = '#ffffff'; c.fillRect(bx, by, bar, 2.5 * dpr);
      c.font = `700 ${Math.round(10 * dpr)}px system-ui, sans-serif`; c.textAlign = 'left'; c.fillText('100 m', bx, by - 7 * dpr);
      c.textAlign = 'center'; c.font = `800 ${Math.round(13 * dpr)}px system-ui, sans-serif`;
      c.strokeStyle = 'rgba(10, 16, 24, .9)'; c.lineWidth = 3 * dpr; c.strokeText('N ↑', size * 0.94, size * 0.04);
      c.fillText('N ↑', size * 0.94, size * 0.04);
      return;
    }
    let nx = size / 2; let ny = size * 0.085;
    if (headingUp) {
      const a = proj(cx, cz); const b = proj(cx, cz + 10);
      const dx = b[0] - a[0]; const dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1;
      nx = size / 2 + (dx / d) * size * 0.4; ny = size / 2 + (dy / d) * size * 0.4;
    }
    const br = Math.max(8, size * 0.075);
    c.fillStyle = 'rgba(10, 16, 24, .82)'; c.beginPath(); c.arc(nx, ny, br, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#ff5a3c'; c.lineWidth = 1.6 * dpr; c.stroke();
    c.font = `800 ${Math.round(br * 1.15)}px system-ui, sans-serif`; c.fillStyle = '#ffffff'; c.fillText('N', nx, ny + 0.5);
  }

  /** Player arrow in the canvas as fractions (0–1) of its size, independent of resolution (tests). */
  arrowAt(): { x: number; y: number } {
    if (!this.expanded) return { x: 0.5, y: this.riding ? RIDE_ANCHOR_Y : 0.5 };
    const { cx, cz, radius } = EXPANDED;
    return { x: (this.x - cx) / (radius * 2) + 0.5, y: (cz - this.z) / (radius * 2) + 0.5 };
  }

  /** What the map currently shows (browser tests and cost report). */
  state(): {
    route: number; routeLength: number | null; stops: number; bike: boolean; names: number;
    headingUp: boolean; rotation: number; radius: number; zoomTarget: number; routeVersion: number;
    offRoute: number | null; nav: Instruction | null; maneuvers: number; drawMs: number; draws: number;
  } {
    return {
      route: this.route?.points.length ?? 0, routeLength: this.route?.length ?? null, stops: this.stops.length, bike: this.bike !== null, names: this.names.length,
      headingUp: this.riding && !this.expanded, rotation: this.riding && !this.expanded ? this.yaw : 0, radius: this.expanded ? EXPANDED.radius : this.radius, zoomTarget: this.zoomTarget,
      routeVersion: this.routeVersion, offRoute: this.route ? this.progress.d : null, nav: this.instruction, maneuvers: this.maneuvers.length,
      drawMs: Math.round(this.drawMs * 100) / 100, draws: this.draws,
    };
  }
}
