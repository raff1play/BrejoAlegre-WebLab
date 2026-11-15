import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer';
import type { Scene } from '@babylonjs/core/scene';
import type { Node } from '@babylonjs/core/node';
import type { LabMaterial } from './materials';

export type P3 = readonly [number, number, number];
type UV = readonly [number, number];

/**
 * Accumulates static geometry that shares a material into ONE mesh, so a whole house costs a
 * handful of draw calls. UVs are generated in metres, giving textures a constant real-world scale.
 * Winding: corners are given counter-clockwise as seen from outside (Babylon's front face).
 */
export class Batch {
  private readonly positions: number[] = [];
  private readonly normals: number[] = [];
  private readonly uvs: number[] = [];
  private readonly indices: number[] = [];
  private readonly colors: number[] = [];
  private tinted = false;
  private tint: readonly [number, number, number] = [1, 1, 1];
  /** Optional rigid placement (rotation + translation) applied to everything added afterwards. */
  transform: ((p: P3) => P3) | null = null;

  get isEmpty(): boolean { return this.indices.length === 0; }

  /** Vertex colour for what is added next; lets many flat-painted parts share one material. */
  setTint(tint: readonly [number, number, number] | undefined): void {
    this.tint = tint ?? [1, 1, 1];
    if (tint) this.tinted = true;
  }

  /** Flat polygon (triangle fan) with explicit UVs. */
  poly(local: readonly P3[], uvs: readonly UV[]): void {
    const place = this.transform;
    const points = place ? local.map(place) : local;
    const [a, b, c] = [points[0]!, points[1]!, points[points.length - 1]!];
    const e1 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const e2 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    let nx = e1[1]! * e2[2]! - e1[2]! * e2[1]!;
    let ny = e1[2]! * e2[0]! - e1[0]! * e2[2]!;
    let nz = e1[0]! * e2[1]! - e1[1]! * e2[0]!;
    const length = Math.hypot(nx, ny, nz) || 1;
    nx /= length; ny /= length; nz /= length;
    const base = this.positions.length / 3;
    points.forEach((p, i) => {
      this.positions.push(p[0], p[1], p[2]);
      this.normals.push(nx, ny, nz);
      this.uvs.push(uvs[i]![0], uvs[i]![1]);
      this.colors.push(this.tint[0], this.tint[1], this.tint[2], 1);
    });
    for (let i = 1; i < points.length - 1; i++) this.indices.push(base, base + i, base + i + 1);
  }

  /** Rectangle given as bottom-left, bottom-right, top-right, top-left seen from outside. */
  quad(p0: P3, p1: P3, p2: P3, p3: P3, u: number, v: number, u0 = 0, v0 = 0): void {
    this.poly([p0, p1, p2, p3], [[u0, v0], [u0 + u, v0], [u0 + u, v0 + v], [u0, v0 + v]]);
  }

