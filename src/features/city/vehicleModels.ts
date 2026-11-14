import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { ExtrudeShape } from '@babylonjs/core/Meshes/Builders/shapeBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { VEHICLE_SPECS, type VehicleKind } from '../../core/city/traffic';
import { BatchSet } from '../../world/geometry';
import type { LabMaterial, Materials } from '../../world/materials';
import { ballPart, boxPart, rodPart } from '../../world/modelParts';

/**
 * CORE-014 NPC vehicle models (replacing the CORE-013 block shapes): side profiles extruded across
 * the width give real silhouettes (bonnet, windscreen rake, roof, tail), with glazing, pillars,
 * bumpers, grilles, mirrors, plates, lamps and tyres with rims. Built once per kind and drawn as
 * thin instances; `body` takes the per-vehicle paint colour, `detail` keeps fixed colours.
 * Local axes: +z forward, +x right, y up, ground at 0.
 */
type ZY = readonly [number, number];

function prism(scene: Scene, set: BatchSet, mat: LabMaterial, profile: readonly ZY[], x0: number, x1: number): void {
  const shape = profile.map(([z, y]) => new Vector3(-z, y, 0));
  const m = ExtrudeShape('perfil', {
    shape, path: [new Vector3(x0, 0, 0), new Vector3(x1, 0, 0)], cap: Mesh.CAP_ALL, closeShape: true, sideOrientation: Mesh.DOUBLESIDE,
  }, scene);
  set.absorb(mat, m);
}

function wheel(scene: Scene, set: BatchSet, mats: Materials, x: number, z: number, r: number, w: number, side: number): void {
  const tyre = CreateCylinder('pneu', { diameter: r * 2, height: w, tessellation: 16 }, scene);
  tyre.rotation.z = Math.PI / 2; tyre.position.set(x, r, z);
  set.absorb(mats.paint('#1a1b1d'), tyre);
  const rim = CreateCylinder('aro', { diameter: r * 1.25, height: 0.02, tessellation: 14 }, scene);
  rim.rotation.z = Math.PI / 2; rim.position.set(x + side * (w / 2 + 0.005), r, z);
  set.absorb(mats.chrome('#b9bcc0'), rim);
  const hub = CreateCylinder('cubo', { diameter: r * 0.4, height: 0.03, tessellation: 8 }, scene);
  hub.rotation.z = Math.PI / 2; hub.position.set(x + side * (w / 2 + 0.015), r, z);
  set.absorb(mats.paint('#5d6166', 0.3), hub);
}

const box = (set: BatchSet, mat: LabMaterial, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) => set.box(mat, x0, x1, y0, y1, z0, z1);

