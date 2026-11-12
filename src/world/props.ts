import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateIcoSphere } from '@babylonjs/core/Meshes/Builders/icoSphereBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import '@babylonjs/core/Meshes/instancedMesh';
import { BatchSet, type P3 } from './geometry';
import { buildCards } from './foliage';
import type { Materials } from './materials';
import {
  BENCHES, CROSS_NORTH, CROSS_SOUTH, CURB_H, HOUSES, HOUSE_WALL_H, POLES, ROAD_HALF, TREES,
  WORLD_BOUNDS, frameRect, houseSpan, showcasePlants, showcaseStreetItems, type PlantKind, type PoleSpec, type TreeSpec,
} from './layout';

function seeded(seed: number): () => number {
  let a = seed;
  return () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
}

/** One lumpy canopy + trunk per species; every tree in the scene is a GPU instance of it. */
function treePrototype(scene: Scene, mats: Materials, kind: TreeSpec['kind']): Mesh[] {
  const set = new BatchSet();
  const bark = mats.paint(kind === 'oiti' ? '#4f3e2e' : '#5e5042');
  const trunkHeight = kind === 'oiti' ? 2.3 : 2.9;
  const trunk = CreateCylinder('tronco', { diameterTop: 0.2, diameterBottom: 0.38, height: trunkHeight, tessellation: 8 }, scene);
  trunk.position.y = trunkHeight / 2;
  set.absorb(bark, trunk);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const limb = CreateCylinder('galho', { diameterTop: 0.07, diameterBottom: 0.15, height: 1.6, tessellation: 6 }, scene);
    limb.position.set(Math.cos(a) * 0.38, trunkHeight + 0.45, Math.sin(a) * 0.38);
    limb.rotation.set(Math.sin(a) * 0.65, 0, -Math.cos(a) * 0.65);
    set.absorb(bark, limb);
  }
  // CORE-010: a dark low-poly core keeps the crown opaque; leaf cards give the soft silhouette.
  const centreY = trunkHeight + (kind === 'oiti' ? 1.4 : 1.6);
  const [rx, ry] = kind === 'oiti' ? [2.2, 1.55] : [2.0, 1.45];
  const core = CreateIcoSphere('miolo', { radius: 1, subdivisions: 2 }, scene);
  core.scaling.set(rx * 0.78, ry * 0.72, rx * 0.78);
  core.position.y = centreY;
  const coreColour = kind === 'oiti' ? '#2f5124' : kind === 'ipe' ? '#8f7420' : '#6e4d7c';
  set.absorb(mats.paint(coreColour), core);
  const meshes = set.build(`arvore-${kind}`, scene);
  meshes.push(buildCards(scene, `arvore-${kind}-folhas`, mats.leafCards(kind), [
    { centre: [0, centreY, 0], radii: [rx, ry, rx], count: kind === 'oiti' ? 46 : 40, cardSize: kind === 'oiti' ? 1.7 : 1.55, seed: kind.length * 97 },
  ]));
  for (const mesh of meshes) mesh.isVisible = false;
  return meshes;
}

/**
 * W009 showcase plants: rounded shrubs, a slender palm and potted plants. Each kind is ONE prototype
 * mesh rendered as GPU instances, so all shrubs together cost a single draw call (plus shadow).
 */
