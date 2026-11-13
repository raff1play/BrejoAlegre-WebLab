import '@babylonjs/core/Meshes/thinInstanceMesh';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix } from '@babylonjs/core/Maths/math.vector';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Constants } from '@babylonjs/core/Engines/constants';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { activityAt } from '../../core/city/clock';
import { Crowd } from '../../core/city/pedestrians';
import { buildRoadGraph, type RoadGraph } from '../../core/city/roadGraph';
import { buildSignalPlans, signalState, type SignalPlan } from '../../core/city/signals';
import { Traffic, VEHICLE_SPECS, type VehicleKind } from '../../core/city/traffic';
import type { GraphicsProfile } from '../../config/graphics';
import { BatchSet } from '../../world/geometry';
import type { Materials } from '../../world/materials';
import { CURB_H, ROAD_HALF } from '../../world/layout';
import { LANE_OFFSET, NODES, nodeById } from '../../world/city/cityPlan';
import { streetLightPositions } from '../../world/city/cityLayout';

/**
 * CORE-013 presentation of the living city: thin-instanced vehicles (one draw call per prototype
 * material), pedestrians (torso, head, two swinging legs), live traffic-signal lamps and night
 * light pools. The rules live in core/city; this file only builds meshes and copies poses.
 */
const KINDS: VehicleKind[] = ['car', 'moto', 'bike', 'van', 'truck', 'bus'];
const PALETTE: Record<VehicleKind, string[]> = {
  car: ['#c9302c', '#f4f1ea', '#2b5aa8', '#3d3f44', '#b8bcc2', '#1f6a45', '#e3b23c', '#7a1f2b'],
  moto: ['#c9302c', '#20242a', '#2b5aa8', '#f4f1ea'],
  bike: ['#2b8a5b', '#c9302c', '#2b5aa8', '#e3b23c'],
  van: ['#f2c230'],
  truck: ['#f4f1ea', '#d9d4c7'],
  bus: ['#2f7d4f', '#2b5aa8'],
};
const SHIRTS = ['#c9302c', '#2b5aa8', '#f4f1ea', '#e3b23c', '#1f8a5b', '#7a3f8f', '#f08a4b', '#3d3f44', '#8fc1e3', '#d94f7a'];
const PANTS = ['#2d3a55', '#3d3f44', '#6b5a45', '#20242a', '#8c8f94'];
const SKINS = ['#f0c8a0', '#d9a273', '#a8714a', '#6e4529'];

type Proto = { meshes: Mesh[]; tinted: Mesh[]; beams: Mesh; matrices: Float32Array; colors: Float32Array };

function hex(c: string): [number, number, number] { const k = Color3.FromHexString(c); return [k.r, k.g, k.b]; }

function wheel(scene: Scene, set: BatchSet, mats: Materials, x: number, z: number, r: number, w: number): void {
  const t = CreateCylinder('roda', { diameter: r * 2, height: w, tessellation: 10 }, scene);
  t.rotation.z = Math.PI / 2;
  t.position.set(x, r, z);
  set.absorb(mats.paint('#1b1c1e'), t);
}

function rider(set: BatchSet, mats: Materials, z: number, seat: number, shirt: string): void {
  set.box(mats.paint(shirt), -0.2, 0.2, seat, seat + 0.62, z - 0.14, z + 0.14);
  set.box(mats.paint('#2d3a55'), -0.18, 0.18, seat - 0.12, seat + 0.05, z - 0.1, z + 0.45);
  set.box(mats.paint('#f0c8a0'), -0.11, 0.11, seat + 0.66, seat + 0.9, z - 0.1, z + 0.1);
  set.box(mats.paint('#20242a', 0.3), -0.14, 0.14, seat + 0.8, seat + 0.98, z - 0.14, z + 0.14);
}

