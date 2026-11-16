import type { Sector } from './sectors.ts';
/**
 * CORE-014 parcel model. Every parcel has a unique id, origin, destination, fictional platform,
 * region (bairro), state, holder and a full history. States only move forward one step at a time,
 * so a parcel can never skip a stage, go back, or be counted twice.
 */
export const PARCEL_FLOW = ['NA_LOJA', 'COLETADO', 'EM_TRANSPORTE', 'RECEBIDO_BASE', 'TRIADO', 'NA_SACA', 'EM_ROTA', 'ENTREGUE'] as const;
/**
 * B1-01 F5 (decisions 9/13, AC-11/AC-12): a failed attempt is NOT a final result. The parcel stays
 * in custody (`TENTATIVA_FRUSTRADA`) until it is physically returned to the base and checked by an
 * on-duty checker, which gives the OTHER final result `DEVOLVIDO_E_CONFERIDO` (never `ENTREGUE`,
 * never paid as a delivery). These two states are off the forward-only main flow.
 */
export const RETURN_STATES = ['TENTATIVA_FRUSTRADA', 'DEVOLVIDO_E_CONFERIDO'] as const;
export const PARCEL_STATES = [...PARCEL_FLOW, ...RETURN_STATES] as const;
export type ParcelState = (typeof PARCEL_STATES)[number];
/** Final, valid results of a parcel's procedure. Nothing else may close a shift. */
export const FINAL_STATES: readonly ParcelState[] = ['ENTREGUE', 'DEVOLVIDO_E_CONFERIDO'];
export const isFinal = (p: { state: ParcelState }): boolean => FINAL_STATES.includes(p.state);
/** Fictional marketplaces (codes only; no real brand is represented). */
export type Platform = 'ML' | 'SHP' | 'LOJA';
export const PLATFORM_LABEL: Record<Platform, string> = { ML: 'Plataforma ML (fictícia)', SHP: 'Plataforma SHP (fictícia)', LOJA: 'Loja local' };

/**
 * CORE-015.1: WHERE a parcel physically is, separate from its operational state. A parcel is in
 * exactly one place; it only moves along PLACE_MOVES (no teleporting from the trunk to a customer).
 */
export type ParcelPlace = 'loja' | 'caminhao' | 'maos' | 'bau' | 'porta-malas' | 'devolucoes' | 'galpao' | 'saca' | 'destinatario' | 'recebimento' | 'conferencia' | 'transferencia' | 'triagem' | 'gaiola' | 'doca';
export const PLACE_MOVES: Readonly<Record<ParcelPlace, readonly ParcelPlace[]>> = {
  loja: ['maos'],
  caminhao: ['transferencia'],
  maos: ['bau', 'porta-malas', 'recebimento', 'destinatario'],
  bau: ['maos'],
  /** B1-01 F3: the boot of the player's own car. In and out only through the hands. */
  'porta-malas': ['maos'],
  galpao: [],
  saca: ['maos'],
  recebimento: ['conferencia'],
  conferencia: ['transferencia', 'devolucoes'],
  /** B1-01 F5: shelf of checked returns beside the receiving desk (final place, never leaves). */
  devolucoes: [],
  transferencia: ['recebimento','triagem','gaiola','doca'],
  triagem: ['transferencia'],
  gaiola: ['transferencia'],
  doca: ['saca'],
  destinatario: [],
};
export const PLACE_LABEL: Record<ParcelPlace, string> = {
  recebimento:'no recebimento',conferencia:'em conferência',transferencia:'em transferência',triagem:'na triagem',gaiola:'na gaiola regional',doca:'na doca',
  devolucoes: 'nas devoluções conferidas', loja: 'na loja', caminhao: 'no caminhão', maos: 'nas mãos', bau: 'no baú', 'porta-malas': 'no porta-malas', galpao: 'no galpão', saca: 'na saca', destinatario: 'com o destinatário',
};

export type ParcelPosition = { x:number; y:number; z:number };
/**
 * B1-01 F3 (contract C2): where a parcel physically sits inside a vehicle compartment. Set if and
 * only if `place === 'porta-malas'`; it IS the box's slot (min corner + placed extents, metres, in
 * the compartment frame), not a copy kept by the 3D view. Frame: x across the boot from the left
 * wall, y up from the boot floor, z from the rear-seat back towards the tailgate.
 */
