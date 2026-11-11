import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import { Scene } from '@babylonjs/core/scene';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import type { GraphicsProfile } from '../config/graphics';
import { paintSky, paintTexture } from './textures';

const HORIZON = '#dfe7e6';

export type Environment = {
  shadows: ShadowGenerator;
  /** Re-centres the shadowed area on the player; call once per frame. */
  focusShadows(x: number, z: number): void;
};

/** Mid-morning sun, sky dome, light haze and one economical shadow map that follows the player. */
export function setupEnvironment(scene: Scene, profile: GraphicsProfile): Environment {
  scene.clearColor = Color4.FromHexString(`${HORIZON}ff`);
  scene.ambientColor = new Color3(0.3, 0.3, 0.3);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = Color3.FromHexString(HORIZON);
  scene.fogStart = 70;
  scene.fogEnd = 330;
  const grading = scene.imageProcessingConfiguration;
  grading.toneMappingEnabled = true;
  grading.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  grading.exposure = 1.25;
  grading.contrast = 1.12;

  const sky = new HemisphericLight('ceu', new Vector3(0.1, 1, -0.1), scene);
  sky.diffuse = Color3.FromHexString('#cfe0f5');
  sky.groundColor = Color3.FromHexString('#8f8676');
  sky.specular = Color3.Black();
  sky.intensity = 0.85;

  const direction = new Vector3(-0.52, -0.78, 0.36).normalize();
  const sun = new DirectionalLight('sol', direction, scene);
  sun.diffuse = Color3.FromHexString('#fff1d6');
  sun.specular = Color3.FromHexString('#fff1d6');
  sun.intensity = 1.9;
  sun.autoUpdateExtends = false;
  sun.autoCalcShadowZBounds = false;
  sun.shadowFrustumSize = profile.shadowRange * 2;
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 260;

  const shadows = new ShadowGenerator(profile.shadowMapSize, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = profile.softShadows ? ShadowGenerator.QUALITY_MEDIUM : ShadowGenerator.QUALITY_LOW;
  shadows.bias = 0.0012;
  shadows.normalBias = 0.03;
  shadows.setDarkness(0.08);

  const dome = CreateSphere('ceu-domo', { diameter: 1600, segments: 16, sideOrientation: Mesh.BACKSIDE }, scene);
  const skyMaterial = new StandardMaterial('ceu', scene);
  skyMaterial.emissiveTexture = paintTexture(scene, 'tx-ceu', { size: 512, width: 1024, seed: 19, anisotropy: 1, clamp: false }, paintSky);
  skyMaterial.disableLighting = true;
  skyMaterial.fogEnabled = false;
  dome.material = skyMaterial;
  dome.infiniteDistance = true;
  dome.isPickable = false;
  dome.applyFog = false;

  // The shadow camera is snapped to whole texels so shadow edges do not shimmer while moving.
  const right = Vector3.Cross(Vector3.Up(), direction).normalize();
  const up = Vector3.Cross(direction, right).normalize();
  const texel = (profile.shadowRange * 2) / profile.shadowMapSize;
  const focus = new Vector3();
  return {
    shadows,
    focusShadows(x, z) {
      focus.set(x, 0, z);
      const a = Math.round(Vector3.Dot(focus, right) / texel) * texel;
      const b = Math.round(Vector3.Dot(focus, up) / texel) * texel;
      const c = Vector3.Dot(focus, direction) - 120;
      sun.position.set(
        right.x * a + up.x * b + direction.x * c,
        right.y * a + up.y * b + direction.y * c,
        right.z * a + up.z * b + direction.z * c,
      );
    },
  };
}
