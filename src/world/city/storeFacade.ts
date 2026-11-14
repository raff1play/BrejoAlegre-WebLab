import type { Scene } from '@babylonjs/core/scene';
import type { BatchSet } from '../geometry';
import type { LabMaterial, Materials } from '../materials';
import { ballPart, boxPart, rodPart } from '../modelParts';
import { STORE_SETBACK, storePlan, type Store } from './cityPlan';

/**
 * GFX-001B shop fronts. Each of the eight (fictional) shops gets its own architecture above the
 * shop window — parapet, fascia, awning or marquee, sign type — and its typical item on the
 * forecourt (solid: cityPlan.storePlan().forecourt). Everything is procedural, batched into the
 * shop's own meshes: no external asset, no extra material beyond one sign texture per shop.
 *
 * Coordinates are the shop's lot frame: x along the frontage, z into the lot, front wall at z = L.
 */
type Ctx = { scene: Scene; set: BatchSet; mats: Materials; s: Store; W: number; H: number; L: number };

/** Flat sign board on the facade (faces the street). */
function board(c: Ctx, name: string, x0: number, x1: number, y0: number, y1: number, z: number, bg: string, ink: string, lines: { text: string; size: number; weight?: string }[]): void {
  const m = c.mats.sign(name, bg, ink, lines.map((l) => ({ ...l, color: ink })), (x1 - x0) / (y1 - y0), 128);
  c.set.of(m).quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], 1, 1);
}

/** Fabric awning sloping down towards the street. */
function fabricAwning(c: Ctx, a: string, b: string, reach: number, drop = 0.42): void {
  const { set, mats, s, W, L } = c;
  const m = mats.stripes(`toldo-${s.id}`, a, b, 8, false, 3.2);
  set.of(m).quad([0.3, 3.38 - drop, L - reach], [W - 0.3, 3.38 - drop, L - reach], [W - 0.3, 3.38, L - 0.28], [0.3, 3.38, L - 0.28], (W - 0.6) / 3.2, 1);
  // Scalloped valance and the two side brackets.
  set.of(m).quad([0.3, 3.38 - drop - 0.22, L - reach], [W - 0.3, 3.38 - drop - 0.22, L - reach], [W - 0.3, 3.38 - drop, L - reach], [0.3, 3.38 - drop, L - reach], (W - 0.6) / 3.2, 0.25);
  const iron = mats.paint('#3a3d40', 0.3);
  for (const x of [0.32, W - 0.32]) set.absorb(iron, rodPart(c.scene, [x, 2.75, L - 0.02], [x, 3.38 - drop, L - reach + 0.03], 0.035));
}

/** Rigid metal marquee (flat canopy with a fascia edge and tie rods). */
function marquee(c: Ctx, color: string, reach: number, y = 3.05): void {
  const { set, mats, W, L } = c;
  set.box(mats.paint(color, 0.25), 0.2, W - 0.2, y, y + 0.14, L - reach, L - 0.02);
  set.box(mats.paint('#e9e7e0', 0.2), 0.2, W - 0.2, y - 0.03, y, L - reach + 0.05, L - 0.05, { sides: false, top: false, bottom: true });
  const steel = mats.paint('#8c9196', 0.4);
  for (const x of [0.6, W - 0.6]) set.absorb(steel, rodPart(c.scene, [x, y + 0.14, L - reach + 0.15], [x, y + 1.0, L - 0.03], 0.03));
}

/** A-frame pavement sign. */
function aFrame(c: Ctx, x: number, z: number, bg: string, ink: string, lines: string[]): void {
  const { set, mats, s } = c;
  const m = mats.sign(`cavalete-${s.id}`, bg, ink, lines.map((t, i) => ({ text: t, size: i === 0 ? 0.3 : 0.2, color: ink, weight: '800' })), 0.62, 128);
  const wood = mats.paint('#6b4a2c', 0.05);
  set.box(wood, x - 0.3, x + 0.3, 0, 0.95, z - 0.03, z + 0.03);
  set.of(m).quad([x - 0.27, 0.12, z - 0.035], [x + 0.27, 0.12, z - 0.035], [x + 0.27, 0.92, z - 0.035], [x - 0.27, 0.92, z - 0.035], 1, 1);
  set.box(wood, x - 0.3, x + 0.3, 0, 0.9, z + 0.22, z + 0.26);
}

