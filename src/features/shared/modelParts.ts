import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';

/** Small primitive helpers shared by the motorcycle and character models. */
export type Xyz = readonly [number, number, number];

export function boxPart(scene: Scene, size: Xyz, at: Xyz, tilt: Xyz = [0, 0, 0]): Mesh {
  const mesh = CreateBox('parte', { width: size[0], height: size[1], depth: size[2] }, scene);
  mesh.position.set(at[0], at[1], at[2]);
  mesh.rotation.set(tilt[0], tilt[1], tilt[2]);
  return mesh;
}

export function ballPart(scene: Scene, size: Xyz, at: Xyz, segments = 10): Mesh {
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

/** Tyre standing upright, rolling around the x axis. */
export function tyrePart(scene: Scene, radius: number, thickness: number): Mesh {
  const mesh = CreateTorus('pneu', { diameter: radius * 2 - thickness, thickness, tessellation: 20 }, scene);
  mesh.rotation.z = Math.PI / 2;
  return mesh;
}
