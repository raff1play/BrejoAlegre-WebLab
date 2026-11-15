import { Bone } from '@babylonjs/core/Bones/bone';
import { Skeleton } from '@babylonjs/core/Bones/skeleton';
import { BoundingInfo } from '@babylonjs/core/Culling/boundingInfo';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import type { BatchSet } from '../../world/geometry';

/**
 * Rigid GPU skinning for articulated procedural models (motorcycle, rider). Each moving part keeps
 * its own TransformNode, animated as usual; a bone linked to every node moves that part's vertices
 * on the GPU. All parts sharing a material end up in ONE mesh, so a model with fifteen moving parts
 * costs one draw call per material instead of one per part (and the same again in the shadow pass).
 */
export class RigidSkin {
  private readonly parts: { node: TransformNode; set: BatchSet }[] = [];

  constructor(private readonly scene: Scene, private readonly name: string, private readonly owner: TransformNode) {}

  /** Geometry in `set` is expressed in `node`'s local space; `node` must descend from the owner. */
  add(node: TransformNode, set: BatchSet): void { this.parts.push({ node, set }); }

  /** `extent` bounds every pose of the model around the owner (used for culling). */
  build(extent: { min: Vector3; max: Vector3 }): Mesh[] {
    const skeleton = new Skeleton(`${this.name}-esqueleto`, `${this.name}-esqueleto`, this.scene);
    const bones = new Map<TransformNode, Bone>();
    const boneFor = (node: TransformNode): Bone | null => {
      if (node === this.owner) return null;
      const existing = bones.get(node);
      if (existing) return existing;
      const parent = node.parent as TransformNode | null;
      if (!parent) throw new Error(`RigidSkin: ${node.name} não pertence a ${this.owner.name}`);
      const parentBone = boneFor(parent);
      const bone = new Bone(node.name, skeleton, parentBone, Matrix.Identity(), Matrix.Identity(), Matrix.Identity());
      bone.linkTransformNode(node);
      bones.set(node, bone);
      return bone;
    };

    type Merge = { positions: number[]; normals: number[]; uvs: number[]; colors: number[]; indices: number[]; boneIndices: number[]; weights: number[]; tinted: boolean; receiveShadows: boolean };
    const merges = new Map<Mesh['material'], Merge>();
    for (const { node, set } of this.parts) {
      const index = skeleton.bones.indexOf(boneFor(node)!);
      for (const { material, batch, receiveShadows } of set.entries()) {
        let m = merges.get(material);
        if (!m) {
          m = { positions: [], normals: [], uvs: [], colors: [], indices: [], boneIndices: [], weights: [], tinted: false, receiveShadows };
          merges.set(material, m);
        }
        const d = batch.data();
        const base = m.positions.length / 3;
        const count = d.positions.length / 3;
        m.positions.push(...d.positions);
        m.normals.push(...d.normals);
        m.uvs.push(...d.uvs);
        if (d.colors) m.tinted = true;
        for (let i = 0; i < count; i++) {
          if (d.colors) m.colors.push(d.colors[i * 4]!, d.colors[i * 4 + 1]!, d.colors[i * 4 + 2]!, d.colors[i * 4 + 3]!);
          else m.colors.push(1, 1, 1, 1);
          m.boneIndices.push(index, 0, 0, 0);
          m.weights.push(1, 0, 0, 0);
        }
        for (const i of d.indices) m.indices.push(base + i);
      }
    }

    const meshes: Mesh[] = [];
    for (const [material, m] of merges) {
      const mesh = new Mesh(`${this.name}:${material?.name ?? 'sem-material'}`, this.scene);
      const data = new VertexData();
      data.positions = m.positions;
      data.normals = m.normals;
      data.uvs = m.uvs;
      data.indices = m.indices;
      if (m.tinted) data.colors = m.colors;
      data.matricesIndices = m.boneIndices;
      data.matricesWeights = m.weights;
      data.applyToMesh(mesh);
      mesh.material = material;
      mesh.parent = this.owner;
      mesh.skeleton = skeleton;
      mesh.numBoneInfluencers = 1;
      mesh.receiveShadows = m.receiveShadows;
      mesh.isPickable = false;
      // The bind pose is collapsed around the owner; give culling the real reach of every pose.
      // The local box stays fixed but must keep following the owner in world space, so bounding
      // sync stays on.
      mesh.setBoundingInfo(new BoundingInfo(extent.min, extent.max));
      meshes.push(mesh);
    }
    return meshes;
  }
}
