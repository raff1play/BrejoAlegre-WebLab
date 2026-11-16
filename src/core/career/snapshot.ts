import { ACTORS, type ActorId } from '../delivery/dailyDemand.ts';
import { PARCEL_STATES, PLACE_MOVES, type Parcel, type ParcelEvent, type ParcelPlace, type ParcelState, type Stowage } from '../delivery/parcels.ts';
import { CAR_TRUNK, STOWABLE, layoutProblem, parcelDims } from '../delivery/carTrunk.ts';
import { SECTORS, type Sector } from '../delivery/sectors.ts';
import { PHASES } from '../delivery/workday.ts';
import { COURIER_STATES } from '../delivery/couriers.ts';
import { DepotOperations, TASK_KINDS, TASK_STAGES } from '../delivery/depotOperations.ts';
import type { LogisticsSnapshot } from '../delivery/logisticsDay.ts';
import { STORES } from '../../world/city/cityPlan.ts';
import { WORKDAY_START } from '../city/clock.ts';
import { PAYMENT_KINDS, dueEvents, ledgerTotal, paymentEventId } from './ledger.ts';
import {
  APPEARANCE_PRESETS, CHARACTERS, EQUIPMENT_PRESETS, VEHICLE_KINDS, buildRoster, isCareerId,
  type AppearancePreset, type CareerId, type EquipmentPresetId, type HomeId, type Roster, type VehicleKind,
} from './careers.ts';
import type { PaymentRecord as LedgerRecord } from './ledger.ts';
type PaymentRecord = LedgerRecord;

/**
 * B1-01 F1 (contrato C5): estrutura VERSIONADA do save de UMA carreira.
 *
 * Um save contém exatamente um perfil e, opcionalmente, o expediente aberto daquela carreira. Nunca
 * há dados de outra carreira dentro dele: os NPCs do expediente aparecem só como papéis (`roster`),
 * sem dinheiro, experiência ou calendário próprios. O envelope tem checksum para rejeitar
 * corrupção ANTES de sobrescrever qualquer dado íntegro. Captura/restauração do mundo (posições,
 * NPCs, trânsito) e o ledger de pagamentos completo são ligados nas etapas F5/F6.
 */
export const SAVE_FORMAT = 'brejo-alegre-carreira';
/**
 * v1: F1/F2. v2 (B1-01 F3): every parcel record carries `stowage` (its slot in the car boot, or
 * null). v3 (B1-01 F6): career lineage, last closed shift, the running world (`shift.world`),
 * monotonic `shiftHour`, opening balance and the D07 pay ledger (`COLETA`/`ENTREGA`).
 * Older saves are migrated on read (`SAVE_MIGRATIONS`), after their own checksum is checked.
 */
export const SAVE_SCHEMA_VERSION = 3;

export class SaveError extends Error {
  constructor(message: string) { super(message); this.name = 'SaveError'; }
}

export type OwnedVehicle = Readonly<{
  vehicleId: string;
  kind: VehicleKind;
  /** Próprio e quitado (decisão 5). */
  owned: true;
  paidOff: true;
  /** Dia de calendário em que foi escolhido; a escolha é permanente até a futura garagem. */
  chosenOnCalendarIndex: number;
}>;

export type CareerProfile = Readonly<{
  careerId: CareerId;
  homeId: HomeId;
  sectorId: Sector;
  appearance: AppearancePreset;
  equipment: EquipmentPresetId;
  /** null = ainda não escolhido. Escolha única (sem troca gratuita no B1-01). */
  vehicle: OwnedVehicle | null;
  /** Saldo em centavos inteiros. Nenhuma tabela de valores nova é criada no B1-01. */
  balanceCents: number;
  experience: number;
  /** Índice do calendário de operação (`operatingCalendar.ts`). */
  calendarIndex: number;
  /** Expediente aberto desta carreira; não-nulo bloqueia troca de carreira. */
  activeShiftId: string | null;
  /**
   * B1-01 F6: identity of this career's INCARNATION. A new career (new game, or after deleting the
   * save) gets a new one; backups of an older incarnation can never pass for this one's progress.
   */
  lineageId: string;
  /** B1-01 F6: summary of the last shift closed at home (null before the first). */
  lastClosedShift: ClosedShift | null;
}>;

export type ClosedShift = Readonly<{ shiftId: string; calendarIndex: number; closedAtShiftHour: number; delivered: number; returned: number; payments: number; earnedCents: number }>;

/** Pacote serializado: a MESMA forma do `Parcel` de domínio (fonte única por ID), em cópia profunda. */
export type ParcelRecord = Readonly<{
  id: string; collector: string | null; sector: Sector | null; origin: string; destination: string;
  platform: Parcel['platform']; region: string; state: ParcelState; place: ParcelPlace; holder: string;
  position: { x: number; y: number; z: number } | null; dock: string | null; load: string | null;
  /** B1-01 F3: slot in the car boot (only while `place === 'porta-malas'`). */
  stowage: Stowage | null;
  history: readonly ParcelEvent[];
}>;

/** Evento remunerado, idempotente por `eventId` (= shiftId + parcelId + tipo). B1-01 F6: `ledger.ts`. */
export type { PaymentRecord } from './ledger.ts';

