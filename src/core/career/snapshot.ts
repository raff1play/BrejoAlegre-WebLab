import { ACTORS, type ActorId } from '../delivery/dailyDemand.ts';
import { PARCEL_FLOW, PLACE_MOVES, type Parcel, type ParcelEvent, type ParcelPlace, type ParcelState } from '../delivery/parcels.ts';
import { SECTORS, type Sector } from '../delivery/sectors.ts';
import {
  APPEARANCE_PRESETS, CHARACTERS, EQUIPMENT_PRESETS, VEHICLE_KINDS, buildRoster, isCareerId,
  type AppearancePreset, type CareerId, type EquipmentPresetId, type HomeId, type Roster, type VehicleKind,
} from './careers.ts';

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
export const SAVE_SCHEMA_VERSION = 1;

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
}>;

/** Pacote serializado: a MESMA forma do `Parcel` de domínio (fonte única por ID), em cópia profunda. */
export type ParcelRecord = Readonly<{
  id: string; collector: string | null; sector: Sector | null; origin: string; destination: string;
  platform: Parcel['platform']; region: string; state: ParcelState; place: ParcelPlace; holder: string;
  position: { x: number; y: number; z: number } | null; dock: string | null; load: string | null;
  history: readonly ParcelEvent[];
}>;

/** Evento remunerado, idempotente por `eventId` (= shiftId + parcelId + tipo). */
export type PaymentRecord = Readonly<{ eventId: string; shiftId: string; parcelId: string; kind: 'ENTREGA'; amountCents: number }>;

export type SafePoint = Readonly<{ x: number; z: number; yaw: number; label: string }>;

/**
 * Expediente da carreira ativa (contrato C4). `shiftId` deriva da carreira + dia de calendário, logo
 * atravessar 00h não cria outro expediente; `elapsedVirtualMinutes` só cresce.
 */
export type ShiftSnapshot = Readonly<{
  shiftId: string;
  careerId: CareerId;
  calendarIndex: number;
  elapsedVirtualMinutes: number;
  phase: string;
  roster: Roster;
  parcels: readonly ParcelRecord[];
  payments: readonly PaymentRecord[];
  /** Minutos virtuais de atraso após 21h, por papel; null = sem atraso registrado. */
  lateByActor: Readonly<Record<ActorId, number | null>>;
  safePoint: SafePoint | null;
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
export const vehicleIdOf = (careerId: CareerId): string => `veiculo-${careerId}`;

export function defaultProfile(careerId: CareerId, calendarIndex = 0): CareerProfile {
  const c = CHARACTERS[careerId];
  return Object.freeze({
    careerId, homeId: c.homeId, sectorId: c.sector, appearance: c.defaultAppearance, equipment: c.defaultEquipment,
    vehicle: null, balanceCents: 0, experience: 0, calendarIndex, activeShiftId: null,
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
    history: p.history.map((e) => ({ ...e, position: e.position ? { ...e.position } : null })),
  }));
}

