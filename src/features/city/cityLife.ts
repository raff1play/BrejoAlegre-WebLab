import '@babylonjs/core/Meshes/thinInstanceMesh';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Matrix } from '@babylonjs/core/Maths/math.vector';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
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
import { buildVehicleModel } from './vehicleModels';
import { NpcPerson, civilianLook } from './npcPerson';
import { rodPart, ballPart, boxPart } from '../../world/modelParts';
import type { Materials } from '../../world/materials';
import { CURB_H } from '../../world/layout';
import { signalFixturePositions } from '../../world/city/signalFixtures';
import { NODES } from '../../world/city/cityPlan';
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
/** Twelve civilian looks shared by the far (instanced) and near (articulated) pedestrians. */
const LOOKS: { shirt: string; trousers: string; skin: string; hair: string; cap?: string; longHair?: boolean }[] = [
  { shirt: '#c9302c', trousers: '#2d3a55', skin: '#d9a273', hair: '#2a1d16' },
  { shirt: '#f4f1ea', trousers: '#3d3f44', skin: '#8f5f42', hair: '#151311', longHair: true },
  { shirt: '#2b5aa8', trousers: '#6b5a45', skin: '#f0c8a0', hair: '#a5642c', cap: '#20242a' },
  { shirt: '#e3b23c', trousers: '#20242a', skin: '#a8714a', hair: '#2b2622' },
  { shirt: '#1f8a5b', trousers: '#8c8f94', skin: '#e0b48e', hair: '#5a3a24', longHair: true },
  { shirt: '#7a3f8f', trousers: '#2d3a55', skin: '#6e4529', hair: '#151311' },
  { shirt: '#f08a4b', trousers: '#3d3f44', skin: '#d6a37b', hair: '#3b2a1e', cap: '#f4f1ea' },
  { shirt: '#3d3f44', trousers: '#2d3a55', skin: '#c99a76', hair: '#8a8580' },
  { shirt: '#8fc1e3', trousers: '#6b5a45', skin: '#b67f5a', hair: '#2a1d16', longHair: true },
  { shirt: '#d94f7a', trousers: '#20242a', skin: '#f0c8a0', hair: '#c49a5a', longHair: true },
  { shirt: '#9a8f6a', trousers: '#384050', skin: '#8f5f42', hair: '#151311', cap: '#2f6688' },
  { shirt: '#eadfc4', trousers: '#5a4a3c', skin: '#e9c19c', hair: '#d8d4cc' },
];
const lookOf = (p: { shirt: number; pants: number; skin: number }) => (p.shirt + p.pants * 3 + p.skin * 5) % LOOKS.length;

type Proto = { meshes: Mesh[]; tinted: Mesh[]; beams: Mesh; matrices: Float32Array; colors: Float32Array };

function hex(c: string): [number, number, number] { const k = Color3.FromHexString(c); return [k.r, k.g, k.b]; }

export type CityLife = {
  traffic: Traffic; crowd: Crowd; graph: RoadGraph; plans: Map<string, SignalPlan>;
  update(dt: number, time: number, hour: number, night: number, player: { x: number; z: number; radius: number }, ground: (x: number, z: number) => number): void;
  blocks(x: number, z: number, r: number): boolean;
  stats(): { vehicles: number; moving: number; pedestrians: number; visiblePedestrians: number; byKind: Record<string, number>; signals: Record<string, string>; vehicleIds: number[]; fingerprint: number };
};

