import { DEPOT, STORES, depotWorld, depotYaw, type StoreKind } from '../../world/city/cityPlan.ts';
import { yawOf } from '../../world/layout.ts';
import { rng } from '../city/traffic.ts';
import { buildAddresses, type Address } from './addresses.ts';
import { advance, createParcel, move, type Parcel, type ParcelState, type Platform } from './parcels.ts';

/**
 * CORE-014 delivery workday (vertical slice) following the approved routine, on the virtual
 * clock (1 h = 4 real minutes):
 *   11h stores assigned · 12h–14h pickups · back at the base by 14h · 14h–15h sorting by the staff
 *   · from 15h the mixed sack (ML/SHP, fictional) · ~16h deliveries · until 21h (may end earlier).
 * Local fictional data only: no server, no economy.
 */
export const ROUTINE = Object.freeze({ assign: 11, pickupFrom: 12, returnBy: 14, sortFrom: 14, sackFrom: 15, deliveriesFrom: 16, end: 21 });

export type Phase = 'ANTES' | 'COLETA' | 'RETORNO' | 'CONFERENCIA' | 'TRIAGEM' | 'SACA' | 'ENTREGAS' | 'CONCLUIDA' | 'ENCERRADA';
/** `yaw`: heading that faces the counter/desk/gate from the target spot (CORE-015: real frontages face any direction). */
export type Target = Readonly<{ kind: 'loja' | 'galpao' | 'endereco' | 'moto'; id: string; x: number; z: number; label: string; yaw?: number }>;
/** Loose volumes the rider can carry in both hands at once (the mixed sack counts as one load). */
export const HANDS_MAX = 4;
export type Objective = Readonly<{ title: string; detail: string; target: Target | null; waitUntil: number | null }>;

/**
 * Depot layout used by the staff and by the player interactions (inside the building), in the
 * CORE-014 depot frame; CORE-015 places that frame rigidly on the real block (see depotWorld).
 */
export const DEPOT_LOCAL_SPOTS = Object.freeze({
  door: { x: DEPOT.building.minX - 0.8, z: -122.2 },
  receiving: { x: 95.6, z: -122.4 },
  dispatch: { x: 95.6, z: -131 },
  sorting: { x: 110, z: -129.5 },
  shelves: { x: 118, z: -139.5 },
  dock: { x: 112, z: -120 },
  gatehouse: { x: 99, z: -95 },
  office: { x: 128, z: -138.5 },
});
type SpotName = keyof typeof DEPOT_LOCAL_SPOTS;
/** The same spots in world coordinates (metres on the real map). */
export const DEPOT_SPOTS = Object.freeze(Object.fromEntries(
  (Object.keys(DEPOT_LOCAL_SPOTS) as SpotName[]).map((k) => [k, depotWorld(DEPOT_LOCAL_SPOTS[k].x, DEPOT_LOCAL_SPOTS[k].z)]),
) as Record<SpotName, { x: number; z: number }>);

export type DepotRole = 'porteiro' | 'conferente' | 'descarregador-1' | 'descarregador-2' | 'separador-1' | 'separador-2' | 'expedidor' | 'supervisor';
export type DepotStaff = { role: DepotRole; state: string; station: { x: number; z: number }; shift: [number, number]; carrying: boolean };

export type WorkdayOptions = Readonly<{ seed?: number; stores?: number; perStore?: number; marketplace?: number; free?: (x: number, z: number) => boolean }>;

export class Workday {
  readonly parcels: Parcel[] = [];
  readonly addresses: Address[];
  readonly byAddress = new Map<string, Address>();
  assigned: StoreKind[] = [];
  phase: Phase = 'ANTES';
  route: string[] = [];
  readonly staff: DepotStaff[];
  /** Short messages for the HUD (consumed by the presentation). */
  readonly events: string[] = [];
  private readonly random: () => number;
  private counting: string[] = [];
  private work = 0;
  private lastHour: number | null = null;
  private truckArrived = false;
  late = false;

  readonly options: WorkdayOptions;

