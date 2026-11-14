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
import { ColorCurves } from '@babylonjs/core/Materials/colorCurves';
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration';
import type { GraphicsProfile } from '../config/graphics';
import { paintSky, paintTexture } from './textures';
import type { Lighting } from '../core/city/dayNight';

const HORIZON = '#e8dfc9';

export type Environment = {
  shadows: ShadowGenerator;
  /** Re-centres the shadowed area on the player; call once per frame. */
  focusShadows(x: number, z: number): void;
  /** CORE-013: applies the virtual-clock lighting (sun, sky, haze, shadows). */
  applyLighting(lighting: Lighting): void;
};

/**
 * CORE-010: warm late-afternoon sun (long soft shadows), warm haze, saturated grade, sky dome and
 * one economical shadow map that follows the player.
 */
export function setupEnvironment(scene: Scene, profile: GraphicsProfile): Environment {
  scene.clearColor = Color4.FromHexString(`${HORIZON}ff`);
  scene.ambientColor = new Color3(0.3, 0.3, 0.3);
  scene.fogMode = Scene.FOGMODE_LINEAR;
  scene.fogColor = Color3.FromHexString(HORIZON);
  // CORE-015: the real town is ~1.5 km wide; distant streets fade into the haze.
  scene.fogStart = 110;
  scene.fogEnd = 560;
  const grading = scene.imageProcessingConfiguration;
  grading.toneMappingEnabled = true;
  grading.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
  grading.exposure = 1.3;
  grading.contrast = 1.18;
  // Colour curves run inside the material shaders (no extra pass): richer colour, warm highlights.
  const curves = new ColorCurves();
  curves.globalSaturation = 14;
  curves.highlightsHue = 35;
  curves.highlightsDensity = 10;
  curves.highlightsSaturation = 20;
  curves.shadowsHue = 215;
  curves.shadowsDensity = 12;
  curves.shadowsSaturation = 15;
  grading.colorCurvesEnabled = true;
  grading.colorCurves = curves;
  grading.vignetteEnabled = true;
  grading.vignetteWeight = 1.3;
  grading.vignetteColor = new Color4(0.12, 0.08, 0.04, 0);

  const sky = new HemisphericLight('ceu', new Vector3(0.1, 1, -0.1), scene);
  sky.diffuse = Color3.FromHexString('#c4d8f0');
  sky.groundColor = Color3.FromHexString('#a08665');
  sky.specular = Color3.Black();
  sky.intensity = 0.78;

  const direction = new Vector3(-0.6, -0.52, 0.6).normalize();
  const sun = new DirectionalLight('sol', direction, scene);
  sun.diffuse = Color3.FromHexString('#ffd9a4');
  sun.specular = Color3.FromHexString('#ffe6c2');
  sun.intensity = 2.15;
  sun.autoUpdateExtends = false;
  sun.autoCalcShadowZBounds = false;
  sun.shadowFrustumSize = profile.shadowRange * 2;
  sun.shadowMinZ = 1;
  sun.shadowMaxZ = 300;

  const shadows = new ShadowGenerator(profile.shadowMapSize, sun);
  shadows.usePercentageCloserFiltering = true;
  shadows.filteringQuality = profile.softShadows ? ShadowGenerator.QUALITY_MEDIUM : ShadowGenerator.QUALITY_LOW;
  shadows.bias = 0.0012;
  shadows.normalBias = 0.03;
  shadows.setDarkness(0.12);

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
  const baseExposure = grading.exposure;
  return {
    shadows,
    applyLighting(l) {
      direction.set(l.sunDirection[0], l.sunDirection[1], l.sunDirection[2]).normalize();
      sun.direction.copyFrom(direction);
      Vector3.CrossToRef(Vector3.Up(), direction, right); right.normalize();
      Vector3.CrossToRef(direction, right, up); up.normalize();
      sun.diffuse.set(l.sunColor[0], l.sunColor[1], l.sunColor[2]);
      sun.specular.set(l.sunColor[0] * 0.9, l.sunColor[1] * 0.9, l.sunColor[2] * 0.9);
      sun.intensity = l.sunIntensity;
      sun.shadowEnabled = l.shadows;
      shadows.setDarkness(0.12 + 0.5 * l.night);
      sky.diffuse.set(l.skyColor[0], l.skyColor[1], l.skyColor[2]);
      sky.groundColor.set(l.groundColor[0], l.groundColor[1], l.groundColor[2]);
      sky.intensity = l.skyIntensity;
      scene.fogColor.set(l.fogColor[0], l.fogColor[1], l.fogColor[2]);
      scene.clearColor.set(l.fogColor[0], l.fogColor[1], l.fogColor[2], 1);
      skyMaterial.emissiveColor.set(l.skyTint[0], l.skyTint[1], l.skyTint[2]);
      grading.exposure = baseExposure * (1 - 0.05 * l.night);
      grading.vignetteWeight = 1.3 + 0.8 * l.night;
    },
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
