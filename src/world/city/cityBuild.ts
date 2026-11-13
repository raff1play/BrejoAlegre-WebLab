import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Box2D } from '../../core/collision';
import { placement, type SharedBatches } from '../buildings';
import { BatchSet, type P3 } from '../geometry';
import { ballPart } from '../modelParts';
import type { LabMaterial, Materials } from '../materials';
import { CURB_H, ROAD_HALF, SIDEWALK, WALL_H } from '../layout';
import { frontageWalls, streetLightPositions } from './cityLayout';
import { buildAddresses } from '../../core/delivery/addresses';
import { BLOCKS, DEPOT, NODES, ROADS, STORES, STORE_SETBACK, depotLayout, depotWorld, type Store } from './cityPlan';
import { OPEN_SPACES } from '../geo/geoCity';
import { GEO } from '../geo/brejoAlegreData';

/**
 * CORE-015 renderer of the REAL town (OpenStreetMap geometry): asphalt ribbons along every OSM
 * way, junction pads, kerbs and pavements from the real blocks, frontage walls, the eight shops
 * and the depot placed on real lots, parks/pitch/cemetery from OSM, lamp posts and number plates.
 * Houses are built by the sector streamer (features/city/houseStreamer.ts).
 */
const flatOnly = { sides: false } as const;
type XZ = readonly [number, number];

