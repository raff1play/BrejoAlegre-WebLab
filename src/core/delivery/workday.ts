import { SupplierVan } from './supplierVan.ts';
import { DepotOperations } from './depotOperations.ts';
/** Keep depot throughput per virtual hour after shortening the real-time clock. */
/** Calibrated for the later 11:47 courier departure while keeping real physical parcel tasks. */
const DEPOT_OPERATION_SECONDS_PER_VIRTUAL_HOUR = 360;
import { DEPOT_POINTS, validDepotParking, depotFree, depotCarBay, CAR_PARKING, DISPATCH_DOCK, MIXED_LOAD } from '../../world/city/depotPlan.ts';
import { CAR, carToWorld } from '../carPhysics.ts';
import type { CarTrunk } from './carTrunk.ts';
import { DEPOT, STORES, depotWorld, depotYaw, depotLocal, type StoreKind } from '../../world/city/cityPlan.ts';
import { yawOf } from '../../world/layout.ts';
import { rng } from '../city/traffic.ts';
import { buildAddresses, type Address } from './addresses.ts';
import { advance, attemptFailed, createParcel, isFinal, move, arriveTruck, type Parcel, type ParcelState, type Platform } from './parcels.ts';

/**
 * CORE-014 delivery workday (vertical slice) following the approved routine, on the virtual
 * clock (1 h = 2 min 30 s reais):
 *   11h stores assigned · 12h–14h pickups · back at the base by 14h · sorting begins
 *   as parcels reach the base (without a time gate); from 15h mixed sack pickup · deliveries until 21h.
 * Local fictional data only: no server, no economy.
 */
export const ROUTINE = Object.freeze({ assign: 11, pickupFrom: 12, returnBy: 14, sackFrom: 15, deliveriesFrom: 16, end: 21 });

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
export const DEPOT_LOCAL_SPOTS = DEPOT_POINTS;
type SpotName = keyof typeof DEPOT_LOCAL_SPOTS;
/** The same spots in world coordinates (metres on the real map). */
export const DEPOT_SPOTS = Object.freeze(Object.fromEntries(
  (Object.keys(DEPOT_LOCAL_SPOTS) as SpotName[]).map((k) => [k, depotWorld(DEPOT_LOCAL_SPOTS[k].x, DEPOT_LOCAL_SPOTS[k].z)]),
) as Record<SpotName, { x: number; z: number }>);

export type DepotRole = 'porteiro' | 'conferente' | 'conferente-2' | 'descarregador-1' | 'descarregador-2' | 'separador-1' | 'separador-2' | 'separador-3' | 'expedidor' | 'expedidor-2' | 'supervisor';
export type DepotStaff = { role: DepotRole; state: string; station: { x: number; z: number }; shift: [number, number]; carrying: boolean };

/**
 * `bike` is the player's own vehicle pose (the name is historical). B1-01 F4: `car: true` when it is
 * the car — then it must stand inside a painted CAR bay (all four corners) and "parking" means
 * standing at its tailgate, instead of the motorcycle bays and the top box.
 */
export type DepotVisit = {player:{x:number;z:number;riding:boolean};bike:{x:number;z:number;yaw:number;moving:boolean};car?:boolean};
/** B1-01 F4: the four body corners of the car at a pose, in depot-local coordinates. */
export function carCornersLocal(c:{x:number;z:number;yaw:number}):{x:number;z:number}[] {
 const hw=CAR.width/2,hl=CAR.length/2;
 return [[-hw,-hl],[hw,-hl],[hw,hl],[-hw,hl]].map(([r,f])=>{const w=carToWorld(c,r!,f!);return depotLocal(w.x,w.z);});
}
/** B1-01 F4: where a person stands to reach into the car boot (behind the tailgate). */
export const carBootSpot=(c:{x:number;z:number;yaw:number}):{x:number;z:number}=>carToWorld(c,0,-CAR.length/2-.55);
/**
 * B1-01 F5 (F4 audit): the team release is a physical interaction — from the vehicle's seat, or
 * standing beside the parked vehicle, never from across the yard.
 */
