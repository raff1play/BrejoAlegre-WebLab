import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import type { Scene } from '@babylonjs/core/scene';
import { BatchSet } from './geometry';
import type { Materials } from './materials';
import { boxPart } from './modelParts';

/**
 * CORE-010 backdrop: rolling green hills around the playable area with a scattered small-town
 * skyline (houses with clay roofs, a church tower and a water tower), as in the visual references.
 * Purely decorative, far outside the walls: no colliders, no shadows, one mesh per material.
 * FICTIONAL: it does not depict the real Brejo Alegre.
 */
// CORE-015: the real town spans ~1.5 km, so the decorative hills sit well outside it.
const INNER = 1150;
const OUTER = 1500;

function seeded(seed: number): () => number {
  let a = seed;
  return () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
}

function hillHeight(angle: number, radius: number): number {
  const t = (radius - INNER) / (OUTER - INNER);
  const ridge = 14 + 9 * Math.sin(angle * 3 + 0.7) + 6 * Math.sin(angle * 7 + 2.1) + 3 * Math.sin(angle * 13);
  return Math.max(0, Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5)) * ridge * (0.55 + t * 0.6);
}

function buildHills(scene: Scene, mats: Materials): Mesh {
  const rings = 9;
  const sides = 96;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const random = seeded(4242);
  for (let r = 0; r <= rings; r++) {
    const radius = INNER - 10 + (r / rings) * (OUTER - INNER + 10);
    for (let s = 0; s <= sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const y = r === 0 ? -0.05 : hillHeight(a, radius);
      positions.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
      // Greens vary with height and a little noise; some dry pasture patches.
      const k = 0.85 + random() * 0.2;
      const dry = Math.sin(a * 5 + r) > 0.75 ? 1 : 0;
      const g = [0.36 + y * 0.004, 0.52 + y * 0.003, 0.27];
      colors.push((dry ? 0.6 : g[0]!) * k, (dry ? 0.55 : g[1]!) * k, (dry ? 0.32 : g[2]!) * k, 1);
    }
  }
  const row = sides + 1;
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < sides; s++) {
      const a = r * row + s;
      const b = (r + 1) * row + s;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  Object.assign(data, { positions, indices, normals, colors, uvs: new Array((positions.length / 3) * 2).fill(0) });
  const mesh = new Mesh('morros', scene);
  data.applyToMesh(mesh);
  mesh.material = mats.paint('#ffffff').material;
  return mesh;
}

export function buildBackdrop(scene: Scene, mats: Materials): Mesh[] {
  const hills = buildHills(scene, mats);
  const town = new BatchSet();
  const random = seeded(777);
  const walls = ['#f1ece0', '#efe1c4', '#f3d9b6', '#e9eef0', '#f0c9a8', '#dfe8d6'];
  const roof = mats.paint('#c8653a');
  // Clusters of small houses on the lower slopes, mostly in the default viewing direction (NE).
  for (let i = 0; i < 150; i++) {
    const cluster = i % 6;
    const base = [0.8, 1.4, 2.4, 3.6, 4.6, 5.6][cluster]!;
    const a = base + (random() - 0.5) * 0.55;
    const radius = INNER + 12 + random() * 120;
    const y = hillHeight(a, radius) - 0.4;
    const [x, z] = [Math.cos(a) * radius, Math.sin(a) * radius];
    const w = 5 + random() * 4;
    const d = 6 + random() * 4;
    const turn = random() * Math.PI;
    const body = boxPart(scene, [w, 3, d], [x, y + 1.5, z], [0, turn, 0]);
    town.absorb(mats.paint(walls[Math.floor(random() * walls.length)]!), body);
    const top = CreateCylinder('telhado', { diameterTop: 0, diameterBottom: 1, height: 1, tessellation: 4 }, scene);
    top.scaling.set(w * 1.5, 2, d * 1.5);
    top.rotation.y = turn + Math.PI / 4;
    top.position.set(x, y + 4, z);
    town.absorb(roof, top);
  }
  // Church with bell tower and a water tower on the hill to the north-east.
  const ca = 0.95;
  const cr = INNER + 30;
  const [cx, cz] = [Math.cos(ca) * cr, Math.sin(ca) * cr];
  const cy = hillHeight(ca, cr) - 0.5;
  const white = mats.paint('#f6f1e4');
  town.absorb(white, boxPart(scene, [9, 9, 20], [cx, cy + 4.5, cz], [0, -ca, 0]));
  const nave = CreateCylinder('nave', { diameterTop: 0, diameterBottom: 1, height: 1, tessellation: 4 }, scene);
  nave.scaling.set(14, 4, 26);
  nave.rotation.y = -ca + Math.PI / 4;
  nave.position.set(cx, cy + 11, cz);
  town.absorb(roof, nave);
  const tx = cx + Math.cos(ca) * -11;
  const tz = cz + Math.sin(ca) * -11;
  town.absorb(white, boxPart(scene, [4.5, 18, 4.5], [tx, cy + 9, tz], [0, -ca, 0]));
  town.absorb(mats.paint('#e3b34a'), boxPart(scene, [4.8, 1, 4.8], [tx, cy + 15, tz], [0, -ca, 0]));
  const spire = CreateCylinder('torre', { diameterTop: 0, diameterBottom: 4.2, height: 6, tessellation: 4 }, scene);
  spire.position.set(tx, cy + 21, tz);
  spire.rotation.y = -ca + Math.PI / 4;
  town.absorb(roof, spire);
  const wa = 2.0;
  const wr = INNER + 45;
  const [wx, wz] = [Math.cos(wa) * wr, Math.sin(wa) * wr];
  const wy = hillHeight(wa, wr);
  const tank = CreateCylinder('caixa', { diameterTop: 9, diameterBottom: 7, height: 6, tessellation: 16 }, scene);
  tank.position.set(wx, wy + 22, wz);
  town.absorb(white, tank);
  const stem = CreateCylinder('fuste', { diameter: 3, height: 20, tessellation: 12 }, scene);
  stem.position.set(wx, wy + 10, wz);
  town.absorb(white, stem);
  const meshes = [hills, ...town.build('casario', scene)];
  for (const mesh of meshes) {
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    mesh.freezeWorldMatrix();
    mesh.doNotSyncBoundingInfo = true;
  }
  return meshes;
}