  constructor(options: WorkdayOptions = {}) {
    this.options = options;
    this.random = rng(options.seed ?? 2026);
    this.addresses = buildAddresses(options.free);
    for (const a of this.addresses) this.byAddress.set(a.id, a);
    const S = DEPOT_SPOTS;
    const st = (role: DepotRole, station: { x: number; z: number }, shift: [number, number]): DepotStaff => ({ role, state: 'fora', station, shift, carrying: false });
    this.staff = [
      st('porteiro', S.gatehouse, [6, 22]), st('conferente', S.receiving, [10, 21]),
      st('descarregador-1', depotWorld(104, -121), [10, 19]), st('descarregador-2', depotWorld(120, -121), [10, 19]),
      st('separador-1', depotWorld(108, -128), [12, 20]), st('separador-2', depotWorld(113, -131), [12, 20]),
      st('expedidor', S.dispatch, [13, 21.5]), st('supervisor', S.office, [9, 21]),
    ];
  }

  // ------------------------------------------------------------------ helpers

  get mine(): Parcel[] { return this.parcels; }
  count(state: ParcelState): number { return this.parcels.filter((p) => p.state === state).length; }
  private storeParcels(kind: StoreKind): Parcel[] { return this.parcels.filter((p) => p.origin === kind); }
  storeOf(kind: StoreKind) { return STORES.find((s) => s.id === kind)!; }

  /** Parcels a store holds for the player right now. */
  readyAt(kind: StoreKind): Parcel[] { return this.storeParcels(kind).filter((p) => p.state === 'NA_LOJA'); }

  private say(text: string): void { this.events.push(text); }

  // ------------------------------------------------------------------ day start