function plantPrototype(scene: Scene, mats: Materials, kind: PlantKind): Mesh[] {
  const set = new BatchSet();
  if (kind === 'arbusto') {
    const core = CreateIcoSphere('arbusto', { radius: 1, subdivisions: 1 }, scene);
    core.scaling.set(0.42, 0.34, 0.42);
    core.position.y = 0.38;
    set.absorb(mats.paint('#2c4d22'), core);
    } else if (kind === 'palmeira') {
    const trunk = mats.paint('#8a7a66');
    for (let i = 0; i < 6; i++) {
      const seg = CreateCylinder('estipe', { diameterTop: 0.2 - i * 0.012, diameterBottom: 0.24 - i * 0.012, height: 0.75, tessellation: 7 }, scene);
      seg.position.set(Math.sin(i * 0.35) * 0.05 * i, 0.375 + i * 0.72, 0);
      set.absorb(trunk, seg);
    }
    const frond = mats.paint('#4f7a32');
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      for (let k = 0; k < 3; k++) {
        const leaf = CreateBox('fronde', { width: 0.32 - k * 0.07, height: 0.02, depth: 0.6 }, scene);
        const reach = 0.3 + k * 0.52;
        leaf.position.set(0.25 + Math.cos(a) * reach, 4.45 - k * k * 0.16, Math.sin(a) * reach);
        leaf.rotation.set(0.25 + k * 0.35, Math.PI / 2 - a, 0);
        set.absorb(frond, leaf);
      }
    }
  } else if (kind === 'buganvilia') {
    // Woody stems on the wall top; the flowering mass is made of draped leaf cards (below).
    const core = CreateIcoSphere('buganvilia', { radius: 1, subdivisions: 1 }, scene);
    core.scaling.set(1.1, 0.22, 0.28);
    core.position.set(0, 0.15, 0.02);
    set.absorb(mats.paint('#2f5424'), core);
  } else {
    set.absorb(mats.paint('#a8552f'), CreateCylinder('vaso', { diameterTop: 0.42, diameterBottom: 0.3, height: 0.42, tessellation: 10 }, scene));
    const leaves = mats.paint('#4d7a35');
    const blob = CreateIcoSphere('planta', { radius: 0.3, subdivisions: 1 }, scene);
    blob.position.y = 0.62;
    blob.scaling.set(1, 1.3, 1);
    set.absorb(leaves, blob);
  }
  const meshes = set.build(`planta-${kind}`, scene);
  if (kind === 'arbusto') {
    meshes.push(buildCards(scene, 'planta-arbusto-folhas', mats.leafCards('arbusto'), [
      { centre: [0, 0.45, 0], radii: [0.5, 0.4, 0.5], count: 14, cardSize: 0.7, seed: 11 },
    ]));
  } else if (kind === 'buganvilia') {
    meshes.push(buildCards(scene, 'planta-buganvilia-folhas', mats.leafCards('buganvilia'), [
      { centre: [0, 0.2, -0.05], radii: [1.25, 0.38, 0.42], count: 30, cardSize: 0.8, seed: 23, drape: 1.1 },
    ]));
  }
  for (const mesh of meshes) mesh.isVisible = false;
  return meshes;
}

export function buildShowcasePlants(scene: Scene, mats: Materials): AbstractMesh[] {
  const prototypes = new Map<PlantKind, Mesh[]>();
  const casters: AbstractMesh[] = [];
  for (const plant of showcasePlants()) {
    let proto = prototypes.get(plant.kind);
    if (!proto) { proto = plantPrototype(scene, mats, plant.kind); prototypes.set(plant.kind, proto); }
    for (const source of proto) {
      const instance = source.createInstance(`${source.name}@${plant.x.toFixed(1)},${plant.z.toFixed(1)}`);
      // Pots stand on the porch floor, bougainvillea on the wall top, everything else on the bed.
      instance.position.set(plant.x, CURB_H + plant.base + (plant.kind === 'vaso' ? 0.21 : 0), plant.z);
      instance.scaling.setAll(plant.scale);
      instance.rotation.y = plant.turn;
      instance.isPickable = false;
      instance.freezeWorldMatrix();
      casters.push(instance);
    }
  }
  return casters;
}

/** Concrete planter full of red and pink flowers: one instanced prototype (CORE-010). */
function planterPrototype(scene: Scene, mats: Materials): Mesh[] {
  const set = new BatchSet();
  const random = seeded(57);
  set.box(mats.paint('#c4bba9'), -0.25, 0.25, 0, 0.42, -0.7, 0.7);
  set.box(mats.paint('#d8d0bf'), -0.28, 0.28, 0.42, 0.47, -0.73, 0.73);
  set.box(mats.paint('#5a4130'), -0.2, 0.2, 0.47, 0.49, -0.65, 0.65, { sides: false });
  const colours = ['#d8342c', '#e85a7a', '#f1c34a', '#d8342c'];
  for (let i = 0; i < 9; i++) {
    const leaf = CreateIcoSphere('folhas', { radius: 0.2 + random() * 0.05, subdivisions: 1 }, scene);
    leaf.position.set((random() - 0.5) * 0.2, 0.6, -0.56 + i * 0.14);
    leaf.scaling.y = 0.7;
    set.absorb(mats.paint('#3f7232'), leaf);
    const bloom = CreateIcoSphere('flores', { radius: 0.11 + random() * 0.04, subdivisions: 1 }, scene);
    bloom.position.set((random() - 0.5) * 0.25, 0.72 + random() * 0.06, -0.56 + i * 0.14 + (random() - 0.5) * 0.08);
    set.absorb(mats.paint(colours[i % colours.length]!), bloom);
  }
  const meshes = set.build('floreira', scene);
  for (const mesh of meshes) mesh.isVisible = false;
  return meshes;
}

