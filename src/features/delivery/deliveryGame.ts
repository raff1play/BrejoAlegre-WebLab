import { Color3 } from '@babylonjs/core/Maths/math.color';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import type { Crowd, Pedestrian as CrowdPed } from '../../core/city/pedestrians';
import { STORE_HOURS, STORE_STAFF, createStoreOps, isOpen, joinQueue, stepStore, type StoreOps } from '../../core/delivery/stores';
import { DEPOT_SPOTS, ROUTINE, Workday, type DepotRole } from '../../core/delivery/workday';
import type { GraphicsProfile } from '../../config/graphics';
import { STORES, storeLayout, type StoreKind, type StoreLayout } from '../../world/city/cityPlan';
import type { Materials } from '../../world/materials';
import { NpcPerson, civilianLook } from '../city/npcPerson';

/**
 * CORE-014 presentation + interaction layer of the delivery job: shop employees and customer
 * queues, depot staff at their stations, the objective marker and the contextual action. The rules
 * (parcels, routine, store state machines) live in core/delivery.
 */
export type ContextAction = Readonly<{ label: string; available: boolean; run: (() => string | null) | null }>;
type Spot = { x: number; z: number };

const DEPOT_LOOKS: Record<DepotRole, { shirt: string; trousers: string; skin: string; hair: string; vest?: string; cap?: string; longHair?: boolean }> = {
  porteiro: { shirt: '#2f3640', trousers: '#23272d', skin: '#8f5f42', hair: '#151311', cap: '#2f3640' },
  conferente: { shirt: '#f4f6f4', trousers: '#2d3a55', skin: '#e0b48e', hair: '#5a3a24', vest: '#f2c230', longHair: true },
  'descarregador-1': { shirt: '#3d4552', trousers: '#384050', skin: '#a8714a', hair: '#2b2622', vest: '#ff7a1a', cap: '#f2c230' },
  'descarregador-2': { shirt: '#4a3f35', trousers: '#2a2c31', skin: '#d6a37b', hair: '#3b2a1e', vest: '#ff7a1a', cap: '#f2c230' },
  'separador-1': { shirt: '#2b5aa8', trousers: '#23272d', skin: '#6e4529', hair: '#151311', vest: '#f2c230' },
  'separador-2': { shirt: '#1f8a5b', trousers: '#3d3f44', skin: '#f0c8a0', hair: '#a5642c', vest: '#f2c230', longHair: true },
  expedidor: { shirt: '#c9302c', trousers: '#2d3a55', skin: '#b67f5a', hair: '#2a1d16', vest: '#f2c230' },
  supervisor: { shirt: '#eef0ea', trousers: '#3b3f46', skin: '#c99a76', hair: '#8a8580' },
};

export class DeliveryGame {
  readonly workday: Workday;
  readonly stores = new Map<StoreKind, { ops: StoreOps; layout: StoreLayout; npc: NpcPerson }>();
  readonly depotStaff = new Map<DepotRole, NpcPerson>();
  private readonly customers = new Map<number, { store: StoreKind; phase: 'in' | 'queue' | 'out'; at: Spot }>();
  private readonly marker: Mesh;
  private readonly ring: Mesh;
  private time = 0;
  private waitUntil: number | null = null;

  constructor(scene: Scene, mats: Materials, profile: GraphicsProfile, shadows: ShadowGenerator, private readonly shutters: Map<string, Mesh>, free: (x: number, z: number) => boolean, seed?: number) {
    this.workday = new Workday({ seed, stores: 2, perStore: 2, marketplace: 4, free });
    const cast = profile.name === 'desktop' ? shadows : undefined;
    for (const s of STORES) {
      const look = STORE_STAFF[s.id];
      const npc = new NpcPerson(scene, mats, `func-${s.id}`, civilianLook({ shirt: look.shirt, trousers: look.trousers, skin: look.skin, hair: look.hair, apron: look.apron, cap: look.cap, longHair: look.name === 'Lúcia' || look.name === 'Bia' || look.name === 'Camila' }), cast);
      const layout = storeLayout(s);
      npc.place(layout.employee.x, layout.employee.z, layout.facing + Math.PI);
      this.stores.set(s.id, { ops: createStoreOps(s.id), layout, npc });
    }
    for (const st of this.workday.staff) {
      const npc = new NpcPerson(scene, mats, `galpao-${st.role}`, civilianLook(DEPOT_LOOKS[st.role]), cast);
      npc.place(st.station.x, st.station.z, Math.PI / 2);
      this.depotStaff.set(st.role, npc);
    }
    // Objective marker: a slowly turning amber pin and a ground ring, unlit so it reads at night.
    const mat = new StandardMaterial('marcador-objetivo', scene);
    mat.disableLighting = true; mat.emissiveColor = Color3.FromHexString('#ffb43a'); mat.alpha = 0.92;
    this.marker = CreateCylinder('objetivo-pino', { diameterTop: 0.55, diameterBottom: 0, height: 0.8, tessellation: 4 }, scene);
    this.marker.material = mat; this.marker.isPickable = false;
    this.ring = CreateTorus('objetivo-anel', { diameter: 1.6, thickness: 0.08, tessellation: 28 }, scene);
    this.ring.material = mat; this.ring.isPickable = false;
  }

