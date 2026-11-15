import type { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { approach, segmentIntersectsBox, type Box3D } from '../../core/math';

const FADED = 0.2;

/**
 * Keeps the player visible: any building whose volume crosses the line from the camera to the
 * player becomes translucent and returns to solid once it is out of the way.
 */
export class OcclusionFader {
  private readonly levels: number[];

  constructor(private readonly occluders: readonly { box: Box3D; meshes: Mesh[] }[]) {
    this.levels = occluders.map(() => 1);
  }

  /** Number of buildings currently faded, for the HUD and tests. */
  get fadedCount(): number { return this.levels.filter((level) => level < 0.6).length; }

  update(dt: number, eye: Vector3, target: Vector3): void {
    this.occluders.forEach((occluder, i) => {
      const hidden = segmentIntersectsBox(eye, target, occluder.box);
      const wanted = hidden ? FADED : 1;
      const current = this.levels[i]!;
      if (Math.abs(current - wanted) < 0.004) {
        if (current === wanted) return;
        this.levels[i] = wanted;
      } else {
        this.levels[i] = approach(current, wanted, 9, dt);
      }
      for (const mesh of occluder.meshes) mesh.visibility = this.levels[i]!;
    });
  }
}