export const RELEASE_REACH = 3;
export function releaseWithinReach(player:{x:number;z:number;riding:boolean},vehicle:{x:number;z:number}):boolean {
 return player.riding||Math.hypot(player.x-vehicle.x,player.z-vehicle.z)<=RELEASE_REACH;
}
/** `at`: a named depot point, or (B1-01) an explicit depot-local counter such as the player's sector dock. */
export function depotVisitAllowed(visit:DepotVisit|undefined,at:'receiving'|'dispatch'|'parking'|{x:number;z:number}):boolean {
 if(!visit||visit.player.riding||visit.bike.moving)return false;
 const b=depotLocal(visit.bike.x,visit.bike.z),p=depotLocal(visit.player.x,visit.player.z);
 if(visit.car){
  if(depotCarBay(carCornersLocal(visit.bike),false)===null||!depotFree(p,.25))return false;
  if(at==='parking'){const r=carBootSpot(visit.bike);return Math.hypot(visit.player.x-r.x,visit.player.z-r.z)<1.1;}
 }
 else if(!validDepotParking({...b,yaw:visit.bike.yaw-depotYaw(0),moving:visit.bike.moving})||!depotFree(p,.25))return false;
 if(at==='parking')return Math.hypot(visit.player.x-(visit.bike.x-Math.sin(visit.bike.yaw)*1.25),visit.player.z-(visit.bike.z-Math.cos(visit.bike.yaw)*1.25))<1.1;
 const q=typeof at==='string'?DEPOT_POINTS[at]:at;
 return Math.hypot(p.x-q.x,p.z-q.z)<1.45;
}
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
  readonly depot = new DepotOperations();
  private lastHour: number | null = null;
  readonly van = new SupplierVan();
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
      st('porteiro', S.gatehouse, [6, 22]), st('conferente', S.receiving, [10, 72]),
      st('descarregador-1', depotWorld(104, -121), [10, 21]), st('descarregador-2', depotWorld(120, -121), [10, 21]),
      st('separador-1', depotWorld(108, -128), [11, 21]), st('separador-2', depotWorld(113, -131), [11, 21]),
      st('expedidor', S.dispatch, [11, 21.5]), st('supervisor', S.office, [9, 21]),
      st('conferente-2', depotWorld(102.2,-121.1), [10,21]),
      st('separador-3', depotWorld(112,-128.35), [11,21]),
      st('expedidor-2', depotWorld(110.5,-123.8), [11,21]),
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
  inHands(): Parcel[] { return this.parcels.filter((p) => p.place === 'maos' && p.holder === 'jogador'); }
  inTrunk(): Parcel[] { return this.parcels.filter((p) => p.place === 'bau' && p.holder === 'jogador'); }
  /** B1-01 F3: parcels in the boot of the player's own car (slots in `stowage`). */
  inCarBoot(): Parcel[] { return this.parcels.filter((p) => p.place === 'porta-malas' && p.holder === 'jogador'); }
  /** B1-01 F4: the player's own vehicle kind (texts and which compartment is used). */
  vehicleKind: 'moto-antiga' | 'carro-antigo' = 'moto-antiga';
  /** B1-01 F4: parcels the player carries in the vehicle, whichever it is (top box or car boot). */
  inVehicle(): Parcel[] { return this.parcels.filter((p) => (p.place === 'bau' || p.place === 'porta-malas') && p.holder === 'jogador'); }
  private get carMode(): boolean { return this.vehicleKind === 'carro-antigo'; }
  /** Name of the compartment in player-facing texts. */
  get compartment(): string { return this.carMode ? 'porta-malas' : 'baú'; }
  carForDepot(): Parcel[] { return this.inCarBoot().filter((p) => p.state === 'EM_TRANSPORTE' || p.state === 'TENTATIVA_FRUSTRADA'); }
  /** B1-01 F5: failed-attempt parcels the player still has to bring back to the base (hands or vehicle). */
  returnsPending(): Parcel[] { return this.parcels.filter((p) => p.holder === 'jogador' && p.state === 'TENTATIVA_FRUSTRADA'); }
  /**
   * B1-01 F5: addresses whose recipient is not there today (failed attempt). Decided once per day by
   * `LogisticsDay` (deterministic, from the calendar), empty in the legacy single-player workday.
   */
  readonly absentAddresses = new Set<string>();
  recipientAbsent(addressId: string): boolean { return this.absentAddresses.has(addressId); }
  /**
   * B1-01 F5 (AC-11): at the gate, nobody answers. Every parcel of that address IN THE HANDS gets
   * the attempt recorded; it stays in the hands (same custody) and must go back to the base.
   */
  registerAttempt(addressId: string, hour: number, by = 'jogador'): number {
    if (!this.recipientAbsent(addressId)) return 0;
    const list = this.parcels.filter((p) => p.place === 'maos' && p.holder === by && p.destination === addressId && p.state === 'EM_ROTA');
    for (const p of list) attemptFailed(p, by, hour);
    if (list.length && by === 'jogador') {
      if (!this.parcels.some((p) => p.destination === addressId && p.state === 'EM_ROTA' && p.holder === 'jogador')) this.route = this.route.filter((id) => id !== addressId);
      if (!this.inHands().some((p) => p.state === 'EM_ROTA')) this.sackInHands = false;
      this.say(`Ninguém atendeu: tentativa registrada (${list.length}) — devolva na base`);
    }
    return list.length;
  }
  carForRoute(): Parcel[] { return this.inCarBoot().filter((p) => p.state === 'EM_ROTA'); }

  /**
   * B1-01 F4 (AC-09): at the base, with the car in a car bay and the person at the open tailgate,
   * takes collected volumes out of the boot into the hands (up to a hands-full; boxes on top first),
   * through the boot's own custody transition. The same desk hand-over as the motorcycle follows.
   */
  unloadCarForDepot(trunk: CarTrunk, hour: number, visit?: DepotVisit): number {
    if (!visit?.car || !depotVisitAllowed(visit, 'parking') || this.sackInHands) return 0;
    const room = HANDS_MAX - this.inHands().length;
    if (room <= 0) return 0;
    // Collected volumes and (B1-01 F5) failed-attempt returns both go to the receiving desk.
    const top = [...trunk.contents(this.parcels)].filter((p) => p.state === 'EM_TRANSPORTE' || p.state === 'TENTATIVA_FRUSTRADA')
      .sort((a, b) => (b.stowage!.y + b.stowage!.h) - (a.stowage!.y + a.stowage!.h) || b.stowage!.z - a.stowage!.z || (a.id < b.id ? -1 : 1));
    const r = trunk.take(this.parcels, top.slice(0, room).map((p) => p.id), hour, { parked: true }, room);
    if (r.taken.length) this.say(r.taken.length === 1 ? '1 volume retirado do porta-malas' : `${r.taken.length} volumes retirados do porta-malas`);
    return r.taken.length;
  }

  /** B1-01 F4 (AC-10): at a stop, takes the parcel(s) of ONE address out of the car boot. */
  takeFromCarForAddress(trunk: CarTrunk, addressId: string, hour: number, parked: boolean): number {
    if (!parked || this.inHands().length) return 0;
    const ids = this.carForRoute().filter((p) => p.destination === addressId).slice(0, HANDS_MAX).map((p) => p.id);
    if (!ids.length) return 0;
    const r = trunk.take(this.parcels, ids, hour, { parked }, HANDS_MAX);
    if (r.taken.length) this.route = [addressId, ...this.route.filter((id) => id !== addressId)];
    return r.taken.length;
  }
  /** Trunk parcels still to be handed to the checker / still to be delivered. */
  trunkForDepot(): Parcel[] { return this.inTrunk().filter((p) => p.state === 'EM_TRANSPORTE' || p.state === 'TENTATIVA_FRUSTRADA'); }
  trunkForRoute(): Parcel[] { return this.inTrunk().filter((p) => p.state === 'EM_ROTA'); }
  cargoLabel(): string {
    const h = this.inHands().length; const t = this.inTrunk().length; const c = this.inCarBoot().length;
    const parts: string[] = [];
    const n = (k: number) => `${k} ${k === 1 ? 'volume' : 'volumes'}`;
    if (h) parts.push(this.sackInHands ? `saca com ${n(h)} nas mãos` : `${n(h)} nas mãos`);
    if (t) parts.push(`${n(t)} no baú`);
    if (c) parts.push(`${n(c)} no porta-malas`);
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
  unloadForDepot(hour: number, bikeMoving = false, visit?:DepotVisit): number {
    if (bikeMoving || !depotVisitAllowed(visit,'parking') || this.sackInHands) return 0;
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
    return this.sackInHands || this.inHands().length >= HANDS_MAX ? 'cheio' : 'ok';
  }

  /** At the counter: the employee checks the parcels and hands them over (into the hands). */
  collect(kind: StoreKind, hour: number): number {
    if (this.canCollect(kind, hour) !== 'ok') return 0;
    const list = this.readyAt(kind).slice(0,HANDS_MAX-this.inHands().length);
    for (const p of list) { advance(p, 'COLETADO', 'jogador', hour); move(p, 'maos', 'jogador', hour); }
    this.say(`${list.length === 1 ? '1 volume conferido e retirado' : `${list.length} volumes conferidos e retirados`} em ${this.storeOf(kind).name}`);
    if (this.assigned.every((s) => this.readyAt(s).length === 0)) this.phase = 'RETORNO';
    return list.length;
  }

  /** Parcels the player still has to bring to the base (in the hands or in the trunk). */
  carrying(): Parcel[] { return this.parcels.filter((p) => p.holder === 'jogador' && (p.place === 'maos' || p.place === 'bau' || p.place === 'porta-malas') && (p.state === 'COLETADO' || p.state === 'EM_TRANSPORTE')); }

  /** At the receiving desk: the checker takes the parcels the player has IN THE HANDS. */
  handOver(hour: number,visit?:DepotVisit): number {
    if(!depotVisitAllowed(visit,'receiving'))return 0;
    const list = this.inHands().filter(p=>p.state==='COLETADO'||p.state==='EM_TRANSPORTE'||p.state==='TENTATIVA_FRUSTRADA');
    let deposited=0,returned=0;
    for(const p of list){
      if(p.state==='COLETADO')advance(p,'EM_TRANSPORTE','jogador',hour);
      const back=p.state==='TENTATIVA_FRUSTRADA';
      if(this.depot.receive(p,hour,this.parcels)){deposited++;if(back)returned++;}
    }
    if(deposited>returned){
      if(hour>ROUTINE.returnBy)this.late=true;
      if(!this.carrying().length&&this.assigned.every(s=>!this.readyAt(s).length)&&this.phase==='RETORNO')this.phase='CONFERENCIA';
      this.say(`${deposited-returned} volume(s) depositados no recebimento`);
    }
    if(returned)this.say(`${returned} devolução(ões) entregue(s) ao conferente de plantão para conferência`);
    return deposited;
  }
  canTakeSack(hour:number):boolean {
    return hour>=ROUTINE.sackFrom&&!this.inHands().length&&this.parcels.length>0&&this.parcels.every(p=>p.state==='NA_SACA'&&p.place==='saca'&&p.dock===DISPATCH_DOCK&&p.load===MIXED_LOAD&&p.position!==null);
  }

  /** At the dispatch counter: the mixed sack is released to the player (carried in the hands). */
  takeSack(hour: number,visit?:DepotVisit): number {
    if (!depotVisitAllowed(visit,'dispatch') || !this.canTakeSack(hour)) return 0;
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
      if (this.parcels.every(isFinal)) { this.phase = 'CONCLUIDA'; this.say('Rota concluída! Jornada encerrada.'); }
    }
    return list.length;
  }

  // ------------------------------------------------------------------ depot simulation

  /** Advances the depot staff and the parcel flow. `truckDocked` comes from the traffic (or 13h fallback). */
  update(hour: number, dt: number, truckDocked = false): void {
    if (this.phase === 'ANTES' && hour >= ROUTINE.assign) this.start(hour);
    // B1-01 F5: 21h is a deadline (lateness), never an automatic end of the shift (decisions 9/14/17).
    if(this.van.update(truckDocked?Math.max(hour,13):hour,dt,this.parcels.some(p=>p.place==='caminhao'),this.depot.allWorkers.some(w=>w.task?.kind==='truck'))&&this.phase!=='ANTES'){
      this.parcels.filter(p=>p.place==='caminhao').forEach((p,i)=>arriveTruck(p,hour,{x:127.25+(i%3)*.55,y:1.25+(Math.floor(i/3)%2)*.32,z:-117.15+Math.floor(i/6)*.85}));
      this.say('Van na D05 — estacionamento assistido; abrindo portas para descarga');
    }
    this.depot.truckAvailable=this.van.unloading;
    const dh=this.lastHour===null?0:Math.max(0,hour-this.lastHour);this.lastHour=hour;
    // Clock acceleration speeds work up, but even a clock jump cannot consume a whole job in one frame.
    const factor=dt>0?Math.max(1,Math.min(8,dh*DEPOT_OPERATION_SECONDS_PER_VIRTUAL_HOUR/dt)):1;
    for(let left=Math.min(4,dt*factor);left>1e-6;left-=.05)this.depot.update(this.parcels,hour,Math.min(.05,left));
    if(this.phase==='CONFERENCIA'&&this.parcels.every(p=>PARCEL_DONE_IN(p.state)))this.phase='TRIAGEM';
    if((this.phase==='TRIAGEM'||this.phase==='CONFERENCIA')&&this.parcels.every(p=>p.state==='NA_SACA'&&p.place==='saca'))this.phase='SACA';
    this.updateStaff(hour);
  }

  private updateStaff(hour:number):void {
    for(const st of this.staff){
      st.carrying=false;
      const worker=this.depot.workers.find(w=>w.role===st.role);
      // A worker whose shift ended still finishes the parcel in hand (it is never dropped).
      if((hour<st.shift[0]||hour>=st.shift[1])&&!worker?.task){st.state='fora do turno';continue;}
      if(worker){
        st.station=depotWorld(worker.x,worker.z);st.carrying=worker.activity==='carry';
        st.state=worker.task?`${worker.task.kind}: ${worker.task.id} (${worker.task.stage})`:'aguardando tarefa';
      }else st.state=st.role==='porteiro'?'controle de acesso':'supervisionando a operação';
      if(hour>=ROUTINE.end&&st.role==='conferente'&&!worker?.task)st.state='plantão de conferência — aguardando devoluções';
    }
  }

  // ------------------------------------------------------------------ guidance

  /** `bike`: where the parked bike is (target of the "store it in the trunk" steps). */
  objective(hour: number, bike?: { x: number; z: number }): Objective {
    const car = this.carMode;
    const toBike = (title: string): Objective => ({ title, detail: `${this.cargoLabel()} · ${car ? 'vá até a traseira do carro' : 'vá até o baú da moto'}`, target: bike ? { kind: 'moto', id: 'moto', x: bike.x, z: bike.z, label: car ? 'Porta-malas do carro' : 'Baú da moto' } : null, waitUntil: null });
    const depot = (label: string): Target => ({ kind: 'galpao', id: 'galpao', ...DEPOT_SPOTS.receiving, label, yaw: depotYaw(-Math.PI / 2) });
    switch (this.phase) {
      case 'ANTES': return { title: 'Aguardando o início da jornada', detail: 'A designação das lojas sai às 11h', target: null, waitUntil: ROUTINE.assign };
      case 'COLETA': {
        if (this.inHands().length) return toBike(`Guardar os volumes no ${this.compartment}`);
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
        const hands=this.inHands().length,trunk=this.inVehicle().filter((p)=>p.state==='COLETADO'||p.state==='EM_TRANSPORTE').length;
        const box=this.compartment;
        const b=bike?depotLocal(bike.x,bike.z):null;
        if(b&&(b.x<76.2||b.x>139.8||b.z<-150||b.z>-92.2))return {title:'Retornar pela entrada da base',detail:`${trunk} volume(s) no ${box} • acesso pela portaria`,target:{kind:'galpao',id:'entrada',...DEPOT_SPOTS.entry,label:'Entrada da base'},waitUntil:null};
        if(hands)return {title:'Depositar os volumes no recebimento',detail:`${hands} nas mãos • ${trunk} no ${box} • várias viagens se necessário`,target:depot('Descarga / recebimento'),waitUntil:null};
        if(car){const bay=CAR_PARKING[0]!;return {title:'Estacionar numa vaga de carro da base',detail:`${trunk} no porta-malas • pare na vaga, saia, abra o porta-malas e retire até ${HANDS_MAX} volumes por viagem`,target:{kind:'galpao',id:'vaga-carro',...depotWorld((bay.minX+bay.maxX)/2,(bay.minZ+bay.maxZ)/2),label:'Vagas de carro'},waitUntil:null};}
        return {title:'Estacionar na zona de descarga',detail:`${trunk} no baú • pare, desça e retire até ${HANDS_MAX} volumes por viagem`,target:{kind:'galpao',id:'descarga',...DEPOT_SPOTS.parking,label:'Vagas de descarga'},waitUntil:null};
      }
      case 'CONFERENCIA': {
        const checked = this.parcels.filter(p => ['RECEBIDO_BASE', 'TRIADO', 'NA_SACA', 'EM_ROTA', 'ENTREGUE'].includes(p.state)).length;
        const sorted = this.parcels.filter(p => ['TRIADO', 'NA_SACA', 'EM_ROTA', 'ENTREGUE'].includes(p.state)).length;
        const inbound = this.parcels.filter(p => p.place === 'caminhao').length;
        const atDesk = this.parcels.filter(p => p.place === 'recebimento' || p.place === 'conferencia').length;
        const inboundStatus = inbound ? ` · ${inbound} do caminhão ${hour < 13 ? '(chegada às 13h)' : '(em descarga)'}` : '';
        return {
          title: 'Recebimento e triagem em andamento',
          detail: `${checked}/${this.parcels.length} conferidos · ${sorted} triados · ${atDesk} na bancada${inboundStatus} · equipe trabalhando`,
          target: depot('Recebimento'),
          waitUntil: hour < ROUTINE.sackFrom ? ROUTINE.sackFrom : null,
        };
      }
      case 'TRIAGEM':
        return { title: 'Separação e expedição em andamento',
          detail: `${this.count('TRIADO') + this.count('NA_SACA')}/${this.parcels.length} volumes triados · processamento automático`,
          target: { kind: 'galpao', id: 'galpao', ...DEPOT_SPOTS.dispatch, label: 'Expedição' },
          waitUntil: hour < ROUTINE.sackFrom ? ROUTINE.sackFrom : null,
        };
      case 'SACA': {
        const waiting = hour < ROUTINE.sackFrom;
        return { title: waiting ? 'Saca liberada às 15h' : 'Retirar a saca na doca 02', detail: `Saca mista ML/SHP com ${this.count('NA_SACA')} volume(s)`, target: { kind: 'galpao', id: 'galpao', ...DEPOT_SPOTS.dispatch, label: 'Expedição' }, waitUntil: waiting ? ROUTINE.sackFrom : null };
      }
      case 'ENTREGAS': {
        if (this.sackInHands) return toBike(`Guardar a saca no ${this.compartment}`);
        const held = this.inHands()[0];
        const a = this.byAddress.get(held ? held.destination : this.route[0]!)!;
        const where = held ? 'pacote nas mãos' : `estacione e retire o pacote no ${this.compartment}`;
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