  /** Every frame. Returns nothing; read `action()` and `objective` afterwards. */
  update(dt: number, hour: number, crowd: Crowd, player: { x: number; z: number; riding: boolean }, ground: (x: number, z: number) => number, playerNear: (x: number, z: number, r: number) => boolean): void {
    this.time += dt;
    this.workday.update(hour, dt);
    // Shops: hours, shutter, employee routine, customers in the queue.
    for (const [kind, s] of this.stores) {
      const ops = s.ops;
      ops.pickup = !player.riding && Math.hypot(player.x - s.layout.pickup.x, player.z - s.layout.pickup.z) < 2.2 && this.workday.canCollect(kind, hour) !== 'nada';
      stepStore(ops, hour, dt);
      const shutter = this.shutters.get(kind);
      if (shutter) { const k = Math.max(0.04, 1 - ops.shutter); shutter.scaling.y = k; shutter.setEnabled(k > 0.05); }
      const L = s.layout; const npc = s.npc;
      const near = Math.hypot(player.x - L.employee.x, player.z - L.employee.z) < 70;
      npc.setEnabled(ops.employee !== 'fora' && near);
      if (ops.employee === 'buscando') { npc.walkTo(L.stock.x, L.stock.z); npc.activity = 'idle'; }
      else if (ops.employee === 'abrindo' || ops.employee === 'fechando') { npc.walkTo(L.door.x, L.door.z); npc.activity = 'work'; }
      else { npc.walkTo(L.employee.x, L.employee.z); npc.activity = ops.employee === 'atendendo' && ops.queue.length === 0 ? 'idle' : 'work'; }
      if (!npc.moving) npc.lookAt(L.facing + Math.PI);
      if (near) npc.update(dt, ground(npc.x, npc.z), Math.hypot(player.x - npc.x, player.z - npc.z) < 40);
    }
    this.updateCustomers(dt, hour, crowd);
    this.updateDepot(dt, hour, player, ground);
    // Marker over the target.
    const o = this.workday.objective(hour);
    const t = o.target;
    this.marker.setEnabled(!!t); this.ring.setEnabled(!!t);
    if (t) {
      const y = ground(t.x, t.z);
      this.marker.position.set(t.x, y + 2.3 + Math.sin(this.time * 2.4) * 0.12, t.z);
      this.marker.rotation.y = this.time * 1.6;
      this.ring.position.set(t.x, y + 0.04, t.z);
      this.ring.scaling.setAll(1 + 0.08 * Math.sin(this.time * 3));
    }
    if (this.waitUntil !== null && hour >= this.waitUntil) this.waitUntil = null;
    void playerNear;
  }

