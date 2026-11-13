import { NODES } from '../../world/city/cityPlan.ts';
import type { RoadGraph } from './roadGraph.ts';

/**
 * CORE-013 fixed-time traffic signals. Each approach (inbound lane) gets its own exclusive phase
 * (green → yellow → all-red), followed by an exclusive pedestrian phase (walk → flashing → all-red).
 * Movements leaving one lane never conflict with each other, so two conflicting greens are
 * impossible by construction; tests check it again against the conflict matrix.
 */
export const SIGNAL_TIMING = Object.freeze({ green: 9, yellow: 3, allRed: 1.5, walk: 7, flash: 4 });

export type Aspect = 'green' | 'yellow' | 'red';
export type PedAspect = 'walk' | 'flash' | 'stop';
export type SignalPlan = Readonly<{ node: string; approaches: number[]; cycle: number; offset: number }>;
export type SignalState = Readonly<{ approach: number | null; aspect: Aspect; ped: PedAspect; phaseLeft: number }>;

export function buildSignalPlans(g: RoadGraph): Map<string, SignalPlan> {
  const plans = new Map<string, SignalPlan>();
  const T = SIGNAL_TIMING;
  NODES.filter((n) => n.control === 'signal').forEach((n, k) => {
    // Inbound lanes ordered clockwise from north so the sequence looks natural.
    const approaches = g.lanes.filter((l) => l.to === n.id).sort((a, b) => Math.atan2(-a.dir.x, -a.dir.z) - Math.atan2(-b.dir.x, -b.dir.z)).map((l) => l.index);
    const cycle = approaches.length * (T.green + T.yellow + T.allRed) + T.walk + T.flash + T.allRed;
    plans.set(n.id, { node: n.id, approaches, cycle, offset: k * 17 });
  });
  return plans;
}

export function signalState(plan: SignalPlan, time: number): SignalState {
  const T = SIGNAL_TIMING;
  let t = (((time + plan.offset) % plan.cycle) + plan.cycle) % plan.cycle;
  const slot = T.green + T.yellow + T.allRed;
  for (const approach of plan.approaches) {
    if (t < T.green) return { approach, aspect: 'green', ped: 'stop', phaseLeft: T.green - t };
    if (t < T.green + T.yellow) return { approach, aspect: 'yellow', ped: 'stop', phaseLeft: T.green + T.yellow - t };
    if (t < slot) return { approach: null, aspect: 'red', ped: 'stop', phaseLeft: slot - t };
    t -= slot;
  }
  if (t < T.walk) return { approach: null, aspect: 'red', ped: 'walk', phaseLeft: T.walk - t };
  if (t < T.walk + T.flash) return { approach: null, aspect: 'red', ped: 'flash', phaseLeft: T.walk + T.flash - t };
  return { approach: null, aspect: 'red', ped: 'stop', phaseLeft: T.walk + T.flash + T.allRed - t };
}

/** Aspect shown to one inbound lane. */
export function laneAspect(plan: SignalPlan, lane: number, time: number): Aspect {
  const s = signalState(plan, time);
  return s.approach === lane ? s.aspect : 'red';
}
