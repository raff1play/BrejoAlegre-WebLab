import type { LogisticsDay } from '../delivery/logisticsDay.ts';
import { ACTORS } from '../delivery/dailyDemand.ts';
import { isFinal, type Parcel } from '../delivery/parcels.ts';
import { WORKDAY_START } from '../city/clock.ts';
import { CHARACTERS, buildRoster, careerHome, type CareerId, type VehicleKind } from './careers.ts';
import type { CareerSession } from './careerStore.ts';
import { ledgerTotal, settle } from './ledger.ts';
import {
  SaveError, captureParcels, sealSave, shiftHourOf, shiftIdOf,
  type CareerProfile, type CareerSave, type ClosedShift, type PlayerSnapshot, type ShiftSnapshot,
} from './snapshot.ts';

/**
 * B1-01 F6 (decisions 4, 10, 11, 16; AC-18–AC-22; contract C5): durable checkpoints of the running
 * shift of the ACTIVE career, their restoration, and the minimum end of shift at home.
 *
 * A checkpoint is taken between two frames, so every domain transition (a hand-over, a stow, a
 * depot step) is either entirely in it or entirely out of it: there is no partial operation. The
 * snapshot is validated in full (`sealSave`) before the store touches anything; a failed write
 * keeps the previous save and the game keeps running (and retries).
 */
export type ShiftCapture = Readonly<{ day: LogisticsDay; shiftHour: number; player: PlayerSnapshot; vehicle: VehicleKind }>;

/** Minutes since 11h45 of the shift's own day; never negative. */
export const elapsedMinutesOf = (shiftHour: number): number => Math.max(0, (shiftHour - WORKDAY_START) * 60);

/**
 * The next checkpoint's profile + shift (pure). The pay ledger is settled from the parcels'
 * histories (idempotent); the balance is always the shift's opening balance plus its ledger.
 */
export function captureShift(profile: CareerProfile, previous: ShiftSnapshot | null, cap: ShiftCapture): { profile: CareerProfile; shift: ShiftSnapshot } {
  const careerId = profile.careerId;
  if (profile.vehicle?.kind !== cap.vehicle) throw new SaveError('Veículo do mundo diverge do veículo da carreira');
  const shiftId = shiftIdOf(careerId, profile.calendarIndex);
  if (previous && previous.shiftId !== shiftId) throw new SaveError('Checkpoint de outro expediente');
  const elapsed = elapsedMinutesOf(cap.shiftHour);
  // Decisions 14/17: the shift clock only moves forward, also across 00h and across restores.
  if (previous && elapsed < previous.elapsedVirtualMinutes) throw new SaveError(`Relógio do expediente regrediu (${elapsed.toFixed(1)} < ${previous.elapsedVirtualMinutes.toFixed(1)} min)`);
  const parcels = captureParcels(cap.day.parcels);
  const opening = previous ? previous.openingBalanceCents : profile.balanceCents;
  const { ledger } = settle(previous?.payments ?? [], parcels, shiftId, cap.vehicle);
  const report = cap.day.report(cap.shiftHour);
  const lateByActor = Object.fromEntries(ACTORS.map((a) => [a, report.find((r) => r.actor === a)?.lateMinutes ?? null])) as ShiftSnapshot['lateByActor'];
  const v = cap.player.vehicle;
  const shift: ShiftSnapshot = {
    shiftId, careerId, calendarIndex: profile.calendarIndex, elapsedVirtualMinutes: elapsed, shiftHour: shiftHourOf(elapsed),
    phase: cap.day.phase, roster: buildRoster(careerId), parcels, payments: ledger, openingBalanceCents: opening, lateByActor,
    safePoint: { x: v.x, z: v.z, yaw: v.yaw, label: cap.player.mode === 'riding' ? 'no veículo' : 'a pé, junto ao veículo' },
    world: { logistics: cap.day.captureState(), player: { mode: cap.player.mode, walker: { ...cap.player.walker }, vehicle: { ...cap.player.vehicle } } },
  };
  return { profile: { ...profile, activeShiftId: shiftId, balanceCents: opening + ledgerTotal(ledger) }, shift };
}

/** Domain parcels rebuilt from a save (fresh objects, deep copies; the save is never referenced). */
export function restoreParcels(shift: ShiftSnapshot): Parcel[] {
  return shift.parcels.map((r) => ({
    id: r.id, ...(r.collector !== null ? { collector: r.collector } : {}), ...(r.sector !== null ? { sector: r.sector } : {}),
    origin: r.origin, destination: r.destination, platform: r.platform, region: r.region, state: r.state, place: r.place, holder: r.holder,
    position: r.position ? { ...r.position } : null, dock: r.dock, load: r.load, stowage: r.stowage ? Object.freeze({ ...r.stowage }) : null,
    history: r.history.map((e) => Object.freeze({ ...e, position: e.position ? { ...e.position } : null })),
  }));
}

