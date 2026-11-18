import type { ParcelEvent, ParcelPlace, ParcelState, Platform } from '../delivery/parcels.ts';
import type { VehicleKind } from './careers.ts';

/**
 * B1-01 F6 (decisions 9/13, AC-12/AC-22, contract C4): idempotent pay ledger of the ACTIVE career.
 *
 * Source of every value: the economic table already approved in `docs/product/ORIGINAL_GODOT_SPEC.md`
 * (decision D07 and section 5), which AC-22 calls the "especificação econômica vigente" and which
 * the F1 re-audit (PR #15, comment 6899766654) told this module to honour. Nothing else is invented:
 * no bonus, fine, fuel, maintenance or NPC income. Values are integer cents.
 *
 * | Event    | Who is paid | Condition (proved by the parcel's own history)                         | Value |
 * |----------|-------------|------------------------------------------------------------------------|-------|
 * | COLETA   | the player  | collected by the player at the store AND physically received at base   | R$ 0,50 |
 * | ENTREGA  | the player  | handed over by the player to the recipient (`ENTREGUE`)                | moto ML R$ 7 / SHP R$ 5; carro ML R$ 9 / SHP R$ 5 |
 * | —        | nobody      | NPC delivery, failed attempt, return (`DEVOLVIDO_E_CONFERIDO`), transfer | R$ 0 |
 *
 * Every event is keyed by `<shiftId>/<parcelId>/<kind>`: derived, never free. Paying is computing
 * the events due from the parcels and adding only the ones not in the ledger yet, so re-applying it
 * after a reload or a restored checkpoint never pays twice.
 */
export const PAYMENT_KINDS = ['COLETA', 'ENTREGA'] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];
export const RATE_SOURCE = 'D07 · docs/product/ORIGINAL_GODOT_SPEC.md §5';

/** Integer cents; `null` = no approved value (never paid, never guessed). */
export function rateCents(kind: PaymentKind, vehicle: VehicleKind, platform: Platform): number | null {
  if (kind === 'COLETA') return 50;
  if (platform === 'ML') return vehicle === 'carro-antigo' ? 900 : 700;
  if (platform === 'SHP') return 500;
  // 'LOJA' (legacy single-courier scenario only): D07 has no value for it. Recorded as a divergence
  // in the F6 note; no amount is invented and no event is created.
  return null;
}

export type PaymentRecord = Readonly<{
  eventId: string; shiftId: string; parcelId: string; kind: PaymentKind; amountCents: number;
  /** Vehicle and platform the value was looked up with (auditable). */
  vehicle: VehicleKind; platform: Platform;
}>;

export const paymentEventId = (shiftId: string, parcelId: string, kind: PaymentKind): string => `${shiftId}/${parcelId}/${kind}`;

type ParcelLike = Readonly<{ id: string; platform: Platform; collector?: string | null; state: ParcelState; place: ParcelPlace; history: readonly ParcelEvent[] }>;

/** The player collected it at the store counter (the COLETADO step was in the player's custody). */
export function collectedByPlayer(p: ParcelLike): boolean {
  return p.collector === 'jogador' && p.history.some((e) => e.operation === 'estado:COLETADO' && e.holder === 'jogador');
}
/** Physically received at the base: the checker confirmed it (`RECEBIDO_BASE`) after the collection. */
export function receivedAtBase(p: ParcelLike): boolean {
  const ops = p.history.map((e) => e.operation);
  const c = ops.indexOf('estado:COLETADO'); const r = ops.indexOf('estado:RECEBIDO_BASE');
  return c >= 0 && r > c;
}
/** Delivered by the player: the event right before `ENTREGUE` has the parcel in the player's hands. */
export function deliveredByPlayer(p: ParcelLike): boolean {
  if (p.state !== 'ENTREGUE' || p.place !== 'destinatario') return false;
  const i = p.history.findIndex((e) => e.operation === 'estado:ENTREGUE');
  if (i < 1) return false;
  const before = p.history[i - 1]!;
  return before.place === 'maos' && before.holder === 'jogador';
}

/** Events the player has earned in this shift, from the parcels' own histories (pure). */
export function dueEvents(parcels: readonly ParcelLike[], shiftId: string, vehicle: VehicleKind): PaymentRecord[] {
  const out: PaymentRecord[] = [];
  const add = (p: ParcelLike, kind: PaymentKind): void => {
    const amount = rateCents(kind, vehicle, p.platform);
    if (amount === null) return;
    out.push(Object.freeze({ eventId: paymentEventId(shiftId, p.id, kind), shiftId, parcelId: p.id, kind, amountCents: amount, vehicle, platform: p.platform }));
  };
  for (const p of parcels) {
    if (collectedByPlayer(p) && receivedAtBase(p)) add(p, 'COLETA');
    if (deliveredByPlayer(p)) add(p, 'ENTREGA');
  }
  return out;
}

/**
 * Adds to `ledger` the due events it does not have yet (idempotent). Returns the new ledger and
 * what was added; an existing event is never changed, removed or paid again.
 */
export function settle(ledger: readonly PaymentRecord[], parcels: readonly ParcelLike[], shiftId: string, vehicle: VehicleKind): { ledger: PaymentRecord[]; added: PaymentRecord[] } {
  const have = new Set(ledger.map((p) => p.eventId));
  const added = dueEvents(parcels, shiftId, vehicle).filter((e) => !have.has(e.eventId));
  return { ledger: [...ledger, ...added], added };
}

export const ledgerTotal = (ledger: readonly PaymentRecord[]): number => ledger.reduce((s, p) => s + p.amountCents, 0);
export const formatCents = (cents: number): string => `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`;