/** Wooden crate of produce on a low stand. */
function crate(c: Ctx, x0: number, x1: number, z0: number, z1: number, y: number, colors: string[], seed: number): void {
  const { set, mats } = c;
  set.box(mats.paint('#a57a45', 0.05), x0, x1, y, y + 0.22, z0, z1);
  set.box(mats.paint(colors[seed % colors.length]!, 0.15), x0 + 0.03, x1 - 0.03, y + 0.22, y + 0.27, z0 + 0.03, z1 - 0.03);
  for (let k = 0; k < 4; k++) {
    const px = x0 + 0.1 + ((seed * 7 + k * 13) % 10) / 10 * (x1 - x0 - 0.2); const pz = z0 + 0.08 + ((seed * 3 + k * 5) % 10) / 10 * (z1 - z0 - 0.16);
    set.absorb(mats.paint(colors[(seed + k) % colors.length]!, 0.2), ballPart(c.scene, [0.13, 0.11, 0.13], [px, y + 0.31, pz], 5));
  }
}

function stack(c: Ctx, x0: number, x1: number, z0: number, z1: number, layers: number, mat: (k: number) => LabMaterial, h = 0.15): void {
  c.set.box(c.mats.paint('#8a6a42', 0.05), x0, x1, 0, 0.12, z0, z1);
  for (let k = 0; k < layers; k++) { const i = k % 2 ? 0.07 : 0.03; c.set.box(mat(k), x0 + i, x1 - i, 0.12 + k * (h + 0.01), 0.12 + k * (h + 0.01) + h, z0 + i, z1 - i); }
}