export function emptyShift(careerId: CareerId, calendarIndex: number, roster: Roster = buildRoster(careerId)): ShiftSnapshot {
  return {
    shiftId: shiftIdOf(careerId, calendarIndex), careerId, calendarIndex, elapsedVirtualMinutes: 0, phase: 'ANTES', roster,
    parcels: [], payments: [], lateByActor: { jogador: null, npc1: null, npc2: null, npc3: null }, safePoint: null,
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
}

function validateParcel(p: unknown): string {
  if (!isObj(p)) fail('Pacote inválido');
  const o = p as Obj;
  const id = str(o.id, 'ID de pacote');
  nullable(o.collector, (x) => str(x, 'Coletor'));
  nullable(o.sector, (x) => oneOf(x, SECTORS, 'Setor do pacote'));
  str(o.origin, 'Origem'); str(o.destination, 'Destino'); str(o.region, 'Região'); str(o.holder, 'Detentor');
  oneOf(o.platform, ['ML', 'SHP', 'LOJA'] as const, 'Plataforma');
  oneOf(o.state, PARCEL_FLOW, 'Estado do pacote');
  oneOf(o.place, PLACES, 'Local do pacote');
  const pos = (v: unknown) => { if (!isObj(v)) fail('Posição inválida'); const q = v as Obj; finite(q.x, 'x'); finite(q.y, 'y'); finite(q.z, 'z'); return v; };
  nullable(o.position, pos);
  nullable(o.dock, (x) => str(x, 'Doca')); nullable(o.load, (x) => str(x, 'Carga'));
  if (!Array.isArray(o.history) || !o.history.length) fail(`Histórico do pacote ${id} ausente`);
  for (const e of o.history as unknown[]) {
    if (!isObj(e)) fail('Evento de histórico inválido');
    const ev = e as Obj;
    oneOf(ev.state, PARCEL_FLOW, 'Estado no histórico'); oneOf(ev.place, PLACES, 'Local no histórico');
    finite(ev.hour, 'Hora no histórico'); str(ev.operation, 'Operação'); str(ev.holder, 'Detentor no histórico');
  }
  // O estado atual é o último registrado: o save não pode "pular" ou desfazer o histórico.
  const last = (o.history as Obj[])[(o.history as Obj[]).length - 1]!;
  if (last.state !== o.state || last.place !== o.place) fail(`Pacote ${id}: estado diverge do histórico`);
  return id;
}

function validateShift(s: unknown, careerId: CareerId, profile: Obj): void {
  if (!isObj(s)) fail('Expediente inválido');
  const o = s as Obj;
  if (o.careerId !== careerId) fail('Expediente pertence a outra carreira');
  const cal = int(o.calendarIndex, 0, 36500, 'Dia do expediente');
  if (o.shiftId !== shiftIdOf(careerId, cal)) fail('ID do expediente inconsistente');
  if (profile.activeShiftId !== o.shiftId) fail('Perfil não aponta para este expediente');
  finite(o.elapsedVirtualMinutes, 'Minutos do expediente');
  if ((o.elapsedVirtualMinutes as number) < 0) fail('Minutos do expediente negativos');
  str(o.phase, 'Fase');
  if (!isObj(o.roster)) fail('Roster ausente');
  const r = o.roster as Obj, expected = buildRoster(careerId);
  for (const a of ACTORS) if (r[a] !== expected[a]) fail('Roster diverge do personagem ativo');
  if (!Array.isArray(o.parcels)) fail('Pacotes ausentes');
  const ids = (o.parcels as unknown[]).map(validateParcel);
  if (new Set(ids).size !== ids.length) fail('ID de pacote duplicado');
  if (!Array.isArray(o.payments)) fail('Pagamentos ausentes');
  const known = new Set(ids), events = new Set<string>(), paid = new Set<string>();
  for (const p of o.payments as unknown[]) {
    if (!isObj(p)) fail('Pagamento inválido');
    const q = p as Obj;
    const eventId = str(q.eventId, 'Evento de pagamento'), parcelId = str(q.parcelId, 'Pacote pago');
    if (q.shiftId !== o.shiftId) fail('Pagamento de outro expediente');
    if (q.kind !== 'ENTREGA') fail('Tipo de pagamento inválido');
    if (!known.has(parcelId)) fail('Pagamento de pacote desconhecido');
    int(q.amountCents, 0, 1e9, 'Valor do pagamento');
    if (events.has(eventId) || paid.has(parcelId)) fail('Pagamento duplicado');
    events.add(eventId); paid.add(parcelId);
  }
  if (!isObj(o.lateByActor)) fail('Atrasos ausentes');
  for (const a of ACTORS) nullable((o.lateByActor as Obj)[a], (x) => { const n = finite(x, 'Atraso'); return n < 0 ? fail('Atraso negativo') : n; });
  nullable(o.safePoint, (v) => { if (!isObj(v)) fail('Ponto seguro inválido'); const q = v as Obj; finite(q.x, 'x'); finite(q.z, 'z'); finite(q.yaw, 'yaw'); str(q.label, 'Rótulo do ponto seguro'); return v; });
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
 * Migrações por versão: cada função leva um save da versão N para N+1. Hoje só existe a v1; o
 * calendário legado (`brejo-log003-workday-index`) é migrado por `CareerStore`, sem apagá-lo.
 */
export const SAVE_MIGRATIONS: Readonly<Record<number, (raw: Obj) => Obj>> = Object.freeze({});

/** Valida (e migra, se houver migração) um save bruto. Lança `SaveError`; nunca devolve meio save. */
export function parseSave(raw: unknown, expectedCareer?: CareerId): CareerSave {
  if (!isObj(raw)) fail('Save não é um objeto');
  let o = raw as Obj;
  const version = o.schemaVersion;
  if (!Number.isSafeInteger(version) || (version as number) < 1) fail(`Versão de save não suportada: ${String(version)}`);
  if ((version as number) > SAVE_SCHEMA_VERSION) fail(`Save de versão futura (${String(version)}) não pode ser aberto por esta versão do jogo`);
  for (let v = version as number; v < SAVE_SCHEMA_VERSION; v++) {
    const step = SAVE_MIGRATIONS[v];
    if (!step) fail(`Sem migração da versão ${v}`);
    o = step!(o);
  }
  const checksum = o.checksum;
  const { checksum: _ignored, ...body } = o;
  const valid = validateBody(body);
  if (checksum !== checksumOf(valid)) fail('Checksum inválido: save corrompido ou editado');
  if (expectedCareer && valid.careerId !== expectedCareer) fail(`Save da carreira ${valid.careerId}, esperado ${expectedCareer}`);
  return deepFreeze(JSON.parse(JSON.stringify({ ...valid, checksum })) as CareerSave);
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Obj)) deepFreeze(v);
  }
  return value;
}

