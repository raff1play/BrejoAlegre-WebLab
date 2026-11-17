/**
 * Test helper (not a test file): the player's part of a MOTORCYCLE day, decided only from the
 * current state (collect, stow, hand over, sack, release at 20h54, deliveries 20h59/21h01, one
 * failed attempt, the rest after 00h01, then the physical return). Same script as
 * `tests/b1-01-persistence.test.ts`, kept here for the F7 audit regressions.
 */
import type { LogisticsDay } from '../../src/core/delivery/logisticsDay.ts';
import { ACTORS } from '../../src/core/delivery/dailyDemand.ts';
import { SECTOR_DATA } from '../../src/core/delivery/sectors.ts';
import { depotWorld, depotYaw } from '../../src/world/city/cityPlan.ts';

const H = (hh: number, mm: number) => hh + mm / 60;
export const BIKE = { ...depotWorld(84, -111), yaw: depotYaw(0), moving: false };

export function motoPlayerStep(d: LogisticsDay, hour: number): void {
  const atVehicle = { player: { ...depotWorld(84, -112.25), riding: false }, bike: BIKE };
  const desk = { player: { ...depotWorld(97.8, -122.3), riding: false }, bike: BIKE };
  const dock = { player: { ...depotWorld(SECTOR_DATA[d.playerSector].x, -116.7), riding: false }, bike: BIKE };
  for (const kind of d.assigned) if (d.readyAt(kind).length && !d.inHands().length) { d.collect(kind, hour); d.stow(hour); return; }
  if (!d.released) {
    if (!d.inHands().length && d.trunkForDepot().length) { d.unloadForDepot(hour, false, atVehicle); return; }
    if (d.inHands().some((p) => p.state === 'EM_TRANSPORTE')) { d.handOver(hour, desk); return; }
    if (d.canTakeSack(hour)) { d.takeSack(hour, dock); d.stow(hour); return; }
    if (d.teamReady && hour >= H(20, 54)) d.release(hour);
    return;
  }
  const mine = d.load('jogador');
  const delivered = new Set(mine.filter((p) => p.state === 'ENTREGUE').map((p) => p.destination)).size;
  const attempted = mine.some((p) => p.history.some((e) => e.operation === 'tentativa:frustrada'));
  const next = d.route[0];
  const slot = delivered === 0 ? H(20, 59) : delivered === 1 ? H(21, 1) : attempted ? H(24, 1) : H(21, 30);
  if (next && hour >= slot) { d.takeForAddress(next, hour); if (d.recipientAbsent(next)) { d.registerAttempt(next, hour); d.stow(hour); } else d.deliver(next, hour); return; }
  if (!d.route.length && d.returnsPending().length) { if (!d.inHands().length) d.unloadForDepot(hour, false, atVehicle); else d.handOver(hour, desk); }
}
/** One absent recipient per courier (the 3rd address of its sorted list). */
export function markAbsent(d: LogisticsDay): void {
  for (const a of ACTORS) { const list = [...new Set(d.load(a).map((p) => p.destination))].sort(); d.absentAddresses.add(list[Math.min(2, list.length - 1)]!); }
}