/**
 * Showcase pavement furniture: planters are instanced; colonial lamp posts and litter bins are few,
 * so they are merged into the shared static batch.
 */
export function buildStreetFurniture(scene: Scene, set: BatchSet, mats: Materials): AbstractMesh[] {
  const casters: AbstractMesh[] = [];
  let planter: Mesh[] | null = null;
  const iron = mats.paint('#1d2621', 0.25);
  for (const item of showcaseStreetItems()) {
    const y = CURB_H;
    if (item.kind === 'floreira') {
      planter ??= planterPrototype(scene, mats);
      for (const source of planter) {
        const instance = source.createInstance(`floreira@${item.x.toFixed(1)},${item.z.toFixed(1)}`);
        instance.position.set(item.x, y, item.z);
        instance.isPickable = false;
        instance.freezeWorldMatrix();
        casters.push(instance);
      }
    } else if (item.kind === 'poste-colonial') {
      const [x, z] = [item.x, item.z];
      const base = CreateCylinder('base', { diameterTop: 0.2, diameterBottom: 0.32, height: 0.5, tessellation: 8 }, scene);
      base.position.set(x, y + 0.25, z);
      set.absorb(iron, base);
      const pole = CreateCylinder('fuste', { diameterTop: 0.09, diameterBottom: 0.14, height: 3.1, tessellation: 8 }, scene);
      pole.position.set(x, y + 2.0, z);
      set.absorb(iron, pole);
      const ring = CreateCylinder('anel', { diameter: 0.2, height: 0.08, tessellation: 8 }, scene);
      ring.position.set(x, y + 3.55, z);
      set.absorb(iron, ring);
      // Lantern: tapered glass box with an iron cap and finial.
      const glass = CreateCylinder('lanterna', { diameterTop: 0.42, diameterBottom: 0.26, height: 0.5, tessellation: 4 }, scene);
      glass.position.set(x, y + 3.85, z);
      glass.rotation.y = Math.PI / 4;
      set.absorb(mats.glow('#ffe2a6'), glass);
      const cap = CreateCylinder('chapeu', { diameterTop: 0.06, diameterBottom: 0.56, height: 0.22, tessellation: 4 }, scene);
      cap.position.set(x, y + 4.21, z);
      cap.rotation.y = Math.PI / 4;
      set.absorb(iron, cap);
      for (const k of [-1, 1]) {
        set.box(iron, x - 0.015, x + 0.015, y + 3.6, y + 4.1, z + k * 0.13 - 0.015, z + k * 0.13 + 0.015);
      }
    } else {
      const bin = CreateCylinder('lixeira', { diameterTop: 0.42, diameterBottom: 0.36, height: 0.55, tessellation: 12 }, scene);
      bin.position.set(item.x, y + 0.75, item.z);
      set.absorb(mats.paint('#e27a22', 0.25), bin);
      const post = CreateCylinder('suporte', { diameter: 0.06, height: 0.75, tessellation: 6 }, scene);
      post.position.set(item.x + 0.22, y + 0.37, item.z);
      set.absorb(iron, post);
    }
  }
  return casters;
}

export function buildTrees(scene: Scene, mats: Materials, backdropDensity: number): AbstractMesh[] {
  const prototypes = { oiti: treePrototype(scene, mats, 'oiti'), ipe: treePrototype(scene, mats, 'ipe'), 'ipe-roxo': treePrototype(scene, mats, 'ipe-roxo') };
  const casters: AbstractMesh[] = [];
  const random = seeded(99);
  let backdropIndex = 0;
  for (const tree of TREES) {
    const turn = random() * Math.PI * 2;
    if (!tree.solid && (backdropIndex++ % 4) / 4 >= backdropDensity) continue;
    for (const prototype of prototypes[tree.kind]) {
      const instance = prototype.createInstance(`${prototype.name}@${tree.x},${tree.z}`);
      instance.position.set(tree.x, tree.solid ? CURB_H : 0, tree.z);
      instance.scaling.setAll(tree.scale);
      instance.rotation.y = turn;
      instance.isPickable = false;
      instance.freezeWorldMatrix();
      casters.push(instance);
    }
  }
  return casters;
}