/**
 * Resumes a saved shift into a NEW, not yet started `LogisticsDay` (decision 16, AC-19/AC-20):
 * parcels, routine, couriers, depot team and van exactly as checkpointed. Returns false when the
 * shift has no world yet (opened, nothing happened): the day then simply starts.
 */
export function restoreShift(day: LogisticsDay, shift: ShiftSnapshot): boolean {
  if (!shift.world) return false;
  day.restoreState(shift.world.logistics, restoreParcels(shift));
  return true;
}

export type CheckpointStatus = {
  writes: number; failures: number; lastSequence: number | null; lastShiftHour: number | null; lastReason: string | null;
  /** Last write problem (shown to the player); null when the last attempt succeeded. */
  error: string | null;
  /** Another writer advanced the save (should not happen with the tab lock): writing stopped. */
  stale: boolean;
};

export type CheckpointOptions = Readonly<{ enabled: boolean; now?: () => number; periodicMs?: number; retryMs?: number }>;

/** Custody signature: changes with every recorded parcel event and with the routine's own steps. */
export function custodySignature(day: LogisticsDay): string {
  let events = 0;
  for (const p of day.parcels) events += p.history.length;
  return `${day.parcels.length}|${events}|${day.phase}|${day.released ? 1 : 0}|${day.sackInHands ? 1 : 0}|${ACTORS.map((a) => day.finishedAt[a] ?? '-').join(',')}`;
}

/**
 * When to write (decision 11): right after the player's custody actions and on pause (immediate),
 * after NPC/depot custody events (in the same frame, F7), periodically while the world moves
 * (`periodicMs`), and one more attempt when the page is hidden/closed — never relying on it.
 */
export class ShiftCheckpointer {
  readonly status: CheckpointStatus = { writes: 0, failures: 0, lastSequence: null, lastShiftHour: null, lastReason: null, error: null, stale: false };
  private lastSignature: string | null = null;
  private lastWrite = -Infinity;
  private retryAt = -Infinity;
  private readonly now: () => number;
  private readonly periodic: number; private readonly retry: number;
  /** Called after every attempt (UI: toast on a new failure, status line). */
  onResult: ((ok: boolean, status: CheckpointStatus) => void) | null = null;

  private readonly session: CareerSession;
  private readonly capture: () => ShiftCapture;
  private readonly options: CheckpointOptions;
  constructor(session: CareerSession, capture: () => ShiftCapture, options: CheckpointOptions) {
    this.session = session; this.capture = capture; this.options = options;
    this.now = options.now ?? (() => Date.now());
    this.periodic = options.periodicMs ?? 30000; this.retry = options.retryMs ?? 5000;
  }

  get enabled(): boolean { return this.options.enabled && !this.status.stale; }

  /** Writes a checkpoint now. Returns false (and keeps the previous save) on any failure. */
  checkpoint(reason: string): boolean {
    if (!this.enabled) return false;
    const cap = this.capture();
    if (cap.day.phase === 'ANTES' || cap.day.closedAtHome !== null) return false;
    try {
      const saved = this.session.commit(this.session.careerId, (p, s) => captureShift(p, s, cap));
      Object.assign(this.status, { writes: this.status.writes + 1, lastSequence: saved.checkpointSequence, lastShiftHour: saved.shift?.shiftHour ?? null, lastReason: reason, error: null });
      this.lastSignature = custodySignature(cap.day); this.lastWrite = this.now();
      this.onResult?.(true, this.status);
      return true;
    } catch (e) {
      const msg = (e as Error).message;
      this.status.failures++; this.status.error = msg;
      if (/desatualizada/.test(msg)) this.status.stale = true;
      this.retryAt = this.now() + this.retry;
      this.onResult?.(false, this.status);
      return false;
    }
  }

  /**
   * The extra attempt when the page is hidden/closed (decision 11: tried, never relied upon).
   * `visibilitychange` and `pagehide` usually come together: one write is enough.
   */
  onExit(): boolean {
    if (!this.enabled) return false;
    // Skipped only when the last write is < 1 s old AND nothing in custody changed since (duplicate event).
    if (this.now() - this.lastWrite < 1000 && custodySignature(this.capture().day) === this.lastSignature) return false;
    return this.checkpoint('saída do navegador');
  }

  /** After a player interaction: write at once if custody (or the routine) changed. */
  afterAction(reason: string): boolean {
    if (!this.enabled) return false;
    if (custodySignature(this.capture().day) === this.lastSignature) return false;
    return this.checkpoint(reason);
  }

  /** Every frame (cheap): background custody events, periodic refresh, retry after a failure. */
  tick(): void {
    if (!this.enabled) return;
    const t = this.now();
    if (this.status.error !== null && t < this.retryAt) return;
    const day = this.capture().day;
    if (day.phase === 'ANTES' || day.closedAtHome !== null) return;
    const changed = custodySignature(day) !== this.lastSignature;
    if (this.lastSignature === null) { this.checkpoint('abertura do expediente'); return; }
    // After a failed write, try again as soon as the retry delay is over (whatever the gap).
    if (this.status.error !== null) { this.checkpoint('nova tentativa'); return; }
    // F7 (audit 6918411665, AC-18/19): a custody event of an NPC or a depot worker is written in the
    // SAME frame it happened (no interval): closing the tab right after it can never undo it.
    if (changed) { this.checkpoint('operação da equipe/base'); return; }
    if (t - this.lastWrite >= this.periodic) this.checkpoint('periódico');
  }

