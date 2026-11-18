import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { Scene } from '@babylonjs/core/scene';
import { loadGlb } from './externalAssets';
import { CURB_H } from './layout';
import { streetLightPositions } from './city/cityLayout';

/**
 * EXPERIMENTO kit (branch isolada): peças do "City Kit Roads" 2.2 da Kenney (CC0) no mundo real.
 * - `light-curved` substitui os postes procedurais nos mesmos pontos (o braço aponta para a rua).
 * - `road-sign-stop` marca os braços secundários dos cruzamentos `stop` da simulação.
 * As peças da Kenney têm 1 unidade = 1 bloco de rua; a escala abaixo as leva a metros.
 * Se um arquivo falhar, `onFallback` reconstrói a versão procedural correspondente.
 */
export type KitPlacement = { x: number; z: number; yaw: number };
export type KitStatus = { loaded: string[]; failed: string[]; instances: number };

const base = () => `${import.meta.env.BASE_URL}assets/models/kenney/`;

/** Atlas de cores da Kenney: amostragem "nearest" mantém as faixas de cor nítidas. */
function crisp(material: StandardMaterial): void {
  const t = material.diffuseTexture as Texture | null;
  t?.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
  material.specularColor.set(0.08, 0.08, 0.08);
}

/** O poste da Kenney é azul-vivo no atlas; aqui vira o cinza-galvanizado dos postes procedurais. */
function galvanized(material: StandardMaterial): void {
  material.diffuseTexture = null;
  material.diffuseColor.set(0.6, 0.6, 0.58);
  material.specularColor.set(0.2, 0.2, 0.2);
}

async function place(scene: Scene, file: string, spots: KitPlacement[], scale: number, yawOffset: number,
  shadows: ShadowGenerator | null): Promise<number> {
  const tweak = file.startsWith('light-') ? galvanized : crisp;
  const sources: Mesh[] = await loadGlb(scene, `${base()}${file}.glb`, (m) => tweak(m));
  const made: AbstractMesh[] = [];
  for (const p of spots) {
    for (const source of sources) {
      const i = source.createInstance(`kit-${file}@${p.x.toFixed(1)},${p.z.toFixed(1)}`);
      i.position.set(p.x, CURB_H, p.z);
      i.rotationQuaternion = null;
      i.rotation.y = p.yaw + yawOffset;
      i.scaling.setAll(scale);
      i.isPickable = false;
      i.freezeWorldMatrix();
      made.push(i);
    }
  }
  if (shadows) for (const i of made) shadows.addShadowCaster(i, false);
  return made.length;
}

export async function populateKitProps(
  scene: Scene, shadows: ShadowGenerator, castShadows: boolean, stopSigns: KitPlacement[],
  onFallback: (what: 'street-lights') => void,
): Promise<KitStatus> {
  const status: KitStatus = { loaded: [], failed: [], instances: 0 };
  const jobs: [string, KitPlacement[], number, number, boolean, (() => void) | null][] = [
    // Poste procedural: 7,5 m, braço na direção (sin yaw, cos yaw). O da Kenney tem 0,675 u e braço em −z.
    ['light-curved', streetLightPositions(), 11, Math.PI, castShadows, () => onFallback('street-lights')],
    // Placa de 0,49 u → ≈2,5 m; a face vermelha (+x local após a conversão glTF) fica voltada para quem chega.
    ['road-sign-stop', stopSigns, 5, -Math.PI / 2, false, null],
  ];
  await Promise.all(jobs.map(async ([file, spots, scale, yaw, cast, fallback]) => {
    if (spots.length === 0) return;
    try {
      status.instances += await place(scene, file, spots, scale, yaw, cast ? shadows : null);
      status.loaded.push(file);
    } catch (error) {
      console.warn(`EXPERIMENTO kit: ${file} não carregou.`, error);
      status.failed.push(file);
      fallback?.();
    }
  }));
  return status;
}
