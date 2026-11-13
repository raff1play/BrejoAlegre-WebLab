import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import type { Box2D } from '../../core/collision';
import { buildHouse, placement, type Building, type SharedBatches } from '../buildings';
import { BatchSet } from '../geometry';
import { ballPart } from '../modelParts';
import type { LabMaterial, Materials } from '../materials';
import { CURB_H, HOUSE_STYLES, ROAD_HALF, SIDEWALK, WALL_H, WALL_T, type Frame } from '../layout';
import { coreClip, frontageWalls, outside, streetLightPositions } from './cityLayout';
import { buildAddresses } from '../../core/delivery/addresses';
import {
  BLOCKS, BUS_STOPS, CHURCH, CITY_LOTS, DEPOT, JUNCTION_HALF, NODES, ROADS, SCHOOL, SERVICES, SPEED_HUMPS, STORES,
  STORE_SETBACK, SOUTH_Z, depotLayout, nodeById, pavementStrips, roadSpan, type Store,
} from './cityPlan';

/**
 * CORE-013 renderer for the expansion: roads from the shared network, the new buildings and the
 * frontage walls. Everything static is merged per material into the shared batches (few draw calls).
 */
const E = ROAD_HALF + SIDEWALK;
const flatOnly = { sides: false } as const;

const rect = (axis: 'x' | 'z', a0: number, a1: number, c0: number, c1: number): Box2D =>
  axis === 'x' ? { minX: a0, maxX: a1, minZ: c0, maxZ: c1 } : { minX: c0, maxX: c1, minZ: a0, maxZ: a1 };

function drawBox(set: BatchSet, m: LabMaterial, b: Box2D, y0: number, y1: number, options?: { sides?: boolean; top?: boolean }): void {
  set.box(m, b.minX, b.maxX, y0, y1, b.minZ, b.maxZ, options);
}