/** Builds body (instance-tinted), details and lamps for one vehicle kind, in local metres (z forward). */
function buildVehicle(scene: Scene, mats: Materials, kind: VehicleKind): { body: BatchSet; detail: BatchSet } {
  const body = new BatchSet(); const detail = new BatchSet();
  const white = mats.paint('#ffffff', 0.2);
  const glass = mats.paint('#2a343c', 0.4);
  const dark = mats.paint('#2a2b2e');
  const head = mats.glow('#fff4d6'); const tail = mats.glow('#c4231c');
  const s = VEHICLE_SPECS[kind];
  const L = s.length / 2; const W = s.width / 2;
  if (kind === 'car') {
    body.box(white, -W, W, 0.32, 0.86, -L, L);
    body.box(white, -W + 0.1, W - 0.1, 0.86, 1.36, -L + 1.0, L - 1.25);
    detail.box(glass, -W + 0.12, W - 0.12, 0.9, 1.3, L - 1.27, L - 1.2);
    detail.box(glass, -W + 0.12, W - 0.12, 0.9, 1.3, -L + 0.95, -L + 1.02);
    detail.box(glass, -W + 0.08, W - 0.08, 0.92, 1.28, -L + 1.1, L - 1.35);
    detail.box(dark, -W, W, 0.22, 0.42, L - 0.05, L + 0.05);
    detail.box(dark, -W, W, 0.22, 0.42, -L - 0.05, -L + 0.05);
    for (const x of [-W + 0.25, W - 0.25]) { detail.box(head, x - 0.18, x + 0.18, 0.62, 0.74, L, L + 0.03); detail.box(tail, x - 0.18, x + 0.18, 0.64, 0.76, -L - 0.03, -L); }
    for (const z of [L - 0.8, -L + 0.8]) for (const x of [-W + 0.1, W - 0.1]) wheel(scene, detail, mats, x, z, 0.31, 0.22);
  } else if (kind === 'van') {
    body.box(white, -W, W, 0.34, 2.3, -L, L - 0.9);
    body.box(white, -W, W, 0.34, 1.3, L - 0.9, L);
    detail.box(glass, -W + 0.05, W - 0.05, 1.32, 2.1, L - 0.95, L - 0.4);
    detail.box(dark, -W - 0.01, W + 0.01, 0.9, 1.1, -L + 0.3, L - 1.2); // livery band
    detail.box(dark, -W, W, 0.24, 0.44, L - 0.05, L + 0.05);
    for (const x of [-W + 0.25, W - 0.25]) { detail.box(head, x - 0.17, x + 0.17, 0.95, 1.1, L, L + 0.03); detail.box(tail, x - 0.12, x + 0.12, 1.1, 1.6, -L - 0.03, -L); }
    for (const z of [L - 0.9, -L + 0.9]) for (const x of [-W + 0.12, W - 0.12]) wheel(scene, detail, mats, x, z, 0.34, 0.24);
  } else if (kind === 'truck') {
    body.box(white, -W, W, 1.05, 3.6, -L, L - 2.4);
    const cab = mats.paint('#2b5aa8', 0.2);
    detail.box(cab, -W + 0.05, W - 0.05, 0.6, 2.9, L - 2.2, L);
    detail.box(glass, -W + 0.12, W - 0.12, 1.8, 2.6, L, L + 0.02);
    detail.box(dark, -W + 0.1, W - 0.1, 0.5, 1.05, -L + 0.2, L - 2.3);
    for (const x of [-W + 0.3, W - 0.3]) { detail.box(head, x - 0.18, x + 0.18, 0.85, 1.0, L + 0.01, L + 0.04); detail.box(tail, x - 0.15, x + 0.15, 1.1, 1.4, -L - 0.03, -L); }
    for (const z of [L - 1.2, -L + 2.2, -L + 1.0]) for (const x of [-W + 0.15, W - 0.15]) wheel(scene, detail, mats, x, z, 0.48, 0.32);
  } else if (kind === 'bus') {
    body.box(white, -W, W, 0.38, 3.1, -L, L);
    detail.box(glass, -W - 0.01, W + 0.01, 1.45, 2.45, -L + 0.8, L - 0.5);
    detail.box(glass, -W + 0.1, W - 0.1, 1.2, 2.6, L, L + 0.02);
    detail.box(mats.paint('#f4f1ea'), -W - 0.02, W + 0.02, 2.6, 2.75, -L + 0.2, L - 0.2);
    detail.box(mats.glow('#ffb43a'), -0.7, 0.7, 2.75, 2.95, L + 0.01, L + 0.04); // route display
    for (const x of [-W + 0.3, W - 0.3]) { detail.box(head, x - 0.2, x + 0.2, 0.7, 0.86, L + 0.01, L + 0.04); detail.box(tail, x - 0.15, x + 0.15, 0.9, 1.3, -L - 0.03, -L); }
    for (const z of [L - 2.2, -L + 2.4]) for (const x of [-W + 0.15, W - 0.15]) wheel(scene, detail, mats, x, z, 0.5, 0.32);
  } else {
    // Two-wheelers: tinted frame/tank, rider in fixed colours, simplified.
    const moto = kind === 'moto';
    const r = moto ? 0.3 : 0.33;
    body.box(white, -0.12, 0.12, moto ? 0.42 : 0.5, moto ? 0.78 : 0.62, -L + 0.4, L - 0.4);
    if (moto) body.box(white, -0.18, 0.18, 0.62, 0.9, -0.1, 0.45);
    wheel(scene, detail, mats, 0, L - r - 0.02, r, moto ? 0.12 : 0.05);
    wheel(scene, detail, mats, 0, -L + r + 0.02, r, moto ? 0.12 : 0.05);
    rider(detail, mats, moto ? -0.2 : -0.15, moto ? 0.82 : 0.95, moto ? '#3d3f44' : '#e3b23c');
    if (moto) { detail.box(head, -0.08, 0.08, 0.85, 0.97, L - 0.25, L - 0.2); detail.box(tail, -0.06, 0.06, 0.7, 0.8, -L - 0.02, -L + 0.02); }
  }
  return { body, detail };
}