  /**
   * Axis-aligned box. `tileU`/`tileV` are the texture's size in metres; with `fitV` the texture
   * spans the full height once (used for walls whose texture has dirt near the ground).
   */
  box(
    x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
    tileU: number, tileV: number, options: { fitV?: boolean; bottom?: boolean; top?: boolean; sides?: boolean } = {},
  ): void {
    const w = x1 - x0;
    const h = y1 - y0;
    const d = z1 - z0;
    const v = options.fitV ? 1 : h / tileV;
    if (options.sides !== false) {
      this.quad([x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], w / tileU, v, x0 / tileU);
      this.quad([x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1], w / tileU, v, -x1 / tileU);
      this.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], d / tileU, v, z0 / tileU);
      this.quad([x0, y0, z1], [x0, y0, z0], [x0, y1, z0], [x0, y1, z1], d / tileU, v, -z1 / tileU);
    }
    if (options.top !== false) {
      this.quad([x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1], w / tileU, d / tileV, x0 / tileU, z0 / tileV);
    }
    if (options.bottom) {
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0], w / tileU, d / tileV);
    }
  }

  /** Copies a primitive (cylinder, sphere...) into the batch, baking its transform, and disposes it. */
  absorb(mesh: Mesh): void {
    mesh.computeWorldMatrix(true);
    mesh.bakeCurrentTransformIntoVertices();
    const positions = mesh.getVerticesData(VertexBuffer.PositionKind) ?? [];
    const normals = mesh.getVerticesData(VertexBuffer.NormalKind) ?? [];
    const uvs = mesh.getVerticesData(VertexBuffer.UVKind) ?? [];
    const indices = mesh.getIndices() ?? [];
    const base = this.positions.length / 3;
    const place = this.transform;
    for (let i = 0; i < positions.length; i += 3) {
      this.colors.push(this.tint[0], this.tint[1], this.tint[2], 1);
      const p: P3 = [positions[i]!, positions[i + 1]!, positions[i + 2]!];
      const n: P3 = [normals[i] ?? 0, normals[i + 1] ?? 1, normals[i + 2] ?? 0];
      if (!place) { this.positions.push(...p); this.normals.push(...n); continue; }
      const q = place(p);
      const tip = place([p[0] + n[0], p[1] + n[1], p[2] + n[2]]);
      this.positions.push(...q);
      this.normals.push(tip[0] - q[0], tip[1] - q[1], tip[2] - q[2]);
    }
    for (let i = 0; i < (positions.length / 3) * 2; i++) this.uvs.push(uvs[i] ?? 0);
    for (let i = 0; i < indices.length; i++) this.indices.push(base + indices[i]!);
    mesh.dispose();
  }

  /** Raw arrays (read-only use), for assemblies that merge several batches themselves. */
  data(): { positions: number[]; normals: number[]; uvs: number[]; colors: number[] | null; indices: number[] } {
    return { positions: this.positions, normals: this.normals, uvs: this.uvs, colors: this.tinted ? this.colors : null, indices: this.indices };
  }

  build(name: string, scene: Scene): Mesh {
    const mesh = new Mesh(name, scene);
    const data = new VertexData();
    data.positions = this.positions;
    data.normals = this.normals;
    data.uvs = this.uvs;
    data.indices = this.indices;
    if (this.tinted) data.colors = this.colors;
    data.applyToMesh(mesh);
    return mesh;
  }
}

/** One Batch per underlying material; `build` yields one mesh per material actually used. */
export class BatchSet {
  private readonly batches = new Map<LabMaterial['material'], { batch: Batch; receiveShadows: boolean }>();
  private transform: ((p: P3) => P3) | null = null;

  /** Places everything added from now on (e.g. a house built in lot coordinates) until reset with null. */
  setTransform(transform: ((p: P3) => P3) | null): void {
    this.transform = transform;
    for (const entry of this.batches.values()) entry.batch.transform = transform;
  }

  /** The batch for a material, ready to receive geometry in that material's tint. Use it immediately. */
  of(material: LabMaterial): Batch {
    let entry = this.batches.get(material.material);
    if (!entry) {
      entry = { batch: new Batch(), receiveShadows: material.receiveShadows };
      entry.batch.transform = this.transform;
      this.batches.set(material.material, entry);
    }
    entry.batch.setTint(material.tint);
    return entry.batch;
  }

  box(
    material: LabMaterial, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number,
    options?: { fitV?: boolean; bottom?: boolean; top?: boolean; sides?: boolean },
  ): void {
    this.of(material).box(x0, x1, y0, y1, z0, z1, material.tileU, material.tileV, options);
  }

  absorb(material: LabMaterial, mesh: Mesh): void { this.of(material).absorb(mesh); }

  /** Non-empty batches with their material, for custom merging. */
  entries(): { material: LabMaterial['material']; batch: Batch; receiveShadows: boolean }[] {
    return [...this.batches].filter(([, e]) => !e.batch.isEmpty).map(([material, e]) => ({ material, batch: e.batch, receiveShadows: e.receiveShadows }));
  }

  build(name: string, scene: Scene, parent: Node | null = null): Mesh[] {
    const meshes: Mesh[] = [];
    for (const [material, entry] of this.batches) {
      if (entry.batch.isEmpty) continue;
      const mesh = entry.batch.build(`${name}:${material.name}`, scene);
      mesh.material = material;
      mesh.parent = parent;
      mesh.receiveShadows = entry.receiveShadows;
      mesh.isPickable = false;
      meshes.push(mesh);
    }
    return meshes;
  }
}
