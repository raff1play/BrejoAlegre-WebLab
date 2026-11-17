import { Color3 } from '@babylonjs/core/Maths/math.color';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Scene } from '@babylonjs/core/scene';
import { parcelSizeClass } from '../../core/delivery/carTrunk';
import type { Parcel, Platform, Stowage } from '../../core/delivery/parcels';
import { SEAT_BACK_Z, TRUNK_FLOOR_Y, TRUNK_HALF_W } from './playerCar';

/**
 * B1-01 F3 (AC-06): one 3D box per parcel in the car boot. Presentation ONLY: every frame it reads
 * the parcels whose own `place` is `'porta-malas'` and puts a box exactly at their `stowage` slot.
 * It keeps no count and no list of its own beyond the meshes it draws; a parcel that leaves the
 * boot loses its box, a parcel that comes in gets one, with its ID printed on the label.
 */
type BoxView = { mesh: Mesh; label: Mesh; texture: DynamicTexture; key: string; extents: string };
const CARD: Readonly<Record<Platform, string>> = { ML: '#c9a46a', SHP: '#b98a57', LOJA: '#a8875e' };
const TAPE: Readonly<Record<Platform, string>> = { ML: '#f2d23c', SHP: '#ee6a2c', LOJA: '#d8d2c4' };

/** Car-local centre of a slot (boot frame → car body frame). */
export function slotCentre(s: Pick<Stowage, 'x' | 'y' | 'z' | 'w' | 'h' | 'd'>): { x: number; y: number; z: number } {
  return { x: -TRUNK_HALF_W + s.x + s.w / 2, y: TRUNK_FLOOR_Y + s.y + s.h / 2, z: SEAT_BACK_Z - (s.z + s.d / 2) };
}

export class CarCargoView {
  private readonly boxes = new Map<string, BoxView>();
  private readonly materials = new Map<Platform, StandardMaterial>();
  private readonly scene: Scene;
  private readonly parent: TransformNode;
  private readonly vehicleId: string;

  constructor(scene: Scene, parent: TransformNode, vehicleId: string) {
    this.scene = scene; this.parent = parent; this.vehicleId = vehicleId;
  }

  private material(platform: Platform): StandardMaterial {
    let m = this.materials.get(platform);
    if (!m) {
      m = new StandardMaterial(`caixa-${platform}`, this.scene);
      m.diffuseColor = Color3.FromHexString(CARD[platform]); m.specularColor = new Color3(0.05, 0.05, 0.05);
      this.materials.set(platform, m);
    }
    return m;
  }

  private create(p: Parcel, s: Stowage): BoxView {
    const mesh = CreateBox(`caixa-${p.id}`, { width: s.w, height: s.h, depth: s.d }, this.scene);
    mesh.material = this.material(p.platform); mesh.parent = this.parent; mesh.isPickable = false;
    mesh.metadata = { parcelId: p.id };
    // Label on the top face: the parcel's own ID, the platform tape colour and its size class.
    const texture = new DynamicTexture(`etiqueta-${p.id}`, { width: 128, height: 64 }, this.scene, false);
    const g = texture.getContext() as unknown as CanvasRenderingContext2D;
    g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, 128, 64);
    g.fillStyle = TAPE[p.platform]; g.fillRect(0, 0, 128, 12);
    g.fillStyle = '#1d1f22'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(p.id, 64, 34); g.font = '12px sans-serif'; g.fillText(`${p.platform} · ${parcelSizeClass(p.id)}`, 64, 54);
    texture.update();
    const mat = new StandardMaterial(`etiqueta-${p.id}`, this.scene);
    mat.diffuseTexture = texture; mat.specularColor = new Color3(0, 0, 0); mat.emissiveColor = new Color3(0.25, 0.25, 0.25);
    const label = CreatePlane(`etiqueta-${p.id}`, { width: Math.min(s.w, s.d) * 0.9, height: Math.min(s.w, s.d) * 0.45 }, this.scene);
    label.material = mat; label.parent = mesh; label.isPickable = false; label.rotation.x = Math.PI / 2;
    return { mesh, label, texture, key: '', extents: `${s.w},${s.h},${s.d}` };
  }

  /** Mirrors the domain: one box per parcel in THIS car's boot, at its slot. Cheap when nothing changed. */
  update(parcels: readonly Parcel[]): void {
    const seen = new Set<string>();
    for (const p of parcels) {
      const s = p.stowage;
      if (p.place !== 'porta-malas' || !s || s.vehicleId !== this.vehicleId) continue;
      seen.add(p.id);
      const key = `${s.x},${s.y},${s.z},${s.w},${s.h},${s.d}`;
      let view = this.boxes.get(p.id);
      // Same box re-arranged and turned (w ⇄ d): rebuild its mesh with the new extents.
      if (view && view.extents !== `${s.w},${s.h},${s.d}`) { this.dispose(p.id); view = undefined; }
      if (!view) { view = this.create(p, s); this.boxes.set(p.id, view); }
      if (view.key !== key) {
        const c = slotCentre(s);
        view.mesh.position.set(c.x, c.y, c.z);
        view.label.position.set(0, s.h / 2 + 0.002, 0);
        view.key = key;
      }
    }
    for (const id of [...this.boxes.keys()]) if (!seen.has(id)) this.dispose(id);
  }

  private dispose(id: string): void {
    const v = this.boxes.get(id);
    if (!v) return;
    v.label.material?.dispose(); v.texture.dispose(); v.label.dispose(); v.mesh.dispose();
    this.boxes.delete(id);
  }

  /** What is actually drawn (for the browser test): IDs, car-local centres and box extents. */
  drawn(): { id: string; centre: { x: number; y: number; z: number }; size: { w: number; h: number; d: number }; world: { x: number; y: number; z: number } }[] {
    return [...this.boxes.entries()].map(([id, v]) => {
      v.mesh.computeWorldMatrix(true);
      const b = v.mesh.getBoundingInfo().boundingBox;
      const w = v.mesh.getAbsolutePosition();
      return { id, centre: { x: v.mesh.position.x, y: v.mesh.position.y, z: v.mesh.position.z }, size: { w: b.extendSize.x * 2, h: b.extendSize.y * 2, d: b.extendSize.z * 2 }, world: { x: w.x, y: w.y, z: w.z } };
    });
  }
}
