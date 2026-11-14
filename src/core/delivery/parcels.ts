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
export type ParcelPlace = 'loja' | 'caminhao' | 'maos' | 'bau' | 'galpao' | 'saca' | 'destinatario';
export const PLACE_MOVES: Readonly<Record<ParcelPlace, readonly ParcelPlace[]>> = {
  loja: ['maos'],
  caminhao: ['galpao'],
  maos: ['bau', 'galpao', 'destinatario'],
  bau: ['maos'],
  galpao: ['saca'],
  saca: ['maos'],
  destinatario: [],
};
export const PLACE_LABEL: Record<ParcelPlace, string> = {
  loja: 'na loja', caminhao: 'no caminhão', maos: 'nas mãos', bau: 'no baú', galpao: 'no galpão', saca: 'na saca', destinatario: 'com o destinatário',
};

export type ParcelEvent = Readonly<{ state: ParcelState; place: ParcelPlace; hour: number; by: string }>;
export type Parcel = {
  readonly id: string;
  readonly origin: string;
  readonly destination: string;
  readonly platform: Platform;
  readonly region: string;
  state: ParcelState;
  place: ParcelPlace;
  holder: string;
  readonly history: ParcelEvent[];
};

export function createParcel(id: string, origin: string, destination: string, platform: Platform, region: string, state: ParcelState, holder: string, hour: number, place: ParcelPlace = state === 'NA_LOJA' ? 'loja' : 'caminhao'): Parcel {
  return { id, origin, destination, platform, region, state, place, holder, history: [{ state, place, hour, by: holder }] };
}

export class ParcelError extends Error {}

/** Moves a parcel exactly one stage forward; anything else is a logic error. */
export function advance(p: Parcel, to: ParcelState, holder: string, hour: number): void {
  const from = PARCEL_FLOW.indexOf(p.state);
  const next = PARCEL_FLOW.indexOf(to);
  if (next !== from + 1) throw new ParcelError(`${p.id}: ${p.state} → ${to} não é permitido`);
  p.state = to;
  p.holder = holder;
  p.history.push({ state: to, place: p.place, hour, by: holder });
}

/** Physically moves a parcel to an adjacent place; anything else is a logic error. */
export function move(p: Parcel, to: ParcelPlace, by: string, hour: number): void {
  if (!PLACE_MOVES[p.place].includes(to)) throw new ParcelError(`${p.id}: ${p.place} → ${to} não é permitido`);
  p.place = to;
  p.history.push({ state: p.state, place: to, hour, by });
}