export type SafePoint = Readonly<{ x: number; z: number; yaw: number; label: string }>;
export type Pose = Readonly<{ x: number; z: number; yaw: number }>;
/**
 * B1-01 F6 (decision 16, AC-19/AC-20): where the player was at the checkpoint — on foot or at the
 * wheel/handlebar — and the parked pose of the career's own vehicle. Restored at speed zero.
 */
export type PlayerSnapshot = Readonly<{ mode: 'walking' | 'riding'; walker: Pose; vehicle: Pose }>;
/** B1-01 F6: the running world of the shift (routine, couriers, depot, van and the player). */
export type WorldSnapshot = Readonly<{ logistics: LogisticsSnapshot; player: PlayerSnapshot }>;

/**
 * Expediente da carreira ativa (contrato C4). `shiftId` deriva da carreira + dia de calendário, logo
 * atravessar 00h não cria outro expediente; `elapsedVirtualMinutes` só cresce.
 */
export type ShiftSnapshot = Readonly<{
  shiftId: string;
  careerId: CareerId;
  calendarIndex: number;
  /** Minutos virtuais desde o início do expediente (11h45); só cresce, inclusive depois de 00h. */
  elapsedVirtualMinutes: number;
  /** B1-01 F6: hora MONOTÔNICA do expediente (25,5 = 01h30 do mesmo turno) = 11,75 + minutos/60. */
  shiftHour: number;
  phase: string;
  roster: Roster;
  parcels: readonly ParcelRecord[];
  payments: readonly PaymentRecord[];
  /** B1-01 F6: saldo da carreira ao abrir o expediente; o perfil tem sempre abertura + razão. */
  openingBalanceCents: number;
  /** Minutos virtuais de atraso após 21h, por papel; null = sem atraso registrado. */
  lateByActor: Readonly<Record<ActorId, number | null>>;
  safePoint: SafePoint | null;
  /** B1-01 F6: mundo em andamento; null só num expediente sem nenhum pacote ainda. */
  world: WorldSnapshot | null;
}>;

export type CareerSave = Readonly<{
  format: typeof SAVE_FORMAT;
  schemaVersion: typeof SAVE_SCHEMA_VERSION;
  careerId: CareerId;
  /** Cresce a cada checkpoint gravado; nunca retrocede no armazenamento. */
  checkpointSequence: number;
  profile: CareerProfile;
  shift: ShiftSnapshot | null;
  checksum: string;
}>;

export type CareerSaveBody = Omit<CareerSave, 'checksum'>;