export function buildRoads(flat: BatchSet, upright: BatchSet, mats: Materials, scene: Scene): void {
  for (const r of ROADS) {
    if (r.kind === 'yard') continue; // the depot yard is paved as a whole
    const s = roadSpan(r);
    const clip = coreClip(r);
    for (const [lo, hi] of outside(s.lo, s.hi, clip)) {
      drawBox(flat, mats.asphalt, rect(s.axis, lo, hi, s.c - ROAD_HALF, s.c + ROAD_HALF), -0.05, 0, flatOnly);
      // Lane markings: yellow dashed centre, white edge lines (interrupted at junction boxes).
      const a = nodeById(r.a); const b = nodeById(r.b);
      const mlo = Math.max(lo, s.lo + (a.exit ? 0 : JUNCTION_HALF + 2));
      const mhi = Math.min(hi, s.hi - (b.exit ? 0 : JUNCTION_HALF + 2));
      for (let t = mlo; t < mhi - 1; t += 6) drawBox(flat, mats.lineYellow, rect(s.axis, t, Math.min(t + 3, mhi), s.c - 0.06, s.c + 0.06), 0, 0.008, flatOnly);
      for (const e of [-1, 1]) {
        const c = s.c + e * (ROAD_HALF - 0.45);
        if (mhi > mlo) drawBox(flat, mats.lineWhite, rect(s.axis, mlo, mhi, c - 0.06, c + 0.06), 0, 0.008, flatOnly);
      }
      if (r.kind === 'urban') {
        for (const strip of pavementStrips(r)) {
          const [p0, p1] = s.axis === 'x' ? [strip.minX, strip.maxX] : [strip.minZ, strip.maxZ];
          for (const [q0, q1] of outside(Math.max(p0, lo), Math.min(p1, hi), clip)) {
            const piece = s.axis === 'x' ? { ...strip, minX: q0, maxX: q1 } : { ...strip, minZ: q0, maxZ: q1 };
            drawBox(upright, mats.pavement, piece, 0, CURB_H);
            // Kerb stone on the road side and gutter strip.
            const kerbSide = s.axis === 'x' ? (piece.minZ > s.c ? piece.minZ : piece.maxZ) : (piece.minX > s.c ? piece.minX : piece.maxX);
            const k = kerbSide > s.c ? [kerbSide, kerbSide + 0.16] : [kerbSide - 0.16, kerbSide];
            drawBox(upright, mats.curb, rect(s.axis, q0, q1, k[0]!, k[1]!), 0, CURB_H + 0.012);
            const g = kerbSide > s.c ? [kerbSide - 0.38, kerbSide] : [kerbSide, kerbSide + 0.38];
            drawBox(flat, mats.gutter, rect(s.axis, q0, q1, g[0]!, g[1]!), 0, 0.004, flatOnly);
          }
        }
      } else {
        // Rural road: dirt shoulders.
        for (const e of [-1, 1]) drawBox(flat, mats.dirt, rect(s.axis, lo, hi, s.c + e * ROAD_HALF + (e > 0 ? 0 : -1.4), s.c + e * ROAD_HALF + (e > 0 ? 1.4 : 0)), -0.03, -0.005, flatOnly);
      }
    }
  }
  // Junction boxes and pavement corners for every non-core urban node.
  for (const n of NODES) {
    if (n.exit || n.id === 'centro' || n.id === 'docas') continue;
    drawBox(flat, mats.asphalt, { minX: n.x - ROAD_HALF, maxX: n.x + ROAD_HALF, minZ: n.z - ROAD_HALF, maxZ: n.z + ROAD_HALF }, -0.05, 0, flatOnly);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const c = { minX: Math.min(n.x + sx * ROAD_HALF, n.x + sx * E), maxX: Math.max(n.x + sx * ROAD_HALF, n.x + sx * E),
        minZ: Math.min(n.z + sz * ROAD_HALF, n.z + sz * E), maxZ: Math.max(n.z + sz * ROAD_HALF, n.z + sz * E) };
      drawBox(upright, mats.pavement, c, 0, CURB_H);
    }
  }
  buildJunctionMarkings(flat, upright, mats, scene);
  for (const h of SPEED_HUMPS) {
    const [hx, hz] = h.alongX ? [ROAD_HALF, 0.9] : [0.9, ROAD_HALF];
    const stripes = mats.stripes('lombada', '#e2b21c', '#1d1d1d', 8, false, 1.2);
    upright.box(stripes, h.x - hx, h.x + hx, 0, 0.08, h.z - hz, h.z + hz);
  }
}

/** Zebra crossings on every approach of urban junctions; stop lines on controlled approaches. */
function buildJunctionMarkings(flat: BatchSet, upright: BatchSet, mats: Materials, scene: Scene): void {
  for (const n of NODES) {
    if (n.exit || n.control === 'free') continue;
    for (const r of ROADS) {
      if (r.a !== n.id && r.b !== n.id) continue;
      if (r.kind === 'yard') continue;
      const s = roadSpan(r);
      // Centro: the W009 core already paints the avenue arms; only the cross street is added, with
      // the core's wider spacing (zebra 6.6–9.6 m, stop line at 10.25 m, matching the traffic lanes).
      if (n.id === 'centro' && s.axis === 'z') continue;
      const core = n.id === 'centro' ? 2 : 0;
      const dir = r.a === n.id ? 1 : -1; // direction from the node along the road
      const along = (s.axis === 'x' ? n.x : n.z) + dir * (ROAD_HALF + 0.6 + core);
      for (let c = -ROAD_HALF + 0.4; c <= ROAD_HALF - 0.4; c += 0.8) {
        drawBox(flat, mats.lineWhite, rect(s.axis, Math.min(along, along + dir * 3), Math.max(along, along + dir * 3), s.c + c - 0.2, s.c + c + 0.2), 0, 0.008, flatOnly);
      }
      const minorStop = n.control === 'stop' && r.priority < Math.max(...ROADS.filter((q) => q.a === n.id || q.b === n.id).map((q) => q.priority));
      if (n.control === 'signal' || minorStop) {
        // Stop line across the inbound lane (right-hand lane when approaching the node).
        const line = along + dir * (4 + (core ? 0.05 : 0));
        const lane = s.axis === 'x' ? (dir > 0 ? [s.c, s.c + ROAD_HALF - 0.2] : [s.c - ROAD_HALF + 0.2, s.c])
          : (dir > 0 ? [s.c - ROAD_HALF + 0.2, s.c] : [s.c, s.c + ROAD_HALF - 0.2]);
        drawBox(flat, mats.lineWhite, rect(s.axis, Math.min(line, line + dir * 0.35), Math.max(line, line + dir * 0.35), lane[0]!, lane[1]!), 0, 0.008, flatOnly);
      }
      if (minorStop) {
        // PARE sign on the right-hand pavement of the inbound lane.
        const across = s.axis === 'x' ? (dir > 0 ? s.c + ROAD_HALF + 0.5 : s.c - ROAD_HALF - 0.5) : (dir > 0 ? s.c - ROAD_HALF - 0.5 : s.c + ROAD_HALF + 0.5);
        const [x, z] = s.axis === 'x' ? [n.x + dir * (E + 0.4), across] : [across, n.z + dir * (E + 0.4)];
        stopSign(upright, mats, scene, x, z);
      }
    }
  }
}