export type Stowage = Readonly<{ compartment: 'porta-malas'; vehicleId: string; x: number; y: number; z: number; w: number; h: number; d: number }>;
export type ParcelEvent = Readonly<{ state: ParcelState; place: ParcelPlace; hour: number; by: string; holder:string; position:ParcelPosition|null; dock:string|null; load:string|null; operation:string }>;
const event=(p:Parcel,hour:number,operation:string):ParcelEvent=>({state:p.state,place:p.place,hour,by:p.holder,holder:p.holder,position:p.position?{...p.position}:null,dock:p.dock,load:p.load,operation});
export type Parcel = {
  readonly id: string;
  collector?: string;
  sector?: Sector;
  readonly origin: string;
  readonly destination: string;
  readonly platform: Platform;
  readonly region: string;
  state: ParcelState;
  place: ParcelPlace;
  holder: string;
  /** Continuous depot-local position; null while represented by the player/trunk/store. */
  position: ParcelPosition | null;
  dock: string | null;
  load: string | null;
  /** B1-01 F3: slot in the car boot while `place === 'porta-malas'`, otherwise null. */
  stowage: Stowage | null;
  readonly history: ParcelEvent[];
};

export function createParcel(id: string, origin: string, destination: string, platform: Platform, region: string, state: ParcelState, holder: string, hour: number, place: ParcelPlace = state === 'NA_LOJA' ? 'loja' : 'caminhao'): Parcel {
  const p:Parcel = {id,origin,destination,platform,region,state,place,holder,position:null,dock:null,load:null,stowage:null,history:[]};
  p.history.push(event(p,hour,'criado'));return p;
}

export class ParcelError extends Error {}

/** Moves a parcel exactly one stage forward; anything else is a logic error. */
export function advance(p: Parcel, to: ParcelState, holder: string, hour: number): void {
  if(!holder||!Number.isFinite(hour))throw new ParcelError(`${p.id}: custódia/horário inválidos`);
  const from = (PARCEL_FLOW as readonly string[]).indexOf(p.state);
  const next = (PARCEL_FLOW as readonly string[]).indexOf(to);
  if (from < 0 || next !== from + 1) throw new ParcelError(`${p.id}: ${p.state} → ${to} não é permitido`);
  const allowed:Partial<Record<ParcelState,readonly ParcelPlace[]>>={COLETADO:['loja'],EM_TRANSPORTE:['maos'],RECEBIDO_BASE:['conferencia'],TRIADO:['triagem'],NA_SACA:['doca'],EM_ROTA:['saca'],ENTREGUE:['maos']};
  if(allowed[to]&&!allowed[to]!.includes(p.place))throw new ParcelError(`${p.id}: ${to} incompatível com ${p.place}`);
  p.state = to;
  p.holder = holder;
  p.history.push(event(p,hour,`estado:${to}`));
}

/**
 * Physically moves a parcel to an adjacent place; anything else is a logic error. B1-01 F3: going
 * into the car boot requires its slot (`stowage`); leaving the boot clears it.
 */