function pole(scene: Scene, set: BatchSet, mats: Materials, spec: PoleSpec): void {
  const concrete = mats.paint('#a9a59c');
  const metal = mats.paint('#5d6368', 0.25);
  const shaft = CreateCylinder('poste', { diameterTop: 0.2, diameterBottom: 0.34, height: 9.2, tessellation: 10 }, scene);
  shaft.position.set(spec.x, 4.6 + CURB_H, spec.z);
  set.absorb(concrete, shaft);
  const along = spec.axis === 'z';
  // Crossarm perpendicular to the wires, with three insulators.
  const [ax, az] = along ? [0.95, 0.06] : [0.06, 0.95];
  set.box(mats.paint('#6a5a48'), spec.x - ax, spec.x + ax, 8.75, 8.87, spec.z - az, spec.z + az, { bottom: true });
  for (const k of [-0.8, 0, 0.8]) {
    const [ix, iz] = along ? [spec.x + k, spec.z] : [spec.x, spec.z + k];
    set.box(mats.paint('#d8d4c8'), ix - 0.05, ix + 0.05, 8.87, 9.05, iz - 0.05, iz + 0.05);
  }
  // Street lamp arm reaching over the roadway.
  const reach = 1.9 * spec.lamp;
  if (along) {
    set.box(metal, Math.min(spec.x, spec.x + reach), Math.max(spec.x, spec.x + reach), 7.5, 7.58, spec.z - 0.04, spec.z + 0.04, { bottom: true });
    set.box(mats.paint('#e9e6da', 0.3), spec.x + reach - 0.3, spec.x + reach + 0.3, 7.36, 7.5, spec.z - 0.14, spec.z + 0.14, { bottom: true });
  } else {
    set.box(metal, spec.x - 0.04, spec.x + 0.04, 7.5, 7.58, Math.min(spec.z, spec.z + reach), Math.max(spec.z, spec.z + reach), { bottom: true });
    set.box(mats.paint('#e9e6da', 0.3), spec.x - 0.14, spec.x + 0.14, 7.36, 7.5, spec.z + reach - 0.3, spec.z + reach + 0.3, { bottom: true });
  }
  if (spec.transformer) {
    const tank = CreateCylinder('transformador', { diameter: 0.55, height: 0.9, tessellation: 12 }, scene);
    tank.position.set(spec.x + (along ? 0 : 0.45), 6.9, spec.z + (along ? 0.45 : 0));
    set.absorb(mats.paint('#7b8085', 0.3), tank);
  }
}

function sagging(from: Vector3, to: Vector3, sag: number): Vector3[] {
  const points: Vector3[] = [];
  const segments = 8;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = Vector3.Lerp(from, to, t);
    p.y -= sag * 4 * t * (1 - t);
    points.push(p);
  }
  return points;
}

/** Poles, street lamps and the tangle of overhead wires that defines a Brazilian street. */
export function buildPoles(scene: Scene, set: BatchSet, mats: Materials): void {
  for (const spec of POLES) pole(scene, set, mats, spec);
  const lines: Vector3[][] = [];
  const mainLine = POLES.filter((p) => p.axis === 'z');
  for (let i = 0; i < mainLine.length - 1; i++) {
    const [a, b] = [mainLine[i]!, mainLine[i + 1]!];
    for (const k of [-0.8, 0, 0.8]) lines.push(sagging(new Vector3(a.x + k, 9.05, a.z), new Vector3(b.x + k, 9.05, b.z), 0.5));
    for (const y of [6.9, 6.6, 6.3]) lines.push(sagging(new Vector3(a.x, y, a.z), new Vector3(b.x, y, b.z), 0.7));
  }
  const corner = mainLine[2]!;
  for (const side of POLES.filter((p) => p.axis === 'x')) {
    for (const y of [8.9, 6.6]) lines.push(sagging(new Vector3(corner.x, y, corner.z), new Vector3(side.x, y, side.z), 0.9));
  }
  // Service drops from the nearest pole to each house.
  for (const house of HOUSES) {
    const [x0, x1] = houseSpan(house);
    const front = frameRect(house.frame, (x0 + x1) / 2, (x0 + x1) / 2, house.setback, house.setback);
    const nearest = mainLine.reduce((best, p) => (Math.abs(p.z - front.minZ) < Math.abs(best.z - front.minZ) ? p : best));
    lines.push(sagging(new Vector3(nearest.x, 6.6, nearest.z), new Vector3(front.minX, HOUSE_WALL_H + CURB_H + 0.2, front.minZ), 0.6));
  }
  const wires = CreateLineSystem('fios', { lines }, scene);
  wires.color = new Color3(0.1, 0.1, 0.11);
  wires.alpha = 0.6;
  wires.isPickable = false;
  wires.freezeWorldMatrix();
}

