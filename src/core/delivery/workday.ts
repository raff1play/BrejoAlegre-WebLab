import { DepotOperations } from './depotOperations.ts';
import { DEPOT_POINTS, validDepotParking, depotFree, DISPATCH_DOCK, MIXED_LOAD } from '../../world/city/depotPlan.ts';
import { DEPOT, STORES, depotWorld, depotYaw, depotLocal, type StoreKind } from '../../world/city/cityPlan.ts';
import { yawOf } from '../../world/layout.ts';
import { rng } from '../city/traffic.ts';
import { buildAddresses, type Address } from './addresses.ts';
import { advance, createParcel, move, arriveTruck, type Parcel, type ParcelState, type Platform } from './parcels.ts';

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
export const DEPOT_LOCAL_SPOTS = DEPOT_POINTS;
type SpotName = keyof typeof DEPOT_LOCAL_SPOTS;
/** The same spots in world coordinates (metres on the real map). */
export const DEPOT_SPOTS = Object.freeze(Object.fromEntries(
  (Object.keys(DEPOT_LOCAL_SPOTS) as SpotName[]).map((k) => [k, depotWorld(DEPOT_LOCAL_SPOTS[k].x, DEPOT_LOCAL_SPOTS[k].z)]),
) as Record<SpotName, { x: number; z: number }>);

export type DepotRole = 'porteiro' | 'conferente' | 'descarregador-1' | 'descarregador-2' | 'separador-1' | 'separador-2' | 'expedidor' | 'supervisor';
export type DepotStaff = { role: DepotRole; state: string; station: { x: number; z: number }; shift: [number, number]; carrying: boolean };