export const shiftIdOf = (careerId: CareerId, calendarIndex: number): string => `${careerId}/dia-${calendarIndex}`;
/** Um evento de pagamento de ENTREGA por pacote e expediente: o ID é derivado, nunca livre. */
export const paymentEventIdOf = (shiftId: string, parcelId: string): string => paymentEventId(shiftId, parcelId, 'ENTREGA');
export const shiftHourOf = (elapsedVirtualMinutes: number): number => WORKDAY_START + elapsedVirtualMinutes / 60;
/** New incarnation id (random; `crypto.randomUUID` when the platform has it). */
export function newLineageId(careerId: CareerId): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const r = c?.randomUUID ? c.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${careerId}:${r}`;
}
export const vehicleIdOf = (careerId: CareerId): string => `veiculo-${careerId}`;

export function defaultProfile(careerId: CareerId, calendarIndex = 0, lineageId: string = newLineageId(careerId)): CareerProfile {
  const c = CHARACTERS[careerId];
  return Object.freeze({
    careerId, homeId: c.homeId, sectorId: c.sector, appearance: c.defaultAppearance, equipment: c.defaultEquipment,
    vehicle: null, balanceCents: 0, experience: 0, calendarIndex, activeShiftId: null, lineageId, lastClosedShift: null,
  });
}

/** Escolha única do veículo inicial (AC-03). Repetir a escolha, mesmo igual, é rejeitado. */
export function chooseStartingVehicle(profile: CareerProfile, kind: VehicleKind): CareerProfile {
  if (!(VEHICLE_KINDS as readonly string[]).includes(kind)) throw new SaveError(`Veículo inválido: ${String(kind)}`);
  if (profile.vehicle) throw new SaveError('Veículo inicial já escolhido: permanece fixo até a garagem futura');
  return Object.freeze({ ...profile, vehicle: Object.freeze({ vehicleId: vehicleIdOf(profile.careerId), kind, owned: true, paidOff: true, chosenOnCalendarIndex: profile.calendarIndex }) });
}

/** Presets de aparência/equipamento (AC-02). Não altera nada além desses dois campos. */
export function customize(profile: CareerProfile, change: { appearance?: AppearancePreset; equipment?: EquipmentPresetId }): CareerProfile {
  const appearance = change.appearance ?? profile.appearance, equipment = change.equipment ?? profile.equipment;
  if (!(APPEARANCE_PRESETS as readonly string[]).includes(appearance)) throw new SaveError(`Aparência inválida: ${String(appearance)}`);
  if (!EQUIPMENT_PRESETS.some((e) => e.id === equipment)) throw new SaveError(`Equipamento inválido: ${String(equipment)}`);
  return Object.freeze({ ...profile, appearance, equipment });
}

/** Cópia profunda e desacoplada dos pacotes de domínio (o save nunca referencia objetos vivos). */
export function captureParcels(parcels: readonly Parcel[]): ParcelRecord[] {
  return parcels.map((p) => ({
    id: p.id, collector: p.collector ?? null, sector: p.sector ?? null, origin: p.origin, destination: p.destination,
    platform: p.platform, region: p.region, state: p.state, place: p.place, holder: p.holder,
    position: p.position ? { ...p.position } : null, dock: p.dock, load: p.load,
    stowage: p.stowage ? { ...p.stowage } : null,
    history: p.history.map((e) => ({ ...e, position: e.position ? { ...e.position } : null })),
  }));
}

export function emptyShift(careerId: CareerId, calendarIndex: number, roster: Roster = buildRoster(careerId), openingBalanceCents = 0): ShiftSnapshot {
  return {
    shiftId: shiftIdOf(careerId, calendarIndex), careerId, calendarIndex, elapsedVirtualMinutes: 0, shiftHour: WORKDAY_START, phase: 'ANTES', roster,
    parcels: [], payments: [], openingBalanceCents, lateByActor: { jogador: null, npc1: null, npc2: null, npc3: null }, safePoint: null, world: null,
  };
}

// ------------------------------------------------------------------ canonical JSON + checksum

/** JSON com chaves ordenadas: o mesmo conteúdo produz sempre os mesmos bytes e o mesmo checksum. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new SaveError('Número não finito no save');
    if (value === undefined) throw new SaveError('Valor indefinido no save');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** FNV-1a 32 bits. Detecta corrupção/edição acidental; NÃO é proteção criptográfica contra fraude. */
export function checksumOf(body: CareerSaveBody): string {
  const text = canonicalJson(body);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return `fnv1a32:${h.toString(16).padStart(8, '0')}`;
}

export function sealSave(body: Omit<CareerSaveBody, 'format' | 'schemaVersion'>): CareerSave {
  const full: CareerSaveBody = { format: SAVE_FORMAT, schemaVersion: SAVE_SCHEMA_VERSION, ...body };
  validateBody(full);
  return deepFreeze({ ...full, checksum: checksumOf(full) });
}

// ------------------------------------------------------------------ validation

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const fail = (msg: string): never => { throw new SaveError(msg); };
const int = (v: unknown, min: number, max: number, what: string): number =>
  (Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max) ? v as number : fail(`${what} inválido`);
const finite = (v: unknown, what: string): number => (typeof v === 'number' && Number.isFinite(v)) ? v : fail(`${what} inválido`);
const str = (v: unknown, what: string): string => (typeof v === 'string' && v.length > 0 && v.length <= 200) ? v : fail(`${what} inválido`);
const nullable = <T>(v: unknown, f: (x: unknown) => T): T | null => v === null ? null : f(v);
const oneOf = <T extends string>(v: unknown, list: readonly T[], what: string): T => (list as readonly unknown[]).includes(v) ? v as T : fail(`${what} inválido: ${String(v)}`);
const PLACES = Object.keys(PLACE_MOVES) as ParcelPlace[];

function validateProfile(p: unknown, careerId: CareerId): void {
  if (!isObj(p)) fail('Perfil ausente');
  const o = p as Obj, c = CHARACTERS[careerId];
  if (o.careerId !== careerId) fail('Perfil pertence a outra carreira');
  // Casa e setor são FIXOS por personagem (decisão 2): um save não pode reatribuí-los.
  if (o.homeId !== c.homeId || o.sectorId !== c.sector) fail('Casa/setor não correspondem ao personagem');
  oneOf(o.appearance, APPEARANCE_PRESETS, 'Aparência');
  oneOf(o.equipment, EQUIPMENT_PRESETS.map((e) => e.id), 'Equipamento');
  if (o.vehicle !== null) {
    if (!isObj(o.vehicle)) fail('Veículo inválido');
    const v = o.vehicle as Obj;
    if (v.vehicleId !== vehicleIdOf(careerId)) fail('Veículo pertence a outra carreira');
    oneOf(v.kind, VEHICLE_KINDS, 'Tipo de veículo');
    if (v.owned !== true || v.paidOff !== true) fail('Veículo inicial deve ser próprio e quitado');
    int(v.chosenOnCalendarIndex, 0, 36500, 'Dia da escolha do veículo');
  }
  int(o.balanceCents, -1e12, 1e12, 'Saldo');
  int(o.experience, 0, 1e12, 'Experiência');
  int(o.calendarIndex, 0, 36500, 'Dia de calendário');
  nullable(o.activeShiftId, (x) => str(x, 'Expediente ativo'));
  if (typeof o.lineageId !== 'string' || !o.lineageId.startsWith(`${careerId}:`) || o.lineageId.length > 200) fail('Linhagem da carreira inválida');
  nullable(o.lastClosedShift, (v) => {
    if (!isObj(v)) fail('Último expediente encerrado inválido');
    const q = v as Obj;
    const cal = int(q.calendarIndex, 0, 36500, 'Dia do último expediente');
    if (q.shiftId !== shiftIdOf(careerId, cal)) fail('ID do último expediente inconsistente');
    if (cal >= (o.calendarIndex as number)) fail('Último expediente encerrado não é anterior ao dia atual');
    finite(q.closedAtShiftHour, 'Hora de encerramento');
    for (const k of ['delivered', 'returned', 'payments']) int(q[k], 0, 1e6, `Resumo do expediente (${k})`);
    int(q.earnedCents, 0, 1e12, 'Ganho do expediente');
    return v;
  });
}

function validateParcel(p: unknown): string {
  if (!isObj(p)) fail('Pacote inválido');
  const o = p as Obj;
  const id = str(o.id, 'ID de pacote');
  nullable(o.collector, (x) => str(x, 'Coletor'));
  nullable(o.sector, (x) => oneOf(x, SECTORS, 'Setor do pacote'));
  str(o.origin, 'Origem'); str(o.destination, 'Destino'); str(o.region, 'Região'); str(o.holder, 'Detentor');
  oneOf(o.platform, ['ML', 'SHP', 'LOJA'] as const, 'Plataforma');
  oneOf(o.state, PARCEL_STATES, 'Estado do pacote');
  oneOf(o.place, PLACES, 'Local do pacote');
  const pos = (v: unknown) => { if (!isObj(v)) fail('Posição inválida'); const q = v as Obj; finite(q.x, 'x'); finite(q.y, 'y'); finite(q.z, 'z'); return v; };
  nullable(o.position, pos);
  nullable(o.dock, (x) => str(x, 'Doca')); nullable(o.load, (x) => str(x, 'Carga'));
  // B1-01 F3: a slot exists if and only if the parcel is in the car boot.
  if ((o.place === 'porta-malas') !== (o.stowage !== null && o.stowage !== undefined)) fail(`Pacote ${id}: posição no porta-malas inconsistente com o local`);
  if (o.stowage !== null) {
    if (!isObj(o.stowage)) fail(`Pacote ${id}: posição no porta-malas inválida`);
    const q = o.stowage as Obj;
    if (q.compartment !== 'porta-malas') fail(`Pacote ${id}: compartimento inválido`);
    str(q.vehicleId, 'Veículo da carga');
    for (const k of ['x', 'y', 'z', 'w', 'h', 'd']) finite(q[k], `Posição ${k} no porta-malas`);
  }
  if (!Array.isArray(o.history) || !o.history.length) fail(`Histórico do pacote ${id} ausente`);
  for (const e of o.history as unknown[]) {
    if (!isObj(e)) fail('Evento de histórico inválido');
    const ev = e as Obj;
    oneOf(ev.state, PARCEL_STATES, 'Estado no histórico'); oneOf(ev.place, PLACES, 'Local no histórico');
    finite(ev.hour, 'Hora no histórico'); str(ev.operation, 'Operação'); str(ev.holder, 'Detentor no histórico');
  }
  // O estado atual é o último registrado: o save não pode "pular" ou desfazer o histórico.
  const last = (o.history as Obj[])[(o.history as Obj[]).length - 1]!;
  if (last.state !== o.state || last.place !== o.place) fail(`Pacote ${id}: estado diverge do histórico`);
  // B1-01 F5: the return states only exist through their real procedure (no forged final result).
  const ops = (o.history as Obj[]).map((e) => e.operation);
  if (o.state === 'TENTATIVA_FRUSTRADA' || o.state === 'DEVOLVIDO_E_CONFERIDO') {
    if (!ops.includes('tentativa:frustrada')) fail(`Pacote ${id}: ${String(o.state)} sem tentativa registrada`);
    if ((o.history as Obj[]).some((e) => e.state === 'ENTREGUE')) fail(`Pacote ${id}: devolução de pacote já entregue`);
  }
  if (o.state === 'DEVOLVIDO_E_CONFERIDO') {
    if (o.place !== 'devolucoes') fail(`Pacote ${id}: DEVOLVIDO_E_CONFERIDO fora das devoluções da base`);
    const t = ops.lastIndexOf('tentativa:frustrada'), r = ops.lastIndexOf('transferência:recebimento'), c = ops.lastIndexOf('transferência:conferencia'), d = ops.lastIndexOf('estado:DEVOLVIDO_E_CONFERIDO');
    if (!(t < r && r < c && c < d)) fail(`Pacote ${id}: DEVOLVIDO_E_CONFERIDO sem devolução física e conferência`);
  }
  return id;
}

function validateShift(s: unknown, careerId: CareerId, profile: Obj): void {
  if (!isObj(s)) fail('Expediente inválido');
  const o = s as Obj;
  if (o.careerId !== careerId) fail('Expediente pertence a outra carreira');
  const cal = int(o.calendarIndex, 0, 36500, 'Dia do expediente');
  if (o.shiftId !== shiftIdOf(careerId, cal)) fail('ID do expediente inconsistente');
  if (profile.activeShiftId !== o.shiftId) fail('Perfil não aponta para este expediente');
  // O dia de carreira só muda com o expediente encerrado: perfil e expediente aberto no mesmo dia.
  if (profile.calendarIndex !== cal) fail('Perfil e expediente aberto devem estar no mesmo dia de calendário');
  finite(o.elapsedVirtualMinutes, 'Minutos do expediente');
  if ((o.elapsedVirtualMinutes as number) < 0) fail('Minutos do expediente negativos');
  if (finite(o.shiftHour, 'Hora do expediente') !== shiftHourOf(o.elapsedVirtualMinutes as number)) fail('Hora do expediente inconsistente com os minutos decorridos');
  str(o.phase, 'Fase');
  if (!isObj(o.roster)) fail('Roster ausente');
  const r = o.roster as Obj, expected = buildRoster(careerId);
  for (const a of ACTORS) if (r[a] !== expected[a]) fail('Roster diverge do personagem ativo');
  if (!Array.isArray(o.parcels)) fail('Pacotes ausentes');
  const ids = (o.parcels as unknown[]).map(validateParcel);
  if (new Set(ids).size !== ids.length) fail('ID de pacote duplicado');
  const byId = new Map((o.parcels as Obj[]).map((p) => [p.id as string, p]));
  // B1-01 F3: the car boot as saved must be physically valid and belong to THIS career's own car.
  const boot = (o.parcels as Obj[]).filter((p) => p.place === 'porta-malas');
  if (boot.length) {
    const vehicle = profile.vehicle as Obj | null;
    if (!vehicle || vehicle.kind !== 'carro-antigo') fail('Carga no porta-malas sem carro próprio na carreira');
    for (const p of boot) {
      if ((p.stowage as Obj).vehicleId !== vehicleIdOf(careerId)) fail(`Pacote ${String(p.id)}: porta-malas de outro veículo`);
      if (p.holder !== 'jogador') fail(`Pacote ${String(p.id)}: porta-malas sob outra custódia`);
      if (!(STOWABLE as readonly unknown[]).includes(p.state)) fail(`Pacote ${String(p.id)}: estado ${String(p.state)} não viaja no porta-malas`);
    }
    const problem = layoutProblem(CAR_TRUNK, boot.map((p) => { const q = p.stowage as Obj; return { box: { id: p.id as string, dims: parcelDims(p.id as string) }, slot: { x: q.x as number, y: q.y as number, z: q.z as number, w: q.w as number, h: q.h as number, d: q.d as number } }; }));
    if (problem) fail(`Porta-malas inválido: ${problem}`);
  }
  // B1-01 F6 (AC-22): the ledger holds ONLY events the parcels' own histories prove, with the D07
  // value for this career's vehicle (`ledger.ts`); one per event id; balance = opening + ledger.
  if (!Array.isArray(o.payments)) fail('Pagamentos ausentes');
  const vehicleKind = (profile.vehicle as Obj | null)?.kind as VehicleKind | undefined;
  const due = new Map(vehicleKind ? dueEvents(o.parcels as unknown as ParcelRecord[], o.shiftId as string, vehicleKind).map((e) => [e.eventId, e]) : []);
  const events = new Set<string>();
  for (const p of o.payments as unknown[]) {
    if (!isObj(p)) fail('Pagamento inválido');
    const q = p as Obj;
    const eventId = str(q.eventId, 'Evento de pagamento'), parcelId = str(q.parcelId, 'Pacote pago');
    if (q.shiftId !== o.shiftId) fail('Pagamento de outro expediente');
    // Approved paid events: COLETA and ENTREGA (D07). Attempts, returns and transfers never pay.
    if (!(PAYMENT_KINDS as readonly unknown[]).includes(q.kind)) fail('Tipo de pagamento inválido');
    const parcel = byId.get(parcelId);
    if (!parcel) fail('Pagamento de pacote desconhecido');
    if (q.kind === 'ENTREGA' && (parcel!.state !== 'ENTREGUE' || parcel!.place !== 'destinatario')) fail(`Pagamento de entrega para pacote não entregue (${parcelId}: ${String(parcel!.state)})`);
    if (eventId !== paymentEventId(o.shiftId as string, parcelId, q.kind as PaymentRecord['kind'])) fail('ID do evento de pagamento inválido');
    int(q.amountCents, 0, 1e9, 'Valor do pagamento');
    if (events.has(eventId)) fail('Pagamento duplicado');
    events.add(eventId);
    const expected = due.get(eventId);
    if (!expected) fail(q.kind === 'COLETA' ? `Pagamento de coleta sem coleta do jogador e recebimento físico na base (${parcelId})` : `Pagamento de entrega não feita pelo jogador (${parcelId})`);
    if (q.amountCents !== expected!.amountCents || q.vehicle !== expected!.vehicle || q.platform !== expected!.platform) fail(`Valor de pagamento fora da tabela aprovada D07 (${eventId}: ${String(q.amountCents)})`);
  }
  int(o.openingBalanceCents, -1e12, 1e12, 'Saldo de abertura');
  if (profile.balanceCents !== (o.openingBalanceCents as number) + ledgerTotal(o.payments as PaymentRecord[])) fail('Saldo inconsistente com a razão de pagamentos do expediente');
  if (!isObj(o.lateByActor)) fail('Atrasos ausentes');
  for (const a of ACTORS) nullable((o.lateByActor as Obj)[a], (x) => { const n = finite(x, 'Atraso'); return n < 0 ? fail('Atraso negativo') : n; });
  nullable(o.safePoint, (v) => { if (!isObj(v)) fail('Ponto seguro inválido'); const q = v as Obj; finite(q.x, 'x'); finite(q.z, 'z'); finite(q.yaw, 'yaw'); str(q.label, 'Rótulo do ponto seguro'); return v; });
  if (o.world === null || o.world === undefined) {
    if ((o.parcels as unknown[]).length) fail('Expediente com pacotes sem o estado do mundo: não pode ser retomado');
  } else validateWorld(o.world, o.parcels as Obj[], profile, o.phase as string);
}

const pose = (v: unknown, what: string): Obj => {
  if (!isObj(v)) fail(`${what} inválido`);
  const q = v as Obj; finite(q.x, `${what} x`); finite(q.z, `${what} z`); finite(q.yaw, `${what} yaw`);
  return q;
};
const point = (v: unknown, what: string): Obj => { if (!isObj(v)) fail(`${what} inválido`); finite((v as Obj).x, `${what} x`); finite((v as Obj).z, `${what} z`); return v as Obj; };
const bool = (v: unknown, what: string): boolean => (typeof v === 'boolean' ? v : fail(`${what} inválido`));
const strList = (v: unknown, what: string): string[] => (Array.isArray(v) ? v.map((x) => str(x, what)) : fail(`${what} inválido`));
const STORE_IDS = STORES.map((st) => st.id);
const DEPOT_ROLES = new DepotOperations().toState();

/**
 * B1-01 F6: the running world must be complete and consistent with the parcels (single source of
 * truth) — otherwise the checkpoint is rejected as partial/corrupt, before anything is overwritten.
 */
function validateWorld(w: unknown, parcels: Obj[], profile: Obj, phase: string): void {
  if (!isObj(w)) fail('Estado do mundo inválido');
  const world = w as Obj;
  if (!isObj(world.logistics)) fail('Logística do expediente ausente');
  const l = world.logistics as Obj;
  const ph = oneOf(l.phase, PHASES, 'Fase da logística');
  if (ph !== phase) fail('Fase do expediente diverge da logística');
  if (parcels.length && ph === 'ANTES') fail('Expediente com pacotes antes do início');
  if (!isObj(l.assignments)) fail('Designação de lojas ausente');
  for (const a of ACTORS) for (const k of strList((l.assignments as Obj)[a], 'Loja designada')) oneOf(k, STORE_IDS, 'Loja designada');
  strList(l.route, 'Parada da rota'); strList(l.absent, 'Endereço ausente');
  bool(l.sackInHands, 'Saca nas mãos'); bool(l.late, 'Atraso de retorno'); bool(l.released, 'Liberação da equipe'); bool(l.readinessWarned, 'Aviso de triagem');
  nullable(l.releaseHour, (x) => finite(x, 'Hora da liberação'));
  if (l.released === true && l.releaseHour === null) fail('Equipe liberada sem hora de liberação');
  nullable(l.allSortedAt, (x) => finite(x, 'Hora da separação'));
  if (!isObj(l.finishedAt)) fail('Conclusões por entregador ausentes');
  for (const a of ACTORS) nullable((l.finishedAt as Obj)[a], (x) => finite(x, 'Conclusão do entregador'));
  if (finite(l.trafficTime, 'Tempo do trânsito') < 0) fail('Tempo do trânsito negativo');
  const gate = finite(l.gateOpen, 'Portão'); if (gate < 0 || gate > 1) fail('Portão fora de 0–1');
  if (l.closedAtHome !== null) fail('Expediente encerrado em casa não fica aberto no save');
  if (!isObj(l.van)) fail('Van ausente');
  oneOf((l.van as Obj).state, ['scheduled', 'opening', 'unloading', 'closing', 'departed'] as const, 'Estado da van');
  const door = finite((l.van as Obj).door, 'Porta da van'); if (door < 0 || door > 1) fail('Porta da van fora de 0–1');
  // Depot: same posts as the game, each with a well-formed task referring to a real parcel.
  if (!isObj(l.depot)) fail('Base ausente');
  const d = l.depot as Obj;
  const byId = new Map(parcels.map((p) => [p.id as string, p]));
  const claimed = new Set<string>();
  const checkWorkers = (list: unknown, expected: readonly { role: string }[], what: string): void => {
    if (!Array.isArray(list) || list.length !== expected.length) fail(`${what}: postos diferentes do jogo`);
    (list as unknown[]).forEach((x, i) => {
      if (!isObj(x)) fail(`${what}: trabalhador inválido`);
      const q = x as Obj;
      if (q.role !== expected[i]!.role) fail(`${what}: posto ${String(q.role)} fora de ordem`);
      finite(q.x, 'x do trabalhador'); finite(q.z, 'z do trabalhador'); finite(q.yaw, 'yaw do trabalhador'); bool(q.active, 'Trabalhador ativo');
      oneOf(q.activity, ['idle', 'work', 'carry'] as const, 'Atividade do trabalhador');
      if (q.task === null) { if (q.parcel !== null) fail(`${String(q.role)}: pacote sem tarefa`); return; }
      if (!isObj(q.task)) fail('Tarefa inválida');
      const t = q.task as Obj;
      const id = str(t.id, 'Pacote da tarefa');
      if (q.parcel !== id) fail(`${String(q.role)}: tarefa e pacote divergentes`);
      oneOf(t.kind, TASK_KINDS, 'Tipo de tarefa'); oneOf(t.stage, TASK_STAGES, 'Etapa da tarefa');
      if (!Array.isArray(t.route)) fail('Percurso da tarefa inválido');
      for (const pt of t.route as unknown[]) point(pt, 'Ponto do percurso');
      finite(t.timer, 'Cronômetro da tarefa'); point(t.to, 'Destino do trabalhador');
      for (const k of ['origin', 'destination']) { const v = t[k]; if (!isObj(v)) fail('Posição da tarefa inválida'); finite((v as Obj).x, 'x'); finite((v as Obj).y, 'y'); finite((v as Obj).z, 'z'); }
      oneOf(t.expected, PLACES, 'Local esperado da tarefa'); oneOf(t.state, PARCEL_STATES, 'Estado esperado da tarefa');
      const p = byId.get(id);
      if (!p) fail(`Tarefa de pacote desconhecido (${id})`);
      if (p!.place !== t.expected || p!.state !== t.state) fail(`Tarefa de ${id} diverge do pacote (${String(p!.place)}/${String(p!.state)})`);
      if (claimed.has(id)) fail(`Pacote ${id} em duas tarefas`);
      claimed.add(id);
    });
  };
  checkWorkers(d.workers, DEPOT_ROLES.workers, 'Base'); checkWorkers(d.assistants, DEPOT_ROLES.assistants, 'Auxiliares');
  strList(d.errors, 'Erro da base'); bool(d.truckAvailable, 'Caminhão'); int(d.handoffIndex, 0, 1e9, 'Índice de recebimento');
  for (const p of parcels) if (p.place === 'transferencia' && !claimed.has(p.id as string)) fail(`Pacote ${String(p.id)} em transferência sem trabalhador`);
  // Couriers: the three NPC roles, once each, with their stores and a known state.
  if (!Array.isArray(l.couriers) || l.couriers.length !== 3) fail('Entregadores NPC ausentes');
  const seen = new Set<string>();
  for (const x of l.couriers as unknown[]) {
    if (!isObj(x)) fail('Entregador NPC inválido');
    const c = x as Obj;
    const id = oneOf(c.id, ['npc1', 'npc2', 'npc3'] as const, 'Entregador NPC');
    if (seen.has(id)) fail(`Entregador ${id} duplicado`); seen.add(id);
    oneOf(c.state, COURIER_STATES, 'Estado do entregador NPC');
    const stores = strList(c.stores, 'Loja do entregador');
    if (stores.join() !== strList((l.assignments as Obj)[id], 'Loja designada').join()) fail(`Lojas de ${id} divergem da designação`);
    int(c.storeIndex, 0, 64, 'Índice de loja'); pose(c.bike, 'Moto do NPC'); pose(c.person, 'Pessoa do NPC');
    if (!Array.isArray(c.route)) fail('Rota do NPC inválida');
    for (const pt of c.route as unknown[]) point(pt, 'Ponto da rota do NPC');
    finite(c.stopTimer, 'Parada do NPC'); finite(c.timer, 'Cronômetro do NPC');
    bool(c.returning, 'Retorno do NPC'); bool(c.deadlineReported, 'Atraso do NPC'); bool(c.yieldingToTraffic, 'Cedendo passagem');
    nullable(c.returnedAt, (v) => finite(v, 'Retorno do NPC')); strList(c.stops, 'Parada do NPC'); nullable(c.error, (v) => str(v, 'Erro do NPC'));
  }
  // The player: on foot or in the own vehicle; nobody rides holding parcels (CORE-015.1).
  if (!isObj(world.player)) fail('Jogador ausente no checkpoint');
  const pl = world.player as Obj;
  const mode = oneOf(pl.mode, ['walking', 'riding'] as const, 'Modo do jogador');
  pose(pl.walker, 'Posição a pé'); pose(pl.vehicle, 'Posição do veículo');
  const mine = parcels.filter((p) => p.holder === 'jogador');
  if (mode === 'riding' && mine.some((p) => p.place === 'maos')) fail('Jogador no veículo com volumes nas mãos');
  const kind = (profile.vehicle as Obj | null)?.kind;
  if (mine.some((p) => p.place === 'bau') && kind !== 'moto-antiga') fail('Volume no baú sem moto própria na carreira');
  if (!kind) fail('Expediente em andamento sem veículo da carreira');
}

function validateBody(b: unknown): CareerSaveBody {
  if (!isObj(b)) fail('Save não é um objeto');
  const o = b as Obj;
  if (o.format !== SAVE_FORMAT) fail('Formato de save desconhecido');
  if (o.schemaVersion !== SAVE_SCHEMA_VERSION) fail(`Versão de save não suportada: ${String(o.schemaVersion)}`);
  if (!isCareerId(o.careerId)) fail('Carreira inválida');
  const careerId = o.careerId as CareerId;
  int(o.checkpointSequence, 0, Number.MAX_SAFE_INTEGER, 'Sequência de checkpoint');
  validateProfile(o.profile, careerId);
  const profile = o.profile as Obj;
  if (o.shift === null) { if (profile.activeShiftId !== null) fail('Perfil aponta para expediente ausente'); }
  else validateShift(o.shift, careerId, profile);
  return o as unknown as CareerSaveBody;
}

/**
 * Migrações por versão: cada função leva um save da versão N para N+1 sem perder nada. O calendário
 * legado (`brejo-log003-workday-index`) é migrado por `CareerStore`, sem apagá-lo.
 * v1 → v2 (F3): nenhum pacote da v1 podia estar no porta-malas, então cada registro ganha `stowage: null`.
 */
export const SAVE_MIGRATIONS: Readonly<Record<number, (raw: Obj, checksum: unknown) => Obj>> = Object.freeze({
  1: (raw: Obj): Obj => {
    const shift = raw.shift;
    const parcels = isObj(shift) && Array.isArray(shift.parcels) ? (shift.parcels as unknown[]).map((p) => (isObj(p) ? { ...p, stowage: null } : p)) : null;
    return { ...raw, schemaVersion: 2, shift: parcels ? { ...(shift as Obj), parcels } : shift };
  },
  /**
   * v2 → v3 (F6): the incarnation id is derived from the career and the v2 checksum (stable for the
   * same save); no shift closed yet; an open shift gets its monotonic hour, the opening balance
   * implied by its ledger, and no world (v2 never recorded one: valid only while it has no parcel).
   * Ledger records gain the vehicle/platform they were valued with; values are re-checked by v3 rules.
   */
  2: (raw: Obj, checksum: unknown): Obj => {
    const profile = isObj(raw.profile) ? raw.profile : {};
    const lineageId = `${String(raw.careerId)}:v2-${String(checksum).replace(/^fnv1a32:/, '')}`;
    const shift = raw.shift;
    let nextShift: unknown = shift;
    if (isObj(shift)) {
      const pays = Array.isArray(shift.payments) ? shift.payments as Obj[] : [];
      const byId = new Map((Array.isArray(shift.parcels) ? shift.parcels as Obj[] : []).map((p) => [p.id, p]));
      const vehicle = isObj(profile.vehicle) ? profile.vehicle.kind : null;
      const payments = pays.map((q) => (isObj(q) ? { ...q, vehicle, platform: byId.get(q.parcelId)?.platform ?? null } : q));
      const total = pays.reduce((sum, q) => sum + (isObj(q) && typeof q.amountCents === 'number' ? q.amountCents : 0), 0);
      const minutes = typeof shift.elapsedVirtualMinutes === 'number' ? shift.elapsedVirtualMinutes : NaN;
      nextShift = { ...shift, payments, shiftHour: shiftHourOf(minutes), openingBalanceCents: (typeof profile.balanceCents === 'number' ? profile.balanceCents : 0) - total, world: null };
    }
    return { ...raw, schemaVersion: 3, profile: { ...profile, lineageId, lastClosedShift: null }, shift: nextShift };
  },
});

/** Valida (e migra, se houver migração) um save bruto. Lança `SaveError`; nunca devolve meio save. */
export function parseSave(raw: unknown, expectedCareer?: CareerId): CareerSave {
  if (!isObj(raw)) fail('Save não é um objeto');
  let o = raw as Obj;
  const version = o.schemaVersion;
  if (!Number.isSafeInteger(version) || (version as number) < 1) fail(`Versão de save não suportada: ${String(version)}`);
  if ((version as number) > SAVE_SCHEMA_VERSION) fail(`Save de versão futura (${String(version)}) não pode ser aberto por esta versão do jogo`);
  const { checksum, ...stored } = o;
  o = stored;
  const migrated = (version as number) < SAVE_SCHEMA_VERSION;
  // O checksum vale para o conteúdo NA VERSÃO EM QUE FOI GRAVADO: um save antigo é conferido antes de migrar.
  if (migrated && checksum !== checksumOf(stored as unknown as CareerSaveBody)) fail('Checksum inválido: save corrompido ou editado');
  for (let v = version as number; v < SAVE_SCHEMA_VERSION; v++) {
    const step = SAVE_MIGRATIONS[v];
    if (!step) fail(`Sem migração da versão ${v}`);
    o = step!(o, checksum);
  }
  const valid = validateBody(o);
  if (!migrated && checksum !== checksumOf(valid)) fail('Checksum inválido: save corrompido ou editado');
  if (expectedCareer && valid.careerId !== expectedCareer) fail(`Save da carreira ${valid.careerId}, esperado ${expectedCareer}`);
  // Um save migrado ganha o checksum do conteúdo atual; o original v1 não é reescrito aqui.
  return deepFreeze(JSON.parse(JSON.stringify({ ...valid, checksum: checksumOf(valid) })) as CareerSave);
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Obj)) deepFreeze(v);
  }
  return value;
}