export function buildBenches(set: BatchSet, mats: Materials): void {
  const wood = mats.paint('#7a5a3b');
  const leg = mats.paint('#9d998f');
  for (const bench of BENCHES) {
    const y = CURB_H;
    const [hx, hz] = bench.alongX ? [0.9, 0.24] : [0.24, 0.9];
    set.box(wood, bench.x - hx, bench.x + hx, y + 0.42, y + 0.48, bench.z - hz, bench.z + hz, { bottom: true });
    const [bx, bz] = bench.alongX ? [0.9, 0.03] : [0.03, 0.9];
    const [ox, oz] = bench.alongX ? [0, 0.22] : [0.22, 0];
    set.box(wood, bench.x + ox - bx, bench.x + ox + bx, y + 0.6, y + 0.9, bench.z + oz - bz, bench.z + oz + bz, { bottom: true });
    for (const k of [-0.7, 0.7]) {
      const [lx, lz] = bench.alongX ? [bench.x + k, bench.z] : [bench.x, bench.z + k];
      const [sx, sz] = bench.alongX ? [0.05, 0.22] : [0.22, 0.05];
      set.box(leg, lx - sx, lx + sx, y, y + 0.42, lz - sz, lz + sz);
      set.box(leg, lx + ox - 0.04, lx + ox + 0.04, y + 0.42, y + 0.9, lz + oz - 0.04, lz + oz + 0.04);
    }
  }
}

/** Rigid placement: turn by `yaw` (Babylon rotation.y convention) and move to (x, y, z). */
function placed(x: number, y: number, z: number, yaw: number): (p: P3) => P3 {
  const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
  return ([px, py, pz]) => [x + px * c + pz * s, y + py, z - px * s + pz * c];
}

/** A board on two posts. Local frame: text faces -z; `yaw` turns it. */
function board(
  set: BatchSet, mats: Materials, x: number, y: number, z: number, yaw: number,
  width: number, height: number, clearance: number, face: ReturnType<Materials['sign']>, doubleSided: boolean,
): void {
  set.setTransform(placed(x, y, z, yaw));
  const post = mats.paint('#70757a', 0.2);
  const [w, top] = [width / 2, clearance + height];
  for (const px of [-w + 0.25, w - 0.25]) set.box(post, px - 0.05, px + 0.05, 0, top, 0.02, 0.12);
  set.box(mats.paint('#3c4044'), -w, w, clearance, top, -0.02, 0.02, { bottom: true });
  set.of(face).quad([-w, clearance, -0.025], [w, clearance, -0.025], [w, top, -0.025], [-w, top, -0.025], 1, 1);
  if (doubleSided) set.of(face).quad([w, clearance, 0.14], [-w, clearance, 0.14], [-w, top, 0.14], [w, top, 0.14], 1, 1);
  set.setTransform(null);
}

const NOTICE = 'ÁREA TEMPORÁRIA DE TESTE';
const NOTICE_2 = 'NÃO REPRESENTA BREJO ALEGRE';