function stopSign(set: BatchSet, mats: Materials, scene: Scene, x: number, z: number): void {
  set.box(mats.paint('#70757a', 0.2), x - 0.03, x + 0.03, CURB_H, CURB_H + 2.6, z - 0.03, z + 0.03);
  const plate = CreateCylinder('pare', { diameter: 0.75, height: 0.04, tessellation: 8 }, scene);
  plate.rotation.z = Math.PI / 2;
  plate.position.set(x, CURB_H + 2.3, z);
  set.absorb(mats.glow('#b5202a'), plate);
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

/**
 * CORE-014 shop: hollow building with a glass front and a central door (matching
 * `storeLayout`), parapet, sign, awning, roll-up shutter (animated by the delivery layer), shop
 * floor, counter with till, stocked shelves, stock-room door and ceiling lights.
 */
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
  drawBox(flat, mats.plazaPaving, { minX: d.gate.x0, maxX: d.gate.x1, minZ: d.lot.maxZ, maxZ: SOUTH_Z - ROAD_HALF }, -0.03, 0.004, flatOnly);
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

function buildChurch(scene: Scene, mats: Materials): Mesh[] {
  const set = new BatchSet();
  set.setTransform(placement(CHURCH.frame));
  const W = CHURCH.width; const D = CHURCH.depth;
  const white = mats.plaster('#f7f3ea');
  const trim = mats.plaster('#e2c98a');
  const H = 7.5;
  set.box(white, 0, W, 0, H, 3, D, { fitV: true });
  set.box(trim, -0.05, W + 0.05, 0, 0.8, 2.95, D + 0.05, { fitV: true });
  // Gable roof along the nave (local z), clay tiles.
  const ridge = H + 3.2;
  const roof = set.of(mats.roofTiles);
  const t = mats.roofTiles.tileU;
  roof.poly([[-0.4, H, 2.6], [W / 2, ridge, 2.6], [W / 2, ridge, D + 0.4], [-0.4, H, D + 0.4]], [[0, 0], [0, 2.4], [(D - 2) / t, 2.4], [(D - 2) / t, 0]]);
  roof.poly([[W + 0.4, H, D + 0.4], [W / 2, ridge, D + 0.4], [W / 2, ridge, 2.6], [W + 0.4, H, 2.6]], [[0, 0], [0, 2.4], [(D - 2) / t, 2.4], [(D - 2) / t, 0]]);
  set.of(white).poly([[0, H, 3], [W, H, 3], [W / 2, ridge, 3]], [[0, 0], [1, 0], [0.5, 0.5]]);
  // Central bell tower over the entrance, with a cross.
  const tw = 4;
  set.box(white, W / 2 - tw / 2, W / 2 + tw / 2, 0, 15, 0.5, 4.5, { fitV: true });
  set.box(trim, W / 2 - tw / 2 - 0.15, W / 2 + tw / 2 + 0.15, 15, 15.4, 0.35, 4.65);
  const spire = CreateCylinder('torre', { diameterTop: 0, diameterBottom: 5.2, height: 4.5, tessellation: 4 }, scene);
  spire.rotation.y = Math.PI / 4;
  spire.position.set(W / 2, 17.65, 2.5);
  set.absorb(mats.roofTiles, spire);
  set.box(mats.paint('#d9b04a', 0.4), W / 2 - 0.08, W / 2 + 0.08, 19.9, 21.6, 2.42, 2.58);
  set.box(mats.paint('#d9b04a', 0.4), W / 2 - 0.55, W / 2 + 0.55, 20.9, 21.06, 2.42, 2.58);
  // Door, rose window, side windows, steps.
  set.of(mats.door).quad([W / 2 - 1.1, 0.3, 0.47], [W / 2 + 1.1, 0.3, 0.47], [W / 2 + 1.1, 3.6, 0.47], [W / 2 - 1.1, 3.6, 0.47], 1, 1);
  set.of(mats.window).quad([W / 2 - 0.9, 6.5, 0.47], [W / 2 + 0.9, 6.5, 0.47], [W / 2 + 0.9, 8.3, 0.47], [W / 2 - 0.9, 8.3, 0.47], 1, 1);
  for (let zz = 6; zz < D - 2; zz += 4) {
    set.of(mats.window).quad([-0.03, 2.5, zz + 1.4], [-0.03, 2.5, zz], [-0.03, 5.2, zz], [-0.03, 5.2, zz + 1.4], 1, 1);
    set.of(mats.window).quad([W + 0.03, 2.5, zz], [W + 0.03, 2.5, zz + 1.4], [W + 0.03, 5.2, zz + 1.4], [W + 0.03, 5.2, zz], 1, 1);
  }
  for (let i = 0; i < 3; i++) set.box(mats.paint('#cfc6b4'), W / 2 - 2.5 + i * 0.2, W / 2 + 2.5 - i * 0.2, 0, 0.12 + i * 0.12, -0.6 + i * 0.35, 0.5);
  set.setTransform(null);
  return set.build('igreja', scene);
}

function buildCivic(scene: Scene, mats: Materials, name: string, lines: [string, string], frame: Frame, W: number, D: number, wallColour: string, bandColour: string): Mesh[] {
  const set = new BatchSet();
  set.setTransform(placement(frame));
  const H = 3.6;
  const wall = mats.plaster(wallColour);
  set.box(wall, 0, W, 0, H, 4, D, { fitV: true });
  set.box(mats.plaster(bandColour), -0.02, W + 0.02, 0, 1.0, 3.98, D + 0.02, { fitV: true });
  set.box(mats.paint('#e9e4d8'), -0.1, W + 0.1, H, H + 0.25, 3.9, D + 0.1);
  for (let x = 1.2; x < W - 2; x += 3) set.of(mats.window).quad([x, 1.1, 3.97], [x + 1.8, 1.1, 3.97], [x + 1.8, 2.5, 3.97], [x, 2.5, 3.97], 1, 1);
  set.of(mats.door).quad([W / 2 - 1, 0, 3.96], [W / 2 + 1, 0, 3.96], [W / 2 + 1, 2.3, 3.96], [W / 2 - 1, 2.3, 3.96], 1, 1);
  const sign = mats.sign(`placa-${name}`, '#f6f3ea', bandColour, [{ text: lines[0], size: 0.42, color: bandColour }, { text: lines[1], size: 0.2, color: '#333' }], 6, 96);
  set.of(sign).quad([W / 2 - 4, 2.6, 3.95], [W / 2 + 4, 2.6, 3.95], [W / 2 + 4, 3.5, 3.95], [W / 2 - 4, 3.5, 3.95], 1, 1);
  // Low wall with railing along the front and a gate.
  set.box(wall, 0, W / 2 - 1.6, 0, 0.8, 0, WALL_T, { fitV: true });
  set.box(wall, W / 2 + 1.6, W, 0, 0.8, 0, WALL_T, { fitV: true });
  set.of(mats.railing).quad([0, 0.8, 0.1], [W / 2 - 1.6, 0.8, 0.1], [W / 2 - 1.6, 2.0, 0.1], [0, 2.0, 0.1], W / 2 - 1.6, 1);
  set.of(mats.railing).quad([W / 2 + 1.6, 0.8, 0.1], [W, 0.8, 0.1], [W, 2.0, 0.1], [W / 2 + 1.6, 2.0, 0.1], W / 2 - 1.6, 1);
  set.box(mats.plazaPaving, 0, W, 0, 0.012, 0, 4, { sides: false });
  set.setTransform(null);
  return set.build(`civico-${name}`, scene);
}

function buildBusStops(set: BatchSet, mats: Materials): void {
  for (const b of BUS_STOPS) {
    const { x, z, alongZ } = b.shelter;
    const [hx, hz] = alongZ ? [0.45, 1.6] : [1.6, 0.45];
    const y = CURB_H;
    set.box(mats.paint('#2e5f8f', 0.3), x - hx, x + hx, y + 2.4, y + 2.5, z - hz, z + hz);
    for (const [px, pz] of [[x - hx + 0.05, z - hz + 0.05], [x + hx - 0.05, z + hz - 0.05], [x - hx + 0.05, z + hz - 0.05], [x + hx - 0.05, z - hz + 0.05]] as const) {
      set.box(mats.paint('#5d6368', 0.3), px - 0.04, px + 0.04, y, y + 2.4, pz - 0.04, pz + 0.04);
    }
    set.box(mats.paint('#7a5a3b'), x - hx * 0.8, x + hx * 0.8, y + 0.45, y + 0.5, z - hz * 0.8, z + hz * 0.8);
    const sign = mats.sign('placa-onibus', '#1d4f9c', '#ffffff', [{ text: 'ÔNIBUS', size: 0.5, color: '#ffffff' }], 2, 64);
    set.of(sign).quad([x - 0.4, y + 1.7, z], [x + 0.4, y + 1.7, z], [x + 0.4, y + 2.1, z], [x - 0.4, y + 2.1, z], 1, 1);
  }
}

export type CityBuild = { bodies: Mesh[]; shutters: Map<string, Mesh> };

/** Builds the expansion into the shared batches; returns the separate building meshes (shadow casters). */
export function buildCity(scene: Scene, mats: Materials, shared: SharedBatches): CityBuild {
  const { flat, upright } = shared;
  buildRoads(flat, upright, mats, scene);
  buildStreetLights(upright, mats, scene);
  buildBusStops(upright, mats);
  buildDepot(scene, upright, flat, mats);
  // Blocks: lot level ground (grass) under everything, then buildings.
  for (const b of BLOCKS) drawBox(flat, mats.grass, b.box, CURB_H - 0.03, CURB_H - 0.025, flatOnly);
  drawBox(flat, mats.grass, DEPOT.lot, CURB_H - 0.04, CURB_H - 0.035, flatOnly);
  const bodies: Mesh[] = [];
  for (const l of CITY_LOTS) {
    const style = HOUSE_STYLES[l.style % HOUSE_STYLES.length]!;
    const building: Building = buildHouse(scene, mats, { ...style, id: l.id, frame: l.frame }, shared);
    bodies.push(...building.body);
  }
  // CORE-014: enamel number plate at every deliverable house (W009 core included), on a slim post.
  const digits = mats.digits();
  const post = mats.paint('#5d6368', 0.3);
  for (const a of buildAddresses()) {
    const put = placement(a.frame);
    shared.upright.setTransform(put);
    const text = String(a.number);
    const w = 0.13 * text.length + 0.06;
    const x0 = 0.35; const y0 = 1.45; const z = -0.06;
    shared.upright.box(post, x0 + w / 2 - 0.025, x0 + w / 2 + 0.025, 0, y0, z + 0.01, z + 0.06);
    shared.upright.box(mats.paint('#f4f1ea'), x0 - 0.02, x0 + w + 0.02, y0 - 0.02, y0 + 0.2, z + 0.005, z + 0.04);
    [...text].forEach((ch, i) => {
      const xa = x0 + 0.03 + i * 0.13; const xb = xa + 0.13;
      shared.upright.of(digits).quad([xa, y0, z], [xb, y0, z], [xb, y0 + 0.18, z], [xa, y0 + 0.18, z], 0.1, 1, Number(ch) / 10, 0);
    });
    shared.upright.setTransform(null);
  }
  const shutters = new Map<string, Mesh>();
  for (const s of STORES.slice(1)) {
    const built = buildStore(scene, mats, s);
    bodies.push(...built.meshes, built.shutter);
    shutters.set(s.id, built.shutter);
  }
  bodies.push(...buildChurch(scene, mats));
  bodies.push(...buildCivic(scene, mats, 'escola', ['E.E. AGOSTINHO GRIGOLETO', 'Escola estadual · releitura no jogo'], SCHOOL.frame, SCHOOL.width, SCHOOL.depth, '#f4efe2', '#2b5aa8'));
  bodies.push(...buildCivic(scene, mats, 'servicos', ['CENTRO DE SERVIÇOS', 'Prédio fictício do jogo'], SERVICES.frame, SERVICES.width, SERVICES.depth, '#eef0ea', '#3f7a55'));
  // Frontage walls in the W009/CORE-010 manner: plastered wall, stone plinth, coping and pillars.
  const wallPaint = ['#e2d8c4', '#ece4d2', '#d9cdb5', '#e8dcc6'];
  frontageWalls().forEach((w, i) => {
    const along = w.maxX - w.minX > w.maxZ - w.minZ;
    const paint = mats.plaster(wallPaint[i % wallPaint.length]!);
    upright.box(paint, w.minX, w.maxX, CURB_H + 0.35, CURB_H + WALL_H, w.minZ, w.maxZ, { fitV: true });
    upright.box(mats.paint('#9b9184'), w.minX - 0.02, w.maxX + 0.02, CURB_H, CURB_H + 0.35, w.minZ - 0.02, w.maxZ + 0.02);
    upright.box(mats.paint('#cfc6b4'), w.minX - 0.05, w.maxX + 0.05, CURB_H + WALL_H, CURB_H + WALL_H + 0.07, w.minZ - 0.05, w.maxZ + 0.05);
    const length = along ? w.maxX - w.minX : w.maxZ - w.minZ;
    const n = Math.max(1, Math.round(length / 3.2));
    for (let k = 0; k <= n; k++) {
      const t = (along ? w.minX : w.minZ) + (length * k) / n;
      const [x0, x1, z0, z1] = along ? [t - 0.16, t + 0.16, w.minZ - 0.08, w.maxZ + 0.08] : [w.minX - 0.08, w.maxX + 0.08, t - 0.16, t + 0.16];
      upright.box(paint, x0, x1, CURB_H, CURB_H + WALL_H + 0.18, z0, z1, { fitV: true });
      upright.box(mats.paint('#cfc6b4'), x0 - 0.04, x1 + 0.04, CURB_H + WALL_H + 0.18, CURB_H + WALL_H + 0.25, z0 - 0.04, z1 + 0.04);
    }
  });
  // Periphery fields: ploughed strips and pasture (visual only, walkable).
  const fields: [Box2D, 'dirt' | 'grass'][] = [
    // Outside the playable bounds since CORE-014 (the town now fills the old fields).
    [{ minX: -232, maxX: -164, minZ: -150, maxZ: -40 }, 'dirt'], [{ minX: -232, maxX: -164, minZ: 4, maxZ: 120 }, 'dirt'],
    [{ minX: 14, maxX: 120, minZ: 168, maxZ: 226 }, 'dirt'], [{ minX: -120, maxX: -14, minZ: -226, maxZ: -172 }, 'dirt'],
  ];
  for (const [f, kind] of fields) {
    if (kind === 'dirt') for (let z = f.minZ; z < f.maxZ; z += 3) drawBox(flat, mats.dirt, { ...f, minZ: z, maxZ: z + 1.6 }, -0.028, -0.02, flatOnly);
  }
  return { bodies, shutters };
}