export function move(p: Parcel, to: ParcelPlace, by: string, hour: number, position:ParcelPosition|null = null, stowage:Stowage|null = null): void {
  if(!by||!Number.isFinite(hour))throw new ParcelError(`${p.id}: custódia/horário inválidos`);
  if((to==='porta-malas')!==(stowage!==null))throw new ParcelError(`${p.id}: posição no porta-malas ${to==='porta-malas'?'obrigatória':'só vale no porta-malas'}`);
  if(stowage&&![stowage.x,stowage.y,stowage.z,stowage.w,stowage.h,stowage.d].every(Number.isFinite))throw new ParcelError(`${p.id}: posição no porta-malas inválida`);
  if(to==='transferencia'&&((p.place==='conferencia'&&p.state!=='RECEBIDO_BASE')||(['triagem','gaiola'].includes(p.place)&&p.state!=='TRIADO')))throw new ParcelError(`${p.id}: transferência sem processamento`);
  if (!PLACE_MOVES[p.place].includes(to)) throw new ParcelError(`${p.id}: ${p.place} → ${to} não é permitido`);
  if (['recebimento','conferencia','transferencia','triagem','gaiola','doca'].includes(to) && (!position || !Object.values(position).every(Number.isFinite))) throw new ParcelError(`${p.id}: posição física obrigatória em ${to}`);
  const required:Partial<Record<ParcelPlace,readonly ParcelState[]>>={recebimento:['EM_TRANSPORTE','TENTATIVA_FRUSTRADA'],conferencia:['EM_TRANSPORTE','TENTATIVA_FRUSTRADA'],triagem:['RECEBIDO_BASE'],gaiola:['TRIADO'],doca:['TRIADO'],saca:['NA_SACA'],destinatario:['ENTREGUE'],devolucoes:['DEVOLVIDO_E_CONFERIDO']};
  if(required[to]&&!required[to]!.includes(p.state))throw new ParcelError(`${p.id}: ${to} incompatível com ${p.state}`);
  if(to==='devolucoes'&&!position)throw new ParcelError(`${p.id}: posição física obrigatória em devolucoes`);
  if(to==='saca'&&(!p.dock||!p.load||!position))throw new ParcelError(`${p.id}: saca sem doca/carga física`);
  p.place = to; p.holder=by; p.position=position?{...position}:null; p.stowage=stowage?Object.freeze({...stowage}):null;
  p.history.push(event(p,hour,`transferência:${to}`));
}

/**
 * B1-01 F3: automatic re-arrangement INSIDE the boot (same place, same holder, same custody).
 * Only the slot changes; the history records the re-arrangement so the movement stays auditable.
 */
export function restow(p: Parcel, stowage: Stowage, by: string, hour: number): void {
  if(p.place!=='porta-malas'||!p.stowage)throw new ParcelError(`${p.id}: rearranjo fora do porta-malas`);
  if(p.holder!==by||stowage.vehicleId!==p.stowage.vehicleId)throw new ParcelError(`${p.id}: rearranjo por outra custódia/veículo`);
  if(![stowage.x,stowage.y,stowage.z,stowage.w,stowage.h,stowage.d].every(Number.isFinite))throw new ParcelError(`${p.id}: posição no porta-malas inválida`);
  p.stowage=Object.freeze({...stowage});
  p.history.push(event(p,hour,'arrumação:porta-malas'));
}

/**
 * B1-01 F5 (AC-11): the recipient was not there. The attempt is recorded at the address; the parcel
 * stays in the courier's hands, under the same custody, and is NOT final.
 */
export function attemptFailed(p: Parcel, by: string, hour: number): void {
  if (!by || !Number.isFinite(hour)) throw new ParcelError(`${p.id}: custódia/horário inválidos`);
  if (p.state !== 'EM_ROTA' || p.place !== 'maos' || p.holder !== by) throw new ParcelError(`${p.id}: tentativa só com o pacote em rota nas mãos de ${by}`);
  p.state = 'TENTATIVA_FRUSTRADA';
  p.history.push(event(p, hour, 'tentativa:frustrada'));
}

/**
 * B1-01 F5 (AC-12, AC-25): an on-duty checker confirms a returned parcel at the desk. Only from the
 * check station (`conferencia`) and only once; the parcel is then put on the returns shelf.
 */
export function confirmReturn(p: Parcel, checker: string, hour: number, shelf: ParcelPosition): void {
  if (!checker || !Number.isFinite(hour)) throw new ParcelError(`${p.id}: custódia/horário inválidos`);
  if (p.state !== 'TENTATIVA_FRUSTRADA' || p.place !== 'conferencia') throw new ParcelError(`${p.id}: devolução só se confere na conferência, uma vez`);
  p.state = 'DEVOLVIDO_E_CONFERIDO'; p.holder = checker;
  p.history.push(event(p, hour, 'estado:DEVOLVIDO_E_CONFERIDO'));
  move(p, 'devolucoes', checker, hour, shelf);
}

/** Arrival in the same vehicle, before any unloading task; retains the original ID. */
export function arriveTruck(p:Parcel,hour:number,position:ParcelPosition):void {
 if(p.place!=='caminhao'||p.position)throw new ParcelError(`${p.id}: chegada duplicada/inválida`);
 p.position={...position};p.history.push(event(p,hour,'caminhão:doca05'));
}
