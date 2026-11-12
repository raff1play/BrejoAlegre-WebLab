import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';

/** Small primitive helpers shared by the motorcycle and character models. */
export type Xyz = readonly [number, number, number];

export function boxPart(scene: Scene, size: Xyz, at: Xyz, tilt: Xyz = [0, 0, 0]): Mesh {
  const mesh = CreateBox('parte', { width: size[0], height: size[1], depth: size[2] }, scene);
  mesh.position.set(at[0], at[1], at[2]);
  mesh.rotation.set(tilt[0], tilt[1], tilt[2]);
  return mesh;
}

export function ballPart(scene: Scene, size: Xyz, at: Xyz, segments = 7): Mesh {
  const mesh = CreateSphere('parte', { diameterX: size[0], diameterY: size[1], diameterZ: size[2], segments }, scene);
  mesh.position.set(at[0], at[1], at[2]);
  return mesh;
}

/** Cylinder (optionally tapered) spanning two points: forks, limbs, exhausts. */
export function rodPart(scene: Scene, from: Xyz, to: Xyz, diameter: number, endDiameter = diameter, sides = 8): Mesh {
  const a = new Vector3(from[0], from[1], from[2]);
  const b = new Vector3(to[0], to[1], to[2]);
  const axis = b.subtract(a);
  const mesh = CreateCylinder('parte', { height: axis.length(), diameterBottom: diameter, diameterTop: endDiameter, tessellation: sides }, scene);
  mesh.position = Vector3.Center(a, b);
  mesh.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), axis.normalize(), new Quaternion());
  return mesh;
}

/**
 * Low-poly torus around the local y axis with separate ring and tube resolutions (Babylon's torus
 * uses one value for both, which wastes triangles on thin rings).
 */
export function torusPart(scene: Scene, radius: number, thickness: number, ringSides: number, tubeSides: number, squashY = 1): Mesh {
  const positions: number[] = [];
  const indices: number[] = [];
  const tube = thickness / 2;
  for (let i = 0; i <= ringSides; i++) {
    const a = (i / ringSides) * Math.PI * 2;
    for (let j = 0; j <= tubeSides; j++) {
      const b = (j / tubeSides) * Math.PI * 2;
      const r = radius + Math.cos(b) * tube;
      positions.push(Math.cos(a) * r, Math.sin(b) * tube * squashY, Math.sin(a) * r);
    }
  }
  const row = tubeSides + 1;
  for (let i = 0; i < ringSides; i++) {
    for (let j = 0; j < tubeSides; j++) {
      const a = i * row + j;
      const b = (i + 1) * row + j;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const data = new VertexData();
  Object.assign(data, { positions, indices, normals, uvs: new Array((positions.length / 3) * 2).fill(0) });
  const mesh = new Mesh('toro', scene);
  data.applyToMesh(mesh);
  return mesh;
}

/** Tyre standing upright, rolling around the x axis, with a slightly squared profile. */
export function tyrePart(scene: Scene, radius: number, thickness: number): Mesh {
  const mesh = torusPart(scene, radius - thickness / 2, thickness, 24, 8, 1.15);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}

/** Flat disc or short cylinder whose axis is the local x axis (wheel hubs, discs, covers). */
export function discPart(scene: Scene, diameter: number, thickness: number, at: Xyz, sides = 16): Mesh {
  const mesh = CreateCylinder('disco', { diameter, height: thickness, tessellation: sides }, scene);
  mesh.rotation.z = Math.PI / 2;
  mesh.position.set(at[0], at[1], at[2]);
  return mesh;
}

/** Ring around the local x axis, e.g. a rim or a spring coil seen from the side. */
export function ringPart(scene: Scene, radius: number, thickness: number, at: Xyz, axis: 'x' | 'y' | 'z' = 'x', sides = 20): Mesh {
  const mesh = torusPart(scene, radius, thickness, sides, thickness < 0.02 ? 4 : 6);
  if (axis === 'x') mesh.rotation.z = Math.PI / 2;
  else if (axis === 'z') mesh.rotation.x = Math.PI / 2;
  mesh.position.set(at[0], at[1], at[2]);
  return mesh;
}