/** In-world copies of the mandatory disclaimer, plus stop signs and the barriers at the street ends. */
export function buildSigns(scene: Scene, set: BatchSet, mats: Materials): void {
  const notice = mats.sign('placa-aviso', '#f6d21f', '#151515', [
    { text: NOTICE, size: 0.27 },
    { text: NOTICE_2, size: 0.21 },
    { text: 'Rua fictícia do Web Lab · protótipo', size: 0.1, weight: '600' },
  ], 4, 256);
  board(set, mats, 8.4, CURB_H, -28.2, Math.PI / 4, 5.2, 1.3, 2.3, notice, true);
  board(set, mats, -8.8, CURB_H, -28.6, (-3 * Math.PI) / 4, 5.2, 1.3, 2.3, notice, true);
  board(set, mats, -5.9, CURB_H, 49, -Math.PI / 2, 5.2, 1.3, 2.3, notice, false);
  board(set, mats, 5.9, CURB_H, -51, Math.PI / 2, 5.2, 1.3, 2.3, notice, false);

  // Stop signs for traffic on the main street.
  const stop = mats.sign('placa-pare', '#b5202a', '#f4f4f4', [{ text: 'PARE', size: 0.36, color: '#ffffff' }], 1, 128);
  const street = mats.sign('placa-rua', '#1d4f9c', '#f4f4f4', [{ text: 'R. PROVISÓRIA', size: 0.5, color: '#ffffff' }], 4.2, 64);
  for (const [x, z, yaw] of [[ROAD_HALF + 0.5, CROSS_SOUTH - 0.6, 0], [-ROAD_HALF - 0.5, CROSS_NORTH + 0.6, Math.PI]] as const) {
    set.setTransform(placed(x, CURB_H, z, yaw));
    set.box(mats.paint('#70757a', 0.2), -0.03, 0.03, 0, 2.95, -0.03, 0.03);
    const plate = CreateCylinder('pare-chapa', { diameter: 0.78, height: 0.03, tessellation: 8 }, scene);
    plate.rotation.x = Math.PI / 2;
    plate.rotation.y = Math.PI / 8;
    plate.position.set(0, 2.45, -0.05);
    set.absorb(mats.paint('#b5202a'), plate);
    set.of(stop).quad([-0.26, 2.19, -0.07], [0.26, 2.19, -0.07], [0.26, 2.71, -0.07], [-0.26, 2.71, -0.07], 1, 1);
    set.of(street).quad([-0.5, 2.97, -0.035], [0.5, 2.97, -0.035], [0.5, 3.21, -0.035], [-0.5, 3.21, -0.035], 1, 1);
    set.of(street).quad([0.5, 2.97, 0.035], [-0.5, 2.97, 0.035], [-0.5, 3.21, 0.035], [0.5, 3.21, 0.035], 1, 1);
    set.setTransform(null);
  }

  // Striped trestles where the playable street ends.
  const stripes = mats.stripes('cavalete', '#c62828', '#f3f1ea', 6, true, 1.1);
  const legs = mats.paint('#3d4246');
  const trestle = (cx: number, cz: number, alongX: boolean) => {
    const [hx, hz] = alongX ? [1.1, 0.04] : [0.04, 1.1];
    for (const y of [0.45, 0.95]) set.box(stripes, cx - hx, cx + hx, y, y + 0.22, cz - hz, cz + hz, { bottom: true });
    for (const k of [-0.9, 0.9]) {
      const [lx, lz] = alongX ? [cx + k, cz] : [cx, cz + k];
      set.box(legs, lx - 0.04, lx + 0.04, 0, 1.17, lz - 0.04, lz + 0.04);
    }
  };
  const end = mats.sign('placa-fim', '#f3f1ea', '#c62828', [{ text: 'FIM DA ÁREA DE TESTE', size: 0.42, color: '#a01e1e' }], 5, 64);
  for (const z of [WORLD_BOUNDS.maxZ + 0.35, WORLD_BOUNDS.minZ - 0.35]) {
    for (const x of [-2.7, 0, 2.7]) trestle(x, z, true);
    board(set, mats, 0, 0, z + Math.sign(z) * 0.5, z > 0 ? 0 : Math.PI, 3, 0.6, 1.4, end, false);
  }
  const crossZ = (CROSS_NORTH + CROSS_SOUTH) / 2;
  for (const x of [WORLD_BOUNDS.maxX + 0.35, WORLD_BOUNDS.minX - 0.35]) {
    for (const dz of [-2.7, 0, 2.7]) trestle(x, crossZ + dz, false);
    board(set, mats, x + Math.sign(x) * 0.5, 0, crossZ, x > 0 ? Math.PI / 2 : -Math.PI / 2, 3, 0.6, 1.4, end, false);
  }
}
