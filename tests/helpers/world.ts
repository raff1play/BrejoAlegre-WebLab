/**
 * B1-01 F6 test helper (not a test file): a minimal VALID running world for schema tests that
 * build parcels by hand. It is the real `LogisticsDay.captureState()` of a fresh day (no tasks,
 * couriers waiting) with the phase the test needs, and the player on foot.
 */
import { LogisticsDay } from '../../src/core/delivery/logisticsDay.ts';
import { buildRoster, type CareerId } from '../../src/core/career/careers.ts';
import { shiftHourOf, type WorldSnapshot } from '../../src/core/career/snapshot.ts';
import type { Phase } from '../../src/core/delivery/workday.ts';

export function worldOf(careerId: CareerId, phase: Phase = 'COLETA', mode: 'walking' | 'riding' = 'walking'): WorldSnapshot {
  const l = new LogisticsDay({ seed: 1, roster: buildRoster(careerId) }).captureState();
  return { logistics: { ...l, phase }, player: { mode, walker: { x: 0, z: 0, yaw: 0 }, vehicle: { x: 1, z: 0, yaw: 0 } } };
}
/** `elapsedVirtualMinutes` and the matching monotonic `shiftHour`. */
export const minutes = (m: number) => ({ elapsedVirtualMinutes: m, shiftHour: shiftHourOf(m) });