export type DepotVisit = {player:{x:number;z:number;riding:boolean};bike:{x:number;z:number;yaw:number;moving:boolean}};
export function depotVisitAllowed(visit:DepotVisit|undefined,at:'receiving'|'dispatch'|'parking'):boolean {
 if(!visit||visit.player.riding||visit.bike.moving)return false;
 const b=depotLocal(visit.bike.x,visit.bike.z),p=depotLocal(visit.player.x,visit.player.z);
 if(!validDepotParking({...b,yaw:visit.bike.yaw-depotYaw(0),moving:visit.bike.moving})||!depotFree(p,.25))return false;
 if(at==='parking')return Math.hypot(visit.player.x-(visit.bike.x-Math.sin(visit.bike.yaw)*1.25),visit.player.z-(visit.bike.z-Math.cos(visit.bike.yaw)*1.25))<1.1;
 return Math.hypot(p.x-DEPOT_POINTS[at].x,p.z-DEPOT_POINTS[at].z)<1.45;
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
      st('descarregador-1', depotWorld(104, -121), [10, 21]), st('descarregador-2', depotWorld(120, -121), [10, 21]),
      st('separador-1', depotWorld(108, -128), [12, 21]), st('separador-2', depotWorld(113, -131), [12, 21]),
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
  handOver(hour: number,visit?:DepotVisit): number {
    if(!depotVisitAllowed(visit,'receiving'))return 0;
    const list = this.inHands().filter(p=>p.state==='COLETADO'||p.state==='EM_TRANSPORTE');
    for(const p of list){
      if(p.state==='COLETADO')advance(p,'EM_TRANSPORTE','jogador',hour);
      this.depot.receive(p,hour);
    }
    if(list.length){
      if(hour>ROUTINE.returnBy)this.late=true;
      if(!this.carrying().length&&this.assigned.every(s=>!this.readyAt(s).length))this.phase='CONFERENCIA';
      this.say(`${list.length} volume(s) depositados no recebimento`);
    }
    return list.length;
  }
  canTakeSack(hour:number):boolean {
    return hour>=ROUTINE.sackFrom&&hour<ROUTINE.end&&!this.inHands().length&&this.parcels.length>0&&this.parcels.every(p=>p.state==='NA_SACA'&&p.place==='saca'&&p.dock===DISPATCH_DOCK&&p.load===MIXED_LOAD&&p.position!==null);
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
    if(!this.truckArrived&&(truckDocked||hour>=13)&&this.phase!=='ANTES'){
      this.truckArrived=true;this.depot.truckAvailable=true;
      this.parcels.filter(p=>p.place==='caminhao').forEach((p,i)=>arriveTruck(p,hour,{x:127.55+(i%2)*.8,y:1.1+Math.floor(i/2)*.3,z:-117.4}));
      this.say('Caminhão recebido na doca 05: descarga física iniciada');
    }
    const dh=this.lastHour===null?0:Math.max(0,hour-this.lastHour);this.lastHour=hour;
    // Clock acceleration speeds work up, but even a clock jump cannot consume a whole job in one frame.
    const factor=dt>0?Math.max(1,Math.min(8,dh*240/dt)):1;
    for(let left=Math.min(4,dt*factor);left>1e-6;left-=.05)this.depot.update(this.parcels,hour,Math.min(.05,left));
    if(this.phase==='CONFERENCIA'&&this.parcels.every(p=>PARCEL_DONE_IN(p.state)))this.phase='TRIAGEM';
    if((this.phase==='TRIAGEM'||this.phase==='CONFERENCIA')&&this.parcels.every(p=>p.state==='NA_SACA'&&p.place==='saca'))this.phase='SACA';
    this.updateStaff(hour);
  }

  private updateStaff(hour:number):void {
    for(const st of this.staff){
      st.carrying=false;
      if(hour<st.shift[0]||hour>=st.shift[1]){st.state='fora do turno';continue;}
      const worker=this.depot.workers.find(w=>w.role===st.role);
      if(worker){
        st.station=depotWorld(worker.x,worker.z);st.carrying=worker.activity==='carry';
        st.state=worker.task?`${worker.task.kind}: ${worker.task.id} (${worker.task.stage})`:'aguardando tarefa';
      }else st.state=st.role==='porteiro'?'controle de acesso':'supervisionando a operação';
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
        const hands=this.inHands().length,trunk=this.trunkForDepot().length;
        const b=bike?depotLocal(bike.x,bike.z):null;
        if(b&&(b.x<76.2||b.x>139.8||b.z<-150||b.z>-92.2))return {title:'Retornar pela entrada da base',detail:`${trunk} volume(s) no baú • acesso pela portaria`,target:{kind:'galpao',id:'entrada',...DEPOT_SPOTS.entry,label:'Entrada da base'},waitUntil:null};
        return hands?{title:'Depositar os volumes no recebimento',detail:`${hands} nas mãos • ${trunk} no baú • várias viagens se necessário`,target:depot('Descarga / recebimento'),waitUntil:null}
        :{title:'Estacionar na zona de descarga',detail:`${trunk} no baú • pare, desça e retire até ${HANDS_MAX} volumes por viagem`,target:{kind:'galpao',id:'descarga',...DEPOT_SPOTS.parking,label:'Vagas de descarga'},waitUntil:null};
      }
      case 'CONFERENCIA': return { title: 'Conferência no recebimento', detail: `${this.parcels.filter(p=>p.place==='recebimento'||p.place==='conferencia').length} volume(s) no recebimento/conferência`, target: depot('Recebimento'), waitUntil: null };
      case 'TRIAGEM': {
        const waiting = hour < ROUTINE.sortFrom;
        return { title: waiting ? 'Aguardar a triagem (14h)' : 'Triagem em andamento', detail: `${this.count('TRIADO') + this.count('NA_SACA')}/${this.parcels.length} volumes triados`, target: { kind: 'galpao', id: 'galpao', ...DEPOT_SPOTS.dispatch, label: 'Expedição' }, waitUntil: waiting ? ROUTINE.sortFrom : null };
      }
      case 'SACA': {
        const waiting = hour < ROUTINE.sackFrom;
        return { title: waiting ? 'Saca liberada às 15h' : 'Retirar a saca na doca 02', detail: `Saca mista ML/SHP com ${this.count('NA_SACA')} volume(s)`, target: { kind: 'galpao', id: 'galpao', ...DEPOT_SPOTS.dispatch, label: 'Expedição' }, waitUntil: waiting ? ROUTINE.sackFrom : null };
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