export type CityLife = {
  traffic: Traffic; crowd: Crowd; graph: RoadGraph; plans: Map<string, SignalPlan>;
  update(dt: number, time: number, hour: number, night: number, player: { x: number; z: number; radius: number }, ground: (x: number, z: number) => number): void;
  blocks(x: number, z: number, r: number): boolean;
  stats(): { vehicles: number; moving: number; pedestrians: number; visiblePedestrians: number; byKind: Record<string, number>; signals: Record<string, string>; vehicleIds: number[]; fingerprint: number };
};

export function buildCityLife(scene: Scene, mats: Materials, profile: GraphicsProfile, shadows: ShadowGenerator, free: (x: number, z: number) => boolean): CityLife {
  const graph = buildRoadGraph();
  const plans = buildSignalPlans(graph);
  const light = profile.name === 'mobile';
  const traffic = new Traffic(graph, plans, { capacity: light ? 16 : 28, vans: 3, trucks: light ? 1 : 2, buses: 2 });
  const crowd = new Crowd(light ? 26 : 48, free);
  const MAXV = 64; const MAXP = 72;

  // Night beams: additive, unlit; only enabled after dusk.
  const beamMat = new StandardMaterial('farol-feixe', scene);
  beamMat.disableLighting = true;
  beamMat.emissiveColor = new Color3(0.55, 0.48, 0.3);
  beamMat.alpha = 0.55;
  beamMat.alphaMode = Constants.ALPHA_ADD;
  beamMat.backFaceCulling = false;
  beamMat.fogEnabled = true;

  const protos = new Map<VehicleKind, Proto>();
  for (const kind of KINDS) {
    const { body, detail } = buildVehicle(scene, mats, kind);
    const tinted = body.build(`npc-${kind}-carroceria`, scene);
    const rest = detail.build(`npc-${kind}`, scene);
    const s = VEHICLE_SPECS[kind];
    const beam = CreateDisc(`npc-${kind}-feixe`, { radius: 1, tessellation: 10 }, scene);
    beam.rotation.x = Math.PI / 2;
    beam.scaling.set(s.width * 0.9, 3.2, 1);
    beam.position.set(0, 0.03, s.length / 2 + 3);
    beam.bakeCurrentTransformIntoVertices();
    beam.material = beamMat;
    const proto: Proto = { meshes: [...tinted, ...rest, beam], tinted, beams: beam, matrices: new Float32Array(MAXV * 16), colors: new Float32Array(MAXV * 4) };
    for (const m of proto.meshes) {
      m.thinInstanceSetBuffer('matrix', proto.matrices, 16, false);
      m.thinInstanceCount = 0;
      m.isPickable = false;
      m.alwaysSelectAsActiveMesh = true; // instances span the town; per-instance culling is not worth it
    }
    for (const m of tinted) m.thinInstanceSetBuffer('color', proto.colors, 4, false);
    for (const m of [...tinted, ...rest]) { m.receiveShadows = true; if (!light || kind === 'bus' || kind === 'truck') shadows.addShadowCaster(m, false); }
    protos.set(kind, proto);
  }

  // Pedestrians: torso + arms (shirt), head (skin), one leg mesh instanced twice (trousers).
  const torso = new BatchSet(); const headSet = new BatchSet(); const legSet = new BatchSet();
  const w = mats.paint('#ffffff');
  torso.box(w, -0.21, 0.21, 0.84, 1.42, -0.12, 0.12);
  torso.box(w, -0.29, -0.21, 0.86, 1.38, -0.07, 0.07);
  torso.box(w, 0.21, 0.29, 0.86, 1.38, -0.07, 0.07);
  headSet.box(w, -0.1, 0.1, 1.44, 1.68, -0.11, 0.11);
  headSet.box(mats.paint('#3a2a20'), -0.11, 0.11, 1.62, 1.72, -0.12, 0.1); // hair (dark × skin)
  legSet.box(w, -0.08, 0.08, -0.86, 0, -0.08, 0.08);
  const pedMeshes = [...torso.build('npc-pessoa-tronco', scene), ...headSet.build('npc-pessoa-cabeca', scene)];
  const legMeshes = legSet.build('npc-pessoa-perna', scene);
  const pedMatrices = new Float32Array(MAXP * 16); const shirtCol = new Float32Array(MAXP * 4); const skinCol = new Float32Array(MAXP * 4);
  const legMatrices = new Float32Array(MAXP * 2 * 16); const legCol = new Float32Array(MAXP * 2 * 4);
  const torsoMeshes = pedMeshes.filter((m) => m.name.includes('tronco'));
  const headMeshes = pedMeshes.filter((m) => m.name.includes('cabeca'));
  for (const m of [...pedMeshes, ...legMeshes]) {
    m.thinInstanceSetBuffer('matrix', legMeshes.includes(m) ? legMatrices : pedMatrices, 16, false);
    m.thinInstanceCount = 0; m.isPickable = false; m.alwaysSelectAsActiveMesh = true; m.receiveShadows = true;
    if (!light) shadows.addShadowCaster(m, false);
  }
  for (const m of torsoMeshes) m.thinInstanceSetBuffer('color', shirtCol, 4, false);
  for (const m of headMeshes) m.thinInstanceSetBuffer('color', skinCol, 4, false);
  for (const m of legMeshes) m.thinInstanceSetBuffer('color', legCol, 4, false);

  // Traffic signals: poles and housings are static; lamps are thin instances recoloured per frame.
  const poles = new BatchSet();
  const lampSet = new BatchSet();
  lampSet.box(mats.glow('#ffffff'), -0.11, 0.11, -0.11, 0.11, 0, 0.04);
  const lamps = lampSet.build('semaforo-luz', scene);
  type Head = { plan: SignalPlan; lane: number; ped: boolean; base: number };
  const heads: Head[] = [];
  const lampMatrices: number[] = [];
  const grey = mats.paint('#3a3d40', 0.2); const housing = mats.paint('#202326', 0.2);
  const tmp = Matrix.Identity();
  const pushLamp = (x: number, y: number, z: number, yaw: number) => {
    Matrix.RotationYToRef(yaw, tmp);
    tmp.setTranslationFromFloats(x, y, z);
    lampMatrices.push(...tmp.asArray());
  };
  for (const plan of plans.values()) {
    const n = nodeById(plan.node);
    for (const laneIndex of plan.approaches) {
      const lane = graph.lanes[laneIndex]!;
      const end = lane.path.points[1]!;
      const r = { x: lane.dir.z, z: -lane.dir.x };
      const k = ROAD_HALF + 0.55 - LANE_OFFSET;
      const px = end.x + r.x * k; const pz = end.z + r.z * k;
      const yaw = Math.atan2(-lane.dir.x, -lane.dir.z); // lamps face the approaching traffic
      poles.box(grey, px - 0.06, px + 0.06, CURB_H, CURB_H + 3.6, pz - 0.06, pz + 0.06);
      const fx = -lane.dir.x; const fz = -lane.dir.z;
      poles.box(housing, px - 0.17 + fx * 0.1, px + 0.17 + fx * 0.1, CURB_H + 2.35, CURB_H + 3.45, pz - 0.17 + fz * 0.1, pz + 0.17 + fz * 0.1);
      heads.push({ plan, lane: laneIndex, ped: false, base: lampMatrices.length / 16 });
      for (const y of [3.2, 2.9, 2.6]) pushLamp(px + fx * 0.28, CURB_H + y, pz + fz * 0.28, yaw);
    }
    // One pedestrian lamp on each corner, facing the opposite kerb.
    for (const e of crowd.graph.edges) {
      if (!e.cross || e.cross.node !== n.id) continue;
      for (const [a, b] of [[e.a, e.b], [e.b, e.a]] as const) {
        const pa = crowd.graph.points[a]!; const pb = crowd.graph.points[b]!;
        const dx = pb.x - pa.x; const dz = pb.z - pa.z; const L = Math.hypot(dx, dz);
        const ox = pa.x - (dx / L) * 0.4 + (dz / L) * 0.9; const oz = pa.z - (dz / L) * 0.4 - (dx / L) * 0.9;
        poles.box(grey, ox - 0.05, ox + 0.05, CURB_H, CURB_H + 2.5, oz - 0.05, oz + 0.05);
        poles.box(housing, ox - 0.15, ox + 0.15, CURB_H + 2.0, CURB_H + 2.5, oz - 0.15, oz + 0.15);
        heads.push({ plan, lane: -1, ped: true, base: lampMatrices.length / 16 });
        pushLamp(ox + (dx / L) * 0.16, CURB_H + 2.25, oz + (dz / L) * 0.16, Math.atan2(dx, dz));
      }
    }
  }
  const poleMeshes = poles.build('semaforos', scene);
  for (const m of poleMeshes) { m.freezeWorldMatrix(); shadows.addShadowCaster(m, false); }
  const lampMatrixBuffer = new Float32Array(lampMatrices);
  const lampColors = new Float32Array((lampMatrixBuffer.length / 16) * 4);
  for (const m of lamps) {
    m.thinInstanceSetBuffer('matrix', lampMatrixBuffer, 16, true);
    m.thinInstanceSetBuffer('color', lampColors, 4, false);
    m.isPickable = false; m.alwaysSelectAsActiveMesh = true;
  }

  // Warm light pools under street lamps, additive, only at night.
  const poolMat = new StandardMaterial('poca-de-luz', scene);
  poolMat.disableLighting = true; poolMat.emissiveColor = new Color3(0.42, 0.33, 0.18); poolMat.alphaMode = Constants.ALPHA_ADD; poolMat.alpha = 1;
  const poolSet = new BatchSet();
  const poolLab = { ...mats.glow('#ffffff') };
  for (const p of streetLightPositions()) {
    const d = CreateDisc('poca', { radius: 5.5, tessellation: 18 }, scene);
    d.rotation.x = Math.PI / 2;
    d.position.set(p.x + Math.sin(p.yaw) * 1.6, 0.03, p.z + Math.cos(p.yaw) * 1.6);
    poolSet.absorb(poolLab, d);
  }
  const pools = poolSet.build('pocas-luz', scene);
  for (const m of pools) { m.material = poolMat; m.isPickable = false; m.receiveShadows = false; m.freezeWorldMatrix(); m.setEnabled(false); }

  const lampOff = [0.12, 0.1, 0.09];
  const RED = [1, 0.16, 0.1]; const YELLOW = [1, 0.72, 0.1]; const GREEN = [0.2, 1, 0.45];
  const setLamp = (i: number, c: number[], on: boolean) => {
    lampColors[i * 4] = on ? c[0]! : lampOff[0]!; lampColors[i * 4 + 1] = on ? c[1]! : lampOff[1]!; lampColors[i * 4 + 2] = on ? c[2]! : lampOff[2]!; lampColors[i * 4 + 3] = 1;
  };
  const writeColor = (buf: Float32Array, i: number, c: [number, number, number]) => { buf[i * 4] = c[0]; buf[i * 4 + 1] = c[1]; buf[i * 4 + 2] = c[2]; buf[i * 4 + 3] = 1; };
  const palettes = new Map(KINDS.map((k) => [k, PALETTE[k].map(hex)]));
  const shirts = SHIRTS.map(hex); const pants = PANTS.map(hex); const skins = SKINS.map(hex);
  const m1 = Matrix.Identity(); const m2 = Matrix.Identity(); const m3 = Matrix.Identity();
  let lastNight = -1;
  let poolsOn = false;
  let lastTime = 0;

  return {
    traffic, crowd, graph, plans,
    update(dt, time, hour, night, player, ground) {
      lastTime = time;
      const act = activityAt(hour);
      const tctx = { time, player, crosswalkBusy: (n: string, r: string) => crowd.crosswalkBusy(n, r), density: act.traffic, logistics: act.logistics > 0.5 };
      const pctx = {
        time, hour, people: act.people, commerceOpen: act.commerceOpen, player,
        pedAspect: (n: string) => { const p = plans.get(n); return p ? signalState(p, time).ped : null; },
        armClear: (n: string, r: string) => traffic.armClear(n, r),
        busAt: (x: number, z: number) => traffic.busAt(x, z) !== null,
      };
      if (traffic.frame === 0) { traffic.populate(tctx, true); crowd.populate(pctx, true); }
      traffic.update(dt, tctx);
      crowd.update(dt, pctx);

      // Vehicles → per-kind instance buffers (hidden beyond the haze).
      const counts = new Map<VehicleKind, number>(KINDS.map((k) => [k, 0]));
      for (const v of traffic.vehicles) {
        if (!v.active) continue;
        if (Math.hypot(v.x - player.x, v.z - player.z) > 190) continue;
        const proto = protos.get(v.kind)!;
        const i = counts.get(v.kind)!;
        if (i >= MAXV) continue;
        Matrix.RotationYToRef(v.yaw, m1);
        m1.setTranslationFromFloats(v.x, ground(v.x, v.z), v.z);
        m1.copyToArray(proto.matrices, i * 16);
        const pal = palettes.get(v.kind)!;
        writeColor(proto.colors, i, pal[v.colour % pal.length]!);
        counts.set(v.kind, i + 1);
      }
      for (const [kind, proto] of protos) {
        const n = counts.get(kind)!;
        for (const m of proto.meshes) { m.thinInstanceCount = n; m.thinInstanceBufferUpdated('matrix'); }
        for (const m of proto.tinted) m.thinInstanceBufferUpdated('color');
        proto.beams.setEnabled(night > 0.45 && n > 0);
      }

      // Pedestrians.
      let n = 0;
      for (const p of crowd.people) {
        if (!p.active || !p.visible || n >= MAXP) continue;
        if (Math.hypot(p.x - player.x, p.z - player.z) > 150) continue;
        const y = ground(p.x, p.z);
        const sc = p.scale;
        Matrix.ScalingToRef(sc, sc, sc, m2);
        Matrix.RotationYToRef(p.yaw, m1);
        m2.multiplyToRef(m1, m3);
        m3.setTranslationFromFloats(p.x, y, p.z);
        m3.copyToArray(pedMatrices, n * 16);
        writeColor(shirtCol, n, shirts[p.shirt % shirts.length]!);
        writeColor(skinCol, n, skins[p.skin % skins.length]!);
        const moving = p.state === 'walk' || p.state === 'cross';
        const swing = moving ? Math.sin(p.phase) * 0.45 : 0;
        for (const [k, side] of [[0, -1], [1, 1]] as const) {
          Matrix.RotationXToRef(side * swing, m1);
          Matrix.ScalingToRef(sc, sc, sc, m2);
          m1.multiplyToRef(m2, m3);
          Matrix.RotationYToRef(p.yaw, m1);
          m3.multiplyToRef(m1, m2);
          const lx = side * 0.1 * sc;
          m2.setTranslationFromFloats(p.x + Math.cos(p.yaw) * lx, y + 0.86 * sc, p.z - Math.sin(p.yaw) * lx);
          m2.copyToArray(legMatrices, (n * 2 + k) * 16);
          writeColor(legCol, n * 2 + k, pants[p.pants % pants.length]!);
        }
        n++;
      }
      for (const m of [...pedMeshes]) { m.thinInstanceCount = n; m.thinInstanceBufferUpdated('matrix'); }
      for (const m of torsoMeshes) m.thinInstanceBufferUpdated('color');
      for (const m of headMeshes) m.thinInstanceBufferUpdated('color');
      for (const m of legMeshes) { m.thinInstanceCount = n * 2; m.thinInstanceBufferUpdated('matrix'); m.thinInstanceBufferUpdated('color'); }

      // Signal lamps.
      const blink = Math.floor(time * 2) % 2 === 0;
      for (const h of heads) {
        const st = signalState(h.plan, time);
        if (h.ped) {
          setLamp(h.base, st.ped === 'walk' ? GREEN : RED, st.ped === 'walk' || st.ped === 'stop' || blink);
        } else {
          const aspect = st.approach === h.lane ? st.aspect : 'red';
          setLamp(h.base, RED, aspect === 'red');
          setLamp(h.base + 1, YELLOW, aspect === 'yellow');
          setLamp(h.base + 2, GREEN, aspect === 'green');
        }
      }
      for (const m of lamps) m.thinInstanceBufferUpdated('color');

      const lit = night > 0.35;
      if (poolsOn !== lit) { poolsOn = lit; for (const m of pools) m.setEnabled(lit); }
      if (Math.abs(night - lastNight) > 0.02) {
        poolMat.emissiveColor.set(0.42 * night, 0.33 * night, 0.18 * night);
        lastNight = night;
      }
    },
    blocks: (x, z, r) => traffic.blocks(x, z, r),
    stats() {
      const byKind: Record<string, number> = {};
      for (const v of traffic.vehicles) if (v.active) byKind[v.kind] = (byKind[v.kind] ?? 0) + 1;
      const people = crowd.people.filter((p) => p.active);
      const active = traffic.vehicles.filter((v) => v.active);
      const signals: Record<string, string> = {};
      for (const [id, plan] of plans) { const st = signalState(plan, lastTime); signals[id] = `${st.approach === null ? '-' : graph.lanes[st.approach]!.road.id}:${st.aspect}/${st.ped}`; }
      return {
        vehicles: active.length, moving: active.filter((v) => v.v > 0.5).length, pedestrians: people.length,
        visiblePedestrians: people.filter((p) => p.visible).length, byKind, signals,
        vehicleIds: active.map((v) => v.id),
        // Sum of positions: changes whenever anything moves (used by the browser test).
        fingerprint: active.reduce((t, v) => t + v.x + v.z, 0) + people.reduce((t, p) => t + p.x + p.z, 0),
      };
    },
  };
}

/** Exported for the minimap: approximate positions of the signalised junctions. */
export const SIGNAL_NODES = NODES.filter((n) => n.control === 'signal');
