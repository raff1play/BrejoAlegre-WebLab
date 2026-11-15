import { subtractSurface } from '../surfaceCut';
import { depotTerrainHole } from './depotFloor';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { placement, type SharedBatches } from '../buildings';
import { BatchSet, type P3 } from '../geometry';
import type { LabMaterial, Materials } from '../materials';
import { CURB_H, ROAD_HALF, SIDEWALK, WALL_H } from '../layout';
import { frontageWalls, streetLightPositions } from './cityLayout';
import { buildStoreFront } from './storeFacade';
import { buildDepotArchitecture } from './depotArchitecture';
import { streetPaint } from './urbanDetail';
import { buildAddresses } from '../../core/delivery/addresses';
import { BLOCKS, DEPOT, NODES, ROADS, STORES, STORE_SETBACK, depotWorld, storePlan, type Rect, type Store } from './cityPlan';
import { DEPOT_SITE, OPEN_SPACES } from '../geo/geoCity';
import { GEO } from '../geo/brejoAlegreData';

/**
 * CORE-015 renderer of the REAL town (OpenStreetMap geometry): asphalt ribbons along every OSM
 * way, junction pads, kerbs and pavements from the real blocks, frontage walls, the eight shops
 * and the depot placed on real lots, parks/pitch/cemetery from OSM, lamp posts and number plates.
 * Houses are built by the sector streamer (features/city/houseStreamer.ts).
 */
type XZ = readonly [number, number];

/** Triangulates a simple polygon (ear clipping); returns index triples. */
export function triangulate(pts: readonly XZ[]): [number, number, number][] {
  const idx = pts.map((_, i) => i);
  const area = pts.reduce((t, a, i) => { const b = pts[(i + 1) % pts.length]!; return t + a[0] * b[1] - b[0] * a[1]; }, 0);
  if (area < 0) idx.reverse();
  const out: [number, number, number][] = [];
  const cross = (a: XZ, b: XZ, c: XZ) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const inTri = (p: XZ, a: XZ, b: XZ, c: XZ) => cross(a, b, p) >= 0 && cross(b, c, p) >= 0 && cross(c, a, p) >= 0;
  let guard = 0;
  while (idx.length > 3 && guard++ < 5000) {
    let cut = false;
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i - 1 + idx.length) % idx.length]!; const i1 = idx[i]!; const i2 = idx[(i + 1) % idx.length]!;
      const a = pts[i0]!; const b = pts[i1]!; const c = pts[i2]!;
      if (cross(a, b, c) <= 1e-9) continue;
      if (idx.some((k) => k !== i0 && k !== i1 && k !== i2 && inTri(pts[k]!, a, b, c))) continue;
      out.push([i0, i1, i2]); idx.splice(i, 1); cut = true; break;
    }
    if (!cut) break;
  }
  if (idx.length === 3) out.push([idx[0]!, idx[1]!, idx[2]!]);
  return out;
}

/** Horizontal filled polygon at height y (top face up), UVs in metres. */
function fillPolygon(set: BatchSet, m: LabMaterial, pts: readonly XZ[], y: number, cut?:readonly XZ[]): void {
  const b = set.of(m);
  for (const [i, j, k] of triangulate(pts)) {
    const triangle = [pts[i]!, pts[j]!, pts[k]!];
    const pieces = cut ? subtractSurface(triangle,cut) : [triangle];
    for(const t of pieces)b.poly(t.map(([x,z])=>[x,y,z] as const),t.map(([x,z])=>[x/2,z/2] as const));
  }
}

/** Ribbon of width w along a polyline at height y (quads per segment). */
function ribbon(set: BatchSet, m: LabMaterial, pts: readonly XZ[], w: number, y: number, offset = 0, worldUv = false): void {
  const b = set.of(m);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!; const c = pts[i]!;
    const L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 0.01) continue;
    const nx = -(c[1] - a[1]) / L; const nz = (c[0] - a[0]) / L; // left normal
    const l0 = offset - w / 2; const l1 = offset + w / 2;
    const p0: P3 = [a[0] + nx * l0, y, a[1] + nz * l0]; const p1: P3 = [c[0] + nx * l0, y, c[1] + nz * l0];
    const p2: P3 = [c[0] + nx * l1, y, c[1] + nz * l1]; const p3: P3 = [a[0] + nx * l1, y, a[1] + nz * l1];
    // World-space UVs: where ribbons of two roads (or a junction disc) overlap at the same height,
    // both surfaces show the SAME texel, so coplanar overlaps cannot flicker (CORE-015.1).
    if (worldUv) b.poly([p0, p1, p2, p3], [p0, p1, p2, p3].map((q) => [q[0] / 2, q[2] / 2] as [number, number]));
    else b.poly([p0, p1, p2, p3], [[0, 0], [0, L / 2], [w / 2, L / 2], [w / 2, 0]]);
  }
}

/** One pavement stretch between kerb (a→b) and lot line (c←d): slabs run ALONG the street. */
function pavementQuad(set: BatchSet, m: LabMaterial, a: XZ, b: XZ, c: XZ, d: XZ): void {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const tx = (b[0] - a[0]) / L; const tz = (b[1] - a[1]) / L;
  const uv = (p: XZ): [number, number] => [((p[0] - a[0]) * tx + (p[1] - a[1]) * tz) / 2, ((p[0] - a[0]) * -tz + (p[1] - a[1]) * tx) / 2];
  const pts = [a, b, c, d];
  const batch = set.of(m);
  for (const [i, j, k] of triangulate(pts)) {
    const t = [pts[i]!, pts[j]!, pts[k]!];
    batch.poly(t.map((q) => [q[0], CURB_H, q[1]] as P3), t.map(uv));
  }
}

/** Subtle expansion joints across the sidewalk slabs, including curved lots. */
function sidewalkJoints(set: BatchSet, mats: Materials, a: XZ, b: XZ, c: XZ, d: XZ): void {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L < 3.7) return;
  for (let at = 2.6; at < L - 0.65; at += 2.6) {
    const t = at / L;
    const edge: XZ = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const lot: XZ = [d[0] + (c[0] - d[0]) * t, d[1] + (c[1] - d[1]) * t];
    ribbon(set, mats.paint('#a3a19a'), [edge, lot], 0.036, CURB_H + 0.006);
  }
}

function disc(set: BatchSet, m: LabMaterial, x: number, z: number, r: number, y: number): void {
  const n = 14; const pts: XZ[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([x + Math.cos(a) * r, z + Math.sin(a) * r]); }
  fillPolygon(set, m, pts, y);
}

