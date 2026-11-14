import type { Scene } from '@babylonjs/core/scene';
import type { BatchSet } from '../geometry';
import type { Materials } from '../materials';
import { rodPart } from '../modelParts';
import { DEPOT } from './cityPlan';

/**
 * GFX-001B depot dressing, in the depot's own (CORE-014) coordinates: area signs hung from the
 * roof, a scanner arch and guards on the sorting belt, two regional dispatch cages (solid: they
 * are in cityPlan.depotLayout().furniture as DEPOT_REGION_CAGES), high-bay lamps, floor bays,
 * dock numbers and bumpers, wall safety gear. Decoration only: no parcel state is touched here.
 */
export const DEPOT_REGIONS = ['CENTRO', 'BREJO ALEGRE'] as const;

export function buildDepotDetail(scene: Scene, set: BatchSet, flat: BatchSet, mats: Materials, y0: number, cages: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[]): void {
  const b = DEPOT.building; const H = DEPOT.height;
  const dark = mats.paint('#2b2d31', 0.3); const steel = mats.paint('#8c9196', 0.45); const yellow = mats.paint('#f2c230', 0.2);
  // Signs hung from the roof over each work area (readable from the staff door, facing −x and +z).
  const hung = (name: string, text: string, x: number, z: number, w: number, bg: string, ink: string, alongX = false) => {
    const m = mats.sign(name, bg, ink, [{ text, size: 0.62, color: ink, weight: '800' }], w / 0.62, 64);
    const top = y0 + 4.3; const bot = top - 0.62;
    if (alongX) {
      set.of(m).quad([x - w / 2, bot, z], [x + w / 2, bot, z], [x + w / 2, top, z], [x - w / 2, top, z], 1, 1);
      set.of(m).quad([x + w / 2, bot, z - 0.04], [x - w / 2, bot, z - 0.04], [x - w / 2, top, z - 0.04], [x + w / 2, top, z - 0.04], 1, 1);
      set.box(dark, x - w / 2 - 0.03, x + w / 2 + 0.03, bot - 0.03, top + 0.03, z - 0.035, z - 0.005);
      for (const dx of [-w / 2 + 0.2, w / 2 - 0.2]) set.box(dark, x + dx - 0.01, x + dx + 0.01, top, y0 + H - 0.4, z - 0.03, z - 0.01);
    } else {
      set.of(m).quad([x, bot, z + w / 2], [x, bot, z - w / 2], [x, top, z - w / 2], [x, top, z + w / 2], 1, 1);
      set.of(m).quad([x + 0.04, bot, z - w / 2], [x + 0.04, bot, z + w / 2], [x + 0.04, top, z + w / 2], [x + 0.04, top, z - w / 2], 1, 1);
      set.box(dark, x + 0.005, x + 0.035, bot - 0.03, top + 0.03, z - w / 2 - 0.03, z + w / 2 + 0.03);
      for (const dz of [-w / 2 + 0.2, w / 2 - 0.2]) set.box(dark, x + 0.01, x + 0.03, top, y0 + H - 0.4, z + dz - 0.01, z + dz + 0.01);
    }
  };
  hung('galpao-recebimento', 'RECEBIMENTO', 96.2, -122.4, 3.4, '#1d4f9c', '#ffffff');
  hung('galpao-expedicao', 'EXPEDIÇÃO', 96.2, -131, 3.0, '#1f8a5b', '#ffffff');
  hung('galpao-triagem', 'TRIAGEM POR BAIRRO', 111, -127.6, 5.2, '#f2c230', '#1d1d1d', true);
  hung('galpao-estoque', 'ARMAZENAGEM', 117, -138.6, 4.2, '#e07b39', '#1d1d1d', true);

  // Sorting belt: side guards, roller ends, a scanner arch with a red light bar, feed chute.
  for (const z of [-130.25, -128.75]) set.box(steel, 105, 117, y0 + 0.9, y0 + 1.0, z - 0.03, z + 0.03);
  for (const x of [105, 117]) set.absorb(steel, rodPart(scene, [x, y0 + 0.86, -130.2], [x, y0 + 0.86, -128.8], 0.16, 0.16, 10));
  for (const z of [-130.36, -128.64]) set.box(yellow, 110.4, 110.6, y0, y0 + 2.0, z - 0.05, z + 0.05);
  set.box(yellow, 110.4, 110.6, y0 + 1.9, y0 + 2.0, -130.36, -128.64);
  set.box(mats.glow('#ff3b30'), 110.42, 110.58, y0 + 1.86, y0 + 1.9, -130.2, -128.8);
  set.box(dark, 110.3, 110.7, y0 + 1.5, y0 + 1.86, -128.6, -128.5);
  set.box(mats.glow('#7fe3a1'), 110.34, 110.66, y0 + 1.56, y0 + 1.8, -128.5, -128.49);

  // Regional dispatch cages: wire sides, a sack and parcels inside, a region plate over each.
  cages.forEach((c, i) => {
    const wire = mats.railing;
    for (const x of [c.minX, c.maxX]) set.of(wire).quad([x, y0, c.maxZ], [x, y0, c.minZ], [x, y0 + 1.6, c.minZ], [x, y0 + 1.6, c.maxZ], 1.4, 1);
    set.of(wire).quad([c.minX, y0, c.minZ], [c.maxX, y0, c.minZ], [c.maxX, y0 + 1.6, c.minZ], [c.minX, y0 + 1.6, c.minZ], 1.4, 1);
    for (const x of [c.minX, c.maxX]) for (const z of [c.minZ, c.maxZ]) set.box(steel, x - 0.025, x + 0.025, y0, y0 + 1.65, z - 0.025, z + 0.025);
    set.box(mats.paint('#6b6f73', 0.3), c.minX, c.maxX, y0 + 0.08, y0 + 0.14, c.minZ, c.maxZ);
    set.box(mats.paint(i ? '#d2ab73' : '#c69a5f'), c.minX + 0.12, c.maxX - 0.5, y0 + 0.14, y0 + 0.62, c.minZ + 0.12, c.maxZ - 0.3);
    set.box(mats.paint('#b9a57c', 0.02), c.maxX - 0.48, c.maxX - 0.1, y0 + 0.14, y0 + 0.8, c.minZ + 0.15, c.maxZ - 0.15);
    const m = mats.sign(`galpao-regiao-${i}`, i ? '#2b5aa8' : '#c9302c', '#ffffff', [{ text: DEPOT_REGIONS[i]!, size: 0.6, color: '#ffffff', weight: '800' }], 4, 64);
    set.of(m).quad([c.minX, y0 + 1.7, c.maxZ + 0.03], [c.maxX, y0 + 1.7, c.maxZ + 0.03], [c.maxX, y0 + 2.05, c.maxZ + 0.03], [c.minX, y0 + 2.05, c.maxZ + 0.03], 1, 1);
    set.box(dark, c.minX - 0.02, c.maxX + 0.02, y0 + 1.68, y0 + 2.07, c.maxZ, c.maxZ + 0.025);
    // Floor bay outline.
    for (const [x0, x1, z0, z1] of [[c.minX - 0.3, c.maxX + 0.3, c.maxZ + 0.25, c.maxZ + 0.33], [c.minX - 0.3, c.minX - 0.22, c.minZ - 0.3, c.maxZ + 0.33], [c.maxX + 0.22, c.maxX + 0.3, c.minZ - 0.3, c.maxZ + 0.33]] as const) {
      flat.box(mats.lineYellow, x0, x1, y0 + 0.012, y0 + 0.02, z0, z1, { sides: false });
    }
  });

  // High-bay lamps: housing, reflector and a lit lens (the light itself is the scene's).
  for (let x = b.minX + 5.5; x < b.maxX - 3; x += 7.3) {
    for (const z of [-122.5, -129.5, -136.5]) {
      set.box(dark, x - 0.012, x + 0.012, y0 + H - 1.5, y0 + H - 0.4, z - 0.012, z + 0.012);
      set.absorb(steel, rodPart(scene, [x, y0 + H - 1.5, z], [x, y0 + H - 1.82, z], 0.22, 0.62, 10));
      set.absorb(mats.glow('#fff4d6'), rodPart(scene, [x, y0 + H - 1.83, z], [x, y0 + H - 1.85, z], 0.54, 0.54, 10));
    }
  }
  // Green pedestrian lane from the staff door to the desks, hazard chevrons inside every dock.
  flat.box(mats.paint('#3f9a5f', 0.1), b.minX + 0.5, b.minX + 3.2, y0 + 0.012, y0 + 0.018, -122.9, -121.5, { sides: false });
  flat.box(mats.paint('#3f9a5f', 0.1), 95.2, 96.4, y0 + 0.012, y0 + 0.018, -132, -121.5, { sides: false });
  for (const d of DEPOT.docks) {
    for (let k = 0; k < 6; k++) flat.box(k % 2 ? mats.lineYellow : mats.paint('#1d1d1d', 0.1), d - 1.5 + k * 0.5, d - 1.0 + k * 0.5, y0 + 0.012, y0 + 0.02, b.maxZ - 0.95, b.maxZ - 0.35, { sides: false });
    // Outside: dock number and rubber bumpers.
    const n = mats.sign(`doca-${d}`, '#1d4f9c', '#ffffff', [{ text: `DOCA ${DEPOT.docks.indexOf(d) + 1}`, size: 0.6, color: '#ffffff', weight: '800' }], 3, 64);
    set.of(n).quad([d + 0.9, y0 + 4.25, b.maxZ + 0.07], [d - 0.9, y0 + 4.25, b.maxZ + 0.07], [d - 0.9, y0 + 4.85, b.maxZ + 0.07], [d + 0.9, y0 + 4.85, b.maxZ + 0.07], 1, 1);
    for (const dx of [-1.75, 1.75]) set.box(mats.paint('#1d1d1d', 0.05), d + dx - 0.12, d + dx + 0.12, y0 + 0.5, y0 + 1.1, b.maxZ, b.maxZ + 0.14);
  }
  // Safety gear on the west wall: extinguishers, notice board and a wall clock.
  for (const z of [-126.5, -135]) {
    set.box(mats.paint('#c9302c', 0.35), b.minX + 0.3, b.minX + 0.46, y0 + 0.7, y0 + 1.25, z - 0.09, z + 0.09);
    set.box(mats.paint('#f4f1ea', 0.2), b.minX + 0.3, b.minX + 0.32, y0 + 1.4, y0 + 1.7, z - 0.15, z + 0.15);
  }
  set.box(mats.paint('#7a5a3a', 0.1), b.minX + 0.3, b.minX + 0.34, y0 + 1.3, y0 + 2.3, -128.4, -126.9);
  for (let i = 0; i < 6; i++) set.box(mats.paint(['#f4f1ea', '#f2c230', '#9cc3d5'][i % 3]!, 0.1), b.minX + 0.34, b.minX + 0.35, y0 + 1.4 + Math.floor(i / 3) * 0.45, y0 + 1.75 + Math.floor(i / 3) * 0.45, -128.3 + (i % 3) * 0.48, -127.95 + (i % 3) * 0.48);
}