export function buildCityLife(scene: Scene, mats: Materials, profile: GraphicsProfile, shadows: ShadowGenerator, free: (x: number, z: number) => boolean, traffic0 = true): CityLife {
  const graph = buildRoadGraph();
  const plans = buildSignalPlans(graph);
  const light = profile.name === 'mobile';
  // `traffic0 = false` (URL ?trafego=0) leaves the streets empty, for deterministic control tests.
  const traffic = new Traffic(graph, plans, traffic0 ? { capacity: light ? 16 : 28, vans: 3, trucks: light ? 1 : 2, buses: 2 } : { capacity: 0, vans: 0, trucks: 0, buses: 0 });
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
    const { body, detail } = buildVehicleModel(scene, mats, kind);
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
      m.thinInstanceCount = 1;
      m.setEnabled(false);
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
  // Far LOD figure (beyond the articulated NPCs): tapered torso, shoulders, arms, rounded head.
  const flat = (m: Mesh) => { m.scaling.z *= 0.62; return m; };
  torso.absorb(w, flat(rodPart(scene, [0, 0.86, 0], [0, 1.42, 0], 0.34, 0.42, 10)));
  for (const side of [-1, 1]) {
    torso.absorb(w, ballPart(scene, [0.16, 0.14, 0.18], [side * 0.19, 1.38, 0], 5));
    torso.absorb(w, rodPart(scene, [side * 0.22, 1.38, 0], [side * 0.25, 0.9, 0.02], 0.09, 0.07, 6));
  }
  headSet.absorb(w, rodPart(scene, [0, 1.4, 0], [0, 1.5, 0], 0.1, 0.09, 6));
  headSet.absorb(w, ballPart(scene, [0.19, 0.24, 0.21], [0, 1.6, 0.005], 8));
  headSet.absorb(mats.paint('#3a2a20'), ballPart(scene, [0.205, 0.16, 0.22], [0, 1.66, -0.012], 7));
  legSet.absorb(w, rodPart(scene, [0, 0, 0], [0, -0.82, 0], 0.15, 0.1, 8));
  legSet.absorb(mats.paint('#2a2522'), boxPart(scene, [0.1, 0.07, 0.24], [0, -0.83, 0.05]));
  const pedMeshes = [...torso.build('npc-pessoa-tronco', scene), ...headSet.build('npc-pessoa-cabeca', scene)];
  const legMeshes = legSet.build('npc-pessoa-perna', scene);
  const pedMatrices = new Float32Array(MAXP * 16); const shirtCol = new Float32Array(MAXP * 4); const skinCol = new Float32Array(MAXP * 4);
  const legMatrices = new Float32Array(MAXP * 2 * 16); const legCol = new Float32Array(MAXP * 2 * 4);
  const torsoMeshes = pedMeshes.filter((m) => m.name.includes('tronco'));
  const headMeshes = pedMeshes.filter((m) => m.name.includes('cabeca'));
  for (const m of [...pedMeshes, ...legMeshes]) {
    m.thinInstanceSetBuffer('matrix', legMeshes.includes(m) ? legMatrices : pedMatrices, 16, false);
    m.thinInstanceCount = 1; m.setEnabled(false); m.isPickable = false; m.alwaysSelectAsActiveMesh = true; m.receiveShadows = true;
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
  const fixtureSites = signalFixturePositions(graph, plans, crowd.graph);
  for (const f of fixtureSites) {
    const plan = plans.get(f.node)!;
    if (f.ped) {
      poles.box(grey, f.x - 0.05, f.x + 0.05, CURB_H, CURB_H + 2.5, f.z - 0.05, f.z + 0.05);
      poles.box(housing, f.x - 0.15, f.x + 0.15, CURB_H + 2.0, CURB_H + 2.5, f.z - 0.15, f.z + 0.15);
      heads.push({ plan, lane: -1, ped: true, base: lampMatrices.length / 16 });
      pushLamp(f.x + f.faceX * 0.16, CURB_H + 2.25, f.z + f.faceZ * 0.16, f.yaw);
    } else {
      poles.box(grey, f.x - 0.06, f.x + 0.06, CURB_H, CURB_H + 3.6, f.z - 0.06, f.z + 0.06);
      poles.box(housing, f.x - 0.17 + f.faceX * 0.1, f.x + 0.17 + f.faceX * 0.1,
        CURB_H + 2.35, CURB_H + 3.45, f.z - 0.17 + f.faceZ * 0.1, f.z + 0.17 + f.faceZ * 0.1);
      heads.push({ plan, lane: f.lane, ped: false, base: lampMatrices.length / 16 });
      for (const y of [3.2, 2.9, 2.6]) pushLamp(f.x + f.faceX * 0.28, CURB_H + y, f.z + f.faceZ * 0.28, f.yaw);
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
  // GFX-001: soft radial falloff (the pools used to be flat, hard-edged orange discs).
  const poolTex = new DynamicTexture('tx-poca-luz', { width: 64, height: 64 }, scene, false);
  {
    const c2 = poolTex.getContext() as unknown as CanvasRenderingContext2D;
    const g = c2.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgb(150,116,62)'); g.addColorStop(0.45, 'rgb(84,64,32)'); g.addColorStop(1, 'rgb(0,0,0)');
    c2.fillStyle = g; c2.fillRect(0, 0, 64, 64); poolTex.update();
  }
  poolMat.disableLighting = true; poolMat.emissiveColor = new Color3(0, 0, 0); poolMat.emissiveTexture = poolTex; poolMat.alphaMode = Constants.ALPHA_ADD; poolMat.alpha = 1;
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
  const lookColors = LOOKS.map((l) => ({ shirt: hex(l.shirt), trousers: hex(l.trousers), skin: hex(l.skin) }));
  // Articulated near-LOD people: one per look, enabled only when a pedestrian of that look is close.
  const NEAR_RANGE = light ? 22 : 32;
  const nearCap = light ? 5 : 10;
  const nearPool = LOOKS.map((l, i) => {
    const npc = new NpcPerson(scene, mats, `transeunte-${i}`, civilianLook(l), light ? undefined : shadows, 0.93 + ((i * 37) % 15) / 100);
    npc.setEnabled(false);
    return npc;
  });
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
        // Never 0 instances on a mesh with an instance-colour buffer (Babylon keeps INSTANCESCOLOR
        // but drops INSTANCES and the shader fails): disable the mesh instead.
        for (const m of proto.meshes) { m.thinInstanceCount = Math.max(1, n); m.thinInstanceBufferUpdated('matrix'); if (m !== proto.beams) m.setEnabled(n > 0); }
        for (const m of proto.tinted) m.thinInstanceBufferUpdated('color');
        proto.beams.setEnabled(night > 0.45 && n > 0);
      }

      // Pedestrians, near LOD: the closest ones are drawn by articulated characters (one per look).
      const nearIds = new Set<number>();
      const usedLook = new Set<number>();
      const close = crowd.people.filter((p) => p.active && p.visible && Math.hypot(p.x - player.x, p.z - player.z) < NEAR_RANGE)
        .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z));
      for (const p of close) {
        if (nearIds.size >= nearCap) break;
        const li = lookOf(p);
        if (usedLook.has(li)) continue;
        usedLook.add(li); nearIds.add(p.id);
        const npc = nearPool[li]!;
        npc.setEnabled(true);
        npc.follow(p.x, p.z, p.yaw, dt, ground(p.x, p.z));
      }
      nearPool.forEach((npc, i) => { if (!usedLook.has(i)) npc.setEnabled(false); });
      let n = 0;
      for (const p of crowd.people) {
        if (!p.active || !p.visible || n >= MAXP || nearIds.has(p.id)) continue;
        if (Math.hypot(p.x - player.x, p.z - player.z) > 150) continue;
        const y = ground(p.x, p.z);
        const sc = p.scale;
        Matrix.ScalingToRef(sc, sc, sc, m2);
        Matrix.RotationYToRef(p.yaw, m1);
        m2.multiplyToRef(m1, m3);
        m3.setTranslationFromFloats(p.x, y, p.z);
        m3.copyToArray(pedMatrices, n * 16);
        writeColor(shirtCol, n, lookColors[lookOf(p)]!.shirt);
        writeColor(skinCol, n, lookColors[lookOf(p)]!.skin);
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
          writeColor(legCol, n * 2 + k, lookColors[lookOf(p)]!.trousers);
        }
        n++;
      }
      for (const m of [...pedMeshes]) { m.thinInstanceCount = Math.max(1, n); m.thinInstanceBufferUpdated('matrix'); m.setEnabled(n > 0); }
      for (const m of torsoMeshes) m.thinInstanceBufferUpdated('color');
      for (const m of headMeshes) m.thinInstanceBufferUpdated('color');
      for (const m of legMeshes) { m.thinInstanceCount = Math.max(1, n * 2); m.thinInstanceBufferUpdated('matrix'); m.thinInstanceBufferUpdated('color'); m.setEnabled(n > 0); }

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
        poolTex.level = night;
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
