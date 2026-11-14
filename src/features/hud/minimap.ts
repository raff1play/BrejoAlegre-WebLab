import { streetRoute, type StreetRoute } from '../../core/city/streetRoute';
import { BLOCKS, CITY_BOUNDS, CITY_LOTS, DEPOT, ROADS, STORES, depotPoly, pointsOfInterest, type Poi } from '../../world/city/cityPlan';
import { OPEN_SPACES } from '../../world/geo/geoCity';
import { HOUSE_DEPTH, HOUSE_STYLES, frameCorners, houseSpan } from '../../world/layout';

/**
 * Minimap drawn from the same OpenStreetMap-derived data as the 3D world and the traffic (no
 * external map tiles, no paid API). TRUE north-up; the player is the arrow.
 *
 * CORE-015.1: higher contrast (dark fields, cased light streets, building footprints), the route to
 * the objective drawn ALONG THE STREETS (core/city/streetRoute), distinct markers for shops, the
 * depot, delivery stops and the parked bike, an edge pointer with the distance when the objective
 * is off the window, street names and a scale bar on the expanded map.
 *
 * Cost: the static layer is painted once; the window is redrawn at ~8 Hz (never per frame) with one
 * drawImage plus a few dozen primitives; the route is recomputed only when the player has moved
 * 15 m or the objective changed.
 */
const PX_PER_M = 1.2;
const VIEW_RADIUS = 80;
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
  route: '#38c8ff', routeCasing: '#07354a', target: '#ff5a3c', stop: '#6fb7ff', bike: '#ffd84a',
};

export type MapTarget = Readonly<{ x: number; z: number; kind?: string }>;
export type MapStop = Readonly<{ x: number; z: number; next: boolean }>;

export class Minimap {
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly base: HTMLCanvasElement;
  private readonly pois = pointsOfInterest();
  private readonly names: { text: string; x: number; z: number; angle: number }[] = [];
  private last = -1;
  private expanded = false;
  private x = 0; private z = 0; private yaw = 0;
  private target: MapTarget | null = null;
  private stops: readonly MapStop[] = [];
  private bike: { x: number; z: number } | null = null;
  private route: StreetRoute | null = null;
  private routeKey = '';
  private routeAt = { x: Infinity, z: Infinity };

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

