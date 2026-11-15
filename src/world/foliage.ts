import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { Scene } from '@babylonjs/core/scene';
import type { LabMaterial } from './materials';

/**
 * Stylised volumetric foliage (CORE-010): alpha-tested quads ("leaf cards") scattered over a
 * volume, each with normals pointing away from the volume centre, so the whole canopy is lit like
 * one soft, fluffy shape. A tree costs ~70–90 triangles of cards instead of thousands of sphere
 * faces, and stays one mesh (one draw call when instanced).
 */
export type CardVolume = {
  /** Ellipsoid the cards sit on. */
  centre: [number, number, number];
  radii: [number, number, number];
  count: number;
  cardSize: number;
  seed: number;
  /** 0 = round canopy; >0 pulls cards downwards on the -z side (draping, e.g. over a wall). */
  drape?: number;
};

function seeded(seed: number): () => number {
  let a = seed;
  return () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
}

export function buildCards(scene: Scene, name: string, material: LabMaterial, volumes: CardVolume[]): Mesh {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (const v of volumes) {
    const random = seeded(v.seed);
    const [cx, cy, cz] = v.centre;
    const [rx, ry, rz] = v.radii;
    for (let i = 0; i < v.count; i++) {
      // Fibonacci-ish spread over the ellipsoid, biased to the upper half.
      const t = (i + 0.5) / v.count;
      const elevation = Math.asin(Math.min(1, -0.55 + t * 1.5));
      const azimuth = i * 2.399963 + random() * 0.5;
      let nx = Math.cos(elevation) * Math.cos(azimuth);
      let ny = Math.sin(elevation);
      let nz = Math.cos(elevation) * Math.sin(azimuth);
      const depth = 0.72 + random() * 0.3;
      const px = cx + nx * rx * depth;
      let py = cy + ny * ry * depth;
      const pz = cz + nz * rz * depth;
      if (v.drape && nz < 0) py -= v.drape * -nz * (1 - Math.max(0, ny)) * (0.6 + random() * 0.6);
      const len = Math.hypot(nx, ny + 0.35, nz);
      nx /= len; ny = (ny + 0.35) / len; nz /= len;
      // Card plane: roughly facing outwards, randomly rolled; two axes u, w span it.
      const roll = random() * Math.PI * 2;
      const tx = -nz; const tz = nx;
      const tl = Math.hypot(tx, tz) || 1;
      const ax = [tx / tl, 0, tz / tl];
      const bx = [ny * ax[2]! - nz * ax[1]!, nz * ax[0]! - nx * ax[2]!, nx * ax[1]! - ny * ax[0]!];
      const s = v.cardSize * (0.75 + random() * 0.5) / 2;
      const c = Math.cos(roll); const sn = Math.sin(roll);
      const u = ax.map((a, k) => (a * c + bx[k]! * sn) * s);
      const w = ax.map((a, k) => (-a * sn + bx[k]! * c) * s);
      const base = positions.length / 3;
      const light = Math.max(0.55, Math.min(1.2, 0.8 + ny * 0.3 + (depth - 0.85) * 0.6));
      for (const [a, b, uu, vv] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]] as const) {
        positions.push(px + u[0]! * a + w[0]! * b, py + u[1]! * a + w[1]! * b, pz + u[2]! * a + w[2]! * b);
        normals.push(nx, ny, nz);
        uvs.push(uu, vv);
        colors.push(light, light, light, 1);
      }
      indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const data = new VertexData();
  Object.assign(data, { positions, normals, uvs, colors, indices });
  const mesh = new Mesh(name, scene);
  data.applyToMesh(mesh);
  mesh.material = material.material;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  return mesh;
}