function drawBox(set: BatchSet, m: LabMaterial, b: Box2D, y0: number, y1: number, options?: { sides?: boolean; top?: boolean }): void {
  set.box(m, b.minX, b.maxX, y0, y1, b.minZ, b.maxZ, options);
}

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
function fillPolygon(set: BatchSet, m: LabMaterial, pts: readonly XZ[], y: number): void {
  const b = set.of(m);
  for (const [i, j, k] of triangulate(pts)) {
    const t = [pts[i]!, pts[j]!, pts[k]!];
    // Counter-clockwise in (x, z) faces up (same convention as Batch.box top faces).
    b.poly([[t[0]![0], y, t[0]![1]], [t[1]![0], y, t[1]![1]], [t[2]![0], y, t[2]![1]]], [[t[0]![0] / 2, t[0]![1] / 2], [t[1]![0] / 2, t[1]![1] / 2], [t[2]![0] / 2, t[2]![1] / 2]]);
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
  // Blocks: kerb face, gutter, pavement and the lot area behind it.
  for (const b of BLOCKS) {
    const k = b.kerb;
    for (let i = 0; i < k.length; i++) {
      const a = k[i]!; const c = k[(i + 1) % k.length]!;
      // Kerb face (looks outwards, towards the road): CCW polygon → outward = right of a→c.
      upright.of(mats.curb).poly([[a[0], 0, a[1]], [c[0], 0, c[1]], [c[0], CURB_H + 0.012, c[1]], [a[0], CURB_H + 0.012, a[1]]], [[0, 0], [1, 0], [1, 0.2], [0, 0.2]]);
    }
    // Pavement as a ring between kerb and lot line (both are insets of the same block face, so
    // their vertices correspond); the lot grass sits just below, so floors and yards drawn at
    // kerb height (depot, shops) are never covered by it and nothing overlaps (no z-fighting).
    const l = b.lot;
    if (l.length === k.length) {
      for (let i = 0; i < k.length; i++) {
        const j = (i + 1) % k.length;
        pavementQuad(flat, mats.pavement, k[i]!, k[j]!, l[j]!, l[i]!);
      }
    } else fillPolygon(flat, mats.pavement, k, CURB_H);
    fillPolygon(flat, mats.grass, l, CURB_H - 0.012);
  }
  void SIDEWALK; void upright;
}

function buildStreetLights(set: BatchSet, mats: Materials, scene: Scene): void {
  const pole = mats.paint('#9a968e');
  for (const p of streetLightPositions()) {
    const shaft = CreateCylinder('poste-luz', { diameterTop: 0.14, diameterBottom: 0.24, height: 7.5, tessellation: 7 }, scene);
    shaft.position.set(p.x, CURB_H + 3.75, p.z);
    set.absorb(pole, shaft);
    const ax = Math.sin(p.yaw) * 1.6; const az = Math.cos(p.yaw) * 1.6;
    set.box(mats.paint('#5d6368', 0.25), Math.min(p.x, p.x + ax) - 0.04, Math.max(p.x, p.x + ax) + 0.04, CURB_H + 7.3, CURB_H + 7.38, Math.min(p.z, p.z + az) - 0.04, Math.max(p.z, p.z + az) + 0.04);
    set.box(mats.glow('#fff1cf'), p.x + ax - 0.22, p.x + ax + 0.22, CURB_H + 7.14, CURB_H + 7.3, p.z + az - 0.22, p.z + az + 0.22);
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

const PRODUCTS = ['#c9302c', '#2b5aa8', '#f2c230', '#1f8a5b', '#f4f1ea', '#7a3f8f', '#e07b39', '#9cc3d5', '#6b4f3a'];
function buildStore(scene: Scene, mats: Materials, s: Store): { meshes: Mesh[]; shutter: Mesh } {
  const set = new BatchSet();
  set.setTransform(placement(s.frame));
  const W = s.width; const D = s.depth; const H = s.height; const t = 0.25;
  const L = STORE_SETBACK;
  const wall = mats.plaster(s.wall);
  const band = mats.plaster(s.band);
  const trim = mats.paint('#e9e4d8');
  const door0 = W / 2 - 1.3; const door1 = W / 2 + 1.3;
  // Shell: side and back walls, front pillars, kerb wall under the windows, lintel, parapet.
  set.box(wall, 0, t, 0, H, L, D, { fitV: true });
  set.box(wall, W - t, W, 0, H, L, D, { fitV: true });
  set.box(wall, 0, W, 0, H, D - t, D, { fitV: true });
  set.box(wall, 0, W, 3.0, H, L, L + t, { fitV: true });
  for (const [x0, x1] of [[0, 0.5], [door0 - 0.3, door0], [door1, door1 + 0.3], [W - 0.5, W]] as const) set.box(wall, x0, x1, 0, 3.0, L, L + t, { fitV: true });
  for (const [x0, x1] of [[0.5, door0 - 0.3], [door1 + 0.3, W - 0.5]] as const) set.box(band, x0, x1, 0, 0.45, L, L + t);
  set.box(band, -0.02, W + 0.02, 0, 0.9, L + t, D + 0.02, { fitV: true, top: false });
  set.box(trim, -0.1, W + 0.1, H, H + 0.14, L - 0.1, D + 0.1);
  set.box(mats.ribbed('#8f948f'), t, W - t, H - 0.4, H - 0.35, L + t, D - t, { sides: false, bottom: true });
  // Pilasters on the long side walls.
  for (let z = L + 3; z < D - 1; z += 3.5) for (const x of [-0.04, W - 0.02]) set.box(band, x, x + 0.06, 0.9, H, z - 0.18, z + 0.18);
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
  // Interior: tiled floor, counter with till, shelves of goods, stock-room door, ceiling lights.
  set.box(mats.paint('#d9d4ca', 0.12), t, W - t, 0.004, 0.012, L + t, D - t, { sides: false });
  const cz = D * 0.52;
  set.box(mats.paint(s.band, 0.15), 1.2, W - 3.2, 0, 0.95, cz - 0.35, cz + 0.35);
  set.box(mats.paint('#7a5a3a', 0.2), 1.15, W - 3.15, 0.95, 1.0, cz - 0.4, cz + 0.4);
  set.box(mats.paint('#2b2d31', 0.3), W / 2 - 0.3, W / 2 + 0.1, 1.0, 1.28, cz - 0.15, cz + 0.15);
  set.box(mats.paint('#9aa0a6', 0.3), W / 2 - 0.25, W / 2 + 0.05, 1.28, 1.3, cz - 0.1, cz + 0.12);
  const rack = mats.paint('#cfd2d4', 0.25);
  const shelf = (x0: number, x1: number, z0: number, z1: number, levels: number, seed: number) => {
    set.box(rack, x0, x1, 0, 0.08, z0, z1);
    for (let k = 1; k <= levels; k++) set.box(rack, x0, x1, k * 0.5 - 0.02, k * 0.5, z0, z1);
    for (const x of [x0, x1 - 0.04]) set.box(rack, x, x + 0.04, 0, levels * 0.5 + 0.1, z0, z1);
    let n = seed;
    for (let k = 0; k < levels; k++) {
      for (let x = x0 + 0.1; x < x1 - 0.3; x += 0.32 + (n % 3) * 0.05) {
        n = (n * 7 + 3) % 97;
        const h = 0.18 + (n % 5) * 0.05;
        set.box(mats.paint(PRODUCTS[n % PRODUCTS.length]!, 0.12), x, x + 0.26, k * 0.5 + 0.08 * (k === 0 ? 1 : 0), k * 0.5 + h, z0 + 0.05, z1 - 0.05);
      }
    }
  };
  shelf(0.6, W - 0.6, D - 1.0, D - t, 4, s.id.length * 5);
  shelf(t, t + 0.6, cz + 1.2, D - 1.6, 4, s.id.length * 11);
  set.box(mats.paint('#5a4636', 0.15), W - 2.4, W - 1.4, 0, 2.1, D - t - 0.02, D - t);
  for (let x = 2; x < W - 1; x += 3.5) set.box(mats.glow('#fff6dc'), x, x + 1.4, H - 0.47, H - 0.42, cz - 2.5, cz - 2.3);
  for (let x = 2; x < W - 1; x += 3.5) set.box(mats.glow('#fff6dc'), x, x + 1.4, H - 0.47, H - 0.42, cz + 1.2, cz + 1.4);
  // Awning and sign board.
  const awning = mats.stripes(`toldo-${s.id}`, s.band, '#f4f1e8', 8, false, 3.2);
  set.of(awning).quad([0.4, 2.95, L - 1.5], [W - 0.4, 2.95, L - 1.5], [W - 0.4, 3.35, L - 0.28], [0.4, 3.35, L - 0.28], (W - 0.8) / 3.2, 1);
  const aspect = (W - 1) / 1.0;
  const sign = mats.sign(`placa-${s.id}`, s.sign[0], s.sign[1], [
    { text: s.name.toUpperCase(), size: 0.46, color: s.sign[1] },
    { text: s.subtitle, size: 0.2, color: s.sign[1], weight: '700' },
  ], aspect, 128);
  set.of(sign).quad([0.5, 3.4, L - 0.04], [W - 0.5, 3.4, L - 0.04], [W - 0.5, H - 0.05, L - 0.04], [0.5, H - 0.05, L - 0.04], 1, 1);
  // Forecourt paving.
  set.box(mats.plazaPaving, 0, W, 0, 0.012, 0, L + t, { sides: false });
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

function buildDepot(scene: Scene, set: BatchSet, flat: BatchSet, mats: Materials): void {
  const d = DEPOT;
  const b = d.building;
  const cladding = mats.ribbed('#d8dde0');
  // Yard asphalt and markings (lot is at kerb height).
  drawBox(flat, mats.asphalt, d.yard, CURB_H - 0.02, CURB_H + 0.001, flatOnly);
  drawBox(flat, mats.asphalt, { minX: d.lot.minX, maxX: d.lot.maxX, minZ: d.lot.minZ, maxZ: d.yard.minZ }, CURB_H - 0.02, CURB_H + 0.001, flatOnly);
  for (const x of d.docks) {
    drawBox(flat, mats.lineYellow, { minX: x - 1.6, maxX: x - 1.45, minZ: b.maxZ, maxZ: b.maxZ + 14 }, CURB_H, CURB_H + 0.01, flatOnly);
    drawBox(flat, mats.lineYellow, { minX: x + 1.45, maxX: x + 1.6, minZ: b.maxZ, maxZ: b.maxZ + 14 }, CURB_H, CURB_H + 0.01, flatOnly);
  }
  for (let x = d.motoBays.x0; x <= d.motoBays.x1; x += 1.4) drawBox(flat, mats.lineWhite, { minX: x - 0.05, maxX: x + 0.05, minZ: d.motoBays.z - 1.3, maxZ: d.motoBays.z + 1.3 }, CURB_H, CURB_H + 0.01, flatOnly);
  // CORE-014 building: hollow steel shed (walls match depotLayout), concrete plinth, high window
  // band, roof with overhang, dock doors (rolled up), staff door, interior operation.
  const H = d.height; const y0 = CURB_H; const t = 0.3;
  const shell = (x0: number, x1: number, z0: number, z1: number) => {
    set.box(mats.paint('#8a8d90', 0.05), x0, x1, y0, y0 + 1.1, z0, z1);
    set.box(cladding, x0, x1, y0 + 1.1, y0 + H, z0, z1);
  };
  for (const w of depotLayout().walls) shell(w.minX, w.maxX, w.minZ, w.maxZ);
  set.box(mats.ribbed('#a9adb2'), b.minX - 0.6, b.maxX + 0.6, y0 + H, y0 + H + 0.25, b.minZ - 0.6, b.maxZ + 0.6);
  set.box(mats.paint('#e7e3da'), b.minX - 0.65, b.maxX + 0.65, y0 + H - 0.05, y0 + H + 0.32, b.minZ - 0.66, b.minZ - 0.6);
  // Lintels over the dock openings and the staff door.
  for (const x of d.docks) set.box(cladding, x - 1.6, x + 1.6, y0 + 4.3, y0 + H, b.maxZ - t, b.maxZ);
  set.box(cladding, b.minX, b.minX + t, y0 + 2.3, y0 + H, -123.4, -121);
  // High translucent window band on the long walls.
  for (const z of [b.minZ - 0.02, b.maxZ + 0.02]) {
    set.box(mats.paint('#9fb4bf', 0.6), b.minX + 1, b.maxX - 1, y0 + 6.4, y0 + 7.4, z - 0.01, z + 0.01);
  }
  for (const x of [b.minX + 0.5, b.maxX - 0.5]) set.box(mats.paint('#6f7378', 0.3), x - 0.07, x + 0.07, y0, y0 + H, b.maxZ + 0.02, b.maxZ + 0.12);
  for (const x of d.docks) {
    // Opening frame, rolled shutter, platform with bumpers and a dock light.
    set.box(mats.paint('#f2c230'), x - 1.65, x - 1.5, y0, y0 + 4.3, b.maxZ, b.maxZ + 0.08);
    set.box(mats.paint('#f2c230'), x + 1.5, x + 1.65, y0, y0 + 4.3, b.maxZ, b.maxZ + 0.08);
    set.box(mats.ribbed('#9aa1a8'), x - 1.5, x + 1.5, y0 + 3.7, y0 + 4.3, b.maxZ - 0.2, b.maxZ - 0.05);
    set.box(mats.paint('#55595e'), x - 1.6, x + 1.6, y0, y0 + 1.0, b.maxZ, b.maxZ + 1.8);
    set.box(mats.paint('#1b1b1b'), x - 1.5, x + 1.5, y0 + 0.2, y0 + 0.9, b.maxZ + 1.8, b.maxZ + 1.95);
    set.box(mats.glow('#ffe7b0'), x - 0.15, x + 0.15, y0 + 4.5, y0 + 4.65, b.maxZ + 0.05, b.maxZ + 0.2);
  }
  // Staff door canopy and sign, gatehouse (portaria) by the yard entrance.
  set.box(mats.paint('#3a3d40', 0.3), b.minX - 1.2, b.minX, y0 + 2.6, y0 + 2.75, -123.8, -120.6);
  set.box(mats.paint('#5d6368', 0.3), b.minX - 0.03, b.minX + t + 0.03, y0, y0 + 2.3, -123.45, -123.4);
  const gh = { x0: 96.5, x1: 99.2, z0: -97.6, z1: -94.6 };
  set.box(mats.plaster('#ecebe5'), gh.x0, gh.x1, y0, y0 + 0.9, gh.z0, gh.z1, { fitV: true });
  set.box(mats.paint('#2f4352', 0.6), gh.x0 + 0.05, gh.x1 - 0.05, y0 + 0.9, y0 + 2.2, gh.z0 + 0.05, gh.z1 - 0.05);
  for (const [x, z] of [[gh.x0, gh.z0], [gh.x1, gh.z0], [gh.x0, gh.z1], [gh.x1, gh.z1]] as const) set.box(mats.plaster('#ecebe5'), x - 0.1, x + 0.1, y0, y0 + 2.4, z - 0.1, z + 0.1);
  set.box(mats.paint('#1d4f9c', 0.2), gh.x0 - 0.3, gh.x1 + 0.3, y0 + 2.4, y0 + 2.6, gh.z0 - 0.3, gh.z1 + 0.3);
  // Interior: sealed floor with safety lanes, columns, racks with pallets, sorting line, desks.
  const floor = mats.paint('#9a9a95', 0.1);
  set.box(floor, b.minX + t, b.maxX - t, y0, y0 + 0.012, b.minZ + t, b.maxZ - t, { sides: false });
  for (const z of [-126.2, -133.2]) set.box(mats.lineYellow, b.minX + 1, b.maxX - 1, y0 + 0.012, y0 + 0.02, z - 0.06, z + 0.06, { sides: false });
  const steel = mats.paint('#3f6e9a', 0.25);
  for (let x = b.minX + 7.3; x < b.maxX - 2; x += 7.3) {
    for (const z of [b.minZ + 0.45, b.maxZ - 0.45]) set.box(steel, x - 0.15, x + 0.15, y0, y0 + H, z - 0.15, z + 0.15);
    set.box(steel, x - 0.1, x + 0.1, y0 + H - 0.7, y0 + H - 0.4, b.minZ + 0.3, b.maxZ - 0.3);
  }
  for (let x = b.minX + 4; x < b.maxX - 2; x += 8) for (const z of [-124, -134]) set.box(mats.glow('#f4f6ff'), x - 1.2, x + 1.2, y0 + H - 1.2, y0 + H - 1.1, z - 0.15, z + 0.15);
  // Pallet racks along the back wall with stacked boxes.
  const rackBlue = mats.paint('#2b5aa8', 0.25); const rackOrange = mats.paint('#e07b39', 0.25);
  for (let x = 100; x < 134; x += 2.7) {
    set.box(rackBlue, x, x + 0.1, y0, y0 + 4.5, -141.6, -140.2);
    for (const y of [1.5, 3.0, 4.5]) set.box(rackOrange, x, x + 2.7, y0 + y - 0.12, y0 + y, -141.6, -140.2);
    for (const [k, y] of [[0, 0], [1, 1.5], [2, 3.0]] as const) {
      set.box(mats.paint('#b9935a'), x + 0.2, x + 2.5, y0 + y, y0 + y + 0.14, -141.5, -140.3);
      if ((x * 3 + k) % 4 < 3) set.box(mats.paint(['#c69a5f', '#b88a55', '#d2ab73'][(k + Math.round(x)) % 3]!), x + 0.3, x + 2.4, y0 + y + 0.14, y0 + y + 1.05, -141.4, -140.4);
    }
  }
  // Sorting line: belt on legs with rollers, parcels on the belt, labelled bairro bays.
  set.box(mats.paint('#2b2d31', 0.2), 105, 117, y0 + 0.82, y0 + 0.9, -130.2, -128.8);
  set.box(mats.paint('#55595e', 0.3), 105, 117, y0 + 0.7, y0 + 0.82, -130.4, -128.6);
  for (let x = 105.4; x < 117; x += 1.6) for (const z of [-130.3, -128.7]) set.box(mats.paint('#55595e', 0.3), x - 0.05, x + 0.05, y0, y0 + 0.7, z - 0.05, z + 0.05);
  for (const [x, c] of [[106.2, '#c69a5f'], [108.4, '#d2ab73'], [111.5, '#b88a55'], [114.8, '#c69a5f']] as const) set.box(mats.paint(c), x, x + 0.5, y0 + 0.9, y0 + 1.25, -129.8, -129.2);
  // Receiving desk with a terminal, dispatch counter with sacks, roll cages, pallets, office.
  set.box(mats.paint('#7a5a3a', 0.2), 93.2, 94.4, y0, y0 + 1.0, -124.4, -120.6);
  set.box(mats.paint('#202326', 0.3), 93.5, 93.6, y0 + 1.0, y0 + 1.4, -123, -122.4);
  set.box(mats.paint('#7a5a3a', 0.2), 93.2, 94.4, y0, y0 + 1.0, -133, -129);
  for (const [z, c] of [[-132.6, '#e9dcc0'], [-131.8, '#d8c9a8']] as const) set.absorb(mats.paint(c), ballPart(scene, [0.55, 0.75, 0.5], [92.65, y0 + 0.36, z], 6));
  for (const x of [127.2, 128.7]) {
    set.of(mats.railing).quad([x, y0, -131], [x, y0, -128.6], [x, y0 + 1.7, -128.6], [x, y0 + 1.7, -131], 2.4, 1);
    set.box(mats.paint('#c69a5f'), x - 0.6, x + 0.6, y0 + 0.1, y0 + 0.9, -130.6, -129);
  }
  for (const x of [100, 120]) {
    set.box(mats.paint('#b9935a'), x, x + 3, y0, y0 + 0.14, -126, -124);
    set.box(mats.paint('#d2ab73'), x + 0.2, x + 2.8, y0 + 0.14, y0 + 1.3, -125.8, -124.2);
    set.box(mats.paint('#e9e5dc', 0.3), x + 0.15, x + 2.85, y0 + 1.3, y0 + 1.32, -125.85, -124.15);
  }
  set.box(mats.plaster('#ecebe5'), 124, 134, y0, y0 + 1.1, -137, -136.4, { fitV: true });
  set.box(mats.paint('#2f4352', 0.6), 124, 134, y0 + 1.1, y0 + 2.6, -136.75, -136.65);
  set.box(mats.plaster('#ecebe5'), 124, 134, y0 + 2.6, y0 + 2.9, -137, -136.4);
  const ops = mats.sign('placa-galpao-setores', '#1d4f9c', '#f2c230', [
    { text: 'RECEBIMENTO · TRIAGEM · EXPEDIÇÃO', size: 0.42, color: '#ffffff' },
  ], 8, 64);
  set.of(ops).quad([100, y0 + 5.2, -126.3], [116, y0 + 5.2, -126.3], [116, y0 + 6.2, -126.3], [100, y0 + 6.2, -126.3], 1, 1);
  // Driveway apron over the pavement gap at the yard gate.
  drawBox(flat, mats.plazaPaving, { minX: d.gate.x0, maxX: d.gate.x1, minZ: d.lot.maxZ, maxZ: -86 - ROAD_HALF }, -0.03, 0.015, flatOnly);
  const sign = mats.sign('placa-galpao', '#1d4f9c', '#f2c230', [
    { text: 'GALPÃO LOGÍSTICO', size: 0.42, color: '#ffffff' },
    { text: 'BREJO ALEGRE · CARGA E DESCARGA', size: 0.2, color: '#f2c230', weight: '700' },
  ], 9, 128);
  set.of(sign).quad([b.minX + 8, CURB_H + 5.2, b.maxZ + 0.06], [b.maxX - 8, CURB_H + 5.2, b.maxZ + 0.06], [b.maxX - 8, CURB_H + 8.4, b.maxZ + 0.06], [b.minX + 8, CURB_H + 8.4, b.maxZ + 0.06], 1, 1);
  // Chain-link fence with the gate opening on R. 13 de Maio.
  const fence = mats.railing;
  const fz = d.lot.maxZ - 0.07;
  for (const [x0, x1] of [[d.lot.minX, d.gate.x0], [d.gate.x1, d.lot.maxX]] as const) {
    set.of(fence).quad([x0, CURB_H, fz], [x1, CURB_H, fz], [x1, CURB_H + 2.2, fz], [x0, CURB_H + 2.2, fz], x1 - x0, 1);
  }
  for (const x of [d.gate.x0, d.gate.x1]) set.box(mats.paint('#3a3d40', 0.3), x - 0.12, x + 0.12, CURB_H, CURB_H + 2.6, fz - 0.12, fz + 0.12);
  for (const [x, z0, z1] of [[d.lot.minX + 0.07, b.minZ, d.lot.maxZ], [d.lot.maxX - 0.07, b.minZ, d.lot.maxZ]] as const) {
    set.of(fence).quad([x, CURB_H, z1], [x, CURB_H, z0], [x, CURB_H + 2.2, z0], [x, CURB_H + 2.2, z1], z1 - z0, 1);
  }
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
  buildDepot(scene, upright, flat, mats);
  upright.setTransform(null); flat.setTransform(null);
  // Frontage walls (plaster, stone plinth, coping, pillars) along every block edge between lots.
  const wallPaint = ['#e2d8c4', '#ece4d2', '#d9cdb5', '#e8dcc6'];
  frontageWalls().forEach((w, i) => {
    upright.setTransform(placement(w.frame));
    const paint = mats.plaster(wallPaint[i % wallPaint.length]!);
    const L = w.length;
    upright.box(paint, 0, L, 0.35, WALL_H, 0, 0.22, { fitV: true });
    upright.box(mats.paint('#9b9184'), -0.02, L + 0.02, 0, 0.35, -0.02, 0.24);
    upright.box(mats.paint('#cfc6b4'), -0.05, L + 0.05, WALL_H, WALL_H + 0.07, -0.05, 0.27);
    const n = Math.max(1, Math.round(L / 3.2));
    for (let k = 0; k <= n; k++) {
      const t = (L * k) / n;
      upright.box(paint, t - 0.16, t + 0.16, 0, WALL_H + 0.18, -0.08, 0.3, { fitV: true });
      upright.box(mats.paint('#cfc6b4'), t - 0.2, t + 0.2, WALL_H + 0.18, WALL_H + 0.25, -0.12, 0.34);
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
  for (const s of STORES) {
    const built = buildStore(scene, mats, s);
    bodies.push(...built.meshes, built.shutter);
    shutters.set(s.id, built.shutter);
  }
  void DEPOT;
  return { bodies, shutters };
}
