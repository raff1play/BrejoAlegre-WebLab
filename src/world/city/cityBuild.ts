import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { Box2D } from '../../core/collision';
import { buildHouse, placement, type Building, type SharedBatches } from '../buildings';
import { BatchSet } from '../geometry';
import type { LabMaterial, Materials } from '../materials';
import { CURB_H, HOUSE_STYLES, ROAD_HALF, SIDEWALK, WALL_H, WALL_T, type Frame } from '../layout';
import { coreClip, frontageWalls, outside, streetLightPositions } from './cityLayout';
import {
  BLOCKS, BUS_STOPS, CHURCH, CITY_LOTS, DEPOT, JUNCTION_HALF, NODES, ROADS, SCHOOL, SERVICES, SPEED_HUMPS, STORES,
  nodeById, pavementStrips, roadSpan, type Store,
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
    if (n.exit || n.id === 'centro' || n.control === 'free') continue;
    for (const r of ROADS) {
      if (r.a !== n.id && r.b !== n.id) continue;
      if (r.kind !== 'urban') continue;
      const s = roadSpan(r);
      const dir = r.a === n.id ? 1 : -1; // direction from the node along the road
      const along = (s.axis === 'x' ? n.x : n.z) + dir * (ROAD_HALF + 0.6);
      for (let c = -ROAD_HALF + 0.4; c <= ROAD_HALF - 0.4; c += 0.8) {
        drawBox(flat, mats.lineWhite, rect(s.axis, Math.min(along, along + dir * 3), Math.max(along, along + dir * 3), s.c + c - 0.2, s.c + c + 0.2), 0, 0.008, flatOnly);
      }
      const minorStop = n.control === 'stop' && r.priority < Math.max(...ROADS.filter((q) => q.a === n.id || q.b === n.id).map((q) => q.priority));
      if (n.control === 'signal' || minorStop) {
        // Stop line across the inbound lane (right-hand lane when approaching the node).
        const line = along + dir * 4;
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

/** Generic one-storey shop with parapet front, roll-up doors, awning and a lettered sign. */
function buildStore(scene: Scene, mats: Materials, s: Store): Mesh[] {
  const set = new BatchSet();
  set.setTransform(placement(s.frame));
  const W = s.width; const D = s.depth; const H = s.height;
  const wall = mats.plaster(s.wall);
  const band = mats.plaster(s.band);
  const trim = mats.paint('#e9e4d8');
  const setback = 1.5;
  set.box(wall, 0, W, 0, H, setback, D, { fitV: true, top: false });
  set.box(mats.ribbed('#8f948f'), 0.2, W - 0.2, H - 0.35, H - 0.3, setback + 0.2, D - 0.2, { sides: false });
  set.box(band, -0.02, W + 0.02, 0, 0.9, setback - 0.02, D + 0.02, { fitV: true });
  set.box(trim, -0.1, W + 0.1, H, H + 0.14, setback - 0.1, D + 0.1);
  // Glass front with doors, dark interior behind, roll-up housings above.
  const z = setback - 0.03;
  const glass = mats.paint('#2f4352', 0.6);
  for (let x = 0.8; x < W - 0.8; x += 3.2) {
    const x1 = Math.min(W - 0.8, x + 2.8);
    set.of(glass).quad([x, 0.05, z], [x1, 0.05, z], [x1, 2.8, z], [x, 2.8, z], 1, 1);
    set.box(mats.paint('#6d7379', 0.2), x - 0.06, x1 + 0.06, 2.8, 3.05, setback - 0.25, setback);
  }
  // Awning and sign board.
  const awning = mats.stripes(`toldo-${s.id}`, s.band, '#f4f1e8', 8, false, 3.2);
  set.of(awning).quad([0.4, 2.85, setback - 1.5], [W - 0.4, 2.85, setback - 1.5], [W - 0.4, 3.25, setback], [0.4, 3.25, setback], (W - 0.8) / 3.2, 1);
  const aspect = (W - 1) / 1.0;
  const sign = mats.sign(`placa-${s.id}`, s.sign[0], s.sign[1], [
    { text: s.name.toUpperCase(), size: 0.46, color: s.sign[1] },
    { text: s.subtitle, size: 0.2, color: s.sign[1], weight: '700' },
  ], aspect, 128);
  set.of(sign).quad([0.5, 3.35, setback - 0.04], [W - 0.5, 3.35, setback - 0.04], [W - 0.5, H - 0.05, setback - 0.04], [0.5, H - 0.05, setback - 0.04], 1, 1);
  // Forecourt paving and a short parking strip line.
  set.box(mats.plazaPaving, 0, W, 0, 0.012, 0, setback, { sides: false });
  set.setTransform(null);
  return set.build(`loja-${s.id}`, scene);
}

function buildDepot(set: BatchSet, flat: BatchSet, mats: Materials): void {
  const d = DEPOT;
  const b = d.building;
  const cladding = mats.ribbed('#d8dde0');
  // Yard asphalt and markings (lot is at kerb height).
  drawBox(flat, mats.asphalt, d.yard, CURB_H - 0.02, CURB_H + 0.001, flatOnly);
  drawBox(flat, mats.asphalt, { minX: d.lot.minX, maxX: d.lot.maxX, minZ: d.lot.minZ, maxZ: b.minZ }, CURB_H - 0.02, CURB_H + 0.001, flatOnly);
  for (const x of d.docks) {
    drawBox(flat, mats.lineYellow, { minX: x - 1.6, maxX: x - 1.45, minZ: b.maxZ, maxZ: b.maxZ + 14 }, CURB_H, CURB_H + 0.01, flatOnly);
    drawBox(flat, mats.lineYellow, { minX: x + 1.45, maxX: x + 1.6, minZ: b.maxZ, maxZ: b.maxZ + 14 }, CURB_H, CURB_H + 0.01, flatOnly);
  }
  for (let x = d.motoBays.x0; x <= d.motoBays.x1; x += 1.4) drawBox(flat, mats.lineWhite, { minX: x - 0.05, maxX: x + 0.05, minZ: d.motoBays.z - 1.3, maxZ: d.motoBays.z + 1.3 }, CURB_H, CURB_H + 0.01, flatOnly);
  // Building: steel cladding, base, roof, dock doors with platforms.
  set.box(cladding, b.minX, b.maxX, CURB_H, CURB_H + d.height, b.minZ, b.maxZ);
  set.box(mats.paint('#7c8086'), b.minX - 0.05, b.maxX + 0.05, CURB_H, CURB_H + 1.0, b.minZ - 0.05, b.maxZ + 0.05);
  set.box(mats.ribbed('#a9adb2'), b.minX - 0.4, b.maxX + 0.4, CURB_H + d.height, CURB_H + d.height + 0.3, b.minZ - 0.4, b.maxZ + 0.4);
  for (const x of d.docks) {
    set.box(mats.paint('#2a2d30'), x - 1.4, x + 1.4, CURB_H + 1.0, CURB_H + 4.2, b.maxZ, b.maxZ + 0.02);
    set.box(mats.ribbed('#9aa1a8'), x - 1.3, x + 1.3, CURB_H + 2.6, CURB_H + 4.1, b.maxZ + 0.02, b.maxZ + 0.05);
    set.box(mats.paint('#55595e'), x - 1.6, x + 1.6, CURB_H, CURB_H + 1.0, b.maxZ, b.maxZ + 1.8);
    set.box(mats.paint('#1b1b1b'), x - 1.5, x + 1.5, CURB_H + 0.2, CURB_H + 0.9, b.maxZ + 1.8, b.maxZ + 1.95);
  }
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

export type CityBuild = { bodies: Mesh[] };

/** Builds the expansion into the shared batches; returns the separate building meshes (shadow casters). */
export function buildCity(scene: Scene, mats: Materials, shared: SharedBatches): CityBuild {
  const { flat, upright } = shared;
  buildRoads(flat, upright, mats, scene);
  buildStreetLights(upright, mats, scene);
  buildBusStops(upright, mats);
  buildDepot(upright, flat, mats);
  // Blocks: lot level ground (grass) under everything, then buildings.
  for (const b of BLOCKS) drawBox(flat, mats.grass, b.box, CURB_H - 0.03, CURB_H - 0.025, flatOnly);
  drawBox(flat, mats.grass, DEPOT.lot, CURB_H - 0.04, CURB_H - 0.035, flatOnly);
  const bodies: Mesh[] = [];
  for (const l of CITY_LOTS) {
    const style = HOUSE_STYLES[l.style % HOUSE_STYLES.length]!;
    const building: Building = buildHouse(scene, mats, { ...style, id: l.id, frame: l.frame }, shared);
    bodies.push(...building.body);
  }
  for (const s of STORES.slice(1)) bodies.push(...buildStore(scene, mats, s));
  bodies.push(...buildChurch(scene, mats));
  bodies.push(...buildCivic(scene, mats, 'escola', ['E.E. AGOSTINHO GRIGOLETO', 'Escola estadual · releitura no jogo'], SCHOOL.frame, SCHOOL.width, SCHOOL.depth, '#f4efe2', '#2b5aa8'));
  bodies.push(...buildCivic(scene, mats, 'servicos', ['CENTRO DE SERVIÇOS', 'Prédio fictício do jogo'], SERVICES.frame, SERVICES.width, SERVICES.depth, '#eef0ea', '#3f7a55'));
  for (const w of frontageWalls()) upright.box(mats.plaster('#e2d8c4'), w.minX, w.maxX, CURB_H, CURB_H + WALL_H, w.minZ, w.maxZ, { fitV: true });
  // Periphery fields: ploughed strips and pasture (visual only, walkable).
  const fields: [Box2D, 'dirt' | 'grass'][] = [
    [{ minX: -150, maxX: -84, minZ: -150, maxZ: -40 }, 'dirt'], [{ minX: 20, maxX: 66, minZ: -158, maxZ: -96 }, 'dirt'],
    [{ minX: 84, maxX: 150, minZ: 0, maxZ: 120 }, 'grass'], [{ minX: -150, maxX: -84, minZ: 10, maxZ: 130 }, 'grass'],
  ];
  for (const [f, kind] of fields) {
    if (kind === 'dirt') for (let z = f.minZ; z < f.maxZ; z += 3) drawBox(flat, mats.dirt, { ...f, minZ: z, maxZ: z + 1.6 }, -0.028, -0.02, flatOnly);
  }
  return { bodies };
}
