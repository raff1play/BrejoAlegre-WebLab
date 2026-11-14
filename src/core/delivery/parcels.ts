/**
 * CORE-014 parcel model. Every parcel has a unique id, origin, destination, fictional platform,
 * region (bairro), state, holder and a full history. States only move forward one step at a time,
 * so a parcel can never skip a stage, go back, or be counted twice.
 */
export const PARCEL_FLOW = ['NA_LOJA', 'COLETADO', 'EM_TRANSPORTE', 'RECEBIDO_BASE', 'TRIADO', 'NA_SACA', 'EM_ROTA', 'ENTREGUE'] as const;
export type ParcelState = (typeof PARCEL_FLOW)[number];
/** Fictional marketplaces (codes only; no real brand is represented). */
export type Platform = 'ML' | 'SHP' | 'LOJA';
export const PLATFORM_LABEL: Record<Platform, string> = { ML: 'Plataforma ML (fictícia)', SHP: 'Plataforma SHP (fictícia)', LOJA: 'Loja local' };

/**
 * CORE-015.1: WHERE a parcel physically is, separate from its operational state. A parcel is in
 * exactly one place; it only moves along PLACE_MOVES (no teleporting from the trunk to a customer).
 */
export type ParcelPlace = 'loja' | 'caminhao' | 'maos' | 'bau' | 'galpao' | 'saca' | 'destinatario' | 'recebimento' | 'conferencia' | 'transferencia' | 'triagem' | 'gaiola' | 'doca';
export const PLACE_MOVES: Readonly<Record<ParcelPlace, readonly ParcelPlace[]>> = {
  loja: ['maos'],
  caminhao: ['galpao', 'transferencia'],
  maos: ['bau', 'galpao', 'recebimento', 'destinatario'],
  bau: ['maos'],
  galpao: ['saca'],
  saca: ['maos'],
  recebimento: ['conferencia'],
  conferencia: ['transferencia'],
  transferencia: ['recebimento','triagem','gaiola','doca'],
  triagem: ['transferencia'],
  gaiola: ['transferencia'],
  doca: ['saca'],
  destinatario: [],
};
export const PLACE_LABEL: Record<ParcelPlace, string> = {
  recebimento:'no recebimento',conferencia:'em conferência',transferencia:'em transferência',triagem:'na triagem',gaiola:'na gaiola regional',doca:'na doca',
  loja: 'na loja', caminhao: 'no caminhão', maos: 'nas mãos', bau: 'no baú', galpao: 'no galpão', saca: 'na saca', destinatario: 'com o destinatário',
};

export type ParcelPosition = { x:number; y:number; z:number };
export type ParcelEvent = Readonly<{ state: ParcelState; place: ParcelPlace; hour: number; by: string; holder:string; position:ParcelPosition|null; dock:string|null; load:string|null; operation:string }>;
const event=(p:Parcel,hour:number,operation:string):ParcelEvent=>({state:p.state,place:p.place,hour,by:p.holder,holder:p.holder,position:p.position?{...p.position}:null,dock:p.dock,load:p.load,operation});
export type Parcel = {
  readonly id: string;
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
  readonly history: ParcelEvent[];
};

export function createParcel(id: string, origin: string, destination: string, platform: Platform, region: string, state: ParcelState, holder: string, hour: number, place: ParcelPlace = state === 'NA_LOJA' ? 'loja' : 'caminhao'): Parcel {
  const p:Parcel = {id,origin,destination,platform,region,state,place,holder,position:null,dock:null,load:null,history:[]};
  p.history.push(event(p,hour,'criado'));return p;
}

export class ParcelError extends Error {}

/** Moves a parcel exactly one stage forward; anything else is a logic error. */
export function advance(p: Parcel, to: ParcelState, holder: string, hour: number): void {
  const from = PARCEL_FLOW.indexOf(p.state);
  const next = PARCEL_FLOW.indexOf(to);
  if (next !== from + 1) throw new ParcelError(`${p.id}: ${p.state} → ${to} não é permitido`);
  const allowed:Partial<Record<ParcelState,readonly ParcelPlace[]>>={COLETADO:['loja'],EM_TRANSPORTE:['maos'],RECEBIDO_BASE:['conferencia'],TRIADO:['triagem'],NA_SACA:['doca'],EM_ROTA:['saca'],ENTREGUE:['maos']};
  if(allowed[to]&&!allowed[to]!.includes(p.place))throw new ParcelError(`${p.id}: ${to} incompatível com ${p.place}`);
  p.state = to;
  p.holder = holder;
  p.history.push(event(p,hour,`estado:${to}`));
}

/** Physically moves a parcel to an adjacent place; anything else is a logic error. */
export function move(p: Parcel, to: ParcelPlace, by: string, hour: number, position:ParcelPosition|null = null): void {
  if (!PLACE_MOVES[p.place].includes(to)) throw new ParcelError(`${p.id}: ${p.place} → ${to} não é permitido`);
  if (['recebimento','conferencia','transferencia','triagem','gaiola','doca'].includes(to) && (!position || !Object.values(position).every(Number.isFinite))) throw new ParcelError(`${p.id}: posição física obrigatória em ${to}`);
  const required:Partial<Record<ParcelPlace,ParcelState>>={recebimento:'EM_TRANSPORTE',conferencia:'EM_TRANSPORTE',triagem:'RECEBIDO_BASE',gaiola:'TRIADO',doca:'TRIADO',saca:'NA_SACA',destinatario:'ENTREGUE'};
  if(required[to]&&p.state!==required[to])throw new ParcelError(`${p.id}: ${to} incompatível com ${p.state}`);
  if(to==='saca'&&(!p.dock||!p.load||!position))throw new ParcelError(`${p.id}: saca sem doca/carga física`);
  p.place = to; p.holder=by; p.position=position?{...position}:null;
  p.history.push(event(p,hour,`transferência:${to}`));
}

/** Arrival in the same vehicle, before any unloading task; retains the original ID. */
export function arriveTruck(p:Parcel,hour:number,position:ParcelPosition):void {
 if(p.place!=='caminhao'||p.position)throw new ParcelError(`${p.id}: chegada duplicada/inválida`);
 p.position={...position};p.history.push(event(p,hour,'caminhão:doca05'));
}