export function buildStoreFront(scene: Scene, set: BatchSet, mats: Materials, s: Store): void {
  const W = s.width; const H = s.height; const L = STORE_SETBACK;
  const c: Ctx = { scene, set, mats, s, W, H, L };
  const f = storePlan(s).forecourt; const fx = (f.x0 + f.x1) / 2;
  const trim = mats.paint('#f1ede2', 0.05);
  const zf = L - 0.045; // just in front of the facade plane
  const title = s.name.toUpperCase();
  switch (s.id) {
    case 'mercearia': {
      // Old corner grocery: stepped parapet with cornices, hand-painted board, striped awning.
      set.box(mats.plaster(s.wall), W * 0.2, W * 0.8, H, H + 0.7, L, L + 0.25, { fitV: true });
      set.box(trim, W * 0.2 - 0.08, W * 0.8 + 0.08, H + 0.7, H + 0.82, L - 0.08, L + 0.3);
      set.box(trim, -0.06, W + 0.06, H - 0.02, H + 0.1, L - 0.1, L + 0.3);
      set.box(mats.paint(s.band, 0.1), 0, W, 3.32, 3.44, L - 0.03, L);
      board(c, `placa-${s.id}`, 0.9, W - 0.9, 3.55, H - 0.12, zf, '#f4c531', '#a3211c', [{ text: title, size: 0.46 }, { text: s.subtitle, size: 0.2, weight: '700' }]);
      fabricAwning(c, s.band, '#f4f1e8', 1.5);
      // Forecourt: gas cylinders in a cage and a wooden bench.
      const cage = mats.paint('#4a4f55', 0.3);
      for (let i = 0; i < 3; i++) {
        const x = f.x0 + 0.25 + i * 0.42;
        set.absorb(mats.paint(i === 1 ? '#3d6fb0' : '#c7c9cc', 0.25), rodPart(scene, [x, 0.02, f.z0 + 0.3], [x, 0.62, f.z0 + 0.3], 0.3, 0.3, 10));
        set.absorb(mats.paint('#2b2d31', 0.3), rodPart(scene, [x, 0.62, f.z0 + 0.3], [x, 0.74, f.z0 + 0.3], 0.12, 0.1, 8));
      }
      set.box(cage, f.x0, f.x0 + 1.3, 0.95, 0.98, f.z0 + 0.05, f.z1 - 0.1);
      for (const x of [f.x0, f.x0 + 1.3]) for (const z of [f.z0 + 0.05, f.z1 - 0.1]) set.box(cage, x - 0.015, x + 0.015, 0, 0.98, z - 0.015, z + 0.015);
      set.box(mats.paint('#7a5a3a', 0.08), f.x0 + 1.4, f.x1, 0.4, 0.45, f.z0 + 0.15, f.z1 - 0.15);
      for (const x of [f.x0 + 1.45, f.x1 - 0.05]) set.box(mats.paint('#5d4630', 0.05), x - 0.03, x + 0.03, 0, 0.4, f.z0 + 0.18, f.z1 - 0.18);
      break;
    }
    case 'farmacia': {
      // Clean white panel fascia with a green band, rigid marquee and a lit cross on a bracket.
      set.box(mats.paint('#f7f9f8', 0.25), -0.04, W + 0.04, 3.32, H + 0.14, L - 0.1, L);
      for (let x = 1.4; x < W; x += 1.4) set.box(mats.paint('#d9dfdc', 0.2), x - 0.006, x + 0.006, 3.32, H + 0.14, L - 0.104, L - 0.1);
      set.box(mats.paint(s.band, 0.2), -0.04, W + 0.04, 3.32, 3.56, L - 0.11, L - 0.1);
      board(c, `placa-${s.id}`, 0.8, W - 2.0, 3.62, H - 0.06, L - 0.115, '#f7f9f8', '#1f8a5b', [{ text: title, size: 0.5 }, { text: s.subtitle, size: 0.2, weight: '700' }]);
      marquee(c, '#f1f3f2', 1.3);
      const glow = mats.glow('#3ddc84');
      const cx = W - 1.2; const cy = (3.62 + H) / 2;
      set.box(mats.paint('#0f5c3a', 0.2), cx - 0.52, cx + 0.52, cy - 0.52, cy + 0.52, L - 0.16, L - 0.1);
      set.box(glow, cx - 0.14, cx + 0.14, cy - 0.42, cy + 0.42, L - 0.18, L - 0.16);
      set.box(glow, cx - 0.42, cx + 0.42, cy - 0.14, cy + 0.14, L - 0.18, L - 0.16);
      // Forecourt: a coin-operated weighing scale and a hand-sanitiser totem.
      set.box(mats.paint('#e9ecef', 0.3), fx - 0.55, fx - 0.05, 0, 0.12, f.z0 + 0.05, f.z1 - 0.1);
      set.box(mats.paint('#cfd4d8', 0.3), fx - 0.36, fx - 0.24, 0.12, 1.25, f.z1 - 0.26, f.z1 - 0.14);
      set.absorb(mats.paint('#1f8a5b', 0.3), boxPart(scene, [0.36, 0.3, 0.1], [fx - 0.3, 1.38, f.z1 - 0.2]));
      set.box(mats.paint('#f7f9f8', 0.3), fx + 0.45, fx + 0.75, 0, 1.05, f.z0 + 0.2, f.z0 + 0.5);
      set.box(mats.paint('#1f8a5b', 0.3), fx + 0.45, fx + 0.75, 1.05, 1.3, f.z0 + 0.2, f.z0 + 0.5);
      break;
    }
    case 'papelaria': {
      // Blue fascia with coloured "pencil" fins, round logo disc, bright marquee.
      set.box(mats.paint(s.band, 0.15), -0.04, W + 0.04, 3.32, H + 0.14, L - 0.08, L);
      const pencils = ['#e23d3d', '#f2c230', '#34a26b', '#f08a3c', '#8a4fb0', '#f4f1ea'];
      for (let i = 0; i < 6; i++) {
        const x = W - 2.6 + i * 0.36;
        set.box(mats.paint(pencils[i]!, 0.2), x, x + 0.24, 3.4, H - 0.1 + (i % 2) * 0.22, L - 0.14, L - 0.08);
        set.box(mats.paint('#e8caa0', 0.1), x + 0.04, x + 0.2, H - 0.1 + (i % 2) * 0.22, H + 0.1 + (i % 2) * 0.22, L - 0.14, L - 0.08);
      }
      board(c, `placa-${s.id}`, 0.6, W - 3.0, 3.5, H - 0.05, L - 0.085, '#2b5aa8', '#ffffff', [{ text: title, size: 0.5 }, { text: s.subtitle, size: 0.2, weight: '700' }]);
      marquee(c, '#f2c230', 1.2);
      aFrame(c, fx, f.z0 + 0.3, '#ffffff', '#2b5aa8', ['XEROX', 'IMPRESSÃO', 'ENCADERNAÇÃO']);
      break;
    }
    case 'supermercado': {
      // Big-box front: red portico framing the entrance, wide sign, offers banner, trolley bay.
      const red = mats.paint(s.band, 0.2);
      set.box(red, -0.06, W + 0.06, 3.3, H + 0.3, L - 0.14, L);
      for (const x of [0, W - 0.45]) set.box(red, x, x + 0.45, 0, 3.3, L - 0.14, L);
      set.box(mats.paint('#f4efe4', 0.2), 0.45, W - 0.45, 3.3, 3.42, L - 0.16, L - 0.14);
      board(c, `placa-${s.id}`, 1.0, W - 1.0, 3.75, H + 0.18, L - 0.145, '#c9302c', '#ffffff', [{ text: title, size: 0.5 }, { text: s.subtitle, size: 0.19, weight: '700' }]);
      board(c, `faixa-${s.id}`, 1.0, W - 1.0, 3.44, 3.72, L - 0.146, '#f2c230', '#7a1512', [{ text: 'OFERTAS DA SEMANA  ·  HORTIFRUTI  ·  AÇOUGUE', size: 0.6, weight: '800' }]);
      marquee(c, '#b3211d', 1.6, 3.02);
      // Forecourt: nested shopping trolleys in a rail bay.
      const rail = mats.paint('#9aa0a6', 0.5);
      set.box(rail, f.x0, f.x1, 0.9, 0.94, f.z0 + 0.02, f.z0 + 0.06);
      for (const x of [f.x0, f.x1]) set.box(rail, x - 0.02, x + 0.02, 0, 0.94, f.z0 + 0.02, f.z0 + 0.06);
      for (let i = 0; i < 3; i++) {
        const x = f.x0 + 0.15 + i * 0.5;
        set.box(mats.paint('#b9bec3', 0.5), x, x + 0.42, 0.45, 0.82, f.z0 + 0.15, f.z1 - 0.02);
        set.box(mats.paint('#c9302c', 0.3), x, x + 0.42, 0.82, 0.88, f.z1 - 0.08, f.z1 - 0.02);
        set.box(mats.paint('#2b2d31', 0.2), x + 0.04, x + 0.38, 0.06, 0.12, f.z0 + 0.2, f.z1 - 0.06);
      }
      break;
    }
    case 'padaria': {
      // Warm bakery: wooden slat fascia, deep orange awning, hanging round sign, menu board, table.
      const wood = mats.paint('#7a4a26', 0.08);
      set.box(mats.paint('#5d3519', 0.05), -0.04, W + 0.04, 3.32, H + 0.14, L - 0.06, L);
      for (let y = 3.42; y < H + 0.05; y += 0.2) set.box(wood, -0.04, W + 0.04, y, y + 0.13, L - 0.1, L - 0.06);
      board(c, `placa-${s.id}`, 1.6, W - 1.6, 3.5, H - 0.02, L - 0.105, '#3d2414', '#f6d27a', [{ text: title, size: 0.5 }, { text: s.subtitle, size: 0.2, weight: '700' }]);
      fabricAwning(c, '#d9702a', '#f6efe2', 1.9, 0.5);
      const iron = mats.paint('#2b2d31', 0.3);
      set.absorb(iron, rodPart(scene, [0.25, 3.15, L - 0.05], [0.25, 3.15, L - 0.95], 0.04));
      set.absorb(mats.paint('#f6d27a', 0.2), rodPart(scene, [0.2, 2.72, L - 0.8], [0.3, 2.72, L - 0.8], 0.62, 0.62, 16));
      set.absorb(mats.paint('#7a3e1d', 0.1), rodPart(scene, [0.18, 2.72, L - 0.8], [0.32, 2.72, L - 0.8], 0.44, 0.44, 16));
      aFrame(c, f.x0 + 0.35, f.z0 + 0.3, '#2b2d31', '#f6efe2', ['PÃO QUENTE', 'a toda hora', 'CAFÉ · LANCHES']);
      // Small round table with two stools.
      const tx = f.x1 - 0.5; const tz = (f.z0 + f.z1) / 2;
      set.absorb(mats.paint('#e9e4d8', 0.2), rodPart(scene, [tx, 0.7, tz], [tx, 0.74, tz], 0.62, 0.62, 14));
      set.absorb(iron, rodPart(scene, [tx, 0, tz], [tx, 0.7, tz], 0.06));
      for (const dx of [-0.45, 0.45]) set.absorb(mats.paint('#d9702a', 0.15), rodPart(scene, [tx + dx * 0.9, 0, tz + 0.05], [tx + dx * 0.9, 0.45, tz + 0.05], 0.28, 0.3, 10));
      break;
    }
    case 'variedades': {
      // Bazaar: purple fascia with a rainbow stripe, goods hanging under the marquee, stacked chairs.
      set.box(mats.paint(s.band, 0.15), -0.04, W + 0.04, 3.32, H + 0.14, L - 0.07, L);
      const rainbow = ['#e23d3d', '#f08a3c', '#f2c230', '#34a26b', '#2bb3a3', '#3d6fd0'];
      rainbow.forEach((col, i) => set.box(mats.paint(col, 0.2), -0.04, W + 0.04, 3.34 + i * 0.045, 3.385 + i * 0.045, L - 0.08, L - 0.07));
      board(c, `placa-${s.id}`, 0.7, W - 0.7, 3.68, H + 0.02, L - 0.075, '#7a3f8f', '#ffffff', [{ text: title, size: 0.5 }, { text: s.subtitle, size: 0.2, weight: '700' }]);
      marquee(c, '#5b2e6b', 1.4);
      // Buckets and basins hanging from the marquee edge.
      for (let i = 0; i < 7; i++) {
        const x = 0.9 + i * ((W - 1.8) / 6); const col = rainbow[i % rainbow.length]!;
        set.absorb(mats.paint('#3a3d40', 0.3), rodPart(scene, [x, 3.05, L - 1.25], [x, 2.72, L - 1.25], 0.012));
        set.absorb(mats.paint(col, 0.25), rodPart(scene, [x, 2.44, L - 1.25], [x, 2.72, L - 1.25], 0.2, 0.3, 10));
      }
      // Forecourt: stacks of plastic chairs and a bin of balls.
      for (let k = 0; k < 5; k++) {
        const y = 0.42 + k * 0.07;
        set.box(mats.paint(k % 2 ? '#f4f1ea' : '#3d6fd0', 0.25), f.x0 + 0.05, f.x0 + 0.5, y, y + 0.04, f.z0 + 0.1, f.z0 + 0.55);
        set.box(mats.paint(k % 2 ? '#f4f1ea' : '#3d6fd0', 0.25), f.x0 + 0.05, f.x0 + 0.5, y, y + 0.42, f.z0 + 0.52, f.z0 + 0.56);
      }
      for (const x of [f.x0 + 0.07, f.x0 + 0.48]) for (const z of [f.z0 + 0.12, f.z0 + 0.53]) set.box(mats.paint('#3d6fd0', 0.25), x - 0.02, x + 0.02, 0, 0.42, z - 0.02, z + 0.02);
      set.box(mats.paint('#9aa0a6', 0.4), f.x0 + 0.8, f.x1, 0, 0.6, f.z0 + 0.05, f.z1 - 0.1);
      for (let i = 0; i < 6; i++) set.absorb(mats.paint(rainbow[i]!, 0.3), ballPart(scene, [0.24, 0.24, 0.24], [f.x0 + 0.95 + (i % 3) * 0.3, 0.66, f.z0 + 0.22 + Math.floor(i / 3) * 0.26], 6));
      break;
    }
    case 'construcao': {
      // Builders' yard front: corrugated orange fascia, steel canopy, cement pallet and wheelbarrow.
      set.box(mats.ribbed(s.band), -0.04, W + 0.04, 3.32, H + 0.14, L - 0.08, L);
      board(c, `placa-${s.id}`, 0.8, W - 0.8, 3.6, H - 0.05, L - 0.085, '#f4f1e8', '#1d1d1d', [{ text: title, size: 0.5 }, { text: s.subtitle.toUpperCase(), size: 0.2, weight: '800' }]);
      for (let x = 0.2; x < W; x += 0.5) set.box(mats.paint(Math.round(x * 2) % 2 ? '#f2c230' : '#1d1d1d', 0.2), x, Math.min(W - 0.2, x + 0.5), 3.34, 3.5, L - 0.09, L - 0.08);
      marquee(c, '#6b6f73', 1.7, 3.0);
      stack(c, f.x0, f.x0 + 1.0, f.z0, f.z1, 5, (k) => mats.paint(k % 2 ? '#a9a59b' : '#b9b5aa', 0.05));
      // Wheelbarrow: tray, wheel and handles.
      const wx = f.x1 - 0.4; const wz = (f.z0 + f.z1) / 2;
      set.box(mats.paint('#2f7d4f', 0.3), wx - 0.3, wx + 0.3, 0.32, 0.52, wz - 0.28, wz + 0.25);
      set.absorb(mats.paint('#1d1d1d', 0.1), rodPart(scene, [wx - 0.04, 0.17, wz - 0.36], [wx + 0.04, 0.17, wz - 0.36], 0.34, 0.34, 12));
      for (const dx of [-0.24, 0.24]) set.absorb(mats.paint('#3a3d40', 0.3), rodPart(scene, [wx + dx, 0.36, wz - 0.3], [wx + dx, 0.5, wz + 0.62], 0.03));
      break;
    }
    default: {
      // Hortifruti: green timber pergola front, slatted wooden awning and crates of produce outside.
      const green = mats.paint(s.band, 0.1);
      set.box(mats.paint('#3d6b25', 0.08), -0.04, W + 0.04, 3.32, H + 0.14, L - 0.06, L);
      board(c, `placa-${s.id}`, 1.0, W - 1.0, 3.55, H - 0.02, L - 0.065, '#fff7d6', '#3d6b25', [{ text: title, size: 0.5 }, { text: s.subtitle, size: 0.2, weight: '700' }]);
      for (const x of [0.25, W - 0.25]) set.box(green, x - 0.07, x + 0.07, 0, 3.0, L - 1.75, L - 1.61);
      set.box(green, 0.1, W - 0.1, 2.95, 3.07, L - 1.78, L - 1.62);
      for (let x = 0.35; x < W - 0.2; x += 0.42) set.box(mats.paint('#8a6a42', 0.05), x, x + 0.26, 3.07, 3.11, L - 1.85, L - 0.05);
      const produce = ['#d1362f', '#f08a1c', '#f2d13a', '#8fbf3f', '#7a2f5a', '#4f8a2f'];
      const n = Math.max(2, Math.floor((f.x1 - f.x0) / 0.6));
      for (let i = 0; i < n; i++) {
        const x0 = f.x0 + i * ((f.x1 - f.x0) / n);
        crate(c, x0 + 0.02, x0 + (f.x1 - f.x0) / n - 0.02, f.z0, f.z0 + 0.34, 0.2, produce, i * 3 + 1);
        crate(c, x0 + 0.02, x0 + (f.x1 - f.x0) / n - 0.02, f.z0 + 0.36, f.z1, 0.5, produce, i * 5 + 2);
      }
      set.box(mats.paint('#6b4a2c', 0.05), f.x0, f.x1, 0, 0.2, f.z0, f.z1);
      set.box(mats.paint('#6b4a2c', 0.05), f.x0, f.x1, 0.2, 0.5, f.z0 + 0.36, f.z1);
    }
  }
}