  /** 11h: designates stores, prepares their parcels and the marketplace load coming by truck. */
  start(hour: number): void {
    if (this.phase !== 'ANTES') return;
    const kinds = STORES.map((s) => s.id);
    const n = Math.min(kinds.length, this.options.stores ?? 2);
    // Deterministic choice: shuffle with the seed.
    for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(this.random() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!]; }
    this.assigned = kinds.slice(0, n);
    const pool = [...this.addresses];
    const take = () => pool.splice(Math.floor(this.random() * pool.length), 1)[0]!;
    let k = 1;
    for (const kind of this.assigned) {
      for (let i = 0; i < (this.options.perStore ?? 2); i++) {
        const a = take();
        this.parcels.push(createParcel(`BA-${String(k++).padStart(4, '0')}`, kind, a.id, 'LOJA', a.bairro, 'NA_LOJA', kind, hour));
      }
    }
    for (let i = 0; i < (this.options.marketplace ?? 4); i++) {
      const a = take();
      const platform: Platform = i % 2 === 0 ? 'ML' : 'SHP';
      this.parcels.push(createParcel(`${platform}-${String(k++).padStart(4, '0')}`, `CD-${platform}`, a.id, platform, a.bairro, 'EM_TRANSPORTE', 'motorista', hour));
    }
    this.phase = 'COLETA';
    this.say(`Jornada iniciada: coletar em ${this.assigned.map((s) => this.storeOf(s).name).join(' e ')}`);
  }

  // ------------------------------------------------------------------ physical cargo (CORE-015.1)

  /** True while the mixed sack is being carried (one load, whatever it holds). */
  sackInHands = false;
  inHands(): Parcel[] { return this.parcels.filter((p) => p.place === 'maos'); }
  inTrunk(): Parcel[] { return this.parcels.filter((p) => p.place === 'bau'); }
  /** Trunk parcels still to be handed to the checker / still to be delivered. */
  trunkForDepot(): Parcel[] { return this.inTrunk().filter((p) => p.state === 'EM_TRANSPORTE'); }
  trunkForRoute(): Parcel[] { return this.inTrunk().filter((p) => p.state === 'EM_ROTA'); }
  cargoLabel(): string {
    const h = this.inHands().length; const t = this.inTrunk().length;
    const parts: string[] = [];
    const n = (k: number) => `${k} ${k === 1 ? 'volume' : 'volumes'}`;
    if (h) parts.push(this.sackInHands ? `saca com ${n(h)} nas mãos` : `${n(h)} nas mãos`);
    if (t) parts.push(`${n(t)} no baú`);
    return parts.join(' · ');
  }

  /** Puts everything in the hands into the trunk. Never while the bike moves. */
  stow(hour: number, bikeMoving = false): number {
    if (bikeMoving) return 0;
    const list = this.inHands();
    for (const p of list) {
      if (p.state === 'COLETADO') advance(p, 'EM_TRANSPORTE', 'jogador', hour);
      move(p, 'bau', 'jogador', hour);
    }
    this.sackInHands = false;
    if (list.length) this.say(list.length === 1 ? '1 volume guardado no baú' : `${list.length} volumes guardados no baú`);
    return list.length;
  }

  /** At the base: takes the collected parcels out of the trunk (up to a hands-full). */
  unloadForDepot(hour: number, bikeMoving = false): number {
    if (bikeMoving || this.sackInHands) return 0;
    const room = HANDS_MAX - this.inHands().length;
    const list = this.trunkForDepot().slice(0, Math.max(0, room));
    for (const p of list) move(p, 'maos', 'jogador', hour);
    if (list.length) this.say(list.length === 1 ? '1 volume retirado do baú' : `${list.length} volumes retirados do baú`);
    return list.length;
  }

  /** At a stop of the route: takes the parcel(s) of ONE address out of the trunk. */
  takeForAddress(addressId: string, hour: number, bikeMoving = false): number {
    if (bikeMoving || this.inHands().length) return 0;
    const list = this.trunkForRoute().filter((p) => p.destination === addressId).slice(0, HANDS_MAX);
    for (const p of list) move(p, 'maos', 'jogador', hour);
    if (list.length) this.route = [addressId, ...this.route.filter((id) => id !== addressId)];
    return list.length;
  }

  // ------------------------------------------------------------------ player actions

  canCollect(kind: StoreKind, hour: number): 'ok' | 'cedo' | 'nada' | 'cheio' {
    if (!this.assigned.includes(kind) || this.readyAt(kind).length === 0) return 'nada';
    if (hour < ROUTINE.pickupFrom) return 'cedo';
    return this.sackInHands || this.inHands().length + this.readyAt(kind).length > HANDS_MAX ? 'cheio' : 'ok';
  }

  /** At the counter: the employee checks the parcels and hands them over (into the hands). */
  collect(kind: StoreKind, hour: number): number {
    if (this.canCollect(kind, hour) !== 'ok') return 0;
    const list = this.readyAt(kind);
    for (const p of list) { advance(p, 'COLETADO', 'jogador', hour); move(p, 'maos', 'jogador', hour); }
    this.say(`${list.length === 1 ? '1 volume conferido e retirado' : `${list.length} volumes conferidos e retirados`} em ${this.storeOf(kind).name}`);
    if (this.assigned.every((s) => this.readyAt(s).length === 0)) this.phase = 'RETORNO';
    return list.length;
  }

  /** Parcels the player still has to bring to the base (in the hands or in the trunk). */
  carrying(): Parcel[] { return this.parcels.filter((p) => (p.place === 'maos' || p.place === 'bau') && (p.state === 'COLETADO' || p.state === 'EM_TRANSPORTE')); }

  /** At the receiving desk: the checker takes the parcels the player has IN THE HANDS. */
  handOver(hour: number): number {
    const list = this.inHands().filter((p) => p.state === 'COLETADO' || p.state === 'EM_TRANSPORTE');
    for (const p of list) {
      if (p.state === 'COLETADO') advance(p, 'EM_TRANSPORTE', 'jogador', hour);
      move(p, 'galpao', 'conferente', hour);
      if (!this.counting.includes(p.id)) this.counting.push(p.id);
    }
    if (list.length) {
      if (hour > ROUTINE.returnBy) this.late = true;
      // The conference phase starts when nothing is left on the way (trunk, hands or shops).
      if (this.carrying().length === 0 && this.assigned.every((s) => this.readyAt(s).length === 0)) this.phase = 'CONFERENCIA';
      this.say(`Conferente recebendo ${list.length === 1 ? '1 volume' : `${list.length} volumes`}`);
    }
    return list.length;
  }

  canTakeSack(hour: number): boolean { return hour >= ROUTINE.sackFrom && this.count('NA_SACA') > 0 && this.count('TRIADO') === 0 && this.count('RECEBIDO_BASE') === 0 && this.inHands().length === 0; }

  /** At the dispatch counter: the mixed sack is released to the player (carried in the hands). */
  takeSack(hour: number): number {
    if (!this.canTakeSack(hour)) return 0;
    const list = this.parcels.filter((p) => p.state === 'NA_SACA');
    for (const p of list) { advance(p, 'EM_ROTA', 'jogador', hour); move(p, 'maos', 'jogador', hour); }
    this.sackInHands = true;
    // Route: nearest neighbour from the depot gate.
    const left = [...new Set(list.map((p) => p.destination))].map((id) => this.byAddress.get(id)!);
    let at = depotWorld((DEPOT.gate.x0 + DEPOT.gate.x1) / 2, DEPOT.yard.maxZ);
    this.route = [];
    while (left.length) {
      left.sort((a, b) => Math.hypot(a.door.x - at.x, a.door.z - at.z) - Math.hypot(b.door.x - at.x, b.door.z - at.z));
      const next = left.shift()!;
      this.route.push(next.id);
      at = next.door;
    }
    this.phase = 'ENTREGAS';
    this.say(`Saca mista retirada: ${list.length} volumes — guarde no baú`);
    return list.length;
  }

  /** At the gate of an address: hands over its parcel(s) — only those IN THE HANDS. */
  deliver(addressId: string, hour: number): number {
    const list = this.inHands().filter((p) => p.destination === addressId && p.state === 'EM_ROTA');
    for (const p of list) { advance(p, 'ENTREGUE', 'destinatario', hour); move(p, 'destinatario', 'destinatario', hour); }
    if (list.length) {
      if (!this.parcels.some((p) => p.destination === addressId && p.state === 'EM_ROTA')) this.route = this.route.filter((id) => id !== addressId);
      if (this.inHands().length === 0) this.sackInHands = false;
      this.say(`Entregue: ${this.byAddress.get(addressId)!.label}`);
      if (this.count('EM_ROTA') === 0) { this.phase = 'CONCLUIDA'; this.say('Rota concluída! Jornada encerrada.'); }
    }
    return list.length;
  }

  // ------------------------------------------------------------------ depot simulation

  /** Advances the depot staff and the parcel flow. `truckDocked` comes from the traffic (or 13h fallback). */
  update(hour: number, dt: number, truckDocked = false): void {
    if (this.phase === 'ANTES' && hour >= ROUTINE.assign) this.start(hour);
    if (this.phase !== 'CONCLUIDA' && this.phase !== 'ANTES' && hour >= ROUTINE.end && this.count('ENTREGUE') < this.parcels.length) {
      this.phase = 'ENCERRADA';
    }
    // Marketplace load: unloaded by the dock workers when the truck docks (13h at the latest).
    if (!this.truckArrived && (truckDocked || hour >= 13) && this.phase !== 'ANTES') {
      this.truckArrived = true;
      for (const p of this.parcels) if (p.state === 'EM_TRANSPORTE' && p.holder === 'motorista') this.counting.push(p.id);
      this.say('Caminhão nas docas: descarregando volumes das plataformas');
    }
    // Staff work is measured in virtual minutes (so it also speeds up while the player waits).
    const dh = this.lastHour === null ? 0 : hour - this.lastHour;
    this.lastHour = hour;
    if (dh > 0) this.work = Math.min(this.work + dh * 60, 30);
    void dt;
    const allIn = () => this.parcels.length > 0 && this.parcels.every((p) => PARCEL_DONE_IN(p.state));
    for (let guard = 0; guard < 16; guard++) {
      // Checker: 0.4 virtual minutes per parcel (≈1.6 s real at the normal scale).
      if (this.counting.length && this.work >= 0.4) {
        this.work -= 0.4;
        const p = this.parcels.find((q) => q.id === this.counting[0])!;
        this.counting.shift();
        advance(p, 'RECEBIDO_BASE', 'conferente', hour);
        if (p.place === 'caminhao') move(p, 'galpao', 'descarregador', hour);
        continue;
      }
      // Sorters from 14h (RECEBIDO_BASE → TRIADO), then the dispatcher bags them (NA_SACA).
      if (hour >= ROUTINE.sortFrom && allIn() && this.work >= 0.3) {
        const sort = this.parcels.find((p) => p.state === 'RECEBIDO_BASE');
        const bag = this.parcels.find((p) => p.state === 'TRIADO');
        if (sort) { advance(sort, 'TRIADO', 'separador', hour); this.work -= 0.3; continue; }
        if (bag) { advance(bag, 'NA_SACA', 'expedidor', hour); move(bag, 'saca', 'expedidor', hour); this.work -= 0.3; if (this.count('TRIADO') === 0) this.say('Saca mista pronta na expedição'); continue; }
      }
      break;
    }
    if (!this.counting.length && !(hour >= ROUTINE.sortFrom && this.count('RECEBIDO_BASE') + this.count('TRIADO') > 0)) this.work = Math.min(this.work, 0.4);
    if (this.phase === 'CONFERENCIA' && !this.counting.length && this.count('RECEBIDO_BASE') + this.count('TRIADO') + this.count('NA_SACA') > 0) this.phase = 'TRIAGEM';
    if (this.phase === 'TRIAGEM' && this.count('NA_SACA') > 0 && this.count('TRIADO') + this.count('RECEBIDO_BASE') === 0) this.phase = 'SACA';
    this.updateStaff(hour);
  }

  private updateStaff(hour: number): void {
    const t = ((hour % 24) + 24) % 24;
    const sorting = hour >= ROUTINE.sortFrom && (this.count('RECEBIDO_BASE') > 0 || this.count('TRIADO') > 0);
    for (const s of this.staff) {
      s.carrying = false;
      if (t < s.shift[0] || t >= s.shift[1]) { s.state = 'fora do turno'; continue; }
      switch (s.role) {
        case 'porteiro': s.state = 'na portaria'; break;
        case 'conferente': s.state = this.counting.length ? 'conferindo volumes' : 'aguardando recebimento'; break;
        case 'descarregador-1': case 'descarregador-2':
          s.state = this.counting.some((id) => id.startsWith('ML') || id.startsWith('SHP')) ? 'descarregando caminhão' : 'organizando pallets';
          s.carrying = s.state === 'descarregando caminhão' || Math.floor(hour * 20) % 2 === 0; break;
        case 'separador-1': case 'separador-2': s.state = sorting ? 'triando por bairro' : 'arrumando prateleiras'; s.carrying = sorting; break;
        case 'expedidor': s.state = this.count('NA_SACA') > 0 && this.phase !== 'ENTREGAS' ? 'saca pronta, aguardando entregador' : this.count('TRIADO') > 0 ? 'montando a saca' : 'organizando expedição'; break;
        case 'supervisor': s.state = sorting || this.counting.length ? 'supervisionando a operação' : 'na sala de controle'; break;
      }
    }
  }

  // ------------------------------------------------------------------ guidance

  /** `bike`: where the parked bike is (target of the "store it in the trunk" steps). */
  objective(hour: number, bike?: { x: number; z: number }): Objective {
    const toBike = (title: string): Objective => ({ title, detail: `${this.cargoLabel()} · vá até o baú da moto`, target: bike ? { kind: 'moto', id: 'moto', x: bike.x, z: bike.z, label: 'Baú da moto' } : null, waitUntil: null });
    const depot = (label: string): Target => ({ kind: 'galpao', id: 'galpao', ...DEPOT_SPOTS.receiving, label, yaw: depotYaw(-Math.PI / 2) });
    switch (this.phase) {
      case 'ANTES': return { title: 'Aguardando o início da jornada', detail: 'A designação das lojas sai às 11h', target: null, waitUntil: ROUTINE.assign };
      case 'COLETA': {
        if (this.inHands().length) return toBike('Guardar os volumes no baú');
        const next = this.assigned.find((k) => this.readyAt(k).length > 0)!;
        const store = this.storeOf(next);
        const early = hour < ROUTINE.pickupFrom;
        return {
          title: `Coletar em ${store.name}`,
          detail: `${this.readyAt(next).length} volume(s) · coleta das 12h às 14h${early ? ' — chegue e aguarde' : ''}`,
          target: { kind: 'loja', id: next, x: store.door.x, z: store.door.z, label: store.name, yaw: yawOf(store.frame) }, waitUntil: early ? ROUTINE.pickupFrom : null,
        };
      }
      case 'RETORNO': {
        const hands = this.inHands().length; const trunk = this.trunkForDepot().length;
        if (hands && hands + trunk < this.carrying().length) return toBike('Guardar os volumes no baú');
        return hands
          ? { title: 'Entregar os volumes ao conferente', detail: `${hands} volume(s) nas mãos${trunk ? ` · ${trunk} no baú` : ''} · até 14h`, target: depot('Recebimento'), waitUntil: null }
          : { title: 'Levar os volumes ao galpão', detail: `${trunk} volume(s) no baú · no galpão, retire do baú e entregue ao conferente até 14h`, target: depot('Recebimento'), waitUntil: null };
      }
      case 'CONFERENCIA': return { title: 'Conferência no recebimento', detail: `${this.counting.length} volume(s) sendo conferidos`, target: depot('Recebimento'), waitUntil: null };
      case 'TRIAGEM': {
        const waiting = hour < ROUTINE.sortFrom;
        return { title: waiting ? 'Aguardar a triagem (14h)' : 'Triagem em andamento', detail: `${this.count('TRIADO') + this.count('NA_SACA')}/${this.parcels.length} volumes triados`, target: { kind: 'galpao', id: 'galpao', ...DEPOT_SPOTS.dispatch, label: 'Expedição' }, waitUntil: waiting ? ROUTINE.sortFrom : null };
      }
      case 'SACA': {
        const waiting = hour < ROUTINE.sackFrom;
        return { title: waiting ? 'Saca liberada às 15h' : 'Retirar a saca na expedição', detail: `Saca mista ML/SHP com ${this.count('NA_SACA')} volume(s)`, target: { kind: 'galpao', id: 'galpao', ...DEPOT_SPOTS.dispatch, label: 'Expedição' }, waitUntil: waiting ? ROUTINE.sackFrom : null };
      }
      case 'ENTREGAS': {
        if (this.sackInHands) return toBike('Guardar a saca no baú');
        const held = this.inHands()[0];
        const a = this.byAddress.get(held ? held.destination : this.route[0]!)!;
        const where = held ? 'pacote nas mãos' : 'estacione e retire o pacote no baú';
        return { title: `Entregar em ${a.street}, ${a.number}`, detail: `${a.bairro} · ${where} · ${this.count('ENTREGUE')}/${this.parcels.length} entregues`, target: { kind: 'endereco', id: a.id, x: a.door.x, z: a.door.z, label: a.label, yaw: yawOf(a.frame) }, waitUntil: null };
      }
      case 'CONCLUIDA': return { title: 'Jornada concluída', detail: `${this.count('ENTREGUE')}/${this.parcels.length} volumes entregues${this.late ? ' (retorno após 14h)' : ''}`, target: null, waitUntil: null };
      default: return { title: 'Jornada encerrada às 21h', detail: `${this.count('ENTREGUE')}/${this.parcels.length} entregues`, target: null, waitUntil: null };
    }
  }

  progress(): { collected: number; delivered: number; total: number } {
    const storeTotal = this.parcels.filter((p) => p.platform === 'LOJA').length;
    const collected = this.parcels.filter((p) => p.platform === 'LOJA' && p.state !== 'NA_LOJA').length;
    return { collected: Math.min(collected, storeTotal), delivered: this.count('ENTREGUE'), total: this.parcels.length };
  }
}

/** Every parcel is at the base or beyond (sorting waits until the whole load is in). */
function PARCEL_DONE_IN(s: ParcelState): boolean {
  return s === 'RECEBIDO_BASE' || s === 'TRIADO' || s === 'NA_SACA' || s === 'EM_ROTA' || s === 'ENTREGUE';
}