const UNPAVED = new Set(['unpaved', 'dirt', 'ground', 'gravel', 'earth', 'sand', 'compacted', 'grass']);
const surfaceOf = (osmWay: number) => GEO.streets.find((s) => s.id === osmWay)?.surface ?? null;

export function buildRoads(flat: BatchSet, upright: BatchSet, mats: Materials): void {
  // Carriageways (8 m: an approximation; OSM has no widths here), unpaved rural ways in earth.
  for (const r of ROADS) {
    const dirt = r.kind === 'rural' && UNPAVED.has(surfaceOf(r.osmWay) ?? '');
    ribbon(flat, dirt ? mats.dirt : mats.asphalt, r.pts, ROAD_HALF * 2, 0, 0, true);
    for (const p of r.pts.slice(1, -1)) disc(flat, dirt ? mats.dirt : mats.asphalt, p[0], p[1], ROAD_HALF, 0);
    if (r.highway.startsWith('secondary')) {
      // Dashed yellow centre line on the paved state/municipal roads.
      const dash = 3; const gap = 3;
      let acc = 0;
      for (let i = 1; i < r.pts.length; i++) {
        const a = r.pts[i - 1]!; const c = r.pts[i]!; const L = Math.hypot(c[0] - a[0], c[1] - a[1]);
        for (let s = Math.max(0, Math.ceil(acc / (dash + gap)) * (dash + gap) - acc); s + dash <= L; s += dash + gap) {
          const t0 = s / L; const t1 = (s + dash) / L;
          ribbon(flat, mats.lineYellow, [[a[0] + (c[0] - a[0]) * t0, a[1] + (c[1] - a[1]) * t0], [a[0] + (c[0] - a[0]) * t1, a[1] + (c[1] - a[1]) * t1]], 0.12, 0.006);
        }
        acc += L;
      }
      ribbon(flat, mats.lineWhite, r.pts, 0.1, 0.005, ROAD_HALF - 0.45);
      ribbon(flat, mats.lineWhite, r.pts, 0.1, 0.005, -(ROAD_HALF - 0.45));
    }
  }
  for (const n of NODES) disc(flat, mats.asphalt, n.x, n.z, ROAD_HALF + 0.4, 0);
  // Street-paint geometry is batched by colour and floats above asphalt. All markings
  // are derived from real roads; the new crosswalks and signals are fictional.
  for (const mark of streetPaint()) {
    // GFX-001: centre lines divide opposite flows → yellow (Brazilian road marking); the rest white.
    ribbon(flat, mark.kind === 'centre' ? mats.lineYellow : mats.lineWhite, [mark.start, mark.end], mark.kind === 'centre' ? mark.width * 1.4 : mark.width, 0.014);
  }
  // Blocks: kerb face, gutter, pavement and the lot area behind it.
  for (const b of BLOCKS) {
    const k = b.kerb;
    for (let i = 0; i < k.length; i++) {
      const a = k[i]!; const c = k[(i + 1) % k.length]!;
      // Kerb face (looks outwards, towards the road): CCW polygon → outward = right of a→c.
      upright.of(mats.curb).poly([[a[0], 0, a[1]], [c[0], 0, c[1]], [c[0], CURB_H + 0.012, c[1]], [a[0], CURB_H + 0.012, a[1]]], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]]);
      ribbon(flat, mats.gutter, [a, c], 0.16, 0.018);
    }
    // Pavement as a ring between kerb and lot line (both are insets of the same block face, so
    // their vertices correspond). The depot cuts its footprint out of the lot grass;
    // a tiny height gap alone cannot reliably separate terrain and paving on mobile.
    const l = b.lot;
    if (l.length === k.length) {
      for (let i = 0; i < k.length; i++) {
        const j = (i + 1) % k.length;
        pavementQuad(flat, mats.pavement, k[i]!, k[j]!, l[j]!, l[i]!);
        sidewalkJoints(flat, mats, k[i]!, k[j]!, l[j]!, l[i]!);
      }
    } else fillPolygon(flat, mats.pavement, k, CURB_H, b.id===DEPOT_SITE.block?depotTerrainHole():undefined);
    fillPolygon(flat, mats.grass, l, CURB_H - 0.012, b.id===DEPOT_SITE.block?depotTerrainHole():undefined);
  }
  void SIDEWALK; void upright;
}

function buildStreetLights(set: BatchSet, mats: Materials, scene: Scene): void {
  const pole = mats.paint('#9a968e');
  for (const p of streetLightPositions()) {
    const shaft = CreateCylinder('poste-luz', { diameterTop: 0.14, diameterBottom: 0.24, height: 7.5, tessellation: 7 }, scene);
    shaft.position.set(p.x, CURB_H + 3.75, p.z);
    set.absorb(pole, shaft);
    // Painted socket, metal base and cantilever: small grouped primitives, no heavy GLBs.
    set.box(mats.paint('#5e6366'), p.x - 0.17, p.x + 0.17, CURB_H, CURB_H + 0.42, p.z - 0.17, p.z + 0.17);
    set.box(mats.paint('#777b7b', 0.18), p.x - 0.09, p.x + 0.09, CURB_H + 6.9, CURB_H + 7.15, p.z - 0.09, p.z + 0.09);
    const ax = Math.sin(p.yaw) * 1.6; const az = Math.cos(p.yaw) * 1.6;
    set.box(mats.paint('#5d6368', 0.25), Math.min(p.x, p.x + ax) - 0.04, Math.max(p.x, p.x + ax) + 0.04, CURB_H + 7.3, CURB_H + 7.38, Math.min(p.z, p.z + az) - 0.04, Math.max(p.z, p.z + az) + 0.04);
    set.box(mats.paint('#484d50', 0.2), p.x + ax - 0.28, p.x + ax + 0.28, CURB_H + 7.12, CURB_H + 7.26, p.z + az - 0.28, p.z + az + 0.28);
    set.box(mats.glow('#fff1cf'), p.x + ax - 0.23, p.x + ax + 0.23, CURB_H + 7.09, CURB_H + 7.12, p.z + az - 0.23, p.z + az + 0.23);
  }
}

