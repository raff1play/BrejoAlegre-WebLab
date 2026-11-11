import { Color3, Scene, StandardMaterial } from '@babylonjs/core';

export function solid(scene: Scene, name: string, color: string): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = Color3.FromHexString(color);
  mat.specularColor = new Color3(0.06, 0.06, 0.06);
  return mat;
}
