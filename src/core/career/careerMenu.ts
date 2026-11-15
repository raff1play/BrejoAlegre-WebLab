import {
  APPEARANCE_PRESETS, CAREER_IDS, CHARACTERS, EQUIPMENT_PRESETS, VEHICLE_KINDS, buildRoster, careerHome, isCareerId,
  type AppearancePreset, type CareerId, type EquipmentPresetId, type VehicleKind,
} from './careers.ts';
import type { CareerBoot } from './careerBoot.ts';
import { CareerSession, CareerStore, type KeyValueStorage, type LoadSource } from './careerStore.ts';
import { SaveError, chooseStartingVehicle, customize } from './snapshot.ts';
import { calendarDay } from '../delivery/operatingCalendar.ts';

/**
 * B1-01 F3.5: main menu model (pure, no DOM). Building the four cards ONLY READS the saves
 * (`CareerStore.readAll`): opening or looking at the menu never creates, migrates or resets
 * anything. Writing happens only in `enterCareer`, after the player confirms one career.
 */
export type CareerCard = Readonly<{
  careerId: CareerId;
  name: string;
  sector: string;
  homeId: string;
  homeStreet: string;
  appearance: AppearancePreset;
  equipment: EquipmentPresetId;
  /** The vehicle actually saved, or null when it still has to be chosen (once). */
  vehicle: VehicleKind | null;
  /** True when a valid save exists in storage (principal or previous copy). */
  saved: boolean;
  source: LoadSource;
  calendarIndex: number;
  dayLabel: string;
  checkpoint: number | null;
  /** Saved balance in cents, only when a save exists (no invented money). */
  balanceCents: number | null;
  activeShiftId: string | null;
  /** Problem reading the save (shown to the player, never silently reset). */
  problem: string | null;
  /** Null when it can be entered; otherwise the reason shown on the card. */
  blocked: string | null;
  isActive: boolean;
}>;

export type MenuModel = Readonly<{ cards: readonly CareerCard[]; active: CareerId; lockedBy: CareerId | null; durable: boolean }>;

export function menuModel(storage: KeyValueStorage, durable = true): MenuModel {
  const store = new CareerStore(storage);
  const all = store.readAll();
  const active = store.activeCareer();
  const open = all[active].save.profile.activeShiftId;
  const lockedBy = open !== null ? active : null;
  const cards = CAREER_IDS.map((id): CareerCard => {
    const r = all[id]; const p = r.save.profile; const c = CHARACTERS[id]; const home = careerHome(id);
    // A main save that could not be read and has no valid previous copy is NOT offered: entering
    // would write a fresh profile over it. The player sees the error instead of a silent reset.
    const corrupt = r.problem !== null && !r.persisted;
    const blocked = corrupt ? `Save inválido: ${r.problem}` : lockedBy && id !== lockedBy ? `Expediente aberto de ${CHARACTERS[lockedBy].name}: termine-o antes de trocar de carreira` : null;
    let dayLabel: string;
    try { dayLabel = calendarDay(p.calendarIndex).label; } catch { dayLabel = `dia ${p.calendarIndex}`; }
    return Object.freeze({
      careerId: id, name: c.name, sector: c.sector, homeId: home.id, homeStreet: home.street,
      appearance: p.appearance, equipment: p.equipment, vehicle: p.vehicle?.kind ?? null,
      saved: r.persisted, source: r.source, calendarIndex: p.calendarIndex, dayLabel,
      checkpoint: r.persisted ? r.save.checkpointSequence : null,
      balanceCents: r.persisted ? p.balanceCents : null,
      activeShiftId: p.activeShiftId, problem: r.problem, blocked, isActive: id === active,
    });
  });
  return Object.freeze({ cards: Object.freeze(cards), active, lockedBy, durable });
}

export type CareerChoice = Readonly<{ appearance: AppearancePreset; equipment: EquipmentPresetId; vehicle: VehicleKind | null }>;

/**
 * Enters one career after the player confirms it. Order matters (audit of comment 6903050464):
 * 1. everything is validated WITHOUT writing (presets, vehicle against the saved one, unreadable
 *    save, another career's open shift — decision 8 / AC-17);
 * 2. the chosen career's own profile is written through a session bound explicitly to that
 *    `careerId`, in ONE checkpoint (non-destructive legacy calendar migration for Oeste, presets
 *    and — only when none is saved — the one-time vehicle);
 * 3. ONLY THEN does it become the active career.
 * Any failure throws `SaveError` before the active-career pointer changes, so a failed attempt
 * never switches careers and never claims to have saved what it did not.
 */
export function enterCareer(storage: KeyValueStorage, careerId: CareerId, choice: CareerChoice): CareerBoot {
  if (!isCareerId(careerId)) throw new SaveError(`Carreira inválida: ${String(careerId)}`);
  if (!(APPEARANCE_PRESETS as readonly string[]).includes(choice.appearance)) throw new SaveError('Aparência inválida');
  if (!EQUIPMENT_PRESETS.some((e) => e.id === choice.equipment)) throw new SaveError('Equipamento inválido');
  if (choice.vehicle !== null && !(VEHICLE_KINDS as readonly string[]).includes(choice.vehicle)) throw new SaveError('Veículo inválido');
  const store = new CareerStore(storage);
  const active = store.activeCareer();
  if (active !== careerId) {
    const open = store.read(active).save.profile.activeShiftId;
    if (open !== null) throw new SaveError(`Expediente ${open} aberto: troca de carreira só após finalizar o expediente`);
  }
  const session = new CareerSession(store, careerId);
  if (session.loadProblem !== null && session.loadSource === 'novo') throw new SaveError(`Save inválido de ${CHARACTERS[careerId].name}: ${session.loadProblem}`);
  const p = session.profile;
  const owned = p.vehicle?.kind ?? null;
  if (owned !== null && choice.vehicle !== null && choice.vehicle !== owned) throw new SaveError('Veículo inicial já escolhido: permanece fixo até a garagem futura');
  if (owned === null && choice.vehicle === null) throw new SaveError('Escolha o veículo inicial da carreira');
  // Validate the new profile with the domain rules before any write.
  let next = customize(p, { appearance: choice.appearance, equipment: choice.equipment });
  if (next.vehicle === null) next = chooseStartingVehicle(next, choice.vehicle!);
  const notes: string[] = [];
  if (session.loadProblem) notes.push(session.loadProblem);
  const unsaved = session.loadSource === 'novo' || session.loadSource === 'legado';
  const changed = p.appearance !== next.appearance || p.equipment !== next.equipment || owned === null;
  if (unsaved || changed) {
    const finalProfile = next;
    session.commit(careerId, (_profile, shift) => ({ profile: finalProfile, shift }));
    if (session.loadSource === 'legado') notes.push('Calendário legado migrado para a carreira Oeste');
  }
  store.setActiveCareer(careerId);
  return Object.freeze({
    session, roster: buildRoster(careerId), home: careerHome(careerId),
    calendarIndex: session.profile.calendarIndex, notes: Object.freeze(notes),
  });
}