  /** The restored checkpoint is the baseline: nothing changed yet. */
  resumedFrom(shift: ShiftSnapshot, day: LogisticsDay, sequence: number): void {
    this.lastSignature = custodySignature(day); this.lastWrite = this.now();
    Object.assign(this.status, { lastSequence: sequence, lastShiftHour: shift.shiftHour, lastReason: 'retomado do checkpoint' });
  }
}

// ------------------------------------------------------------------ minimum end of shift (C4)

export type ClosureState = 'operacoes_pendentes' | 'retorno_pendente' | 'expediente_encerrado';
/**
 * Contract C4: pending operations → (all resolved) → return home pending → closed at home. Only
 * the last one closes the shift; neither 21h nor the last delivery does.
 */
export function closureState(day: LogisticsDay): ClosureState {
  if (!day.allResolved) return 'operacoes_pendentes';
  return day.closedAtHome === null ? 'retorno_pendente' : 'expediente_encerrado';
}

/** Distance from the home door the player may close the shift, and from the home stop the vehicle must be. */
export const HOME_DOOR_REACH = 2.4;
export const HOME_VEHICLE_REACH = 30;

export function homeClosureCheck(day: LogisticsDay, home: { door: { x: number; z: number }; stop: { x: number; z: number } },
  player: { x: number; z: number; riding: boolean }, vehicle: { x: number; z: number; stopped: boolean }): { ok: true } | { ok: false; reason: string } {
  if (!day.allResolved) return { ok: false, reason: 'Ainda há pacotes ou procedimentos pendentes na equipe' };
  if (day.closedAtHome !== null) return { ok: false, reason: 'Expediente já encerrado' };
  if (player.riding) return { ok: false, reason: 'Estacione e desça junto à porta de casa' };
  if (Math.hypot(player.x - home.door.x, player.z - home.door.z) > HOME_DOOR_REACH) return { ok: false, reason: 'Vá até a porta da sua casa' };
  if (!vehicle.stopped || Math.hypot(vehicle.x - home.stop.x, vehicle.z - home.stop.z) > HOME_VEHICLE_REACH) return { ok: false, reason: 'Traga o seu veículo e estacione perto de casa' };
  return { ok: true };
}

/**
 * Closes the shift at home in ONE checkpoint (decisions 8/9, AC-13/AC-17/AC-26): the final shift is
 * validated first (every parcel final, ledger settled and consistent), then the profile moves to
 * the next working day with no open shift and a summary of the closed one. Career switching is
 * possible only after this write succeeds. Any failure leaves the open shift exactly as it was.
 */
export function closeShiftAtHome(session: CareerSession, cap: ShiftCapture, nextCalendarIndex: number, at: Readonly<{ vehicleStopped: boolean }>): CareerSave {
  if (!cap.day.allResolved) throw new SaveError('Expediente com pendências: não pode ser encerrado');
  if (cap.day.parcels.some((p) => !isFinal(p))) throw new SaveError('Há pacote sem resultado final');
  // F6 audit reinforcement: the domain itself proves the home condition from the captured poses
  // (the career's OWN home, never one passed by the caller) — no entry point can close remotely.
  const w = cap.player.walker, v = cap.player.vehicle;
  const home = homeClosureCheck(cap.day, careerHome(session.careerId), { x: w.x, z: w.z, riding: cap.player.mode === 'riding' }, { x: v.x, z: v.z, stopped: at.vehicleStopped });
  if (!home.ok) throw new SaveError(`Encerramento só na porta da própria casa: ${home.reason}`);
  if (!Number.isSafeInteger(nextCalendarIndex) || nextCalendarIndex <= session.profile.calendarIndex) throw new SaveError('O calendário da carreira não retrocede');
  const careerId: CareerId = session.careerId;
  return session.commit(careerId, (p, s) => {
    const { profile, shift } = captureShift(p, s, cap);
    // Full validation of the final shift before it is folded into the profile.
    sealSave({ careerId, checkpointSequence: 0, profile, shift });
    const summary: ClosedShift = {
      shiftId: shift.shiftId, calendarIndex: shift.calendarIndex, closedAtShiftHour: cap.shiftHour,
      delivered: shift.parcels.filter((x) => x.state === 'ENTREGUE' && x.sector === CHARACTERS[careerId].sector).length,
      returned: shift.parcels.filter((x) => x.state === 'DEVOLVIDO_E_CONFERIDO' && x.sector === CHARACTERS[careerId].sector).length,
      payments: shift.payments.length, earnedCents: ledgerTotal(shift.payments),
    };
    return { profile: { ...profile, activeShiftId: null, calendarIndex: nextCalendarIndex, lastClosedShift: summary }, shift: null };
  });
}
