import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import type { Material } from '@babylonjs/core/Materials/material';
import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture';
import type { Nullable } from '@babylonjs/core/types';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { Scene } from '@babylonjs/core/scene';
import { RegisterSceneLoaderPlugin } from '@babylonjs/core/Loading/sceneLoader';
import { GLTFFileLoaderMetadata } from '@babylonjs/loaders/glTF/glTFFileLoader.metadata';
import { registerGLTFExtension } from '@babylonjs/loaders/glTF/2.0/glTFLoaderExtensionRegistry';
import '@babylonjs/core/Meshes/instancedMesh';
import { CURB_H, SIDEWALK, framePoint, yawOf } from './layout';
import { STORES, depotWorld, depotYaw } from './city/cityPlan';

/**
 * CORE-011: real external 3D models (CC0, Poly Haven), optimised offline with glTF-Transform and
 * shipped in `public/assets/models/`. See `public/assets/ASSET_MANIFEST.md` for source and licence.
 *
 * Models load asynchronously after the procedural world is built, so the game is playable at once;
 * if a file fails to load, the matching procedural piece is built instead (`onFallback`).
 */
export type ExternalModelId = 'street_lamp_01' | 'planter_box_02' | 'rollershutter_door';

export type Placement = { x: number; y: number; z: number; yaw: number; scale: [number, number, number] };

export type ExternalStatus = { loaded: ExternalModelId[]; failed: ExternalModelId[]; instances: number; triangles: number; roofTexture?: boolean };

let loadersRegistered = false;

/**
 * Registers ONLY the glTF 2.0 loader and the one extension our files use (EXT_texture_webp), both
 * imported on demand. `registerBuiltInLoaders()` would ship every loader (FBX, USD, splats…) as
 * extra chunks and triple the build.
 */
function registerGltfLoader(): void {
  RegisterSceneLoaderPlugin({
    ...GLTFFileLoaderMetadata,
    createPlugin: async (options) => {
      const [{ GLTFFileLoader, RegisterGLTF2Loader }, { RegisterInstancedMesh }] = await Promise.all([
        import('@babylonjs/loaders/glTF/2.0/glTFLoader.pure'),
        import('@babylonjs/core/Meshes/instancedMesh.pure'),
      ]);
      RegisterInstancedMesh();
      RegisterGLTF2Loader();
      return new GLTFFileLoader(options[GLTFFileLoaderMetadata.name]);
    },
  });
  registerGLTFExtension('EXT_texture_webp', true, async (loader) => {
    const { EXT_texture_webp } = await import('@babylonjs/loaders/glTF/2.0/Extensions/EXT_texture_webp.pure');
    return new EXT_texture_webp(loader);
  });
}

/**
 * The parts of a glTF PBR material we read. Typed structurally on purpose: importing PBRMaterial here
 * would pull the whole PBR stack into the initial bundle instead of the on-demand loader chunk.
 */
type PbrLike = Material & {
  albedoTexture: Nullable<BaseTexture>; albedoColor: Color3; bumpTexture: Nullable<BaseTexture>;
  metallicTexture: Nullable<BaseTexture>; invertNormalMapX: boolean; invertNormalMapY: boolean;
};
const isPbr = (m: Nullable<Material>): m is PbrLike => !!m && m.getClassName() === 'PBRMaterial';

/** Glass and bulbs keep their character; everything else gets the scene's matte-ish shading. */
function toStandard(scene: Scene, source: PbrLike): StandardMaterial {
  const m = new StandardMaterial(`ext-${source.name}`, scene);
  m.diffuseTexture = source.albedoTexture;
  m.diffuseColor = source.albedoColor.clone();
  m.bumpTexture = source.bumpTexture;
  m.invertNormalMapX = source.invertNormalMapX;
  m.invertNormalMapY = source.invertNormalMapY;
  m.backFaceCulling = source.backFaceCulling;
  m.specularColor = new Color3(0.12, 0.12, 0.12);
  m.specularPower = 32;
  const name = source.name.toLowerCase();
  // The planter's stained-wood texture is very dark (mean ≈ RGB 62/51/39); lift it to sit with the
  // sunlit street instead of reading as a black box.
  if (name.includes('planter')) m.diffuseColor = new Color3(1.75, 1.6, 1.45);
  if (name.includes('glass')) {
    m.alpha = 0.42;
    m.specularColor = new Color3(0.8, 0.8, 0.8);
    m.specularPower = 96;
    m.emissiveColor = new Color3(0.35, 0.3, 0.2);
  } else if (name.includes('bulb')) {
    m.emissiveColor = new Color3(1, 0.86, 0.6);
    m.disableLighting = true;
  }
  source.metallicTexture?.dispose();
  return m;
}

/** Loads one GLB and returns standalone, hidden source meshes (transforms baked, materials converted). */
async function loadModel(scene: Scene, id: ExternalModelId): Promise<Mesh[]> {
  if (!loadersRegistered) { registerGltfLoader(); loadersRegistered = true; }
  const url = `${import.meta.env.BASE_URL}assets/models/${id}.glb`;
  const container = await LoadAssetContainerAsync(url, scene);
  container.addAllToScene();
  const converted = new Map<unknown, StandardMaterial>();
  const meshes: Mesh[] = [];
  for (const mesh of container.meshes) {
    if (!(mesh instanceof Mesh) || mesh.getTotalVertices() === 0) continue;
    // Bake the glTF right-handed → Babylon conversion (root scale/rotation) into the vertices.
    mesh.computeWorldMatrix(true);
    mesh.setParent(null);
    mesh.bakeCurrentTransformIntoVertices();
    const pbr = mesh.material;
    if (isPbr(pbr)) {
      let standard = converted.get(pbr);
      if (!standard) { standard = toStandard(scene, pbr); converted.set(pbr, standard); }
      mesh.material = standard;
    }
    mesh.isVisible = false;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    meshes.push(mesh);
  }
  for (const node of container.transformNodes) node.dispose();
  for (const mesh of container.meshes) if (!meshes.includes(mesh as Mesh)) mesh.dispose();
  for (const material of converted.keys()) (material as PbrLike).dispose(false, false);
  return meshes;
}