export function buildVehicleModel(scene: Scene, mats: Materials, kind: VehicleKind): { body: BatchSet; detail: BatchSet } {
  const body = new BatchSet(); const detail = new BatchSet();
  // Body paint: lacquer shared by every NPC vehicle, tinted per instance.
  const paint = mats.npcLacquer('#ffffff');
  const glass = mats.npcLacquer('#1d2730');
  const trim = mats.paint('#2b2d31', 0.25);
  const plate = mats.paint('#f1f1ec');
  const head = mats.glow('#fff4d6'); const tail = mats.glow('#c4231c'); const amber = mats.glow('#ffb43a');
  const s = VEHICLE_SPECS[kind];
  const L = s.length / 2; const W = s.width / 2;
  if (kind === 'car') {
    // Saloon: chamfered lower body, glasshouse, roof panel, pillars.
    prism(scene, body, paint, [[L, 0.33], [L + 0.03, 0.6], [L - 0.2, 0.8], [0.85, 0.9], [-L + 0.45, 0.96], [-L, 0.86], [-L - 0.02, 0.42], [-L + 0.15, 0.3]], -W, W);
    prism(scene, detail, glass, [[0.86, 0.9], [0.1, 1.36], [-1.0, 1.37], [-1.62, 0.95]], -W + 0.1, W - 0.1);
    prism(scene, body, paint, [[0.16, 1.35], [0.1, 1.41], [-1.0, 1.42], [-1.08, 1.36]], -W + 0.12, W - 0.12);
    for (const sx of [-1, 1]) {
      box(body, paint, sx * (W - 0.11) - 0.02, sx * (W - 0.11) + 0.02, 0.92, 1.36, -0.48, -0.36); // B pillar
      box(detail, trim, sx * W - 0.01, sx * W + 0.01, 0.38, 0.9, 0.72, 0.75);                      // door cut lines
      box(detail, trim, sx * W - 0.01, sx * W + 0.01, 0.38, 0.9, -0.43, -0.4);
      box(detail, trim, sx * W - 0.012, sx * W + 0.012, 0.66, 0.69, 0.25, 0.4);                    // handles
      body.absorb(paint, boxPart(scene, [0.12, 0.08, 0.16], [sx * (W + 0.05), 0.98, 0.72]));       // mirrors
      detail.box(head, sx * (W - 0.42) - 0.24, sx * (W - 0.42) + 0.24, 0.6, 0.73, L - 0.02, L + 0.03);
      detail.box(tail, sx * (W - 0.32) - 0.26, sx * (W - 0.32) + 0.26, 0.68, 0.8, -L - 0.04, -L + 0.01);
    }
    box(detail, trim, -0.5, 0.5, 0.42, 0.58, L - 0.01, L + 0.04);            // grille
    box(detail, trim, -W + 0.02, W - 0.02, 0.28, 0.42, L - 0.05, L + 0.08);  // bumpers
    box(detail, trim, -W + 0.02, W - 0.02, 0.28, 0.44, -L - 0.08, -L + 0.05);
    box(detail, plate, -0.25, 0.25, 0.44, 0.56, L + 0.08, L + 0.09);
    box(detail, plate, -0.25, 0.25, 0.48, 0.6, -L - 0.09, -L - 0.08);
    for (const z of [L - 0.82, -L + 0.85]) for (const sx of [-1, 1]) wheel(scene, detail, mats, sx * (W - 0.12), z, 0.31, 0.21, sx);
  } else if (kind === 'van') {
    // Delivery van (CORE-010 yellow/black livery): sloped bonnet, tall load box, rear doors.
    prism(scene, body, paint, [[L, 0.36], [L + 0.02, 0.95], [L - 0.38, 1.3], [L - 1.05, 2.22], [-L + 0.05, 2.32], [-L, 2.22], [-L, 0.4], [-L + 0.15, 0.34]], -W, W);
    prism(scene, detail, glass, [[L - 0.36, 1.33], [L - 1.0, 2.18], [L - 1.1, 2.17], [L - 0.5, 1.33]], -W + 0.12, W - 0.12);
    for (const sx of [-1, 1]) {
      box(detail, glass, sx * W - 0.012, sx * W + 0.012, 1.36, 1.98, L - 1.85, L - 1.05);  // cab side windows
      box(detail, trim, sx * W - 0.015, sx * W + 0.015, 0.95, 1.12, -L + 0.3, L - 1.9);   // livery band
      box(detail, trim, sx * W - 0.01, sx * W + 0.01, 0.4, 2.2, L - 1.92, L - 1.88);
      body.absorb(paint, boxPart(scene, [0.1, 0.22, 0.12], [sx * (W + 0.07), 1.62, L - 0.95]));
      detail.box(head, sx * (W - 0.32) - 0.2, sx * (W - 0.32) + 0.2, 0.9, 1.06, L - 0.01, L + 0.04);
      detail.box(tail, sx * (W - 0.12) - 0.08, sx * (W - 0.12) + 0.08, 1.1, 1.7, -L - 0.04, -L + 0.01);
    }
    box(detail, trim, -0.01, 0.01, 0.42, 2.2, -L - 0.02, -L + 0.01);       // rear door split
    box(detail, trim, -0.6, 0.6, 0.55, 0.82, L, L + 0.04);
    box(detail, trim, -W + 0.02, W - 0.02, 0.3, 0.5, L - 0.05, L + 0.1);
    box(detail, trim, -W + 0.02, W - 0.02, 0.3, 0.5, -L - 0.1, -L + 0.05);
    box(detail, plate, -0.25, 0.25, 0.52, 0.64, -L - 0.11, -L - 0.1);
    for (const z of [L - 0.9, -L + 0.95]) for (const sx of [-1, 1]) wheel(scene, detail, mats, sx * (W - 0.14), z, 0.35, 0.23, sx);
  } else if (kind === 'truck') {
    // Light truck: blue cab, white box body with ribs, exposed chassis, six wheels.
    const cab = mats.npcLacquer('#2b5aa8');
    prism(scene, detail, cab, [[L, 0.6], [L + 0.02, 1.5], [L - 0.15, 2.8], [L - 0.45, 3.0], [L - 2.1, 3.0], [L - 2.1, 0.6]], -W + 0.05, W - 0.05);
    box(detail, glass, -W + 0.2, W - 0.2, 1.75, 2.65, L + 0.0, L + 0.03);
    prism(scene, body, paint, [[L - 2.25, 1.05], [L - 2.25, 3.62], [-L, 3.62], [-L, 1.05]], -W, W);
    for (let z = -L + 0.6; z < L - 2.4; z += 1.1) for (const sx of [-1, 1]) box(body, paint, sx * W - 0.02, sx * W + 0.02, 1.1, 3.58, z - 0.04, z + 0.04);
    for (const sx of [-1, 1]) {
      box(detail, glass, sx * (W - 0.05) - 0.01, sx * (W - 0.05) + 0.01, 1.8, 2.55, L - 1.2, L - 0.3);
      box(detail, trim, sx * (W + 0.12) - 0.02, sx * (W + 0.12) + 0.02, 2.0, 2.45, L - 0.35, L - 0.25); // mirrors
      detail.box(head, sx * (W - 0.35) - 0.18, sx * (W - 0.35) + 0.18, 0.95, 1.12, L + 0.01, L + 0.05);
      detail.box(tail, sx * (W - 0.3) - 0.15, sx * (W - 0.3) + 0.15, 1.15, 1.4, -L - 0.04, -L);
      detail.box(amber, sx * (W - 0.02) - 0.02, sx * (W - 0.02) + 0.02, 1.0, 1.08, L - 0.4, L - 0.25);
    }
    box(detail, trim, -0.5, 0.5, 0.42, 0.62, -L + 0.4, L - 1.0);           // chassis rails
    box(detail, trim, -W + 0.05, W - 0.05, 0.5, 0.78, L - 0.05, L + 0.12);
    box(detail, trim, -0.7, 0.7, 1.2, 1.6, L, L + 0.03);
    detail.absorb(mats.chrome('#b9bcc0'), rodPart(scene, [W - 0.35, 0.7, L - 1.2], [W - 0.35, 0.7, L - 2.2], 0.42, 0.42, 12)); // tank
    for (const z of [L - 1.15, -L + 2.4, -L + 1.25]) for (const sx of [-1, 1]) wheel(scene, detail, mats, sx * (W - 0.18), z, 0.5, 0.32, sx);
  } else if (kind === 'bus') {
    // City bus: rounded roof edge, window band with pillars, doors, route display.
    prism(scene, body, paint, [[L, 0.38], [L + 0.02, 2.75], [L - 0.15, 3.08], [-L + 0.15, 3.1], [-L, 2.9], [-L, 0.38]], -W, W);
    box(detail, glass, -W + 0.12, W - 0.12, 1.25, 2.6, L + 0.0, L + 0.04);
    box(detail, glass, -W + 0.15, W - 0.15, 1.5, 2.5, -L - 0.03, -L + 0.0);
    for (const sx of [-1, 1]) {
      box(detail, glass, sx * W - 0.012, sx * W + 0.012, 1.45, 2.55, -L + 0.5, L - 0.6);
      for (let z = -L + 0.5; z <= L - 0.6; z += 1.35) box(body, paint, sx * W - 0.02, sx * W + 0.02, 1.42, 2.58, z - 0.07, z + 0.07);
      box(detail, mats.paint('#f4f1ea'), sx * W - 0.015, sx * W + 0.015, 0.75, 0.95, -L + 0.2, L - 0.2);
      detail.box(head, sx * (W - 0.35) - 0.2, sx * (W - 0.35) + 0.2, 0.7, 0.86, L + 0.01, L + 0.05);
      detail.box(tail, sx * (W - 0.3) - 0.15, sx * (W - 0.3) + 0.15, 0.9, 1.35, -L - 0.04, -L);
      box(detail, trim, sx * (W + 0.1) - 0.02, sx * (W + 0.1) + 0.02, 2.1, 2.5, L - 0.1, L + 0.15);
    }
    // Doors on the kerb (right) side.
    for (const z of [L - 1.25, 0.2]) box(detail, glass, W - 0.005, W + 0.02, 0.45, 2.55, z - 0.6, z + 0.6);
    box(detail, amber, -0.8, 0.8, 2.66, 2.92, L + 0.01, L + 0.05);
    box(detail, trim, -W + 0.02, W - 0.02, 0.3, 0.6, L - 0.05, L + 0.1);
    box(detail, trim, -W + 0.02, W - 0.02, 0.3, 0.6, -L - 0.1, -L + 0.05);
    for (const z of [L - 2.3, -L + 2.5]) for (const sx of [-1, 1]) wheel(scene, detail, mats, sx * (W - 0.18), z, 0.5, 0.32, sx);
  } else {
    // Motorcycle or bicycle with a rider.
    const moto = kind === 'moto';
    const r = moto ? 0.3 : 0.34;
    for (const z of [L - r - 0.02, -L + r + 0.02]) {
      const tyre = CreateCylinder('pneu', { diameter: r * 2, height: moto ? 0.11 : 0.045, tessellation: 18 }, scene);
      tyre.rotation.z = Math.PI / 2; tyre.position.set(0, r, z);
      detail.absorb(mats.paint('#1a1b1d'), tyre);
      const rim = CreateCylinder('aro', { diameter: r * (moto ? 1.3 : 1.75), height: moto ? 0.12 : 0.05, tessellation: 14 }, scene);
      rim.rotation.z = Math.PI / 2; rim.position.set(0, r, z);
      detail.absorb(mats.chrome('#b9bcc0'), rim);
    }
    if (moto) {
      body.absorb(paint, ballPart(scene, [0.3, 0.22, 0.5], [0, 0.88, 0.25], 8));             // tank
      detail.absorb(mats.paint('#1f2023'), boxPart(scene, [0.26, 0.1, 0.62], [0, 0.86, -0.32])); // seat
      detail.absorb(mats.paint('#55595e', 0.3), boxPart(scene, [0.28, 0.3, 0.42], [0, 0.5, 0.05])); // engine
      detail.absorb(mats.chrome('#b9bcc0'), rodPart(scene, [0.16, 0.36, -0.1], [0.16, 0.42, -0.8], 0.07, 0.06, 8));
      detail.absorb(mats.paint('#2b2d31'), rodPart(scene, [0, 0.35, L - 0.32], [0, 1.0, L - 0.5], 0.05, 0.05, 6)); // fork
      body.absorb(paint, boxPart(scene, [0.14, 0.12, 0.45], [0, 0.58, -0.55]));            // tail
      detail.box(head, -0.08, 0.08, 0.92, 1.04, L - 0.42, L - 0.36);
      detail.box(tail, -0.06, 0.06, 0.72, 0.8, -L + 0.08, -L + 0.12);
    } else {
      body.absorb(paint, rodPart(scene, [0, 0.62, -0.25], [0, 0.66, 0.42], 0.04, 0.04, 6));
      body.absorb(paint, rodPart(scene, [0, 0.36, -0.05], [0, 0.66, 0.42], 0.035, 0.035, 6));
      body.absorb(paint, rodPart(scene, [0, 0.36, -0.05], [0, 0.82, -0.3], 0.035, 0.035, 6));
      detail.absorb(mats.paint('#1f2023'), boxPart(scene, [0.12, 0.05, 0.24], [0, 0.86, -0.32]));
    }
    // Rider: jacket, trousers, arms to the bars, helmet.
    const seat = moto ? 0.92 : 0.9; const z0 = moto ? -0.25 : -0.22;
    const jacket = mats.paint(moto ? '#2d3036' : '#d8a032');
    detail.absorb(jacket, rodPart(scene, [0, seat + 0.05, z0], [0, seat + 0.6, z0 + 0.12], 0.36, 0.3, 10));
    for (const sx of [-1, 1]) {
      detail.absorb(mats.paint('#2d3a55'), rodPart(scene, [sx * 0.1, seat, z0], [sx * 0.13, seat - 0.05, z0 + 0.45], 0.14, 0.12, 8));
      detail.absorb(mats.paint('#2d3a55'), rodPart(scene, [sx * 0.13, seat - 0.05, z0 + 0.45], [sx * 0.15, 0.35, z0 + 0.5], 0.11, 0.09, 8));
      detail.absorb(jacket, rodPart(scene, [sx * 0.18, seat + 0.52, z0 + 0.12], [sx * 0.24, seat + 0.18, L - 0.55], 0.08, 0.07, 6));
    }
    detail.absorb(mats.npcLacquer(moto ? '#c9302c' : '#2b5aa8'), ballPart(scene, [0.28, 0.28, 0.3], [0, seat + 0.78, z0 + 0.15], 9));
    detail.absorb(mats.npcLacquer('#121619'), ballPart(scene, [0.22, 0.1, 0.16], [0, seat + 0.78, z0 + 0.25], 6));
  }
  return { body, detail };
}