  /** Route length to the objective along the streets (metres), or the straight distance. */
  targetDistance(): number | null {
    if (!this.target) return null;
    return this.route ? this.route.length : Math.hypot(this.target.x - this.x, this.target.z - this.z);
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

  private refreshRoute(): void {
    const t = this.target;
    const key = t ? `${t.x.toFixed(1)},${t.z.toFixed(1)}` : '';
    if (!t) { this.route = null; this.routeKey = ''; return; }
    if (key === this.routeKey && Math.hypot(this.x - this.routeAt.x, this.z - this.routeAt.z) < 15) return;
    this.routeKey = key; this.routeAt = { x: this.x, z: this.z };
    // Close by (inside a shop, across the pavement, the next gate) a street route would only
    // confuse: the straight distance is shown instead.
    this.route = Math.hypot(t.x - this.x, t.z - this.z) < 60 ? null : streetRoute({ x: this.x, z: this.z }, t);
  }

  update(x: number, z: number, yaw: number, now: number): void {
    this.x = x; this.z = z; this.yaw = yaw;
    if (now - this.last < 120) return;
    this.last = now;
    this.refreshRoute();
    const css = this.canvas.clientWidth || 120;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = Math.round(css * dpr);
    if (this.canvas.width !== size) { this.canvas.width = size; this.canvas.height = size; }
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = COLOR.field;
    c.fillRect(0, 0, size, size);
    let cx: number; let cz: number; let radius: number;
    if (this.expanded) {
      ({ cx, cz, radius } = EXPANDED);
    } else { cx = this.x; cz = this.z; radius = VIEW_RADIUS; }
    const k = size / (radius * 2); // screen px per metre
    const toX = (wx: number) => (wx - cx) * k + size / 2;
    const toY = (wz: number) => (cz - wz) * k + size / 2;
    const inView = (px: number, py: number, m: number) => px > -m && py > -m && px < size + m && py < size + m;
    c.imageSmoothingEnabled = true;
    c.drawImage(this.base, this.sx(cx - radius), this.sz(cz + radius), radius * 2 * PX_PER_M, radius * 2 * PX_PER_M, 0, 0, size, size);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const r = Math.max(6, Math.round(size * (this.expanded ? 0.017 : 0.058)));
    const disc = (px: number, py: number, rad: number, fill: string, glyph?: string, ink = '#152230') => {
      c.fillStyle = 'rgba(12, 18, 24, .9)'; c.beginPath(); c.arc(px, py, rad + 1.5 * dpr, 0, Math.PI * 2); c.fill();
      c.fillStyle = fill; c.beginPath(); c.arc(px, py, rad, 0, Math.PI * 2); c.fill();
      if (glyph) { c.fillStyle = ink; c.font = `800 ${Math.round(rad * 1.25)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(glyph, px, py + 0.5); }
    };
    // Street names (expanded map only).
    if (this.expanded) {
      const fs = Math.max(10 * dpr, Math.round(size * 0.021));
      c.font = `700 ${fs}px system-ui, sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const placed: [number, number][] = [];
      for (const n of this.names) {
        const nx = toX(n.x); const ny = toY(n.z);
        // Skip a name that would sit on top of another one.
        if (placed.some((q) => Math.hypot(q[0] - nx, q[1] - ny) < fs * 2.6)) continue;
        placed.push([nx, ny]);
        c.save(); c.translate(nx, ny); c.rotate(n.angle);
        c.strokeStyle = 'rgba(241, 238, 228, .92)'; c.lineWidth = 3 * dpr; c.strokeText(n.text, 0, 0);
        c.fillStyle = '#1b2430'; c.fillText(n.text, 0, 0);
        c.restore();
      }
    }
    // Route to the objective, along the streets.
    if (this.route && this.route.points.length > 1) {
      const path = () => { c.beginPath(); this.route!.points.forEach((p, i) => (i ? c.lineTo(toX(p[0]), toY(p[1])) : c.moveTo(toX(p[0]), toY(p[1])))); c.stroke(); };
      c.strokeStyle = COLOR.routeCasing; c.lineWidth = (this.expanded ? 5 : 6.5) * dpr; path();
      c.strokeStyle = COLOR.route; c.lineWidth = (this.expanded ? 2.6 : 3.6) * dpr; path();
    }
    // Places: shops, depot, real open spaces.
    for (const p of this.pois) {
      if (!this.expanded && (p.kind === 'praca' || p.kind === 'esporte' || p.kind === 'cemiterio' || p.kind === 'lugar')) continue;
      const px = toX(p.x); const py = toY(p.z);
      if (!inView(px, py, r)) continue;
      const icon = ICON[p.kind];
      disc(px, py, p.kind === 'galpao' ? r * 1.15 : r, icon.color, icon.glyph);
      if (this.expanded && p.kind !== 'loja' && p.kind !== 'lugar') {
        c.font = `700 ${Math.round(r * 1.1)}px system-ui, sans-serif`;
        c.fillStyle = '#f8fafc'; c.strokeStyle = 'rgba(10, 16, 24, .9)'; c.lineWidth = 3 * dpr;
        c.strokeText(p.label, px, py - r * 2); c.fillText(p.label, px, py - r * 2);
      }
    }
    // Delivery stops: small blue house markers, the next one larger.
    for (const s of this.stops) {
      const px = toX(s.x); const py = toY(s.z);
      if (!inView(px, py, r)) continue;
      const q = (s.next ? 0.95 : 0.7) * r;
      c.fillStyle = 'rgba(12, 18, 24, .9)'; c.fillRect(px - q - 1.5 * dpr, py - q - 1.5 * dpr, 2 * q + 3 * dpr, 2 * q + 3 * dpr);
      c.fillStyle = s.next ? '#ffffff' : COLOR.stop; c.fillRect(px - q, py - q, 2 * q, 2 * q);
      c.fillStyle = s.next ? COLOR.target : '#0f2a44';
      c.beginPath(); c.moveTo(px, py - q * 0.75); c.lineTo(px + q * 0.75, py); c.lineTo(px + q * 0.45, py); c.lineTo(px + q * 0.45, py + q * 0.65);
      c.lineTo(px - q * 0.45, py + q * 0.65); c.lineTo(px - q * 0.45, py); c.lineTo(px - q * 0.75, py); c.closePath(); c.fill();
    }
    if (this.bike) { const px = toX(this.bike.x); const py = toY(this.bike.z); if (inView(px, py, r)) disc(px, py, r * 0.95, COLOR.bike, 'M'); }
    // Objective: pulsing star; when it is off the window, a pointer at the edge with the distance.
    if (this.target) {
      const tx0 = toX(this.target.x); const ty0 = toY(this.target.z);
      const m = r * 1.9;
      const off = tx0 < m || ty0 < m || tx0 > size - m || ty0 > size - m;
      const tx = Math.min(size - m, Math.max(m, tx0)); const ty = Math.min(size - m, Math.max(m, ty0));
      const pulse = 0.5 + 0.5 * Math.sin(now / 260);
      c.strokeStyle = `rgba(255, 90, 60, ${0.25 + 0.45 * pulse})`; c.lineWidth = 2 * dpr;
      c.beginPath(); c.arc(tx, ty, r * (1.5 + 0.6 * pulse), 0, Math.PI * 2); c.stroke();
      if (off) {
        // Arrow head pointing out of the window towards the objective.
        const ang = Math.atan2(ty0 - size / 2, tx0 - size / 2);
        c.save(); c.translate(tx, ty); c.rotate(ang);
        c.fillStyle = COLOR.target; c.strokeStyle = '#ffffff'; c.lineWidth = 1.5 * dpr;
        c.beginPath(); c.moveTo(r * 2.1, 0); c.lineTo(r * 0.9, -r * 0.95); c.lineTo(r * 0.9, r * 0.95); c.closePath(); c.fill(); c.stroke();
        c.restore();
      }
      disc(tx, ty, r * 1.1, COLOR.target, '★', '#ffffff');
      const d = this.targetDistance();
      if (off && d !== null && !this.expanded) {
        const text = d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${Math.round(d / 10) * 10} m`;
        c.font = `800 ${Math.round(r * 1.25)}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        const lx = Math.min(size - r * 3.2, Math.max(r * 3.2, tx - Math.cos(Math.atan2(ty0 - size / 2, tx0 - size / 2)) * r * 3.4));
        const ly = Math.min(size - r * 1.6, Math.max(r * 1.6, ty - Math.sin(Math.atan2(ty0 - size / 2, tx0 - size / 2)) * r * 3.4));
        c.strokeStyle = 'rgba(10, 16, 24, .95)'; c.lineWidth = 3.5 * dpr; c.strokeText(text, lx, ly);
        c.fillStyle = '#ffffff'; c.fillText(text, lx, ly);
      }
    }
    // Player: halo + arrow (north-up map, so the arrow turns with the heading).
    const ax = Math.min(size - 6, Math.max(6, toX(this.x))); const ay = Math.min(size - 6, Math.max(6, toY(this.z)));
    const a = Math.max(9, size * (this.expanded ? 0.028 : 0.085));
    c.fillStyle = 'rgba(255, 255, 255, .22)'; c.beginPath(); c.arc(ax, ay, a * 1.25, 0, Math.PI * 2); c.fill();
    c.translate(ax, ay);
    c.rotate(this.yaw);
    c.fillStyle = '#ff4d2e'; c.strokeStyle = '#ffffff'; c.lineWidth = 2.2 * dpr;
    c.beginPath(); c.moveTo(0, -a); c.lineTo(a * 0.66, a * 0.72); c.lineTo(0, a * 0.34); c.lineTo(-a * 0.66, a * 0.72); c.closePath();
    c.fill(); c.stroke();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (!this.expanded) {
      c.font = `800 ${Math.round(size * 0.085)}px system-ui, sans-serif`;
      c.strokeStyle = 'rgba(10, 16, 24, .9)'; c.lineWidth = 3 * dpr; c.strokeText('N', size / 2, size * 0.075);
      c.fillStyle = '#ffffff'; c.fillText('N', size / 2, size * 0.075);
    } else {
      // Scale bar (100 m) and north mark.
      const bar = 100 * k; const bx = size * 0.04; const by = size * 0.965;
      c.fillStyle = 'rgba(10, 16, 24, .85)'; c.fillRect(bx - 4 * dpr, by - 14 * dpr, bar + 8 * dpr, 20 * dpr);
      c.fillStyle = '#ffffff'; c.fillRect(bx, by, bar, 2.5 * dpr);
      c.font = `700 ${Math.round(10 * dpr)}px system-ui, sans-serif`; c.textAlign = 'left'; c.fillText('100 m', bx, by - 7 * dpr);
      c.textAlign = 'center'; c.font = `800 ${Math.round(13 * dpr)}px system-ui, sans-serif`;
      c.strokeStyle = 'rgba(10, 16, 24, .9)'; c.lineWidth = 3 * dpr; c.strokeText('N ↑', size * 0.94, size * 0.04);
      c.fillText('N ↑', size * 0.94, size * 0.04);
    }
  }

  /** Player arrow in the canvas as fractions (0–1) of its size, independent of resolution (tests). */
  arrowAt(): { x: number; y: number } {
    if (!this.expanded) return { x: 0.5, y: 0.5 };
    const { cx, cz, radius } = EXPANDED;
    return { x: (this.x - cx) / (radius * 2) + 0.5, y: (cz - this.z) / (radius * 2) + 0.5 };
  }

  /** What the map currently shows (browser tests). */
  state(): { route: number; routeLength: number | null; stops: number; bike: boolean; names: number } {
    return { route: this.route?.points.length ?? 0, routeLength: this.route?.length ?? null, stops: this.stops.length, bike: this.bike !== null, names: this.names.length };
  }
}
