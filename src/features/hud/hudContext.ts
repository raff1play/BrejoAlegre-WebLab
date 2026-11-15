import { DEPOT } from '../../world/city/cityPlan.ts';

/**
 * HUD-001: which presentation the HUD uses and the short texts it shows. Pure functions over the
 * existing state (mode, place, parcels): no new logistics state, nothing is copied or changed.
 */
export type HudMode = 'riding' | 'walking';
export type HudZone = 'street' | 'base';
/** Riding (objective, distance, clock, speed, map), on foot (interaction, cargo), at the base. */
export type HudContext = 'riding' | 'walking' | 'base';

export function hudContext(mode: HudMode, zone: HudZone): HudContext {
  return zone === 'base' ? 'base' : mode;
}

/** Inside the depot lot, in the depot's own (legacy) coordinates (`depotLocal`). */
export function inDepotLot(local: { x: number; z: number }): boolean {
  const b = DEPOT.lot;
  return local.x >= b.minX && local.x <= b.maxX && local.z >= b.minZ && local.z <= b.maxZ;
}

type ParcelView = Readonly<{ state: string; place: string; collector?: string; sector?: string }>;
const PLAYER_SECTOR = 'Oeste';
const COLLECTION_PHASES = new Set(['ANTES', 'COLETA', 'RETORNO']);

/**
 * "Mine" and "team" are kept apart: during the collection the player's store pickups versus the
 * three couriers' pickups; afterwards deliveries of the player's sector versus the other three.
 */
export function progressSummary(parcels: readonly ParcelView[], phase: string): { mine: string; team: string } {
  if (COLLECTION_PHASES.has(phase)) {
    const mine = parcels.filter((p) => p.collector === 'jogador');
    const team = parcels.filter((p) => p.collector !== undefined && p.collector.startsWith('npc'));
    const got = (list: readonly ParcelView[]) => list.filter((p) => p.state !== 'NA_LOJA').length;
    return { mine: `Minha coleta ${got(mine)}/${mine.length}`, team: `Equipe ${got(team)}/${team.length}` };
  }
  const mine = parcels.filter((p) => p.sector === PLAYER_SECTOR);
  const team = parcels.filter((p) => p.sector !== undefined && p.sector !== PLAYER_SECTOR);
  const done = (list: readonly ParcelView[]) => list.filter((p) => p.state === 'ENTREGUE').length;
  return { mine: `Minhas entregas ${done(mine)}/${mine.length}`, team: `Equipe ${done(team)}/${team.length}` };
}

const hh = (h: number) => `${String(Math.floor(h)).padStart(2, '0')}h${String(Math.floor((h % 1) * 60 + 1e-6)).padStart(2, '0')}`;

/**
 * Base context: receiving, sorting, the player's load and the schedule, in two short lines.
 * `sortTarget` is the calendar's sorting goal (15h normal, 16h high demand).
 */
export function baseSummary(parcels: readonly ParcelView[], sortTarget: number, sortedAt: number | null): [string, string] {
  const count = (places: readonly string[]) => parcels.filter((p) => places.includes(p.place)).length;
  const receiving = count(['recebimento', 'conferencia']);
  const sorting = count(['triagem', 'transferencia', 'gaiola', 'doca']);
  const mine = parcels.filter((p) => p.sector === PLAYER_SECTOR);
  const ready = mine.filter((p) => p.state === 'NA_SACA').length;
  const sorted = sortedAt === null ? `meta ${hh(sortTarget)}` : `separado ${hh(sortedAt)}`;
  return [
    `Recebimento ${receiving} · Triagem ${sorting} · Sua carga D02 ${ready}/${mine.length}`,
    `Triagem ${sorted} · Saca às 15h00 · Jornada até 21h00`,
  ];
}
