import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { GraphicsProfile } from '../../config/graphics';
import { buildHouse, placement } from '../../world/buildings';
import { BatchSet } from '../../world/geometry';
import { HOUSE_DEPTH, HOUSE_STYLES, HOUSE_WALL_H, framePoint, houseSpan, type HouseSpec } from '../../world/layout';
import type { Materials } from '../../world/materials';
import { CITY_LOTS, type CityLot } from '../../world/city/cityPlan';

/**
 * CORE-015 sector streaming of the ~600 estimated house lots of the real town. Every lot always
 * has a cheap far-LOD volume (walls, hip roof, front wall) merged per 100 m sector; the detailed
 * W009/CORE-010 house is built only for sectors near the player and disposed when it is left
 * behind, so the whole town is never held in full detail.
 */
const SECTOR = 100;
type Sector = { key: string; cx: number; cz: number; lots: CityLot[]; lod: Mesh[]; detail: Mesh[] | null };

export function specOf(l: CityLot): HouseSpec {
  const style = HOUSE_STYLES[l.style % HOUSE_STYLES.length]!;
  const setback = Math.min(style.setback, Math.max(1.5, l.depth - HOUSE_DEPTH - 0.5));
  return { ...style, setback, id: l.id, frame: l.frame, lotWidth: l.width, lotDepth: l.depth };
}

export class HouseStreamer {
  private readonly sectors: Sector[] = [];
  private readonly near: number;
  private readonly far: number;
  private budget = 0;

  constructor(private readonly scene: Scene, private readonly mats: Materials, profile: GraphicsProfile, private readonly shadows: ShadowGenerator | null) {
    this.near = profile.name === 'mobile' ? 95 : 150;
    this.far = this.near + 70;
    const map = new Map<string, Sector>();
    for (const l of CITY_LOTS) {
      const m = framePoint(l.frame, l.width / 2, l.depth / 2);
      const i = Math.floor(m.x / SECTOR); const j = Math.floor(m.z / SECTOR);
      const key = `${i},${j}`;
      let s = map.get(key);
      if (!s) { s = { key, cx: (i + 0.5) * SECTOR, cz: (j + 0.5) * SECTOR, lots: [], lod: [], detail: null }; map.set(key, s); }
      s.lots.push(l);
    }
    for (const s of map.values()) { s.lod = this.buildLod(s); this.sectors.push(s); }
  }

  /** Far LOD: plaster box, hip roof in tile colour and a front wall, per lot; one mesh per material. */
  private buildLod(s: Sector): Mesh[] {
    const set = new BatchSet();
    for (const l of s.lots) {
      const spec = specOf(l);
      set.setTransform(placement(l.frame));
      const [x0, x1] = houseSpan(spec);
      const z0 = spec.setback; const z1 = z0 + HOUSE_DEPTH;
      set.box(this.mats.plaster(spec.wallColor), x0, x1, 0, HOUSE_WALL_H, z0, z1, { fitV: true });
      set.box(this.mats.paint(spec.gateColor, 0.2), 0, l.width, 0, 1.9, 0, 0.18);
      const roof = CreateCylinder('telhado-lod', { diameterTop: 0, diameterBottom: 1, height: 1, tessellation: 4 }, this.scene);
      roof.scaling.set((x1 - x0) * 1.42, 1.7, HOUSE_DEPTH * 1.42);
      roof.rotation.y = Math.PI / 4;
      roof.position.set((x0 + x1) / 2, HOUSE_WALL_H + 0.85, (z0 + z1) / 2);
      set.absorb(this.mats.roofTiles, roof);
    }
    set.setTransform(null);
    const meshes = set.build(`casas-lod-${s.key}`, this.scene);
    for (const m of meshes) { m.freezeWorldMatrix(); m.isPickable = false; }
    return meshes;
  }

  private buildDetail(s: Sector): Mesh[] {
    const shared = { flat: new BatchSet(), upright: new BatchSet() };
    const bodies: Mesh[] = [];
    for (const l of s.lots) bodies.push(...buildHouse(this.scene, this.mats, specOf(l), shared).body);
    const meshes = [...bodies, ...shared.flat.build(`casas-chao-${s.key}`, this.scene), ...shared.upright.build(`casas-${s.key}`, this.scene)];
    for (const m of meshes) {
      m.computeWorldMatrix(true); m.freezeWorldMatrix(); m.isPickable = false;
      if (this.shadows) this.shadows.addShadowCaster(m, false);
    }
    return meshes;
  }

  /** Builds at most one detailed sector per call (spreads the cost); `force` builds all due now. */
  update(x: number, z: number, force = false): void {
    this.budget = force ? 1000 : 1;
    const order = [...this.sectors].sort((a, b) => Math.hypot(a.cx - x, a.cz - z) - Math.hypot(b.cx - x, b.cz - z));
    for (const s of order) {
      const d = Math.hypot(s.cx - x, s.cz - z) - SECTOR * 0.7;
      if (d < this.near && !s.detail && this.budget > 0) {
        s.detail = this.buildDetail(s);
        for (const m of s.lod) m.setEnabled(false);
        this.budget--;
      } else if (d > this.far && s.detail) {
        for (const m of s.detail) { this.shadows?.removeShadowCaster(m, false); m.dispose(); }
        s.detail = null;
        for (const m of s.lod) m.setEnabled(true);
      }
    }
  }

  stats(): { sectors: number; detailed: number; lots: number } {
    return { sectors: this.sectors.length, detailed: this.sectors.filter((s) => s.detail).length, lots: CITY_LOTS.length };
  }
}