/**
 * Where each model goes. CORE-015: the Poly Haven (CC0) models of CORE-011 are kept and moved to the
 * real town — colonial lamps and planters flank each (fictional) shop on its real street, the
 * roll-up door closes the last dock of the depot.
 */
export function externalPlacements(): Record<ExternalModelId, Placement[]> {
  const lamps: Placement[] = []; const planters: Placement[] = [];
  for (const s of STORES) {
    const yaw = yawOf(s.frame) + Math.PI; // models look out to the street
    for (const lx of [-0.9, s.width + 0.9]) {
      const p = framePoint(s.frame, lx, -SIDEWALK + 0.45);
      lamps.push({ x: p.x, y: CURB_H, z: p.z, yaw, scale: [1.08, 1.08, 1.08] });
    }
    const q = framePoint(s.frame, 1.6, -0.55);
    planters.push({ x: q.x, y: CURB_H, z: q.z, yaw: yaw + Math.PI / 2, scale: [1.1, 1.05, 1.05] });
  }
  const dock = depotWorld(128, -118.02);
  return {
    street_lamp_01: lamps,
    planter_box_02: planters,
    rollershutter_door: [{ x: dock.x, y: CURB_H, z: dock.z, yaw: depotYaw(0), scale: [2.9, 3.2, 1] }],
  };
}

export async function populateExternalAssets(
  scene: Scene, shadows: ShadowGenerator, castShadows: boolean,
  onFallback: (id: ExternalModelId) => void,
): Promise<ExternalStatus> {
  const status: ExternalStatus = { loaded: [], failed: [], instances: 0, triangles: 0 };
  const placements = externalPlacements();
  await Promise.all((Object.keys(placements) as ExternalModelId[]).map(async (id) => {
    if (placements[id].length === 0) return;
    let sources: Mesh[];
    try {
      sources = await loadModel(scene, id);
    } catch (error) {
      console.warn(`CORE-011: modelo externo ${id} não carregou; usando versão procedural.`, error);
      status.failed.push(id);
      onFallback(id);
      return;
    }
    const instances: AbstractMesh[] = [];
    for (const p of placements[id]) {
      for (const source of sources) {
        const instance = source.createInstance(`${id}@${p.x.toFixed(1)},${p.z.toFixed(1)}`);
        instance.position.set(p.x, p.y, p.z);
        instance.rotation.y = p.yaw;
        instance.scaling.set(...p.scale);
        instance.isPickable = false;
        instance.freezeWorldMatrix();
        instances.push(instance);
        status.triangles += source.getTotalIndices() / 3;
      }
    }
    // Shadows only where they read: lamp posts and the door. Glass and the low planter boxes skip the
    // shadow pass (it would double their cost for an invisible gain); contact shadows ground them.
    for (const instance of instances) {
      const transparent = ((instance.material as StandardMaterial | null)?.alpha ?? 1) < 1;
      if (!transparent && id !== 'planter_box_02' && castShadows) shadows.addShadowCaster(instance, false);
    }
    status.loaded.push(id);
    status.instances += instances.length;
  }));
  return status;
}

/**
 * CORE-011: real clay roof-tile photo texture (Poly Haven "Clay Roof Tiles 03", CC0) replacing the
 * painted one on every tiled roof. Resolves true when applied; on failure the painted texture stays.
 * The geometry UVs are in units of the old 1.6 m repeat; the photo covers 2.6 m, hence the scale.
 */
export function applyRoofTexture(material: StandardMaterial, withNormalMap: boolean, oldRepeat: number): Promise<boolean> {
  const scene = material.getScene();
  const base = `${import.meta.env.BASE_URL}assets/textures/clay_roof_tiles_03_`;
  const realRepeat = 2.6;
  const load = (file: string) => new Promise<Texture>((resolve, reject) => {
    const texture: Texture = new Texture(`${base}${file}`, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE,
      () => resolve(texture), (message) => { texture.dispose(); reject(new Error(message ?? file)); });
  });
  return Promise.all([load('diff_512.jpg'), withNormalMap ? load('nor_gl_512.jpg') : Promise.resolve(null)])
    .then(([diffuse, normal]) => {
      for (const t of [diffuse, normal]) {
        if (!t) continue;
        t.uScale = oldRepeat / realRepeat;
        t.vScale = oldRepeat / realRepeat;
        t.anisotropicFilteringLevel = 4;
      }
      const painted = material.diffuseTexture;
      material.diffuseTexture = diffuse;
      // Slightly warmer and brighter, matching the reference roofs in late sun.
      material.diffuseColor = new Color3(1.12, 1.0, 0.92);
      if (normal) { material.bumpTexture = normal; material.bumpTexture.level = 0.8; }
      painted?.dispose();
      return true;
    })
    .catch((error: unknown) => { console.warn('CORE-011: textura de telha externa não carregou; mantendo a procedural.', error); return false; });
}
