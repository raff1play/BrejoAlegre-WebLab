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

export type ParcelEvent = Readonly<{ state: ParcelState; hour: number; by: string }>;
export type Parcel = {
  readonly id: string;
  readonly origin: string;
  readonly destination: string;
  readonly platform: Platform;
  readonly region: string;
  state: ParcelState;
  holder: string;
  readonly history: ParcelEvent[];
};

export function createParcel(id: string, origin: string, destination: string, platform: Platform, region: string, state: ParcelState, holder: string, hour: number): Parcel {
  return { id, origin, destination, platform, region, state, holder, history: [{ state, hour, by: holder }] };
}

export class ParcelError extends Error {}

/** Moves a parcel exactly one stage forward; anything else is a logic error. */
export function advance(p: Parcel, to: ParcelState, holder: string, hour: number): void {
  const from = PARCEL_FLOW.indexOf(p.state);
  const next = PARCEL_FLOW.indexOf(to);
  if (next !== from + 1) throw new ParcelError(`${p.id}: ${p.state} → ${to} não é permitido`);
  p.state = to;
  p.holder = holder;
  p.history.push({ state: to, hour, by: holder });
}