  /** Crowd shoppers who reach an open shop queue at its counter, are served and walk out. */
  private updateCustomers(dt: number, hour: number, crowd: Crowd): void {
    const byId = new Map<number, CrowdPed>();
    for (const p of crowd.people) if (p.active) byId.set(p.id, p);
    for (const p of crowd.people) {
      if (!p.active || p.state !== 'inside' || p.goal?.kind !== 'shop' || this.customers.has(p.id)) continue;
      const store = STORES.find((s) => s.id !== 'mercearia' && Math.hypot(s.door.x - (p.goal!.x), s.door.z - (p.goal!.z)) < 2.5);
      if (!store || !isOpen(store.id, hour)) continue;
      const s = this.stores.get(store.id)!;
      if (s.ops.queue.length >= s.layout.queue.length) continue;
      joinQueue(s.ops, p.id);
      this.customers.set(p.id, { store: store.id, phase: 'in', at: { x: p.x, z: p.z } });
      p.visible = true;
      p.timer = 1e6;
    }
    for (const [id, c] of this.customers) {
      const p = byId.get(id);
      const s = this.stores.get(c.store)!;
      if (!p) { const i = s.ops.queue.indexOf(id); if (i >= 0) s.ops.queue.splice(i, 1); this.customers.delete(id); continue; }
      const pos = s.ops.queue.indexOf(id);
      let target: Spot;
      if (pos < 0) { c.phase = 'out'; target = s.layout.door; }
      else { c.phase = 'queue'; target = s.layout.queue[Math.min(pos, s.layout.queue.length - 1)]!; }
      const dx = target.x - p.x; const dz = target.z - p.z; const d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const step = Math.min(d, 1.1 * dt);
        p.x += (dx / d) * step; p.z += (dz / d) * step; p.bx = p.x; p.bz = p.z;
        p.yaw = Math.atan2(dx, dz); p.phase += step * 3.2;
      } else if (c.phase === 'queue') {
        p.yaw = s.layout.facing;
      } else {
        // Out of the door: hand the pedestrian back to the crowd simulation.
        p.timer = 0; p.bx = p.x; p.bz = p.z;
        this.customers.delete(id);
      }
    }
  }

  private updateDepot(dt: number, hour: number, player: { x: number; z: number }, ground: (x: number, z: number) => number): void {
    const S = DEPOT_SPOTS;
    const near = Math.hypot(player.x - 112, player.z - -125) < 90;
    const loop = (a: Spot, b: Spot, period: number) => (Math.floor(this.time / period) % 2 === 0 ? a : b);
    for (const st of this.workday.staff) {
      const npc = this.depotStaff.get(st.role)!;
      const on = st.state !== 'fora do turno' && near;
      npc.setEnabled(on);
      if (!on) continue;
      let go: Spot = st.station; let face = Math.PI / 2;
      npc.activity = 'work';
      switch (st.role) {
        case 'porteiro': go = { x: 97.8, z: -96.2 }; face = 0; break;
        case 'conferente': go = { x: 92.75, z: S.receiving.z }; face = Math.PI / 2; break;
        case 'descarregador-1': case 'descarregador-2': {
          const dock = st.role === 'descarregador-1' ? { x: 104, z: -120 } : { x: 120, z: -120 };
          const pallet = st.role === 'descarregador-1' ? { x: 101.5, z: -126.8 } : { x: 121.5, z: -126.8 };
          go = loop(dock, pallet, st.state === 'descarregando caminhão' ? 7 : 11);
          npc.activity = go === dock ? 'idle' : 'carry'; face = go === dock ? 0 : Math.PI; break;
        }
        case 'separador-1': case 'separador-2': {
          const z = st.role === 'separador-1' ? -127.9 : -131.1;
          go = st.state === 'triando por bairro' ? loop({ x: 107, z }, { x: 114, z }, 6) : loop({ x: 108, z: -139.2 }, { x: 116, z: -139.2 }, 9);
          face = st.role === 'separador-1' ? Math.PI : 0; npc.activity = 'work'; break;
        }
        case 'expedidor': go = { x: 92.75, z: -129.9 }; face = Math.PI / 2; break;
        case 'supervisor': go = st.state === 'na sala de controle' ? S.office : loop({ x: 110, z: -133.8 }, { x: 99, z: -127 }, 10); face = Math.PI; npc.activity = st.state === 'na sala de controle' ? 'work' : 'idle'; break;
      }
      npc.walkTo(go.x, go.z);
      if (!npc.moving) npc.lookAt(face);
      npc.update(dt, ground(npc.x, npc.z), Math.hypot(player.x - npc.x, player.z - npc.z) < 45);
    }
    void hour;
  }

  /** The contextual action for the player's current spot (or null when nothing is nearby). */
  action(hour: number, player: { x: number; z: number; riding: boolean }): ContextAction | null {
    if (player.riding) return null;
    const w = this.workday;
    const close = (p: Spot, r: number) => Math.hypot(player.x - p.x, player.z - p.z) < r;
    for (const [kind, s] of this.stores) {
      if (!close(s.layout.pickup, 2.2)) continue;
      const can = w.canCollect(kind, hour);
      if (can === 'nada') continue;
      const name = STORE_STAFF[kind].name;
      if (!isOpen(kind, hour)) return { label: `Fechado (abre ${STORE_HOURS[kind].open}h)`, available: false, run: null };
      if (can === 'cedo') return { label: 'Volumes às 12h', available: false, run: null };
      return { label: `Retirar com ${name}`, available: true, run: () => `${name} conferiu e entregou ${w.collect(kind, hour)} volume(s)` };
    }
    if (close({ x: 95.4, z: DEPOT_SPOTS.receiving.z }, 2.2) && w.carrying().length) {
      return { label: 'Entregar ao conferente', available: true, run: () => `Conferente recebendo ${w.handOver(hour)} volume(s)` };
    }
    if (close({ x: 95.4, z: DEPOT_SPOTS.dispatch.z }, 2.2) && (w.phase === 'SACA' || w.phase === 'TRIAGEM')) {
      if (!w.canTakeSack(hour)) return { label: hour < ROUTINE.sackFrom ? 'Saca às 15h' : 'Triagem em curso', available: false, run: null };
      return { label: 'Retirar a saca', available: true, run: () => `Saca com ${w.takeSack(hour)} volume(s) — rota no mapa` };
    }
    if (w.phase === 'ENTREGAS') {
      for (const id of w.route) {
        const a = w.byAddress.get(id)!;
        if (close(a.door, 2.4)) return { label: `Entregar nº ${a.number}`, available: true, run: () => (w.deliver(id, hour) ? `Entregue em ${a.street}, ${a.number}` : null) };
      }
    }
    return null;
  }

  /** "Wait until …" when the routine blocks progress (the clock runs faster while waiting). */
  waitOption(hour: number): { label: string; until: number } | null {
    const o = this.workday.objective(hour);
    if (o.waitUntil === null || hour >= o.waitUntil) return null;
    const hh = Math.floor(o.waitUntil); const mm = Math.round((o.waitUntil - hh) * 60);
    return { label: `Aguardar até ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, until: o.waitUntil };
  }

  get waiting(): number | null { return this.waitUntil; }
  startWait(until: number): void { this.waitUntil = until; }
}