/** OSM open spaces: parks (grass, paths), the sports pitch (lines), the cemetery (walled). */
function buildOpenSpaces(flat: BatchSet, upright: BatchSet, mats: Materials): void {
  for (const a of OPEN_SPACES) {
    if (a.kind === 'leisure:pitch') {
      fillPolygon(flat, mats.paint('#5f8f45'), a.pts, CURB_H + 0.01);
      for (let i = 0; i < a.pts.length; i++) ribbon(flat, mats.lineWhite, [a.pts[i]!, a.pts[(i + 1) % a.pts.length]!], 0.12, CURB_H + 0.016);
    } else if (a.kind === 'landuse:cemetery') {
      fillPolygon(flat, mats.paint('#b9b2a2'), a.pts, CURB_H + 0.008);
      for (let i = 0; i < a.pts.length; i++) {
        const p = a.pts[i]!; const q = a.pts[(i + 1) % a.pts.length]!;
        // Both faces (OSM ring orientation varies).
        upright.of(mats.plaster('#ece7dc')).poly([[q[0], CURB_H, q[1]], [p[0], CURB_H, p[1]], [p[0], CURB_H + 2, p[1]], [q[0], CURB_H + 2, q[1]]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
        upright.of(mats.plaster('#ece7dc')).poly([[p[0], CURB_H, p[1]], [q[0], CURB_H, q[1]], [q[0], CURB_H + 2, q[1]], [p[0], CURB_H + 2, p[1]]], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      }
    } else {
      fillPolygon(flat, mats.grass, a.pts, CURB_H + 0.01);
    }
  }
}

/** CORE-015.1 look of each (fictional) shop: goods palette, wall displays and a signature fixture. */
type Display = 'shelf' | 'crates' | 'pallet' | 'baskets';
type Feature = 'fridge' | 'freezer' | 'copier' | 'case' | 'stack' | 'pallet' | 'crates';
const STORE_LOOK: Record<Store['id'], { goods: string[]; left: Display; right: Display; window: Display; feature: Feature; floor: [string, string]; top: string }> = {
  mercearia: { goods: ['#c9302c', '#f2c230', '#2b5aa8', '#e9dcc0', '#6b4f3a', '#1f8a5b'], left: 'shelf', right: 'shelf', window: 'crates', feature: 'fridge', floor: ['#d8cfbd', '#d2c8b5'], top: '#7a5a3a' },
  farmacia: { goods: ['#ffffff', '#e8f3ee', '#9cc3d5', '#1f8a5b', '#f4d7da', '#d9e6f2'], left: 'shelf', right: 'shelf', window: 'shelf', feature: 'case', floor: ['#eef1ef', '#e6ece8'], top: '#f4f6f4' },
  papelaria: { goods: ['#e23d3d', '#2b5aa8', '#f2c230', '#34a26b', '#f08a3c', '#8a4fb0', '#ffffff'], left: 'shelf', right: 'shelf', window: 'shelf', feature: 'copier', floor: ['#dfd9cc', '#d8d1c3'], top: '#3b4a63' },
  supermercado: { goods: ['#c9302c', '#f2c230', '#2b5aa8', '#1f8a5b', '#f4f1ea', '#e07b39', '#7a3f8f'], left: 'shelf', right: 'shelf', window: 'baskets', feature: 'freezer', floor: ['#e6e3dc', '#dfdbd3'], top: '#b9bcc0' },
  padaria: { goods: ['#c98a45', '#a8672c', '#e2b671', '#f1dfb8', '#8a4f25'], left: 'shelf', right: 'crates', window: 'crates', feature: 'case', floor: ['#e3d2b4', '#dccaa9'], top: '#8a5a34' },
  variedades: { goods: ['#7a3f8f', '#e23d3d', '#2bb3a3', '#f2c230', '#f08ab0', '#3d6fd0', '#f4f1ea'], left: 'shelf', right: 'shelf', window: 'shelf', feature: 'stack', floor: ['#e2dbe4', '#dbd3dd'], top: '#5b3a68' },
  construcao: { goods: ['#8f9498', '#b85c38', '#d0761f', '#e9e3d6', '#3d4552', '#f2c230'], left: 'pallet', right: 'shelf', window: 'pallet', feature: 'pallet', floor: ['#bfbbb2', '#b8b4aa'], top: '#6b6f73' },
  hortifruti: { goods: ['#4f8a2f', '#d1362f', '#f08a1c', '#f2d13a', '#8fbf3f', '#7a2f5a'], left: 'crates', right: 'crates', window: 'crates', feature: 'crates', floor: ['#dfe0cc', '#d8d9c3'], top: '#7a5a3a' },
};

/**
 * Interior of a shop from its floor plan (cityPlan.storePlan): what is drawn here is exactly what
 * storeLayout() makes solid. Procedural boxes only (no external assets).
 */
function furnishStore(set: BatchSet, mats: Materials, s: Store): void {
  const W = s.width; const D = s.depth; const H = s.height; const t = 0.25; const L = STORE_SETBACK;
  const p = storePlan(s); const cz = p.cz;
  const look = STORE_LOOK[s.id];
  const rack = mats.paint('#cfd2d4', 0.25);
  const wood = mats.paint('#9a7446', 0.08);
  const goods = look.goods.map((c) => mats.paint(c, 0.12));
  let n = s.id.length * 13 + 5;
  const rnd = () => { n = (n * 37 + 11) % 101; return n; };
  // Floor: two-tone tiles (0.6 m bands), skirting along the walls.
  set.box(mats.stripes(`piso-${s.id}`, look.floor[0], look.floor[1], 2, false, 0.9), t, W - t, 0.004, 0.014, L + t, D - t, { sides: false });
  const skirt = mats.paint('#6d665c', 0.1);
  set.box(skirt, t, t + 0.03, 0.014, 0.12, L + t, D - t); set.box(skirt, W - t - 0.03, W - t, 0.014, 0.12, L + t, D - t);

  /** Shelving run with goods on every level; `alongZ` when the unit stands against a side wall. */
  const shelf = (r: Rect, levels: number, alongZ: boolean) => {
    set.box(rack, r.x0, r.x1, 0, 0.08, r.z0, r.z1);
    for (let k = 1; k <= levels; k++) set.box(rack, r.x0, r.x1, k * 0.5 - 0.02, k * 0.5, r.z0, r.z1);
    const top = levels * 0.5 + 0.1;
    if (alongZ) { for (const z of [r.z0, r.z1 - 0.04]) set.box(rack, r.x0, r.x1, 0, top, z, z + 0.04); }
    else { for (const x of [r.x0, r.x1 - 0.04]) set.box(rack, x, x + 0.04, 0, top, r.z0, r.z1); }
    const [a0, a1] = alongZ ? [r.z0, r.z1] : [r.x0, r.x1];
    for (let k = 0; k < levels; k++) {
      for (let a = a0 + 0.1; a < a1 - 0.3; a += 0.3 + (rnd() % 3) * 0.05) {
        const h = 0.16 + (rnd() % 5) * 0.05; const m = goods[rnd() % goods.length]!;
        const y0 = k * 0.5 + (k === 0 ? 0.08 : 0);
        if (alongZ) set.box(m, r.x0 + 0.06, r.x1 - 0.06, y0, k * 0.5 + h + 0.08, a, a + 0.24);
        else set.box(m, a, a + 0.24, y0, k * 0.5 + h + 0.08, r.z0 + 0.05, r.z1 - 0.05);
      }
    }
  };
  /** Slanted wooden crates of loose goods (produce, bread baskets). */
  const crates = (r: Rect, alongZ: boolean) => {
    const [a0, a1] = alongZ ? [r.z0, r.z1] : [r.x0, r.x1];
    const count = Math.max(1, Math.floor((a1 - a0) / 0.85));
    const step = (a1 - a0) / count;
    for (let i = 0; i < count; i++) {
      const c0 = a0 + i * step + 0.04; const c1 = a0 + (i + 1) * step - 0.04;
      const box = (y0: number, y1: number, m: LabMaterial, inset = 0) => (alongZ
        ? set.box(m, r.x0 + inset, r.x1 - inset, y0, y1, c0 + inset, c1 - inset)
        : set.box(m, c0 + inset, c1 - inset, y0, y1, r.z0 + inset, r.z1 - inset));
      box(0, 0.12, mats.paint('#5d4a36', 0.05), 0.08); // legs/base
      box(0.12, 0.62, wood);
      const m = goods[(i + rnd()) % goods.length]!;
      box(0.62, 0.7, m, 0.05);
      // A few pieces heaped on top.
      for (let k = 0; k < 3; k++) {
        const u = 0.15 + ((rnd() % 50) / 100) * 0.5; const v = 0.2 + ((rnd() % 50) / 100) * 0.4;
        const [cx, cz2] = alongZ ? [r.x0 + (r.x1 - r.x0) * v, c0 + (c1 - c0) * u] : [c0 + (c1 - c0) * u, r.z0 + (r.z1 - r.z0) * v];
        set.box(goods[rnd() % goods.length]!, cx - 0.09, cx + 0.09, 0.7, 0.8, cz2 - 0.09, cz2 + 0.09);
      }
    }
  };
  /** Pallets with stacked bags or bricks (building supplies, bulk goods). */
  const pallet = (r: Rect) => {
    set.box(wood, r.x0 + 0.03, r.x1 - 0.03, 0, 0.12, r.z0 + 0.03, r.z1 - 0.03);
    const layers = 4 + (rnd() % 3);
    for (let k = 0; k < layers; k++) {
      const m = goods[(k + (rnd() % 2)) % 3]!; const i = k % 2 ? 0.1 : 0.06;
      set.box(m, r.x0 + i, r.x1 - i, 0.12 + k * 0.16, 0.12 + k * 0.16 + 0.15, r.z0 + i, r.z1 - i);
    }
  };
  const display = (kind: Display, r: Rect, alongZ: boolean) => {
    if (r.x1 - r.x0 < 0.3 || r.z1 - r.z0 < 0.3) return;
    if (kind === 'crates') crates(r, alongZ);
    else if (kind === 'pallet') pallet(r);
    else if (kind === 'baskets') { // stacked shopping baskets and a promo stand
      for (let k = 0; k < 6; k++) set.box(mats.paint('#c9302c', 0.2), r.x0 + 0.1, r.x0 + 0.6, k * 0.09, k * 0.09 + 0.07, r.z0 + 0.15, r.z1 - 0.15);
      shelf({ x0: r.x0 + 0.75, x1: r.x1, z0: r.z0, z1: r.z1 }, 2, false);
    } else shelf(r, alongZ ? 4 : 2, alongZ);
  };
  display(look.left, p.displayLeft, true);
  display(look.right, p.displayRight, true);
  display(look.window, p.windowDisplay, false);
  // GFX-001B goods island (double-sided gondola or crates) in the wider shops.
  if (p.island) {
    const mid = (p.island.x0 + p.island.x1) / 2;
    if (look.left === 'crates') crates(p.island, true);
    else { shelf({ ...p.island, x1: mid - 0.02 }, 3, true); shelf({ ...p.island, x0: mid + 0.02 }, 3, true); set.box(rack, mid - 0.02, mid + 0.02, 0, 1.75, p.island.z0, p.island.z1); }
  }

  // Signature fixture behind the right-hand window.
  const f = p.feature; const fx = (f.x0 + f.x1) / 2;
  const white = mats.paint('#f1f3f2', 0.3); const dark = mats.paint('#2b2d31', 0.3);
  switch (look.feature) {
    case 'fridge': { // upright drinks cooler with lit shelves
      set.box(dark, f.x0, f.x1, 0, 1.95, f.z0, f.z1);
      set.box(mats.glow('#eaf6ff'), f.x0 + 0.06, f.x1 - 0.06, 0.18, 1.8, f.z1, f.z1 + 0.012);
      for (let k = 0; k < 4; k++) for (let x = f.x0 + 0.12; x < f.x1 - 0.2; x += 0.16) set.box(goods[rnd() % goods.length]!, x, x + 0.1, 0.24 + k * 0.4, 0.5 + k * 0.4, f.z1 + 0.012, f.z1 + 0.05);
      set.box(mats.paint('#c9302c', 0.2), f.x0, f.x1, 1.95, 2.2, f.z0, f.z1);
      break;
    }
    case 'freezer': { // chest freezer with a glass lid
      set.box(white, f.x0, f.x1, 0, 0.85, f.z0, f.z1);
      set.box(mats.paint('#9cc3d5', 0.5), f.x0 + 0.06, f.x1 - 0.06, 0.85, 0.89, f.z0 + 0.06, f.z1 - 0.06);
      set.box(mats.paint('#2b5aa8', 0.2), f.x0, f.x1, 0.3, 0.42, f.z1, f.z1 + 0.01);
      break;
    }
    case 'copier': { // photocopier with paper tray and a ream stack
      set.box(mats.paint('#d9dcde', 0.2), fx - 0.45, fx + 0.45, 0, 1.0, f.z0, f.z1 - 0.1);
      set.box(dark, fx - 0.4, fx + 0.4, 1.0, 1.06, f.z0 + 0.05, f.z1 - 0.15);
      set.box(white, fx - 0.3, fx + 0.3, 0.55, 0.6, f.z1 - 0.1, f.z1);
      for (let k = 0; k < 4; k++) set.box(white, f.x1 - 0.42, f.x1 - 0.1, k * 0.06, k * 0.06 + 0.05, f.z0 + 0.2, f.z0 + 0.65);
      break;
    }
    case 'case': { // glass display case (bread / pharmacy items)
      set.box(mats.paint(s.band, 0.15), f.x0, f.x1, 0, 0.75, f.z0, f.z1);
      set.box(mats.paint(look.top, 0.2), f.x0 - 0.02, f.x1 + 0.02, 0.75, 0.8, f.z0 - 0.02, f.z1 + 0.02);
      for (let x = f.x0 + 0.1; x < f.x1 - 0.25; x += 0.3) set.box(goods[rnd() % goods.length]!, x, x + 0.22, 0.8, 0.92 + (rnd() % 3) * 0.04, f.z0 + 0.2, f.z1 - 0.2);
      set.of(mats.glass()).quad([f.x0, 0.8, f.z1], [f.x1, 0.8, f.z1], [f.x1, 1.25, f.z1], [f.x0, 1.25, f.z1], 1, 1);
      set.box(rack, f.x0, f.x1, 1.25, 1.28, f.z0, f.z1);
      break;
    }
    case 'stack': { // stacked basins, buckets and boxed goods
      for (let i = 0; i < 3; i++) {
        const x = f.x0 + 0.1 + i * ((f.x1 - f.x0 - 0.2) / 3);
        for (let k = 0; k < 3 + (rnd() % 3); k++) set.box(goods[(i + k) % goods.length]!, x + k * 0.02, x + 0.42 - k * 0.02, k * 0.22, k * 0.22 + 0.2, f.z0 + 0.15 + k * 0.02, f.z1 - 0.15 - k * 0.02);
      }
      break;
    }
    case 'pallet': pallet({ x0: f.x0, x1: fx - 0.05, z0: f.z0, z1: f.z1 }); pallet({ x0: fx + 0.05, x1: f.x1, z0: f.z0, z1: f.z1 }); break;
    default: crates(f, false);
  }

  // Counter: plinth, body in the shop colour, front panel, worktop with overhang, till, glass case.
  const c = p.counter;
  set.box(mats.paint('#3a3632', 0.1), c.x0 + 0.04, c.x1 - 0.04, 0, 0.1, c.z0 + 0.06, c.z1);
  set.box(mats.paint(s.band, 0.15), c.x0, c.x1, 0.1, 0.94, c.z0, c.z1);
  for (let x = c.x0 + 0.5; x < c.x1 - 0.3; x += 1.1) set.box(mats.paint('#3a3632', 0.1), x, x + 0.02, 0.14, 0.9, c.z0 - 0.006, c.z0);
  set.box(mats.paint(s.sign[0] === '#ffffff' ? '#e9e4d8' : s.sign[0], 0.2), c.x0, c.x1, 0.5, 0.58, c.z0 - 0.012, c.z0);
  set.box(mats.paint(look.top, 0.25), c.x0 - 0.06, c.x1 + 0.06, 0.94, 1.0, c.z0 - 0.1, c.z1 + 0.06);
  set.box(dark, W / 2 - 0.3, W / 2 + 0.1, 1.0, 1.28, cz - 0.15, cz + 0.15);
  set.box(mats.paint('#9aa0a6', 0.3), W / 2 - 0.25, W / 2 + 0.05, 1.28, 1.3, cz - 0.1, cz + 0.12);
  // Small glass case on the customer end of the counter.
  const g0 = c.x0 + 0.2; const g1 = Math.min(c.x0 + 1.9, W / 2 - 0.6);
  if (g1 - g0 > 0.6) {
    for (let x = g0 + 0.08; x < g1 - 0.2; x += 0.26) set.box(goods[rnd() % goods.length]!, x, x + 0.18, 1.0, 1.1 + (rnd() % 3) * 0.03, cz - 0.2, cz + 0.2);
    set.of(mats.glass()).quad([g0, 1.0, c.z0 - 0.02], [g1, 1.0, c.z0 - 0.02], [g1, 1.32, c.z0 - 0.02], [g0, 1.32, c.z0 - 0.02], 1, 1);
    set.box(rack, g0, g1, 1.32, 1.34, c.z0 - 0.04, cz + 0.28);
  }
  // Pickup point: hanging sign over the counter and a marked square on the floor.
  const px = W / 2 + 1.0;
  const pick = mats.sign('placa-retirada', '#f2c230', '#1d1d1d', [
    { text: 'RETIRADA', size: 0.5, color: '#1d1d1d' },
    { text: 'DE ENCOMENDAS', size: 0.24, color: '#1d1d1d', weight: '700' },
  ], 3, 128);
  set.of(pick).quad([px - 0.9, 2.25, c.z0 - 0.075], [px + 0.9, 2.25, c.z0 - 0.075], [px + 0.9, 2.85, c.z0 - 0.075], [px - 0.9, 2.85, c.z0 - 0.075], 1, 1);
  set.box(dark, px - 0.93, px + 0.93, 2.22, 2.88, c.z0 - 0.06, c.z0 - 0.02);
  for (const x of [px - 0.7, px + 0.7]) set.box(dark, x - 0.012, x + 0.012, 2.87, H - 0.4, c.z0 - 0.045, c.z0 - 0.025);
  const mark = mats.lineYellow; const m0 = cz - 1.5; const m1 = cz - 0.5;
  set.box(mark, px - 0.5, px + 0.5, 0.015, 0.02, m0, m0 + 0.06, { sides: false }); set.box(mark, px - 0.5, px + 0.5, 0.015, 0.02, m1 - 0.06, m1, { sides: false });
  set.box(mark, px - 0.5, px - 0.44, 0.015, 0.02, m0, m1, { sides: false }); set.box(mark, px + 0.44, px + 0.5, 0.015, 0.02, m0, m1, { sides: false });

  // GFX-001B: what makes each shop its own place — a department sign on the back wall, a colour
  // band, and fixtures that sit on the counter, the walls or hang from the ceiling (nothing new on
  // the walkable floor, so the colliders of storePlan stay exact).
  const dept: Record<Store['id'], string> = {
    mercearia: 'SECOS E MOLHADOS', farmacia: 'MEDICAMENTOS · PERFUMARIA', papelaria: 'ESCOLAR · ESCRITÓRIO', supermercado: 'AÇOUGUE · FRIOS · PADARIA',
    padaria: 'PÃES · DOCES · SALGADOS', variedades: 'UTILIDADES · BRINQUEDOS', construcao: 'TINTAS · HIDRÁULICA · ELÉTRICA', hortifruti: 'FRUTAS · VERDURAS · LEGUMES',
  };
  const zb = D - t - 0.03;
  set.box(mats.paint(s.band, 0.12), t, W - t, 2.28, 2.4, zb - 0.01, zb + 0.01);
  const deptSign = mats.sign(`setor-${s.id}`, s.sign[0] === '#ffffff' ? s.band : s.sign[0], s.sign[1], [{ text: dept[s.id], size: 0.56, color: s.sign[1], weight: '800' }], 9, 64);
  set.of(deptSign).quad([W / 2 - 2.7, 2.48, zb], [W / 2 + 2.7, 2.48, zb], [W / 2 + 2.7, 3.08, zb], [W / 2 - 2.7, 3.08, zb], 1, 1);
  const cTop = 1.0; const cx0 = c.x0 + 0.2;
  const hang = (x: number, z: number, len: number, m: LabMaterial, w = 0.12, h = 0.3) => {
    set.box(mats.paint('#3a3d40', 0.2), x - 0.006, x + 0.006, H - 0.4 - len, H - 0.4, z - 0.006, z + 0.006);
    set.box(m, x - w / 2, x + w / 2, H - 0.4 - len - h, H - 0.4 - len, z - w / 2, z + w / 2);
  };
  switch (s.id) {
    case 'mercearia': // strings of garlic and sausages over the counter, an old dial scale, sacks
      for (let i = 0; i < 6; i++) hang(c.x0 + 0.6 + i * 0.55, cz + 0.1, 0.9 + (i % 2) * 0.15, goods[i % 2 === 0 ? 3 : 0]!, 0.1, 0.42);
      set.box(mats.paint('#b9bcc0', 0.4), c.x1 - 0.75, c.x1 - 0.3, cTop, cTop + 0.08, cz - 0.2, cz + 0.2);
      set.box(mats.paint('#f4f1ea', 0.3), c.x1 - 0.62, c.x1 - 0.43, cTop + 0.08, cTop + 0.5, cz + 0.05, cz + 0.12);
      break;
    case 'farmacia': { // lit cross on the wall, prescription shelf with drawers, blood-pressure station
      const g = mats.glow('#3ddc84');
      set.box(g, W - t - 0.04, W - t - 0.01, 2.0, 2.9, cz + 2.4, cz + 2.7); set.box(g, W - t - 0.04, W - t - 0.01, 2.3, 2.6, cz + 2.1, cz + 3.0);
      for (let k = 0; k < 4; k++) for (let x = cx0; x < c.x1 - 0.6; x += 0.5) set.box(mats.paint(k % 2 ? '#f1f3f2' : '#e3e8e5', 0.2), x, x + 0.46, 0.12 + k * 0.2, 0.3 + k * 0.2, c.z1 - 0.012, c.z1 + 0.012);
      set.box(mats.paint('#e9ecef', 0.3), c.x1 - 0.8, c.x1 - 0.35, cTop, cTop + 0.22, cz - 0.16, cz + 0.16);
      set.box(mats.paint('#1f8a5b', 0.3), c.x1 - 0.75, c.x1 - 0.4, cTop + 0.22, cTop + 0.26, cz - 0.1, cz + 0.1);
      break;
    }
    case 'papelaria': { // posters on the side wall, pen cups and a globe on the counter
      const posters = ['#e23d3d', '#f2c230', '#34a26b', '#3d6fd0'];
      posters.forEach((col, i) => { const z0 = L + t + 1.6 + i * 1.05; set.box(mats.paint('#f4f1ea', 0.1), t + 0.76, t + 0.78, 1.9, 2.75, z0, z0 + 0.8); set.box(mats.paint(col, 0.15), t + 0.778, t + 0.79, 1.98, 2.67, z0 + 0.07, z0 + 0.73); });
      for (let i = 0; i < 4; i++) { const x = cx0 + 1.9 + i * 0.28; set.box(mats.paint(posters[i]!, 0.2), x, x + 0.1, cTop, cTop + 0.16, cz - 0.05, cz + 0.05); set.box(mats.paint('#2b2d31', 0.2), x + 0.03, x + 0.07, cTop + 0.16, cTop + 0.3, cz - 0.02, cz + 0.02); }
      set.box(mats.paint('#3d6fd0', 0.3), c.x1 - 0.7, c.x1 - 0.4, cTop + 0.1, cTop + 0.4, cz - 0.15, cz + 0.15); set.box(mats.paint('#6b4a2c', 0.1), c.x1 - 0.62, c.x1 - 0.48, cTop, cTop + 0.1, cz - 0.07, cz + 0.07);
      break;
    }
    case 'supermercado': { // checkout: belt, divider and screen; numbered aisle signs from the ceiling
      set.box(mats.paint('#1d1f22', 0.15), cx0 + 1.9, c.x1 - 0.9, cTop, cTop + 0.012, cz - 0.24, cz + 0.2);
      set.box(mats.paint('#c9302c', 0.3), c.x1 - 0.9, c.x1 - 0.86, cTop, cTop + 0.16, cz - 0.24, cz + 0.2);
      set.box(mats.paint('#2b2d31', 0.3), c.x1 - 0.6, c.x1 - 0.2, cTop + 0.2, cTop + 0.5, cz + 0.1, cz + 0.14);
      for (let i = 0; i < 3; i++) hang(1.6 + i * ((W - 3.2) / 2), L + t + 2.6, 0.5, mats.paint(['#c9302c', '#2b5aa8', '#1f8a5b'][i]!, 0.2), 0.7, 0.3);
      break;
    }
    case 'padaria': { // oven with a glowing door on the staff side, coffee machine, cake stand
      set.box(mats.paint('#3a3d40', 0.3), t + 0.75, t + 1.75, 0, 1.9, D - 1.05, D - 0.3);
      set.box(mats.glow('#ff9a3c'), t + 0.9, t + 1.6, 0.9, 1.5, D - 1.07, D - 1.05);
      set.box(mats.paint('#8c9196', 0.5), t + 0.85, t + 1.65, 1.55, 1.6, D - 1.09, D - 1.05);
      set.box(mats.paint('#2b2d31', 0.35), c.x1 - 0.85, c.x1 - 0.35, cTop, cTop + 0.42, cz - 0.05, cz + 0.22);
      set.box(mats.paint('#c9302c', 0.35), c.x1 - 0.8, c.x1 - 0.4, cTop + 0.42, cTop + 0.5, cz - 0.02, cz + 0.2);
      for (let i = 0; i < 3; i++) { const x = cx0 + 2.0 + i * 0.5; set.box(mats.paint('#f1dfb8', 0.2), x, x + 0.34, cTop + 0.12, cTop + 0.14, cz - 0.17, cz + 0.17); set.box(goods[i % goods.length]!, x + 0.05, x + 0.29, cTop + 0.14, cTop + 0.28, cz - 0.12, cz + 0.12); set.box(mats.paint('#8c9196', 0.4), x + 0.15, x + 0.19, cTop, cTop + 0.12, cz - 0.02, cz + 0.02); }
      break;
    }
    case 'variedades': // kites, lanterns and toys hanging over the shop floor
      for (let i = 0; i < 8; i++) hang(1.3 + (i % 4) * ((W - 2.6) / 3), L + t + 1.8 + Math.floor(i / 4) * 2.0, 0.35 + (i % 3) * 0.2, goods[i % goods.length]!, 0.26 + (i % 2) * 0.1, 0.26);
      break;
    case 'construcao': { // PVC pipes on wall brackets, a paint colour chart, hard hats on the counter
      for (let k = 0; k < 5; k++) set.box(mats.paint(k % 2 ? '#f1f3f2' : '#7a4a26', 0.25), t + 0.78, t + 0.9, 2.1 + k * 0.13, 2.2 + k * 0.13, L + t + 1.6, cz - 1.8);
      const chart = ['#e23d3d', '#f08a3c', '#f2c230', '#34a26b', '#2bb3a3', '#3d6fd0', '#8a4fb0', '#f4f1ea'];
      chart.forEach((col, i) => set.box(mats.paint(col, 0.2), W - t - 0.78, W - t - 0.76, 1.9 + Math.floor(i / 4) * 0.4, 2.25 + Math.floor(i / 4) * 0.4, L + t + 1.7 + (i % 4) * 0.42, L + t + 2.07 + (i % 4) * 0.42));
      for (let i = 0; i < 3; i++) set.box(mats.paint(['#f2c230', '#f4f1ea', '#d0761f'][i]!, 0.3), cx0 + 2.0 + i * 0.4, cx0 + 2.28 + i * 0.4, cTop, cTop + 0.16, cz - 0.13, cz + 0.13);
      break;
    }
    default: // hortifruti: banana bunches over the counter, hanging scale, price cards on the wall
      for (let i = 0; i < 5; i++) hang(c.x0 + 0.7 + i * 0.6, cz - 0.05, 0.75, mats.paint('#f2d13a', 0.2), 0.3, 0.34);
      hang(c.x1 - 0.5, cz, 1.1, mats.paint('#b9bcc0', 0.5), 0.34, 0.1);
      for (let i = 0; i < 5; i++) set.box(mats.paint(i % 2 ? '#fff7d6' : '#f2c230', 0.1), W - t - 0.78, W - t - 0.76, 1.9, 2.2, L + t + 1.7 + i * 0.5, L + t + 2.1 + i * 0.5);
  }

  // Stock shelves behind the counter, stock-room door, ceiling light panels.
  shelf(p.backShelf, 4, false);
  shelf(p.sideShelf, 4, true);
  set.box(mats.paint('#5a4636', 0.15), W - 2.4, W - 1.4, 0, 2.1, D - t - 0.02, D - t);
  for (const z of [L + t + 1.6, cz - 1.2, cz + 1.3]) {
    for (let x = 1.6; x < W - 1.4; x += 2.6) {
      set.box(mats.paint('#e9e7e0', 0.2), x - 0.06, x + 1.36, H - 0.47, H - 0.41, z - 0.16, z + 0.16);
      set.box(mats.glow('#fff6dc'), x, x + 1.3, H - 0.49, H - 0.47, z - 0.11, z + 0.11, { sides: false, top: false, bottom: true });
    }
  }
}

function buildStore(scene: Scene, mats: Materials, s: Store): { meshes: Mesh[]; shutter: Mesh } {
  const set = new BatchSet();
  set.setTransform(placement(s.frame));
  const W = s.width; const D = s.depth; const H = s.height; const t = 0.25;
  const L = STORE_SETBACK;
  const wall = mats.plaster(s.id === 'construcao' ? '#dec99b' : s.wall);
  const band = mats.plaster(s.id === 'construcao' ? '#285751' : s.band);
  const trim = mats.paint('#e9e4d8');
  const door0 = W / 2 - 1.3; const door1 = W / 2 + 1.3;
  // Shell: side and back walls, front pillars, kerb wall under the windows, lintel, parapet.
  set.box(wall, 0, t, 0, H, L, D, { fitV: true });
  set.box(wall, W - t, W, 0, H, L, D, { fitV: true });
  set.box(wall, 0, W, 0, H, D - t, D, { fitV: true });
  set.box(wall, 0, W, 3.0, H, L, L + t, { fitV: true });
  for (const [x0, x1] of [[0, 0.5], [door0 - 0.3, door0], [door1, door1 + 0.3], [W - 0.5, W]] as const) set.box(wall, x0, x1, 0, 3.0, L, L + t, { fitV: true });
  for (const [x0, x1] of [[0.5, door0 - 0.3], [door1 + 0.3, W - 0.5]] as const) set.box(band, x0, x1, 0, 0.45, L, L + t);
  // Three wall strips, never a box around the entire room: that box added a
  // phantom front face across the doorway and windows at z=L+t.
  for (const r of storePlan(s).baseWalls) set.box(band, r.x0, r.x1, 0, 0.9, r.z0, r.z1, { fitV: true });
  set.box(trim, 0, W, H, H + 0.14, L - 0.1, D);
  set.box(mats.ribbed('#8f948f'), t, W - t, H - 0.4, H - 0.35, L + t, D - t, { sides: false, bottom: true });
  // Pilasters on the long side walls.
  for (let z = L + 3; z < D - 1; z += 3.5) for (const x of [0, W - 0.06]) set.box(band, x, x + 0.06, 0.9, H, z - 0.18, z + 0.18);
  // Glazing: shop windows either side of the door, glass doors with metal frames.
  const glass = mats.glass();
  const frame = mats.paint('#5d6368', 0.3);
  for (const [x0, x1] of [[0.5, door0 - 0.3], [door1 + 0.3, W - 0.5]] as const) {
    set.of(glass).quad([x0, 0.45, L + 0.12], [x1, 0.45, L + 0.12], [x1, 3.0, L + 0.12], [x0, 3.0, L + 0.12], 1, 1);
    set.box(frame, x0, x1, 2.95, 3.0, L + 0.08, L + 0.16);
    for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / Math.max(1, Math.round((x1 - x0) / 2.2))) set.box(frame, x - 0.03, x + 0.03, 0.45, 3.0, L + 0.08, L + 0.16);
  }
  set.box(frame, door0 - 0.05, door0, 0, 3.0, L, L + t);
  set.box(frame, door1, door1 + 0.05, 0, 3.0, L, L + t);
  set.box(frame, door0, door1, 2.6, 3.0, L + 0.08, L + 0.16);
  set.of(glass).quad([door0, 2.6, L + 0.12], [door1, 2.6, L + 0.12], [door1, 3.0, L + 0.12], [door0, 3.0, L + 0.12], 1, 1);
  // Shutter housing above the opening.
  set.box(mats.paint('#6d7379', 0.2), 0.3, W - 0.3, 3.0, 3.32, L - 0.28, L);
  furnishStore(set, mats, s);
  // GFX-001B: each shop has its own front (parapet, fascia, awning/marquee, sign, forecourt item).
  buildStoreFront(scene, set, mats, s);
  // Forecourt paving.
  set.box(mats.plazaPaving, 0, W, 0, 0.012, 0, L + t, { sides: false });
  // The rest of the real lot beside the shop is closed by a plastered wall (same line as the front).
  const side = storePlan(s).sideWall;
  if (side) {
    set.box(wall, side.x0, side.x1, 0.35, WALL_H, side.z0, side.z1, { fitV: true });
    set.box(mats.paint('#9b9184'), side.x0, side.x1, 0, 0.35, side.z0 - 0.02, side.z1 + 0.02);
    set.box(trim, side.x0, side.x1, WALL_H, WALL_H + 0.07, side.z0 - 0.04, side.z1 + 0.04);
  }
  set.setTransform(null);
  const meshes = set.build(`loja-${s.id}`, scene);
  // Roll-up shutter: its own mesh, scaled about the housing (1 = closed, ~0 = rolled up).
  const sh = new BatchSet();
  sh.setTransform(placement(s.frame));
  sh.box(mats.ribbed('#a3a8ab'), 0.3, W - 0.3, 0.02, 3.0, L - 0.2, L - 0.14);
  sh.setTransform(null);
  const shutter = sh.build(`porta-enrolar-${s.id}`, scene)[0]!;
  const top = placement(s.frame)([W / 2, 3.0, L - 0.17]);
  shutter.setPivotPoint(new Vector3(top[0], top[1], top[2]));
  return { meshes, shutter };
}

export type CityBuild = { bodies: Mesh[]; shutters: Map<string, Mesh> };

/** Builds the real town into the shared batches; returns the separate meshes (shops, depot shutters). */
export function buildCity(scene: Scene, mats: Materials, shared: SharedBatches): CityBuild {
  const { flat, upright } = shared;
  const bodies: Mesh[] = [];
  buildRoads(flat, upright, mats);
  buildStreetLights(upright, mats, scene);
  buildOpenSpaces(flat, upright, mats);
  // Depot: the CORE-014 layout, rigidly placed on its real block.
  const toWorld = (p: P3): P3 => { const w = depotWorld(p[0], p[2]); return [w.x, p[1], w.z]; };
  upright.setTransform(toWorld); flat.setTransform(toWorld);
  const depot = buildDepotArchitecture(scene, upright, flat, mats);
  bodies.push(...depot.roof,...depot.gates);
  upright.setTransform(null); flat.setTransform(null);
  // Frontage walls (plaster, stone plinth, coping, pillars) along every block edge between lots.
  // GFX-001: painted walls in the pastel range of a small Brazilian town (they were all beige).
  const wallPaint = ['#ece4d2', '#f2d9b8', '#e8c9a0', '#dbe6dc', '#f0e0c8', '#e9c4b0', '#d6e2ec', '#f4ead2', '#e6d3bd', '#cfe0c4'];
  frontageWalls().forEach((w, i) => {
    upright.setTransform(placement(w.frame));
    const paint = mats.plaster(wallPaint[i % wallPaint.length]!);
    const L = w.length;
    upright.box(paint, 0, L, 0.35, WALL_H, 0, 0.22, { fitV: true });
    upright.box(mats.paint('#9b9184'), 0, L, 0, 0.35, -0.02, 0.24);
    upright.box(mats.paint('#cfc6b4'), 0, L, WALL_H, WALL_H + 0.07, -0.05, 0.27);
    const n = Math.max(1, Math.round(L / 3.2));
    for (let k = 0; k <= n; k++) {
      const t = (L * k) / n;
      upright.box(paint, Math.max(0, t - 0.16), Math.min(L, t + 0.16), 0, WALL_H + 0.18, -0.08, 0.3, { fitV: true });
      upright.box(mats.paint('#cfc6b4'), Math.max(0, t - 0.2), Math.min(L, t + 0.2), WALL_H + 0.18, WALL_H + 0.25, -0.12, 0.34);
    }
  });
  upright.setTransform(null);
  // Enamel number plate at every deliverable house, on a slim post at the lot front.
  const digits = mats.digits();
  const post = mats.paint('#5d6368', 0.3);
  for (const a of buildAddresses()) {
    upright.setTransform(placement(a.frame));
    const text = String(a.number);
    const w = 0.13 * text.length + 0.06;
    const x0 = 0.35; const y0 = 1.45; const z = -0.06;
    upright.box(post, x0 + w / 2 - 0.025, x0 + w / 2 + 0.025, 0, y0, z + 0.01, z + 0.06);
    upright.box(mats.paint('#f4f1ea'), x0 - 0.02, x0 + w + 0.02, y0 - 0.02, y0 + 0.2, z + 0.005, z + 0.04);
    [...text].forEach((ch, i) => {
      const xa = x0 + 0.03 + i * 0.13; const xb = xa + 0.13;
      upright.of(digits).quad([xa, y0, z], [xb, y0, z], [xb, y0 + 0.18, z], [xa, y0 + 0.18, z], 0.1, 1, Number(ch) / 10, 0);
    });
  }
  upright.setTransform(null);
  const shutters = new Map<string, Mesh>();
  depot.gates.forEach((mesh,i)=>shutters.set(`depot-gate-${i}`,mesh));
  for (const s of STORES) {
    const built = buildStore(scene, mats, s);
    bodies.push(...built.meshes, built.shutter);
    shutters.set(s.id, built.shutter);
  }
  void DEPOT;
  return { bodies, shutters };
}
